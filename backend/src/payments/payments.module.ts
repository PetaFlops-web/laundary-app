import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { MidtransService } from './midtrans.service.js';
import { PaymentsService } from './payments.service.js';
import { PaymentsController } from './payments.controller.js';
import { WebhookController } from './webhook.controller.js';
import { AdminPaymentsController } from './admin-payments.controller.js';

@Module({
  imports: [SettingsModule],
  controllers: [PaymentsController, WebhookController, AdminPaymentsController],
  providers: [MidtransService, PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
