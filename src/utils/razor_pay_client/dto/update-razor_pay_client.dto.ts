import { PartialType } from '@nestjs/mapped-types';
import { CreateRazorPayClientDto } from './create-razor_pay_client.dto';

export class UpdateRazorPayClientDto extends PartialType(CreateRazorPayClientDto) {
  id: number;
}
