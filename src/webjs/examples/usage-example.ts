/**
 * WhatsApp Web Integration Usage Examples
 * 
 * This file demonstrates how to use the WhatsApp Web integration
 * in your NestJS application.
 */

import { Injectable } from '@nestjs/common';
import { WebjsService } from '../webjs.service';

@Injectable()
export class WhatsAppUsageExample {
  constructor(private readonly webjsService: WebjsService) { }

  /**
   * Example 1: Create and initialize a WhatsApp session for a user
   */
  async createUserSession(userId: string) {
    try {
      // Step 1: Create a session (only one per user allowed)
      const session = await this.webjsService.createSession({
        user_id: userId,
      });

      console.log('Session created:', session);

      // Step 2: Initialize the client (this will generate a QR code)
      const qrResponse = await this.webjsService.initializeClient(session.session_id);

      console.log('Client initialized, QR code will be available soon');

      // Step 3: Get the QR code (you might need to wait a moment for it to be generated)
      setTimeout(async () => {
        try {
          const qrCode = await this.webjsService.getQRCode(session.session_id);
          console.log('QR Code:', qrCode.qr_code);
          console.log('Please scan this QR code with your WhatsApp mobile app');
        } catch (error) {
          console.error('Error getting QR code:', error.message);
        }
      }, 5000); // Wait 5 seconds for QR code generation

      return session;
    } catch (error) {
      console.error('Error creating session:', error.message);
      throw error;
    }
  }

  /**
   * Example 2: Send a text message
   */
  async sendTextMessage(sessionId: string, phoneNumber: string, message: string) {
    try {
      const result = await this.webjsService.sendMessage({
        session_id: sessionId,
        to: phoneNumber, // Format: "919876543210" (country code + number)
        message: message,
      });

      if (result.success) {
        console.log('Message sent successfully:', result.message_id);
      } else {
        console.error('Failed to send message:', result.error);
      }

      return result;
    } catch (error) {
      console.error('Error sending message:', error.message);
      throw error;
    }
  }

  /**
   * Example 3: Send a message with media
   */
  async sendMediaMessage(
    sessionId: string,
    phoneNumber: string,
    message: string,
    mediaUrls: string[]
  ) {
    try {
      const result = await this.webjsService.sendMessage({
        session_id: sessionId,
        to: phoneNumber,
        message: message,
        media_urls: mediaUrls,
      });

      if (result.success) {
        console.log('Media message sent successfully:', result.message_id);
      } else {
        console.error('Failed to send media message:', result.error);
      }

      return result;
    } catch (error) {
      console.error('Error sending media message:', error.message);
      throw error;
    }
  }

  /**
   * Example 4: Monitor session status
   */
  async monitorSessionStatus(sessionId: string) {
    try {
      const status = await this.webjsService.getSessionStatus(sessionId);

      console.log('Session Status:', {
        id: status.session_id,
        status: status.status,
        authenticated: status.is_authenticated,
        ready: status.is_ready,
        phone: status.phone_number,
        lastActivity: status.last_activity,
      });

      return status;
    } catch (error) {
      console.error('Error getting session status:', error.message);
      throw error;
    }
  }

  /**
   * Example 5: Get all sessions for a user
   */
  async getUserSessions(userId: string) {
    try {
      const sessions = await this.webjsService.getUserSessions(userId);

      console.log(`User ${userId} has ${sessions.total} sessions:`);
      sessions.sessions.forEach(session => {
        console.log(`- ${session.session_name} (${session.status})`);
      });

      return sessions;
    } catch (error) {
      console.error('Error getting user sessions:', error.message);
      throw error;
    }
  }

  /**
   * Example 6: Complete workflow - Create session, wait for authentication, send message
   */
  async completeWorkflowExample(userId: string, targetPhoneNumber: string, message: string) {
    try {
      // Create session
      const session = await this.createUserSession(userId);

      console.log('Waiting for QR code scan...');

      // Poll for authentication status
      const checkAuth = async (): Promise<boolean> => {
        const status = await this.webjsService.getSessionStatus(session.session_id);
        return status.is_ready;
      };

      // Wait for authentication (check every 5 seconds, max 2 minutes)
      let attempts = 0;
      const maxAttempts = 24; // 2 minutes

      while (attempts < maxAttempts) {
        if (await checkAuth()) {
          console.log('Session is ready! Sending message...');

          // Send message
          const result = await this.sendTextMessage(
            session.session_id,
            targetPhoneNumber,
            message
          );

          return result;
        }

        console.log('Still waiting for authentication...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      }

      throw new Error('Authentication timeout - QR code was not scanned within 2 minutes');

    } catch (error) {
      console.error('Complete workflow error:', error.message);
      throw error;
    }
  }

  /**
   * Example 7: Cleanup - Delete old sessions
   */
  async cleanupOldSessions(userId: string) {
    try {
      const sessions = await this.webjsService.getUserSessions(userId);

      for (const session of sessions.sessions) {
        // Delete sessions that are disconnected or destroyed
        if (session.status === 'DISCONNECTED' || session.status === 'DESTROYED') {
          console.log(`Deleting old session: ${session.session_id}`);
          await this.webjsService.deleteSession(session.session_id);
        }
      }

      console.log('Cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error.message);
      throw error;
    }
  }
}

/**
 * Usage in a controller or service:
 * 
 * @Controller('example')
 * export class ExampleController {
 *   constructor(private readonly whatsappExample: WhatsAppUsageExample) {}
 * 
 *   @Post('send-welcome-message')
 *   async sendWelcomeMessage(@Body() body: { userId: string, phoneNumber: string }) {
 *     return await this.whatsappExample.completeWorkflowExample(
 *       body.userId,
 *       body.phoneNumber,
 *       'Welcome to Abhyasika! Your account has been created successfully.'
 *     );
 *   }
 * }
 */
