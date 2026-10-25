import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
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
  @IsNotEmpty()
  @Length(10, 300, { message: 'Alamat harus 10–300 karakter' })
  defaultAddress?: string;
}
