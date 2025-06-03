import { BullModule } from '@nestjs/bullmq';
import { Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConnectionOptions } from 'bullmq';
import { AbhyasikaPaymentReceiptProcessor, AbhyasikaPendingPaymentProcessor, AdmissionMessageProcessor, DuePaymentReminderNotificationProcessor, FirstReminderPlanRenewalPendingV1Processor, InterestedInAdmissionMessageProcessor, LibrarySeatConfirmationProcessor, MessageProcessor25th, MessageProcessor27th, MessageProcessor28th, PaymentReceivedNotificationProcessor, PaymentRequestRejectedProcessor, SecondReminderPlanRenewalPendingV1Processor, ThirdReminderPlanRenewalPendingV1Processor } from './message.processor';
import { MessageService } from './message.service';

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
        BullModule.registerQueue({
            name: 'abhyasikaPendingPaymentQueue',
            connection
        }),
        BullModule.registerQueue({
            name: 'abhyasikaPaymentReceiptQueue',
            connection
        }),
        BullModule.registerQueue({
            name: 'paymentScreenshotUploadQueue',
            connection
        }),
    ],
    providers: [MessageProcessor25th, MessageProcessor27th, MessageProcessor28th, AdmissionMessageProcessor, InterestedInAdmissionMessageProcessor, LibrarySeatConfirmationProcessor, PaymentReceivedNotificationProcessor, PaymentRequestRejectedProcessor, FirstReminderPlanRenewalPendingV1Processor, SecondReminderPlanRenewalPendingV1Processor, ThirdReminderPlanRenewalPendingV1Processor, DuePaymentReminderNotificationProcessor, AbhyasikaPendingPaymentProcessor, AbhyasikaPaymentReceiptProcessor, MessageService],
    exports: [MessageService],
})
export class MessageModule implements OnModuleInit, OnModuleDestroy {
    onModuleInit() {
        console.log('MessageModule initialized');
    }

    onModuleDestroy() {
        console.log('MessageModule is being destroyed');
        // BullMQ queues are automatically closed by the BullModule
        // but we can add any additional cleanup here if needed
    }
}
