import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { PublicSettingsResponseDto } from './dto/public-settings-response.dto.js';
import { SettingsService } from './settings.service.js';

@ApiTags('Settings')
@Controller('settings')
@Public()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('public')
  @ApiOperation({ summary: 'Pengaturan usaha untuk publik' })
  @ApiOkResponse({ type: PublicSettingsResponseDto })
  async findPublic(): Promise<PublicSettingsResponseDto> {
    const settings = await this.settingsService.find();

    return {
      businessName: settings.businessName,
      businessAddress: settings.businessAddress,
      businessPhone: settings.businessPhone,
      whatsappNumber: settings.whatsappNumber,
      openingHours: settings.openingHours,
      pickupEnabled: settings.pickupEnabled,
      pickupArea: settings.pickupArea,
      deliveryEnabled: settings.deliveryEnabled,
      deliveryArea: settings.deliveryArea,
      mapLink: settings.mapLink,
    };
  }
}
