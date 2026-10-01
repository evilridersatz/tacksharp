import { Body, Controller, Post } from '@nestjs/common';
import { AiService } from './ai.service.js';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
  ) {}

  @Post('chat')
  async chat(
    @Body()
    body: {
      organizationId: string;
      channel: string;
      externalId: string;
      message: string;
      phone?: string;
    },
  ) {
    return this.aiService.generateResponse({
      organizationId: body.organizationId,
      channel: body.channel,
      externalId: body.externalId,
      message: body.message,
      phone: body.phone,
    });
  }
}