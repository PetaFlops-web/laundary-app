import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9\s-]{9,20}$/, {
    message: 'Format nomor telepon tidak valid',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  defaultPickupAddress?: string;
}
