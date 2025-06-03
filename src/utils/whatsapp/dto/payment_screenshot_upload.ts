import { IsString } from "class-validator";
import { BasicWhatsappDto } from "./basic_whatsapp.dto";

// { { 1 } }
// Enter content for {{ 1}}
// Vivek Bhos
// { { 2 } }
// Enter content for {{ 2}}
// 4rth June 2002
// { { 3 } }
// Enter content for {{ 3}}
// Vivek Bhos
// { { 4 } }
// Enter content for {{ 4}}
// +919370928324
// { { 5 } }
// Enter content for {{ 5}}
// ambition 2
export class PaymentScreenshotUploadDto extends BasicWhatsappDto {
    @IsString()
    student_name: string;

    @IsString()
    timestamp: string;

    @IsString()
    branch_name: string;

    @IsString()
    student_phone_number: string;
}
