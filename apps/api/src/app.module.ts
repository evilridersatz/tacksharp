import { Module } from '@nestjs/common';

import { PrismaModule } from './prisma/prisma.module.js';
import { PropertiesModule } from './properties/properties.module.js';
import { LeadsModule } from './leads/leads.module.js';
import { ConversationsModule } from './conversations/conversations.module.js';
import { AiModule } from './ai/ai.module.js';
import { FollowUpsModule } from './follow-ups/follow-ups.module.js';
import { SiteVisitsModule } from './site-visits/site-visits.module.js';
import { WhatsAppModule } from './webhooks/whatsapp.module.js';

@Module({
  imports: [
    PrismaModule,
    PropertiesModule,
    LeadsModule,
    ConversationsModule,
    AiModule,
    FollowUpsModule,
    SiteVisitsModule,
    WhatsAppModule,
  ],
})
export class AppModule {}
