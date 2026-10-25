import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { OpeningHoursDto } from './public-settings-response.dto.js';

export class AdminSettingsResponseDto {
  @ApiProperty({ example: 'Achilla Laundry' })
  businessName!: string;

  @ApiProperty({ example: 'Jl. Pramuka, Bandar Lampung' })
  businessAddress!: string;

  @ApiProperty({ example: '6281234567890' })
  businessPhone!: string;

  @ApiProperty({ example: '6281234567890' })
  whatsappNumber!: string;

  @ApiProperty({ type: Object })
  openingHours!: Record<string, OpeningHoursDto>;

  @ApiProperty({ example: true })
  pickupEnabled!: boolean;

  @ApiPropertyOptional()
  pickupArea!: string | null;

  @ApiProperty({ example: true })
  deliveryEnabled!: boolean;

  @ApiPropertyOptional()
  deliveryArea!: string | null;

  @ApiPropertyOptional()
  mapLink!: string | null;

  @ApiProperty({ example: 2, description: 'Batas hari pengingat pembayaran' })
  paymentReminderDays!: number;

  @ApiProperty({ example: 24, description: 'Masa berlaku transaksi pembayaran (jam)' })
  paymentExpiryHours!: number;

  @ApiProperty({ example: 3, description: 'Batas booking PENDING per pelanggan' })
  maxPendingBookings!: number;
}

class OpeningHoursInputDto {
  @IsString()
  @Length(5, 5)
  open!: string;

  @IsString()
  @Length(5, 5)
  close!: string;

  @IsBoolean()
  isOpen!: boolean;
}

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 'Achilla Laundry' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  businessName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 500)
  businessAddress?: string;

  @ApiPropertyOptional({ example: '6281234567890' })
  @IsOptional()
  @IsString()
  @Length(8, 20)
  businessPhone?: string;

  @ApiPropertyOptional({ example: '6281234567890' })
  @IsOptional()
  @IsString()
  @Length(8, 20)
  whatsappNumber?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  @ValidateNested({ each: true })
  @Type(() => OpeningHoursInputDto)
  openingHours?: Record<string, OpeningHoursInputDto>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pickupEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  pickupArea?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  deliveryEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  deliveryArea?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  mapLink?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  paymentReminderDays?: number;

  @ApiPropertyOptional({ example: 24 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  paymentExpiryHours?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxPendingBookings?: number;
}
