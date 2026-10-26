import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Health check (NFR-08)' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        database: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2026-10-26T10:00:00.000Z' },
      },
    },
  })
  async check(): Promise<{ status: string; database: string; timestamp: string }> {
    let dbStatus = 'ok';
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
    } catch {
      dbStatus = 'error';
    }

    return {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      database: dbStatus,
      timestamp: new Date().toISOString(),
    };
  }
}
