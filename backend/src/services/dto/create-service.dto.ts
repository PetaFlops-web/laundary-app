import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { ServiceType, ServiceUnit } from '@prisma/client';

export class CreateServiceDto {
  @ApiProperty({ example: 'Cuci Reguler' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name: string;

  @ApiPropertyOptional({ example: 'Layanan cuci reguler 3 hari' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ enum: ServiceType, example: ServiceType.REGULAR })
  @IsEnum(ServiceType)
  type: ServiceType;

  @ApiProperty({ example: 7000, description: 'Harga dasar dalam Rupiah' })
  @IsNumber()
  @Min(1)
  price: number;

  @ApiProperty({ enum: ServiceUnit, example: ServiceUnit.KG })
  @IsEnum(ServiceUnit)
  unit: ServiceUnit;

  @ApiProperty({ example: 72, description: 'Estimasi waktu pengerjaan (jam)' })
  @IsInt()
  @Min(1)
  estimatedHours: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
