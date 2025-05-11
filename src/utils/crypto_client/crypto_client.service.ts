import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto-browserify';


import { UpdateCryptoClientDto } from './dto/update-crypto_client.dto';

@Injectable()
export class CryptoClientService {
  secret: string;
  constructor() {
    this.secret = process.env.CRYPTO_SECRET;
  }
  encrypt(text: string) {
    console.log(
      `🚀 ~ file: crypto_client.service.ts:12 ~ CryptoClientService ~ text:`,
      text,
    );
    const algorithm = 'aes-256-cbc';
    const iv = crypto.randomBytes(16); // Initialization vector
    const cipher = crypto.createCipheriv(
      algorithm,
      crypto
        .createHash('sha256')
        .update(this.secret)
        .digest('base64')
        .substr(0, 32),
      iv,
    );

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  async decrypt(text: string) {
    const algorithm = 'aes-256-cbc';
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(
      algorithm,
      crypto
        .createHash('sha256')
        .update(this.secret)
        .digest('base64')
        .substr(0, 32),
      iv,
    );

    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString();
  }

  findOne(id: number) {
    return `This action returns a #${id} cryptoClient`;
  }

  update(id: number, updateCryptoClientDto: UpdateCryptoClientDto) {
    return `This action updates a #${id} cryptoClient`;
  }

  remove(id: number) {
    return `This action removes a #${id} cryptoClient`;
  }
}
