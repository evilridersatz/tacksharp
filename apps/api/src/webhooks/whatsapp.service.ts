import { Injectable, BadRequestException } from '@nestjs/common';
import { whatsappQueue } from '../queues/whatsapp.queue.js';

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
