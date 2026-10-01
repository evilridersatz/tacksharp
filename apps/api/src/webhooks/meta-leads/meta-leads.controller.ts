import {
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';

import { MetaLeadsService } from './meta-leads.service.js';

@Controller('webhooks/meta/leads')
export class MetaLeadsController {
  constructor(
    private readonly metaLeadsService: MetaLeadsService,
  ) {}

  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const verifyToken =
      process.env.META_LEAD_VERIFY_TOKEN;

    if (
      mode === 'subscribe' &&
      token &&
      verifyToken &&
      token === verifyToken
    ) {
      return challenge;
    }

    return {
      success: false,
      message: 'Meta webhook verification failed',
    };
  }

  @Post()
  async receive(@Body() body: unknown) {
    return this.metaLeadsService.processWebhook(
      body,
    );
  }
}
