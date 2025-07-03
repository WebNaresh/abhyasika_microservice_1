import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiExtraModels
} from '@nestjs/swagger';
import { WebjsService } from './webjs.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { SendBulkMessageDto, SendBulkMessageResponseDto } from './dto/bulk-message.dto';
import { SessionStatusDto, QRCodeResponseDto, SessionListDto } from './dto/session-status.dto';

@ApiTags('WhatsApp Web Sessions')
@Controller('webjs')
@ApiExtraModels(SessionStatusDto, QRCodeResponseDto, SessionListDto)
export class WebjsController {
  constructor(private readonly webjsService: WebjsService) { }

  // Helper method to format WhatsApp error messages for user-friendly responses
  private formatWhatsAppError(errorMessage: string): { message: string; statusCode: number } {
    if (!errorMessage) {
      return { message: 'An unknown error occurred', statusCode: HttpStatus.INTERNAL_SERVER_ERROR };
    }

    // Parse structured error messages
    if (errorMessage.includes('WHATSAPP_QR_REQUIRED:')) {
      const parts = errorMessage.split(':');
      const sessionId = parts[1];
      const message = parts.slice(2).join(':');
      return {
        message: `🔗 WhatsApp Device Linking Required\n\n${message}\n\n📱 Steps to link your device:\n1. Open WhatsApp on your phone\n2. Go to Settings → Linked Devices\n3. Tap "Link a Device"\n4. Scan the QR code\n\n🔍 Get QR Code: GET /webjs/sessions/${sessionId}/qr`,
        statusCode: HttpStatus.PRECONDITION_REQUIRED
      };
    }

    if (errorMessage.includes('WHATSAPP_DISCONNECTED:')) {
      const parts = errorMessage.split(':');
      const sessionId = parts[1];
      const message = parts.slice(2).join(':');
      return {
        message: `📱 WhatsApp Disconnected\n\n${message}\n\n🔄 To reconnect:\n1. Initialize a new session: POST /webjs/sessions/${sessionId}/initialize\n2. Scan the new QR code with your phone\n3. Wait for connection to be established`,
        statusCode: HttpStatus.SERVICE_UNAVAILABLE
      };
    }

    if (errorMessage.includes('WHATSAPP_QR_MISSING:')) {
      const parts = errorMessage.split(':');
      const sessionId = parts[1];
      const message = parts.slice(2).join(':');
      return {
        message: `🔄 WhatsApp Reconnection Needed\n\n${message}\n\n🚀 To reconnect:\n1. Reinitialize: POST /webjs/sessions/${sessionId}/initialize\n2. Scan the new QR code\n3. Complete the linking process`,
        statusCode: HttpStatus.GONE
      };
    }

    if (errorMessage.includes('WHATSAPP_QR_EXPIRED:')) {
      const parts = errorMessage.split(':');
      const sessionId = parts[1];
      const message = parts.slice(2).join(':');
      return {
        message: `📱 WhatsApp Session Expired\n\n${message}\n\n🔄 To reconnect:\n1. Get QR Code: GET /webjs/sessions/${sessionId}/qr\n2. Scan the QR code with your WhatsApp mobile app\n3. Wait for authentication to complete\n\n💡 If QR code is not available, reinitialize: POST /webjs/sessions/${sessionId}/initialize`,
        statusCode: HttpStatus.BAD_REQUEST
      };
    }

    if (errorMessage.includes('WHATSAPP_INIT_FAILED:')) {
      const parts = errorMessage.split(':');
      const sessionId = parts[1];
      const message = parts.slice(2).join(':');
      return {
        message: `❌ WhatsApp Initialization Failed\n\n${message}\n\n🆘 Troubleshooting:\n1. Try creating a new session\n2. Check your internet connection\n3. Contact support if the issue persists`,
        statusCode: HttpStatus.FAILED_DEPENDENCY
      };
    }

    if (errorMessage.includes('WHATSAPP_NOT_READY:')) {
      const parts = errorMessage.split(':');
      const sessionId = parts[1];
      const message = parts.slice(2).join(':');
      return {
        message: `⏳ WhatsApp Not Ready\n\n${message}\n\n🔧 Next steps:\n1. Initialize your connection: POST /webjs/sessions/${sessionId}/initialize\n2. Complete the authentication process\n3. Wait for the status to become READY`,
        statusCode: HttpStatus.SERVICE_UNAVAILABLE
      };
    }

    // Default error handling
    return {
      message: errorMessage,
      statusCode: HttpStatus.BAD_REQUEST
    };
  }

