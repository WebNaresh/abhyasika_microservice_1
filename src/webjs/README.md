# WhatsApp Web Integration Module

This module provides comprehensive WhatsApp Web integration for the Abhyasika microservice using `whatsapp-web.js` with AWS S3 session storage.

## 🚀 Features

- **One Session Per User**: Each user connects one WhatsApp account at a time (simplified design)
- **Persistent Sessions**: Sessions are stored on AWS S3 for persistence across server restarts
- **Session Management**: Create, initialize, monitor, and destroy WhatsApp sessions
- **Message Sending**: Send text and media messages through authenticated sessions
- **QR Code Authentication**: Generate QR codes for WhatsApp Web authentication
- **Real-time Status Updates**: Track session status and authentication state
- **Comprehensive API**: RESTful endpoints with full Swagger documentation
- **Error Handling**: Robust error handling with detailed error messages

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Installation & Setup](#installation--setup)
3. [Environment Variables](#environment-variables)
4. [API Documentation](#api-documentation)
5. [Usage Flow](#usage-flow)
6. [Step-by-Step Guide](#step-by-step-guide)
7. [Error Handling](#error-handling)
8. [Troubleshooting](#troubleshooting)
9. [Database Schema](#database-schema)
10. [Integration Examples](#integration-examples)
11. [Performance Considerations](#performance-considerations)
12. [Best Practices](#best-practices)

## 🚀 Quick Start

```bash
# 1. Create a session for a user
curl -X POST http://localhost:3000/webjs/sessions \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user_123456789"}'

# 2. Initialize the WhatsApp client
curl -X POST http://localhost:3000/webjs/sessions/user_123456789/initialize

# 3. Get QR code for scanning
curl http://localhost:3000/webjs/sessions/user_123456789/qr

# 4. Check session status
curl http://localhost:3000/webjs/sessions/user_123456789/status

# 5. Send a message (after QR code is scanned)
curl -X POST http://localhost:3000/webjs/sessions/user_123456789/send-message \
  -H "Content-Type: application/json" \
  -d '{"to": "919876543210", "message": "Hello from Abhyasika!"}'
```

## 🛠 Installation & Setup

### Prerequisites

- Node.js 16+ and npm
- PostgreSQL database
- AWS S3 bucket for session storage
- WhatsApp mobile app for QR code scanning

### Installation Steps

1. **Install Dependencies** (already included in your project):

   ```bash
   npm install whatsapp-web.js wwebjs-aws-s3
   ```

2. **Database Migration**:

   ```bash
   npx prisma db push
   ```

3. **Environment Configuration** (see [Environment Variables](#environment-variables))

4. **Start the Application**:

   ```bash
   npm run start:dev
   ```

5. **Access Swagger Documentation**:
   Visit `http://localhost:3000/api` to see the interactive API documentation.

## 🔧 Environment Variables

Add these to your `.env` file:

```env
# AWS S3 Configuration (Required)
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_S3_REGION=us-east-1
AWS_BUCKET_NAME=your-whatsapp-sessions-bucket

# Database (Already configured)
POSTGRES_URL=your_postgres_connection_string

# Optional: Puppeteer Configuration
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser  # For production
```

### AWS S3 Setup

1. Create an S3 bucket for WhatsApp sessions
2. Create an IAM user with S3 permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:GetObject",
           "s3:PutObject",
           "s3:DeleteObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::your-bucket-name",
           "arn:aws:s3:::your-bucket-name/*"
         ]
       }
     ]
   }
   ```

## 📚 API Documentation

All endpoints are documented with Swagger/OpenAPI. Visit `/api` for interactive documentation.

#### 🔐 Create Session

**POST** `/webjs/sessions`

Creates a new WhatsApp session for a user. Only one session per user allowed.

**Request:**

```json
{
  "user_id": "user_123456789"
}
```

**Response (201):**

```json
{
  "id": "session_abc123",
  "user_id": "user_123456789",
  "session_id": "user_123456789",
  "session_name": "WhatsApp for John Doe",
  "status": "INITIALIZING",
  "is_authenticated": false,
  "is_ready": false,
  "created_at": "2024-01-15T10:30:00Z"
}
```

#### ⚡ Initialize Client

**POST** `/webjs/sessions/{sessionId}/initialize`

Starts the WhatsApp client and generates QR code. The response will either include the QR code immediately or you'll need to call the `/qr` endpoint.

**Response (200) - QR Code Ready:**

```json
{
  "session_id": "user_123456789",
  "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCAYAAAB5fY51...",
  "status": "QR_READY"
}
```

**Response (200) - Still Initializing:**

```json
{
  "session_id": "user_123456789",
  "qr_code": "",
  "status": "INITIALIZING"
}
```

#### 📱 Get QR Code

**GET** `/webjs/sessions/{sessionId}/qr`

Retrieves the QR code for WhatsApp authentication. If the QR code is not ready yet, this endpoint will wait up to 30 seconds for it to be generated.

**Response (200):**

```json
{
  "session_id": "user_123456789",
  "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCAYAAAB5fY51...",
  "status": "QR_READY"
}
```

#### 📊 Get Session Status

**GET** `/webjs/sessions/{sessionId}/status`

**Response (200):**

```json
{
  "id": "session_abc123",
  "user_id": "user_123456789",
  "session_id": "user_123456789",
  "phone_number": "919876543210",
  "is_authenticated": true,
  "is_ready": true,
  "status": "READY",
  "last_activity": "2024-01-15T11:45:00Z"
}
```

#### 💬 Send Message

**POST** `/webjs/sessions/{sessionId}/send-message`

**Text Message:**

```json
{
  "to": "919876543210",
  "message": "Hello! Welcome to Abhyasika."
}
```

**Media Message:**

```json
{
  "to": "919876543210",
  "message": "Here's your document",
  "media_urls": ["https://example.com/document.pdf"]
}
```

**Response (200):**

```json
{
  "success": true,
  "message_id": "wamid.HBgNOTE5ODc2NTQzMjEwFQIAERgSMkE4OEJDMEM4RjA4NzY4OTMA"
}
```

#### 📤 Send Bulk Messages

**POST** `/webjs/sessions/{sessionId}/send-bulk-messages`

Send multiple personalized messages to different recipients in a single request.

**Features:**

- ✅ **Rate Limiting**: 1-2 second delays between messages
- ✅ **Error Handling**: Continue sending even if some fail
- ✅ **Media Support**: Include images, documents, etc.
- ✅ **Validation**: International phone number format required
- ✅ **Audit Logging**: All attempts logged for tracking
- ✅ **Limit**: Maximum 50 messages per request

**Request Body:**

```json
{
  "messages": [
    {
      "to": "+919370928324",
      "message": "Hey did you check the message?"
    },
    {
      "to": "+919876543210",
      "message": "Your payment is due tomorrow"
    },
    {
      "to": "+918765432109",
      "message": "Meeting scheduled for 3 PM",
      "media_urls": ["https://example.com/meeting-agenda.pdf"]
    }
  ]
}
```

**Response (200):**

```json
{
  "success": true,
  "total_messages": 3,
  "successful_sends": 2,
  "failed_sends": 1,
  "results": [
    {
      "to": "+919370928324",
      "status": "success",
      "message_id": "wamid.xxx",
      "timestamp": "2024-01-15T12:00:00Z"
    },
    {
      "to": "+919876543210",
      "status": "failed",
      "error": "Invalid phone number format",
      "timestamp": "2024-01-15T12:00:01Z"
    },
    {
      "to": "+918765432109",
      "status": "success",
      "message_id": "wamid.yyy",
      "timestamp": "2024-01-15T12:00:03Z"
    }
  ],
  "session_id": "user_123456789",
  "duration": "5.2 seconds"
}
```

#### 🔄 Restart Session

**POST** `/webjs/sessions/{sessionId}/restart`

Destroys and reinitializes a session when it's stuck.

#### 🗑️ Delete Session

**DELETE** `/webjs/sessions/{sessionId}`

Permanently deletes a session and cleans up resources.

#### 👤 Get User Session

**GET** `/webjs/users/{userId}/session`

Gets the active session for a user (recommended for one-session-per-user design).

## 🔄 Usage Flow

### Complete Workflow Diagram

```
1. Create Session     → INITIALIZING
2. Initialize Client  → QR_READY (QR code generated)
3. User Scans QR     → AUTHENTICATED
4. Client Ready      → READY (can send messages)
5. Send Messages     → Active messaging
6. Session Cleanup   → DESTROYED
```

### Session States

| State           | Description                          | Next Actions           |
| --------------- | ------------------------------------ | ---------------------- |
| `INITIALIZING`  | Session created, client starting     | Wait for QR code       |
| `QR_READY`      | QR code available for scanning       | Scan with WhatsApp app |
| `AUTHENTICATED` | QR scanned successfully              | Wait for client ready  |
| `READY`         | Fully operational, can send messages | Send messages          |
| `DISCONNECTED`  | Connection lost                      | Restart session        |
| `DESTROYED`     | Session permanently deleted          | Create new session     |

## 📖 Step-by-Step Guide

### Complete Integration Example

Here's a real-world example of integrating WhatsApp messaging into your application:

```typescript
// 1. Create and setup a session
async function setupWhatsAppForUser(userId: string): Promise<string> {
  try {
    // Create session
    const response = await fetch('/webjs/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });

    if (!response.ok) {
      throw new Error('Failed to create session');
    }

    const session = await response.json();
    console.log('Session created:', session.session_id);

    // Initialize client
    await fetch(`/webjs/sessions/${session.session_id}/initialize`, {
      method: 'POST',
    });

    console.log('Client initializing... QR code will be available soon');
    return session.session_id;
  } catch (error) {
    console.error('Setup failed:', error);
    throw error;
  }
}

// 2. Wait for QR code and handle authentication
async function waitForAuthentication(sessionId: string): Promise<boolean> {
  const maxAttempts = 24; // 2 minutes (5s intervals)
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`/webjs/sessions/${sessionId}/status`);
      const status = await response.json();

      if (status.status === 'READY') {
        console.log('✅ WhatsApp authenticated and ready!');
        return true;
      }

      if (status.status === 'QR_READY' && attempts === 0) {
        // Get and display QR code (first time only)
        const qrResponse = await fetch(`/webjs/sessions/${sessionId}/qr`);
        const qrData = await qrResponse.json();
        console.log('📱 Scan this QR code with WhatsApp:', qrData.qr_code);
      }

      console.log(`⏳ Status: ${status.status}, waiting...`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;
    } catch (error) {
      console.error('Status check failed:', error);
      attempts++;
    }
  }

  console.log('❌ Authentication timeout');
  return false;
}

// 3. Send messages
async function sendWelcomeMessage(
  sessionId: string,
  phoneNumber: string,
  userName: string,
): Promise<boolean> {
  try {
    const response = await fetch(`/webjs/sessions/${sessionId}/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: phoneNumber,
        message: `Hello ${userName}! 🎉\n\nWelcome to Abhyasika! Your account has been created successfully.\n\nYou can now access all our study materials and book your seat.\n\nIf you have any questions, feel free to reply to this message.\n\nBest regards,\nAbhyasika Team`,
      }),
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Welcome message sent successfully!');
      return true;
    } else {
      console.error('❌ Failed to send message:', result.error);
      return false;
    }
  } catch (error) {
    console.error('Send message error:', error);
    return false;
  }
}

// 4. Complete workflow
async function completeWhatsAppSetup(
  userId: string,
  phoneNumber: string,
  userName: string,
) {
  console.log(`🚀 Setting up WhatsApp for user: ${userId}`);

  try {
    // Step 1: Setup session
    const sessionId = await setupWhatsAppForUser(userId);

    // Step 2: Wait for authentication
    const isAuthenticated = await waitForAuthentication(sessionId);

    if (!isAuthenticated) {
      throw new Error('WhatsApp authentication failed or timed out');
    }

    // Step 3: Send welcome message
    const messageSent = await sendWelcomeMessage(
      sessionId,
      phoneNumber,
      userName,
    );

    if (messageSent) {
      console.log('🎉 WhatsApp setup completed successfully!');
    } else {
      console.log('⚠️ Setup completed but welcome message failed');
    }
  } catch (error) {
    console.error('❌ WhatsApp setup failed:', error);

    // Cleanup on failure
    try {
      await fetch(`/webjs/sessions/${userId}`, { method: 'DELETE' });
      console.log('🧹 Cleaned up failed session');
    } catch (cleanupError) {
      console.error('Cleanup failed:', cleanupError);
    }
  }
}
```

### Timing Considerations

- **QR Code Generation**: Usually takes 2-5 seconds after initialization
- **Authentication**: User has ~20 seconds to scan QR before it expires
- **Session Ready**: Takes 3-10 seconds after QR scan
- **Message Sending**: Usually instant once session is ready
- **Session Persistence**: Sessions remain active for weeks if not disconnected

### Real-World Usage Patterns

```typescript
// Pattern 1: Send admission confirmation
async function sendAdmissionConfirmation(
  userId: string,
  admissionDetails: any,
) {
  const session = await getUserActiveSession(userId);

  if (!session || session.status !== 'READY') {
    throw new Error('WhatsApp not connected for this user');
  }

  const message = `🎓 Admission Confirmed!\n\nDear ${admissionDetails.studentName},\n\nYour admission to ${admissionDetails.libraryName} has been confirmed.\n\n📅 Start Date: ${admissionDetails.startDate}\n💺 Seat: ${admissionDetails.seatNumber}\n💰 Fee: ₹${admissionDetails.fee}\n\nWelcome to Abhyasika! 🎉`;

  return await sendMessage(
    session.session_id,
    admissionDetails.phoneNumber,
    message,
  );
}

// Pattern 2: Send payment reminders
async function sendPaymentReminder(userId: string, paymentDetails: any) {
  const session = await getUserActiveSession(userId);

  if (!session?.is_ready) {
    console.log(`WhatsApp not available for user ${userId}, skipping reminder`);
    return false;
  }

  const message = `💰 Payment Reminder\n\nDear ${paymentDetails.studentName},\n\nYour payment of ₹${paymentDetails.amount} is due on ${paymentDetails.dueDate}.\n\nPlease make the payment to continue your services.\n\nThank you!`;

  return await sendMessage(
    session.session_id,
    paymentDetails.phoneNumber,
    message,
  );
}

// Pattern 3: Bulk messaging with rate limiting
async function sendBulkMessages(
  messages: Array<{ userId: string; phoneNumber: string; message: string }>,
) {
  const results = [];

  for (const msg of messages) {
    try {
      const session = await getUserActiveSession(msg.userId);

      if (session?.is_ready) {
        const result = await sendMessage(
          session.session_id,
          msg.phoneNumber,
          msg.message,
        );
        results.push({ ...msg, success: result.success });

        // Rate limiting: Wait 1 second between messages
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        results.push({ ...msg, success: false, error: 'Session not ready' });
      }
    } catch (error) {
      results.push({ ...msg, success: false, error: error.message });
    }
  }

  return results;
}
```

## ⚠️ Error Handling

### Common Error Scenarios

#### 1. Session Creation Errors

```json
// Error: User already has active session
{
  "statusCode": 400,
  "message": "User already has an active WhatsApp session. Please delete the existing session first.",
  "error": "Bad Request"
}

// Solution: Delete existing session first
DELETE /webjs/sessions/{userId}
```

#### 2. Authentication Errors

```json
// Error: QR code expired
{
  "statusCode": 400,
  "message": "QR code not available. Please initialize the client first.",
  "error": "Bad Request"
}

// Solution: Restart the session
POST /webjs/sessions/{sessionId}/restart
```

#### 3. Message Sending Errors

```json
// Error: Session not ready
{
  "statusCode": 400,
  "message": "Client is not ready. Please ensure the session is authenticated and ready.",
  "error": "Bad Request"
}

// Solution: Check session status and wait for READY state
GET /webjs/sessions/{sessionId}/status
```

#### 4. Network/Connection Errors

```json
// Error: Session disconnected
{
  "success": false,
  "error": "Session is disconnected"
}

// Solution: Restart session or check network connectivity
POST /webjs/sessions/{sessionId}/restart
```

### Error Handling Best Practices

```typescript
async function robustMessageSending(
  sessionId: string,
  phoneNumber: string,
  message: string,
  maxRetries = 3,
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check session status first
      const statusResponse = await fetch(`/webjs/sessions/${sessionId}/status`);
      const status = await statusResponse.json();

      if (status.status !== 'READY') {
        if (status.status === 'DISCONNECTED') {
          console.log(
            `Attempt ${attempt}: Session disconnected, restarting...`,
          );
          await fetch(`/webjs/sessions/${sessionId}/restart`, {
            method: 'POST',
          });
          await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10s
          continue;
        } else {
          throw new Error(`Session not ready: ${status.status}`);
        }
      }

      // Send message
      const response = await fetch(
        `/webjs/sessions/${sessionId}/send-message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: phoneNumber, message }),
        },
      );

      const result = await response.json();

      if (result.success) {
        console.log(`✅ Message sent successfully on attempt ${attempt}`);
        return result;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        throw new Error(
          `Failed to send message after ${maxRetries} attempts: ${error.message}`,
        );
      }

      // Wait before retry (exponential backoff)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, attempt) * 1000),
      );
    }
  }
}
```

## 🔧 Troubleshooting

### Common Issues and Solutions

#### Issue 1: Chromium/Browser Not Found

**Symptoms:**

- Error: "Could not find expected browser (chrome) locally"
- Session fails to initialize

**Solutions:**

1. Install Chromium for Puppeteer:
   ```bash
   npx puppeteer browsers install chrome
   ```
2. Or set custom browser path:
   ```env
   PUPPETEER_EXECUTABLE_PATH=/path/to/chrome
   ```
3. Test the setup:
   ```bash
   node src/webjs/test-whatsapp.js
   ```

#### Issue 2: User Already Has Active Session

**Symptoms:**

- Error: "User already has an active WhatsApp session"
- Cannot create new session

**Solutions:**

1. **Automatic (Recommended)**: The system now automatically deletes old sessions when creating new ones
2. **Manual**: Delete user's sessions first:

   ```bash
   # Delete all sessions for a user
   curl -X DELETE http://localhost:3000/webjs/users/{userId}/sessions

   # Or delete specific session
   curl -X DELETE http://localhost:3000/webjs/sessions/{sessionId}
   ```

#### Issue 3: QR Code Not Generating

**Symptoms:**

- Session stuck in `INITIALIZING` state
- QR endpoint returns empty or error

**Solutions:**

1. Check AWS S3 permissions and connectivity
2. Verify environment variables are set correctly
3. Restart the session:
   ```bash
   curl -X POST http://localhost:3000/webjs/sessions/{sessionId}/restart
   ```

#### Issue 4: Authentication Timeout

**Symptoms:**

- QR code generated but session never reaches `READY` state
- User scanned QR but authentication failed

**Solutions:**

1. Ensure QR code is scanned within 20 seconds
2. Check if WhatsApp Web is already active on another device
3. Try logging out of WhatsApp Web on other devices
4. Restart session and try again

#### Issue 3: Messages Not Sending

**Symptoms:**

- Session shows `READY` but messages fail
- `success: false` in response

**Solutions:**

1. Verify phone number format (include country code: `919876543210`)
2. Check if the number is registered on WhatsApp
3. Ensure session hasn't been disconnected:
   ```bash
   curl http://localhost:3000/webjs/sessions/{sessionId}/status
   ```

#### Issue 4: Session Keeps Disconnecting

**Symptoms:**

- Session frequently changes to `DISCONNECTED` state
- Need to restart session often

**Solutions:**

1. Check server stability and memory usage
2. Verify AWS S3 connectivity is stable
3. Consider implementing auto-restart logic:

   ```typescript
   // Auto-restart disconnected sessions
   setInterval(async () => {
     const activeSessions = await fetch('/webjs/sessions/active').then((r) =>
       r.json(),
     );

     for (const sessionId of activeSessions.active_sessions) {
       const status = await fetch(`/webjs/sessions/${sessionId}/status`).then(
         (r) => r.json(),
       );

       if (status.status === 'DISCONNECTED') {
         console.log(`Auto-restarting disconnected session: ${sessionId}`);
         await fetch(`/webjs/sessions/${sessionId}/restart`, {
           method: 'POST',
         });
       }
     }
   }, 60000); // Check every minute
   ```

#### Issue 5: High Memory Usage

**Symptoms:**

- Server memory usage increases over time
- Performance degradation

**Solutions:**

1. Implement session cleanup for inactive users
2. Monitor and limit concurrent sessions
3. Add memory monitoring:

   ```typescript
   // Cleanup inactive sessions (run daily)
   async function cleanupInactiveSessions() {
     const allSessions = await databaseService.whatsAppSession.findMany({
       where: {
         last_activity: {
           lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
         },
       },
     });

     for (const session of allSessions) {
       await webjsService.deleteSession(session.session_id);
       console.log(`Cleaned up inactive session: ${session.session_id}`);
     }
   }
   ```

### Debug Mode

Enable debug logging by setting environment variable:

```env
DEBUG=whatsapp-web.js:*
```

### Health Check Endpoint

**GET** `/webjs/health`

Returns comprehensive service health status including authentication folder integrity:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T12:00:00Z",
  "active_sessions": 2,
  "total_sessions": 5,
  "s3_connection": true,
  "network_connectivity": true,
  "auth_folder_status": true,
  "memory_usage": {
    "rss": 123456789,
    "heapTotal": 87654321,
    "heapUsed": 65432109,
    "external": 12345678
  },
  "uptime": 3600
}
```

### Authentication Recovery Endpoint

**POST** `/webjs/recovery/auth`

Manually trigger authentication recovery process when authentication files are missing:

```json
{
  "success": true,
  "totalSessions": 3,
  "s3Restored": 2,
  "qrRegenerated": 1,
  "failed": 0,
  "duration": "5.2 seconds",
  "results": [
    {
      "sessionId": "user_123",
      "recoveryMethod": "S3_RESTORED",
      "success": true
    },
    {
      "sessionId": "user_456",
      "recoveryMethod": "QR_REGENERATED",
      "success": true,
      "requiresQRScan": true
    }
  ]
}
```

## � Recent Fixes & Improvements

### Database Error Handling (P2025 Fix)

The service now includes robust error handling for database operations:

- **Safe Update Operations**: All database updates use `safeUpdateSession()` method that gracefully handles missing records
- **Orphaned Client Cleanup**: Automatic cleanup of in-memory client instances when database records are deleted
- **Periodic Maintenance**: Background task runs every 5 minutes to clean up orphaned clients
- **Event Handler Protection**: All WhatsApp event handlers now handle database record deletion gracefully

### Auto-Session Management

- **Automatic Cleanup**: When creating a new session, existing sessions are automatically deleted
- **Bulk Deletion**: New endpoint `DELETE /webjs/users/{userId}/sessions` for cleaning up all user sessions
- **Consistent State**: In-memory client instances and database records are kept in sync

### S3 Session Storage Fix

- **Custom S3 Store**: Replaced problematic `wwebjs-aws-s3` package with custom AWS SDK v3 compatible store
- **AWS SDK v3 Support**: Full compatibility with latest AWS SDK v3 (`@aws-sdk/client-s3`)
- **Connection Testing**: Built-in S3 connection testing and health monitoring
- **Session Persistence**: Reliable session storage and retrieval from AWS S3
- **Error Handling**: Comprehensive error handling for S3 operations

### Authentication Recovery System

- **Automatic Detection**: Detects missing `.wwebjs_auth` folders on startup
- **S3 Restoration**: Attempts to restore sessions from S3 storage first
- **QR Fallback**: Generates new QR codes if S3 restoration fails
- **Smart Recovery**: Different recovery strategies based on session status
- **Resilient Deployment**: Handles server redeployments and auth folder deletion
- **Manual Recovery**: API endpoint for manual recovery triggering

### Error Recovery

- **Circuit Breaker Pattern**: Prevents cascading failures when database operations fail
- **Graceful Degradation**: Service continues to function even when some database operations fail
- **Comprehensive Logging**: Detailed logging for troubleshooting and monitoring

## �🗄️ Database Schema

### WhatsAppSession Model

```prisma
model WhatsAppSession {
  id               String                @id @default(cuid())
  user_id          String                // Foreign key to User
  user             User                  @relation(fields: [user_id], references: [id], onDelete: Cascade)
  session_id       String                @unique // Same as user_id for one-session-per-user
  session_name     String?               // Auto-generated: "WhatsApp for {firstName} {lastName}"
  phone_number     String?               // WhatsApp phone number after authentication
  is_authenticated Boolean               @default(false)
  is_ready         Boolean               @default(false)
  qr_code          String?               // Base64 QR code for authentication
  status           WhatsAppSessionStatus @default(INITIALIZING)
  s3_session_key   String?               // S3 key for session data storage
  last_activity    DateTime?             // Last message sent or activity
  created_at       DateTime              @default(now())
  updated_at       DateTime              @updatedAt

  @@index([user_id])
  @@index([session_id])
  @@index([status])
}

enum WhatsAppSessionStatus {
  INITIALIZING  // Session created, client starting
  QR_READY      // QR code generated and ready for scanning
  AUTHENTICATED // QR scanned, authentication successful
  READY         // Fully operational, can send messages
  DISCONNECTED  // Connection lost, needs restart
  DESTROYED     // Session permanently deleted
}
```

### Field Explanations

| Field              | Type      | Description                                        |
| ------------------ | --------- | -------------------------------------------------- |
| `user_id`          | String    | Links to User table, enforces one session per user |
| `session_id`       | String    | Unique identifier, same as user_id for simplicity  |
| `session_name`     | String?   | Human-readable name, auto-generated                |
| `phone_number`     | String?   | WhatsApp number, populated after authentication    |
| `is_authenticated` | Boolean   | True when QR code has been scanned                 |
| `is_ready`         | Boolean   | True when session can send messages                |
| `qr_code`          | String?   | Base64 QR code image, cleared after authentication |
| `status`           | Enum      | Current session state for workflow tracking        |
| `s3_session_key`   | String?   | AWS S3 path for session persistence                |
| `last_activity`    | DateTime? | Tracks session usage for cleanup                   |

## 🔗 Integration Examples

### Integration with Existing Services

#### 1. User Registration Flow

```typescript
// In your user registration service
@Injectable()
export class UserRegistrationService {
  constructor(
    private readonly webjsService: WebjsService,
    private readonly emailService: EmailService,
  ) {}

  async registerUser(userData: CreateUserDto): Promise<User> {
    // Create user account
    const user = await this.databaseService.user.create({
      data: userData,
    });

    // Setup WhatsApp session for new user
    try {
      await this.webjsService.createSession({ user_id: user.id });
      console.log(`WhatsApp session created for new user: ${user.id}`);
    } catch (error) {
      console.error('Failed to create WhatsApp session:', error);
      // Don't fail registration if WhatsApp setup fails
    }

    // Send welcome email with WhatsApp setup instructions
    await this.emailService.sendWelcomeEmail(user.email, {
      whatsappSetupUrl: `${process.env.FRONTEND_URL}/whatsapp-setup?userId=${user.id}`,
    });

    return user;
  }
}
```

#### 2. Admission Confirmation Integration

```typescript
// In your admission service
@Injectable()
export class AdmissionService {
  constructor(
    private readonly webjsService: WebjsService,
    private readonly messageQueue: Queue,
  ) {}

  async confirmAdmission(admissionData: AdmissionDto): Promise<void> {
    // Process admission
    const admission = await this.processAdmission(admissionData);

    // Queue WhatsApp notification
    await this.messageQueue.add('send-admission-confirmation', {
      userId: admission.userId,
      phoneNumber: admission.studentPhone,
      admissionDetails: admission,
    });
  }

  // Message queue processor
  @Process('send-admission-confirmation')
  async sendAdmissionConfirmation(job: Job) {
    const { userId, phoneNumber, admissionDetails } = job.data;

    try {
      // Check if user has active WhatsApp session
      const session = await this.webjsService.getUserSession(userId);

      if (!session || session.status !== 'READY') {
        console.log(
          `WhatsApp not ready for user ${userId}, skipping notification`,
        );
        return;
      }

      // Send admission confirmation
      const message = `🎓 Admission Confirmed!

Dear ${admissionDetails.studentName},

Your admission to ${admissionDetails.libraryName} has been confirmed.

📅 Start Date: ${admissionDetails.startDate}
💺 Seat: ${admissionDetails.seatNumber}
💰 Fee: ₹${admissionDetails.fee}

Welcome to Abhyasika! 🎉

For any queries, reply to this message.`;

      await this.webjsService.sendMessage({
        session_id: session.session_id,
        to: phoneNumber,
        message: message,
      });

      console.log(`Admission confirmation sent to ${phoneNumber}`);
    } catch (error) {
      console.error('Failed to send admission confirmation:', error);
      throw error; // Retry the job
    }
  }
}
```

#### 3. Payment Reminder System

```typescript
// Scheduled payment reminders
@Injectable()
export class PaymentReminderService {
  constructor(
    private readonly webjsService: WebjsService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Cron('0 9 * * *') // Daily at 9 AM
  async sendPaymentReminders() {
    console.log('Starting daily payment reminders...');

    // Get users with pending payments
    const pendingPayments = await this.databaseService.userCurrentPlan.findMany(
      {
        where: {
          end_date: {
            lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Due in 3 days
          },
          payment_status: 'PENDING',
        },
        include: {
          user: true,
          plan: true,
        },
      },
    );

    const results = [];

    for (const payment of pendingPayments) {
      try {
        const session = await this.webjsService.getUserSession(payment.user.id);

        if (session?.status === 'READY') {
          const message = `💰 Payment Reminder

Dear ${payment.user.first_name},

Your payment of ₹${payment.plan.price} is due on ${payment.end_date.toDateString()}.

Please make the payment to continue your services.

Pay now: ${process.env.FRONTEND_URL}/payment/${payment.id}

Thank you!`;

          const result = await this.webjsService.sendMessage({
            session_id: session.session_id,
            to: payment.user.whatsapp_no || payment.user.phone_no,
            message: message,
          });

          results.push({
            userId: payment.user.id,
            success: result.success,
            error: result.error,
          });

          // Rate limiting
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } else {
          results.push({
            userId: payment.user.id,
            success: false,
            error: 'WhatsApp session not ready',
          });
        }
      } catch (error) {
        results.push({
          userId: payment.user.id,
          success: false,
          error: error.message,
        });
      }
    }

    console.log('Payment reminders completed:', {
      total: pendingPayments.length,
      sent: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    });
  }
}
```

## ⚡ Performance Considerations

### Resource Management

1. **Memory Usage**: Each WhatsApp session uses ~50-100MB RAM
2. **Concurrent Sessions**: Limit to 50-100 concurrent sessions per server
3. **CPU Usage**: Puppeteer instances are CPU intensive during initialization
4. **Network**: Each session maintains persistent WebSocket connection

### Optimization Strategies

```typescript
// 1. Session pooling and limits
@Injectable()
export class SessionManager {
  private readonly MAX_CONCURRENT_SESSIONS = 50;
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  async createSessionWithLimits(userId: string) {
    const activeCount = this.webjsService.getActiveSessions().length;

    if (activeCount >= this.MAX_CONCURRENT_SESSIONS) {
      throw new Error(
        'Maximum concurrent sessions reached. Please try again later.',
      );
    }

    return await this.webjsService.createSession({ user_id: userId });
  }

  // 2. Automatic cleanup of idle sessions
  @Cron('*/15 * * * *') // Every 15 minutes
  async cleanupIdleSessions() {
    const cutoff = new Date(Date.now() - this.SESSION_TIMEOUT);

    const idleSessions = await this.databaseService.whatsAppSession.findMany({
      where: {
        last_activity: { lt: cutoff },
        status: { in: ['READY', 'AUTHENTICATED'] },
      },
    });

    for (const session of idleSessions) {
      await this.webjsService.destroySession(session.session_id);
      console.log(`Cleaned up idle session: ${session.session_id}`);
    }
  }
}

// 3. Message queue for bulk operations
@Injectable()
export class BulkMessageService {
  constructor(@InjectQueue('whatsapp-messages') private messageQueue: Queue) {}

  async queueBulkMessages(messages: BulkMessageDto[]) {
    // Add messages to queue with rate limiting
    for (const [index, message] of messages.entries()) {
      await this.messageQueue.add('send-message', message, {
        delay: index * 2000, // 2 second delay between messages
        attempts: 3,
        backoff: 'exponential',
      });
    }
  }
}
```

### Production Deployment

```yaml
# docker-compose.yml
version: '3.8'
services:
  whatsapp-service:
    image: your-app:latest
    environment:
      - NODE_ENV=production
      - PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: '2'
        reservations:
          memory: 2G
          cpus: '1'
    volumes:
      - /dev/shm:/dev/shm # Shared memory for Puppeteer
```

## 🎯 Best Practices

### 1. Security

```typescript
// Input validation
class PhoneNumberValidator {
  static validate(phoneNumber: string): boolean {
    // Validate international format
    const phoneRegex = /^[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  static sanitize(phoneNumber: string): string {
    // Remove all non-digits and ensure country code
    const cleaned = phoneNumber.replace(/\D/g, '');

    if (cleaned.startsWith('91') && cleaned.length === 12) {
      return cleaned; // Indian number with country code
    }

    if (cleaned.length === 10) {
      return '91' + cleaned; // Add Indian country code
    }

    throw new Error('Invalid phone number format');
  }
}

// Rate limiting
@Injectable()
export class RateLimitService {
  private readonly limits = new Map<string, number[]>();
  private readonly MAX_MESSAGES_PER_HOUR = 100;

  canSendMessage(sessionId: string): boolean {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;

    const timestamps = this.limits.get(sessionId) || [];
    const recentMessages = timestamps.filter((t) => t > hourAgo);

    if (recentMessages.length >= this.MAX_MESSAGES_PER_HOUR) {
      return false;
    }

    recentMessages.push(now);
    this.limits.set(sessionId, recentMessages);
    return true;
  }
}
```

### 2. Monitoring and Logging

```typescript
// Comprehensive logging
@Injectable()
export class WhatsAppLogger {
  private readonly logger = new Logger('WhatsApp');

  logSessionEvent(sessionId: string, event: string, data?: any) {
    this.logger.log(`Session ${sessionId}: ${event}`, data);
  }

  logMessageSent(
    sessionId: string,
    to: string,
    success: boolean,
    messageId?: string,
  ) {
    this.logger.log(
      `Message sent from ${sessionId} to ${to}: ${success ? 'SUCCESS' : 'FAILED'}`,
      {
        messageId,
        timestamp: new Date().toISOString(),
      },
    );
  }

  logError(sessionId: string, error: Error, context?: string) {
    this.logger.error(`Session ${sessionId} error in ${context}:`, error.stack);
  }
}

// Metrics collection
@Injectable()
export class MetricsService {
  private metrics = {
    sessionsCreated: 0,
    messagesSuccessful: 0,
    messagesFailed: 0,
    authenticationsSuccessful: 0,
    authenticationsFailed: 0,
  };

  incrementCounter(metric: keyof typeof this.metrics) {
    this.metrics[metric]++;
  }

  getMetrics() {
    return {
      ...this.metrics,
      timestamp: new Date().toISOString(),
    };
  }
}
```

### 3. Error Recovery

```typescript
// Circuit breaker pattern
@Injectable()
export class CircuitBreakerService {
  private failures = new Map<string, number>();
  private readonly FAILURE_THRESHOLD = 5;
  private readonly RESET_TIMEOUT = 60000; // 1 minute

  async executeWithCircuitBreaker<T>(
    sessionId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const failures = this.failures.get(sessionId) || 0;

    if (failures >= this.FAILURE_THRESHOLD) {
      throw new Error(`Circuit breaker open for session ${sessionId}`);
    }

    try {
      const result = await operation();
      this.failures.delete(sessionId); // Reset on success
      return result;
    } catch (error) {
      this.failures.set(sessionId, failures + 1);

      if (failures + 1 >= this.FAILURE_THRESHOLD) {
        // Auto-reset after timeout
        setTimeout(() => {
          this.failures.delete(sessionId);
        }, this.RESET_TIMEOUT);
      }

      throw error;
    }
  }
}
```

---

## 📞 Support

For issues and questions:

1. **Check Troubleshooting Section**: Most common issues are covered above
2. **Enable Debug Mode**: Set `DEBUG=whatsapp-web.js:*` for detailed logs
3. **Monitor Health Endpoint**: Use `/webjs/health` for system status
4. **Check AWS S3 Connectivity**: Verify S3 permissions and network access

## 📄 License

This WhatsApp Web integration is part of the Abhyasika microservice project.

- `QR_READY`: QR code is available for scanning
- `AUTHENTICATED`: User has scanned QR code successfully
- `READY`: Session is ready for messaging
- `DISCONNECTED`: Session has been disconnected
- `DESTROYED`: Session has been destroyed

## Environment Variables

Ensure these environment variables are set:

```
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_REGION=your_s3_region
AWS_BUCKET_NAME=your_s3_bucket_name
```

## Database Schema

The module uses a `WhatsAppSession` model to track session state:

```prisma
model WhatsAppSession {
  id               String                @id @default(cuid())
  user_id          String
  user             User                  @relation(fields: [user_id], references: [id], onDelete: Cascade)
  session_id       String                @unique
  session_name     String?
  phone_number     String?
  is_authenticated Boolean               @default(false)
  is_ready         Boolean               @default(false)
  qr_code          String?
  status           WhatsAppSessionStatus @default(INITIALIZING)
  s3_session_key   String?
  last_activity    DateTime?
  created_at       DateTime              @default(now())
  updated_at       DateTime              @updatedAt
}
```

## Error Handling

All endpoints include proper error handling with appropriate HTTP status codes:

- `400 BAD_REQUEST`: Invalid input or operation not allowed
- `404 NOT_FOUND`: Session or resource not found
- `500 INTERNAL_SERVER_ERROR`: Server-side errors

## Security Considerations

- Sessions are isolated per user
- S3 session data is stored securely
- Phone numbers are validated before message sending
- Proper cleanup of resources on session destruction
