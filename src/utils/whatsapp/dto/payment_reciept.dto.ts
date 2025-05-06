import { IsString } from "class-validator";
import { BasicWhatsappDto } from "./basic_whatsapp.dto";

export class PaymentReceiptDto extends BasicWhatsappDto {
    @IsString()
    library_name: string;

    @IsString()
    student_name: string;

    @IsString()
    student_email: string;

    @IsString()
    seat_title: string;

    @IsString()
    plan_name: string;

    @IsString()
    plan_expiration_date: string;

    @IsString()
    library_contact_no: string;
}
