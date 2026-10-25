import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { DEFAULT_SETTINGS, SettingsService } from './settings.service.js';

describe('SettingsService', () => {
  let service: SettingsService;

  const prisma = {
    setting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  describe('find', () => {
    it('mengembalikan default settings bila belum ada di database', async () => {
      prisma.setting.findUnique.mockResolvedValue(null);

      const result = await service.find();

      expect(result.businessName).toBe(DEFAULT_SETTINGS.businessName);
      expect(result.pickupEnabled).toBe(DEFAULT_SETTINGS.pickupEnabled);
      expect(result.paymentReminderDays).toBe(DEFAULT_SETTINGS.paymentReminderDays);
    });

    it('membaca settings dari database bila ada', async () => {
      prisma.setting.findUnique.mockResolvedValue({
        key: 'laundry_settings',
        value: { businessName: 'Laundry Baru', pickupEnabled: false },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.find();

      expect(result.businessName).toBe('Laundry Baru');
      expect(result.pickupEnabled).toBe(false);
      expect(result.deliveryEnabled).toBe(DEFAULT_SETTINGS.deliveryEnabled);
    });
  });

  describe('update', () => {
    it('mengupdate settings dengan merge nilai lama', async () => {
      prisma.setting.findUnique.mockResolvedValue(null);
      prisma.setting.upsert.mockResolvedValue({});

      const result = await service.update({ businessName: 'Updated' });

      expect(result.businessName).toBe('Updated');
      expect(result.businessAddress).toBe(DEFAULT_SETTINGS.businessAddress);
      expect(prisma.setting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'laundry_settings' },
        }),
      );
    });
  });

  describe('seedDefaults', () => {
    it('tidak menimpa settings yang sudah ada', async () => {
      prisma.setting.findUnique.mockResolvedValue({});

      await service.seedDefaults();

      expect(prisma.setting.create).not.toHaveBeenCalled();
    });

    it('membuat settings default bila belum ada', async () => {
      prisma.setting.findUnique.mockResolvedValue(null);
      prisma.setting.create.mockResolvedValue({});

      await service.seedDefaults();

      expect(prisma.setting.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ key: 'laundry_settings' }),
        }),
      );
    });
  });
});
