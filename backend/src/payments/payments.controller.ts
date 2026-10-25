import {
  Controller,
  Get,
  Param,
  Post,
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
import { PaymentsService } from './payments.service.js';
import { PaymentResponseDto } from './dto/payment-response.dto.js';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('orders/me')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(':id/payments')
  @ApiOperation({ summary: 'Buat pembayaran untuk pesanan saya' })
  @ApiCreatedResponse({ type: PaymentResponseDto })
  createPayment(
    @CurrentUser() user: AuthUser,
    @Param('id') orderId: string,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.createPayment(user.id, orderId);
  }

  @Get(':id/payment')
  @ApiOperation({ summary: 'Status pembayaran pesanan saya' })
  @ApiOkResponse({ type: PaymentResponseDto })
  getMyPaymentStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') orderId: string,
  ): Promise<PaymentResponseDto | null> {
    return this.paymentsService.getMyPaymentStatus(user.id, orderId);
  }
}
