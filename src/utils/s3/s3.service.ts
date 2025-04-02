import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';

@Injectable()
export class S3Service {
  private readonly s3Client = new S3Client({
    region: process.env.AWS_S3_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  constructor() {}

  async upload(Body: Buffer, Key: string, ContentType: string) {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key,
        Body,
        ContentType,
      }),
    );

    return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_S3_REGION}.amazonaws.com/${Key}`;
  }

  async deleteImage(Key: string) {
    return await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key,
      }),
    );
  }
  async uploadImageOnSameUrl(file: Express.Multer.File, url: string) {
    if (url.includes(process.env.AWS_BUCKET_NAME)) {
      const Key = url.split('com/')[1];
      console.log(`🚀 ~ file: s3.service.ts:44 ~ S3Service ~ Key:`, Key);
      const uploadResult = await this.s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
      console.log(
        `🚀 ~ file: s3.service.ts:52 ~ S3Service ~ uploadResult:`,
        uploadResult,
      );
    }

    // await this.deleteImage(Key);
    // await this.upload(file.buffer, Key, file.mimetype);
    // return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_S3_REGION}.amazonaws.com/${Key}`;
  }
}
