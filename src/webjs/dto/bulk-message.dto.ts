import { IsArray, IsString, IsOptional, ValidateNested, ArrayMaxSize, ArrayMinSize, Matches, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class BulkMessageItem {
  @ApiProperty({
    description: 'Recipient phone number in international format',
    example: '+919370928324',
    pattern: '^\\+[1-9]\\d{1,14}$'
  })
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone number must be in international format (+country_code followed by number)'
  })
  to: string;

  @ApiProperty({
    description: 'Message content to send',
    example: 'Hey did you check the message?',
    maxLength: 4096
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Optional media URLs to send with the message',
    example: ['https://example.com/image.jpg'],
    required: false,
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  media_urls?: string[];
}

export class SendBulkMessageDto {
  @ApiProperty({
    description: 'Array of messages to send',
    type: [BulkMessageItem],
    example: [
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
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one message is required' })
  @ArrayMaxSize(50, { message: 'Maximum 50 messages allowed per request' })
  @ValidateNested({ each: true })
  @Type(() => BulkMessageItem)
  messages: BulkMessageItem[];
}

export class BulkMessageResult {
  @ApiProperty({
    description: 'Recipient phone number',
    example: '+919370928324'
  })
  to: string;

  @ApiProperty({
    description: 'Status of the message send attempt',
    enum: ['success', 'failed'],
    example: 'success'
  })
  status: 'success' | 'failed';

  @ApiProperty({
    description: 'WhatsApp message ID (only present on success)',
    example: 'wamid.HBgNOTE5ODc2NTQzMjEwFQIAERgSMkE4OEJDMEM4RjA4NzY4OTMA',
    required: false
  })
  message_id?: string;

  @ApiProperty({
    description: 'Error message (only present on failure)',
    example: 'Invalid phone number format',
    required: false
  })
  error?: string;

  @ApiProperty({
    description: 'Timestamp of the send attempt',
    example: '2024-01-15T12:00:00Z'
  })
  timestamp: string;
}

export class SendBulkMessageResponseDto {
  @ApiProperty({
    description: 'Overall success status',
    example: true
  })
  success: boolean;

  @ApiProperty({
    description: 'Total number of messages in the request',
    example: 3
  })
  total_messages: number;

  @ApiProperty({
    description: 'Number of successfully sent messages',
    example: 2
  })
  successful_sends: number;

  @ApiProperty({
    description: 'Number of failed message sends',
    example: 1
  })
  failed_sends: number;

  @ApiProperty({
    description: 'Detailed results for each message',
    type: [BulkMessageResult]
  })
  results: BulkMessageResult[];

  @ApiProperty({
    description: 'Session ID used for sending',
    example: 'user_123456789'
  })
  session_id: string;

  @ApiProperty({
    description: 'Total time taken for bulk operation',
    example: '5.2 seconds'
  })
  duration: string;
}
