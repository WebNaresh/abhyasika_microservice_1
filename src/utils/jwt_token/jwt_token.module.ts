import { Global, Module } from '@nestjs/common';
import { JwtTokenService } from './jwt_token.service';

@Global()
@Module({
  providers: [JwtTokenService],
  exports: [JwtTokenService],
})
export class JwtTokenModule {}
