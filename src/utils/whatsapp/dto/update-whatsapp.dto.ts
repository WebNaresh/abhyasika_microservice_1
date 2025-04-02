import { PartialType } from '@nestjs/mapped-types';
import { WhatsappMessagePayload } from './create-whatsapp.dto';

export class UpdateWhatsappDto extends PartialType(WhatsappMessagePayload) {
  id: number;
}
