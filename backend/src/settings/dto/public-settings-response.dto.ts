import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OpeningHoursDto {
  @ApiProperty({ example: '08:00' })
  open!: string;

  @ApiProperty({ example: '20:00' })
  close!: string;

  @ApiProperty({ example: true })
  isOpen!: boolean;
}

export class PublicSettingsResponseDto {
  @ApiProperty({ example: 'Achilla Laundry' })
  businessName!: string;

  @ApiProperty({ example: 'Jl. Pramuka, Bandar Lampung' })
  businessAddress!: string;

  @ApiProperty({ example: '6281234567890' })
  businessPhone!: string;

  @ApiProperty({ example: '6281234567890' })
  whatsappNumber!: string;

  @ApiProperty({ type: Object, example: { mon: { open: '08:00', close: '20:00', isOpen: true } } })
  openingHours!: Record<string, OpeningHoursDto>;

  @ApiProperty({ example: true })
  pickupEnabled!: boolean;

  @ApiPropertyOptional({ example: 'Area kampus Universitas Malahayati dan sekitarnya' })
  pickupArea!: string | null;

  @ApiProperty({ example: true })
  deliveryEnabled!: boolean;

  @ApiPropertyOptional({ example: 'Radius 5 km dari lokasi laundry' })
  deliveryArea!: string | null;

  @ApiPropertyOptional({ example: 'https://maps.google.com/?q=...' })
  mapLink!: string | null;
}
