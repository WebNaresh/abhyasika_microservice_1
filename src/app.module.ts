import { BullModule } from '@nestjs/bullmq';
import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ModuleRef } from '@nestjs/core';
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
import { WebjsModule } from './webjs/webjs.module';


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
    CronModule,
    WebjsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly moduleRef: ModuleRef) { }

  async onModuleInit() {
    // Set up cross-injection between services to avoid circular dependency
    try {
      const { WebjsService } = await import('./webjs/webjs.service');
      const { WhatsappService } = await import('./utils/whatsapp/whatsapp.service');

      // Get service instances from DI container
      const webjsInstance = this.moduleRef.get(WebjsService, { strict: false });
      const whatsappInstance = this.moduleRef.get(WhatsappService, { strict: false });

      console.log(`🔧 WebJS Service instance found: ${!!webjsInstance}`);
      console.log(`🔧 WhatsApp Service instance found: ${!!whatsappInstance}`);

      if (webjsInstance && whatsappInstance) {
        webjsInstance.setWhatsappService(whatsappInstance);
        console.log('✅ Cross-injection between WebJS and WhatsApp services established');
      } else {
        console.error('❌ One or both services not found for cross-injection');
      }
    } catch (error) {
      console.error('❌ Failed to set up cross-injection:', error);
    }
  }
}
