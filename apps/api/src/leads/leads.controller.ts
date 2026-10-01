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
  LEAD_STATUSES,
  type LeadStatus,
  LeadsService,
} from './leads.service.js';

@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
  ) {}

  @Post()
  async createLead(
    @Body()
    body: {
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
    },
  ) {
    return this.leadsService.createLead({
      organizationId: body.organizationId,
      name: body.name,
      phone: body.phone,
      email: body.email,
      language: body.language,
      source: body.source,
      budget: body.budget,
      location: body.location,
      bhk: body.bhk,
      propertyType: body.propertyType,
      notes: body.notes,
    });
  }

  @Get()
  async getLeads(
    @Query('organizationId')
    organizationId: string,
  ) {
    return this.leadsService.getLeads(
      organizationId,
    );
  }

  @Patch(':leadId/status')
  async updateLeadStatus(
    @Param('leadId') leadId: string,
    @Body()
    body: {
      organizationId: string;
      status: LeadStatus;
    },
  ) {
    if (
      !Object.values(LEAD_STATUSES).includes(
        body.status,
      )
    ) {
      return {
        updated: false,
        error: `Invalid lead status: ${body.status}`,
        allowedStatuses:
          Object.values(LEAD_STATUSES),
      };
    }

    const lead =
      await this.leadsService.updateLeadStatus({
        organizationId:
          body.organizationId,
        leadId,
        status: body.status,
      });

    if (!lead) {
      return {
        updated: false,
        error: 'Lead not found',
      };
    }

    return lead;
  }
}