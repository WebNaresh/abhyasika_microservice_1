import { IsString, MaxLength } from "class-validator";

export class BasicWhatsappDto {
    @IsString()
    @MaxLength(10)
    receiver_mobile_number: string;

    // library_url
    @IsString()
    library_url: string;
}

