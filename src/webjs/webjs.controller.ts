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
import { SessionStatusDto, QRCodeResponseDto, SessionListDto } from './dto/session-status.dto';

@ApiTags('WhatsApp Web Sessions')
@Controller('webjs')
@ApiExtraModels(SessionStatusDto, QRCodeResponseDto, SessionListDto)
export class WebjsController {
  constructor(private readonly webjsService: WebjsService) { }

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
    description: 'Initializes the WhatsApp Web client for a session. This will generate a QR code for authentication.'
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
    description: 'Retrieves the QR code that needs to be scanned with WhatsApp mobile app for authentication.'
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
      throw new HttpException(
        error.message || 'Failed to send message',
        HttpStatus.BAD_REQUEST,
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
    description: 'Permanently deletes a WhatsApp session and cleans up all associated resources.'
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session ID (same as user ID)',
    example: 'user_123456789'
  })
  @ApiResponse({
    status: 200,
    description: 'Session deleted successfully',
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
}
