import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Logger } from '@nestjs/common';

export interface S3StoreConfig {
  bucketName: string;
  remoteDataPath?: string;
  s3Client?: {
    region: string;
    credentials: {
      accessKeyId: string;
      secretAccessKey: string;
    };
  };
}

export class CustomS3Store {
  private readonly logger = new Logger(CustomS3Store.name);
  private s3Client: S3Client;
  private bucketName: string;
  private remoteDataPath: string;

  constructor(config: S3StoreConfig) {
    this.bucketName = config.bucketName;
    this.remoteDataPath = config.remoteDataPath || 'whatsapp-sessions/';

    // Initialize S3 client with AWS SDK v3
    this.s3Client = new S3Client({
      region: config.s3Client?.region || process.env.AWS_S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: config.s3Client?.credentials?.accessKeyId || process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.s3Client?.credentials?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    this.logger.log(`CustomS3Store initialized with bucket: ${this.bucketName}, path: ${this.remoteDataPath}`);
  }

  /**
   * Check if a session exists in S3 (whatsapp-web.js Store interface)
   */
  async sessionExists(options: { session: string }): Promise<boolean> {
    try {
      const sessionId = options.session;
      const key = this.getSessionKey(sessionId);
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      this.logger.error(`Error checking session existence for ${options.session}:`, error);
      throw error;
    }
  }

  /**
   * Check if a session exists in S3 (helper method)
   */
  async checkSessionExists(sessionId: string): Promise<boolean> {
    try {
      // First try the standard pattern
      const standardExists = await this.sessionExists({ session: sessionId });
      if (standardExists) {
        return true;
      }

      // If not found, search for any files related to this session
      this.logger.log(`🔍 Searching for session ${sessionId} in S3 with different patterns...`);
      const sessionFiles = await this.listSessionFiles(sessionId);

      if (sessionFiles.length > 0) {
        this.logger.log(`📦 Found ${sessionFiles.length} files for session ${sessionId}:`, sessionFiles);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Error checking session existence for ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * List all files related to a session in S3
   */
  async listSessionFiles(sessionId: string): Promise<string[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: this.remoteDataPath,
        MaxKeys: 100,
      });

      const response = await this.s3Client.send(command);
      const files: string[] = [];

      if (response.Contents) {
        for (const object of response.Contents) {
          if (object.Key && object.Key.includes(sessionId)) {
            files.push(object.Key);
          }
        }
      }

      return files;
    } catch (error) {
      this.logger.error(`Error listing session files for ${sessionId}:`, error);
      return [];
    }
  }

  /**
   * List all files in the WhatsApp sessions directory
   */
  async listAllSessionFiles(): Promise<string[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: this.remoteDataPath,
        MaxKeys: 100,
      });

      const response = await this.s3Client.send(command);
      const files: string[] = [];

      if (response.Contents) {
        for (const object of response.Contents) {
          if (object.Key) {
            files.push(object.Key);
          }
        }
      }

      this.logger.log(`📦 Found ${files.length} total files in S3:`, files);
      return files;
    } catch (error) {
      this.logger.error('Error listing all session files:', error);
      return [];
    }
  }

  /**
   * Save session data to S3
   */
  async saveSession(sessionId: string, sessionData: any): Promise<void> {
    try {
      const key = this.getSessionKey(sessionId);
      const data = JSON.stringify(sessionData);

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: data,
        ContentType: 'application/json',
        Metadata: {
          sessionId: sessionId,
          timestamp: new Date().toISOString(),
        },
      });

      await this.s3Client.send(command);
      this.logger.log(`Session ${sessionId} saved to S3 successfully`);
    } catch (error) {
      this.logger.error(`Error saving session ${sessionId} to S3:`, error);
      throw error;
    }
  }

  /**
   * Get session data from S3
   */
  async getSession(sessionId: string): Promise<any> {
    try {
      const key = this.getSessionKey(sessionId);
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error('Empty response body from S3');
      }

      // Convert stream to string
      const bodyString = await this.streamToString(response.Body);
      const sessionData = JSON.parse(bodyString);

      this.logger.log(`Session ${sessionId} retrieved from S3 successfully`);
      return sessionData;
    } catch (error) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        this.logger.warn(`Session ${sessionId} not found in S3`);
        return null;
      }
      this.logger.error(`Error getting session ${sessionId} from S3:`, error);
      throw error;
    }
  }

  /**
   * Delete session data from S3
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const key = this.getSessionKey(sessionId);
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`Session ${sessionId} deleted from S3 successfully`);
    } catch (error) {
      this.logger.error(`Error deleting session ${sessionId} from S3:`, error);
      throw error;
    }
  }

  /**
   * Download session backup zip file from S3
   */
  async downloadSessionBackup(sessionId: string, localPath: string): Promise<void> {
    try {
      const key = `whatsapp-sessions/${sessionId}.zip`;
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error('Empty response body from S3');
      }

      const fs = require('fs');

      // Convert stream to buffer for binary data
      const buffer = await this.streamToBuffer(response.Body);
      fs.writeFileSync(localPath, buffer);

      this.logger.log(`Session backup ${sessionId} downloaded from S3 successfully`);
    } catch (error) {
      this.logger.error(`Error downloading session backup ${sessionId} from S3:`, error);
      throw error;
    }
  }

  /**
   * Generate S3 key for session
   */
  private getSessionKey(sessionId: string): string {
    return `${this.remoteDataPath}${sessionId}.json`;
  }

  /**
   * Convert readable stream to string
   */
  private async streamToString(stream: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: any[] = [];
      stream.on('data', (chunk: any) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
  }

  /**
   * Convert readable stream to buffer (for binary data)
   */
  private async streamToBuffer(stream: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: any[] = [];
      stream.on('data', (chunk: any) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * Test S3 connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const testKey = `${this.remoteDataPath}test-connection.json`;
      const testData = { test: true, timestamp: new Date().toISOString() };

      // Test write
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: testKey,
        Body: JSON.stringify(testData),
        ContentType: 'application/json',
      }));

      // Test read
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: this.bucketName,
        Key: testKey,
      }));

      // Test delete
      await this.s3Client.send(new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: testKey,
      }));

      this.logger.log('S3 connection test successful');
      return true;
    } catch (error) {
      this.logger.error('S3 connection test failed:', error);
      return false;
    }
  }

  // ============================================================================
  // WhatsApp Web.js Store Interface Methods
  // ============================================================================

  /**
   * Save session data (whatsapp-web.js Store interface)
   */
  async save(sessionData: any): Promise<void> {
    const sessionId = sessionData.clientId || 'default';
    this.logger.log(`📦 RemoteAuth save called for session ${sessionId}`);
    this.logger.log(`📦 Session data keys:`, Object.keys(sessionData || {}));
    await this.saveSession(sessionId, sessionData);
  }

  /**
   * Extract/get session data (whatsapp-web.js Store interface)
   */
  async extract(options: { session: string }): Promise<any> {
    this.logger.log(`📦 RemoteAuth extract called for session ${options.session}`);
    const result = await this.getSession(options.session);
    this.logger.log(`📦 Extract result for ${options.session}:`, result ? 'Found' : 'Not found');
    return result;
  }

  /**
   * Delete session data (whatsapp-web.js Store interface)
   */
  async delete(options: { session: string }): Promise<void> {
    await this.deleteSession(options.session);
  }
}
