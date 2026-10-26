import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QueryDashboardDto {
  @ApiPropertyOptional({ example: '2026-10-01', description: 'Awal periode pendapatan' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-10-31', description: 'Akhir periode pendapatan' })
  @IsOptional()
  @IsString()
  dateTo?: string;
}
