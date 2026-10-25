import type {
  Booking,
  BookingStatus,
  FulfillmentType,
  HandoverType,
  Service,
  User,
} from '@prisma/client';

export class BookingResponseDto {
  id!: string;
  code!: string;
  userId!: string;
  serviceId!: string;
  estimatedQuantity!: string | null;
  handoverType!: HandoverType;
  fulfillmentType!: FulfillmentType;
  pickupAddress!: string | null;
  deliveryAddress!: string | null;
  notes!: string | null;
  status!: BookingStatus;
  rejectionReason!: string | null;
  createdAt!: Date;
  updatedAt!: Date;

  // joined fields
  service?: { id: string; name: string; type: string; unit: string; price: string } | null;
  user?: { id: string; name: string; phone: string } | null;

  static from(
    booking: Booking & { service?: Service | null; user?: User | null },
  ): BookingResponseDto {
    return {
      id: booking.id,
      code: booking.code,
      userId: booking.userId,
      serviceId: booking.serviceId,
      estimatedQuantity: booking.estimatedQuantity?.toString() ?? null,
      handoverType: booking.handoverType,
      fulfillmentType: booking.fulfillmentType,
      pickupAddress: booking.pickupAddress,
      deliveryAddress: booking.deliveryAddress,
      notes: booking.notes,
      status: booking.status,
      rejectionReason: booking.rejectionReason,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      service: booking.service
        ? {
            id: booking.service.id,
            name: booking.service.name,
            type: booking.service.type,
            unit: booking.service.unit,
            price: booking.service.price.toString(),
          }
        : null,
      user: booking.user
        ? { id: booking.user.id, name: booking.user.name, phone: booking.user.phone }
        : null,
    };
  }
}
