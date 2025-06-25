import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Client, RemoteAuth, MessageMedia } from 'whatsapp-web.js';
import { WhatsAppSessionStatus } from '@prisma/client';
import { DatabaseService } from '../utils/database/database.service';
import { S3Service } from '../utils/s3/s3.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SessionStatusDto, QRCodeResponseDto, SessionListDto } from './dto/session-status.dto';
import { SendMessageDto, SendMessageResponseDto } from './dto/send-message.dto';
import { WhatsAppClientInstance, SessionEventHandlers } from './interfaces/whatsapp-client.interface';
import { CustomS3Store } from './stores/custom-s3-store';

@Injectable()
export class WebjsService implements OnModuleDestroy {
    private readonly logger = new Logger(WebjsService.name);
    private clients: Map<string, WhatsAppClientInstance> = new Map();
    private s3Store: CustomS3Store;

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly s3Service: S3Service,
    ) {
        this.initializeS3Store().catch(error => {
            this.logger.error('Failed to initialize S3 store:', error);
        });
        this.startPeriodicCleanup();
        this.restoreActiveSessions().catch((error: any) => {
            this.logger.error('Failed to restore active sessions:', error);
        });
    }

    async onModuleDestroy() {
        this.logger.log('Destroying all WhatsApp clients...');
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

    async initializeClient(sessionId: string): Promise<QRCodeResponseDto> {
        const session = await this.databaseService.whatsAppSession.findUnique({
            where: { session_id: sessionId },
        });

        if (!session) {
            throw new Error('Session not found');
        }

        if (this.clients.has(sessionId)) {
            throw new Error('Client already initialized for this session');
        }

        // Create WhatsApp client with RemoteAuth
        const client = new Client({
            authStrategy: new RemoteAuth({
                clientId: sessionId,
                dataPath: '.wwebjs_auth',
                store: this.s3Store,
                backupSyncIntervalMs: 300000, // 5 minutes
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--disable-extensions',
                    '--disable-plugins',
                    '--disable-default-apps',
                    '--disable-hang-monitor',
                    '--disable-prompt-on-repost',
                    '--disable-sync',
                    '--disable-translate',
                    '--metrics-recording-only',
                    '--no-default-browser-check',
                    '--safebrowsing-disable-auto-update',
                    '--enable-automation',
                    '--password-store=basic',
                    '--use-mock-keychain',
                    '--disable-blink-features=AutomationControlled',
                    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    '--proxy-server="direct://"',
                    '--proxy-bypass-list=*'
                ],
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, // Allow custom Chrome path
                defaultViewport: {
                    width: 1366,
                    height: 768
                },
                timeout: 60000, // 60 seconds timeout
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

        // Set up event handlers with QR code promise
        const qrCodePromise = this.setupEventHandlersWithQRPromise(clientInstance);

        // Initialize client
        await client.initialize();

        this.logger.log(`Client initialized for session ${sessionId}, waiting for QR code...`);

        try {
            // Wait for QR code generation (with timeout)
            const qrCode = await Promise.race([
                qrCodePromise,
                new Promise<string>((_, reject) =>
                    setTimeout(() => reject(new Error('QR code generation timeout after 30 seconds')), 30000)
                )
            ]);

            this.logger.log(`QR code generated for session ${sessionId}`);

            return {
                session_id: sessionId,
                qr_code: qrCode,
                status: WhatsAppSessionStatus.QR_READY,
            };
        } catch (error) {
            this.logger.error(`Failed to generate QR code for session ${sessionId}:`, error);

            // Clean up failed client
            try {
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

            // Update database status
            await this.safeUpdateSession(sessionId, {
                status: WhatsAppSessionStatus.DISCONNECTED,
                is_ready: false,
                is_authenticated: false,
            });

            // Re-throw the error with more context
            if (error.message?.includes('net::ERR_TIMED_OUT')) {
                throw new Error(`Network timeout connecting to WhatsApp Web. Please check your internet connection and try again. Original error: ${error.message}`);
            } else if (error.message?.includes('timeout')) {
                throw new Error(`WhatsApp Web initialization timed out. This may be due to network issues or WhatsApp Web being temporarily unavailable. Please try again in a few minutes.`);
            } else {
                throw new Error(`Failed to initialize WhatsApp client: ${error.message}`);
            }
        }
    }

    // Helper method to safely update session in database
    private async safeUpdateSession(sessionId: string, data: any): Promise<boolean> {
        try {
            await this.databaseService.whatsAppSession.update({
                where: { session_id: sessionId },
                data: {
                    ...data,
                    updated_at: new Date(),
                },
            });
            return true;
        } catch (error) {
            if (error.code === 'P2025') {
                this.logger.warn(`Session ${sessionId} not found in database - may have been deleted`);
                return false;
            } else {
                this.logger.error(`Error updating session ${sessionId}:`, error);
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

    // Start periodic cleanup of orphaned clients
    private startPeriodicCleanup(): void {
        // Run cleanup every 5 minutes
        setInterval(async () => {
            try {
                await this.cleanupOrphanedClients();
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

    private setupEventHandlersWithQRPromise(clientInstance: WhatsAppClientInstance): Promise<string> {
        const { client, sessionId } = clientInstance;

        return new Promise<string>((resolve, reject) => {
            let qrResolved = false;

            client.on('qr', async (qr) => {
                this.logger.log(`QR Code generated for session ${sessionId}`);
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
                    resolve(qr);
                }
            });

            // Set up other event handlers
            this.setupOtherEventHandlers(clientInstance);

            // Handle initialization errors
            client.on('auth_failure', (message) => {
                if (!qrResolved) {
                    qrResolved = true;
                    reject(new Error(`Authentication setup failed: ${message}`));
                }
            });
        });
    }

    private setupOtherEventHandlers(clientInstance: WhatsAppClientInstance) {
        const { client, sessionId } = clientInstance;

        client.on('authenticated', async () => {
            this.logger.log(`Client authenticated for session ${sessionId}`);
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
            this.logger.log(`Client ready for session ${sessionId}`);
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

        return this.mapSessionToDto(session);
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

        // If QR code is available, return it immediately
        if (session.qr_code && session.status === WhatsAppSessionStatus.QR_READY) {
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

    async sendMessage(sendMessageDto: SendMessageDto): Promise<SendMessageResponseDto> {
        const { session_id, to, message, media_urls } = sendMessageDto;

        // Check if client instance exists
        const clientInstance = this.clients.get(session_id);
        if (!clientInstance) {
            // Get session from database to provide better error message
            const session = await this.databaseService.whatsAppSession.findUnique({
                where: { session_id: session_id },
            });

            if (!session) {
                throw new Error(`Session ${session_id} not found. Please create a session first.`);
            }

            throw new Error(`Client not initialized for session ${session_id}. Current status: ${session.status}. Please initialize the client first.`);
        }

        if (!clientInstance.isReady) {
            const session = await this.databaseService.whatsAppSession.findUnique({
                where: { session_id: session_id },
            });

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

    // Restore active sessions from database on service startup
    private async restoreActiveSessions(): Promise<void> {
        try {
            this.logger.log('🔄 Restoring active sessions from database...');

            // Find sessions that were ready or authenticated before server restart
            const activeSessions = await this.databaseService.whatsAppSession.findMany({
                where: {
                    OR: [
                        { status: WhatsAppSessionStatus.READY },
                        { status: WhatsAppSessionStatus.AUTHENTICATED },
                    ],
                    // Only restore sessions that were active in the last 24 hours
                    last_activity: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    },
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

                    this.logger.log(`🔄 Restoring session: ${session.session_id}`);

                    // Initialize the client for this session
                    await this.initializeClient(session.session_id);

                    // Small delay between initializations to avoid overwhelming the system
                    await new Promise(resolve => setTimeout(resolve, 1000));

                } catch (error) {
                    this.logger.error(`Failed to restore session ${session.session_id}:`, error);

                    // Mark session as disconnected if restoration fails
                    await this.safeUpdateSession(session.session_id, {
                        status: WhatsAppSessionStatus.DISCONNECTED,
                        is_ready: false,
                        is_authenticated: false,
                    });
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

            // Initialize the client
            const result = await this.initializeClient(sessionId);

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
}
