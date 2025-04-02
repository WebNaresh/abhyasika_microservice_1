import { HttpException, Injectable } from '@nestjs/common';
import { CryptoClientService } from '../crypto_client/crypto_client.service';
import { DatabaseService } from '../database/database.service';

const Razorpay = require('razorpay');

@Injectable()
export class RazorPayClientService {
  constructor(
    private readonly database: DatabaseService,
    private readonly crypto_client: CryptoClientService,
  ) { }
  async invoke_razor_pay_create_order(user_id: string) {
    const user = await this.database.user.findUnique({
      where: {
        id: user_id,
      },
      include: {
        library_in: true,
      },
    });
    const razorPayDetails = await this.database.razorPayDetails.findUnique({
      where: {
        library_id: user.library_in.id,
      },
    });
    if (razorPayDetails?.razor_pay_id === undefined) {
      throw new HttpException(
        'Payment gateway is not activated for your library contact your admin',
        404,
      );
    }
    const key_id = await this.crypto_client.decrypt(
      razorPayDetails.razor_pay_id,
    );
    const key_secret = await this.crypto_client.decrypt(
      razorPayDetails.razor_pay_secret,
    );
    console.log(
      `🚀 ~ file: razor_pay_client.service.ts:39 ~ RazorPayClientService ~ key_secret:`,
      key_secret,
    );

    const razor_pay_instance = new Razorpay({
      key_id,
      key_secret,
    });

    const expiredUserPlan = await this.database.userCurrentPlan.findFirst({
      where: {
        userId: user_id,
        end_date: {
          lte: new Date(),
        },

      },
      include: {
        plan: true,
      },
      orderBy: {
        created_at: 'desc',
      }
    });
    console.log(
      `🚀 ~ file: razor_pay_client.service.ts:60 ~ RazorPayClientService ~ expiredUserPlan:`,
      expiredUserPlan,
    );

    if (expiredUserPlan === null) {
      throw new HttpException('User has active plan', 404);
    }

    const order = await razor_pay_instance.orders.create({
      amount: expiredUserPlan.plan.plan_price * 100,
      currency: 'INR',
    });

    return {
      order,
      key_id,
      plan_id: expiredUserPlan.plan.id,
    };
  }
}
