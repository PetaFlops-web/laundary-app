import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CreateServiceDto } from './dto/create-service.dto.js';
import { ServiceResponseDto } from './dto/service-response.dto.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';
import { ServicesService } from './services.service.js';

@ApiTags('Admin Services')
@ApiBearerAuth()
@Controller('admin/services')
@Roles(Role.ADMIN)
export class AdminServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @ApiOperation({ summary: 'Buat layanan baru (admin)' })
  @ApiCreatedResponse({
    description: 'Layanan berhasil dibuat',
    type: ServiceResponseDto,
  })
  create(@Body() dto: CreateServiceDto): Promise<ServiceResponseDto> {
    return this.servicesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Daftar semua layanan (admin)' })
  @ApiOkResponse({
    description: 'Daftar layanan',
    type: ServiceResponseDto,
    isArray: true,
  })
  findAll(): Promise<ServiceResponseDto[]> {
    return this.servicesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail layanan (admin)' })
  @ApiParam({ name: 'id', description: 'ID layanan', type: 'string' })
  @ApiOkResponse({ description: 'Detail layanan', type: ServiceResponseDto })
  @ApiNotFoundResponse({ description: 'Layanan tidak ditemukan' })
  findOne(@Param('id') id: string): Promise<ServiceResponseDto> {
    return this.servicesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ubah layanan (admin)' })
  @ApiParam({ name: 'id', description: 'ID layanan', type: 'string' })
  @ApiOkResponse({
    description: 'Layanan berhasil diperbarui',
    type: ServiceResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Layanan tidak ditemukan' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ): Promise<ServiceResponseDto> {
    return this.servicesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Hapus/nonaktifkan layanan (admin)',
    description:
      'Layanan yang belum pernah dipakai akan dihapus; yang sudah dipakai hanya dinonaktifkan.',
  })
  @ApiParam({ name: 'id', description: 'ID layanan', type: 'string' })
  @ApiOkResponse({ description: 'Layanan berhasil dihapus/dinonaktifkan' })
  @ApiNotFoundResponse({ description: 'Layanan tidak ditemukan' })
  remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.servicesService.remove(id);
  }
}
