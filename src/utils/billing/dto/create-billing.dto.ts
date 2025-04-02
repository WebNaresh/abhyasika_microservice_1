import { IsString } from 'class-validator';

export class CreateBillingDto {
    @IsString()
    library_url: string;
}
