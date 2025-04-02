import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as ip from 'ip';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/prisma-client-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors();
  const config = new DocumentBuilder()
    .setTitle('Library Management')
    .setDescription('The Library Management API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/v1/docs', app, document, {
    swaggerOptions: {
      url: '/api/v1/docs-json',
    },
    customCssUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.js',
    ],
  });

  await app.listen(process.env.PORT, async () => {
    const url = await app.getUrl();
    const localIp = ip.address();
    console.log(`Library Management API is running on:\n ${url}\n http://${localIp}:${process.env.PORT ?? 3000} \n Swagger documentation is available at: \n http://${localIp}:${process.env.PORT ?? 3000}/api/v1/docs`);
  });
}
bootstrap();
