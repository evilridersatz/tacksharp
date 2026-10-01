import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { FollowUpsService } from './follow-ups.service.js';

interface CreateFollowUpBody {
  organizationId: string;
  leadId: string;
  customerId: string;
  channel?: string;
  action?: string;
  message?: string;
  scheduledAt: string;
}

@Controller('follow-ups')
export class FollowUpsController {
  constructor(
    private readonly followUpsService: FollowUpsService,
  ) {}

  @Post()
  async create(
    @Body() body: CreateFollowUpBody,
  ) {
    return this.followUpsService.create(body);
  }

  @Post('test/:leadId')
  async createTestFollowUp(
    @Param('leadId') leadId: string,
    @Body() body: {
      customerId: string;
      delaySeconds?: number;
      message?: string;
    },
  ) {
    const organizationId =
      process.env.DEFAULT_ORGANIZATION_ID ??
      'org_real_estate_001';

    const delaySeconds = body.delaySeconds ?? 10;

    return this.followUpsService.create({
      organizationId,
      leadId,
      customerId: body.customerId,
      channel: 'whatsapp',
      action: 'message',
      message:
        body.message ??
        'Hi! Just following up on your property enquiry. Are you still looking for a property?',
      scheduledAt: new Date(
        Date.now() + delaySeconds * 1000,
      ).toISOString(),
    });
  }

  @Get()
  async findAll() {
    const organizationId =
      process.env.DEFAULT_ORGANIZATION_ID ??
      'org_real_estate_001';

    return this.followUpsService.findAll(
      organizationId,
    );
  }

  @Get(':followUpId')
  async findOne(
    @Param('followUpId') followUpId: string,
  ) {
    const organizationId =
      process.env.DEFAULT_ORGANIZATION_ID ??
      'org_real_estate_001';

    return this.followUpsService.findOne(
      organizationId,
      followUpId,
    );
  }

  @Patch(':followUpId/cancel')
  async cancel(
    @Param('followUpId') followUpId: string,
    @Body()
    body: {
      reason?: string;
    },
  ) {
    const organizationId =
      process.env.DEFAULT_ORGANIZATION_ID ??
      'org_real_estate_001';

    return this.followUpsService.cancel(
      organizationId,
      followUpId,
      body?.reason,
    );
  }
}
