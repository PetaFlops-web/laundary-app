import type { Service, ServiceType, ServiceUnit } from '@prisma/client';

export class ServiceResponseDto {
  id: string;
  name: string;
  description: string | null;
  type: ServiceType;
  price: string;
  unit: ServiceUnit;
  estimatedHours: number;
  createdAt: Date;
  updatedAt: Date;

  static from(service: Service): ServiceResponseDto {
    return {
      id: service.id,
      name: service.name,
      description: service.description,
      type: service.type,
      price: service.price.toString(),
      unit: service.unit,
      estimatedHours: service.estimatedHours,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };
  }
}
