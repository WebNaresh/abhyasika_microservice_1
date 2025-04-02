import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { BillingService } from '../billing/billing.service';
import { CreateFast2SmDto } from './dto/create-fast_2_sm.dto';

@Injectable()
export class Fast2SmsService {
  constructor(private readonly billing: BillingService) { }
  async send_otp(createFast2SmDto: CreateFast2SmDto) {
    console.log(
      `🚀 ~ file: fast_2_sms.service.ts:7 ~ Fast2SmsService ~ createFast2SmDto:`,
      createFast2SmDto,
    );
    // const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    //   method: 'POST',
    //   headers: {
    //     authorization: process.env.FAST2SMS_API!,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     route: 'otp',
    //     numbers: createFast2SmDto.number,
    //     variables_values: createFast2SmDto.otp,
    //   }),
    // }).then((res) => res.json());
    // use wish bysms provider https://login.wishbysms.com/api/sendhttp.php?authkey=438025ARnjymnyXx677a3237P1&mobiles=919022738129&message=Use this verification code (Var1) to verify your mobile number on My Abhyasika. do not share with anyone. powered by MTTLLP&sender=MTTLLP&route=4&country=91&DLT_TE_ID=1307168447401291651
    const api = `https://login.wishbysms.com/api/sendhttp.php?authkey=438025ARnjymnyXx677a3237P1&mobiles=91${createFast2SmDto.number}&message=Use%20this%20verification%20code%20${createFast2SmDto.otp}%20to%20verify%20your%20mobile%20number%20on%20My%20Abhyasika.%20do%20not%20share%20with%20anyone.%20powered%20by%20MTTLLP&sender=MTTLLP&route=4&country=91&DLT_TE_ID=1307168447401291651`
    console.log(`🚀 ~ file: fast_2_sms.service.ts:27 ~ Fast2SmsService ~ api:`, api)
    const response = await axios.get(
      api,
    ).then(async (res) => {
      console.log(`🚀 ~ Fast2SmsService ~ createFast2SmDto.library_ur:`, createFast2SmDto.library_url)
      if (createFast2SmDto.library_url) {
        const data = await this.billing.create_sms_billing({
          library_url: createFast2SmDto.library_url,
        })
        console.log(`🚀 ~ Fast2SmsService ~ data:`, data)
      }

      return res.data
    });
    console.log(`🚀 ~ file: fast_2_sms.service.ts:28 ~ Fast2SmsService ~ response:`, response.data)



  }
}
