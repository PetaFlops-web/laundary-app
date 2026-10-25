import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { PaginationMetaDto } from '../common/dto/pagination.dto.js';
import { BookingsService } from './bookings.service.js';
import { BookingResponseDto } from './dto/booking-response.dto.js';
import { QueryBookingsDto, UpdateBookingStatusDto } from './dto/booking.dto.js';

@ApiTags('Admin Bookings')
@ApiBearerAuth()
@Controller('admin/bookings')
@Roles(Role.ADMIN)
export class AdminBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar semua booking (admin)' })
  @ApiOkResponse({ type: BookingResponseDto, isArray: true })
  findAll(
    @Query() query: QueryBookingsDto,
  ): Promise<{ data: BookingResponseDto[]; meta: PaginationMetaDto }> {
    return this.bookingsService.findAllAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail booking (admin)' })
  @ApiOkResponse({ type: BookingResponseDto })
  findOne(@Param('id') id: string): Promise<BookingResponseDto> {
    return this.bookingsService.findOneAdmin(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Konfirmasi atau tolak booking (admin)' })
  @ApiOkResponse({ type: BookingResponseDto })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.updateStatusAdmin(id, dto);
  }
}
