import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

export const SITE_VISIT_STATUSES = {
  REQUESTED: 'requested',
  SCHEDULED: 'scheduled',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
} as const;

export type SiteVisitStatus =
  (typeof SITE_VISIT_STATUSES)[keyof typeof SITE_VISIT_STATUSES];

const ALLOWED_TRANSITIONS: Record<
  SiteVisitStatus,
  SiteVisitStatus[]
> = {
  requested: [
    'scheduled',
    'cancelled',
  ],

  scheduled: [
    'confirmed',
    'cancelled',
    'no_show',
  ],

  confirmed: [
    'completed',
    'cancelled',
    'no_show',
  ],

  completed: [],

  cancelled: [],

  no_show: [],
};

@Injectable()
export class SiteVisitsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async createSiteVisit(params: {
    organizationId: string;
    leadId: string;
    customerId?: string;
    propertyId: string;
    scheduledAt: string;
    status?: SiteVisitStatus;
    notes?: string;
  }) {
    const {
      organizationId,
      leadId,
      customerId,
      propertyId,
      scheduledAt,
      status = SITE_VISIT_STATUSES.SCHEDULED,
      notes,
    } = params;

    const parsedScheduledAt =
      new Date(scheduledAt);

    if (
      Number.isNaN(
        parsedScheduledAt.getTime(),
      )
    ) {
      throw new BadRequestException(
        'Invalid scheduledAt date/time.',
      );
    }

    if (
      parsedScheduledAt.getTime() <=
      Date.now()
    ) {
      throw new BadRequestException(
        'Site visit must be scheduled for a future date and time.',
      );
    }

    const lead =
      await this.prisma.lead.findFirst({
        where: {
          id: leadId,
          organizationId,
        },

        include: {
          customer: true,
        },
      });

    if (!lead) {
      throw new NotFoundException(
        'Lead not found.',
      );
    }

    if (
      customerId &&
      lead.customerId !== customerId
    ) {
      throw new BadRequestException(
        'Customer does not belong to this lead.',
      );
    }

    const property =
      await this.prisma.property.findFirst({
        where: {
          id: propertyId,
          organizationId,
        },
      });

    if (!property) {
      throw new NotFoundException(
        'Property not found.',
      );
    }

    if (property.status !== 'available') {
      throw new BadRequestException(
        'This property is not currently available.',
      );
    }

    const existingSiteVisit =
      await this.prisma.siteVisit.findFirst({
        where: {
          organizationId,
          leadId,
          propertyId,

          scheduledAt:
            parsedScheduledAt,

          status: {
            in: [
              SITE_VISIT_STATUSES.REQUESTED,
              SITE_VISIT_STATUSES.SCHEDULED,
              SITE_VISIT_STATUSES.CONFIRMED,
            ],
          },
        },

        orderBy: {
          createdAt: 'desc',
        },
      });

    if (existingSiteVisit) {
      return existingSiteVisit;
    }

    const siteVisit =
      await this.prisma.siteVisit.create({
        data: {
          id: randomUUID(),
          organizationId,
          leadId,

          customerId:
            customerId ??
            lead.customerId,

          propertyId,

          scheduledAt:
            parsedScheduledAt,

          status,

          notes,

          updatedAt: new Date(),
        },
      });

    await this.prisma.lead.update({
      where: {
        id: lead.id,
      },

      data: {
        status: 'site_visit',
      },
    });

    return siteVisit;
  }

  async bookByCustomerPhone(params: {
    organizationId: string;
    phone: string;
    propertyId: string;
    scheduledAt: string;
    notes?: string;
  }) {
    const {
      organizationId,
      phone,
      propertyId,
      scheduledAt,
      notes,
    } = params;

    const customer =
      await this.prisma.customer.findFirst({
        where: {
          organizationId,
          phone,
        },
      });

    if (!customer) {
      throw new NotFoundException(
        'Customer not found.',
      );
    }

    const lead =
      await this.prisma.lead.findFirst({
        where: {
          organizationId,
          customerId:
            customer.id,

          status: {
            not: 'lost',
          },
        },

        orderBy: {
          createdAt: 'desc',
        },
      });

    if (!lead) {
      throw new NotFoundException(
        'Active lead not found for this customer.',
      );
    }

    return this.createSiteVisit({
      organizationId,
      leadId: lead.id,
      customerId:
        customer.id,
      propertyId,
      scheduledAt,
      status:
        SITE_VISIT_STATUSES.SCHEDULED,
      notes,
    });
  }

  async getSiteVisits(
    organizationId: string,
  ) {
    return this.prisma.siteVisit.findMany({
      where: {
        organizationId,
      },

      orderBy: {
        scheduledAt: 'asc',
      },
    });
  }

  async getSiteVisit(
    organizationId: string,
    siteVisitId: string,
  ) {
    const siteVisit =
      await this.prisma.siteVisit.findFirst({
        where: {
          id: siteVisitId,
          organizationId,
        },
      });

    if (!siteVisit) {
      throw new NotFoundException(
        'Site visit not found.',
      );
    }

    return siteVisit;
  }

  async updateStatus(params: {
    organizationId: string;
    siteVisitId: string;
    status: SiteVisitStatus;
  }) {
    const {
      organizationId,
      siteVisitId,
      status,
    } = params;

    const siteVisit =
      await this.prisma.siteVisit.findFirst({
        where: {
          id: siteVisitId,
          organizationId,
        },
      });

    if (!siteVisit) {
      throw new NotFoundException(
        'Site visit not found.',
      );
    }

    const currentStatus =
      siteVisit.status as SiteVisitStatus;

    if (
      currentStatus === status
    ) {
      return siteVisit;
    }

    const allowed =
      ALLOWED_TRANSITIONS[
        currentStatus
      ] ?? [];

    if (
      !allowed.includes(status)
    ) {
      throw new BadRequestException(
        `Cannot change site visit status from "${currentStatus}" to "${status}".`,
      );
    }

    const updated =
      await this.prisma.siteVisit.update({
        where: {
          id: siteVisit.id,
        },

        data: {
          status,
        },
      });

    return updated;
  }
}
