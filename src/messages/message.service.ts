import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AbhyasikaPendingPaymentDto } from 'src/utils/whatsapp/dto/abhyasika_pending_payment.dto';
import { AdmissionDto } from 'src/utils/whatsapp/dto/admission.dto';
import { ConfirmationTemplateDto } from 'src/utils/whatsapp/dto/create-whatsapp.dto';
import { DuePaymentReminderDto } from 'src/utils/whatsapp/dto/due_payment_reminder.dto';
import { FirstReminderPlanRenewalPendingV1Dto } from 'src/utils/whatsapp/dto/first_reminder__plan_renewal_pending_v1.dto';
import { InterestedMessageDto } from 'src/utils/whatsapp/dto/interested_message.dto';
import { PaymentReceivedNotificationDto } from 'src/utils/whatsapp/dto/payment_received_notification.dto';
import { PaymentReceiptDto } from 'src/utils/whatsapp/dto/payment_reciept.dto';
import { PaymentRequestRejectedDto } from 'src/utils/whatsapp/dto/payment_request_rejected.dto';

@Injectable()
export class MessageService {
    constructor(
        @InjectQueue('messageQueueFor25thOfMonth') private messageQueue: Queue,
        @InjectQueue('messageQueueFor27thOfMonth') private messageQueueFor27thOfMonth: Queue,
        @InjectQueue('messageQueueFor28thOfMonth') private messageQueueFor28thOfMonth: Queue,
        @InjectQueue('admissionMessageQueue') private admissionMessageQueue: Queue,
        @InjectQueue('interestedInAdmissionMessageQueue') private interestedInAdmissionMessageQueue: Queue,
        @InjectQueue('librarySeatConfirmationQueue') private librarySeatConfirmationQueue: Queue,
        @InjectQueue('paymentReceivedNotificationQueue') private paymentReceivedNotificationQueue: Queue,
        @InjectQueue('paymentRequestRejectedQueue') private paymentRequestRejectedQueue: Queue,
        @InjectQueue('firstReminderPlanRenewalPendingV1Queue') private firstReminderPlanRenewalPendingV1Queue: Queue,
        @InjectQueue('secondReminderPlanRenewalPendingV1Queue') private secondReminderPlanRenewalPendingV1Queue: Queue,
        @InjectQueue('thirdReminderPlanRenewalPendingV1Queue') private thirdReminderPlanRenewalPendingV1Queue: Queue,
        @InjectQueue('duePaymentReminderNotificationQueue') private duePaymentReminderNotificationQueue: Queue,
        @InjectQueue('abhyasikaPendingPaymentQueue') private abhyasikaPendingPaymentQueue: Queue,
        @InjectQueue('abhyasikaPaymentReceiptQueue') private abhyasikaPaymentReceiptQueue: Queue,
    ) { }

    async firstReminder(messages: any[]) {
        console.log('Adding messages to the queue:', messages);
        const jobs = messages.map((message, index) =>
            this.messageQueue.add('sendMessage', { id: index, content: message, }),
        );
        await Promise.all(jobs);
    }

    async secondReminder(messages: any[]) {
        console.log('Adding messages to the queue:', messages);
        const jobs = messages.map((message, index) =>
            this.messageQueueFor27thOfMonth.add('sendMessage', { id: index, content: message, }),
        );
        await Promise.all(jobs);
    }

    async thirdReminder(messages: any[]) {
        console.log('Adding messages to the queue:', messages);
        const jobs = messages.map((message, index) =>
            this.messageQueueFor28thOfMonth.add('sendMessage', { id: index, content: message, }),
        );
    }

    async admissionMessage(messages: AdmissionDto) {
        console.log('Adding messages to the queue:', messages);
        this.admissionMessageQueue.add('sendMessage', { id: new Date().getTime(), content: messages });
    }

    async interestedInAdmissionMessage(messages: InterestedMessageDto) {
        console.log('Adding messages to the queue:', messages);
        this.interestedInAdmissionMessageQueue.add('sendMessage', { id: new Date().getTime(), content: messages });
    }

    async librarySeatConfirmationMessage(messages: ConfirmationTemplateDto) {
        console.log('Adding messages to the queue:', messages);
        this.librarySeatConfirmationQueue.add('sendMessage', { id: new Date().getTime(), content: messages });
    }

    async paymentReceivedNotification(message: PaymentReceivedNotificationDto) {
        console.log('Adding payment received notification to the queue:', message);
        this.paymentReceivedNotificationQueue.add('sendMessage', { id: new Date().getTime(), content: message });
    }

    async paymentRequestRejected(message: PaymentRequestRejectedDto) {
        console.log('Adding payment request rejected notification to the queue:', message);
        this.paymentRequestRejectedQueue.add('sendMessage', { id: new Date().getTime(), content: message });
    }

    async firstReminderPlanRenewalPendingV1(message: FirstReminderPlanRenewalPendingV1Dto) {
        console.log('Adding first reminder plan renewal pending v1 to the queue:', message);
        this.firstReminderPlanRenewalPendingV1Queue.add('sendMessage', { id: new Date().getTime(), content: message });
    }

    async secondReminderPlanRenewalPendingV1(message: FirstReminderPlanRenewalPendingV1Dto) {
        console.log('Adding second reminder plan renewal pending v1 to the queue:', message);
        this.secondReminderPlanRenewalPendingV1Queue.add('sendMessage', { id: new Date().getTime(), content: message });
    }

    async thirdReminderPlanRenewalPendingV1(message: FirstReminderPlanRenewalPendingV1Dto) {
        console.log('Adding third reminder plan renewal pending v1 to the queue:', message);
        this.thirdReminderPlanRenewalPendingV1Queue.add('sendMessage', { id: new Date().getTime(), content: message });
    }

    async duePaymentReminderNotification(message: DuePaymentReminderDto) {
        console.log('Adding due payment reminder notification to the queue:', message);
        this.duePaymentReminderNotificationQueue.add('sendMessage', { id: new Date().getTime(), content: message });
    }
    async abhyasikaPendingPayment(message: AbhyasikaPendingPaymentDto) {
        console.log('Adding abhyasika pending payment to the queue:', message);
        this.abhyasikaPendingPaymentQueue.add('sendMessage', { id: new Date().getTime(), content: message });
    }

    async abhyasikaPaymentReceipt(message: PaymentReceiptDto) {
        console.log('Adding abhyasika payment receipt to the queue:', message);
        this.abhyasikaPaymentReceiptQueue.add('sendMessage', { id: new Date().getTime(), content: message });
    }
}
