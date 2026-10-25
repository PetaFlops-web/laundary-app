import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator.js';
import { PaginationMetaDto } from '../common/dto/pagination.dto.js';
import { BookingsService } from './bookings.service.js';
import { BookingResponseDto } from './dto/booking-response.dto.js';
import { CreateBookingDto, QueryBookingsDto } from './dto/booking.dto.js';

@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Buat booking baru' })
  @ApiCreatedResponse({ type: BookingResponseDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateBookingDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.create(user.id, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Daftar booking saya' })
  @ApiOkResponse({ type: BookingResponseDto, isArray: true })
  findMyBookings(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryBookingsDto,
  ): Promise<{ data: BookingResponseDto[]; meta: PaginationMetaDto }> {
    return this.bookingsService.findMyBookings(user.id, query);
  }

  @Get('me/:id')
  @ApiOperation({ summary: 'Detail booking saya' })
  @ApiOkResponse({ type: BookingResponseDto })
  findMyBookingById(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.findMyBookingById(user.id, id);
  }

  @Patch('me/:id/cancel')
  @ApiOperation({ summary: 'Batalkan booking saya' })
  @ApiOkResponse({ type: BookingResponseDto })
  cancelMyBooking(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.cancelMyBooking(user.id, id);
  }
}
