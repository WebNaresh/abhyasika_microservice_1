import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Client, RemoteAuth, MessageMedia } from 'whatsapp-web.js';
import { AwsS3Store } from 'wwebjs-aws-s3';
import { WhatsAppSessionStatus } from '@prisma/client';
import { DatabaseService } from '../utils/database/database.service';
import { S3Service } from '../utils/s3/s3.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SessionStatusDto, QRCodeResponseDto, SessionListDto } from './dto/session-status.dto';
import { SendMessageDto, SendMessageResponseDto } from './dto/send-message.dto';
import { WhatsAppClientInstance, SessionEventHandlers } from './interfaces/whatsapp-client.interface';

@Injectable()
export class WebjsService implements OnModuleDestroy {
    private readonly logger = new Logger(WebjsService.name);
    private clients: Map<string, WhatsAppClientInstance> = new Map();
    private s3Store: any; // Using any for now due to type issues with AwsS3Store

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly s3Service: S3Service,
    ) {
        this.initializeS3Store();
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

    private initializeS3Store() {
        this.s3Store = new AwsS3Store({
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
        this.logger.log('S3 Store initialized for WhatsApp sessions');
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

        // Check if user already has an active session
        const existingSession = await this.databaseService.whatsAppSession.findFirst({
            where: {
                user_id,
                status: {
                    not: WhatsAppSessionStatus.DESTROYED
                }
            },
        });

        if (existingSession) {
            throw new Error('User already has an active WhatsApp session. Please delete the existing session first.');
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
                ],
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

        // Set up event handlers
        this.setupEventHandlers(clientInstance);

        // Store client instance
        this.clients.set(sessionId, clientInstance);

        // Initialize client
        await client.initialize();

        this.logger.log(`Client initialized for session ${sessionId}`);

        // Return initial status (QR will be provided via events)
        return {
            session_id: sessionId,
            qr_code: '',
            status: WhatsAppSessionStatus.INITIALIZING,
        };
    }

    private setupEventHandlers(clientInstance: WhatsAppClientInstance) {
        const { client, sessionId } = clientInstance;

        client.on('qr', async (qr) => {
            this.logger.log(`QR Code generated for session ${sessionId}`);
            clientInstance.status = WhatsAppSessionStatus.QR_READY;

            // Update database with QR code
            await this.databaseService.whatsAppSession.update({
                where: { session_id: sessionId },
                data: {
                    qr_code: qr,
                    status: WhatsAppSessionStatus.QR_READY,
                    updated_at: new Date(),
                },
            });
        });

        client.on('authenticated', async () => {
            this.logger.log(`Client authenticated for session ${sessionId}`);
            clientInstance.isAuthenticated = true;
            clientInstance.status = WhatsAppSessionStatus.AUTHENTICATED;

            await this.databaseService.whatsAppSession.update({
                where: { session_id: sessionId },
                data: {
                    is_authenticated: true,
                    status: WhatsAppSessionStatus.AUTHENTICATED,
                    qr_code: null, // Clear QR code after authentication
                    updated_at: new Date(),
                },
            });
        });

        client.on('ready', async () => {
            this.logger.log(`Client ready for session ${sessionId}`);
            clientInstance.isReady = true;
            clientInstance.status = WhatsAppSessionStatus.READY;

            // Get phone number
            const info = client.info;
            clientInstance.phoneNumber = info?.wid?.user;

            await this.databaseService.whatsAppSession.update({
                where: { session_id: sessionId },
                data: {
                    is_ready: true,
                    is_authenticated: true,
                    phone_number: clientInstance.phoneNumber,
                    status: WhatsAppSessionStatus.READY,
                    last_activity: new Date(),
                    updated_at: new Date(),
                },
            });
        });

        client.on('disconnected', async (reason) => {
            this.logger.warn(`Client disconnected for session ${sessionId}: ${reason}`);
            clientInstance.status = WhatsAppSessionStatus.DISCONNECTED;
            clientInstance.isReady = false;
            clientInstance.isAuthenticated = false;

            await this.databaseService.whatsAppSession.update({
                where: { session_id: sessionId },
                data: {
                    is_ready: false,
                    is_authenticated: false,
                    status: WhatsAppSessionStatus.DISCONNECTED,
                    updated_at: new Date(),
                },
            });
        });

        client.on('auth_failure', async (message) => {
            this.logger.error(`Authentication failed for session ${sessionId}: ${message}`);
            clientInstance.status = WhatsAppSessionStatus.DISCONNECTED;

            await this.databaseService.whatsAppSession.update({
                where: { session_id: sessionId },
                data: {
                    is_ready: false,
                    is_authenticated: false,
                    status: WhatsAppSessionStatus.DISCONNECTED,
                    updated_at: new Date(),
                },
            });
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

        if (!session.qr_code && session.status !== WhatsAppSessionStatus.QR_READY) {
            throw new Error('QR code not available. Please initialize the client first.');
        }

        return {
            session_id: sessionId,
            qr_code: session.qr_code || '',
            status: session.status,
        };
    }

    async sendMessage(sendMessageDto: SendMessageDto): Promise<SendMessageResponseDto> {
        const { session_id, to, message, media_urls } = sendMessageDto;

        const clientInstance = this.clients.get(session_id);
        if (!clientInstance) {
            throw new Error('Client not initialized for this session');
        }

        if (!clientInstance.isReady) {
            throw new Error('Client is not ready. Please ensure the session is authenticated and ready.');
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
            await this.databaseService.whatsAppSession.update({
                where: { session_id: session_id },
                data: { last_activity: new Date() },
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

        // Update database
        await this.databaseService.whatsAppSession.update({
            where: { session_id: sessionId },
            data: {
                status: WhatsAppSessionStatus.DESTROYED,
                is_ready: false,
                is_authenticated: false,
                updated_at: new Date(),
            },
        });
    }

    async deleteSession(sessionId: string): Promise<void> {
        // First destroy the client if it exists
        await this.destroySession(sessionId);

        // Delete from database
        await this.databaseService.whatsAppSession.delete({
            where: { session_id: sessionId },
        });

        this.logger.log(`Session ${sessionId} deleted successfully`);
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
}
