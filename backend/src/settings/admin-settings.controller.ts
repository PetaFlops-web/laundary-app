import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import {
  AdminSettingsResponseDto,
  UpdateSettingsDto,
} from './dto/admin-settings.dto.js';
import { SettingsService } from './settings.service.js';

@ApiTags('Admin Settings')
@ApiBearerAuth()
@Controller('admin/settings')
@Roles(Role.ADMIN)
export class AdminSettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Baca seluruh pengaturan usaha (admin)' })
  @ApiOkResponse({ type: AdminSettingsResponseDto })
  async findAll(): Promise<AdminSettingsResponseDto> {
    const settings = await this.settingsService.find();
    return settings as AdminSettingsResponseDto;
  }

  @Patch()
  @ApiOperation({ summary: 'Ubah pengaturan usaha (admin)' })
  @ApiOkResponse({ type: AdminSettingsResponseDto })
  async update(
    @Body() dto: UpdateSettingsDto,
  ): Promise<AdminSettingsResponseDto> {
    const settings = await this.settingsService.update(dto);
    return settings as AdminSettingsResponseDto;
  }
}
