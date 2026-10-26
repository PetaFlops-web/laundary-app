import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

/** Kirim pesan (REST fallback). */
export class SendMessageDto {
  @ApiProperty({ description: 'Isi pesan (1–1000 karakter)' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 1000)
  body!: string;

  @ApiPropertyOptional({ description: 'ID pesanan terkait (opsional)' })
  @IsOptional()
  @IsString()
  orderId?: string;
}

/** Tandai pesan dibaca. */
export class MarkReadDto {
  @ApiProperty({ description: 'ID pesan terakhir yang dibaca' })
  @IsString()
  @IsNotEmpty()
  upToMessageId!: string;
}

/** Query riwayat pesan. */
export class QueryMessagesDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}

/** Admin: kirim pesan ke percakapan tertentu. */
export class AdminSendMessageDto {
  @ApiProperty({ description: 'Isi pesan (1–1000 karakter)' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 1000)
  body!: string;

  @ApiPropertyOptional({ description: 'ID pesanan terkait (opsional)' })
  @IsOptional()
  @IsString()
  orderId?: string;
}
