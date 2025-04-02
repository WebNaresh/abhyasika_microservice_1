import { PartialType } from '@nestjs/mapped-types';
import { CreateFast2SmDto } from './create-fast_2_sm.dto';

export class UpdateFast2SmDto extends PartialType(CreateFast2SmDto) {
  id: number;
}
