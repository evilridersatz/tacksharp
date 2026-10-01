import { Module } from '@nestjs/common';
import { FollowUpsController } from './follow-ups.controller.js';
import { FollowUpsService } from './follow-ups.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Module({
  controllers: [FollowUpsController],
  providers: [FollowUpsService, PrismaService],
  exports: [FollowUpsService],
})
export class FollowUpsModule {}
