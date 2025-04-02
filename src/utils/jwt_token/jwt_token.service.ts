import { Injectable } from '@nestjs/common';
import { decode, JwtPayload, sign } from 'jsonwebtoken';

@Injectable()
export class JwtTokenService {
  private readonly private_key: string = process.env.JWT_SECRET;
  async generateToken(payload: any) {
    return sign(payload, this.private_key, { expiresIn: 365 * 24 * 60 * 60 });
  }
  async verifyToken(token: string) {
    const decodedToken = decode(token);
    console.log(
      `🚀 ~ file: jwt_token.service.ts:12 ~ JwtTokenService ~ decodedToken:`,
      decodedToken,
    );

    return decodedToken as JwtPayload;
  }
}
