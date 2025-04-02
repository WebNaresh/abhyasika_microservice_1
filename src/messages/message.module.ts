import { BullModule } from '@nestjs/bullmq';
import { Module, OnModuleInit } from '@nestjs/common';
import { MessageProcessor25th, MessageProcessor27th, MessageProcessor28th } from './message.processor';

const connection = {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
    username: process.env.REDIS_USERNAME
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
    ],
    providers: [MessageProcessor25th, MessageProcessor27th, MessageProcessor28th],
})
export class MessageModule implements OnModuleInit {
    onModuleInit() {
        console.log('MessageModule initialized');
    }
}
