import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
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



