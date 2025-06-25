import { IsString } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  user_id: string;
}
