import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Budi Santoso' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'budi@example.com' })
  @IsEmail({}, { message: 'Format email tidak valid' })
  email!: string;

  @ApiProperty({ example: '08123456789' })
  @IsString()
  @Matches(/^\+?[0-9\s-]{9,20}$/, { message: 'Format nomor telepon tidak valid' })
  phone!: string;

  @ApiProperty({ example: 'Kost Melati No. 5, Bandar Lampung' })
  @IsString()
  @IsNotEmpty()
  @Length(10, 300, { message: 'Alamat harus 10–300 karakter' })
  address!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(8, { message: 'Kata sandi minimal 8 karakter' })
  @MaxLength(72)
  password!: string;
}
