import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator.js';
import { PaginationMetaDto } from '../common/dto/pagination.dto.js';
import { OrdersService } from './orders.service.js';
import { OrderResponseDto } from './dto/order-response.dto.js';
import { QueryOrdersDto } from './dto/order.dto.js';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Daftar pesanan saya' })
  @ApiOkResponse({ type: OrderResponseDto, isArray: true })
  findMyOrders(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryOrdersDto,
  ): Promise<{ data: OrderResponseDto[]; meta: PaginationMetaDto }> {
    return this.ordersService.findMyOrders(user.id, query);
  }

  @Get('me/:id')
  @ApiOperation({ summary: 'Detail pesanan saya' })
  @ApiOkResponse({ type: OrderResponseDto })
  findMyOrderById(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<OrderResponseDto> {
    return this.ordersService.findMyOrderById(user.id, id);
  }
}
