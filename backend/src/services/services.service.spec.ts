import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceType, ServiceUnit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ServicesService } from './services.service.js';

const mockService = {
  id: 'svc-1',
  name: 'Cuci Reguler',
  description: 'Layanan reguler 3 hari',
  type: ServiceType.REGULAR,
  price: { toString: () => '7000' } as unknown as never,
  unit: ServiceUnit.KG,
  estimatedHours: 72,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const mockInactiveService = {
  ...mockService,
  id: 'svc-2',
  name: 'Cuci Ekspres',
  isActive: false,
};

const mockPrisma = {
  service: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  booking: {
    count: vi.fn(),
  },
  orderItem: {
    count: vi.fn(),
  },
};

describe('ServicesService', () => {
  let service: ServicesService;
  let prisma: typeof mockPrisma;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
    prisma = module.get(PrismaService);

    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new service', async () => {
      prisma.service.create.mockResolvedValue(mockService);

      const result = await service.create({
        name: 'Cuci Reguler',
        description: 'Layanan reguler 3 hari',
        type: ServiceType.REGULAR,
        price: 7000,
        unit: ServiceUnit.KG,
        estimatedHours: 72,
      });

      expect(prisma.service.create).toHaveBeenCalledWith({
        data: {
          name: 'Cuci Reguler',
          description: 'Layanan reguler 3 hari',
          type: ServiceType.REGULAR,
          price: 7000,
          unit: ServiceUnit.KG,
          estimatedHours: 72,
          isActive: true,
        },
      });
      expect(result.id).toBe('svc-1');
    });
  });

  describe('findAll', () => {
    it('should return all services including inactive', async () => {
      prisma.service.findMany.mockResolvedValue([
        mockService,
        mockInactiveService,
      ]);

      const result = await service.findAll();

      expect(prisma.service.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('should return service by id', async () => {
      prisma.service.findUnique.mockResolvedValue(mockService);

      const result = await service.findOne('svc-1');

      expect(prisma.service.findUnique).toHaveBeenCalledWith({
        where: { id: 'svc-1' },
      });
      expect(result.id).toBe('svc-1');
    });

    it('should throw NotFoundException when service not found', async () => {
      prisma.service.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update service fields', async () => {
      prisma.service.findUnique.mockResolvedValue(mockService);
      prisma.service.update.mockResolvedValue({
        ...mockService,
        name: 'Cuci Reguler Updated',
        price: { toString: () => '7500' } as unknown as never,
      });

      const result = await service.update('svc-1', {
        name: 'Cuci Reguler Updated',
        price: 7500,
      });

      expect(prisma.service.update).toHaveBeenCalledWith({
        where: { id: 'svc-1' },
        data: {
          name: 'Cuci Reguler Updated',
          price: 7500,
        },
      });
      expect(result.name).toBe('Cuci Reguler Updated');
    });

    it('should throw NotFoundException when service not found', async () => {
      prisma.service.findUnique.mockResolvedValue(null);

      await expect(service.update('missing-id', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should hard delete service when not used', async () => {
      prisma.service.findUnique.mockResolvedValue(mockService);
      prisma.booking.count.mockResolvedValue(0);
      prisma.orderItem.count.mockResolvedValue(0);
      prisma.service.delete.mockResolvedValue(mockService);

      const result = await service.remove('svc-1');

      expect(prisma.service.delete).toHaveBeenCalledWith({
        where: { id: 'svc-1' },
      });
      expect(result.message).toBe('Layanan berhasil dihapus');
    });

    it('should deactivate service when used in bookings', async () => {
      prisma.service.findUnique.mockResolvedValue(mockService);
      prisma.booking.count.mockResolvedValue(1);
      prisma.orderItem.count.mockResolvedValue(0);
      prisma.service.update.mockResolvedValue(mockInactiveService);

      const result = await service.remove('svc-1');

      expect(prisma.service.update).toHaveBeenCalledWith({
        where: { id: 'svc-1' },
        data: { isActive: false },
      });
      expect(result.message).toBe('Layanan sudah pernah dipakai dan dinonaktifkan');
    });

    it('should deactivate service when used in order items', async () => {
      prisma.service.findUnique.mockResolvedValue(mockService);
      prisma.booking.count.mockResolvedValue(0);
      prisma.orderItem.count.mockResolvedValue(1);
      prisma.service.update.mockResolvedValue(mockInactiveService);

      await service.remove('svc-1');

      expect(prisma.service.update).toHaveBeenCalledWith({
        where: { id: 'svc-1' },
        data: { isActive: false },
      });
    });

    it('should throw ConflictException when already inactive and used', async () => {
      prisma.service.findUnique.mockResolvedValue(mockInactiveService);
      prisma.booking.count.mockResolvedValue(1);
      prisma.orderItem.count.mockResolvedValue(0);

      await expect(service.remove('svc-2')).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when service not found', async () => {
      prisma.service.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAllPublic', () => {
    it('should return only active services with pagination meta', async () => {
      prisma.service.findMany.mockResolvedValue([mockService]);
      prisma.service.count.mockResolvedValue(1);

      const result = await service.findAllPublic({ page: 1, limit: 10 });

      expect(prisma.service.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        skip: 0,
        take: 10,
      });
      expect(prisma.service.count).toHaveBeenCalledWith({
        where: { isActive: true },
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].price).toBe('7000');
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });
  });

  describe('findOnePublic', () => {
    it('should return active service by id', async () => {
      prisma.service.findFirst.mockResolvedValue(mockService);

      const result = await service.findOnePublic('svc-1');

      expect(prisma.service.findFirst).toHaveBeenCalledWith({
        where: { id: 'svc-1', isActive: true },
      });
      expect(result.id).toBe('svc-1');
      expect(result.price).toBe('7000');
    });

    it('should throw NotFoundException when service is inactive or missing', async () => {
      prisma.service.findFirst.mockResolvedValue(null);

      await expect(service.findOnePublic('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
