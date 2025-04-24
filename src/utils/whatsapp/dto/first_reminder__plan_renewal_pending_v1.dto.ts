import { IsString } from "class-validator";
import { BasicWhatsappDto } from "./basic_whatsapp.dto";

export class FirstReminderPlanRenewalPendingV1Dto extends BasicWhatsappDto {
    @IsString()
    member_name: string;

    @IsString()
    library_name: string;

    @IsString()
    library_contact: string;
}