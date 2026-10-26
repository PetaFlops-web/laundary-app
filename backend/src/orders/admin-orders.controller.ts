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
import { Role } from '@prisma/client';
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
import { Roles } from '../common/decorators/roles.decorator.js';
import { PaginationMetaDto } from '../common/dto/pagination.dto.js';
import { OrdersService } from './orders.service.js';
import { OrderResponseDto } from './dto/order-response.dto.js';
import {
  CreateOrderDto,
  QueryOrdersDto,
  SetPriceDto,
  UpdateOrderStatusDto,
  WeighOrderDto,
} from './dto/order.dto.js';

@ApiTags('Admin Orders')
@ApiBearerAuth()
@Controller('admin/orders')
@Roles(Role.ADMIN)
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Buat pesanan baru (dari booking atau walk-in)' })
  @ApiCreatedResponse({ type: OrderResponseDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Daftar semua pesanan (admin)' })
  @ApiOkResponse({ type: OrderResponseDto, isArray: true })
  findAll(
    @Query() query: QueryOrdersDto,
  ): Promise<{ data: OrderResponseDto[]; meta: PaginationMetaDto }> {
    return this.ordersService.findAllAdmin(query);
  }

  @Get('reminders')
  @ApiOperation({ summary: 'Pesanan menunggu pembayaran melewati batas pengingat' })
  @ApiOkResponse({ type: OrderResponseDto, isArray: true })
  getReminders(): Promise<OrderResponseDto[]> {
    return this.ordersService.getReminders();
  }

  @Get('self-pickup-reminders')
  @ApiOperation({ summary: 'Pesanan selesai belum diambil melewati batas hari' })
  @ApiOkResponse({ type: OrderResponseDto, isArray: true })
  getSelfPickupReminders(): Promise<OrderResponseDto[]> {
    return this.ordersService.getSelfPickupReminders();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail pesanan (admin)' })
  @ApiOkResponse({ type: OrderResponseDto })
  findOne(@Param('id') id: string): Promise<OrderResponseDto> {
    return this.ordersService.findOneAdmin(id);
  }

  @Get(':id/reminder-link')
  @ApiOperation({ summary: 'Tautan WhatsApp pengingat pembayaran' })
  getReminderLink(@Param('id') id: string): Promise<{ link: string }> {
    return this.ordersService.getReminderLink(id);
  }

  @Get(':id/self-pickup-reminder-link')
  @ApiOperation({ summary: 'Tautan WhatsApp pengingat ambil cucian' })
  getSelfPickupReminderLink(@Param('id') id: string): Promise<{ link: string }> {
    return this.ordersService.getSelfPickupReminderLink(id);
  }

  @Patch(':id/weigh')
  @ApiOperation({ summary: 'Catat berat cucian' })
  @ApiOkResponse({ type: OrderResponseDto })
  weigh(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: WeighOrderDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.weigh(user.id, id, dto);
  }

  @Patch(':id/price')
  @ApiOperation({ summary: 'Tetapkan harga final' })
  @ApiOkResponse({ type: OrderResponseDto })
  setPrice(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SetPriceDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.setPrice(user.id, id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Ubah status pesanan' })
  @ApiOkResponse({ type: OrderResponseDto })
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.updateStatus(user.id, id, dto);
  }
}
