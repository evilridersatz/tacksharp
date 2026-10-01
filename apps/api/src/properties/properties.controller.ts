import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { PropertiesService } from './properties.service.js';

@Controller('properties')
export class PropertiesController {
  constructor(
    private readonly propertiesService: PropertiesService,
  ) {}

  @Get('search')
  async searchProperties(
    @Query('organizationId') organizationId: string,
    @Query('location') location?: string,
    @Query('bhk') bhk?: string,
    @Query('propertyType') propertyType?: string,
    @Query('maxBudget') maxBudget?: string,
  ) {
    return this.propertiesService.searchProperties({
      organizationId,
      location,
      bhk: bhk ? Number(bhk) : undefined,
      propertyType,
      maxBudget: maxBudget ? Number(maxBudget) : undefined,
    });
  }

  @Get(':propertyId')
  async getPropertyDetails(
    @Param('propertyId') propertyId: string,
    @Query('organizationId') organizationId: string,
  ) {
    return this.propertiesService.getPropertyDetails({
      organizationId,
      propertyId,
    });
  }
}