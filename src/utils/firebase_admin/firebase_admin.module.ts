import { Global, Module } from '@nestjs/common';
import { FirebaseAdminService } from './firebase_admin.service';

@Global()
@Module({
  providers: [FirebaseAdminService],
  exports: [FirebaseAdminService],
})
export class FirebaseAdminModule { }
