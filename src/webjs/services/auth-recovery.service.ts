import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../utils/database/database.service';
import { CustomS3Store } from '../stores/custom-s3-store';
import { WhatsAppSessionStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

export interface AuthRecoveryResult {
  sessionId: string;
  recoveryMethod: 'S3_RESTORED' | 'QR_REGENERATED' | 'FAILED';
  success: boolean;
  error?: string;
  requiresQRScan?: boolean;
}

export interface AuthRecoveryReport {
  totalSessions: number;
  s3Restored: number;
  qrRegenerated: number;
  failed: number;
  results: AuthRecoveryResult[];
  duration: string;
}

@Injectable()
export class AuthRecoveryService {
  private readonly logger = new Logger(AuthRecoveryService.name);
  private readonly authFolderPath = '.wwebjs_auth';

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly s3Store: CustomS3Store,
  ) {}

  /**
   * Check if authentication folder exists and has valid session data
   */
  async checkAuthFolderIntegrity(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.authFolderPath)) {
        this.logger.warn('🚨 Authentication folder (.wwebjs_auth) not found');
        return false;
      }

      // Check if folder is empty or has valid session files
      const files = fs.readdirSync(this.authFolderPath);
      if (files.length === 0) {
        this.logger.warn('🚨 Authentication folder is empty');
        return false;
      }

      this.logger.log(`✅ Authentication folder found with ${files.length} entries`);
      return true;
    } catch (error) {
      this.logger.error('❌ Error checking authentication folder:', error);
      return false;
    }
  }

  /**
   * Get sessions that need recovery
   */
  async getSessionsNeedingRecovery(): Promise<any[]> {
    try {
      const sessions = await this.databaseService.whatsAppSession.findMany({
        where: {
          OR: [
            { status: WhatsAppSessionStatus.READY },
            { status: WhatsAppSessionStatus.AUTHENTICATED },
            { status: WhatsAppSessionStatus.QR_READY },
          ],
          // Only recover sessions from last 7 days
          created_at: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: {
          last_activity: 'desc',
        },
      });

      this.logger.log(`📋 Found ${sessions.length} sessions that may need recovery`);
      return sessions;
    } catch (error) {
      this.logger.error('❌ Error getting sessions for recovery:', error);
      return [];
    }
  }

  /**
   * Attempt to restore session from S3
   */
  async attemptS3Restore(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.log(`🔄 Attempting S3 restore for session ${sessionId}...`);

      // Check if session exists in S3
      const sessionExists = await this.s3Store.checkSessionExists(sessionId);
      if (!sessionExists) {
        return { success: false, error: 'Session not found in S3' };
      }

      // Get session data from S3
      const sessionData = await this.s3Store.getSession(sessionId);
      if (!sessionData) {
        return { success: false, error: 'Empty session data in S3' };
      }

      // Create auth folder if it doesn't exist
      if (!fs.existsSync(this.authFolderPath)) {
        fs.mkdirSync(this.authFolderPath, { recursive: true });
        this.logger.log(`📁 Created authentication folder: ${this.authFolderPath}`);
      }

      // Create session-specific folder
      const sessionAuthPath = path.join(this.authFolderPath, sessionId);
      if (!fs.existsSync(sessionAuthPath)) {
        fs.mkdirSync(sessionAuthPath, { recursive: true });
      }

      // Write session data to local file (simplified approach)
      const sessionFilePath = path.join(sessionAuthPath, 'session.json');
      fs.writeFileSync(sessionFilePath, JSON.stringify(sessionData, null, 2));

      this.logger.log(`✅ Successfully restored session ${sessionId} from S3`);
      return { success: true };

    } catch (error) {
      this.logger.error(`❌ S3 restore failed for session ${sessionId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update session status in database
   */
  async updateSessionStatus(sessionId: string, status: WhatsAppSessionStatus, additionalData?: any): Promise<void> {
    try {
      await this.databaseService.whatsAppSession.update({
        where: { session_id: sessionId },
        data: {
          status,
          updated_at: new Date(),
          ...additionalData,
        },
      });
    } catch (error) {
      this.logger.error(`❌ Failed to update session status for ${sessionId}:`, error);
    }
  }

  /**
   * Perform complete authentication recovery
   */
  async performAuthRecovery(): Promise<AuthRecoveryReport> {
    const startTime = Date.now();
    this.logger.log('🚀 Starting authentication recovery process...');

    const results: AuthRecoveryResult[] = [];
    let s3Restored = 0;
    let qrRegenerated = 0;
    let failed = 0;

    try {
      // Get sessions that need recovery
      const sessions = await this.getSessionsNeedingRecovery();

      for (const session of sessions) {
        const sessionId = session.session_id;
        this.logger.log(`🔄 Processing recovery for session ${sessionId} (Status: ${session.status})`);

        try {
          // First, try S3 restore for READY sessions
          if (session.status === WhatsAppSessionStatus.READY) {
            const s3Result = await this.attemptS3Restore(sessionId);
            
            if (s3Result.success) {
              results.push({
                sessionId,
                recoveryMethod: 'S3_RESTORED',
                success: true,
              });
              s3Restored++;
              
              // Update session status to indicate it's restored but needs re-initialization
              await this.updateSessionStatus(sessionId, WhatsAppSessionStatus.AUTHENTICATED, {
                is_ready: false,
                is_authenticated: true,
              });
              
              continue;
            } else {
              this.logger.warn(`⚠️ S3 restore failed for ${sessionId}: ${s3Result.error}`);
            }
          }

          // Fallback: Mark for QR regeneration
          results.push({
            sessionId,
            recoveryMethod: 'QR_REGENERATED',
            success: true,
            requiresQRScan: true,
          });
          qrRegenerated++;

          // Update session status to require re-authentication
          await this.updateSessionStatus(sessionId, WhatsAppSessionStatus.INITIALIZING, {
            is_ready: false,
            is_authenticated: false,
            qr_code: null,
          });

        } catch (error) {
          this.logger.error(`❌ Recovery failed for session ${sessionId}:`, error);
          results.push({
            sessionId,
            recoveryMethod: 'FAILED',
            success: false,
            error: error.message,
          });
          failed++;

          // Mark session as disconnected
          await this.updateSessionStatus(sessionId, WhatsAppSessionStatus.DISCONNECTED, {
            is_ready: false,
            is_authenticated: false,
          });
        }
      }

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(1);

      const report: AuthRecoveryReport = {
        totalSessions: sessions.length,
        s3Restored,
        qrRegenerated,
        failed,
        results,
        duration: `${duration} seconds`,
      };

      this.logger.log(`🏁 Authentication recovery completed:`);
      this.logger.log(`   📊 Total sessions: ${report.totalSessions}`);
      this.logger.log(`   ✅ S3 restored: ${report.s3Restored}`);
      this.logger.log(`   📱 QR regenerated: ${report.qrRegenerated}`);
      this.logger.log(`   ❌ Failed: ${report.failed}`);
      this.logger.log(`   ⏱️ Duration: ${report.duration}`);

      return report;

    } catch (error) {
      this.logger.error('❌ Authentication recovery process failed:', error);
      throw error;
    }
  }

  /**
   * Check if a specific session needs recovery
   */
  async checkSessionNeedsRecovery(sessionId: string): Promise<boolean> {
    try {
      // Check if session auth folder exists
      const sessionAuthPath = path.join(this.authFolderPath, sessionId);
      if (fs.existsSync(sessionAuthPath)) {
        const files = fs.readdirSync(sessionAuthPath);
        if (files.length > 0) {
          return false; // Session has local auth files
        }
      }

      // Check session status in database
      const session = await this.databaseService.whatsAppSession.findUnique({
        where: { session_id: sessionId },
      });

      if (!session) {
        return false; // Session doesn't exist
      }

      // Session needs recovery if it was previously authenticated but has no local files
      return session.status === WhatsAppSessionStatus.READY || 
             session.status === WhatsAppSessionStatus.AUTHENTICATED;

    } catch (error) {
      this.logger.error(`❌ Error checking recovery need for session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Recover a specific session
   */
  async recoverSpecificSession(sessionId: string): Promise<AuthRecoveryResult> {
    this.logger.log(`🔄 Starting recovery for specific session: ${sessionId}`);

    try {
      const needsRecovery = await this.checkSessionNeedsRecovery(sessionId);
      if (!needsRecovery) {
        return {
          sessionId,
          recoveryMethod: 'S3_RESTORED',
          success: true,
        };
      }

      // Try S3 restore first
      const s3Result = await this.attemptS3Restore(sessionId);
      if (s3Result.success) {
        await this.updateSessionStatus(sessionId, WhatsAppSessionStatus.AUTHENTICATED, {
          is_ready: false,
          is_authenticated: true,
        });

        return {
          sessionId,
          recoveryMethod: 'S3_RESTORED',
          success: true,
        };
      }

      // Fallback to QR regeneration
      await this.updateSessionStatus(sessionId, WhatsAppSessionStatus.INITIALIZING, {
        is_ready: false,
        is_authenticated: false,
        qr_code: null,
      });

      return {
        sessionId,
        recoveryMethod: 'QR_REGENERATED',
        success: true,
        requiresQRScan: true,
      };

    } catch (error) {
      this.logger.error(`❌ Recovery failed for session ${sessionId}:`, error);
      
      await this.updateSessionStatus(sessionId, WhatsAppSessionStatus.DISCONNECTED, {
        is_ready: false,
        is_authenticated: false,
      });

      return {
        sessionId,
        recoveryMethod: 'FAILED',
        success: false,
        error: error.message,
      };
    }
  }
}
