import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AdmissionDto } from 'src/utils/whatsapp/dto/admission.dto';
import { ConfirmationTemplateDto } from 'src/utils/whatsapp/dto/create-whatsapp.dto';
import { FirstReminderPlanRenewalPendingV1Dto } from 'src/utils/whatsapp/dto/first_reminder__plan_renewal_pending_v1.dto';
import { InterestedMessageDto } from 'src/utils/whatsapp/dto/interested_message.dto';
import { PaymentReceivedNotificationDto } from 'src/utils/whatsapp/dto/payment_received_notification.dto';
import { PaymentRequestRejectedDto } from 'src/utils/whatsapp/dto/payment_request_rejected.dto';
import { WhatsappService } from 'src/utils/whatsapp/whatsapp.service';

@Processor('messageQueueFor25thOfMonth')
export class MessageProcessor25th extends WorkerHost {
    constructor(private readonly whatsapp: WhatsappService) {
        super();
    }
    async process(job: Job) {
        try {
            const send_whatsapp = job.data.content;
            console.log(job.data);

            if (process.env.ENV !== 'development') {

                await this.whatsapp.send_first_remindar_reservation(send_whatsapp).catch((error) => {
                    // Continue processing even if there's an error
                    return;
                });
            }

            console.log(`Message ${job.id} processed successfully`);
        } catch (error) {
            console.error('Error in message processor:', error);
            // Don't throw the error, just log it and continue
        }
    }
}

@Processor('messageQueueFor27thOfMonth')
export class MessageProcessor27th extends WorkerHost {
    constructor(private readonly whatsapp: WhatsappService) {
        super();
    }
    async process(job: Job) {
        try {
            const send_whatsapp = job.data.content;
            console.log(job.data);

            if (process.env.ENV !== 'development') {

                await this.whatsapp.second_remindar_reservation(send_whatsapp).catch((error) => {
                    // Continue processing even if there's an error
                    return;
                });
            }

            console.log(`Message ${job.id} processed successfully`);
        } catch (error) {
            console.error('Error in message processor:', error);
            // Don't throw the error, just log it and continue
        }
    }
}
@Processor('messageQueueFor28thOfMonth')
export class MessageProcessor28th extends WorkerHost {
    constructor(private readonly whatsapp: WhatsappService) {
        super();
    }
    async process(job: Job) {
        try {
            const send_whatsapp = job.data.content;
            console.log(job.data);

            if (process.env.ENV !== 'development') {

                await this.whatsapp.last_remindar_reservation(send_whatsapp).catch((error) => {
                    // Continue processing even if there's an error
                    return;
                });
            }

            console.log(`Message ${job.id} processed successfully`);
        } catch (error) {
            console.error('Error in message processor:', error);
            // Don't throw the error, just log it and continue
        }
    }
}

@Processor('admissionMessageQueue')
export class AdmissionMessageProcessor extends WorkerHost {
    constructor(private readonly whatsapp: WhatsappService) {
        super();
    }
    async process(job: Job) {
        console.log(`🚀 ~ AdmissionMessageProcessor ~ job:`, job)
        try {
            const send_whatsapp: AdmissionDto = job.data.content;
            console.log(job.data);

            if (process.env.ENV !== 'development') {

                await this.whatsapp.send_admission_notification(send_whatsapp).catch((error) => {
                    console.log(`🚀 ~ AdmissionMessageProcessor ~ error:`, error)
                    // Continue processing even if there's an error
                    return;
                });

                await this.whatsapp.send_admission_notification_admin({
                    library_name: send_whatsapp.library_name,
                    student_name: send_whatsapp.student_name,
                    branch_name: send_whatsapp.branch_name,
                    room_name: send_whatsapp.room_name,
                    desk_name: send_whatsapp.desk_name,
                    plan_name: send_whatsapp.plan_name,
                    plan_start_date: send_whatsapp.admission_date,
                    plan_end_date: send_whatsapp.admission_end_date,
                    library_contact: send_whatsapp.library_contact_no,
                    library_url: send_whatsapp.library_url,
                }).catch((error) => {
                    console.log(`🚀 ~ AdmissionMessageProcessor ~ error:`, error)
                    // Continue processing even if there's an error
                    return;
                });
            }

        } catch (error) {
            console.error('Error in message processor:', error);
        }
    }
}

@Processor('interestedInAdmissionMessageQueue')
export class InterestedInAdmissionMessageProcessor extends WorkerHost {
    constructor(private readonly whatsapp: WhatsappService) {
        super();
    }
    async process(job: Job) {
        try {
            const send_whatsapp: InterestedMessageDto = job.data.content;
            console.log(job.data);

            if (process.env.ENV !== 'development') {
                await this.whatsapp.send_interested_notification(send_whatsapp).catch((error) => {
                    console.log(`🚀 ~ InterestedInAdmissionMessageProcessor ~ error:`, error)
                    return;
                });
            }
        } catch (error) {
            console.error('Error in message processor:', error);
        }
    }
}

