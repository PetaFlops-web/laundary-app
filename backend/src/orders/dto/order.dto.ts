import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDecimal,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

/** Buat pesanan dari booking CONFIRMED atau walk-in. */
export class CreateOrderDto {
  @ApiPropertyOptional({ description: 'ID booking (CONFIRMED). Kosongkan untuk walk-in.' })
  @IsOptional()
  @IsString()
  bookingId?: string;

  @ApiPropertyOptional({ description: 'Nama pelanggan walk-in (wajib bila tanpa bookingId)' })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  customerName?: string;

  @ApiPropertyOptional({ description: 'Telepon pelanggan walk-in (wajib bila tanpa bookingId)' })
  @IsOptional()
  @IsString()
  @Length(10, 20)
  customerPhone?: string;

  @ApiPropertyOptional({ description: 'ID layanan (wajib untuk walk-in)' })
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiPropertyOptional({ description: 'Alamat pengantaran' })
  @IsOptional()
  @IsString()
  @Length(10, 300)
  deliveryAddress?: string;

  @ApiPropertyOptional({ description: 'Catatan' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** Catat berat cucian. */
export class WeighOrderDto {
  @ApiProperty({ example: '3.500', description: 'Berat dalam kg (> 0)' })
  @IsNotEmpty()
  @IsDecimal({ decimal_digits: '0,3' }, { message: 'Berat harus berupa angka desimal' })
  weightKg!: string;
}

/** Tetapkan harga final. */
export class SetPriceDto {
  @ApiProperty({ example: '35000', description: 'Harga total (> 0)' })
  @IsNotEmpty()
  @IsDecimal({ decimal_digits: '0,2' }, { message: 'Harga harus berupa angka desimal' })
  totalPrice!: string;

  @ApiPropertyOptional({ description: 'Catatan harga (wajib bila berbeda dari saran)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  priceNote?: string;
}

/** Ubah status pesanan oleh admin. */
export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: ['COMPLETED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
    example: 'COMPLETED',
  })
  @IsString()
  @IsNotEmpty()
  status!: 'COMPLETED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

  @ApiPropertyOptional({ description: 'Catatan perubahan status' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Query pesanan (admin & customer). */
export class QueryOrdersDto {
  @ApiPropertyOptional({ example: 'PICKED_UP' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Cari nama/kode' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}
