import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDecimal,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { FulfillmentType, HandoverType } from '@prisma/client';

export class CreateBookingDto {
  @ApiProperty({ example: 'uuid-layanan' })
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @ApiPropertyOptional({ example: '3.5', description: 'Perkiraan berat/jumlah' })
  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' }, { message: 'Estimasi harus berupa angka desimal' })
  estimatedQuantity?: string;

  @ApiProperty({ enum: HandoverType, example: HandoverType.PICKUP })
  @IsEnum(HandoverType)
  handoverType!: HandoverType;

  @ApiProperty({ enum: FulfillmentType, example: FulfillmentType.DELIVERY })
  @IsEnum(FulfillmentType)
  fulfillmentType!: FulfillmentType;

  @ApiPropertyOptional({ example: 'Kost Melati No. 5' })
  @IsOptional()
  @IsString()
  @Length(10, 300, { message: 'Alamat jemput harus 10–300 karakter' })
  pickupAddress?: string;

  @ApiPropertyOptional({ example: 'Kost Melati No. 5' })
  @IsOptional()
  @IsString()
  @Length(10, 300, { message: 'Alamat antar harus 10–300 karakter' })
  deliveryAddress?: string;

  @ApiPropertyOptional({ example: 'Gunakan deterjen lembut' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateBookingStatusDto {
  @ApiProperty({ enum: ['CONFIRMED', 'REJECTED'], example: 'CONFIRMED' })
  @IsString()
  @IsNotEmpty()
  status!: 'CONFIRMED' | 'REJECTED';

  @ApiPropertyOptional({ example: 'Jadwal penuh' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  rejectionReason?: string;
}

export class QueryBookingsDto {
  @ApiPropertyOptional({ example: 'PENDING' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: '2026-10-24' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}
