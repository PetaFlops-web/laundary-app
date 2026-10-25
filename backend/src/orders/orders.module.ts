import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { OrdersService } from './orders.service.js';
import { OrdersController } from './orders.controller.js';
import { AdminOrdersController } from './admin-orders.controller.js';

@Module({
  imports: [SettingsModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
