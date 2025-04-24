import { IsString } from "class-validator";
import { BasicWhatsappDto } from "./basic_whatsapp.dto";

export class PaymentReceivedNotificationDto extends BasicWhatsappDto {
    @IsString()
    member_name: string;

    @IsString()
    room_title: string;

    // desk_title
    @IsString()
    desk_title: string;
}
