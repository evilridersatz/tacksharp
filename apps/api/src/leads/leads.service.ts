import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export const LEAD_STATUSES = {
  NEW: 'new',
  QUALIFIED: 'qualified',
  PROPERTY_INTERESTED:
    'property_interested',
  SITE_VISIT: 'site_visit',
  WON: 'won',
  LOST: 'lost',
} as const;

export type LeadStatus =
  (typeof LEAD_STATUSES)[keyof typeof LEAD_STATUSES];

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async createLead(params: {
    organizationId: string;
    name?: string;
    phone?: string;
    email?: string;
    language?: string;
    source?: string;
    budget?: number;
    location?: string;
    bhk?: number;
    propertyType?: string;
    notes?: string;
  }) {
    const {
      organizationId,
      name,
      phone,
      email,
      language,
      source,
      budget,
      location,
      bhk,
      propertyType,
      notes,
    } = params;

    const normalizedPropertyType =
      propertyType
        ? this.normalizePropertyType(
            propertyType,
          )
        : undefined;

    let customer;

    if (phone) {
      customer =
        await this.prisma.customer.findFirst({
          where: {
            organizationId,
            phone,
          },
        });
    }

    if (customer) {
      customer =
        await this.prisma.customer.update({
          where: {
            id: customer.id,
          },

          data: {
            ...(name !== undefined
              ? { name }
              : {}),

            ...(email !== undefined
              ? { email }
              : {}),

            ...(language !== undefined
              ? { language }
              : {}),

            ...(source !== undefined
              ? { source }
              : {}),

            ...(location !== undefined
              ? { location }
              : {}),

            ...(budget !== undefined
              ? { budget }
              : {}),

            ...(bhk !== undefined
              ? { bhk }
              : {}),

            ...(normalizedPropertyType !==
            undefined
              ? {
                  propertyType:
                    normalizedPropertyType,
                }
              : {}),
          },
        });
    } else {
      customer =
        await this.prisma.customer.create({
          data: {
            organizationId,
            name,
            phone,
            email,
            language,
            source,
            location,
            budget,
            bhk,
            propertyType:
              normalizedPropertyType,
          },
        });
    }

    /*
     * Find the customer's latest active lead.
     *
     * We intentionally do NOT require every requirement
     * to match exactly here.
     *
     * A customer's budget/location/BHK can change during
     * a conversation. That should update the active lead
     * rather than create another lead for the same enquiry.
     */
    const existingLead =
      await this.prisma.lead.findFirst({
        where: {
          organizationId,
          customerId: customer.id,

          status: {
            not: LEAD_STATUSES.LOST,
          },
        },

        orderBy: {
          createdAt: 'desc',
        },
      });

    if (existingLead) {
      return this.prisma.lead.update({
        where: {
          id: existingLead.id,
        },

        data: {
          ...(source !== undefined
            ? { source }
            : {}),

          ...(notes !== undefined
            ? { notes }
            : {}),

          ...(budget !== undefined
            ? { budget }
            : {}),

          ...(location !== undefined
            ? { location }
            : {}),

          ...(bhk !== undefined
            ? { bhk }
            : {}),

          ...(normalizedPropertyType !==
          undefined
            ? {
                propertyType:
                  normalizedPropertyType,
              }
            : {}),
        },

        include: {
          customer: true,
        },
      });
    }

    return this.prisma.lead.create({
      data: {
        organizationId,
        customerId: customer.id,

        status: LEAD_STATUSES.NEW,

        budget,
        location,
        bhk,
        propertyType:
          normalizedPropertyType,

        source,
        notes,
      },

      include: {
        customer: true,
      },
    });
  }

  async getLeads(
    organizationId: string,
  ) {
    return this.prisma.lead.findMany({
      where: {
        organizationId,
      },

      include: {
        customer: true,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateLeadStatus(params: {
    organizationId: string;
    leadId: string;
    status: LeadStatus;
  }) {
    const {
      organizationId,
      leadId,
      status,
    } = params;

    const lead =
      await this.prisma.lead.findFirst({
        where: {
          id: leadId,
          organizationId,
        },
      });

    if (!lead) {
      return null;
    }

    return this.prisma.lead.update({
      where: {
        id: lead.id,
      },

      data: {
        status,
      },

      include: {
        customer: true,
      },
    });
  }

  async updateLeadStatusByCustomer(params: {
    organizationId: string;
    customerId: string;
    status: LeadStatus;
  }) {
    const {
      organizationId,
      customerId,
      status,
    } = params;

    const lead =
      await this.prisma.lead.findFirst({
        where: {
          organizationId,
          customerId,

          status: {
            not: LEAD_STATUSES.LOST,
          },
        },

        orderBy: {
          createdAt: 'desc',
        },
      });

    if (!lead) {
      return null;
    }

    return this.prisma.lead.update({
      where: {
        id: lead.id,
      },

      data: {
        status,
      },

      include: {
        customer: true,
      },
    });
  }

  private normalizePropertyType(
    propertyType: string,
  ): string {
    const normalized =
      propertyType
        .trim()
        .toLowerCase();

    const propertyTypeMap: Record<
      string,
      string
    > = {
      apartment: 'Apartment',
      flat: 'Apartment',
      flats: 'Apartment',

      villa: 'Villa',
      villas: 'Villa',

      plot: 'Plot',
      plots: 'Plot',

      house: 'House',
      houses: 'House',

      commercial: 'Commercial',
      office: 'Commercial',
      shop: 'Commercial',
    };

    return (
      propertyTypeMap[normalized] ??
      propertyType.trim()
    );
  }
}