import { IsString, IsOptional, IsArray } from 'class-validator';

export class SendMessageDto {
  @IsString()
  session_id: string;

  @IsString()
  to: string; // Phone number with country code

  @IsString()
  message: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  media_urls?: string[]; // URLs to media files
}

export class SendMessageResponseDto {
  success: boolean;
  message_id?: string;
  error?: string;
}
