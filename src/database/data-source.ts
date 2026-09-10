import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { MlCredentials } from '../mercado-livre/auth/ml-credentials.entity';
import { Product } from '../products/entities/product.entity';
import { Listing } from '../products/entities/listing.entity';
import { Variation } from '../products/entities/variation.entity';
import { Order } from '../orders/entities/order.entity';
import { Question } from '../questions/entities/question.entity';

loadEnv();

/**
 * DataSource usado APENAS pelo CLI do TypeORM (`npm run migration:run`).
 * A aplicacao em si configura a conexao em database.module.ts.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'sincro',
  password: process.env.DB_PASSWORD ?? 'sincro',
  database: process.env.DB_NAME ?? 'sincro',
  entities: [MlCredentials, Product, Listing, Variation, Order, Question],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsTableName: 'sincro_migrations',
  synchronize: false,
  logging: ['error', 'warn', 'migration'],
});

// Export unico de proposito: o CLI do TypeORM recusa o arquivo se encontrar
// mais de um DataSource exportado ("must contain only one export of
// DataSource instance"), entao nada de `export default` aqui tambem.
