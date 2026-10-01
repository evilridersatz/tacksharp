import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';

import { AiService } from '../ai/ai.service.js';
import { WhatsAppWorkerModule } from './whatsapp.worker.module.js';

import type { WhatsAppMessageJobData } from './whatsapp.queue.js';

const connection = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
  tls:
    process.env.REDIS_TLS === 'true'
      ? {}
      : undefined,
  maxRetriesPerRequest: null,
});

async function bootstrap() {
  const app =
    await NestFactory.createApplicationContext(
      WhatsAppWorkerModule,
    );

  const aiService =
    app.get(AiService);

  const worker =
    new Worker<WhatsAppMessageJobData>(
      'whatsapp-message',

      async (job) => {
        console.log('========================================');
        console.log('WHATSAPP JOB STARTED');
        console.log('Job ID:', job.id);
        console.log(
          'Message ID:',
          job.data.messageId,
        );
        console.log(
          'From:',
          job.data.from,
        );
        console.log(
          'Customer:',
          job.data.customerName,
        );
        console.log(
          'Message:',
          job.data.text,
        );
        console.log(
          'Organization:',
          job.data.organizationId,
        );
        console.log('========================================');

        if (!job.data.text) {
          console.log(
            'WHATSAPP MESSAGE HAS NO TEXT. Skipping.',
          );

          return {
            success: true,
            skipped: true,
            reason: 'no_text',
          };
        }

        const result =
          await aiService.generateResponse({
            organizationId:
              job.data.organizationId,

            channel: 'whatsapp',

            externalId:
              job.data.from,

            message:
              job.data.text,

            phone:
              job.data.from,
          });

        console.log('----------------------------------------');
        console.log('WHATSAPP AI RESPONSE');
        console.log(
          result.response,
        );
        console.log(
          'Conversation ID:',
          result.conversationId,
        );
        console.log('----------------------------------------');

        console.log(
          'WHATSAPP AI PROCESSING COMPLETED',
        );

        console.log('========================================');

        return {
          success: true,
          messageId:
            job.data.messageId,
          conversationId:
            result.conversationId,
          response:
            result.response,
          processedAt:
            new Date().toISOString(),
        };
      },

      {
        connection,
        concurrency: 5,
      },
    );

  worker.on('completed', (job) => {
    console.log(
      `WHATSAPP JOB COMPLETED: ${job.id}`,
    );
  });

  worker.on('failed', (job, error) => {
    console.error(
      `WHATSAPP JOB FAILED: ${
        job?.id ?? 'unknown'
      }`,
      error,
    );
  });

  worker.on('error', (error) => {
    console.error(
      'WHATSAPP WORKER ERROR:',
      error,
    );
  });

  async function shutdown() {
    console.log(
      'Shutting down WhatsApp worker...',
    );

    await worker.close();
    await app.close();
    await connection.quit();
  }

  process.on(
    'SIGINT',
    shutdown,
  );

  process.on(
    'SIGTERM',
    shutdown,
  );

  console.log(
    'WHATSAPP WORKER STARTED',
  );

  console.log(
    'Waiting for WhatsApp messages...',
  );
}

bootstrap().catch((error) => {
  console.error(
    'WHATSAPP WORKER STARTUP FAILED:',
    error,
  );

  process.exit(1);
});
