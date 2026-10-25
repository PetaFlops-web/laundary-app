import type {
  Delivery,
  Order,
  OrderStatus,
  OrderStatusLog,
  Payment,
  Service,
  User,
} from '@prisma/client';

type OrderWithRelations = Order & {
  service?: Service | null;
  user?: User | null;
  statusLogs?: OrderStatusLog[];
  payments?: Payment[];
  delivery?: Delivery | null;
};

export class OrderResponseDto {
  id!: string;
  code!: string;
  bookingId!: string | null;
  userId!: string | null;
  serviceId!: string;
  customerName!: string;
  customerPhone!: string;
  deliveryAddress!: string | null;
  status!: OrderStatus;
  weightKg!: string | null;
  suggestedPrice!: string | null;
  totalPrice!: string | null;
  priceNote!: string | null;
  pickedUpAt!: Date;
  weighedAt!: Date | null;
  pricedAt!: Date | null;
  paidAt!: Date | null;
  completedAt!: Date | null;
  deliveredAt!: Date | null;
  notes!: string | null;
  createdAt!: Date;
  updatedAt!: Date;

  service?: { id: string; name: string; type: string; unit: string; price: string } | null;
  user?: { id: string; name: string; phone: string } | null;
  statusLogs?: {
    id: string;
    status: string;
    actor: string;
    changedByUserId: string | null;
    note: string | null;
    changedAt: Date;
  }[];
  payments?: {
    id: string;
    provider: string;
    providerOrderId: string;
    grossAmount: string;
    method: string | null;
    status: string;
    paymentUrl: string | null;
    paidAt: Date | null;
    createdAt: Date;
  }[];
  delivery?: {
    id: string;
    address: string;
    courierName: string | null;
    dispatchedAt: Date | null;
    deliveredAt: Date | null;
    note: string | null;
  } | null;

  static from(order: OrderWithRelations): OrderResponseDto {
    return {
      id: order.id,
      code: order.code,
      bookingId: order.bookingId,
      userId: order.userId,
      serviceId: order.serviceId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      deliveryAddress: order.deliveryAddress,
      status: order.status,
      weightKg: order.weightKg?.toString() ?? null,
      suggestedPrice: order.suggestedPrice?.toString() ?? null,
      totalPrice: order.totalPrice?.toString() ?? null,
      priceNote: order.priceNote,
      pickedUpAt: order.pickedUpAt,
      weighedAt: order.weighedAt,
      pricedAt: order.pricedAt,
      paidAt: order.paidAt,
      completedAt: order.completedAt,
      deliveredAt: order.deliveredAt,
      notes: order.notes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      service: order.service
        ? {
            id: order.service.id,
            name: order.service.name,
            type: order.service.type,
            unit: order.service.unit,
            price: order.service.price.toString(),
          }
        : null,
      user: order.user
        ? { id: order.user.id, name: order.user.name, phone: order.user.phone }
        : null,
      statusLogs: order.statusLogs?.map((log) => ({
        id: log.id,
        status: log.status,
        actor: log.actor,
        changedByUserId: log.changedByUserId,
        note: log.note,
        changedAt: log.changedAt,
      })),
      payments: order.payments?.map((p) => ({
        id: p.id,
        provider: p.provider,
        providerOrderId: p.providerOrderId,
        grossAmount: p.grossAmount.toString(),
        method: p.method,
        status: p.status,
        paymentUrl: p.paymentUrl,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      })),
      delivery: order.delivery
        ? {
            id: order.delivery.id,
            address: order.delivery.address,
            courierName: order.delivery.courierName,
            dispatchedAt: order.delivery.dispatchedAt,
            deliveredAt: order.delivery.deliveredAt,
            note: order.delivery.note,
          }
        : null,
    };
  }
}
