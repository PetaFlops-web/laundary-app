import {
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
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
import { Roles } from '../common/decorators/roles.decorator.js';
import { PaginationMetaDto } from '../common/dto/pagination.dto.js';
import { PaymentsService } from './payments.service.js';
import { PaymentResponseDto } from './dto/payment-response.dto.js';
import { QueryPaymentsDto } from './dto/payment.dto.js';

@ApiTags('Admin Payments')
@ApiBearerAuth()
@Controller('admin')
@Roles(Role.ADMIN)
export class AdminPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('payments')
  @ApiOperation({ summary: 'Daftar semua pembayaran (admin)' })
  @ApiOkResponse({ type: PaymentResponseDto, isArray: true })
  findAll(
    @Query() query: QueryPaymentsDto,
  ): Promise<{ data: PaymentResponseDto[]; meta: PaginationMetaDto }> {
    return this.paymentsService.findAllAdmin(query);
  }

  @Get('orders/:id/payments')
  @ApiOperation({ summary: 'Pembayaran untuk pesanan tertentu (admin)' })
  @ApiOkResponse({ type: PaymentResponseDto, isArray: true })
  findOrderPayments(@Param('id') orderId: string): Promise<PaymentResponseDto[]> {
    return this.paymentsService.findOrderPaymentsAdmin(orderId);
  }

  @Post('orders/:id/mark-paid-cash')
  @ApiOperation({ summary: 'Tandai pesanan walk-in terbayar tunai' })
  @ApiOkResponse({ type: PaymentResponseDto })
  markPaidCash(
    @CurrentUser() user: AuthUser,
    @Param('id') orderId: string,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.markPaidCash(user.id, orderId);
  }
}
