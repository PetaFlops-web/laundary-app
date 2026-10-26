import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardController } from './dashboard.controller.js';

@Module({
  imports: [SettingsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
