import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/utils/database/database.service';
import { FirebaseAdminService } from 'src/utils/firebase_admin/firebase_admin.service';
@Injectable()
export class FirebasePushNotificationService {
    constructor(
        private readonly database: DatabaseService,
        private readonly firebaseAdmin: FirebaseAdminService
    ) { }

    async addFcmToken(user_id: string, fcm_token: string) {
        console.log(`🚀 ~ FirebasePushNotificationService ~ addFcmToken:`, user_id, fcm_token)
        const user = await this.database.user.findUnique({
            where: {
                id: user_id
            },

        });
        if (!user) {
            throw new Error('User not found');
        }
        // check if fcm_token is already in the database
        const fcm_token_exists = user.firebase_token.every(token => token !== fcm_token)
        if (!fcm_token_exists) {
            throw new Error('Fcm token already exists');
        }



        await this.database.user.update({
            where: {
                id: user_id
            },
            data: {
                firebase_token: {
                    push: fcm_token
                }
            }
        })

    }
}
