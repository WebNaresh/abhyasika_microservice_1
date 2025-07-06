import { HttpException, HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import { BillingService } from '../billing/billing.service';
import { DatabaseService } from '../database/database.service';
import { AbhyasikaPendingPaymentDto } from './dto/abhyasika_pending_payment.dto';
import { AdmissionAdminDto } from './dto/admission-admin.dto';
import { AdmissionDto } from './dto/admission.dto';
import {
  ConfirmationTemplateDto
} from './dto/create-whatsapp.dto';
import { DuePaymentReminderDto } from './dto/due_payment_reminder.dto';
import { FirstReminderPlanRenewalPendingV1Dto } from './dto/first_reminder__plan_renewal_pending_v1.dto';
import { InterestedMessageDto } from './dto/interested_message.dto';
import { PaymentReceivedNotificationDto } from './dto/payment_received_notification.dto';
import { PaymentReceiptDto } from './dto/payment_reciept.dto';
import { PaymentRequestRejectedDto } from './dto/payment_request_rejected.dto';
import { PaymentScreenshotUploadDto } from './dto/payment_screenshot_upload';
import { WhatsappBodyDto } from './dto/whatsapp_body.dto';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private webjsService: any; // Will be injected dynamically to avoid circular dependency

  constructor(
    private readonly billing_service: BillingService,
    private readonly databaseService: DatabaseService
  ) { }

  // Initialize the WhatsappBodyDto with billing service
  onModuleInit() {
    WhatsappBodyDto.setBillingService(this.billing_service);
  }

  // Method to set WebJS service (called from WebJS module to avoid circular dependency)
  setWebjsService(webjsService: any) {
    this.webjsService = webjsService;
  }

  // Check if library has an active WhatsApp Web session
  private async checkForWhatsAppWebSession(library_url: string): Promise<any> {
    try {
      // Step 1: Get library by URL
      const library = await this.databaseService.library.findUnique({
        where: { library_url },
        include: { creator: true }
      });

      if (!library || !library.creatorId) {
        console.log(`❌ Library not found or no creator for URL: ${library_url}`);
        return null;
      }

      console.log(`🔍 Found library: ${library.name}, creator: ${library.creator?.first_name} ${library.creator?.last_name}`);

      // Step 2: Check for active WhatsApp Web session for the creator
      const whatsappSession = await this.databaseService.whatsAppSession.findFirst({
        where: {
          user_id: library.creatorId,
          status: 'READY', // Only consider READY sessions
          is_ready: true,
          is_authenticated: true
        },
        orderBy: { last_activity: 'desc' }
      });

      if (whatsappSession) {
        console.log(`✅ Found active WhatsApp Web session: ${whatsappSession.session_id} for creator: ${library.creatorId}`);
        return whatsappSession;
      }

      console.log(`❌ No active WhatsApp Web session found for creator: ${library.creatorId}`);
      return null;
    } catch (error) {
      console.error(`❌ Error checking WhatsApp Web session for library ${library_url}:`, error);
      return null;
    }
  }

  // Send message via WhatsApp Web
  private async sendViaWhatsAppWeb(sessionId: string, props: DuePaymentReminderDto): Promise<any> {
    try {
      if (!this.webjsService) {
        throw new Error('WhatsApp Web service not available');
      }

      // Format phone number for WhatsApp Web (remove + and ensure country code)
      let phoneNumber = props.receiver_mobile_number.replace(/\D/g, ''); // Remove all non-digits

      // Add country code if not present (assuming Indian numbers)
      if (!phoneNumber.startsWith('91') && phoneNumber.length === 10) {
        phoneNumber = `91${phoneNumber}`;
      }

      console.log(`📱 Formatted phone number for WhatsApp Web: ${phoneNumber} (original: ${props.receiver_mobile_number})`);

      // Create message content in the exact format requested with bold formatting
      const messageContent = `*Payment Reminder for ${props.library_name}*

Dear *${props.student_name}*,

We hope you are doing well. This is a friendly reminder that your payment for *${props.library_name}* is still due.

To avoid any service interruptions or late fees, please complete your payment at your earliest convenience. You can make the payment using the email associated with your account, *${props.student_email}*.

If you have already made the payment, kindly disregard this message. Should you have any questions or require assistance, feel free to reach out.

Thank you for your prompt attention to this matter.

Best regards,
*${props.library_name}*
‪*+91${props.library_contact}*`;

      console.log(`📝 Message content prepared:`, messageContent);

      // Send via WhatsApp Web
      const result = await this.webjsService.sendMessage({
        session_id: sessionId,
        to: phoneNumber, // Send without + prefix, WebJS will add @c.us
        message: messageContent
      });

      // Check if the result indicates success
      if (result && result.success) {
        console.log(`✅ Payment reminder sent via WhatsApp Web to ${phoneNumber}, message ID: ${result.message_id}`);
        return result;
      } else {
        const errorMsg = result?.error || 'Unknown error occurred';
        console.error(`❌ WhatsApp Web message failed: ${errorMsg}`);
        throw new Error(`WhatsApp Web sending failed: ${errorMsg}`);
      }
    } catch (error) {
      console.error(`❌ Failed to send via WhatsApp Web:`, error);
      throw error;
    }
  }

  // Send general payment reminder message via WhatsApp Web
  private async sendGeneralPaymentReminderViaWhatsAppWeb(sessionId: string, props: DuePaymentReminderDto): Promise<any> {
    try {
      if (!this.webjsService) {
        throw new Error('WhatsApp Web service not available');
      }

      // Format phone number for WhatsApp Web (remove + and ensure country code)
      let phoneNumber = props.receiver_mobile_number.replace(/\D/g, ''); // Remove all non-digits

      // Add country code if not present (assuming Indian numbers)
      if (!phoneNumber.startsWith('91') && phoneNumber.length === 10) {
        phoneNumber = `91${phoneNumber}`;
      }

      console.log(`📱 Formatted phone number for WhatsApp Web: ${phoneNumber} (original: ${props.receiver_mobile_number})`);

      // Create message content in the exact format requested with bold formatting
      const messageContent = `*Payment Reminder for ${props.library_name}*

Dear *${props.student_name}*,

We hope you are doing well. This is a friendly reminder that your payment for *${props.library_name}* is still due.

To avoid any service interruptions or late fees, please complete your payment at your earliest convenience. You can make the payment using the email associated with your account, *${props.student_email}*.

If you have already made the payment, kindly disregard this message. Should you have any questions or require assistance, feel free to reach out.

Thank you for your prompt attention to this matter.

Best regards,
*${props.library_name}*
‪*+91${props.library_contact}*`;

      console.log(`📝 General payment reminder message content prepared:`, messageContent);

      // Send via WhatsApp Web
      const result = await this.webjsService.sendMessage({
        session_id: sessionId,
        to: phoneNumber, // Send without + prefix, WebJS will add @c.us
        message: messageContent
      });

      // Check if the result indicates success
      if (result && result.success) {
        console.log(`✅ General payment reminder sent via WhatsApp Web to ${phoneNumber}, message ID: ${result.message_id}`);
        return result;
      } else {
        const errorMsg = result?.error || 'Unknown error occurred';
        console.error(`❌ WhatsApp Web message failed: ${errorMsg}`);
        throw new Error(`WhatsApp Web sending failed: ${errorMsg}`);
      }
    } catch (error) {
      console.error(`❌ Failed to send general payment reminder via WhatsApp Web:`, error);
      throw error;
    }
  }

  // Simple function to log and throw errors for axios requests
  handleAxiosError(error: any) {
    console.error(
      'Axios request failed:',
      error.response?.data || error.message,
    );
    throw new HttpException(
      'Failed to send WhatsApp message',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  limitText = (text: string, limit: number) => {
    return text.length > limit ? text.slice(0, limit) : text;
  };
  async send_payment_reminder(props: DuePaymentReminderDto) {
    // Validate required fields
    if (!props.receiver_mobile_number || props.receiver_mobile_number === 'null' || props.receiver_mobile_number.trim() === '') {
      throw new HttpException(
        `Invalid receiver mobile number: ${props.receiver_mobile_number}. Cannot send WhatsApp message.`,
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      // Step 1: Check if library has an active WhatsApp Web session
      console.log(`🔍 Checking for WhatsApp Web session for library: ${props.library_url}`);
      const whatsappWebSession = await this.checkForWhatsAppWebSession(props.library_url);

      if (whatsappWebSession) {
        console.log(`📱 Found active WhatsApp Web session for library ${props.library_url}, sending via WhatsApp Web...`);
        console.log(`🔧 WebJS Service available: ${!!this.webjsService}`);

        try {
          const result = await this.sendViaWhatsAppWeb(whatsappWebSession.session_id, props);
          console.log(`✅ WhatsApp Web message completed successfully`);
          return result;
        } catch (webError) {
          console.error(`❌ WhatsApp Web sending failed, falling back to API:`, webError.message);
          // Fall through to API method
        }
      } else {
        console.log(`📞 No WhatsApp Web session found for library ${props.library_url}`);
      }

      // Step 2: Fallback to API if no WhatsApp Web session or if WhatsApp Web failed
      console.log(`📞 Sending via API method...`);
      const whatsapp_body = new WhatsappBodyDto(
        "abhyasika_payment_reminder",
        props.receiver_mobile_number,
        props.library_url
      ).addHeaderComponent([{
        type: "text",
        text: props.library_name
      }]).addBodyComponent([{
        type: "text",
        text: props.student_name,
      }, {
        type: "text",
        text: props.library_name
      }, {
        type: "text",
        text: props.student_email
      }, {
        type: "text",
        text: props.library_contact
      }]).addButtonComponent("0", "url", [{
        type: 'text',
        text: `https://${props.library_url}.abhyasika.online`
      }])

      return await whatsapp_body.sendMessage(this.billing_service);
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  async send_general_payment_reminder(props: DuePaymentReminderDto) {
    // Validate required fields
    if (!props.receiver_mobile_number || props.receiver_mobile_number === 'null' || props.receiver_mobile_number.trim() === '') {
      throw new HttpException(
        `Invalid receiver mobile number: ${props.receiver_mobile_number}. Cannot send WhatsApp message.`,
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      // Step 1: Check if library has an active WhatsApp Web session
      console.log(`🔍 Checking for WhatsApp Web session for library: ${props.library_url}`);
      const whatsappWebSession = await this.checkForWhatsAppWebSession(props.library_url);

      if (whatsappWebSession) {
        console.log(`📱 Found active WhatsApp Web session for library ${props.library_url}, sending via WhatsApp Web...`);
        console.log(`🔧 WebJS Service available: ${!!this.webjsService}`);

        try {
          const result = await this.sendGeneralPaymentReminderViaWhatsAppWeb(whatsappWebSession.session_id, props);
          console.log(`✅ WhatsApp Web message completed successfully`);
          return result;
        } catch (webError) {
          console.error(`❌ WhatsApp Web sending failed, falling back to API:`, webError.message);
          // Fall through to API method
        }
      } else {
        console.log(`📞 No WhatsApp Web session found for library ${props.library_url}`);
      }

      // Step 2: Fallback to API if no WhatsApp Web session or if WhatsApp Web failed
      console.log(`📞 Sending via API method...`);
      const whatsapp_body = new WhatsappBodyDto(
        "abhyasika_payment_reminder",
        props.receiver_mobile_number,
        props.library_url
      ).addHeaderComponent([{
        type: "text",
        text: props.library_name
      }]).addBodyComponent([{
        type: "text",
        text: props.student_name,
      }, {
        type: "text",
        text: props.library_name
      }, {
        type: "text",
        text: props.student_email
      }, {
        type: "text",
        text: props.library_contact
      }]).addButtonComponent("0", "url", [{
        type: 'text',
        text: `https://${props.library_url}.abhyasika.online`
      }])

      return await whatsapp_body.sendMessage(this.billing_service);
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  // Send pending payment notification via WhatsApp Web
  private async sendPendingPaymentViaWhatsAppWeb(sessionId: string, props: AbhyasikaPendingPaymentDto): Promise<any> {
    try {
      if (!this.webjsService) {
        throw new Error('WhatsApp Web service not available');
      }

      // Format phone number for WhatsApp Web (remove + and ensure country code)
      let phoneNumber = props.receiver_mobile_number.replace(/\D/g, ''); // Remove all non-digits

      // Add country code if not present (assuming Indian numbers)
      if (!phoneNumber.startsWith('91') && phoneNumber.length === 10) {
        phoneNumber = `91${phoneNumber}`;
      }

      // Handle the case where student_seat is "N/A"
      const seatInfo = props.student_seat === "N/A" ? props.library_name : props.student_seat;

      // Create pending payment notification message using the new template
      const messageContent = `Reservation Confirmation Required for *${props.library_name}*

Dear *${props.student_name}*,

I hope this message finds you well. We are currently awaiting confirmation of your reservation for the *${seatInfo}*.

To secure your reserved seat, kindly check in and confirm your reservation using your email, *${props.student_email}*, as soon as possible. If we do not receive your confirmation, your seat may be reassigned to another member, and you may incur charges for any inconvenience caused.

We appreciate your prompt attention to this matter.

Best regards,

*${seatInfo}*
*${props.library_name}*
‪*+91${props.library_contact}*`;

      console.log(`📝 Pending payment notification message content prepared:`, messageContent);

      // Send via WhatsApp Web
      const result = await this.webjsService.sendMessage({
        session_id: sessionId,
        to: phoneNumber, // Send without + prefix, WebJS will add @c.us
        message: messageContent
      });

      // Check if the result indicates success
      if (result && result.success) {
        console.log(`✅ Pending payment notification sent via WhatsApp Web to ${phoneNumber}, message ID: ${result.message_id}`);
        return result;
      } else {
        const errorMsg = result?.error || 'Unknown error occurred';
        console.error(`❌ WhatsApp Web message failed: ${errorMsg}`);
        throw new Error(`WhatsApp Web sending failed: ${errorMsg}`);
      }
    } catch (error) {
      console.error(`❌ Failed to send pending payment notification via WhatsApp Web:`, error);
      throw error;
    }
  }

  // Similar error handling for pending_payment
  async pending_payment(props: AbhyasikaPendingPaymentDto) {
    console.log(`🚀 ~ WhatsappService ~ pending_payment props:`, props);

    // Validate required fields
    if (!props.receiver_mobile_number || props.receiver_mobile_number === 'null' || props.receiver_mobile_number.trim() === '') {
      console.error('Invalid receiver mobile number provided for pending payment notification')
      return {
        data: 'Invalid receiver mobile number',
        success: false
      }
    }

    const {
      library_name,
      library_contact,
      library_url,
      student_email,
      student_name,
      receiver_mobile_number,
      student_seat
    } = props;

    try {
      // Step 1: Check if library has an active WhatsApp Web session
      console.log(`🔍 Checking for WhatsApp Web session for library: ${library_url}`);
      const whatsappWebSession = await this.checkForWhatsAppWebSession(library_url);

      if (whatsappWebSession) {
        console.log(`📱 Found active WhatsApp Web session for library ${library_url}, sending pending payment notification via WhatsApp Web...`);
        console.log(`🔧 WebJS Service available: ${!!this.webjsService}`);

        try {
          const result = await this.sendPendingPaymentViaWhatsAppWeb(whatsappWebSession.session_id, props);
          console.log(`✅ WhatsApp Web pending payment notification completed successfully`);

          // Create billing record for WhatsApp Web usage
          await this.billing_service.create_whatsapp_billing({
            library_url: library_url,
          });

          return result;
        } catch (webError) {
          console.error(`❌ WhatsApp Web sending failed, falling back to API:`, webError.message);
          // Fall through to API method
        }
      } else {
        console.log(`📞 No WhatsApp Web session found for library ${library_url}`);
      }

      // Step 2: Fallback to API if no WhatsApp Web session or if WhatsApp Web failed
      console.log(`📞 Sending pending payment notification via API method...`);

      const whatsapp_body = new WhatsappBodyDto(
        "abhyasika_pending_payment",
        receiver_mobile_number,
        library_url
      ).addHeaderComponent([{
        type: "text",
        text: library_name
      }]).addBodyComponent([{
        type: "text",
        text: student_name
      }, {
        type: "text",
        text: student_seat === "N/A" ? library_name : student_seat
      }, {
        type: "text",
        text: student_email
      }, {
        type: "text",
        text: library_name
      }, {
        type: "text",
        text: library_contact
      }]).addButtonComponent("0", "url", [{
        type: "text",
        text: `https://${library_url}.abhyasika.online/review`
      }])

      return await whatsapp_body.sendMessage(this.billing_service);
    } catch (error) {
      console.error('Error sending pending payment notification:', error);
      this.handleAxiosError(error);
    }
  }

  // Send reservation confirmation via WhatsApp Web
  private async sendReservationConfirmationViaWhatsAppWeb(sessionId: string, props: ConfirmationTemplateDto): Promise<any> {
    try {
      if (!this.webjsService) {
        throw new Error('WhatsApp Web service not available');
      }

      // Format phone number for WhatsApp Web (remove + and ensure country code)
      let phoneNumber = props.student_contact.replace(/\D/g, ''); // Remove all non-digits

      // Add country code if not present (assuming Indian numbers)
      if (!phoneNumber.startsWith('91') && phoneNumber.length === 10) {
        phoneNumber = `91${phoneNumber}`;
      }

      // Create reservation confirmation message using the new template
      const messageContent = `**Reservation Confirmation Required**

Dear *${props.student_name}*,

Please confirm your *${props.library_name}* reservation by following these steps:

1. Visit the study room website.
2. Log in using your email (*${props.student_email}*).
3. View the notification.
4. Confirm your next month's reservation.

Failure to confirm may result in seat *${props.student_seat}* reassignment and potential charges.

Thank you,
*${props.library_contact}*`;

      console.log(`📝 Reservation confirmation message content prepared:`, messageContent);

      // Send via WhatsApp Web
      const result = await this.webjsService.sendMessage({
        session_id: sessionId,
        to: phoneNumber, // Send without + prefix, WebJS will add @c.us
        message: messageContent
      });

      // Check if the result indicates success
      if (result && result.success) {
        console.log(`✅ Reservation confirmation sent via WhatsApp Web to ${phoneNumber}, message ID: ${result.message_id}`);
        return result;
      } else {
        const errorMsg = result?.error || 'Unknown error occurred';
        console.error(`❌ WhatsApp Web message failed: ${errorMsg}`);
        throw new Error(`WhatsApp Web sending failed: ${errorMsg}`);
      }
    } catch (error) {
      console.error(`❌ Failed to send reservation confirmation via WhatsApp Web:`, error);
      throw error;
    }
  }

  async confirmation_template(props: ConfirmationTemplateDto) {
    console.log(`🚀 ~ WhatsappService:382 ~ props:`, props)

    // Validate required fields
    if (!props.student_contact || props.student_contact === 'null' || props.student_contact.trim() === '') {
      console.error('Invalid student contact provided for reservation confirmation')
      return {
        data: 'Invalid student contact',
        success: false
      }
    }

    const {
      library_name,
      library_contact,
      library_url,
      student_email,
      student_name,
      student_contact,
      student_seat,
      library_image
    } = props;

    console.log(`🚀 ~ WhatsappService ~ library_url:`, library_url)

    try {
      // Step 1: Check if library has an active WhatsApp Web session
      console.log(`🔍 Checking for WhatsApp Web session for library: ${library_url}`);
      const whatsappWebSession = await this.checkForWhatsAppWebSession(library_url);

      if (whatsappWebSession) {
        console.log(`📱 Found active WhatsApp Web session for library ${library_url}, sending reservation confirmation via WhatsApp Web...`);
        console.log(`🔧 WebJS Service available: ${!!this.webjsService}`);

        try {
          const result = await this.sendReservationConfirmationViaWhatsAppWeb(whatsappWebSession.session_id, props);
          console.log(`✅ WhatsApp Web reservation confirmation completed successfully`);

          // Create billing record for WhatsApp Web usage
          await this.billing_service.create_whatsapp_billing({
            library_url: library_url,
          });

          return result;
        } catch (webError) {
          console.error(`❌ WhatsApp Web sending failed, falling back to API:`, webError.message);
          // Fall through to API method
        }
      } else {
        console.log(`📞 No WhatsApp Web session found for library ${library_url}`);
      }

      // Step 2: Fallback to API if no WhatsApp Web session or if WhatsApp Web failed
      console.log(`📞 Sending reservation confirmation via API method...`);

      const body = {
        messaging_product: 'whatsapp',
        to: `91${student_contact}`,
        type: 'template',
        template: {
          name: 'library_seat_confirmation_v2',
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: this.limitText(student_name || '', 60) },
                { type: 'text', text: this.limitText(library_name || '', 60) },
                { type: 'text', text: this.limitText(student_email || '', 60) },
                { type: 'text', text: this.limitText(library_contact || '', 60) },
                { type: 'text', text: this.limitText(student_seat || '', 60) }
              ]
            },
            {
              type: 'button',
              sub_type: 'url',
              index: '0',
              parameters: [
                {
                  type: "payload",
                  payload: this.limitText(`https://${library_url}.abhyasika.online`, 60),
                }
              ]
            }
          ]
        }
      };

      const response = await axios.post(
        'https://graph.facebook.com/v20.0/431174140080894/messages',
        body,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      ).then(async (response) => {

        await this.billing_service.create_whatsapp_billing({
          library_url: library_url,
        })
        return response.data;
      }).catch((_error) => {
        return {
          data: 'Error sending WhatsApp message',
          success: false
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error sending reservation confirmation:', error)
      return {
        data: 'Error sending WhatsApp message',
        success: false
      }
    }
  }

  // Send payment receipt notification via WhatsApp Web
  private async sendPaymentReceiptViaWhatsAppWeb(sessionId: string, props: PaymentReceiptDto): Promise<any> {
    try {
      if (!this.webjsService) {
        throw new Error('WhatsApp Web service not available');
      }

      // Format phone number for WhatsApp Web (remove + and ensure country code)
      let phoneNumber = props.receiver_mobile_number.replace(/\D/g, ''); // Remove all non-digits

      // Add country code if not present (assuming Indian numbers)
      if (!phoneNumber.startsWith('91') && phoneNumber.length === 10) {
        phoneNumber = `91${phoneNumber}`;
      }

      // Create payment receipt notification message using the new template
      const messageContent = `Payment Receipt - *${props.library_name}*

Dear *${props.student_name}* 🌟,

We are pleased to confirm the successful receipt of your payment 💳. Here are your payment details:

📧 Email: *${props.student_email}*
🪑 Seat Number: *${props.seat_title}*
📜 Plan: *${props.plan_name}*
📅 Next Payment Date: *${props.plan_expiration_date}*

Thank you for choosing *${props.library_name}* 🙏. If you have any questions or need assistance, feel free to reach out to us 📞.

We'd love to hear your thoughts!
💬 Leave a Review — https://${props.library_url}.abhyasika.online/review

Best regards,
*${props.library_name}*
☎ ‪*+91${props.library_contact_no}*`;

      console.log(`📝 Payment receipt notification message content prepared:`, messageContent);

      // Send via WhatsApp Web
      const result = await this.webjsService.sendMessage({
        session_id: sessionId,
        to: phoneNumber, // Send without + prefix, WebJS will add @c.us
        message: messageContent
      });

      // Check if the result indicates success
      if (result && result.success) {
        console.log(`✅ Payment receipt notification sent via WhatsApp Web to ${phoneNumber}, message ID: ${result.message_id}`);
        return result;
      } else {
        const errorMsg = result?.error || 'Unknown error occurred';
        console.error(`❌ WhatsApp Web message failed: ${errorMsg}`);
        throw new Error(`WhatsApp Web sending failed: ${errorMsg}`);
      }
    } catch (error) {
      console.error(`❌ Failed to send payment receipt notification via WhatsApp Web:`, error);
      throw error;
    }
  }

  async send_payment_receipt(props: PaymentReceiptDto) {
    console.log(`🚀 ~ file: whatsapp.service.ts:404 ~ WhatsappService ~ props:`, props)

    // Validate required fields
    if (!props.receiver_mobile_number || props.receiver_mobile_number === 'null' || props.receiver_mobile_number.trim() === '') {
      console.error('Invalid receiver mobile number provided for payment receipt notification')
      return {
        data: 'Invalid receiver mobile number',
        success: false
      }
    }

    try {
      // Step 1: Check if library has an active WhatsApp Web session
      console.log(`🔍 Checking for WhatsApp Web session for library: ${props.library_url}`);
      const whatsappWebSession = await this.checkForWhatsAppWebSession(props.library_url);

      if (whatsappWebSession) {
        console.log(`📱 Found active WhatsApp Web session for library ${props.library_url}, sending payment receipt notification via WhatsApp Web...`);
        console.log(`🔧 WebJS Service available: ${!!this.webjsService}`);

        try {
          const result = await this.sendPaymentReceiptViaWhatsAppWeb(whatsappWebSession.session_id, props);
          console.log(`✅ WhatsApp Web payment receipt notification completed successfully`);

          // Create billing record for WhatsApp Web usage
          await this.billing_service.create_whatsapp_billing({
            library_url: props.library_url,
          });

          return result;
        } catch (webError) {
          console.error(`❌ WhatsApp Web sending failed, falling back to API:`, webError.message);
          // Fall through to API method
        }
      } else {
        console.log(`📞 No WhatsApp Web session found for library ${props.library_url}`);
      }

      // Step 2: Fallback to API if no WhatsApp Web session or if WhatsApp Web failed
      console.log(`📞 Sending payment receipt notification via API method...`);

      const body = new WhatsappBodyDto(
        'study_room_payment_receipt',
        props.receiver_mobile_number,
        props.library_url
      ).addHeaderComponent([{
        type: 'text', text: props.library_name
      }])
        .addBodyComponent([{
          type: 'text', text: props.student_name
        }, {
          type: 'text', text: props.student_email
        }, {
          type: 'text', text: props.seat_title
        }, {
          type: 'text', text: props.plan_name
        }, {
          type: 'text', text: props.plan_expiration_date
        }, {
          type: 'text', text: props.library_name
        }, {
          type: 'text', text: props.library_contact_no
        }, {
          type: 'text', text: props.library_name
        }, {
          type: 'text', text: props.library_url
        }])

      return await body.sendMessage(this.billing_service);
    } catch (error) {
      console.error('Error sending payment receipt notification:', error);
      console.log(error);
    }
  }

  async send_interested_notification(props: InterestedMessageDto) {
    console.log(`🚀 ~ WhatsappService:497 ~ send_interested_notification ~ props:`, props)
    try {
      const body = {
        messaging_product: 'whatsapp',
        to: `91${props.library_contact}`,
        type: 'template',
        template: {
          name: 'interested_notification',
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: this.limitText(props.student_name || '', 60) },
                {
                  type: 'text',
                  text: this.limitText(props.interested_desk || '', 60)
                },
                {
                  type: 'text',
                  text: this.limitText(props.student_contact || '', 60)
                },
                // time should look like 17-jan-2024 6:46 PM
                {
                  type: 'text',
                  text: this.limitText(props.time_of_interested.toLocaleString(), 60)
                }

              ]
            },

          ]
        }
      };

      const response = await axios.post(
        'https://graph.facebook.com/v20.0/431174140080894/messages',
        body,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      ).then(async (response) => {
        console.log(`🚀 ~ WhatsappService ~ response:`, response.data)

        await this.billing_service.create_whatsapp_billing({
          library_url: props.library_url,
        })
        return response.data;
      });
    } catch (error) {
      console.log(error)
    }


  }

  // Send admission notification via WhatsApp Web
  private async sendAdmissionNotificationViaWhatsAppWeb(sessionId: string, props: AdmissionDto): Promise<any> {
    try {
      if (!this.webjsService) {
        throw new Error('WhatsApp Web service not available');
      }

      // Format phone number for WhatsApp Web (remove + and ensure country code)
      let phoneNumber = props.student_contact.replace(/\D/g, ''); // Remove all non-digits

      // Add country code if not present (assuming Indian numbers)
      if (!phoneNumber.startsWith('91') && phoneNumber.length === 10) {
        phoneNumber = `91${phoneNumber}`;
      }

      // Set default values if not provided
      const branch_name = props.branch_name || "N/A";
      const room_name = props.room_name || "N/A";
      const desk_name = props.desk_name || "N/A";

      // Create admission notification message using the new template
      const messageContent = `**Admission Successful - ${props.library_name}**

Hello *${props.student_name}*,

Your admission to *${props.library_name}* has been successfully completed! Here are your membership details:

1) Name: *${props.student_name}*
2) Branch: *${branch_name}*
3) Room: *${room_name}*
4) Desk No.: 🪑 *${desk_name}*
5) Plan: *${props.plan_name}*
6) Plan Start Date: 📅 *${props.admission_date}*
7) Plan End Date: 📅 *${props.admission_end_date}*

We're excited to have you as part of our community. If you have any questions, feel free to reach out!

Best regards,
*${props.library_name}*
‪*+91${props.library_contact_no}*`;

      console.log(`📝 Admission notification message content prepared:`, messageContent);

      // Send via WhatsApp Web
      const result = await this.webjsService.sendMessage({
        session_id: sessionId,
        to: phoneNumber, // Send without + prefix, WebJS will add @c.us
        message: messageContent
      });

      // Check if the result indicates success
      if (result && result.success) {
        console.log(`✅ Admission notification sent via WhatsApp Web to ${phoneNumber}, message ID: ${result.message_id}`);
        return result;
      } else {
        const errorMsg = result?.error || 'Unknown error occurred';
        console.error(`❌ WhatsApp Web message failed: ${errorMsg}`);
        throw new Error(`WhatsApp Web sending failed: ${errorMsg}`);
      }
    } catch (error) {
      console.error(`❌ Failed to send admission notification via WhatsApp Web:`, error);
      throw error;
    }
  }

  async send_admission_notification(props: AdmissionDto) {
    if (props.student_contact === null || props.student_contact === undefined || props.student_contact === "") {
      console.error('Invalid student contact provided')
      return {}
    }

    try {
      // Step 1: Check if library has an active WhatsApp Web session
      console.log(`🔍 Checking for WhatsApp Web session for library: ${props.library_url}`);
      const whatsappWebSession = await this.checkForWhatsAppWebSession(props.library_url);

      if (whatsappWebSession) {
        console.log(`📱 Found active WhatsApp Web session for library ${props.library_url}, sending via WhatsApp Web...`);
        console.log(`🔧 WebJS Service available: ${!!this.webjsService}`);

        try {
          const result = await this.sendAdmissionNotificationViaWhatsAppWeb(whatsappWebSession.session_id, props);
          console.log(`✅ WhatsApp Web admission notification completed successfully`);

          // Create billing record for WhatsApp Web usage
          await this.billing_service.create_whatsapp_billing({
            library_url: props.library_url,
          });

          return result;
        } catch (webError) {
          console.error(`❌ WhatsApp Web sending failed, falling back to API:`, webError.message);
          // Fall through to API method
        }
      } else {
        console.log(`📞 No WhatsApp Web session found for library ${props.library_url}`);
      }

      // Step 2: Fallback to API if no WhatsApp Web session or if WhatsApp Web failed
      console.log(`📞 Sending admission notification via API method...`);

      // Set default values if not provided
      const branch_name = props.branch_name || "N/A";
      const room_name = props.room_name || "N/A";
      const desk_name = props.desk_name || "N/A";
      const student_contact = props.student_contact || "9370928324";

      const body = {
        messaging_product: 'whatsapp',
        to: `91${student_contact}`,
        type: 'template',
        template: {
          name: 'admission_successful_notification',
          language: { code: 'en' },
          components: [
            {
              type: 'header',
              parameters: [
                { type: 'text', text: this.limitText(props.library_name, 60) },
              ],
            },
            {
              type: 'body',
              parameters: [
                { type: 'text', text: this.limitText(props.student_name || '', 60) },
                { type: 'text', text: this.limitText(props.library_name || '', 60) },
                { type: 'text', text: this.limitText(branch_name, 60) },
                { type: 'text', text: this.limitText(room_name, 60) },
                { type: 'text', text: this.limitText(desk_name, 60) },
                { type: 'text', text: this.limitText(props.plan_name || '', 60) },
                { type: 'text', text: this.limitText(props.admission_date || '', 60) },
                { type: 'text', text: this.limitText(props.admission_end_date || '', 60) },
                { type: 'text', text: this.limitText(`91${props.library_contact_no}` || '', 60) },
                { type: 'text', text: this.limitText(props.library_name || '', 60) },
              ]
            },

          ]
        },
      };

      const response = await axios.post(
        'https://graph.facebook.com/v20.0/431174140080894/messages',
        body,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log(`🚀 ~ file: whatsapp.service.ts:576 ~ WhatsappService ~ response.data:`, response.data)

      await this.billing_service.create_whatsapp_billing({
        library_url: props.library_url,
      })

      return response.data;
    } catch (error) {
      console.error('Error sending admission notification:', error)
      return {}
    }
  }

  async send_seat_change_notification(props: {
    library_name: string;
    student_name: string;
    new_seat: string;
    student_contact?: string;
    library_url: string
  }) {

    try {
      const student_contact = props.student_contact || "9370928324";
      const body = {
        messaging_product: 'whatsapp',
        to: `91${student_contact}`,
        type: 'template',
        template: {
          name: 'seat_change_confirmation',
          language: { code: 'en' },
          components: [
            {
              type: 'header',
              parameters: [
                { type: 'text', text: this.limitText(props.library_name, 60) },
              ],
            },
            {
              type: 'body',
              parameters: [
                { type: 'text', text: this.limitText(props.student_name || '', 60) },
                { type: 'text', text: this.limitText(props.new_seat || '', 60) },
                { type: 'text', text: this.limitText(student_contact, 60) },
                { type: 'text', text: this.limitText(props.library_name || '', 60) },
              ]
            },
          ]
        },
      };

      const response = await axios.post(
        'https://graph.facebook.com/v20.0/431174140080894/messages',
        body,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      ).then(async (response) => {

        await this.billing_service.create_whatsapp_billing({
          library_url: props.library_url,
        })
        return response.data;
      });

      return response.data;
    } catch (error) {
      console.error(error);
      this.handleAxiosError(error);
    }
  }

  async notification_report_admin(props: {
    library_owner_name: string,
    branch_name: string,
    branch_total_capacity: string,
    branch_reserved_capacity: string,
    branch_unreserved_capacity: string,
    branch_vacant_seat: string,
    branch_expiring_plan: string,
    branch_pending_members: string,
    branch_interested_members: string,
    branch_url: string,
    library_owner_contact: string

  }) {
    console.log(`🚀 ~ WhatsappService ~ props:`, props)
    const date = new Date();
    // format date in 12/01/2025
    const formatted_date = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    try {
      const body = {
        messaging_product: 'whatsapp',
        to: `91${props.library_owner_contact}`,
        type: 'template',
        template: {
          name: 'notification_report_admin',
          language: { code: 'en' },
          components: [
            {
              type: 'header',
              parameters: [
                { type: 'text', text: this.limitText(props.library_owner_name, 60) },
              ],
            },
            {
              type: 'body',
              parameters: [

                { type: 'text', text: this.limitText(formatted_date || '', 60) },
                { type: 'text', text: this.limitText(props.branch_total_capacity || '', 60) },
                { type: 'text', text: this.limitText(props.branch_reserved_capacity || '', 60) },
                { type: 'text', text: this.limitText(props.branch_unreserved_capacity || '', 60) },
                { type: 'text', text: this.limitText(props.branch_vacant_seat || '', 60) },
                { type: 'text', text: this.limitText(props.branch_expiring_plan || '', 60) },
                { type: 'text', text: this.limitText(props.branch_pending_members || '', 60) },
                { type: 'text', text: this.limitText(props.branch_interested_members || '', 60) },
                { type: 'text', text: this.limitText(`https://${props.branch_url}.abhyasika.online`, 60) },
                {
                  type: 'text',
                  text: this.limitText(props.branch_name || '', 60)
                }
              ]
            },
          ]
        },
      }

      const response = await axios.post(
        'https://graph.facebook.com/v20.0/431174140080894/messages',
        body,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      ).then(async (response) => {

        await this.billing_service.create_whatsapp_billing({
          library_url: props.branch_url,
        })
        return response.data;
      });

      return response.data;

    } catch (error) {
      console.error(error);
      this.handleAxiosError(error);
    }



  }

  async send_cancel_membership_email(props: {
    to: string,
    user_name: string,
    library_name: string,
    library_contact_no: string,
    library_url: string
  }) {
    try {
      const body = {
        messaging_product: 'whatsapp',
        to: `91${props.to}`,
        type: 'template',
        template: {
          name: 'membership_cancellation_notification ',
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: this.limitText(props.user_name, 60) },
                { type: 'text', text: this.limitText(props.library_contact_no, 60) },
                { type: 'text', text: this.limitText(props.library_name, 60) },
              ]
            }
          ]
        },
      }

      const response = await axios.post(
        'https://graph.facebook.com/v20.0/431174140080894/messages',
        body,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      await this.billing_service.create_whatsapp_billing({
        library_url: props.library_url,
      })

      console.log(`🚀 ~ WhatsappService ~ response:`, response.data)

      return response.data;
    } catch (error) {
      console.error(error);
      this.handleAxiosError(error);
    }
  }

  async send_first_remindar_reservation(props: {
    library_name: string,
    student_name: string,
    student_email: string,
    student_seat: string,
    student_contact: string,
    library_contact: string,
    library_url: string
  }) {
    console.log(`🚀 ~ WhatsappService ~ props:`, props)
    try {
      const body = {
        messaging_product: 'whatsapp',
        to: `91${props.student_contact}`,
        type: 'template',
        template: {
          name: 'first_remindar_reservation',
          language: { code: 'en' },
          components: [
            {
              type: 'header',
              parameters: [
                { type: 'text', text: this.limitText(props.library_name, 60) },
              ],
            },
            {
              type: 'body',
              parameters: [
                { type: 'text', text: this.limitText(props.student_name, 60) },
                { type: 'text', text: this.limitText(props.library_name, 60) },
                { type: 'text', text: this.limitText(props.student_email, 60) },
                { type: 'text', text: this.limitText(props.student_seat, 60) },
                { type: 'text', text: this.limitText(props.student_contact, 60) },
                { type: 'text', text: this.limitText(props.library_contact, 60) },
                { type: 'text', text: this.limitText(props.library_url, 60) },
              ]
            }
          ]
        },
      }

      const response = await axios.post(
        'https://graph.facebook.com/v20.0/431174140080894/messages',
        body,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      await this.billing_service.create_whatsapp_billing({
        library_url: props.library_url,
      })

      console.log(`🚀 ~ WhatsappService ~ response:`, response.data)

      return response.data
    } catch (error) {
      if (props.student_contact === "9370928324") {
        console.error(error);
      }
    }
  }
  async second_remindar_reservation(props: {
    library_name: string,
    student_name: string,
    student_email: string,
    student_seat: string,
    student_contact: string,
    library_contact: string,
    library_url: string
  }) {
    try {
      const body = {
        messaging_product: 'whatsapp',
        to: `91${props.student_contact}`,
        type: 'template',
        template: {
          name: 'second_remindar_reservation',
          language: { code: 'en' },
          components: [
            {
              type: 'header',
              parameters: [
                { type: 'text', text: this.limitText(props.library_name, 60) },
              ],
            },
            {
              type: 'body',
              parameters: [
                { type: 'text', text: this.limitText(props.student_name, 60) },
                { type: 'text', text: this.limitText(props.library_name, 60) },
                { type: 'text', text: this.limitText(props.student_seat, 60) },
                { type: 'text', text: this.limitText(props.library_url, 60) },
                { type: 'text', text: this.limitText(props.student_email, 60) },
                { type: 'text', text: this.limitText(props.student_contact, 60) },
                { type: 'text', text: this.limitText(props.library_name, 60) },
                { type: 'text', text: this.limitText(props.library_contact, 60) },
              ]
            }
          ]
        },
      }

      const response = await axios.post(
        'https://graph.facebook.com/v20.0/431174140080894/messages',
        body,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      await this.billing_service.create_whatsapp_billing({
        library_url: props.library_url,
      })

      console.log(`🚀 ~ WhatsappService ~ response:`, response.data)

      return response.data
    } catch (error) {
      if (props.student_contact === "9370928324") {
        console.error(error);
      }
    }
  }
  async last_remindar_reservation(props: {
    library_name: string,
    student_name: string,
    student_email: string,
    student_seat: string,
    student_contact: string,
    library_contact: string,
    library_url: string
  }) {
    try {
      const body = {
        messaging_product: 'whatsapp',
        to: `91${props.student_contact}`,
        type: 'template',
        template: {
          name: 'last_remindar_reservation',
          language: { code: 'en' },
          components: [
            {
              type: 'header',
              parameters: [
                { type: 'text', text: this.limitText(props.library_name, 60) },
              ],
            },
            {
              type: 'body',
              parameters: [
                { type: 'text', text: this.limitText(props.student_name, 60) },
                { type: 'text', text: this.limitText(props.library_name, 60) },
                { type: 'text', text: this.limitText(props.student_seat, 60) },
                { type: 'text', text: this.limitText(props.library_url, 60) },
                { type: 'text', text: this.limitText(props.student_email, 60) },
                { type: 'text', text: this.limitText(props.student_contact, 60) },
                { type: 'text', text: this.limitText(props.library_name, 60) },
                { type: 'text', text: this.limitText(props.library_contact, 60) },
              ]
            }
          ]
        },
      }

      const response = await axios.post(
        'https://graph.facebook.com/v20.0/431174140080894/messages',
        body,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      await this.billing_service.create_whatsapp_billing({
        library_url: props.library_url,
      })

      console.log(`🚀 ~ WhatsappService ~ response:`, response.data)

      return response.data
    } catch (error) {
      if (props.student_contact === "9370928324") {
        console.error(error);
      }
    }
  }
  // Send admin admission notification via WhatsApp Web
  private async sendAdmissionNotificationAdminViaWhatsAppWeb(sessionId: string, props: AdmissionAdminDto): Promise<any> {
    try {
      if (!this.webjsService) {
        throw new Error('WhatsApp Web service not available');
      }

      // Format phone number for WhatsApp Web (remove + and ensure country code)
      let phoneNumber = props.library_contact.replace(/\D/g, ''); // Remove all non-digits

      // Add country code if not present (assuming Indian numbers)
      if (!phoneNumber.startsWith('91') && phoneNumber.length === 10) {
        phoneNumber = `91${phoneNumber}`;
      }

      // Create admin admission notification message using the new template
      const messageContent = `**New Admission Alert - ${props.library_name}**

Hello,

A new member has successfully completed their admission to your study hall. Please find the student's membership details below:

1) Name: *${props.student_name}*
2) Branch: *${props.branch_name}*
3) Room: *${props.room_name}*
4) Desk No.: 🪑 *${props.desk_name}*
5) Plan: *${props.plan_name}*
6) Plan Start Date: 📅 *${props.plan_start_date}*
7) Plan End Date: 📅 *${props.plan_end_date}*

Please make necessary arrangements and ensure the desk is ready for the student.

Best regards,
*${props.library_name}*`;

      console.log(`📝 Admin admission notification message content prepared:`, messageContent);

      // Send via WhatsApp Web
      const result = await this.webjsService.sendMessage({
        session_id: sessionId,
        to: phoneNumber, // Send without + prefix, WebJS will add @c.us
        message: messageContent
      });

      // Check if the result indicates success
      if (result && result.success) {
        console.log(`✅ Admin admission notification sent via WhatsApp Web to ${phoneNumber}, message ID: ${result.message_id}`);
        return result;
      } else {
        const errorMsg = result?.error || 'Unknown error occurred';
        console.error(`❌ WhatsApp Web message failed: ${errorMsg}`);
        throw new Error(`WhatsApp Web sending failed: ${errorMsg}`);
      }
    } catch (error) {
      console.error(`❌ Failed to send admin admission notification via WhatsApp Web:`, error);
      throw error;
    }
  }

  async send_admission_notification_admin(props: AdmissionAdminDto) {
    if (props.library_contact === null || props.library_contact === undefined || props.library_contact === "") {
      console.error('Invalid library contact provided')
      return {}
    }

    try {
      // Step 1: Check if library has an active WhatsApp Web session
      console.log(`🔍 Checking for WhatsApp Web session for library: ${props.library_url}`);
      const whatsappWebSession = await this.checkForWhatsAppWebSession(props.library_url);

      if (whatsappWebSession) {
        console.log(`📱 Found active WhatsApp Web session for library ${props.library_url}, sending admin notification via WhatsApp Web...`);
        console.log(`🔧 WebJS Service available: ${!!this.webjsService}`);

        try {
          const result = await this.sendAdmissionNotificationAdminViaWhatsAppWeb(whatsappWebSession.session_id, props);
          console.log(`✅ WhatsApp Web admin admission notification completed successfully`);

          // Create billing record for WhatsApp Web usage
          await this.billing_service.create_whatsapp_billing({
            library_url: props.library_url,
          });

          return result;
        } catch (webError) {
          console.error(`❌ WhatsApp Web sending failed, falling back to API:`, webError.message);
          // Fall through to API method
        }
      } else {
        console.log(`📞 No WhatsApp Web session found for library ${props.library_url}`);
      }

      // Step 2: Fallback to API if no WhatsApp Web session or if WhatsApp Web failed
      console.log(`📞 Sending admin admission notification via API method...`);

      const student_contact = props.library_contact || "9370928324";

      const body = {
        messaging_product: 'whatsapp',
        to: `91${student_contact}`,
        type: 'template',
        template: {
          name: 'owner_admission_notification',
          language: { code: 'en' },
          components: [
            {
              type: 'header',
              parameters: [
                { type: 'text', text: this.limitText(props.library_name, 60) },
              ],
            },
            {
              type: 'body',
              parameters: [
                { type: 'text', text: this.limitText(props.student_name || '', 60) },
                { type: 'text', text: this.limitText(props.branch_name || '', 60) },
                { type: 'text', text: this.limitText(props.room_name || '', 60) },
                { type: 'text', text: this.limitText(props.desk_name || '', 60) },
                { type: 'text', text: this.limitText(props.plan_name || '', 60) },
                { type: 'text', text: this.limitText(props.plan_start_date || '', 60) },
                { type: 'text', text: this.limitText(props.plan_end_date || '', 60) },
                { type: 'text', text: this.limitText(props.library_name || '', 60) },
              ]
            },

          ]
        },
      };

      const response = await axios.post(
        'https://graph.facebook.com/v20.0/431174140080894/messages',
        body,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log(`🚀 ~ file: whatsapp.service.ts:576 ~ WhatsappService ~ response.data:`, response.data)

      await this.billing_service.create_whatsapp_billing({
        library_url: props.library_url,
      })

      return response.data;
    } catch (error) {
      console.error('Error sending admin admission notification:', error)
      return {}
    }
  }

  async send_payment_received_notification(props: PaymentReceivedNotificationDto) {
    try {
      // Create the body using the WhatsappBodyDto class with domain parameter
      const whatsappBody = new WhatsappBodyDto(
        'payment_received_notification',
        props.receiver_mobile_number,
        props.library_url
      )
        .addBodyComponent([
          { type: 'text', text: props.member_name },
          { type: 'text', text: props.desk_title },
          { type: 'text', text: props.room_title }
        ]);

      // Use the new sendMessage method which now has domain built-in
      return await whatsappBody.sendMessage();
    } catch (error) {
      console.error(error);
      this.handleAxiosError(error);
    }
  }

  // Send payment request rejected notification via WhatsApp Web
  private async sendPaymentRequestRejectedViaWhatsAppWeb(sessionId: string, props: PaymentRequestRejectedDto): Promise<any> {
    try {
      if (!this.webjsService) {
        throw new Error('WhatsApp Web service not available');
      }

      // Format phone number for WhatsApp Web (remove + and ensure country code)
      let phoneNumber = props.receiver_mobile_number.replace(/\D/g, ''); // Remove all non-digits

      // Add country code if not present (assuming Indian numbers)
      if (!phoneNumber.startsWith('91') && phoneNumber.length === 10) {
        phoneNumber = `91${phoneNumber}`;
      }

      // Create payment request rejected notification message using the new template
      const messageContent = `Hello *${props.member_name}*,
Your recent library plan continuation request has been rejected.

📌 Please check the details and take necessary action here:
👉 https://${props.library_url}.abhyasika.online/profile/plan_continuation

If you believe this is a mistake or need help, kindly contact.

Thank you!
*${props.library_name}*`;

      console.log(`📝 Payment request rejected notification message content prepared:`, messageContent);

      // Send via WhatsApp Web
      const result = await this.webjsService.sendMessage({
        session_id: sessionId,
        to: phoneNumber, // Send without + prefix, WebJS will add @c.us
        message: messageContent
      });

      // Check if the result indicates success
      if (result && result.success) {
        console.log(`✅ Payment request rejected notification sent via WhatsApp Web to ${phoneNumber}, message ID: ${result.message_id}`);
        return result;
      } else {
        const errorMsg = result?.error || 'Unknown error occurred';
        console.error(`❌ WhatsApp Web message failed: ${errorMsg}`);
        throw new Error(`WhatsApp Web sending failed: ${errorMsg}`);
      }
    } catch (error) {
      console.error(`❌ Failed to send payment request rejected notification via WhatsApp Web:`, error);
      throw error;
    }
  }

  async send_payment_request_rejected(props: PaymentRequestRejectedDto) {
    // Validate required fields
    if (!props.receiver_mobile_number || props.receiver_mobile_number === 'null' || props.receiver_mobile_number.trim() === '') {
      console.error('Invalid receiver mobile number provided for payment request rejected notification')
      return {
        data: 'Invalid receiver mobile number',
        success: false
      }
    }

    try {
      // Step 1: Check if library has an active WhatsApp Web session
      console.log(`🔍 Checking for WhatsApp Web session for library: ${props.library_url}`);
      const whatsappWebSession = await this.checkForWhatsAppWebSession(props.library_url);

      if (whatsappWebSession) {
        console.log(`📱 Found active WhatsApp Web session for library ${props.library_url}, sending payment request rejected notification via WhatsApp Web...`);
        console.log(`🔧 WebJS Service available: ${!!this.webjsService}`);

        try {
          const result = await this.sendPaymentRequestRejectedViaWhatsAppWeb(whatsappWebSession.session_id, props);
          console.log(`✅ WhatsApp Web payment request rejected notification completed successfully`);

          // Create billing record for WhatsApp Web usage
          await this.billing_service.create_whatsapp_billing({
            library_url: props.library_url,
          });

          return result;
        } catch (webError) {
          console.error(`❌ WhatsApp Web sending failed, falling back to API:`, webError.message);
          // Fall through to API method
        }
      } else {
        console.log(`📞 No WhatsApp Web session found for library ${props.library_url}`);
      }

      // Step 2: Fallback to API if no WhatsApp Web session or if WhatsApp Web failed
      console.log(`📞 Sending payment request rejected notification via API method...`);

      const whatsappBody = new WhatsappBodyDto(
        'payment_request_rejected',
        props.receiver_mobile_number,
        props.library_url
      )
        .addBodyComponent([
          { type: 'text', text: props.member_name },
          { type: 'text', text: props.library_url },
          { type: 'text', text: props.library_name },
          { type: 'text', text: props.library_contact }
        ]);

      return await whatsappBody.sendMessage();
    } catch (error) {
      console.error('Error sending payment request rejected notification:', error);
      this.handleAxiosError(error);
    }
  }

  // Send first reminder plan renewal notification via WhatsApp Web
  private async sendFirstReminderPlanRenewalViaWhatsAppWeb(sessionId: string, props: FirstReminderPlanRenewalPendingV1Dto): Promise<any> {
    try {
      if (!this.webjsService) {
        throw new Error('WhatsApp Web service not available');
      }

      // Format phone number for WhatsApp Web (remove + and ensure country code)
      let phoneNumber = props.receiver_mobile_number.replace(/\D/g, ''); // Remove all non-digits

      // Add country code if not present (assuming Indian numbers)
      if (!phoneNumber.startsWith('91') && phoneNumber.length === 10) {
        phoneNumber = `91${phoneNumber}`;
      }

      // Create first reminder plan renewal notification message using the new template
      const messageContent = `*${props.library_name}*
📢 First Reminder – Pending Fees

Hello *${props.member_name}*,
This is a gentle reminder that your fee is pending. Kindly complete payment at the earliest to avoid interruption.

Please follow these steps:

① Visit: https://${props.library_url}.abhyasika.online
② Login with your number.
③ Tap the profile icon (top-right). (Reload the page if it's not visible.)
④ Click on "Plan Continuation"
⑤ Scan the QR code & make the payment
⑥ Click "New Payment Request", upload the payment screenshot, fill in the details & submit

📞 If you're facing any issues or need help, feel free to contact us.

Thank you!
– *${props.library_name}*
‪*+91${props.library_contact}*`;

      console.log(`📝 First reminder plan renewal notification message content prepared:`, messageContent);

      // Send via WhatsApp Web
      const result = await this.webjsService.sendMessage({
        session_id: sessionId,
        to: phoneNumber, // Send without + prefix, WebJS will add @c.us
        message: messageContent
      });

      // Check if the result indicates success
      if (result && result.success) {
        console.log(`✅ First reminder plan renewal notification sent via WhatsApp Web to ${phoneNumber}, message ID: ${result.message_id}`);
        return result;
      } else {
        const errorMsg = result?.error || 'Unknown error occurred';
        console.error(`❌ WhatsApp Web message failed: ${errorMsg}`);
        throw new Error(`WhatsApp Web sending failed: ${errorMsg}`);
      }
    } catch (error) {
      console.error(`❌ Failed to send first reminder plan renewal notification via WhatsApp Web:`, error);
      throw error;
    }
  }

  async send_first_reminder_plan_renewal_pending_v1(props: FirstReminderPlanRenewalPendingV1Dto) {
    // Validate required fields
    if (!props.receiver_mobile_number || props.receiver_mobile_number === 'null' || props.receiver_mobile_number.trim() === '') {
      console.error('Invalid receiver mobile number provided for first reminder plan renewal notification')
      return {
        data: 'Invalid receiver mobile number',
        success: false
      }
    }

    try {
      // Step 1: Check if library has an active WhatsApp Web session
      console.log(`🔍 Checking for WhatsApp Web session for library: ${props.library_url}`);
      const whatsappWebSession = await this.checkForWhatsAppWebSession(props.library_url);

      if (whatsappWebSession) {
        console.log(`📱 Found active WhatsApp Web session for library ${props.library_url}, sending first reminder plan renewal notification via WhatsApp Web...`);
        console.log(`🔧 WebJS Service available: ${!!this.webjsService}`);

        try {
          const result = await this.sendFirstReminderPlanRenewalViaWhatsAppWeb(whatsappWebSession.session_id, props);
          console.log(`✅ WhatsApp Web first reminder plan renewal notification completed successfully`);

          // Create billing record for WhatsApp Web usage
          await this.billing_service.create_whatsapp_billing({
            library_url: props.library_url,
          });

          return result;
        } catch (webError) {
          console.error(`❌ WhatsApp Web sending failed, falling back to API:`, webError.message);
          // Fall through to API method
        }
      } else {
        console.log(`📞 No WhatsApp Web session found for library ${props.library_url}`);
      }

      // Step 2: Fallback to API if no WhatsApp Web session or if WhatsApp Web failed
      console.log(`📞 Sending first reminder plan renewal notification via API method...`);

      const whatsappBody = new WhatsappBodyDto(
        'first_reminder__plan_renewal_pending_v1',
        props.receiver_mobile_number,
        props.library_url
      ).addHeaderComponent([
        { type: 'text', text: props.library_name }
      ])
        .addBodyComponent([
          { type: 'text', text: props.member_name },
          { type: 'text', text: props.library_url },
          { type: 'text', text: props.library_name },
          { type: 'text', text: props.library_contact },
        ]);

      return await whatsappBody.sendMessage();
    } catch (error) {
      console.error('Error sending first reminder plan renewal notification:', error);
      this.handleAxiosError(error);
    }
  }

  // Send second reminder plan renewal notification via WhatsApp Web
  private async sendSecondReminderPlanRenewalViaWhatsAppWeb(sessionId: string, props: FirstReminderPlanRenewalPendingV1Dto): Promise<any> {
    try {
      if (!this.webjsService) {
        throw new Error('WhatsApp Web service not available');
      }

      // Format phone number for WhatsApp Web (remove + and ensure country code)
      let phoneNumber = props.receiver_mobile_number.replace(/\D/g, ''); // Remove all non-digits

      // Add country code if not present (assuming Indian numbers)
      if (!phoneNumber.startsWith('91') && phoneNumber.length === 10) {
        phoneNumber = `91${phoneNumber}`;
      }

      // Create second reminder plan renewal notification message using the new template
      const messageContent = `*${props.library_name}*
📢 Second Reminder – Fee Pending

Hello *${props.member_name}*,
This is a gentle reminder that your fee is pending. Kindly complete payment at the earliest to avoid interruption.

Please follow these steps:

① Visit: https://${props.library_url}.abhyasika.online
② Login with your number.
③ Tap the profile icon (top-right). (Reload the page if it's not visible.)
④ Click on "Plan Continuation"
⑤ Scan the QR code & make the payment
⑥ Click "New Payment Request", upload the payment screenshot, fill in the details & submit

📞 If you're facing any issues or need help, feel free to contact us.

Thank you!
– *${props.library_name}*
‪*+91${props.library_contact}*`;

      console.log(`📝 Second reminder plan renewal notification message content prepared:`, messageContent);

      // Send via WhatsApp Web
      const result = await this.webjsService.sendMessage({
        session_id: sessionId,
        to: phoneNumber, // Send without + prefix, WebJS will add @c.us
        message: messageContent
      });

      // Check if the result indicates success
      if (result && result.success) {
        console.log(`✅ Second reminder plan renewal notification sent via WhatsApp Web to ${phoneNumber}, message ID: ${result.message_id}`);
        return result;
      } else {
        const errorMsg = result?.error || 'Unknown error occurred';
        console.error(`❌ WhatsApp Web message failed: ${errorMsg}`);
        throw new Error(`WhatsApp Web sending failed: ${errorMsg}`);
      }
    } catch (error) {
      console.error(`❌ Failed to send second reminder plan renewal notification via WhatsApp Web:`, error);
      throw error;
    }
  }

  async send_second_reminder_plan_renewal_pending_v1(props: FirstReminderPlanRenewalPendingV1Dto) {
    // Validate required fields
    if (!props.receiver_mobile_number || props.receiver_mobile_number === 'null' || props.receiver_mobile_number.trim() === '') {
      console.error('Invalid receiver mobile number provided for second reminder plan renewal notification')
      return {
        data: 'Invalid receiver mobile number',
        success: false
      }
    }

    try {
      // Step 1: Check if library has an active WhatsApp Web session
      console.log(`🔍 Checking for WhatsApp Web session for library: ${props.library_url}`);
      const whatsappWebSession = await this.checkForWhatsAppWebSession(props.library_url);

      if (whatsappWebSession) {
        console.log(`📱 Found active WhatsApp Web session for library ${props.library_url}, sending second reminder plan renewal notification via WhatsApp Web...`);
        console.log(`🔧 WebJS Service available: ${!!this.webjsService}`);

        try {
          const result = await this.sendSecondReminderPlanRenewalViaWhatsAppWeb(whatsappWebSession.session_id, props);
          console.log(`✅ WhatsApp Web second reminder plan renewal notification completed successfully`);

          // Create billing record for WhatsApp Web usage
          await this.billing_service.create_whatsapp_billing({
            library_url: props.library_url,
          });

          return result;
        } catch (webError) {
          console.error(`❌ WhatsApp Web sending failed, falling back to API:`, webError.message);
          // Fall through to API method
        }
      } else {
        console.log(`📞 No WhatsApp Web session found for library ${props.library_url}`);
      }

      // Step 2: Fallback to API if no WhatsApp Web session or if WhatsApp Web failed
      console.log(`📞 Sending second reminder plan renewal notification via API method...`);

      const whatsappBody = new WhatsappBodyDto(
        'second_reminder__plan_renewal_pending',
        props.receiver_mobile_number,
        props.library_url
      ).addHeaderComponent([
        { type: 'text', text: props.library_name }
      ])
        .addBodyComponent([
          { type: 'text', text: props.member_name },
          { type: 'text', text: props.library_url },
          { type: 'text', text: props.library_name },
          { type: 'text', text: props.library_contact }
        ]);

      return await whatsappBody.sendMessage();
    } catch (error) {
      console.error('Error sending second reminder plan renewal notification:', error);
      this.handleAxiosError(error);
    }
  }

  // Send third reminder plan renewal notification via WhatsApp Web
  private async sendThirdReminderPlanRenewalViaWhatsAppWeb(sessionId: string, props: FirstReminderPlanRenewalPendingV1Dto): Promise<any> {
    try {
      if (!this.webjsService) {
        throw new Error('WhatsApp Web service not available');
      }

      // Format phone number for WhatsApp Web (remove + and ensure country code)
      let phoneNumber = props.receiver_mobile_number.replace(/\D/g, ''); // Remove all non-digits

      // Add country code if not present (assuming Indian numbers)
      if (!phoneNumber.startsWith('91') && phoneNumber.length === 10) {
        phoneNumber = `91${phoneNumber}`;
      }

      // Create third reminder plan renewal notification message using the new template
      const messageContent = `*${props.library_name}*
📢 Final Reminder – Immediate Action Required

Hello *${props.member_name}*,
This is the final reminder regarding your pending library plan renewal. Despite multiple notifications, your plan is still not renewed.

⚠ Your current seat has been allocated to another member.
If we do not receive your payment immediately, your membership will be cancelled.

Please complete the renewal process now:

① Visit: https://${props.library_url}.abhyasika.online
② Login with your number
③ Tap the profile icon (top-right). (Reload if not visible.)
④ Click Plan Continuation
⑤ Scan the QR code & make the payment
⑥ Click New Payment Request, upload the payment screenshot, fill in the details & submit

💬 If you're facing any issues, please contact us immediately.
This is your final opportunity to continue your membership.

Thank you,
– *${props.library_name}*
‪*+91${props.library_contact}*`;

      console.log(`📝 Third reminder plan renewal notification message content prepared:`, messageContent);

      // Send via WhatsApp Web
      const result = await this.webjsService.sendMessage({
        session_id: sessionId,
        to: phoneNumber, // Send without + prefix, WebJS will add @c.us
        message: messageContent
      });

      // Check if the result indicates success
      if (result && result.success) {
        console.log(`✅ Third reminder plan renewal notification sent via WhatsApp Web to ${phoneNumber}, message ID: ${result.message_id}`);
        return result;
      } else {
        const errorMsg = result?.error || 'Unknown error occurred';
        console.error(`❌ WhatsApp Web message failed: ${errorMsg}`);
        throw new Error(`WhatsApp Web sending failed: ${errorMsg}`);
      }
    } catch (error) {
      console.error(`❌ Failed to send third reminder plan renewal notification via WhatsApp Web:`, error);
      throw error;
    }
  }

  async send_third_reminder_plan_renewal_pending_v1(props: FirstReminderPlanRenewalPendingV1Dto) {
    // Validate required fields
    if (!props.receiver_mobile_number || props.receiver_mobile_number === 'null' || props.receiver_mobile_number.trim() === '') {
      console.error('Invalid receiver mobile number provided for third reminder plan renewal notification')
      return {
        data: 'Invalid receiver mobile number',
        success: false
      }
    }

    try {
      // Step 1: Check if library has an active WhatsApp Web session
      console.log(`🔍 Checking for WhatsApp Web session for library: ${props.library_url}`);
      const whatsappWebSession = await this.checkForWhatsAppWebSession(props.library_url);

      if (whatsappWebSession) {
        console.log(`📱 Found active WhatsApp Web session for library ${props.library_url}, sending third reminder plan renewal notification via WhatsApp Web...`);
        console.log(`🔧 WebJS Service available: ${!!this.webjsService}`);

        try {
          const result = await this.sendThirdReminderPlanRenewalViaWhatsAppWeb(whatsappWebSession.session_id, props);
          console.log(`✅ WhatsApp Web third reminder plan renewal notification completed successfully`);

          // Create billing record for WhatsApp Web usage
          await this.billing_service.create_whatsapp_billing({
            library_url: props.library_url,
          });

          return result;
        } catch (webError) {
          console.error(`❌ WhatsApp Web sending failed, falling back to API:`, webError.message);
          // Fall through to API method
        }
      } else {
        console.log(`📞 No WhatsApp Web session found for library ${props.library_url}`);
      }

      // Step 2: Fallback to API if no WhatsApp Web session or if WhatsApp Web failed
      console.log(`📞 Sending third reminder plan renewal notification via API method...`);

      const whatsappBody = new WhatsappBodyDto(
        'final_reminder__immediate_action_required',
        props.receiver_mobile_number,
        props.library_url
      ).addHeaderComponent([
        { type: 'text', text: props.library_name }
      ])
        .addBodyComponent([
          { type: 'text', text: props.member_name },
          { type: 'text', text: props.library_url },
          { type: 'text', text: props.library_name },
          { type: 'text', text: props.library_contact }
        ]);

      return await whatsappBody.sendMessage();
    } catch (error) {
      console.error('Error sending third reminder plan renewal notification:', error);
      this.handleAxiosError(error);
    }
  }

  async send_payment_screenshot_upload(props: PaymentScreenshotUploadDto) {
    try {
      const whatsappBody = new WhatsappBodyDto(
        'payment_screenshot_upload',
        props.receiver_mobile_number,
        props.library_url
      )
        .addBodyComponent([
          { type: 'text', text: props.student_name },
          { type: 'text', text: new Date(props.timestamp).toLocaleString() },
          { type: 'text', text: props.student_name },
          { type: 'text', text: props.student_phone_number },
          { type: 'text', text: props.branch_name },
        ]);

      return await whatsappBody.sendMessage();
    } catch (error) {
      console.error(error);
      this.handleAxiosError(error);
    }
  }
}
