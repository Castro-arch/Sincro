import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Contrato das variaveis de ambiente. Se algo obrigatorio faltar, a aplicacao
 * nao sobe -- e melhor falhar no boot do que na primeira chamada ao ML.
 */
export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT = 3000;

  // ---------- PostgreSQL ----------
  @IsString()
  @IsNotEmpty()
  DB_HOST!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT = 5432;

  @IsString()
  @IsNotEmpty()
  DB_USER!: string;

  @IsString()
  DB_PASSWORD!: string;

  @IsString()
  @IsNotEmpty()
  DB_NAME!: string;

  // ---------- Redis ----------
  @IsString()
  @IsNotEmpty()
  REDIS_HOST!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  REDIS_PORT = 6379;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  // ---------- Mercado Livre ----------
  @IsString()
  @IsNotEmpty()
  ML_CLIENT_ID!: string;

  @IsString()
  @IsNotEmpty()
  ML_CLIENT_SECRET!: string;

  @IsUrl({ require_tld: false })
  ML_REDIRECT_URI!: string;

  @IsString()
  @IsNotEmpty()
  ML_SITE_ID = 'MLB';

  @IsUrl({ require_tld: false })
  ML_AUTH_DOMAIN = 'https://auth.mercadolivre.com.br';

  @IsUrl({ require_tld: false })
  ML_API_URL = 'https://api.mercadolibre.com';

  // ---------- Jobs ----------
  @IsString()
  @IsOptional()
  TOKEN_REFRESH_CRON = '*/15 * * * *';

  @Type(() => Number)
  @IsInt()
  @Min(60)
  @IsOptional()
  TOKEN_REFRESH_SKEW_SECONDS = 1800;

  @IsString()
  @IsOptional()
  ORDER_POLLING_CRON = '*/5 * * * *';

  // ---------- Dashboard ----------
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  LOW_STOCK_THRESHOLD = 3;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
    excludeExtraneousValues: false,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Variaveis de ambiente invalidas:\n${details}`);
  }

  return validated;
}
