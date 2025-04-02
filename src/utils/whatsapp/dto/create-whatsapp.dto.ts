import { IsString } from 'class-validator';

export class CreateWhatsappDto {
  @IsString()
  library_name: string;

  @IsString()
  library_contact: string;

  @IsString()
  library_url: string;

  @IsString()
  student_name: string;

  @IsString()
  student_email: string;

  @IsString()
  student_contact: string;
}
export class WhatsappMessagePayload {
  @IsString()
  library_name: string;

  @IsString()
  library_contact: string;

  @IsString()
  library_url: string;

  @IsString()
  student_name: string;

  @IsString()
  student_email: string;

  @IsString()
  student_contact: string;

  @IsString()
  student_seat: string;
}


export class ConfirmationTemplateDto {
  @IsString()
  student_name: string;

  @IsString()
  library_name: string;

  @IsString()
  library_contact: string;

  @IsString()
  library_url: string;

  @IsString()
  student_email: string;

  @IsString()
  student_seat: string;

  @IsString()
  library_image: string;

  @IsString()
  student_contact: string;
}