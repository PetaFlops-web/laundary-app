import { Injectable } from '@nestjs/common';
import {
  BookingStatus,
  MessageSenderRole,
  OrderStatus,
  PaymentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import type { DashboardResponseDto } from './dto/dashboard-response.dto.js';
import type { QueryDashboardDto } from './dto/dashboard-query.dto.js';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  async getDashboard(query: QueryDashboardDto): Promise<DashboardResponseDto> {
    const settings = await this.settingsService.find();

    // Self-pickup reminder cutoff
    const selfPickupCutoff = new Date();
    selfPickupCutoff.setDate(selfPickupCutoff.getDate() - settings.selfPickupReminderDays);

    // Revenue period filter
    const revenueWhere: Record<string, unknown> = {
      status: PaymentStatus.PAID,
    };
    if (query.dateFrom || query.dateTo) {
      const paidAtFilter: Record<string, Date> = {};
      if (query.dateFrom) paidAtFilter.gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const end = new Date(query.dateTo);
        end.setHours(23, 59, 59, 999);
        paidAtFilter.lte = end;
      }
      revenueWhere.paidAt = paidAtFilter;
    }

    const [
      pendingBookings,
      awaitingPaymentOrders,
      paidNotCompletedOrders,
      outForDeliveryOrders,
      completedNotPickedUpOrders,
      unreadConversations,
      revenueAgg,
    ] = await this.prisma.$transaction([
      this.prisma.booking.count({
        where: { status: BookingStatus.PENDING },
      }),
      this.prisma.order.count({
        where: { status: OrderStatus.AWAITING_PAYMENT },
      }),
      this.prisma.order.count({
        where: { status: OrderStatus.PAID },
      }),
      this.prisma.order.count({
        where: { status: OrderStatus.OUT_FOR_DELIVERY },
      }),
      this.prisma.order.count({
        where: {
          status: OrderStatus.COMPLETED,
          completedAt: { lte: selfPickupCutoff },
        },
      }),
      this.prisma.conversation.count({
        where: {
          messages: {
            some: {
              readAt: null,
              senderRole: MessageSenderRole.CUSTOMER,
            },
          },
        },
      }),
      this.prisma.payment.aggregate({
        _sum: { grossAmount: true },
        where: revenueWhere,
      }),
    ]);

    const revenue = revenueAgg._sum.grossAmount?.toString() ?? '0';

    return {
      pendingBookings,
      awaitingPaymentOrders,
      paidNotCompletedOrders,
      outForDeliveryOrders,
      completedNotPickedUpOrders,
      unreadConversations,
      revenue,
      revenueFrom: query.dateFrom ?? null,
      revenueTo: query.dateTo ?? null,
    };
  }
}
