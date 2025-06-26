import { IsString, MaxLength, IsNotEmpty } from "class-validator";

export class BasicWhatsappDto {
    @IsString()
    @IsNotEmpty({ message: 'Receiver mobile number is required and cannot be empty' })
    @MaxLength(10, { message: 'Mobile number cannot exceed 10 digits' })
    receiver_mobile_number: string;

    // library_url
    @IsString()
    @IsNotEmpty({ message: 'Library URL is required' })
    library_url: string;
}

