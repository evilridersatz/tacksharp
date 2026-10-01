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

import { FollowUpsService } from '../follow-ups/follow-ups.service.js';

const DEMO_ORGANIZATION_ID = 'org_real_estate_001';

@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly followUpsService: FollowUpsService,
  ) {}

  @Post()
  async createLead(
    @Body()
    body: {
      organizationId?: string;
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
    const lead =
      await this.leadsService.createLead({
        organizationId: DEMO_ORGANIZATION_ID,
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

    // Automatically schedule the follow-up sequence
    // only when we have a customer/lead record.
    if (lead?.id && lead?.customerId) {
      try {
        const sequence =
          await this.followUpsService
            .scheduleLeadFollowUps({
              organizationId:
                DEMO_ORGANIZATION_ID,
              leadId: lead.id,
              customerId:
                lead.customerId,
              customerName:
                body.name,
            });

        return {
          lead,
          followUps: sequence.map(
            (item) => ({
              followUpId:
                item.followUp.id,
              jobId: item.jobId,
              scheduledAt:
                item.followUp.scheduledAt,
              status:
                item.followUp.status,
            }),
          ),
        };
      } catch (error) {
        console.error(
          'FOLLOW-UP SCHEDULING FAILED:',
          error,
        );

        // Lead creation remains successful even if
        // follow-up scheduling temporarily fails.
        return {
          lead,
          followUps: [],
          followUpSchedulingError: true,
        };
      }
    }

    return {
      lead,
      followUps: [],
    };
  }

  @Get()
  async getLeads(
    @Query('organizationId')
    _organizationId?: string,
  ) {
    return this.leadsService.getLeads(
      DEMO_ORGANIZATION_ID,
    );
  }

  @Patch(':leadId/status')
  async updateLeadStatus(
    @Param('leadId') leadId: string,
    @Body()
    body: {
      organizationId?: string;
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
          DEMO_ORGANIZATION_ID,
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
