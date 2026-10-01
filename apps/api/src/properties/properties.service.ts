import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  async searchProperties(params: {
    organizationId: string;
    location?: string;
    bhk?: number;
    propertyType?: string;
    maxBudget?: number;
  }) {
    const {
      organizationId,
      location,
      bhk,
      propertyType,
      maxBudget,
    } = params;

    return this.prisma.property.findMany({
      where: {
        organizationId,
        status: 'available',

        ...(location
          ? {
              location: {
                equals: location,
              },
            }
          : {}),

        ...(bhk
          ? {
              bhk,
            }
          : {}),

        ...(propertyType
          ? {
              type: propertyType,
            }
          : {}),

        ...(maxBudget
          ? {
              price: {
                lte: maxBudget,
              },
            }
          : {}),
      },

      orderBy: {
        price: 'asc',
      },
    });
  }

  async getPropertyDetails(params: {
    organizationId: string;
    propertyId: string;
  }) {
    const {
      organizationId,
      propertyId,
    } = params;

    return this.prisma.property.findFirst({
      where: {
        id: propertyId,
        organizationId,
      },
    });
  }
}