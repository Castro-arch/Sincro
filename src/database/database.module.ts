import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MlCredentials } from '../mercado-livre/auth/ml-credentials.entity';
import { Product } from '../products/entities/product.entity';
import { Listing } from '../products/entities/listing.entity';
import { Variation } from '../products/entities/variation.entity';
import { Order } from '../orders/entities/order.entity';
import { Question } from '../questions/entities/question.entity';
import { Configuracao } from '../configuracoes/entities/configuracao.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.getOrThrow<string>('DB_HOST'),
        port: config.getOrThrow<number>('DB_PORT'),
        username: config.getOrThrow<string>('DB_USER'),
        password: config.getOrThrow<string>('DB_PASSWORD'),
        database: config.getOrThrow<string>('DB_NAME'),
        entities: [MlCredentials, Product, Listing, Variation, Order, Question, Configuracao],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsTableName: 'sincro_migrations',
        // O schema e versionado por migrations -- nunca por synchronize.
        synchronize: false,
        migrationsRun: false,
        logging: config.get<string>('NODE_ENV') === 'development' ? ['error', 'warn'] : ['error'],
      }),
    }),
  ],
})
export class DatabaseModule {}
