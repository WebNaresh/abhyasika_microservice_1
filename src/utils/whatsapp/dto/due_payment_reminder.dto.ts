import { IsString } from "class-validator";
import { BasicWhatsappDto } from "./basic_whatsapp.dto";

export class DuePaymentReminderDto extends BasicWhatsappDto {
    @IsString()
    library_name: string;

    @IsString()
    library_contact: string;

    @IsString()
    student_email: string;

    @IsString()
    student_name: string;

    @IsString()
    student_contact: string;
}
