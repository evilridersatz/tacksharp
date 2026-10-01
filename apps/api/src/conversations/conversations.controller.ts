import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ConversationsService } from './conversations.service.js';

@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
  ) {}

  @Post()
  async createOrGetConversation(
    @Body()
    body: {
      organizationId: string;
      customerId?: string;
      channel: string;
      externalId?: string;
    },
  ) {
    return this.conversationsService.getOrCreateConversation(
      body,
    );
  }

  @Post(':conversationId/messages')
  async addMessage(
    @Param('conversationId') conversationId: string,
    @Body()
    body: {
      organizationId: string;
      role: string;
      content: string;
      externalId?: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    return this.conversationsService.addMessage({
      organizationId: body.organizationId,
      conversationId,
      role: body.role,
      content: body.content,
      externalId: body.externalId,
      metadata: body.metadata,
    });
  }

  @Get(':conversationId/messages')
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Query('organizationId') organizationId: string,
  ) {
    return this.conversationsService.getMessages(
      organizationId,
      conversationId,
    );
  }
}
