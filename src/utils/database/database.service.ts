import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    console.log('Connecting to the database...');
    try {
      await this.$connect();
      console.log('Connected to the database');
    } catch (error) {
      console.error('Error connecting to the database');
      console.error(error);
    }
  }

  async onModuleDestroy() {
    console.log('Disconnecting from the database...');
    await this.$disconnect();
  }
}
