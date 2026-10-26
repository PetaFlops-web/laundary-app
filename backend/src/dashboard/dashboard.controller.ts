import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardResponseDto } from './dto/dashboard-response.dto.js';
import { QueryDashboardDto } from './dto/dashboard-query.dto.js';

@ApiTags('Admin Dashboard')
@ApiBearerAuth()
@Controller('admin/dashboard')
@Roles(Role.ADMIN)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Ringkasan dashboard admin (FR-36)' })
  @ApiOkResponse({ type: DashboardResponseDto })
  getDashboard(@Query() query: QueryDashboardDto): Promise<DashboardResponseDto> {
    return this.dashboardService.getDashboard(query);
  }
}
