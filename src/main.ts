import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Sincro');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // Uso pessoal: a API sobe local, sem exposicao publica.
  app.enableCors({ origin: true });

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);

  logger.log(`Sincro no ar em http://localhost:${port}`);
  logger.log(`Autorize o Mercado Livre em http://localhost:${port}/ml/auth/login`);
}

void bootstrap();
