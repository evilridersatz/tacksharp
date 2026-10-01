import {
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';

import { WhatsAppService } from './whatsapp.service.js';

@Controller('webhooks/whatsapp')
export class WhatsAppController {
  constructor(
    private readonly whatsappService: WhatsAppService,
  ) {}

  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const verifyToken =
      process.env.WHATSAPP_VERIFY_TOKEN;

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
      message: 'Webhook verification failed',
    };
  }

  @Post()
  async receiveWebhook(@Body() body: unknown) {
    return this.whatsappService.processWebhook(body);
  }
}
