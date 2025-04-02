import { PartialType } from '@nestjs/mapped-types';
import { CreateCryptoClientDto } from './create-crypto_client.dto';

export class UpdateCryptoClientDto extends PartialType(CreateCryptoClientDto) {
  id: number;
}
