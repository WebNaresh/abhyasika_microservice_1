import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
    public app: admin.app.App;

    constructor() {
        this.app = admin.initializeApp({
            credential: admin.credential.cert({
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY,
                projectId: process.env.FIREBASE_PROJECT_ID,
            }),
        });
    }

    async onModuleInit() {
        console.log('Initializing Firebase Admin...');
        try {
            await this.app.messaging();
            console.log('Firebase Admin initialized successfully');
        } catch (error) {
            console.error('Error initializing Firebase Admin');
            console.error(error);
        }
    }
}
