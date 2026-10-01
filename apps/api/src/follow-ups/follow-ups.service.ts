import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { followUpQueue } from '../queues/follow-up.queue.js';

export interface CreateFollowUpInput {
  organizationId: string;
  leadId: string;
  customerId: string;
  channel?: string;
  action?: string;
  message?: string;
  scheduledAt: string;
}

@Injectable()
export class FollowUpsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateFollowUpInput) {
    console.log('FOLLOW-UP INPUT:', {
      organizationId: input.organizationId,
      leadId: input.leadId,
      customerId: input.customerId,
      scheduledAt: input.scheduledAt,
    });

    const scheduledAt = new Date(input.scheduledAt);

    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Invalid scheduledAt');
    }

    if (scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        'scheduledAt must be in the future',
      );
    }

    const organization = await this.prisma.organization.findUnique({
      where: {
        id: input.organizationId,
      },
    });

    const lead = await this.prisma.lead.findFirst({
      where: {
        id: input.leadId,
        organizationId: input.organizationId,
        customerId: input.customerId,
      },
    });

    const customer = await this.prisma.customer.findFirst({
      where: {
        id: input.customerId,
        organizationId: input.organizationId,
      },
    });

    console.log('FOLLOW-UP LOOKUP RESULT:', {
      organizationFound: Boolean(organization),
      leadFound: Boolean(lead),
      customerFound: Boolean(customer),
      lead: lead
        ? {
            id: lead.id,
            organizationId: lead.organizationId,
            customerId: lead.customerId,
            status: lead.status,
          }
        : null,
      customer: customer
        ? {
            id: customer.id,
            organizationId: customer.organizationId,
          }
        : null,
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (!lead) {
      throw new NotFoundException(
        'Lead not found for this organization/customer',
      );
    }

    if (!customer) {
      throw new NotFoundException(
        'Customer not found for this organization',
      );
    }

    const followUp = await this.prisma.followUp.create({
      data: {
        organizationId: input.organizationId,
        leadId: input.leadId,
        customerId: input.customerId,
        channel: input.channel ?? 'whatsapp',
        action: input.action ?? 'message',
        message: input.message ?? null,
        scheduledAt,
        status: 'scheduled',
        attempts: 0,
      },
    });

    const delay = Math.max(
      0,
      scheduledAt.getTime() - Date.now(),
    );

    const job = await followUpQueue.add(
      'follow-up',
      {
        followUpId: followUp.id,
        organizationId: followUp.organizationId,
        leadId: followUp.leadId,
        customerId: followUp.customerId,
        channel: followUp.channel,
        action: followUp.action,
        message: followUp.message,
      },
      {
        delay,
        removeOnComplete: true,
        removeOnFail: false,
        jobId: `follow-up-${followUp.id}`,
      },
    );

    console.log('FOLLOW-UP CREATED:', {
      followUpId: followUp.id,
      jobId: job.id,
      delay,
    });

    return {
      followUp,
      jobId: job.id,
    };
  }

  async findAll(organizationId: string) {
    return this.prisma.followUp.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        scheduledAt: 'asc',
      },
    });
  }

  async findOne(
    organizationId: string,
    followUpId: string,
  ) {
    const followUp = await this.prisma.followUp.findFirst({
      where: {
        id: followUpId,
        organizationId,
      },
    });

    if (!followUp) {
      throw new NotFoundException('Follow-up not found');
    }

    return followUp;
  }

  async cancel(
    organizationId: string,
    followUpId: string,
    reason?: string,
  ) {
    const followUp = await this.prisma.followUp.findFirst({
      where: {
        id: followUpId,
        organizationId,
      },
    });

    if (!followUp) {
      throw new NotFoundException('Follow-up not found');
    }

    if (
      followUp.status === 'cancelled' ||
      followUp.status === 'completed'
    ) {
      return followUp;
    }

    const updated = await this.prisma.followUp.update({
      where: {
        id: followUp.id,
      },
      data: {
        status: 'cancelled',
        cancellationReason:
          reason ?? 'Cancelled manually',
      },
    });

    const job = await followUpQueue.getJob(
      `follow-up-${followUp.id}`,
    );

    if (job) {
      await job.remove();
    }

    return updated;
  }
}
