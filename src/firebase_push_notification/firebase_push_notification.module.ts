import { Module } from '@nestjs/common';
import { FirebasePushNotificationService } from './firebase_push_notification.service';
import { FirebasePushNotificationController } from './firebase_push_notification.controller';

@Module({
  controllers: [FirebasePushNotificationController],
  providers: [FirebasePushNotificationService],
})
export class FirebasePushNotificationModule {}
