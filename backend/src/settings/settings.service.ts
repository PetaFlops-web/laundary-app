import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface OpeningHoursEntry {
  open: string;
  close: string;
  isOpen: boolean;
}

export interface LaundrySettings {
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  whatsappNumber: string;
  openingHours: Record<string, OpeningHoursEntry>;
  pickupEnabled: boolean;
  pickupArea: string | null;
  deliveryEnabled: boolean;
  deliveryArea: string | null;
  mapLink: string | null;
  paymentReminderDays: number;
  paymentExpiryHours: number;
  maxPendingBookings: number;
}

export const DEFAULT_SETTINGS: LaundrySettings = {
  businessName: 'Achilla Laundry',
  businessAddress: 'Belum diatur',
  businessPhone: '6280000000000',
  whatsappNumber: '6280000000000',
  openingHours: {
    mon: { open: '08:00', close: '20:00', isOpen: true },
    tue: { open: '08:00', close: '20:00', isOpen: true },
    wed: { open: '08:00', close: '20:00', isOpen: true },
    thu: { open: '08:00', close: '20:00', isOpen: true },
    fri: { open: '08:00', close: '20:00', isOpen: true },
    sat: { open: '08:00', close: '16:00', isOpen: true },
    sun: { open: '08:00', close: '16:00', isOpen: false },
  },
  pickupEnabled: true,
  pickupArea: null,
  deliveryEnabled: true,
  deliveryArea: null,
  mapLink: null,
  paymentReminderDays: 2,
  paymentExpiryHours: 24,
  maxPendingBookings: 3,
};

const SETTINGS_KEY = 'laundry_settings';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async find(): Promise<LaundrySettings> {
    const record = await this.prisma.setting.findUnique({
      where: { key: SETTINGS_KEY },
    });

    if (!record) {
      return DEFAULT_SETTINGS;
    }

    return this.parseSettings(record.value);
  }

  async update(partial: Partial<LaundrySettings>): Promise<LaundrySettings> {
    const current = await this.find();
    const next = { ...current, ...partial };

    const value = next as unknown as Prisma.InputJsonValue;

    await this.prisma.setting.upsert({
      where: { key: SETTINGS_KEY },
      update: { value },
      create: { key: SETTINGS_KEY, value },
    });

    return next;
  }

  async seedDefaults(): Promise<void> {
    const existing = await this.prisma.setting.findUnique({
      where: { key: SETTINGS_KEY },
    });

    if (!existing) {
      const value = DEFAULT_SETTINGS as unknown as Prisma.InputJsonValue;
      await this.prisma.setting.create({
        data: { key: SETTINGS_KEY, value },
      });
    }
  }

  private parseSettings(value: Prisma.JsonValue): LaundrySettings {
    const raw = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

    return {
      businessName: this.string(raw.businessName, DEFAULT_SETTINGS.businessName),
      businessAddress: this.string(raw.businessAddress, DEFAULT_SETTINGS.businessAddress),
      businessPhone: this.string(raw.businessPhone, DEFAULT_SETTINGS.businessPhone),
      whatsappNumber: this.string(raw.whatsappNumber, DEFAULT_SETTINGS.whatsappNumber),
      openingHours: this.openingHours(raw.openingHours),
      pickupEnabled: this.boolean(raw.pickupEnabled, DEFAULT_SETTINGS.pickupEnabled),
      pickupArea: this.nullableString(raw.pickupArea),
      deliveryEnabled: this.boolean(raw.deliveryEnabled, DEFAULT_SETTINGS.deliveryEnabled),
      deliveryArea: this.nullableString(raw.deliveryArea),
      mapLink: this.nullableString(raw.mapLink),
      paymentReminderDays: this.int(raw.paymentReminderDays, DEFAULT_SETTINGS.paymentReminderDays),
      paymentExpiryHours: this.int(raw.paymentExpiryHours, DEFAULT_SETTINGS.paymentExpiryHours),
      maxPendingBookings: this.int(raw.maxPendingBookings, DEFAULT_SETTINGS.maxPendingBookings),
    };
  }

  private string(value: unknown, fallback: string): string {
    return typeof value === 'string' ? value : fallback;
  }

  private nullableString(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && value.length === 0) return null;
    return typeof value === 'string' ? value : null;
  }

  private boolean(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
  }

  private int(value: unknown, fallback: number): number {
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(num) ? Math.round(num) : fallback;
  }

  private openingHours(value: unknown): Record<string, OpeningHoursEntry> {
    if (typeof value !== 'object' || value === null) {
      return DEFAULT_SETTINGS.openingHours;
    }

    const result: Record<string, OpeningHoursEntry> = {};
    for (const [day, entry] of Object.entries(value as Record<string, unknown>)) {
      if (
        entry &&
        typeof entry === 'object' &&
        'open' in entry &&
        'close' in entry &&
        'isOpen' in entry
      ) {
        const e = entry as Record<string, unknown>;
        result[day] = {
          open: typeof e.open === 'string' ? e.open : '08:00',
          close: typeof e.close === 'string' ? e.close : '20:00',
          isOpen: typeof e.isOpen === 'boolean' ? e.isOpen : true,
        };
      }
    }

    return Object.keys(result).length > 0 ? result : DEFAULT_SETTINGS.openingHours;
  }
}
