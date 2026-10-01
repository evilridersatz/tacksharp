import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { whatsappQueue } from '../queues/whatsapp.queue.js';
import { followUpQueue } from '../queues/follow-up.queue.js';

type WhatsAppWebhookBody = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
        contacts?: Array<{
          profile?: {
            name?: string;
          };
          wa_id?: string;
        }>;
        messages?: Array<{
          from?: string;
          id?: string;
          timestamp?: string;
          type?: string;
          text?: {
            body?: string;
          };
        }>;
      };
    }>;
  }>;
};

@Injectable()
export class WhatsAppService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async processWebhook(body: unknown) {
    const payload = body as WhatsAppWebhookBody;

    if (payload.object !== 'whatsapp_business_account') {
      throw new BadRequestException(
        'Invalid WhatsApp webhook object',
      );
    }

    const jobs: string[] = [];

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') {
          continue;
        }

        const value = change.value;

        if (!value) {
          continue;
        }

        const phoneNumberId =
          value.metadata?.phone_number_id;

        if (!phoneNumberId) {
          continue;
        }

        for (const message of value.messages ?? []) {
          if (!message.from || !message.id) {
            continue;
          }

          const contact = value.contacts?.find(
            (item) => item.wa_id === message.from,
          );

          // Customer has replied: cancel all pending follow-ups.
          const customer = await this.prisma.customer.findFirst({
            where: {
              organizationId:
                process.env.WHATSAPP_DEFAULT_ORGANIZATION_ID ??
                'org_real_estate_001',
              phone: message.from,
            },
          });

          if (customer) {
            const pendingFollowUps =
              await this.prisma.followUp.findMany({
                where: {
                  organizationId:
                    process.env.WHATSAPP_DEFAULT_ORGANIZATION_ID ??
                    'org_real_estate_001',
                  customerId: customer.id,
                  status: 'scheduled',
                },
              });

            for (const followUp of pendingFollowUps) {
              await this.prisma.followUp.update({
                where: {
                  id: followUp.id,
                },
                data: {
                  status: 'cancelled',
                  cancellationReason:
                    'Customer replied on WhatsApp',
                },
              });

              const pendingJob =
                await followUpQueue.getJob(
                  `follow-up-${followUp.id}`,
                );

              if (pendingJob) {
                try {
                  await pendingJob.remove();
                } catch (error) {
                  console.warn(
                    'Could not remove follow-up job:',
                    followUp.id,
                    error,
                  );
                }
              }
            }

            if (pendingFollowUps.length > 0) {
              console.log(
                'FOLLOW-UPS CANCELLED AFTER CUSTOMER REPLY:',
                pendingFollowUps.map(
                  (item) => item.id,
                ),
              );
            }
          }

          const job = await whatsappQueue.add(
            'incoming-message',
            {
              organizationId:
                process.env.WHATSAPP_DEFAULT_ORGANIZATION_ID ??
                'org_real_estate_001',

              phoneNumberId,

              from: message.from,

              messageId: message.id,

              messageType:
                message.type ?? 'unknown',

              text:
                message.text?.body,

              customerName:
                contact?.profile?.name,

              timestamp:
                message.timestamp,
            },
            {
              jobId: `whatsapp-${message.id}`,
            },
          );

          jobs.push(String(job.id));

          console.log(
            'WHATSAPP MESSAGE QUEUED:',
            {
              jobId: job.id,
              messageId: message.id,
              from: message.from,
              text: message.text?.body,
            },
          );
        }
      }
    }

    return {
      success: true,
      queued: jobs.length,
      jobs,
    };
  }
}
