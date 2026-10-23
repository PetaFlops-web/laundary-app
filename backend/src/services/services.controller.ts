import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { PaginationQueryDto } from '../common/dto/pagination.dto.js';
import { ServiceResponseDto } from './dto/service-response.dto.js';
import { ServicesService } from './services.service.js';

@ApiTags('Services')
@Controller('services')
@Public()
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar layanan aktif (publik)' })
  @ApiResponse({
    status: 200,
    description: 'Daftar layanan aktif',
    type: ServiceResponseDto,
    isArray: true,
  })
  findAll(@Query() query: PaginationQueryDto) {
    return this.servicesService.findAllPublic(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail layanan aktif (publik)' })
  @ApiParam({ name: 'id', description: 'ID layanan', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Detail layanan',
    type: ServiceResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Layanan tidak ditemukan' })
  findOne(@Param('id') id: string): Promise<ServiceResponseDto> {
    return this.servicesService.findOnePublic(id);
  }
}
