import { BullModule } from '@nestjs/bullmq';
import { Module, OnModuleInit } from '@nestjs/common';
import { ConnectionOptions } from 'bullmq';
import { AdmissionMessageProcessor, DuePaymentReminderNotificationProcessor, FirstReminderPlanRenewalPendingV1Processor, InterestedInAdmissionMessageProcessor, LibrarySeatConfirmationProcessor, MessageProcessor25th, MessageProcessor27th, MessageProcessor28th, PaymentReceivedNotificationProcessor, PaymentRequestRejectedProcessor, SecondReminderPlanRenewalPendingV1Processor, ThirdReminderPlanRenewalPendingV1Processor } from './message.processor';

const connection: ConnectionOptions = {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
    username: process.env.REDIS_USERNAME,
    tls: {
        rejectUnauthorized: false
    }
}
@Module({
    imports: [
        BullModule.registerQueue({
            name: 'messageQueueFor25thOfMonth',
            connection
        }),
        BullModule.registerQueue({
            name: 'messageQueueFor27thOfMonth',
            connection
        }),
        BullModule.registerQueue({
            name: 'messageQueueFor28thOfMonth',
            connection
        }),
        BullModule.registerQueue({
            name: 'admissionMessageQueue',
            connection
        }),
        BullModule.registerQueue({
            name: 'interestedInAdmissionMessageQueue',
            connection
        }),
        BullModule.registerQueue({
            name: 'librarySeatConfirmationQueue',
            connection
        }),
        BullModule.registerQueue({
            name: 'paymentReceivedNotificationQueue',
            connection
        }),
        BullModule.registerQueue({
            name: 'paymentRequestRejectedQueue',
            connection
        }),
        BullModule.registerQueue({
            name: 'firstReminderPlanRenewalPendingV1Queue',
            connection
        }),
        BullModule.registerQueue({
            name: 'secondReminderPlanRenewalPendingV1Queue',
            connection
        }),
        BullModule.registerQueue({
            name: 'thirdReminderPlanRenewalPendingV1Queue',
            connection
        }),
        BullModule.registerQueue({
            name: 'duePaymentReminderNotificationQueue',
            connection
        }),
    ],
    providers: [MessageProcessor25th, MessageProcessor27th, MessageProcessor28th, AdmissionMessageProcessor, InterestedInAdmissionMessageProcessor, LibrarySeatConfirmationProcessor, PaymentReceivedNotificationProcessor, PaymentRequestRejectedProcessor, FirstReminderPlanRenewalPendingV1Processor, SecondReminderPlanRenewalPendingV1Processor, ThirdReminderPlanRenewalPendingV1Processor, DuePaymentReminderNotificationProcessor],
})
export class MessageModule implements OnModuleInit {
    onModuleInit() {
        console.log('MessageModule initialized');
    }
}
