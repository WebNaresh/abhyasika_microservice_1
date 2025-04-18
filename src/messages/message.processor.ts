import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AdmissionDto } from 'src/utils/whatsapp/dto/admission.dto';
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

            await this.whatsapp.send_first_remindar_reservation(send_whatsapp).catch((error) => {
                // Continue processing even if there's an error
                return;
            });

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

            await this.whatsapp.second_remindar_reservation(send_whatsapp).catch((error) => {
                // Continue processing even if there's an error
                return;
            });

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

            await this.whatsapp.last_remindar_reservation(send_whatsapp).catch((error) => {
                // Continue processing even if there's an error
                return;
            });

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

        } catch (error) {
            console.error('Error in message processor:', error);
        }
    }
}



