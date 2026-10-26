import { plainToInstance, Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from 'class-validator';

export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_TTL?: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsOptional()
  MIDTRANS_SERVER_KEY?: string;

  @IsString()
  @IsOptional()
  MIDTRANS_CLIENT_KEY?: string;

  @IsString()
  @IsOptional()
  MIDTRANS_SNAP_URL?: string;

  @IsString()
  @IsOptional()
  ADMIN_EMAIL?: string;

  @IsString()
  @IsOptional()
  ADMIN_PASSWORD?: string;

  @IsString()
  @IsOptional()
  ADMIN_ADDRESS?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  PORT?: number;

  @IsString()
  @IsOptional()
  NODE_ENV?: string;

  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: false,
  });
  if (errors.length > 0) {
    const messages = errors.map((e) =>
      Object.values(e.constraints ?? {}).join(', '),
    );
    throw new Error(
      `Validasi environment gagal:\n${messages.join('\n')}`,
    );
  }
  return validated;
}
