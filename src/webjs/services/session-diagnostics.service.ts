import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../utils/database/database.service';
import { CustomS3Store } from '../stores/custom-s3-store';
import { WhatsAppSessionStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

export interface SessionDiagnostics {
  sessionId: string;
  timestamp: string;
  database: {
    exists: boolean;
    status: string;
    isReady: boolean;
    isAuthenticated: boolean;
    qrCode: string | null;
    phoneNumber: string | null;
    lastActivity: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
  s3Storage: {
    exists: boolean;
    dataSize: number | null;
    lastModified: string | null;
    dataPreview: any;
    error: string | null;
  };
  localAuth: {
    folderExists: boolean;
    sessionFolderExists: boolean;
    files: string[];
    totalSize: number;
    lastModified: string | null;
  };
  memoryClient: {
    exists: boolean;
    isReady: boolean;
    isAuthenticated: boolean;
    status: string | null;
    phoneNumber: string | null;
    lastActivity: string | null;
  };
  analysis: {
    issues: string[];
    recommendations: string[];
    syncStatus: 'SYNCED' | 'PARTIAL_SYNC' | 'OUT_OF_SYNC' | 'CORRUPTED';
    canRecover: boolean;
    recoveryMethod: string | null;
  };
}

@Injectable()
export class SessionDiagnosticsService {
  private readonly logger = new Logger(SessionDiagnosticsService.name);
  private readonly authFolderPath = '.wwebjs_auth';
  private readonly cacheFolderPath = '.wwebjs_cache';

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly s3Store: CustomS3Store,
  ) {}

  /**
   * Perform comprehensive session diagnostics
   */
  async diagnoseSession(sessionId: string, clientsMap?: Map<string, any>): Promise<SessionDiagnostics> {
    this.logger.log(`🔍 Starting comprehensive diagnostics for session ${sessionId}...`);

    const diagnostics: SessionDiagnostics = {
      sessionId,
      timestamp: new Date().toISOString(),
      database: await this.analyzeDatabaseState(sessionId),
      s3Storage: await this.analyzeS3State(sessionId),
      localAuth: await this.analyzeLocalAuthState(sessionId),
      memoryClient: await this.analyzeMemoryClientState(sessionId, clientsMap),
      analysis: {
        issues: [],
        recommendations: [],
        syncStatus: 'SYNCED',
        canRecover: false,
        recoveryMethod: null,
      },
    };

    // Perform analysis
    diagnostics.analysis = this.performAnalysis(diagnostics);

    this.logger.log(`🔍 Diagnostics completed for session ${sessionId}. Sync status: ${diagnostics.analysis.syncStatus}`);
    return diagnostics;
  }

  /**
   * Analyze database state
   */
  private async analyzeDatabaseState(sessionId: string): Promise<SessionDiagnostics['database']> {
    try {
      const session = await this.databaseService.whatsAppSession.findUnique({
        where: { session_id: sessionId },
      });

      if (!session) {
        return {
          exists: false,
          status: 'NOT_FOUND',
          isReady: false,
          isAuthenticated: false,
          qrCode: null,
          phoneNumber: null,
          lastActivity: null,
          createdAt: null,
          updatedAt: null,
        };
      }

      return {
        exists: true,
        status: session.status,
        isReady: session.is_ready || false,
        isAuthenticated: session.is_authenticated || false,
        qrCode: session.qr_code ? `${session.qr_code.substring(0, 50)}...` : null,
        phoneNumber: session.phone_number,
        lastActivity: session.last_activity?.toISOString() || null,
        createdAt: session.created_at?.toISOString() || null,
        updatedAt: session.updated_at?.toISOString() || null,
      };
    } catch (error) {
      this.logger.error(`Error analyzing database state for ${sessionId}:`, error);
      return {
        exists: false,
        status: 'ERROR',
        isReady: false,
        isAuthenticated: false,
        qrCode: null,
        phoneNumber: null,
        lastActivity: null,
        createdAt: null,
        updatedAt: null,
      };
    }
  }

  /**
   * Analyze S3 storage state
   */
  private async analyzeS3State(sessionId: string): Promise<SessionDiagnostics['s3Storage']> {
    try {
      const exists = await this.s3Store.checkSessionExists(sessionId);
      
      if (!exists) {
        return {
          exists: false,
          dataSize: null,
          lastModified: null,
          dataPreview: null,
          error: null,
        };
      }

      const sessionData = await this.s3Store.getSession(sessionId);
      
      return {
        exists: true,
        dataSize: JSON.stringify(sessionData).length,
        lastModified: sessionData.timestamp || null,
        dataPreview: {
          hasClientId: !!sessionData.clientId,
          hasWABrowserId: !!sessionData.WABrowserId,
          hasWASecretBundle: !!sessionData.WASecretBundle,
          hasWAToken1: !!sessionData.WAToken1,
          hasWAToken2: !!sessionData.WAToken2,
          keysCount: sessionData.keys ? Object.keys(sessionData.keys).length : 0,
        },
        error: null,
      };
    } catch (error) {
      this.logger.error(`Error analyzing S3 state for ${sessionId}:`, error);
      return {
        exists: false,
        dataSize: null,
        lastModified: null,
        dataPreview: null,
        error: error.message,
      };
    }
  }

  /**
   * Analyze local authentication state
   */
  private async analyzeLocalAuthState(sessionId: string): Promise<SessionDiagnostics['localAuth']> {
    try {
      const authFolderExists = fs.existsSync(this.authFolderPath);
      const sessionAuthPath = path.join(this.authFolderPath, sessionId);
      const sessionFolderExists = fs.existsSync(sessionAuthPath);

      let files: string[] = [];
      let totalSize = 0;
      let lastModified: string | null = null;

      if (sessionFolderExists) {
        files = fs.readdirSync(sessionAuthPath);
        
        for (const file of files) {
          const filePath = path.join(sessionAuthPath, file);
          const stats = fs.statSync(filePath);
          totalSize += stats.size;
          
          if (!lastModified || stats.mtime > new Date(lastModified)) {
            lastModified = stats.mtime.toISOString();
          }
        }
      }

      return {
        folderExists: authFolderExists,
        sessionFolderExists,
        files,
        totalSize,
        lastModified,
      };
    } catch (error) {
      this.logger.error(`Error analyzing local auth state for ${sessionId}:`, error);
      return {
        folderExists: false,
        sessionFolderExists: false,
        files: [],
        totalSize: 0,
        lastModified: null,
      };
    }
  }

  /**
   * Analyze memory client state
   */
  private async analyzeMemoryClientState(sessionId: string, clientsMap?: Map<string, any>): Promise<SessionDiagnostics['memoryClient']> {
    try {
      if (!clientsMap) {
        return {
          exists: false,
          isReady: false,
          isAuthenticated: false,
          status: null,
          phoneNumber: null,
          lastActivity: null,
        };
      }

      const clientInstance = clientsMap.get(sessionId);
      
      if (!clientInstance) {
        return {
          exists: false,
          isReady: false,
          isAuthenticated: false,
          status: null,
          phoneNumber: null,
          lastActivity: null,
        };
      }

      return {
        exists: true,
        isReady: clientInstance.isReady || false,
        isAuthenticated: clientInstance.isAuthenticated || false,
        status: clientInstance.status || null,
        phoneNumber: clientInstance.phoneNumber || null,
        lastActivity: clientInstance.lastActivity?.toISOString() || null,
      };
    } catch (error) {
      this.logger.error(`Error analyzing memory client state for ${sessionId}:`, error);
      return {
        exists: false,
        isReady: false,
        isAuthenticated: false,
        status: null,
        phoneNumber: null,
        lastActivity: null,
      };
    }
  }

  /**
   * Perform comprehensive analysis
   */
  private performAnalysis(diagnostics: SessionDiagnostics): SessionDiagnostics['analysis'] {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let syncStatus: SessionDiagnostics['analysis']['syncStatus'] = 'SYNCED';
    let canRecover = false;
    let recoveryMethod: string | null = null;

    // Check database state
    if (!diagnostics.database.exists) {
      issues.push('Session not found in database');
      syncStatus = 'CORRUPTED';
    } else if (diagnostics.database.status === 'QR_READY' && !diagnostics.database.isReady) {
      issues.push('Session stuck in QR_READY status without being ready');
      recommendations.push('Complete QR code scanning or force reinitialize');
    }

    // Check S3 vs Database sync
    if (diagnostics.database.exists && diagnostics.database.isAuthenticated && !diagnostics.s3Storage.exists) {
      issues.push('Database shows authenticated but no S3 session data found');
      syncStatus = 'OUT_OF_SYNC';
      recommendations.push('Session data may have been lost from S3');
    }

    // Check local auth vs S3 sync
    if (diagnostics.s3Storage.exists && !diagnostics.localAuth.sessionFolderExists) {
      issues.push('S3 session data exists but local auth folder missing');
      syncStatus = 'PARTIAL_SYNC';
      canRecover = true;
      recoveryMethod = 'S3_RESTORE';
      recommendations.push('Restore session from S3 storage');
    }

    // Check memory client sync
    if (diagnostics.database.exists && diagnostics.database.isReady && !diagnostics.memoryClient.exists) {
      issues.push('Database shows ready but no client in memory');
      syncStatus = 'OUT_OF_SYNC';
      canRecover = true;
      recoveryMethod = 'MEMORY_RESTORE';
      recommendations.push('Reinitialize client in memory');
    }

    // Check for QR_READY stuck state
    if (diagnostics.database.status === 'QR_READY' && 
        diagnostics.memoryClient.exists && 
        !diagnostics.memoryClient.isReady) {
      issues.push('Session stuck in QR_READY state - QR code may need to be scanned');
      recommendations.push('Scan QR code with WhatsApp mobile app');
      recommendations.push('If already scanned, force reinitialize the session');
    }

    // Determine recovery capability
    if (diagnostics.s3Storage.exists && diagnostics.s3Storage.dataPreview?.hasWAToken1) {
      canRecover = true;
      if (!recoveryMethod) {
        recoveryMethod = 'S3_RESTORE';
      }
    }

    return {
      issues,
      recommendations,
      syncStatus,
      canRecover,
      recoveryMethod,
    };
  }
}
