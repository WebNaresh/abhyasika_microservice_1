import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { TokenExpiredError } from 'jsonwebtoken';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    console.log(
      `🚀 ~ file: exception.filter.ts:13 ~ AllExceptionsFilter ~ exception:`,
      exception,
    );
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Default error message for server-side errors
    let message = 'An unexpected error occurred. Please try again later.';

    // Handle specific HttpExceptions thrown by Guards
    if (exception instanceof UnauthorizedException) {
      message = 'Unauthorized access. Please log in.';
      status = HttpStatus.UNAUTHORIZED; // 401 Unauthorized
    } else if (exception instanceof TokenExpiredError) {
      message = 'Session expired. Please log in again.';
      status = HttpStatus.UNAUTHORIZED; // 401 Unauthorized
    } else if (exception instanceof ForbiddenException) {
      message =
        'Access denied. You do not have permission to perform this action.';
      status = HttpStatus.FORBIDDEN; // 403 Forbidden
    } else if (exception instanceof NotFoundException) {
      // Handle 404 Not Found exception with specific message check
      const errorMessage = exception.message;

      // Custom handling for specific "User not found" case
      if (errorMessage.includes('User not found in interested list')) {
        message = 'The specified user is not in the interested list.';
      } else {
        message = `The resource was not found.`;
      }

      status = HttpStatus.NOT_FOUND; // 404 Not Found
    }
    // Custom handling for Prisma errors
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': // Unique constraint failed
          const target = (exception.meta?.target as string[]) ?? [];
          const uniqueField = target.join(', ');
          message = `A record with this ${uniqueField} already exists.`;
          status = HttpStatus.CONFLICT; // 409 Conflict
          break;
        case 'P2003': // Foreign key constraint failed
          message = 'Foreign key constraint violation.';
          status = HttpStatus.BAD_REQUEST; // 400 Bad Request
          break;
        case 'P2025': // Record not found
          message =
            'The record you are trying to update or delete does not exist.';
          status = HttpStatus.NOT_FOUND; // 404 Not Found
          break;
        default:
          message = 'A database error occurred.';
          break;
      }
    } else if (exception instanceof HttpException) {
      console.log(
        `🚀 ~ file: prisma-client-exception.filter.ts:91 ~ AllExceptionsFilter ~ exception:`,
        exception,
      );
      if (exception instanceof BadRequestException) {
        console.log('i am here1');
        exception = exception as BadRequestException;
        message = exception.response.message.join(', ');
        console.log(`🚀 ~ file: prisma-client-exception.filter.ts:85 ~ AllExceptionsFilter ~ message:`, message)
        status = exception.getStatus
          ? exception.getStatus()
          : HttpStatus.BAD_REQUEST;
        return response.status(status).json({
          statusCode: status,
          timestamp: new Date().toISOString(),
          message: message,
          path: request.url,
        });
      }

      console.log('i am here', (exception.getResponse() as any).message);
      if (exception.message) {
        message = exception.message;
        status = exception.getStatus
          ? exception.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;
      } else if (Array.isArray((exception.getResponse() as any).message)) {
        message = (exception.getResponse() as any).message.join(', ');
      } else {
        message = (exception.getResponse() as any).message || 'Unknown error';
      }

      // Other HttpExceptions
      // message = exception.message;
    } else if (exception.response) {
      console.log('i am here2');

      // Handle non-HttpException responses, like validation errors
      if (Array.isArray(exception.response.message)) {
        message = exception.response.message.join(', ');
      } else {
        message = exception.response.message || 'Unknown error';
      }
    } else if (exception instanceof TypeError) {
      // Handle TypeError for null property access
      message = 'A server error occurred. Please check your request and try again.';
      status = HttpStatus.BAD_REQUEST; // 400 Bad Request
    }

    // Send the error response
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: message,
    });
  }
}
