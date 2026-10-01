import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const connection = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  maxRetriesPerRequest: null,
});

export type WhatsAppMessageJobData = {
  organizationId: string;
  phoneNumberId: string;
  from: string;
  messageId: string;
  messageType: string;
  text?: string;
  customerName?: string;
  timestamp?: string;
};

export const whatsappQueue = new Queue<WhatsAppMessageJobData>(
  'whatsapp-message',
  {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  },
);
