import { Client } from 'whatsapp-web.js';
import { WhatsAppSessionStatus } from '@prisma/client';

export interface WhatsAppClientInstance {
  client: Client;
  sessionId: string;
  userId: string;
  status: WhatsAppSessionStatus;
  isReady: boolean;
  isAuthenticated: boolean;
  phoneNumber?: string;
  lastActivity: Date;
}

export interface SessionEventHandlers {
  onQR: (qr: string) => void;
  onReady: () => void;
  onAuthenticated: () => void;
  onDisconnected: (reason: string) => void;
  onAuthFailure: (message: string) => void;
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: number;
  type: string;
  hasMedia: boolean;
}

export interface S3SessionStore {
  sessionExists: (sessionId: string) => Promise<boolean>;
  saveSession: (sessionId: string, sessionData: any) => Promise<void>;
  getSession: (sessionId: string) => Promise<any>;
  deleteSession: (sessionId: string) => Promise<void>;
}
