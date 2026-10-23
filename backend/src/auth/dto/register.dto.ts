import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEmail({}, { message: 'Format email tidak valid' })
  email: string;

  @IsString()
  @Matches(/^\+?[0-9\s-]{9,20}$/, { message: 'Format nomor telepon tidak valid' })
  phone: string;

  @IsString()
  @MinLength(8, { message: 'Kata sandi minimal 8 karakter' })
  @MaxLength(72)
  password: string;
}
