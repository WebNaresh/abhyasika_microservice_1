import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateFast2SmDto {
  @IsNumber()
  number: number;

  @IsNumber()
  otp: number;

  @IsString()
  @IsOptional()
  library_url?: string;
}