  @Post('sessions')
  @ApiOperation({
    summary: 'Create WhatsApp session',
    description: 'Creates a new WhatsApp Web session for a user. Only one active session per user is allowed.'
  })
  @ApiBody({
    type: CreateSessionDto,
    examples: {
      example1: {
        summary: 'Create session for user',
        value: {
          user_id: 'user_123456789'
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Session created successfully',
    type: SessionStatusDto,
    example: {
      id: 'session_abc123',
      user_id: 'user_123456789',
      session_id: 'user_123456789',
      session_name: 'WhatsApp for John Doe',
      phone_number: null,
      is_authenticated: false,
      is_ready: false,
      qr_code: null,
      status: 'INITIALIZING',
      last_activity: null,
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-15T10:30:00Z'
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - User not found or already has active session',
    example: {
      statusCode: 400,
      message: 'User already has an active WhatsApp session. Please delete the existing session first.',
      error: 'Bad Request'
    }
  })
  async createSession(@Body() createSessionDto: CreateSessionDto) {
    try {
      return await this.webjsService.createSession(createSessionDto);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to create session',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('sessions/:sessionId/initialize')
  @ApiOperation({
    summary: 'Initialize WhatsApp client',
    description: 'Initializes the WhatsApp Web client for a session. This will generate a QR code for authentication. The response may include the QR code immediately, or you may need to call the /qr endpoint if the QR code is empty.'
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session ID (same as user ID)',
    example: 'user_123456789'
  })
  @ApiResponse({
    status: 200,
    description: 'Client initialization started',
    type: QRCodeResponseDto,
    example: {
      session_id: 'user_123456789',
      qr_code: '',
      status: 'INITIALIZING'
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Session not found or client already initialized',
    example: {
      statusCode: 400,
      message: 'Client already initialized for this session',
      error: 'Bad Request'
    }
  })
  async initializeClient(@Param('sessionId') sessionId: string) {
    try {
      return await this.webjsService.initializeClient(sessionId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to initialize client',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('sessions/:sessionId/status')
  @ApiOperation({
    summary: 'Get session status',
    description: 'Retrieves the current status and details of a WhatsApp session.'
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session ID (same as user ID)',
    example: 'user_123456789'
  })
  @ApiResponse({
    status: 200,
    description: 'Session status retrieved successfully',
    type: SessionStatusDto,
    example: {
      id: 'session_abc123',
      user_id: 'user_123456789',
      session_id: 'user_123456789',
      session_name: 'WhatsApp for John Doe',
      phone_number: '919876543210',
      is_authenticated: true,
      is_ready: true,
      qr_code: null,
      status: 'READY',
      last_activity: '2024-01-15T11:45:00Z',
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-15T11:45:00Z'
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
    example: {
      statusCode: 404,
      message: 'Session not found',
      error: 'Not Found'
    }
  })
  async getSessionStatus(@Param('sessionId') sessionId: string) {
    try {
      return await this.webjsService.getSessionStatus(sessionId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Session not found',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Get('sessions/:sessionId/qr')
  @ApiOperation({
    summary: 'Get QR code for authentication',
    description: 'Retrieves the QR code that needs to be scanned with WhatsApp mobile app for authentication. If the QR code is not ready yet, this endpoint will wait up to 30 seconds for it to be generated.'
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session ID (same as user ID)',
    example: 'user_123456789'
  })
  @ApiResponse({
    status: 200,
    description: 'QR code retrieved successfully',
    type: QRCodeResponseDto,
    example: {
      session_id: 'user_123456789',
      qr_code: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCAYAAAB5fY51...',
      status: 'QR_READY'
    }
  })
  @ApiResponse({
    status: 400,
    description: 'QR code not available or session not in correct state',
    example: {
      statusCode: 400,
      message: 'QR code not available. Please initialize the client first.',
      error: 'Bad Request'
    }
  })
  async getQRCode(@Param('sessionId') sessionId: string) {
    try {
      return await this.webjsService.getQRCode(sessionId);
    } catch (error) {
      throw new HttpException(
        error.message || 'QR code not available',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('sessions/:sessionId/qr-status')
  @ApiOperation({
    summary: 'Get QR code status and instructions',
    description: 'Returns the current QR code status and provides clear instructions for next steps. Useful for checking if QR code scanning is required.'
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session ID (same as user ID)',
    example: 'user_123456789'
  })
  @ApiResponse({
    status: 200,
    description: 'QR status retrieved successfully',
    example: {
      session_id: 'user_123456789',
      status: 'QR_READY',
      requires_qr_scan: true,
      qr_code_available: true,
      instructions: 'Please scan the QR code with your WhatsApp mobile app to complete authentication.',
      next_steps: [
        'Open WhatsApp on your mobile device',
        'Go to Settings > Linked Devices',
        'Tap "Link a Device"',
        'Scan the QR code displayed'
      ]
    }
  })
  async getQRStatus(@Param('sessionId') sessionId: string) {
    try {
      return await this.webjsService.getQRStatus(sessionId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get QR status',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('sessions/:sessionId/send-message')
  @ApiOperation({
    summary: 'Send WhatsApp message',
    description: 'Sends a text or media message through an authenticated WhatsApp session.'
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session ID (same as user ID)',
    example: 'user_123456789'
  })
  @ApiBody({
    type: SendMessageDto,
    examples: {
      textMessage: {
        summary: 'Send text message',
        value: {
          to: '919876543210',
          message: 'Hello! Welcome to Abhyasika. Your account has been created successfully.'
        }
      },
      mediaMessage: {
        summary: 'Send message with media',
        value: {
          to: '919876543210',
          message: 'Here is your admission confirmation document.',
          media_urls: ['https://example.com/document.pdf']
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Message sent successfully',
    example: {
      success: true,
      message_id: 'wamid.HBgNOTE5ODc2NTQzMjEwFQIAERgSMkE4OEJDMEM4RjA4NzY4OTMA'
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Failed to send message - session not ready or invalid data',
    example: {
      statusCode: 400,
      message: 'Client is not ready. Please ensure the session is authenticated and ready.',
      error: 'Bad Request'
    }
  })
  async sendMessage(
    @Param('sessionId') sessionId: string,
    @Body() sendMessageDto: SendMessageDto,
  ) {
    try {
      // Ensure the session ID in the DTO matches the URL parameter
      sendMessageDto.session_id = sessionId;
      return await this.webjsService.sendMessage(sendMessageDto);
    } catch (error) {
      // Check if session is stuck in QR_READY state
      if (error.message && error.message.includes('Current status: QR_READY')) {
        try {
          // Auto-clear and reinitialize the session for fresh start
          await this.webjsService.clearAndReinitializeSession(sessionId);

          // Return user-friendly response with fresh QR code instructions
          throw new HttpException(
            {
              message: '🔄 WhatsApp Session Reset',
              details: 'Your WhatsApp session has been cleared and reset for a fresh start.',
              instructions: [
                '1. Get the new QR code using: GET /webjs/sessions/' + sessionId + '/qr',
                '2. Open WhatsApp on your phone',
                '3. Go to Settings → Linked Devices',
                '4. Tap "Link a Device"',
                '5. Scan the new QR code',
                '6. Try sending your message again'
              ],
              qr_endpoint: `/webjs/sessions/${sessionId}/qr`,
              status_endpoint: `/webjs/sessions/${sessionId}/status`,
              session_cleared: true,
              ready_for_new_qr: true
            },
            HttpStatus.RESET_CONTENT, // 205 - indicates content has been reset
          );
        } catch (clearError) {
          // If clearing fails, fall back to original error handling
          const formattedError = this.formatWhatsAppError(error.message);
          throw new HttpException(
            formattedError.message,
            formattedError.statusCode,
          );
        }
      }

      // For other errors, use normal error formatting
      const formattedError = this.formatWhatsAppError(error.message);
      throw new HttpException(
        formattedError.message,
        formattedError.statusCode,
      );
    }
  }

  @Post('sessions/:sessionId/send-bulk-messages')
  @ApiOperation({
    summary: 'Send bulk WhatsApp messages',
    description: 'Sends multiple personalized WhatsApp messages to different recipients in a single request. Includes rate limiting and detailed error handling.'
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session ID (same as user ID)',
    example: 'user_123456789'
  })
  @ApiBody({
    type: SendBulkMessageDto,
    description: 'Bulk message data containing array of messages to send',
    examples: {
      'Basic Text Messages': {
        value: {
          messages: [
            {
              to: '+919370928324',
              message: 'Hey did you check the message?'
            },
            {
              to: '+919876543210',
              message: 'Your payment is due tomorrow'
            },
            {
              to: '+918765432109',
              message: 'Meeting scheduled for 3 PM'
            }
          ]
        }
      },
      'Messages with Media': {
        value: {
          messages: [
            {
              to: '+919370928324',
              message: 'Check out this image!',
              media_urls: ['https://example.com/image.jpg']
            },
            {
              to: '+919876543210',
              message: 'Here is your invoice',
              media_urls: ['https://example.com/invoice.pdf']
            }
          ]
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk messages processed successfully',
    type: SendBulkMessageResponseDto,
    example: {
      success: true,
      total_messages: 3,
      successful_sends: 2,
      failed_sends: 1,
      results: [
        {
          to: '+919370928324',
          status: 'success',
          message_id: 'wamid.HBgNOTE5ODc2NTQzMjEwFQIAERgSMkE4OEJDMEM4RjA4NzY4OTMA',
          timestamp: '2024-01-15T12:00:00Z'
        },
        {
          to: '+919876543210',
          status: 'failed',
          error: 'Invalid phone number format',
          timestamp: '2024-01-15T12:00:01Z'
        },
        {
          to: '+918765432109',
          status: 'success',
          message_id: 'wamid.HBgNOTE5ODc2NTQzMjEwFQIAERgSMkE4OEJDMEM4RjA4NzY4OTMB',
          timestamp: '2024-01-15T12:00:03Z'
        }
      ],
      session_id: 'user_123456789',
      duration: '5.2 seconds'
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation errors or session not ready',
    example: {
      statusCode: 400,
      message: 'Client not initialized for session user_123456789. Current status: QR_READY. Please initialize the client first.',
      error: 'Bad Request'
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
    example: {
      statusCode: 404,
      message: 'Session user_123456789 not found. Please create a session first.',
      error: 'Not Found'
    }
  })
  async sendBulkMessages(
    @Param('sessionId') sessionId: string,
    @Body() sendBulkMessageDto: SendBulkMessageDto
  ) {
    try {
      return await this.webjsService.sendBulkMessages(sessionId, sendBulkMessageDto);
    } catch (error) {
      // Check if session is stuck in QR_READY state
      if (error.message && error.message.includes('Current status: QR_READY')) {
        try {
          // Auto-clear and reinitialize the session for fresh start
          await this.webjsService.clearAndReinitializeSession(sessionId);

          // Return user-friendly response with fresh QR code instructions
          throw new HttpException(
            {
              message: '🔄 WhatsApp Session Reset for Bulk Messaging',
              details: 'Your WhatsApp session has been cleared and reset for a fresh start.',
              instructions: [
                '1. Get the new QR code using: GET /webjs/sessions/' + sessionId + '/qr',
                '2. Open WhatsApp on your phone',
                '3. Go to Settings → Linked Devices',
                '4. Tap "Link a Device"',
                '5. Scan the new QR code',
                '6. Try sending your bulk messages again'
              ],
              qr_endpoint: `/webjs/sessions/${sessionId}/qr`,
              status_endpoint: `/webjs/sessions/${sessionId}/status`,
              session_cleared: true,
              ready_for_new_qr: true
            },
            HttpStatus.RESET_CONTENT,
          );
        } catch (clearError) {
          // If clearing fails, fall back to original error handling
          const formattedError = this.formatWhatsAppError(error.message);
          throw new HttpException(
            formattedError.message,
            formattedError.statusCode,
          );
        }
      }

      // For other errors, use normal error formatting
      const formattedError = this.formatWhatsAppError(error.message);
      throw new HttpException(
        formattedError.message,
        formattedError.statusCode,
      );
    }
  }

  @Post('sessions/:sessionId/restart')
  @ApiOperation({
    summary: 'Restart WhatsApp session',
    description: 'Destroys and reinitializes a WhatsApp session. Use this when session is stuck or disconnected.'
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session ID (same as user ID)',
    example: 'user_123456789'
  })
  @ApiResponse({
    status: 200,
    description: 'Session restarted successfully',
    type: QRCodeResponseDto,
    example: {
      session_id: 'user_123456789',
      qr_code: '',
      status: 'INITIALIZING'
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Failed to restart session',
    example: {
      statusCode: 400,
      message: 'Failed to restart session',
      error: 'Bad Request'
    }
  })
  async restartSession(@Param('sessionId') sessionId: string) {
    try {
      return await this.webjsService.restartSession(sessionId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to restart session',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete('sessions/:sessionId')
  @ApiOperation({
    summary: 'Delete WhatsApp session',
    description: 'Permanently deletes a WhatsApp session and performs comprehensive cleanup including: destroying client instance, clearing timers, removing from memory cache, cleaning local auth data, and deleting database record. Ensures no traces remain for fresh session creation.'
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session ID (same as user ID)',
    example: 'user_123456789'
  })
  @ApiResponse({
    status: 200,
    description: 'Session deleted successfully with comprehensive cleanup',
    example: {
      message: 'Session deleted successfully'
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Failed to delete session',
    example: {
      statusCode: 400,
      message: 'Failed to delete session',
      error: 'Bad Request'
    }
  })
  async deleteSession(@Param('sessionId') sessionId: string) {
    try {
      await this.webjsService.deleteSession(sessionId);
      return { message: 'Session deleted successfully' };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to delete session',
        HttpStatus.BAD_REQUEST,
      );
    }
  }



  @Get('users/:userId/sessions')
  @ApiOperation({
    summary: 'Get all user sessions',
    description: 'Retrieves all WhatsApp sessions for a specific user (including inactive ones).'
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: 'user_123456789'
  })
  @ApiResponse({
    status: 200,
    description: 'User sessions retrieved successfully',
    type: SessionListDto,
    example: {
      sessions: [
        {
          id: 'session_abc123',
          user_id: 'user_123456789',
          session_id: 'user_123456789',
          session_name: 'WhatsApp for John Doe',
          phone_number: '919876543210',
          is_authenticated: true,
          is_ready: true,
          qr_code: null,
          status: 'READY',
          last_activity: '2024-01-15T11:45:00Z',
          created_at: '2024-01-15T10:30:00Z',
          updated_at: '2024-01-15T11:45:00Z'
        }
      ],
      total: 1
    }
  })
  async getUserSessions(@Param('userId') userId: string) {
    try {
      return await this.webjsService.getUserSessions(userId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get user sessions',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('users/:userId/session')
  @ApiOperation({
    summary: 'Get user active session',
    description: 'Retrieves the active WhatsApp session for a specific user. Returns 404 if no active session exists.'
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: 'user_123456789'
  })
  @ApiResponse({
    status: 200,
    description: 'Active session found',
    type: SessionStatusDto,
    example: {
      id: 'session_abc123',
      user_id: 'user_123456789',
      session_id: 'user_123456789',
      session_name: 'WhatsApp for John Doe',
      phone_number: '919876543210',
      is_authenticated: true,
      is_ready: true,
      qr_code: null,
      status: 'READY',
      last_activity: '2024-01-15T11:45:00Z',
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-15T11:45:00Z'
    }
  })
  @ApiResponse({
    status: 404,
    description: 'No active session found for this user',
    example: {
      statusCode: 404,
      message: 'No active session found for this user',
      error: 'Not Found'
    }
  })
  async getUserSession(@Param('userId') userId: string) {
    try {
      const session = await this.webjsService.getUserSession(userId);
      if (!session) {
        throw new HttpException(
          'No active session found for this user',
          HttpStatus.NOT_FOUND,
        );
      }
      return session;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get user session',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('sessions/active')
  @ApiOperation({
    summary: 'Get all active sessions',
    description: 'Retrieves a list of all currently active WhatsApp sessions across all users.'
  })
  @ApiResponse({
    status: 200,
    description: 'Active sessions retrieved successfully',
    example: {
      active_sessions: ['user_123456789', 'user_987654321'],
      count: 2
    }
  })
  async getActiveSessions() {
    try {
      const activeSessions = this.webjsService.getActiveSessions();
      return { active_sessions: activeSessions, count: activeSessions.length };
    } catch (error) {
      throw new HttpException(
        'Failed to get active sessions',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('sessions/:sessionId/active')
  @ApiOperation({
    summary: 'Check if session is active',
    description: 'Checks whether a specific session is currently active and ready for messaging.'
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session ID (same as user ID)',
    example: 'user_123456789'
  })
  @ApiResponse({
    status: 200,
    description: 'Session status checked successfully',
    example: {
      session_id: 'user_123456789',
      is_active: true
    }
  })
  async isSessionActive(@Param('sessionId') sessionId: string) {
    try {
      const isActive = this.webjsService.isSessionActive(sessionId);
      return { session_id: sessionId, is_active: isActive };
    } catch (error) {
      throw new HttpException(
        'Failed to check session status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('sessions/:sessionId/debug')
  @ApiOperation({
    summary: 'Debug session state',
    description: 'Returns detailed debug information about a session including database state and client state.'
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session ID (same as user ID)',
    example: 'user_123456789'
  })
  @ApiResponse({
    status: 200,
    description: 'Debug information retrieved successfully',
    example: {
      session_id: 'user_123456789',
      database_status: 'READY',
      client_initialized: true,
      client_ready: true,
      client_authenticated: true,
      phone_number: '919876543210',
      last_activity: '2024-01-15T11:45:00Z'
    }
  })
  async debugSession(@Param('sessionId') sessionId: string) {
    try {
      return await this.webjsService.getSessionDebugInfo(sessionId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get debug information',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('sessions/:sessionId/diagnostics')
  @ApiOperation({
    summary: 'Comprehensive session diagnostics',
    description: 'Performs comprehensive analysis of session state including local auth storage, database, and memory synchronization. Provides detailed recommendations for fixing issues.'
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session ID to diagnose',
    example: 'user_123456789'
  })
  @ApiResponse({
    status: 200,
    description: 'Comprehensive diagnostics completed',
    example: {
      sessionId: 'user_123456789',
      timestamp: '2024-01-15T12:00:00Z',
      database: {
        exists: true,
        status: 'QR_READY',
        isReady: false,
        isAuthenticated: false
      },
      localAuth: {
        exists: true,
        authMethod: 'LocalAuth',
        hasAuthData: true
      },
      localAuthFolder: {
        folderExists: true,
        sessionFolderExists: false,
        files: []
      },
      memoryClient: {
        exists: true,
        isReady: false,
        status: 'QR_READY'
      },
      analysis: {
        issues: ['Session stuck in QR_READY state'],
        recommendations: ['Scan QR code with WhatsApp mobile app'],
        syncStatus: 'PARTIAL_SYNC',
        canRecover: true,
        recoveryMethod: 'LOCAL_RESTORE'
      }
    }
  })
  async getSessionDiagnostics(@Param('sessionId') sessionId: string) {
    try {
      return await this.webjsService.getSessionDiagnostics(sessionId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get session diagnostics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('sessions/:sessionId/restore')
  @ApiOperation({
    summary: 'Restore session from database',
    description: 'Manually restore a session that exists in database but is not active in memory. Useful after server restarts.'
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session ID to restore',
    example: 'user_123456789'
  })
  @ApiResponse({
    status: 200,
    description: 'Session restored successfully',
    example: {
      success: true,
      message: 'Session restored successfully',
      session_id: 'user_123456789',
      status: 'READY'
    }
  })
  async restoreSession(@Param('sessionId') sessionId: string) {
    try {
      const result = await this.webjsService.restoreSession(sessionId);
      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to restore session',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('health')
  @ApiOperation({
    summary: 'Health check for WhatsApp service',
    description: 'Returns the health status of the WhatsApp service including active sessions and memory usage.'
  })
  @ApiResponse({
    status: 200,
    description: 'Health check completed successfully',
    example: {
      status: 'healthy',
      timestamp: '2024-01-15T12:00:00Z',
      active_sessions: 5,
      total_sessions: 10,
      auth_method: 'LocalAuth',
      network_connectivity: true,
      auth_folder_status: true,
      memory_usage: {
        rss: 123456789,
        heapTotal: 87654321,
        heapUsed: 65432109,
        external: 12345678
      },
      uptime: 3600
    }
  })
  async healthCheck() {
    try {
      const activeSessions = this.webjsService.getActiveSessions();
      const totalSessions = await this.webjsService.getTotalSessionsCount();
      const networkStatus = await this.webjsService.testNetworkConnectivity();
      const authFolderStatus = await this.webjsService.checkAuthFolderStatus();

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        active_sessions: activeSessions.length,
        total_sessions: totalSessions,
        auth_method: 'LocalAuth',
        network_connectivity: networkStatus,
        auth_folder_status: authFolderStatus,
        memory_usage: process.memoryUsage(),
        uptime: process.uptime()
      };
    } catch (error) {
      throw new HttpException(
        'Health check failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('recovery/auth')
  @ApiOperation({
    summary: 'Perform authentication recovery',
    description: 'Manually trigger authentication recovery process. Useful when authentication files are missing or corrupted.'
  })
  @ApiResponse({
    status: 200,
    description: 'Recovery process completed',
    example: {
      success: true,
      totalSessions: 3,
      localRestored: 2,
      qrRegenerated: 1,
      failed: 0,
      duration: '5.2 seconds',
      results: [
        {
          sessionId: 'user_123',
          recoveryMethod: 'LOCAL_RESTORED',
          success: true
        }
      ]
    }
  })
  async performAuthRecovery() {
    try {
      return await this.webjsService.performManualAuthRecovery();
    } catch (error) {
      throw new HttpException(
        error.message || 'Authentication recovery failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('sessions/:sessionId/force-initialize')
  @ApiOperation({
    summary: 'Force initialize a stuck session',
    description: 'Forcefully initialize a session that is stuck in INITIALIZING state. This will reset the session and restart the initialization process.'
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session ID to force initialize',
    example: 'user_123456789'
  })
  @ApiResponse({
    status: 200,
    description: 'Session force initialization completed',
    example: {
      success: true,
      message: 'Session force initialized successfully',
      session_id: 'user_123456789',
      previous_status: 'INITIALIZING',
      new_status: 'QR_READY',
      qr_code: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCAYAAAB5fY51...'
    }
  })
  async forceInitializeSession(@Param('sessionId') sessionId: string) {
    try {
      return await this.webjsService.forceInitializeSession(sessionId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to force initialize session',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('sessions/:sessionId/smart-recovery')
  @ApiOperation({
    summary: 'Smart session recovery',
    description: 'Performs intelligent session recovery based on comprehensive diagnostics. Automatically determines the best recovery method (local restore, memory restore, or force recovery) based on session state analysis.'
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session ID to recover',
    example: 'user_123456789'
  })
  @ApiResponse({
    status: 200,
    description: 'Smart recovery completed',
    example: {
      success: true,
      method: 'LOCAL_RESTORE',
      message: 'Session restored from local auth storage',
      session_id: 'user_123456789',
      status: 'QR_READY',
      requires_qr_scan: true,
      diagnostics_summary: {
        issues: ['Local auth folder missing'],
        recommendations: ['Restore session from local auth storage'],
        syncStatus: 'PARTIAL_SYNC'
      }
    }
  })
  async smartRecoverySession(@Param('sessionId') sessionId: string) {
    try {
      return await this.webjsService.smartRecoverySession(sessionId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Smart recovery failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
