import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Client, RemoteAuth, MessageMedia } from 'whatsapp-web.js';
import { WhatsAppSessionStatus } from '@prisma/client';
import { DatabaseService } from '../utils/database/database.service';
import { S3Service } from '../utils/s3/s3.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SessionStatusDto, QRCodeResponseDto, SessionListDto } from './dto/session-status.dto';
import { SendMessageDto, SendMessageResponseDto } from './dto/send-message.dto';
import { SendBulkMessageDto, SendBulkMessageResponseDto, BulkMessageResult } from './dto/bulk-message.dto';
import { WhatsAppClientInstance, SessionEventHandlers } from './interfaces/whatsapp-client.interface';
import { CustomS3Store } from './stores/custom-s3-store';
import { AuthRecoveryService } from './services/auth-recovery.service';
import { SessionDiagnosticsService } from './services/session-diagnostics.service';

@Injectable()
export class WebjsService implements OnModuleDestroy {
    private readonly logger = new Logger(WebjsService.name);
    private clients: Map<string, WhatsAppClientInstance> = new Map();
    private s3Store: CustomS3Store;
    private authRecoveryService: AuthRecoveryService;
    private sessionDiagnosticsService: SessionDiagnosticsService;
    private activeTimers: Map<string, { progressInterval?: NodeJS.Timeout; timeoutHandle?: NodeJS.Timeout }> = new Map();

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly s3Service: S3Service,
    ) {
        this.initializeS3Store().catch(error => {
            this.logger.error('Failed to initialize S3 store:', error);
        });
        this.startPeriodicCleanup();
        this.performStartupRecovery().catch((error: any) => {
            this.logger.error('Failed to perform startup recovery:', error);
        });
    }

    async onModuleDestroy() {
        this.logger.log('Destroying all WhatsApp clients...');

        // Clean up all active timers first
        this.cleanupAllTimers();

        const clientEntries = Array.from(this.clients.entries());
        for (const [sessionId, clientInstance] of clientEntries) {
            try {
                await clientInstance.client.destroy();
                this.logger.log(`Client ${sessionId} destroyed successfully`);
            } catch (error) {
                this.logger.error(`Error destroying client ${sessionId}:`, error);
            }
        }
        this.clients.clear();
    }

    private async initializeS3Store() {
        this.s3Store = new CustomS3Store({
            bucketName: process.env.AWS_BUCKET_NAME,
            remoteDataPath: 'whatsapp-sessions/',
            s3Client: {
                region: process.env.AWS_S3_REGION,
                credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                },
            },
        });

        // Initialize AuthRecoveryService after S3Store is ready
        this.authRecoveryService = new AuthRecoveryService(this.databaseService, this.s3Store);

        // Initialize SessionDiagnosticsService
        this.sessionDiagnosticsService = new SessionDiagnosticsService(this.databaseService, this.s3Store);

        // Test S3 connection on initialization
        try {
            const connectionTest = await this.s3Store.testConnection();
            if (connectionTest) {
                this.logger.log('✅ S3 Store initialized and tested successfully for WhatsApp sessions');
            } else {
                this.logger.error('❌ S3 Store connection test failed');
            }
        } catch (error) {
            this.logger.error('❌ S3 Store initialization failed:', error);
        }
    }

    // Perform comprehensive startup recovery
    private async performStartupRecovery(): Promise<void> {
        try {
            this.logger.log('🚀 Starting comprehensive authentication recovery...');

            // Wait for S3Store to be initialized
            let retries = 0;
            while (!this.authRecoveryService && retries < 10) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                retries++;
            }

            if (!this.authRecoveryService) {
                this.logger.error('❌ AuthRecoveryService not initialized, skipping recovery');
                return;
            }

            // Check authentication folder integrity
            const authFolderOk = await this.authRecoveryService.checkAuthFolderIntegrity();

            if (authFolderOk) {
                this.logger.log('✅ Authentication folder is intact, proceeding with normal session restoration');
                await this.restoreActiveSessions();
            } else {
                this.logger.warn('🚨 Authentication folder missing or corrupted, performing recovery...');

                // Perform authentication recovery
                const recoveryReport = await this.authRecoveryService.performAuthRecovery();

                // After recovery, restore sessions that were successfully recovered
                await this.restoreRecoveredSessions(recoveryReport);
            }
        } catch (error) {
            this.logger.error('❌ Startup recovery failed:', error);
            // Fallback to normal session restoration
            try {
                await this.restoreActiveSessions();
            } catch (fallbackError) {
                this.logger.error('❌ Fallback session restoration also failed:', fallbackError);
            }
        }
    }

    // Restore sessions after recovery process
    private async restoreRecoveredSessions(recoveryReport: any): Promise<void> {
        try {
            this.logger.log('🔄 Restoring recovered sessions...');

            for (const result of recoveryReport.results) {
                if (result.success && result.recoveryMethod === 'S3_RESTORED') {
                    try {
                        this.logger.log(`🔄 Initializing recovered session: ${result.sessionId}`);
                        await this.initializeClient(result.sessionId, true); // Pass isRestoration = true
                        await new Promise(resolve => setTimeout(resolve, 2000)); // Delay between initializations
                    } catch (error) {
                        this.logger.error(`❌ Failed to initialize recovered session ${result.sessionId}:`, error);

                        // Update session status to reflect initialization failure
                        await this.safeUpdateSession(result.sessionId, {
                            status: WhatsAppSessionStatus.DISCONNECTED,
                            is_ready: false,
                            is_authenticated: false,
                            last_error: error.message || 'Session initialization failed during recovery',
                            last_error_time: new Date(),
                        });
                    }
                } else if (result.success && result.recoveryMethod === 'QR_REGENERATED') {
                    this.logger.log(`📱 Session ${result.sessionId} marked for QR regeneration - will initialize on first access`);
                }
            }

            this.logger.log(`✅ Recovery restoration completed. Active clients: ${this.clients.size}`);

        } catch (error) {
            this.logger.error('❌ Error restoring recovered sessions:', error);
        }
    }

    // Clean up all timers for a specific session
    private cleanupSessionTimers(sessionId: string): void {
        const timers = this.activeTimers.get(sessionId);
        if (timers) {
            if (timers.progressInterval) {
                clearInterval(timers.progressInterval);
                this.logger.log(`🧹 Cleared progress interval for session ${sessionId}`);
            }
            if (timers.timeoutHandle) {
                clearTimeout(timers.timeoutHandle);
                this.logger.log(`🧹 Cleared timeout handle for session ${sessionId}`);
            }
            this.activeTimers.delete(sessionId);
        }
    }

    // Clean up all active timers
    private cleanupAllTimers(): void {
        for (const [sessionId] of this.activeTimers) {
            this.cleanupSessionTimers(sessionId);
        }
    }

    // Perform pre-initialization checks to identify potential issues early
    private async performPreInitializationChecks(sessionId: string): Promise<void> {
        this.logger.log(`🔍 Performing pre-initialization checks for session ${sessionId}...`);

        try {
            // Check S3 connectivity
            const s3Connected = await this.s3Store.testConnection();
            if (!s3Connected) {
                this.logger.warn(`⚠️ S3 connection test failed for session ${sessionId}`);
            } else {
                this.logger.log(`✅ S3 connectivity check passed for session ${sessionId}`);
            }

            // Check system memory (basic check)
            const memUsage = process.memoryUsage();
            const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
            this.logger.log(`💾 Memory usage: ${memUsageMB}MB for session ${sessionId}`);

            if (memUsageMB > 500) {
                this.logger.warn(`⚠️ High memory usage (${memUsageMB}MB) may affect performance for session ${sessionId}`);
            }

            // Check active clients count
            const activeClients = this.clients.size;
            this.logger.log(`👥 Active clients: ${activeClients} (including new session ${sessionId})`);

            if (activeClients > 5) {
                this.logger.warn(`⚠️ High number of active clients (${activeClients}) may affect performance`);
            }

            // Test basic network connectivity (simple DNS lookup)
            try {
                const dns = require('dns');
                await new Promise((resolve, reject) => {
                    dns.lookup('web.whatsapp.com', (err) => {
                        if (err) reject(err);
                        else resolve(true);
                    });
                });
                this.logger.log(`🌐 Network connectivity to WhatsApp Web confirmed for session ${sessionId}`);
            } catch (networkError) {
                this.logger.error(`❌ Network connectivity issue detected for session ${sessionId}:`, networkError);
                throw new Error(`Network connectivity issue: Cannot reach WhatsApp Web servers. Please check your internet connection.`);
            }

        } catch (error) {
            this.logger.error(`❌ Pre-initialization check failed for session ${sessionId}:`, error);
            throw error;
        }
    }

    async createSession(createSessionDto: CreateSessionDto): Promise<SessionStatusDto> {
        const { user_id } = createSessionDto;

        // Check if user exists
        const user = await this.databaseService.user.findUnique({
            where: { id: user_id },
        });

        if (!user) {
            throw new Error('User not found');
        }

        // Check if user already has an active session and delete it
        const existingSession = await this.databaseService.whatsAppSession.findFirst({
            where: {
                user_id,
                status: {
                    not: WhatsAppSessionStatus.DESTROYED
                }
            },
        });


        if (existingSession) {
            this.logger.log(`Deleting existing session ${existingSession.session_id} for user ${user_id}`);
            try {
                await this.deleteSession(existingSession.session_id);
                this.logger.log(`Successfully deleted existing session for user ${user_id}`);
            } catch (error) {
                this.logger.error(`Failed to delete existing session: ${error.message}`);
                // Continue anyway - we'll create a new session
            }
        }

        // Use user_id as session_id since one user = one session
        const sessionId = user_id;
        const s3SessionKey = `whatsapp-sessions/${sessionId}`;

        // Create session record in database
        const session = await this.databaseService.whatsAppSession.create({
            data: {
                user_id,
                session_id: sessionId,
                session_name: `WhatsApp for ${user.first_name} ${user.last_name}`,
                status: WhatsAppSessionStatus.INITIALIZING,
                s3_session_key: s3SessionKey,
            },
        });

        this.logger.log(`Created session ${sessionId} for user ${user_id}`);

        return this.mapSessionToDto(session);
    }

    async initializeClient(sessionId: string, isRestoration: boolean = false, retryCount: number = 0): Promise<QRCodeResponseDto> {
        const maxRetries = 2;

        try {
            return await this.attemptClientInitialization(sessionId, isRestoration, retryCount);
        } catch (error) {
            if (retryCount < maxRetries) {
                this.logger.warn(`⚠️ Initialization attempt ${retryCount + 1} failed for session ${sessionId}, retrying...`);

                // Clean up any partial initialization
                if (this.clients.has(sessionId)) {
                    const clientInstance = this.clients.get(sessionId);
                    try {
                        await clientInstance?.client?.destroy();
                    } catch (cleanupError) {
                        this.logger.error(`Error cleaning up failed client:`, cleanupError);
                    }
                    this.clients.delete(sessionId);
                }

                // Wait a bit before retry
                await new Promise(resolve => setTimeout(resolve, 5000));

                return this.initializeClient(sessionId, isRestoration, retryCount + 1);
            } else {
                this.logger.error(`❌ All ${maxRetries + 1} initialization attempts failed for session ${sessionId}`);
                throw error;
            }
        }
    }

    private async attemptClientInitialization(sessionId: string, isRestoration: boolean, retryCount: number): Promise<QRCodeResponseDto> {
        const session = await this.databaseService.whatsAppSession.findUnique({
            where: { session_id: sessionId },
        });

        if (!session) {
            throw new Error('Session not found');
        }

        if (this.clients.has(sessionId)) {
            throw new Error('Client already initialized for this session');
        }

        // Pre-initialization checks (skip on retries to save time)
        if (retryCount === 0) {
            await this.performPreInitializationChecks(sessionId);
        } else {
            this.logger.log(`🔄 Retry attempt ${retryCount + 1} for session ${sessionId}, skipping pre-checks`);
        }

        // Check if this is a restoration from S3 and session should be authenticated
        const isAuthenticatedRestore = isRestoration &&
            (session.status === WhatsAppSessionStatus.AUTHENTICATED ||
                session.status === WhatsAppSessionStatus.READY);

        // Enhanced restoration detection and logging
        this.logger.log(`🔍 Session restoration analysis for ${sessionId}:`);
        this.logger.log(`   📊 isRestoration flag: ${isRestoration}`);
        this.logger.log(`   📊 Session status in DB: ${session.status}`);
        this.logger.log(`   📊 isAuthenticatedRestore: ${isAuthenticatedRestore}`);
        this.logger.log(`   📊 Session created: ${session.created_at}`);
        this.logger.log(`   📊 Session last activity: ${session.last_activity || 'Never'}`);
        this.logger.log(`   📊 Session is_authenticated: ${session.is_authenticated}`);
        this.logger.log(`   📊 Session is_ready: ${session.is_ready}`);

        // Check for corrupted restoration scenarios
        if (isRestoration && !isAuthenticatedRestore) {
            this.logger.warn(`🚨 Corrupted restoration detected for ${sessionId} - status is ${session.status} but should be READY/AUTHENTICATED`);

            // Mark as disconnected instead of generating QR
            await this.safeUpdateSession(sessionId, {
                status: WhatsAppSessionStatus.DISCONNECTED,
                is_ready: false,
                is_authenticated: false,
                last_error: `Corrupted session restoration - status was ${session.status}`,
                last_error_time: new Date(),
            });

            throw new Error(`Session ${sessionId} is corrupted and cannot be restored. Please create a new session.`);
        }

        if (isAuthenticatedRestore) {
            this.logger.log(`🔄 ✅ RESTORATION PATH: Initializing restored authenticated session: ${sessionId}`);
        } else {
            this.logger.log(`🆕 ❌ NEW SESSION PATH: Initializing new session: ${sessionId}`);
            if (isRestoration) {
                this.logger.warn(`⚠️ Restoration was requested but session status (${session.status}) is not READY/AUTHENTICATED`);
            }
        }

        // Create WhatsApp client with optimized RemoteAuth
        // Try RemoteAuth first, fallback to LocalAuth if needed
        let authStrategy;
        try {
            // Use RemoteAuth for production (with optimized settings)
            authStrategy = new RemoteAuth({
                clientId: sessionId,
                dataPath: '.wwebjs_auth', // Local fallback path
                store: this.s3Store,
                backupSyncIntervalMs: 300000, // 5 minutes (increased from 1 minute)
            });
            this.logger.log(`🔧 Using RemoteAuth for session ${sessionId} (production mode)`);
        } catch (remoteAuthError) {
            this.logger.warn(`⚠️ RemoteAuth failed for session ${sessionId}, falling back to LocalAuth:`, remoteAuthError);
            const { LocalAuth } = require('whatsapp-web.js');
            authStrategy = new LocalAuth({
                clientId: sessionId,
                dataPath: '.wwebjs_auth',
            });
            this.logger.log(`🔧 Using LocalAuth fallback for session ${sessionId}`);
        }

        const client = new Client({
            authStrategy,
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--no-first-run',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--disable-default-apps',
                    '--disable-sync',
                    '--disable-translate',
                    '--hide-scrollbars',
                    '--mute-audio',
                    '--no-default-browser-check',
                    '--no-pings',
                    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                ],
                defaultViewport: {
                    width: 1280,
                    height: 720
                },
                timeout: 180000, // Increased to 3 minutes for WhatsApp Web loading
                ignoreDefaultArgs: ['--disable-extensions'], // Allow WhatsApp Web to work properly
            },
        });

        // Create client instance
        const clientInstance: WhatsAppClientInstance = {
            client,
            sessionId,
            userId: session.user_id,
            status: WhatsAppSessionStatus.INITIALIZING,
            isReady: false,
            isAuthenticated: false,
            lastActivity: new Date(),
        };

        // Store client instance
        this.clients.set(sessionId, clientInstance);

        // Initialize client with detailed logging
        this.logger.log(`🚀 Starting browser initialization for session ${sessionId}...`);
        const initStartTime = Date.now();

        // Add page navigation logging
        try {
            const page = await client.pupPage;
            if (page) {
                page.on('domcontentloaded', () => {
                    this.logger.log(`📄 WhatsApp Web DOM loaded for session ${sessionId}`);
                });
                page.on('load', () => {
                    this.logger.log(`📄 WhatsApp Web page fully loaded for session ${sessionId}`);
                });
            }
        } catch (pageError) {
            this.logger.warn(`⚠️ Could not access page for logging: ${pageError.message}`);
        }

        await client.initialize();

        const initDuration = Date.now() - initStartTime;
        this.logger.log(`✅ Browser initialized for session ${sessionId} in ${initDuration}ms`);

        if (isAuthenticatedRestore) {
            // For authenticated restorations, wait for ready event instead of QR
            this.logger.log(`🔄 Restored session ${sessionId} initializing, waiting for authentication...`);

            // Set up event handlers for authenticated restoration
            this.setupOtherEventHandlers(clientInstance);

            // Wait for the session to become ready (extended timeout for RemoteAuth S3 restoration)
            const readyPromise = new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Session restoration timeout - session did not become ready after 300 seconds'));
                }, 300000); // Increased to 5 minutes for RemoteAuth S3 restoration

                // Progress logging for RemoteAuth restoration with detailed tracking
                let elapsed = 0;
                const startTime = Date.now();
                const progressInterval = setInterval(async () => {
                    elapsed += 30;
                    const currentTime = Date.now();
                    const actualElapsed = Math.round((currentTime - startTime) / 1000);
                    this.logger.log(`⏱️ RemoteAuth restoration progress: ${elapsed}s target / ${actualElapsed}s actual elapsed for session ${sessionId}`);
                    this.logger.log(`   🔍 Current client status: ${clientInstance.status || 'UNKNOWN'}`);
                    this.logger.log(`   🔍 Auth received: ${authReceived}, Ready received: ${readyReceived}`);
                    // Check S3 session existence and size asynchronously
                    this.s3Store.checkSessionExists(sessionId).then(exists => {
                        this.logger.log(`   📦 S3 session exists: ${exists}`);
                        if (exists) {
                            // Log that large S3 files take longer to download
                            this.logger.log(`   📥 RemoteAuth downloading S3 session data (large files may take 2-5 minutes)`);
                        }
                    }).catch(() => {
                        this.logger.log(`   📦 S3 session exists: false (error checking)`);
                    });
                    if (elapsed >= 300) { // Updated for 5-minute timeout
                        clearInterval(progressInterval);
                    }
                }, 30000);

                let authReceived = false;
                let readyReceived = false;

                // Enhanced RemoteAuth event handling with download monitoring
                client.on('remote_session_saved', () => {
                    this.logger.log(`📦 Remote session saved to S3 for ${sessionId}`);
                });

                // Monitor WhatsApp Web loading (includes S3 download)
                client.on('loading_screen', (percent, message) => {
                    this.logger.log(`📱 RemoteAuth loading: ${percent}% - ${message} for session ${sessionId}`);
                    if (message.includes('Loading') || message.includes('Downloading')) {
                        this.logger.log(`📥 S3 download in progress for session ${sessionId}`);
                    }
                });

                client.on('change_state', (state) => {
                    this.logger.log(`📱 RemoteAuth state change: ${state} for session ${sessionId}`);
                    if (state === 'OPENING') {
                        this.logger.log(`🔄 RemoteAuth opening browser for session ${sessionId}`);
                    } else if (state === 'PAIRING') {
                        this.logger.log(`🔗 RemoteAuth pairing with S3 data for session ${sessionId}`);
                    }
                });

                // Add specific RemoteAuth restoration events
                client.on('auth_failure', (message) => {
                    this.logger.error(`❌ RemoteAuth failure during restoration: ${message} for session ${sessionId}`);
                });

                client.on('disconnected', (reason) => {
                    this.logger.warn(`🔌 RemoteAuth disconnected during restoration: ${reason} for session ${sessionId}`);
                });

                // Monitor QR events (shouldn't happen during restoration)
                client.on('qr', async () => {
                    this.logger.error(`🚨 QR event during RemoteAuth restoration - S3 session data is corrupted for session ${sessionId}`);
                    this.logger.log(`🗑️ Cleaning up corrupted S3 session data for ${sessionId}`);

                    // Clean up corrupted S3 session
                    try {
                        await this.s3Store.delete({ session: sessionId });
                        this.logger.log(`✅ Deleted corrupted S3 session data for ${sessionId}`);
                    } catch (error) {
                        this.logger.error(`❌ Failed to delete corrupted S3 data:`, error);
                    }

                    // Mark session as corrupted
                    await this.safeUpdateSession(sessionId, {
                        status: WhatsAppSessionStatus.DISCONNECTED,
                        is_ready: false,
                        is_authenticated: false,
                        last_error: 'S3 session data corrupted - cleaned up and requires re-authentication',
                        last_error_time: new Date(),
                    });
                });

                client.on('authenticated', () => {
                    this.logger.log(`🔐 Session ${sessionId} authenticated during restoration`);
                    authReceived = true;
                });

                client.on('ready', () => {
                    clearTimeout(timeout);
                    clearInterval(progressInterval);
                    this.logger.log(`✅ Session ${sessionId} restored and ready`);
                    readyReceived = true;
                    resolve();
                });

                client.on('auth_failure', (message) => {
                    clearTimeout(timeout);
                    clearInterval(progressInterval);
                    reject(new Error(`Authentication failed during restoration: ${message}`));
                });

                // Handle disconnection during restoration
                client.on('disconnected', (reason) => {
                    if (!readyReceived) {
                        clearTimeout(timeout);
                        clearInterval(progressInterval);
                        reject(new Error(`Session disconnected during restoration: ${reason}`));
                    }
                });
            });

            try {
                await readyPromise;

                // Update session status to ready
                await this.safeUpdateSession(sessionId, {
                    status: WhatsAppSessionStatus.READY,
                    is_ready: true,
                    is_authenticated: true,
                });

                return {
                    session_id: sessionId,
                    qr_code: null,
                    status: WhatsAppSessionStatus.READY,
                };
            } catch (error) {
                this.logger.error(`❌ Session restoration failed for ${sessionId}:`, error);

                // Check if session exists in S3 before marking as disconnected
                const sessionExistsInS3 = await this.s3Store.checkSessionExists(sessionId).catch(() => false);

                if (!sessionExistsInS3) {
                    this.logger.warn(`🚨 Session ${sessionId} not found in S3, marking as DISCONNECTED`);
                } else {
                    this.logger.warn(`🚨 Session ${sessionId} restoration failed despite S3 data existing - session may be corrupted`);
                }

                // Mark session as DISCONNECTED instead of falling back to QR
                await this.safeUpdateSession(sessionId, {
                    status: WhatsAppSessionStatus.DISCONNECTED,
                    is_ready: false,
                    is_authenticated: false,
                    last_error: `Session restoration failed: ${error.message}`,
                    last_error_time: new Date(),
                });

                // Clean up failed client
                try {
                    await client.destroy();
                    this.clients.delete(sessionId);
                } catch (cleanupError) {
                    this.logger.error(`Error cleaning up failed restoration client:`, cleanupError);
                }

                this.logger.log(`🔌 Session ${sessionId} marked as DISCONNECTED due to restoration failure`);

                // Return early - don't continue to QR generation
                return {
                    session_id: sessionId,
                    qr_code: null,
                    status: WhatsAppSessionStatus.DISCONNECTED,
                };
            }
        }

        // For new sessions or failed restorations, generate QR code
        this.logger.log(`Client initialized for session ${sessionId}, waiting for QR code...`);

        // Set up event handlers with QR code promise
        const qrCodePromise = this.setupEventHandlersWithQRPromise(clientInstance);

        try {
            // Clean up any existing timers for this session first
            this.cleanupSessionTimers(sessionId);

            // Wait for QR code generation with extended timeout
            this.logger.log(`⏱️ Waiting for QR code generation for session ${sessionId}...`);

            const qrCode = await Promise.race([
                qrCodePromise,
                new Promise<string>((_, reject) => {
                    // Log progress every 20 seconds
                    let elapsed = 0;
                    const progressInterval = setInterval(() => {
                        elapsed += 20;
                        this.logger.log(`⏱️ QR generation progress: ${elapsed}s elapsed for session ${sessionId}`);

                        if (elapsed >= 120) {
                            reject(new Error('QR code generation timeout after 120 seconds'));
                        }
                    }, 20000);

                    // Final timeout after 120 seconds (2 minutes)
                    const timeoutHandle = setTimeout(() => {
                        reject(new Error('QR code generation timeout after 120 seconds'));
                    }, 120000);

                    // Store timers for cleanup
                    this.activeTimers.set(sessionId, { progressInterval, timeoutHandle });
                })
            ]);

            // Clean up timers when QR code is successfully generated
            this.cleanupSessionTimers(sessionId);
            this.logger.log(`✅ QR generation completed successfully for session ${sessionId}`);

            this.logger.log(`QR code generated for session ${sessionId}`);

            return {
                session_id: sessionId,
                qr_code: qrCode,
                status: WhatsAppSessionStatus.QR_READY,
            };
        } catch (error) {
            this.logger.error(`Failed to generate QR code for session ${sessionId}:`, error);

            // Clean up failed client and timers
            try {
                // Clean up any active timers first
                this.cleanupSessionTimers(sessionId);

                if (this.clients.has(sessionId)) {
                    const clientInstance = this.clients.get(sessionId);
                    if (clientInstance?.client) {
                        await clientInstance.client.destroy();
                    }
                    this.clients.delete(sessionId);
                }
            } catch (cleanupError) {
                this.logger.error(`Error cleaning up failed client ${sessionId}:`, cleanupError);
            }

            // Update database status with detailed error information
            const errorMessage = error.message || 'Unknown initialization error';
            const statusUpdate: any = {
                status: WhatsAppSessionStatus.DISCONNECTED,
                is_ready: false,
                is_authenticated: false,
                qr_code: null,
                last_error: errorMessage,
                last_error_time: new Date(),
            };

            await this.safeUpdateSession(sessionId, statusUpdate);

            this.logger.error(`❌ Session ${sessionId} marked as DISCONNECTED due to initialization failure`);

            // Re-throw the error with more context and troubleshooting info
            if (error.message?.includes('net::ERR_TIMED_OUT') || error.message?.includes('net::ERR_NETWORK_CHANGED')) {
                throw new Error(`Network connectivity issue detected. Please check your internet connection and firewall settings. If the problem persists, try again in a few minutes. Original error: ${error.message}`);
            } else if (error.message?.includes('timeout') || error.message?.includes('QR code generation timeout')) {
                throw new Error(`WhatsApp Web initialization timed out. This may be due to:\n1. Network connectivity issues\n2. WhatsApp Web servers being temporarily unavailable\n3. Firewall blocking the connection\n\nPlease try again in a few minutes. If the issue persists, check your network connection.`);
            } else if (error.message?.includes('Protocol error') || error.message?.includes('Target closed')) {
                throw new Error(`Browser connection failed. This may be due to system resource constraints or Chrome/Chromium issues. Please try again.`);
            } else {
                throw new Error(`Failed to initialize WhatsApp client: ${error.message}. Please try again or contact support if the issue persists.`);
            }
        }
    }

    // Helper method to safely update session in database
    private async safeUpdateSession(sessionId: string, data: any): Promise<boolean> {
        try {
            this.logger.log(`💾 Updating session ${sessionId} with data:`, JSON.stringify(data, null, 2));

            const result = await this.databaseService.whatsAppSession.update({
                where: { session_id: sessionId },
                data: {
                    ...data,
                    updated_at: new Date(),
                },
            });

            this.logger.log(`✅ Successfully updated session ${sessionId} status to: ${data.status || 'unchanged'}`);

            // Also update in-memory client status if it exists to keep them in sync
            const clientInstance = this.clients.get(sessionId);
            if (clientInstance && data.status) {
                clientInstance.status = data.status;
                if (data.is_ready !== undefined) clientInstance.isReady = data.is_ready;
                if (data.is_authenticated !== undefined) clientInstance.isAuthenticated = data.is_authenticated;
                if (data.phone_number !== undefined) clientInstance.phoneNumber = data.phone_number;
                this.logger.log(`🔄 In-memory client status synced for session ${sessionId}: ${data.status}`);
            }

            return true;
        } catch (error) {
            if (error.code === 'P2025') {
                this.logger.warn(`⚠️ Session ${sessionId} not found in database - may have been deleted`);
                return false;
            } else {
                this.logger.error(`❌ Error updating session ${sessionId}:`, error);
                this.logger.error(`❌ Failed update data:`, JSON.stringify(data, null, 2));
                throw error;
            }
        }
    }

    // Helper method to clean up orphaned client instances
    private async cleanupOrphanedClient(sessionId: string, client: any): Promise<void> {
        try {
            this.logger.log(`Cleaning up orphaned client for session ${sessionId}`);
            await client.destroy();
            this.clients.delete(sessionId);
        } catch (cleanupError) {
            this.logger.error(`Error cleaning up orphaned client ${sessionId}:`, cleanupError);
        }
    }

    // Start periodic cleanup of orphaned clients and stuck sessions
    private startPeriodicCleanup(): void {
        // Run cleanup every 5 minutes
        setInterval(async () => {
            try {
                await this.cleanupOrphanedClients();
                await this.cleanupStuckSessions();
            } catch (error) {
                this.logger.error('Error during periodic cleanup:', error);
            }
        }, 5 * 60 * 1000); // 5 minutes
    }

    // Clean up clients that don't have corresponding database records
    private async cleanupOrphanedClients(): Promise<void> {
        const clientSessionIds = Array.from(this.clients.keys());

        for (const sessionId of clientSessionIds) {
            try {
                const session = await this.databaseService.whatsAppSession.findUnique({
                    where: { session_id: sessionId },
                });

                if (!session) {
                    this.logger.log(`Found orphaned client for session ${sessionId}, cleaning up...`);
                    const clientInstance = this.clients.get(sessionId);
                    if (clientInstance) {
                        await this.cleanupOrphanedClient(sessionId, clientInstance.client);
                    }
                }
            } catch (error) {
                this.logger.error(`Error checking session ${sessionId} during cleanup:`, error);
            }
        }
    }


    // Clean up sessions that are stuck in INITIALIZING state
    private async cleanupStuckSessions(): Promise<void> {
        try {
            this.logger.log('🧹 Cleaning up stuck sessions...');

            // Find sessions that are stuck in INITIALIZING status for more than 10 minutes
            const stuckSessions = await this.databaseService.whatsAppSession.findMany({
                where: {
                    status: WhatsAppSessionStatus.INITIALIZING,
                    updated_at: {
                        lt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
                    },
                },
            });

            for (const session of stuckSessions) {
                this.logger.log(`🧹 Cleaning up stuck session: ${session.session_id}`);

                // Clean up any active client
                if (this.clients.has(session.session_id)) {
                    const clientInstance = this.clients.get(session.session_id);
                    try {
                        await clientInstance?.client?.destroy();
                    } catch (error) {
                        this.logger.error(`Error destroying stuck client:`, error);
                    }
                    this.clients.delete(session.session_id);
                }

                // Clean up timers
                this.cleanupSessionTimers(session.session_id);

                // Update session status to DISCONNECTED
                await this.safeUpdateSession(session.session_id, {
                    status: WhatsAppSessionStatus.DISCONNECTED,
                    is_ready: false,
                    is_authenticated: false,
                    last_error: 'Session was stuck in INITIALIZING status and cleaned up',
                    last_error_time: new Date(),
                });
            }

            if (stuckSessions.length > 0) {
                this.logger.log(`🧹 Cleaned up ${stuckSessions.length} stuck sessions`);
            }

        } catch (error) {
            this.logger.error('❌ Error cleaning up stuck sessions:', error);
        }
    }

    private setupEventHandlersWithQRPromise(clientInstance: WhatsAppClientInstance): Promise<string> {
        const { client, sessionId } = clientInstance;

        return new Promise<string>((resolve, reject) => {
            let qrResolved = false;

            // Add detailed event logging for debugging
            client.on('loading_screen', (percent, message) => {
                this.logger.log(`📱 WhatsApp Web loading: ${percent}% - ${message} for session ${sessionId}`);
            });

            client.on('change_state', (state) => {
                this.logger.log(`📱 WhatsApp Web state changed to: ${state} for session ${sessionId}`);
            });

            client.on('qr', async (qr) => {
                if (qrResolved) {
                    this.logger.warn(`⚠️ QR event fired after resolution for session ${sessionId}, ignoring`);
                    return;
                }

                this.logger.log(`📱 QR Code generated for session ${sessionId} - progression: INITIALIZING → QR_READY`);
                clientInstance.status = WhatsAppSessionStatus.QR_READY;

                // Update database with QR code (safely)
                const updated = await this.safeUpdateSession(sessionId, {
                    qr_code: qr,
                    status: WhatsAppSessionStatus.QR_READY,
                });

                if (!updated) {
                    this.logger.warn(`Could not update QR code for session ${sessionId} - session may have been deleted`);
                    // Clean up the client instance since the session doesn't exist
                    await this.cleanupOrphanedClient(sessionId, client);
                    if (!qrResolved) {
                        qrResolved = true;
                        reject(new Error('Session was deleted during QR generation'));
                    }
                    return;
                }

                // Resolve the promise with the QR code
                if (!qrResolved) {
                    qrResolved = true;
                    this.logger.log(`✅ QR promise resolved for session ${sessionId}`);
                    resolve(qr);
                }
            });

            // Set up other event handlers
            this.setupOtherEventHandlers(clientInstance);

            // Handle initialization errors
            client.on('auth_failure', (message) => {
                this.logger.error(`❌ Auth failure during QR setup for session ${sessionId}: ${message}`);
                if (!qrResolved) {
                    qrResolved = true;
                    reject(new Error(`Authentication setup failed: ${message}`));
                }
            });

            // Handle disconnection during QR generation
            client.on('disconnected', (reason) => {
                this.logger.error(`❌ Client disconnected during QR generation for session ${sessionId}: ${reason}`);
                if (!qrResolved) {
                    qrResolved = true;
                    reject(new Error(`Client disconnected during QR generation: ${reason}`));
                }
            });
        });
    }

    private setupOtherEventHandlers(clientInstance: WhatsAppClientInstance) {
        const { client, sessionId } = clientInstance;

        client.on('authenticated', async () => {
            this.logger.log(`🔐 Client authenticated for session ${sessionId} - progression: QR_READY → AUTHENTICATED`);
            clientInstance.isAuthenticated = true;
            clientInstance.status = WhatsAppSessionStatus.AUTHENTICATED;

            const updated = await this.safeUpdateSession(sessionId, {
                is_authenticated: true,
                status: WhatsAppSessionStatus.AUTHENTICATED,
                qr_code: null, // Clear QR code after authentication
            });

            if (!updated) {
                this.logger.warn(`Could not update authentication status for session ${sessionId} - session may have been deleted`);
                // Clean up the client instance
                await this.cleanupOrphanedClient(sessionId, client);
            }
        });

        client.on('ready', async () => {
            this.logger.log(`✅ Client ready for session ${sessionId} - progression: AUTHENTICATED → READY`);
            clientInstance.isReady = true;
            clientInstance.status = WhatsAppSessionStatus.READY;

            // Get phone number
            const info = client.info;
            clientInstance.phoneNumber = info?.wid?.user;

            const updated = await this.safeUpdateSession(sessionId, {
                is_ready: true,
                is_authenticated: true,
                phone_number: clientInstance.phoneNumber,
                status: WhatsAppSessionStatus.READY,
                last_activity: new Date(),
            });

            if (!updated) {
                this.logger.warn(`Could not update ready status for session ${sessionId} - session may have been deleted`);
                // Clean up the client instance
                await this.cleanupOrphanedClient(sessionId, client);
            } else {
                // Force immediate backup to S3 after session becomes ready
                this.forceBackupSessionToS3(sessionId).catch((error: any) => {
                    this.logger.error(`Failed to backup session ${sessionId} to S3:`, error);
                });
            }
        });

        client.on('disconnected', async (reason) => {
            this.logger.warn(`Client disconnected for session ${sessionId}: ${reason}`);
            clientInstance.status = WhatsAppSessionStatus.DISCONNECTED;
            clientInstance.isReady = false;
            clientInstance.isAuthenticated = false;

            const updated = await this.safeUpdateSession(sessionId, {
                is_ready: false,
                is_authenticated: false,
                status: WhatsAppSessionStatus.DISCONNECTED,
            });

            if (!updated) {
                this.logger.warn(`Could not update disconnection status for session ${sessionId} - session may have been deleted`);
                // Remove from memory since it doesn't exist in database
                this.clients.delete(sessionId);
            }
        });

        client.on('auth_failure', async (message) => {
            this.logger.error(`Authentication failed for session ${sessionId}: ${message}`);
            clientInstance.status = WhatsAppSessionStatus.DISCONNECTED;

            const updated = await this.safeUpdateSession(sessionId, {
                is_ready: false,
                is_authenticated: false,
                status: WhatsAppSessionStatus.DISCONNECTED,
            });

            if (!updated) {
                this.logger.warn(`Could not update auth failure status for session ${sessionId} - session may have been deleted`);
                // Clean up the client instance
                await this.cleanupOrphanedClient(sessionId, client);
            }
        });
    }

    async getSessionStatus(sessionId: string): Promise<SessionStatusDto> {
        const session = await this.databaseService.whatsAppSession.findUnique({
            where: { session_id: sessionId },
        });

        if (!session) {
            throw new Error('Session not found');
        }

        // Enhanced status check: verify session consistency across database, memory, and S3
        // This ensures frontend always gets the most current status
        const enhancedStatus = await this.validateAndSyncSession(sessionId, session);

        // Log status for debugging frontend issues
        this.logger.log(`📊 Status API called for session ${sessionId}: ${enhancedStatus.status} (Ready: ${enhancedStatus.is_ready}, Auth: ${enhancedStatus.is_authenticated})`);

        return this.mapSessionToDto(enhancedStatus);
    }

    /**
     * Validate session consistency across database, memory, and S3
     * Automatically attempt restoration if session is missing from memory but exists in S3
     */
    private async validateAndSyncSession(sessionId: string, session: any): Promise<any> {
        try {
            const clientInstance = this.clients.get(sessionId);
            const hasMemoryClient = !!clientInstance;
            const isClientReady = clientInstance?.isReady || false;

            // If session is marked as READY/AUTHENTICATED in DB but missing from memory
            if ((session.status === WhatsAppSessionStatus.READY ||
                session.status === WhatsAppSessionStatus.AUTHENTICATED) &&
                !hasMemoryClient) {

                this.logger.warn(`⚠️ Session ${sessionId} marked as ${session.status} in DB but missing from memory. Attempting restoration...`);

                // Check if session exists in S3
                const s3Exists = await this.s3Store.checkSessionExists(sessionId);

                if (s3Exists) {
                    this.logger.log(`📦 Session ${sessionId} found in S3, attempting automatic restoration...`);

                    try {
                        // Attempt automatic restoration from S3
                        const recoveryResult = await this.authRecoveryService.recoverSpecificSession(sessionId);

                        if (recoveryResult.success) {
                            // Initialize the client with restoration flag
                            await this.initializeClient(sessionId, true);

                            // Get updated session status
                            const updatedSession = await this.databaseService.whatsAppSession.findUnique({
                                where: { session_id: sessionId },
                            });

                            this.logger.log(`✅ Session ${sessionId} automatically restored from S3`);
                            return updatedSession || session;
                        }
                    } catch (restoreError) {
                        this.logger.error(`❌ Failed to restore session ${sessionId} from S3:`, restoreError);
                    }
                }

                // If S3 restoration failed or session not in S3, mark as disconnected
                this.logger.warn(`🔄 Session ${sessionId} cannot be restored, marking as DISCONNECTED`);
                const updatedSession = await this.safeUpdateSession(sessionId, {
                    status: WhatsAppSessionStatus.DISCONNECTED,
                    is_ready: false,
                    is_authenticated: false,
                });

                return updatedSession || session;
            }

            // If session is QR_READY but client is missing, check if we need to reinitialize
            if (session.status === WhatsAppSessionStatus.QR_READY && !hasMemoryClient) {
                this.logger.log(`📱 Session ${sessionId} is QR_READY but client missing, checking if QR is still valid...`);

                // Check if QR code is older than 20 seconds (WhatsApp QR expiry)
                const qrAge = Date.now() - new Date(session.updated_at).getTime();
                const qrExpired = qrAge > 20000; // 20 seconds

                if (qrExpired) {
                    this.logger.warn(`⏰ QR code for session ${sessionId} has expired (${Math.round(qrAge / 1000)}s old), marking as DISCONNECTED`);
                    const updatedSession = await this.safeUpdateSession(sessionId, {
                        status: WhatsAppSessionStatus.DISCONNECTED,
                        qr_code: null,
                        is_ready: false,
                        is_authenticated: false,
                        last_error: 'QR code expired - user did not scan within time limit',
                        last_error_time: new Date(),
                    });

                    return updatedSession || session;
                }

                // QR is still valid but client is missing - this can happen when user reloads page
                // Check if QR is getting stale (older than 10 seconds but not expired)
                if (qrAge > 10000) {
                    this.logger.warn(`⚠️ QR code for session ${sessionId} is getting stale (${Math.round(qrAge / 1000)}s old), user may have reloaded page`);
                }
            }

            // Update memory client status if there's a mismatch
            if (hasMemoryClient && clientInstance) {
                const memoryStatus = clientInstance.status;
                const dbStatus = session.status;

                if (memoryStatus !== dbStatus) {
                    this.logger.log(`🔄 Syncing status mismatch for ${sessionId}: Memory=${memoryStatus}, DB=${dbStatus}`);

                    // Update database to match memory state (memory is source of truth for active sessions)
                    const updatedSession = await this.safeUpdateSession(sessionId, {
                        status: memoryStatus,
                        is_ready: clientInstance.isReady,
                        is_authenticated: clientInstance.isAuthenticated,
                    });

                    return updatedSession || session;
                }
            }

            return session;

        } catch (error) {
            this.logger.error(`❌ Error validating session ${sessionId}:`, error);
            return session; // Return original session if validation fails
        }
    }

    async getUserSessions(userId: string): Promise<SessionListDto> {
        const sessions = await this.databaseService.whatsAppSession.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' },
        });

        return {
            sessions: sessions.map(session => this.mapSessionToDto(session)),
            total: sessions.length,
        };
    }

    // Get user's single session (since one user = one session)
    async getUserSession(userId: string): Promise<SessionStatusDto | null> {
        const session = await this.databaseService.whatsAppSession.findFirst({
            where: {
                user_id: userId,
                status: {
                    not: WhatsAppSessionStatus.DESTROYED
                }
            },
            orderBy: { created_at: 'desc' },
        });

        return session ? this.mapSessionToDto(session) : null;
    }

    async getQRCode(sessionId: string): Promise<QRCodeResponseDto> {
        const session = await this.databaseService.whatsAppSession.findUnique({
            where: { session_id: sessionId },
        });

        if (!session) {
            throw new Error('Session not found');
        }

        // If QR code is available and status is QR_READY, check if it's still valid
        if (session.qr_code && session.status === WhatsAppSessionStatus.QR_READY) {
            // Check if QR code is expired (WhatsApp QR codes expire after ~20 seconds)
            const qrAge = Date.now() - new Date(session.updated_at).getTime();
            const qrExpired = qrAge > 20000; // 20 seconds

            if (qrExpired) {
                this.logger.warn(`⏰ QR code for session ${sessionId} has expired (${Math.round(qrAge / 1000)}s old), generating new one...`);

                // Mark session for reinitialization and generate new QR code
                await this.safeUpdateSession(sessionId, {
                    status: WhatsAppSessionStatus.INITIALIZING,
                    qr_code: null,
                    is_ready: false,
                    is_authenticated: false,
                });

                // Generate new QR code
                try {
                    return await this.initializeClient(sessionId);
                } catch (error) {
                    this.logger.error(`Failed to generate new QR code for session ${sessionId}:`, error);
                    throw new Error(`Failed to generate new QR code. Please try again or reinitialize the session.`);
                }
            }

            // QR code is still valid, return it
            return {
                session_id: sessionId,
                qr_code: session.qr_code,
                status: session.status,
            };
        }

        // If session is initializing, wait a bit for QR code generation
        if (session.status === WhatsAppSessionStatus.INITIALIZING) {
            this.logger.log(`Waiting for QR code generation for session ${sessionId}...`);

            // Poll for QR code for up to 30 seconds
            for (let i = 0; i < 30; i++) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

                const updatedSession = await this.databaseService.whatsAppSession.findUnique({
                    where: { session_id: sessionId },
                });

                if (updatedSession?.qr_code && updatedSession.status === WhatsAppSessionStatus.QR_READY) {
                    return {
                        session_id: sessionId,
                        qr_code: updatedSession.qr_code,
                        status: updatedSession.status,
                    };
                }

                // If session status changed to something other than INITIALIZING, break
                if (updatedSession?.status !== WhatsAppSessionStatus.INITIALIZING) {
                    break;
                }
            }
        }

        // Fallback response
        return {
            session_id: sessionId,
            qr_code: session.qr_code || '',
            status: session.status,
        };
    }

    async getQRStatus(sessionId: string): Promise<any> {
        try {
            const session = await this.databaseService.whatsAppSession.findUnique({
                where: { session_id: sessionId },
            });

            if (!session) {
                throw new Error(`Session ${sessionId} not found`);
            }

            // Enhanced QR status check: validate session consistency
            const validatedSession = await this.validateAndSyncSession(sessionId, session);

            const clientInstance = this.clients.get(sessionId);
            const isClientInitialized = !!clientInstance;
            const isClientReady = clientInstance?.isReady || false;

            let instructions = '';
            let nextSteps: string[] = [];
            let requiresQRScan = false;
            let qrCodeAvailable = false;

            switch (validatedSession.status) {
                case WhatsAppSessionStatus.QR_READY:
                    requiresQRScan = true;
                    qrCodeAvailable = !!validatedSession.qr_code;

                    // Check if QR code is expired
                    if (validatedSession.qr_code) {
                        const qrAge = Date.now() - new Date(validatedSession.updated_at).getTime();
                        const qrExpired = qrAge > 20000; // 20 seconds

                        if (qrExpired) {
                            instructions = 'QR code has expired. Please reinitialize to get a new QR code.';
                            nextSteps = [
                                'Call POST /webjs/sessions/{sessionId}/initialize to get a new QR code',
                                'Scan the new QR code within 20 seconds'
                            ];
                            qrCodeAvailable = false;
                        } else {
                            instructions = 'Please scan the QR code with your WhatsApp mobile app to complete authentication.';
                            nextSteps = [
                                'Open WhatsApp on your mobile device',
                                'Go to Settings > Linked Devices',
                                'Tap "Link a Device"',
                                'Scan the QR code displayed',
                                'Wait for authentication to complete'
                            ];
                        }
                    } else {
                        instructions = 'QR code is being generated. Please wait a moment.';
                        nextSteps = ['Wait for QR code generation', 'Check back in a few seconds'];
                        qrCodeAvailable = false;
                    }
                    break;

                case WhatsAppSessionStatus.AUTHENTICATED:
                    instructions = 'Session is authenticated but not yet ready for messaging.';
                    nextSteps = ['Wait for the session to become ready'];
                    break;

                case WhatsAppSessionStatus.READY:
                    instructions = 'Session is ready for messaging.';
                    nextSteps = ['You can now send messages'];
                    break;

                case WhatsAppSessionStatus.INITIALIZING:
                    instructions = 'Session is initializing. Please wait for QR code generation.';
                    nextSteps = ['Wait for QR code to be generated', 'Check back in a few seconds'];
                    break;

                case WhatsAppSessionStatus.DISCONNECTED:
                    instructions = 'Session is disconnected. Please reinitialize to restore connection.';
                    nextSteps = [
                        'Call POST /webjs/sessions/{sessionId}/initialize to reconnect',
                        'If session was previously working, it may be restored from S3 automatically'
                    ];
                    break;

                default:
                    instructions = `Session is in ${validatedSession.status} status.`;
                    nextSteps = ['Check session status and reinitialize if needed'];
            }

            return {
                session_id: sessionId,
                status: validatedSession.status,
                requires_qr_scan: requiresQRScan,
                qr_code_available: qrCodeAvailable,
                client_initialized: isClientInitialized,
                client_ready: isClientReady,
                instructions,
                next_steps: nextSteps,
                qr_endpoint: qrCodeAvailable ? `/webjs/sessions/${sessionId}/qr` : null,
                last_activity: validatedSession.last_activity,
                created_at: validatedSession.created_at,
                session_validated: true, // Indicates this status went through validation
                s3_backup_available: await this.s3Store.checkSessionExists(sessionId).catch(() => false),
            };

        } catch (error) {
            this.logger.error(`Error getting QR status for session ${sessionId}:`, error);
            throw error;
        }
    }

    async sendMessage(sendMessageDto: SendMessageDto): Promise<SendMessageResponseDto> {
        const { session_id, to, message, media_urls } = sendMessageDto;

        // Check if client instance exists
        let clientInstance = this.clients.get(session_id);
        if (!clientInstance) {
            // Get session from database to provide better error message
            const session = await this.databaseService.whatsAppSession.findUnique({
                where: { session_id: session_id },
            });

            if (!session) {
                throw new Error(`Session ${session_id} not found. Please create a session first.`);
            }

            // Try to auto-restore/initialize the session based on its status
            if (session.status === WhatsAppSessionStatus.READY ||
                session.status === WhatsAppSessionStatus.AUTHENTICATED) {

                this.logger.log(`🔄 Auto-restoring READY/AUTHENTICATED session ${session_id} for message sending...`);

                try {
                    // Check if session needs recovery first
                    if (this.authRecoveryService) {
                        const needsRecovery = await this.authRecoveryService.checkSessionNeedsRecovery(session_id);
                        if (needsRecovery) {
                            this.logger.log(`🔧 Session ${session_id} needs authentication recovery...`);
                            const recoveryResult = await this.authRecoveryService.recoverSpecificSession(session_id);

                            if (!recoveryResult.success) {
                                throw new Error(`Recovery failed: ${recoveryResult.error}`);
                            }

                            if (recoveryResult.requiresQRScan) {
                                throw new Error(`Session ${session_id} requires QR code scanning after recovery. Please scan the QR code with your WhatsApp mobile app. Get QR code: GET /webjs/sessions/${session_id}/qr`);
                            }
                        }
                    }

                    await this.initializeClient(session_id);
                    clientInstance = this.clients.get(session_id);

                    if (!clientInstance) {
                        throw new Error(`Failed to restore session ${session_id}`);
                    }

                    this.logger.log(`✅ Session ${session_id} auto-restored successfully`);
                } catch (restoreError) {
                    this.logger.error(`❌ Failed to auto-restore session ${session_id}:`, restoreError);
                    throw new Error(`Client not initialized for session ${session_id}. Current status: ${session.status}. Auto-restore failed: ${restoreError.message}. Please use the restore endpoint manually.`);
                }
            } else if (session.status === WhatsAppSessionStatus.INITIALIZING) {
                // Handle INITIALIZING sessions - complete the initialization process
                this.logger.log(`🔄 Auto-completing initialization for session ${session_id}...`);

                try {
                    // Check if initialization is stuck (older than 5 minutes)
                    const sessionAge = Date.now() - new Date(session.updated_at).getTime();
                    const isStuck = sessionAge > 5 * 60 * 1000; // 5 minutes

                    if (isStuck) {
                        this.logger.warn(`⚠️ Session ${session_id} appears stuck in INITIALIZING state for ${Math.round(sessionAge / 60000)} minutes. Restarting initialization...`);

                        // Reset session status and restart initialization
                        await this.safeUpdateSession(session_id, {
                            status: WhatsAppSessionStatus.INITIALIZING,
                            qr_code: null,
                            is_ready: false,
                            is_authenticated: false,
                        });
                    }

                    // Complete the initialization process
                    const result = await this.initializeClient(session_id);
                    clientInstance = this.clients.get(session_id);

                    if (!clientInstance) {
                        throw new Error(`Failed to initialize client for session ${session_id}`);
                    }

                    // If QR code was generated, provide user-friendly response
                    if (result.qr_code) {
                        throw new Error(`WHATSAPP_QR_REQUIRED:${session_id}:Please link your WhatsApp device by scanning the QR code. Open WhatsApp on your phone → Settings → Linked Devices → Link a Device → Scan QR code. Get QR code: GET /webjs/sessions/${session_id}/qr`);
                    }

                    this.logger.log(`✅ Session ${session_id} initialization completed successfully`);
                } catch (initError) {
                    // Check if this is a QR code requirement (not an actual error)
                    if (initError.message.startsWith('WHATSAPP_QR_REQUIRED:')) {
                        // This is not an error - just QR code requirement
                        throw initError;
                    }

                    this.logger.error(`❌ Failed to complete initialization for session ${session_id}:`, initError);

                    // Mark session as failed if initialization keeps failing
                    await this.safeUpdateSession(session_id, {
                        status: WhatsAppSessionStatus.DISCONNECTED,
                        is_ready: false,
                        is_authenticated: false,
                    });

                    throw new Error(`WHATSAPP_INIT_FAILED:${session_id}:WhatsApp initialization failed. Please try creating a new session or contact support.`);
                }
            } else if (session.status === WhatsAppSessionStatus.QR_READY) {
                // For QR_READY sessions, provide clear instructions
                const qrCode = session.qr_code;
                if (qrCode) {
                    throw new Error(`WHATSAPP_QR_REQUIRED:${session_id}:Please link your WhatsApp device by scanning the QR code. Open WhatsApp on your phone → Settings → Linked Devices → Link a Device → Scan QR code. Get QR code: GET /webjs/sessions/${session_id}/qr`);
                } else {
                    throw new Error(`WHATSAPP_QR_MISSING:${session_id}:QR code not available. Please reinitialize your WhatsApp connection: POST /webjs/sessions/${session_id}/initialize`);
                }
            } else if (session.status === WhatsAppSessionStatus.DISCONNECTED) {
                throw new Error(`WHATSAPP_DISCONNECTED:${session_id}:Your WhatsApp connection is disconnected. Please reconnect your device by initializing a new session: POST /webjs/sessions/${session_id}/initialize`);
            } else {
                throw new Error(`WHATSAPP_NOT_READY:${session_id}:WhatsApp is not ready for messaging. Current status: ${session.status}. Please initialize your connection: POST /webjs/sessions/${session_id}/initialize`);
            }
        }

        if (!clientInstance.isReady) {
            const session = await this.databaseService.whatsAppSession.findUnique({
                where: { session_id: session_id },
            });

            // Handle QR_READY status with user-friendly message
            if (session?.status === WhatsAppSessionStatus.QR_READY) {
                throw new Error(`WHATSAPP_QR_EXPIRED:${session_id}:Your WhatsApp session has expired. Please reconnect by scanning the QR code.`);
            }

            throw new Error(`Client is not ready for session ${session_id}. Current status: ${session?.status || 'UNKNOWN'}. Please ensure the session is authenticated and ready.`);
        }

        try {
            // Format phone number (ensure it includes country code)
            const formattedNumber = to.includes('@c.us') ? to : `${to}@c.us`;

            let messageId: string;

            if (media_urls && media_urls.length > 0) {
                // Send media message (for now, just send the first media URL)
                // In a production environment, you might want to handle multiple media files
                const mediaUrl = media_urls[0];
                const media = await MessageMedia.fromUrl(mediaUrl);
                const response = await clientInstance.client.sendMessage(formattedNumber, media, {
                    caption: message,
                });
                messageId = response.id.id;
            } else {
                // Send text message
                const response = await clientInstance.client.sendMessage(formattedNumber, message);
                messageId = response.id.id;
            }

            // Update last activity
            clientInstance.lastActivity = new Date();
            await this.safeUpdateSession(session_id, {
                last_activity: new Date(),
            });

            this.logger.log(`Message sent successfully from session ${session_id} to ${to}`);

            return {
                success: true,
                message_id: messageId,
            };
        } catch (error) {
            this.logger.error(`Failed to send message from session ${session_id}:`, error);
            return {
                success: false,
                error: error.message || 'Failed to send message',
            };
        }
    }

    async sendBulkMessages(sessionId: string, sendBulkMessageDto: SendBulkMessageDto): Promise<SendBulkMessageResponseDto> {
        const startTime = Date.now();
        const { messages } = sendBulkMessageDto;

        this.logger.log(`🚀 Starting bulk message send for session ${sessionId}: ${messages.length} messages`);

        // Validate session and client
        let clientInstance = this.clients.get(sessionId);
        if (!clientInstance) {
            const session = await this.databaseService.whatsAppSession.findUnique({
                where: { session_id: sessionId },
            });

            if (!session) {
                throw new Error(`Session ${sessionId} not found. Please create a session first.`);
            }

            // Try to auto-restore/initialize the session based on its status
            if (session.status === WhatsAppSessionStatus.READY ||
                session.status === WhatsAppSessionStatus.AUTHENTICATED) {

                this.logger.log(`🔄 Auto-restoring READY/AUTHENTICATED session ${sessionId} for bulk messaging...`);

                try {
                    await this.initializeClient(sessionId, true); // Pass isRestoration = true
                    clientInstance = this.clients.get(sessionId);

                    if (!clientInstance) {
                        throw new Error(`Failed to restore session ${sessionId}`);
                    }

                    this.logger.log(`✅ Session ${sessionId} auto-restored successfully for bulk messaging`);
                } catch (restoreError) {
                    this.logger.error(`❌ Failed to auto-restore session ${sessionId}:`, restoreError);
                    throw new Error(`Client not initialized for session ${sessionId}. Current status: ${session.status}. Auto-restore failed: ${restoreError.message}. Please use the restore endpoint manually.`);
                }
            } else if (session.status === WhatsAppSessionStatus.INITIALIZING) {
                // Handle INITIALIZING sessions - complete the initialization process
                this.logger.log(`🔄 Auto-completing initialization for session ${sessionId} for bulk messaging...`);

                try {
                    // Check if initialization is stuck
                    const sessionAge = Date.now() - new Date(session.updated_at).getTime();
                    const isStuck = sessionAge > 5 * 60 * 1000; // 5 minutes

                    if (isStuck) {
                        this.logger.warn(`⚠️ Session ${sessionId} appears stuck in INITIALIZING state. Restarting initialization...`);
                        await this.safeUpdateSession(sessionId, {
                            status: WhatsAppSessionStatus.INITIALIZING,
                            qr_code: null,
                            is_ready: false,
                            is_authenticated: false,
                        });
                    }

                    const result = await this.initializeClient(sessionId);
                    clientInstance = this.clients.get(sessionId);

                    if (!clientInstance) {
                        throw new Error(`Failed to initialize client for session ${sessionId}`);
                    }

                    if (result.qr_code) {
                        throw new Error(`WHATSAPP_QR_REQUIRED:${sessionId}:Please link your WhatsApp device by scanning the QR code. Open WhatsApp on your phone → Settings → Linked Devices → Link a Device → Scan QR code. Get QR code: GET /webjs/sessions/${sessionId}/qr`);
                    }

                    this.logger.log(`✅ Session ${sessionId} initialization completed successfully for bulk messaging`);
                } catch (initError) {
                    // Check if this is a QR code requirement (not an actual error)
                    if (initError.message.startsWith('WHATSAPP_QR_REQUIRED:')) {
                        throw initError;
                    }

                    this.logger.error(`❌ Failed to complete initialization for session ${sessionId}:`, initError);
                    await this.safeUpdateSession(sessionId, {
                        status: WhatsAppSessionStatus.DISCONNECTED,
                        is_ready: false,
                        is_authenticated: false,
                    });
                    throw new Error(`WHATSAPP_INIT_FAILED:${sessionId}:WhatsApp initialization failed. Please try creating a new session or contact support.`);
                }
            } else if (session.status === WhatsAppSessionStatus.QR_READY) {
                // For QR_READY sessions, provide clear instructions
                const qrCode = session.qr_code;
                if (qrCode) {
                    throw new Error(`WHATSAPP_QR_REQUIRED:${sessionId}:Please link your WhatsApp device by scanning the QR code. Open WhatsApp on your phone → Settings → Linked Devices → Link a Device → Scan QR code. Get QR code: GET /webjs/sessions/${sessionId}/qr`);
                } else {
                    throw new Error(`WHATSAPP_QR_MISSING:${sessionId}:QR code not available. Please reinitialize your WhatsApp connection: POST /webjs/sessions/${sessionId}/initialize`);
                }
            } else if (session.status === WhatsAppSessionStatus.DISCONNECTED) {
                throw new Error(`WHATSAPP_DISCONNECTED:${sessionId}:Your WhatsApp connection is disconnected. Please reconnect your device by initializing a new session: POST /webjs/sessions/${sessionId}/initialize`);
            } else {
                throw new Error(`WHATSAPP_NOT_READY:${sessionId}:WhatsApp is not ready for messaging. Current status: ${session.status}. Please initialize your connection: POST /webjs/sessions/${sessionId}/initialize`);
            }
        }

        if (!clientInstance.isReady) {
            const session = await this.databaseService.whatsAppSession.findUnique({
                where: { session_id: sessionId },
            });

            // Handle QR_READY status with user-friendly message
            if (session?.status === WhatsAppSessionStatus.QR_READY) {
                throw new Error(`WHATSAPP_QR_EXPIRED:${sessionId}:Your WhatsApp session has expired. Please reconnect by scanning the QR code.`);
            }

            throw new Error(`Client is not ready for session ${sessionId}. Current status: ${session?.status || 'UNKNOWN'}. Please ensure the session is authenticated and ready.`);
        }

        const results: BulkMessageResult[] = [];
        let successCount = 0;
        let failCount = 0;

        // Process messages sequentially with rate limiting
        for (let i = 0; i < messages.length; i++) {
            const messageItem = messages[i];

            try {
                this.logger.log(`📤 Sending message ${i + 1}/${messages.length} to ${messageItem.to}`);

                // Format phone number
                const formattedNumber = messageItem.to.includes('@c.us') ? messageItem.to : `${messageItem.to.replace('+', '')}@c.us`;

                let messageId: string;

                if (messageItem.media_urls && messageItem.media_urls.length > 0) {
                    // Send media message
                    const mediaUrl = messageItem.media_urls[0];
                    const media = await MessageMedia.fromUrl(mediaUrl);
                    const response = await clientInstance.client.sendMessage(formattedNumber, media, {
                        caption: messageItem.message,
                    });
                    messageId = response.id.id;
                } else {
                    // Send text message
                    const response = await clientInstance.client.sendMessage(formattedNumber, messageItem.message);
                    messageId = response.id.id;
                }

                // Success result
                results.push({
                    to: messageItem.to,
                    status: 'success',
                    message_id: messageId,
                    timestamp: new Date().toISOString(),
                });

                successCount++;
                this.logger.log(`✅ Message ${i + 1}/${messages.length} sent successfully to ${messageItem.to} (ID: ${messageId})`);

            } catch (error) {
                // Failure result
                results.push({
                    to: messageItem.to,
                    status: 'failed',
                    error: error.message || 'Unknown error occurred',
                    timestamp: new Date().toISOString(),
                });

                failCount++;
                this.logger.error(`❌ Message ${i + 1}/${messages.length} failed for ${messageItem.to}:`, error.message);
            }

            // Rate limiting: Wait 1-2 seconds between messages (except for the last one)
            if (i < messages.length - 1) {
                const delay = Math.random() * 1000 + 1000; // Random delay between 1-2 seconds
                this.logger.log(`⏳ Waiting ${Math.round(delay)}ms before next message...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // Update last activity
        clientInstance.lastActivity = new Date();
        await this.safeUpdateSession(sessionId, {
            last_activity: new Date(),
        });

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(1);

        const response: SendBulkMessageResponseDto = {
            success: successCount > 0,
            total_messages: messages.length,
            successful_sends: successCount,
            failed_sends: failCount,
            results,
            session_id: sessionId,
            duration: `${duration} seconds`,
        };

        this.logger.log(`🏁 Bulk message operation completed for session ${sessionId}: ${successCount} success, ${failCount} failed, ${duration}s total`);

        return response;
    }

    async destroySession(sessionId: string): Promise<void> {
        const clientInstance = this.clients.get(sessionId);

        if (clientInstance) {
            try {
                await clientInstance.client.destroy();
                this.clients.delete(sessionId);
                this.logger.log(`Client destroyed for session ${sessionId}`);
            } catch (error) {
                this.logger.error(`Error destroying client for session ${sessionId}:`, error);
            }
        }

        // Update database (safely)
        await this.safeUpdateSession(sessionId, {
            status: WhatsAppSessionStatus.DESTROYED,
            is_ready: false,
            is_authenticated: false,
        });
    }

    async deleteSession(sessionId: string): Promise<void> {
        try {
            // First destroy the client if it exists
            await this.destroySession(sessionId);

            // Delete from database
            await this.databaseService.whatsAppSession.delete({
                where: { session_id: sessionId },
            });

            this.logger.log(`Session ${sessionId} deleted successfully`);
        } catch (error) {
            // If session doesn't exist in database, that's fine
            if (error.code === 'P2025') {
                this.logger.log(`Session ${sessionId} was already deleted from database`);
            } else {
                this.logger.error(`Error deleting session ${sessionId}:`, error);
                throw error;
            }
        }
    }

    // Helper method to force delete all sessions for a user
    async deleteAllUserSessions(userId: string): Promise<void> {
        try {
            const sessions = await this.databaseService.whatsAppSession.findMany({
                where: { user_id: userId },
            });

            for (const session of sessions) {
                try {
                    await this.deleteSession(session.session_id);
                } catch (error) {
                    this.logger.error(`Failed to delete session ${session.session_id}:`, error);
                    // Continue with other sessions
                }
            }

            this.logger.log(`Deleted all sessions for user ${userId}`);
        } catch (error) {
            this.logger.error(`Error deleting all sessions for user ${userId}:`, error);
            throw error;
        }
    }

    async restartSession(sessionId: string): Promise<QRCodeResponseDto> {
        // Destroy existing client
        await this.destroySession(sessionId);

        // Wait a moment for cleanup
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Reinitialize
        return await this.initializeClient(sessionId);
    }

    private mapSessionToDto(session: any): SessionStatusDto {
        return {
            id: session.id,
            user_id: session.user_id,
            session_id: session.session_id,
            session_name: session.session_name,
            phone_number: session.phone_number,
            is_authenticated: session.is_authenticated,
            is_ready: session.is_ready,
            qr_code: session.qr_code,
            status: session.status,
            last_activity: session.last_activity,
            created_at: session.created_at,
            updated_at: session.updated_at,
        };
    }

    // Utility method to check if a session is active
    isSessionActive(sessionId: string): boolean {
        const clientInstance = this.clients.get(sessionId);
        return clientInstance ? clientInstance.isReady : false;
    }

    // Get all active sessions
    getActiveSessions(): string[] {
        return Array.from(this.clients.keys()).filter(sessionId =>
            this.clients.get(sessionId)?.isReady
        );
    }

    // Get total sessions count from database
    async getTotalSessionsCount(): Promise<number> {
        try {
            return await this.databaseService.whatsAppSession.count();
        } catch (error) {
            this.logger.error('Error getting total sessions count:', error);
            return 0;
        }
    }

    // Backup session authentication data to S3 (for RemoteAuth)
    private async backupSessionToS3(sessionId: string): Promise<void> {
        try {
            // With RemoteAuth, session data is automatically stored in S3 by WhatsApp Web.js
            // We just need to verify the session exists in S3 and log the backup status

            const sessionExists = await this.s3Store.checkSessionExists(sessionId);

            if (sessionExists) {
                this.logger.log(`📦 Session ${sessionId} is already backed up to S3 via RemoteAuth`);

                // Optional: Create a backup timestamp record
                const backupMetadata = {
                    sessionId: sessionId,
                    backupTime: new Date().toISOString(),
                    method: 'RemoteAuth',
                    status: 'success'
                };

                await this.s3Store.saveSession(`${sessionId}-backup-metadata`, backupMetadata);
                this.logger.log(`� Backup metadata saved for session ${sessionId}`);
            } else {
                this.logger.warn(`⚠️ Session ${sessionId} not found in S3 - RemoteAuth may not have synced yet`);
            }
        } catch (error) {
            this.logger.error(`❌ Failed to verify S3 backup for session ${sessionId}:`, error);
            // Don't throw error as this is not critical for session functionality
        }
    }

    // Force immediate backup to S3 with retry logic
    private async forceBackupSessionToS3(sessionId: string): Promise<void> {
        try {
            this.logger.log(`🔄 Force backing up session ${sessionId} to S3...`);

            // Wait a moment for RemoteAuth to complete its backup
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Check if session exists in S3 with retry
            let attempts = 0;
            const maxAttempts = 5;
            let sessionExists = false;

            while (attempts < maxAttempts && !sessionExists) {
                attempts++;
                sessionExists = await this.s3Store.checkSessionExists(sessionId);

                if (!sessionExists) {
                    this.logger.log(`📦 Attempt ${attempts}/${maxAttempts}: Session ${sessionId} not yet in S3, waiting...`);
                    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds between attempts
                }
            }

            if (sessionExists) {
                this.logger.log(`✅ Session ${sessionId} successfully backed up to S3 after ${attempts} attempts`);

                // Update database with backup confirmation
                await this.safeUpdateSession(sessionId, {
                    s3_backup_confirmed: true,
                    last_backup_time: new Date(),
                });
            } else {
                this.logger.error(`❌ Failed to confirm S3 backup for session ${sessionId} after ${maxAttempts} attempts`);

                // Debug: List all files in S3 to see what's actually there
                this.logger.log(`🔍 Debugging S3 contents for session ${sessionId}...`);
                try {
                    const allFiles = await this.s3Store.listAllSessionFiles();
                    this.logger.log(`📦 All S3 files in whatsapp-sessions/:`, allFiles);

                    const sessionFiles = await this.s3Store.listSessionFiles(sessionId);
                    this.logger.log(`📦 Files related to session ${sessionId}:`, sessionFiles);
                } catch (debugError) {
                    this.logger.error(`❌ Failed to debug S3 contents:`, debugError);
                }
            }

        } catch (error) {
            this.logger.error(`❌ Failed to force backup session ${sessionId} to S3:`, error);
        }
    }

    // Test S3 connection
    async testS3Connection(): Promise<boolean> {
        try {
            if (!this.s3Store) {
                this.logger.warn('S3 store not initialized');
                return false;
            }
            return await this.s3Store.testConnection();
        } catch (error) {
            this.logger.error('S3 connection test failed:', error);
            return false;
        }
    }

    // Get detailed debug information for a session
    async getSessionDebugInfo(sessionId: string): Promise<any> {
        try {
            // Get database session info
            const dbSession = await this.databaseService.whatsAppSession.findUnique({
                where: { session_id: sessionId },
            });

            // Get client instance info
            const clientInstance = this.clients.get(sessionId);

            return {
                session_id: sessionId,
                database_exists: !!dbSession,
                database_status: dbSession?.status || 'NOT_FOUND',
                database_authenticated: dbSession?.is_authenticated || false,
                database_ready: dbSession?.is_ready || false,
                database_phone: dbSession?.phone_number || null,
                database_last_activity: dbSession?.last_activity || null,
                database_created_at: dbSession?.created_at || null,
                database_updated_at: dbSession?.updated_at || null,
                client_initialized: !!clientInstance,
                client_ready: clientInstance?.isReady || false,
                client_authenticated: clientInstance?.isAuthenticated || false,
                client_status: clientInstance?.status || 'NOT_INITIALIZED',
                client_phone: clientInstance?.phoneNumber || null,
                client_last_activity: clientInstance?.lastActivity || null,
                active_clients_count: this.clients.size,
                active_clients_list: Array.from(this.clients.keys()),
            };
        } catch (error) {
            this.logger.error(`Error getting debug info for session ${sessionId}:`, error);
            throw error;
        }
    }

    // Get comprehensive session diagnostics
    async getSessionDiagnostics(sessionId: string): Promise<any> {
        try {
            if (!this.sessionDiagnosticsService) {
                throw new Error('SessionDiagnosticsService not initialized');
            }

            return await this.sessionDiagnosticsService.diagnoseSession(sessionId, this.clients);
        } catch (error) {
            this.logger.error(`Error getting session diagnostics for ${sessionId}:`, error);
            throw error;
        }
    }

    // Smart recovery based on diagnostics
    async smartRecoverySession(sessionId: string): Promise<any> {
        try {
            this.logger.log(`🔧 Starting smart recovery for session ${sessionId}...`);

            // Get comprehensive diagnostics first
            const diagnostics = await this.getSessionDiagnostics(sessionId);

            if (!diagnostics.analysis.canRecover) {
                throw new Error(`Session ${sessionId} cannot be recovered. Issues: ${diagnostics.analysis.issues.join(', ')}`);
            }

            const recoveryMethod = diagnostics.analysis.recoveryMethod;
            this.logger.log(`🔧 Using recovery method: ${recoveryMethod} for session ${sessionId}`);

            switch (recoveryMethod) {
                case 'S3_RESTORE':
                    return await this.performS3Recovery(sessionId, diagnostics);

                case 'MEMORY_RESTORE':
                    return await this.performMemoryRecovery(sessionId, diagnostics);

                default:
                    return await this.performForceRecovery(sessionId, diagnostics);
            }

        } catch (error) {
            this.logger.error(`Smart recovery failed for session ${sessionId}:`, error);
            throw error;
        }
    }

    // Perform S3-based recovery
    private async performS3Recovery(sessionId: string, diagnostics: any): Promise<any> {
        this.logger.log(`🔄 Performing S3 recovery for session ${sessionId}...`);

        try {
            // Use auth recovery service to restore from S3
            const recoveryResult = await this.authRecoveryService.recoverSpecificSession(sessionId);

            if (recoveryResult.success) {
                // Try to initialize the client with restoration flag
                const initResult = await this.initializeClient(sessionId, true);

                return {
                    success: true,
                    method: 'S3_RESTORE',
                    message: 'Session restored from S3 storage',
                    session_id: sessionId,
                    status: initResult.status,
                    qr_code: initResult.qr_code,
                    requires_qr_scan: initResult.status === WhatsAppSessionStatus.QR_READY,
                    diagnostics_summary: diagnostics.analysis,
                };
            } else {
                throw new Error(`S3 recovery failed: ${recoveryResult.error}`);
            }
        } catch (error) {
            this.logger.error(`S3 recovery failed for ${sessionId}:`, error);
            throw error;
        }
    }

    // Perform memory-based recovery
    private async performMemoryRecovery(sessionId: string, diagnostics: any): Promise<any> {
        this.logger.log(`🔄 Performing memory recovery for session ${sessionId}...`);

        try {
            // Clean up existing client if any
            const existingClient = this.clients.get(sessionId);
            if (existingClient) {
                await this.cleanupOrphanedClient(sessionId, existingClient.client);
            }

            // Initialize fresh client
            const initResult = await this.initializeClient(sessionId);

            return {
                success: true,
                method: 'MEMORY_RESTORE',
                message: 'Session client reinitialized in memory',
                session_id: sessionId,
                status: initResult.status,
                qr_code: initResult.qr_code,
                requires_qr_scan: initResult.status === WhatsAppSessionStatus.QR_READY,
                diagnostics_summary: diagnostics.analysis,
            };
        } catch (error) {
            this.logger.error(`Memory recovery failed for ${sessionId}:`, error);
            throw error;
        }
    }

    // Perform force recovery (last resort)
    private async performForceRecovery(sessionId: string, diagnostics: any): Promise<any> {
        this.logger.log(`🔄 Performing force recovery for session ${sessionId}...`);

        try {
            // This is essentially the same as force initialize
            return await this.forceInitializeSession(sessionId);
        } catch (error) {
            this.logger.error(`Force recovery failed for ${sessionId}:`, error);
            throw error;
        }
    }

    // Restore active sessions from database on service startup
    private async restoreActiveSessions(): Promise<void> {
        try {
            this.logger.log('🔄 Restoring active sessions from database...');

            // Find sessions that need to be restored
            const activeSessions = await this.databaseService.whatsAppSession.findMany({
                where: {
                    AND: [
                        {
                            OR: [
                                { status: WhatsAppSessionStatus.READY },
                                { status: WhatsAppSessionStatus.AUTHENTICATED },
                                { status: WhatsAppSessionStatus.QR_READY }, // Include QR_READY sessions
                                { status: WhatsAppSessionStatus.INITIALIZING }, // Include initializing sessions
                            ],
                        },
                        {
                            OR: [
                                {
                                    last_activity: {
                                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Active in last 24 hours
                                    },
                                },
                                {
                                    created_at: {
                                        gte: new Date(Date.now() - 2 * 60 * 60 * 1000), // Created in last 2 hours
                                    },
                                },
                            ],
                        },
                    ],
                },
            });

            this.logger.log(`Found ${activeSessions.length} active sessions to restore`);

            for (const session of activeSessions) {
                try {
                    // Check if client is already initialized (shouldn't be, but just in case)
                    if (this.clients.has(session.session_id)) {
                        this.logger.log(`Session ${session.session_id} already has a client instance`);
                        continue;
                    }

                    this.logger.log(`🔄 Restoring session: ${session.session_id} (Status: ${session.status})`);

                    // Check for sessions that should be cleaned up instead of restored
                    if (session.status === WhatsAppSessionStatus.INITIALIZING || session.status === WhatsAppSessionStatus.QR_READY) {
                        this.logger.warn(`🚨 Found session ${session.session_id} in ${session.status} status during startup - marking as DISCONNECTED`);

                        await this.safeUpdateSession(session.session_id, {
                            status: WhatsAppSessionStatus.DISCONNECTED,
                            is_ready: false,
                            is_authenticated: false,
                            qr_code: null,
                            last_error: `Session was in ${session.status} status during server restart - marked as disconnected`,
                            last_error_time: new Date(),
                        });

                        this.logger.log(`🔌 Session ${session.session_id} marked as DISCONNECTED instead of attempting restoration`);
                        continue; // Skip to next session
                    }

                    // Initialize the client for this session with restoration flag for READY/AUTHENTICATED sessions
                    const isRestoration = session.status === WhatsAppSessionStatus.READY || session.status === WhatsAppSessionStatus.AUTHENTICATED;
                    const result = await this.initializeClient(session.session_id, isRestoration);

                    // Log the restoration result
                    if (result.qr_code) {
                        this.logger.log(`📱 Session ${session.session_id} restored with QR code - needs scanning`);
                    } else {
                        this.logger.log(`✅ Session ${session.session_id} restored successfully`);
                    }

                    // Small delay between initializations to avoid overwhelming the system
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Increased to 2 seconds

                } catch (error) {
                    this.logger.error(`❌ Failed to restore session ${session.session_id}:`, error);

                    // Check if this was a restoration attempt that failed
                    const wasRestorationAttempt = session.status === WhatsAppSessionStatus.READY ||
                        session.status === WhatsAppSessionStatus.AUTHENTICATED;

                    if (wasRestorationAttempt) {
                        this.logger.warn(`🚨 Session ${session.session_id} restoration failed - marking as DISCONNECTED instead of generating QR`);

                        // Mark session as disconnected if restoration fails
                        await this.safeUpdateSession(session.session_id, {
                            status: WhatsAppSessionStatus.DISCONNECTED,
                            is_ready: false,
                            is_authenticated: false,
                            qr_code: null,
                            last_error: `Restoration failed: ${error.message || 'Session restoration failed'}`,
                            last_error_time: new Date(),
                        });
                    } else {
                        // For non-restoration failures, mark as disconnected
                        await this.safeUpdateSession(session.session_id, {
                            status: WhatsAppSessionStatus.DISCONNECTED,
                            is_ready: false,
                            is_authenticated: false,
                            qr_code: null,
                            last_error: error.message || 'Session initialization failed',
                            last_error_time: new Date(),
                        });
                    }
                }
            }

            this.logger.log(`✅ Session restoration completed. Active clients: ${this.clients.size}`);

        } catch (error) {
            this.logger.error('Error during session restoration:', error);
        }
    }

    // Manually restore a specific session
    async restoreSession(sessionId: string): Promise<any> {
        try {
            // Check if session exists in database
            const session = await this.databaseService.whatsAppSession.findUnique({
                where: { session_id: sessionId },
            });

            if (!session) {
                throw new Error(`Session ${sessionId} not found in database`);
            }

            // Check if client is already initialized
            if (this.clients.has(sessionId)) {
                const clientInstance = this.clients.get(sessionId);
                return {
                    success: true,
                    message: 'Session already active',
                    session_id: sessionId,
                    status: clientInstance?.status || 'UNKNOWN',
                    client_ready: clientInstance?.isReady || false,
                };
            }

            this.logger.log(`🔄 Manually restoring session: ${sessionId}`);

            // Test network connectivity first
            const networkOk = await this.testNetworkConnectivity();
            if (!networkOk) {
                throw new Error('Network connectivity test failed. Please check your internet connection and firewall settings.');
            }

            // Initialize the client with restoration flag for READY/AUTHENTICATED sessions
            const isRestoration = session.status === WhatsAppSessionStatus.READY || session.status === WhatsAppSessionStatus.AUTHENTICATED;
            const result = await this.initializeClient(sessionId, isRestoration);

            return {
                success: true,
                message: 'Session restored successfully',
                session_id: sessionId,
                status: session.status,
                qr_code: result.qr_code,
                needs_authentication: session.status !== WhatsAppSessionStatus.READY,
            };

        } catch (error) {
            this.logger.error(`Failed to restore session ${sessionId}:`, error);
            throw error;
        }
    }

    // Test network connectivity to WhatsApp Web
    async testNetworkConnectivity(): Promise<boolean> {
        try {
            this.logger.log('🌐 Testing network connectivity to WhatsApp Web...');

            // Create AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

            try {
                const response = await fetch('https://web.whatsapp.com/', {
                    method: 'HEAD',
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);
                const isOk = response.ok || response.status === 200;
                this.logger.log(`Network connectivity test: ${isOk ? '✅ SUCCESS' : '❌ FAILED'} (Status: ${response.status})`);

                return isOk;
            } catch (fetchError) {
                clearTimeout(timeoutId);
                throw fetchError;
            }
        } catch (error) {
            this.logger.error('❌ Network connectivity test failed:', error.message);
            return false;
        }
    }

    // Check authentication folder status
    async checkAuthFolderStatus(): Promise<boolean> {
        try {
            if (!this.authRecoveryService) {
                return false;
            }
            return await this.authRecoveryService.checkAuthFolderIntegrity();
        } catch (error) {
            this.logger.error('Error checking auth folder status:', error);
            return false;
        }
    }

    // Perform manual authentication recovery
    async performManualAuthRecovery(): Promise<any> {
        try {
            if (!this.authRecoveryService) {
                throw new Error('AuthRecoveryService not initialized');
            }

            this.logger.log('🔧 Starting manual authentication recovery...');
            const recoveryReport = await this.authRecoveryService.performAuthRecovery();

            // Restore recovered sessions
            await this.restoreRecoveredSessions(recoveryReport);

            return {
                success: true,
                ...recoveryReport,
            };
        } catch (error) {
            this.logger.error('Manual authentication recovery failed:', error);
            throw error;
        }
    }

    // Force initialize a stuck session
    async forceInitializeSession(sessionId: string): Promise<any> {
        try {
            this.logger.log(`🔧 Force initializing session ${sessionId}...`);

            // Get current session status
            const session = await this.databaseService.whatsAppSession.findUnique({
                where: { session_id: sessionId },
            });

            if (!session) {
                throw new Error(`Session ${sessionId} not found`);
            }

            const previousStatus = session.status;

            // Clean up any existing client instance
            const existingClient = this.clients.get(sessionId);
            if (existingClient) {
                this.logger.log(`🧹 Cleaning up existing client for session ${sessionId}`);
                await this.cleanupOrphanedClient(sessionId, existingClient.client);
            }

            // Reset session status
            await this.safeUpdateSession(sessionId, {
                status: WhatsAppSessionStatus.INITIALIZING,
                is_ready: false,
                is_authenticated: false,
                qr_code: null,
            });

            // Force initialize the client
            const result = await this.initializeClient(sessionId);

            return {
                success: true,
                message: 'Session force initialized successfully',
                session_id: sessionId,
                previous_status: previousStatus,
                new_status: result.status,
                qr_code: result.qr_code,
                requires_qr_scan: result.status === WhatsAppSessionStatus.QR_READY,
            };

        } catch (error) {
            this.logger.error(`❌ Force initialization failed for session ${sessionId}:`, error);

            // Mark session as disconnected if force initialization fails
            await this.safeUpdateSession(sessionId, {
                status: WhatsAppSessionStatus.DISCONNECTED,
                is_ready: false,
                is_authenticated: false,
            });

            throw error;
        }
    }

    // Clear and reinitialize session for fresh start
    async clearAndReinitializeSession(sessionId: string): Promise<any> {
        try {
            this.logger.log(`🔄 Clearing and reinitializing session ${sessionId} for fresh start...`);

            // Clean up any existing client instance
            const existingClient = this.clients.get(sessionId);
            if (existingClient) {
                this.logger.log(`🧹 Cleaning up existing client for session ${sessionId}`);
                await this.cleanupOrphanedClient(sessionId, existingClient.client);
            }

            // Clear session data completely
            await this.safeUpdateSession(sessionId, {
                status: WhatsAppSessionStatus.INITIALIZING,
                is_ready: false,
                is_authenticated: false,
                qr_code: null,
                phone_number: null,
                last_activity: null,
            });

            // Remove from S3 if exists (for completely fresh start)
            try {
                if (this.s3Store) {
                    const sessionExists = await this.s3Store.checkSessionExists(sessionId);
                    if (sessionExists) {
                        await this.s3Store.deleteSession(sessionId);
                        this.logger.log(`🗑️ Cleared S3 session data for ${sessionId}`);
                    }
                }
            } catch (s3Error) {
                this.logger.warn(`⚠️ Could not clear S3 data for ${sessionId}:`, s3Error.message);
                // Continue anyway - S3 cleanup is not critical
            }

            // Initialize fresh client
            const result = await this.initializeClient(sessionId);

            this.logger.log(`✅ Session ${sessionId} cleared and reinitialized successfully`);

            return {
                success: true,
                message: 'Session cleared and reinitialized for fresh start',
                session_id: sessionId,
                status: result.status,
                qr_code: result.qr_code,
                requires_qr_scan: result.status === WhatsAppSessionStatus.QR_READY,
                fresh_start: true,
            };

        } catch (error) {
            this.logger.error(`❌ Clear and reinitialize failed for session ${sessionId}:`, error);

            // Mark session as disconnected if clearing fails
            await this.safeUpdateSession(sessionId, {
                status: WhatsAppSessionStatus.DISCONNECTED,
                is_ready: false,
                is_authenticated: false,
            });

            throw error;
        }
    }
}
