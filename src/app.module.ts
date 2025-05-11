import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FirebasePushNotificationModule } from './firebase_push_notification/firebase_push_notification.module';

import { CronModule } from './cron/cron.module';
import { MessageModule } from './messages/message.module';
import { CryptoClientModule } from './utils/crypto_client/crypto_client.module';
import { DatabaseModule } from './utils/database/database.module';
import { EmailModule } from './utils/email/email.module';
import { Fast2SmsModule } from './utils/fast_2_sms/fast_2_sms.module';
import { FirebaseAdminModule } from './utils/firebase_admin/firebase_admin.module';
import { JwtTokenModule } from './utils/jwt_token/jwt_token.module';
import { RazorPayClientModule } from './utils/razor_pay_client/razor_pay_client.module';
import { S3Module } from './utils/s3/s3.module';
import { WhatsappModule } from './utils/whatsapp/whatsapp.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // cache: true,
    }),
    ScheduleModule.forRoot(),
    BullModule.forRoot(
      {
        connection: {
          host: "redis-15227.c8.us-east-1-2.ec2.redns.redis-cloud.com",
          port: 15227,
          password: "jgXQwDNDe7s8xaIhFBOpEFUk773hD5sc",
          username: "default"
        }
      }
    ),
    DatabaseModule,
    EmailModule,
    JwtTokenModule,
    S3Module,
    Fast2SmsModule,
    WhatsappModule,
    CryptoClientModule,
    RazorPayClientModule,
    FirebaseAdminModule,
    FirebasePushNotificationModule,
    MessageModule,
    CronModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
