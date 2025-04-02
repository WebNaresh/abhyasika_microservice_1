import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateBillingDto } from './dto/create-billing.dto';

@Injectable()
export class BillingService {
  constructor(private readonly database: DatabaseService) { }
  async create_whatsapp_billing(createBillingDto: CreateBillingDto,) {
    const { library_url } = createBillingDto;
    const library = await this.database.library.update({
      where: {
        library_url
      },
      data: {
        billing: {
          create: {
            billing_type: "WhatsappBilling",
          },
        },
      },
    })
    return {
      library
    }
  }

  async create_sms_billing(createBillingDto: CreateBillingDto,) {
    const { library_url } = createBillingDto;
    const library = await this.database.library.update({
      where: {
        library_url
      },
      data: {
        billing: {
          create: {
            billing_type: "SmsBilling",
          },
        },
      },
    })
    return {
      library
    }
  }
}