@Processor('librarySeatConfirmationQueue')
export class LibrarySeatConfirmationProcessor extends WorkerHost {
    constructor(private readonly whatsapp: WhatsappService) {
        super();
    }
    async process(job: Job) {
        try {
            const send_whatsapp: ConfirmationTemplateDto = job.data.content;
            console.log(job.data);

            // if (process.env.ENV !== 'development') {
            await this.whatsapp.confirmation_template(send_whatsapp).catch((error) => {
                console.log(`🚀 ~ LibrarySeatConfirmationProcessor ~ error:`, error)
            });
            // }
        } catch (error) {
            console.error('Error in message processor:', error);
        }
    }
}

@Processor('paymentReceivedNotificationQueue')
export class PaymentReceivedNotificationProcessor extends WorkerHost {
    constructor(private readonly whatsapp: WhatsappService) {
        super();
    }
    async process(job: Job) {
        try {
            const send_whatsapp: PaymentReceivedNotificationDto = job.data.content;
            console.log(job.data);

            if (process.env.ENV !== 'development') {
                await this.whatsapp.send_payment_received_notification(send_whatsapp).catch((error) => {
                    console.log(`🚀 ~ PaymentReceivedNotificationProcessor ~ error:`, error)
                    return;
                });
            }
        } catch (error) {
            console.error('Error in message processor:', error);
        }
    }
}

@Processor('paymentRequestRejectedQueue')
export class PaymentRequestRejectedProcessor extends WorkerHost {
    constructor(private readonly whatsapp: WhatsappService) {
        super();
    }
    async process(job: Job) {
        try {
            const send_whatsapp: PaymentRequestRejectedDto = job.data.content;
            console.log(job.data);

            if (process.env.ENV !== 'development') {
                await this.whatsapp.send_payment_request_rejected(send_whatsapp).catch((error) => {
                    console.log(`🚀 ~ PaymentRequestRejectedProcessor ~ error:`, error)
                    return;
                });
            }
        } catch (error) {
            console.error('Error in message processor:', error);
        }
    }
}

@Processor('firstReminderPlanRenewalPendingV1Queue')
export class FirstReminderPlanRenewalPendingV1Processor extends WorkerHost {
    constructor(private readonly whatsapp: WhatsappService) {
        super();
    }
    async process(job: Job) {
        try {
            const send_whatsapp: FirstReminderPlanRenewalPendingV1Dto = job.data.content;
            console.log(job.data);

            if (process.env.ENV !== 'development') {
                await this.whatsapp.send_first_reminder_plan_renewal_pending_v1(send_whatsapp).catch((error) => {
                    console.log(`🚀 ~ FirstReminderPlanRenewalPendingV1Processor ~ error:`, error)
                    return;
                });
            }
        } catch (error) {
            console.error('Error in message processor:', error);
        }
    }
}

@Processor('secondReminderPlanRenewalPendingV1Queue')
export class SecondReminderPlanRenewalPendingV1Processor extends WorkerHost {
    constructor(private readonly whatsapp: WhatsappService) {
        super();
    }
    async process(job: Job) {
        try {
            const send_whatsapp: FirstReminderPlanRenewalPendingV1Dto = job.data.content;
            console.log(job.data);

            if (process.env.ENV !== 'development') {
                await this.whatsapp.send_second_reminder_plan_renewal_pending_v1(send_whatsapp).catch((error) => {
                    console.log(`🚀 ~ SecondReminderPlanRenewalPendingV1Processor ~ error:`, error)
                    return;
                });
            }
        } catch (error) {
            console.error('Error in message processor:', error);
        }
    }
}

@Processor('thirdReminderPlanRenewalPendingV1Queue')
export class ThirdReminderPlanRenewalPendingV1Processor extends WorkerHost {
    constructor(private readonly whatsapp: WhatsappService) {
        super();
    }
    async process(job: Job) {
        try {
            const send_whatsapp: FirstReminderPlanRenewalPendingV1Dto = job.data.content;
            console.log(job.data);

            if (process.env.ENV !== 'development') {
                await this.whatsapp.send_third_reminder_plan_renewal_pending_v1(send_whatsapp).catch((error) => {
                    console.log(`🚀 ~ ThirdReminderPlanRenewalPendingV1Processor ~ error:`, error)
                    return;
                });
            }
        } catch (error) {
            console.error('Error in message processor:', error);
        }
    }
}
