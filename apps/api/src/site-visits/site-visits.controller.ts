import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import {
  SITE_VISIT_STATUSES,
  type SiteVisitStatus,
  SiteVisitsService,
} from './site-visits.service.js';

@Controller('site-visits')
export class SiteVisitsController {
  constructor(
    private readonly siteVisitsService: SiteVisitsService,
  ) {}

  @Post()
  async createSiteVisit(
    @Body()
    body: {
      organizationId: string;
      leadId: string;
      customerId?: string;
      propertyId: string;
      scheduledAt: string;
      status?: SiteVisitStatus;
      notes?: string;
    },
  ) {
    return this.siteVisitsService.createSiteVisit({
      organizationId:
        body.organizationId,
      leadId: body.leadId,
      customerId:
        body.customerId,
      propertyId:
        body.propertyId,
      scheduledAt:
        body.scheduledAt,
      status:
        body.status,
      notes:
        body.notes,
    });
  }

  @Post('book-by-phone')
  async bookByCustomerPhone(
    @Body()
    body: {
      organizationId: string;
      phone: string;
      propertyId: string;
      scheduledAt: string;
      notes?: string;
    },
  ) {
    return this.siteVisitsService.bookByCustomerPhone({
      organizationId:
        body.organizationId,
      phone:
        body.phone,
      propertyId:
        body.propertyId,
      scheduledAt:
        body.scheduledAt,
      notes:
        body.notes,
    });
  }

  @Get()
  async getSiteVisits(
    @Query('organizationId')
    organizationId: string,
  ) {
    return this.siteVisitsService.getSiteVisits(
      organizationId,
    );
  }

  @Get(':siteVisitId')
  async getSiteVisit(
    @Param('siteVisitId')
    siteVisitId: string,

    @Query('organizationId')
    organizationId: string,
  ) {
    return this.siteVisitsService.getSiteVisit(
      organizationId,
      siteVisitId,
    );
  }

  @Patch(':siteVisitId/status')
  async updateStatus(
    @Param('siteVisitId')
    siteVisitId: string,

    @Body()
    body: {
      organizationId: string;
      status: SiteVisitStatus;
    },
  ) {
    if (
      !Object.values(
        SITE_VISIT_STATUSES,
      ).includes(body.status)
    ) {
      return {
        updated: false,

        error:
          `Invalid site visit status: ${body.status}`,

        allowedStatuses:
          Object.values(
            SITE_VISIT_STATUSES,
          ),
      };
    }

    return this.siteVisitsService.updateStatus({
      organizationId:
        body.organizationId,
      siteVisitId,
      status:
        body.status,
    });
  }
}
