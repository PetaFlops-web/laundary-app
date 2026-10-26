import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Security headers (NFR-04)
  app.use(helmet());

  // CORS whitelist (NFR-04)
  const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) ?? '*';
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger UI di /api/docs (NFR-14) — hanya non-produksi
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Achilla Laundry API')
      .setDescription('Backend API Website Achilla Laundry')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
