import { WhatsAppSessionStatus } from '@prisma/client';

export class SessionStatusDto {
  id: string;
  user_id: string;
  session_id: string;
  session_name?: string;
  phone_number?: string;
  is_authenticated: boolean;
  is_ready: boolean;
  qr_code?: string;
  status: WhatsAppSessionStatus;
  last_activity?: Date;
  created_at: Date;
  updated_at: Date;
}

export class QRCodeResponseDto {
  session_id: string;
  qr_code: string;
  status: WhatsAppSessionStatus;
}

export class SessionListDto {
  sessions: SessionStatusDto[];
  total: number;
}
