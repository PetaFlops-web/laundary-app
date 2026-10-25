import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { PaymentsService } from './payments.service.js';
import type { MidtransNotification } from './midtrans.service.js';

@Controller('payments')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handleWebhook(@Body() body: MidtransNotification): Promise<{ status: string }> {
    try {
      await this.paymentsService.handleWebhook(body);
      return { status: 'ok' };
    } catch (err) {
      this.logger.error(`Webhook error: ${String(err)}`);
      // Tetap return 200 agar Midtrans tidak retry terus-menerus
      return { status: 'error' };
    }
  }
}
