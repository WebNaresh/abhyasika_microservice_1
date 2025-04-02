import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { FirebasePushNotificationService } from './firebase_push_notification.service';

@ApiTags('Firebase Push Notification')
@Controller('firebase-push-notification')
export class FirebasePushNotificationController {
  constructor(private readonly firebasePushNotificationService: FirebasePushNotificationService) { }

  // add fcm token to user with user_id with params
  @ApiOperation({ summary: 'Add FCM Token to User' })
  @ApiParam({ name: 'user_id', description: 'User ID', example: "f3RDl1dnTSOTwzo33tl6iE:APA91bEMRh9Lx9ZIo8kojgkZKST0-zOO7gPNsJH84G1wOULYxMOy8s4rUzdBwSEZr47kPmEPWrzP_QaE5hGU0ckK4sffSfuLg-7PyXDY8ysRmJEpCD72JPI" })
  @ApiBody({ schema: { type: 'object', properties: { fcm_token: { type: 'string' } } } })
  @Post('add-fcm-token/:user_id')
  addFcmToken(@Param('user_id') user_id: string, @Body() body: { fcm_token: string }) {
    return this.firebasePushNotificationService.addFcmToken(user_id, body.fcm_token);
  }

}
