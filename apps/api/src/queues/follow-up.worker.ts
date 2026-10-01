import 'dotenv/config';

import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';

const connection = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  maxRetriesPerRequest: null,
});

const prismaAdapter = new PrismaMariaDb({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'password',
  database: 'tacksharp',
});

const prisma = new PrismaClient({
  adapter: prismaAdapter,
});

type FollowUpJobData = {
  followUpId: string;
  organizationId: string;
  leadId: string;
  customerId: string;
  channel: string;
  action: string;
  message?: string | null;
};

const worker = new Worker<FollowUpJobData>(
  'follow-up',
  async (job) => {
    console.log('========================================');
    console.log('FOLLOW-UP JOB STARTED');
    console.log('Job ID:', job.id);
    console.log('Follow-up ID:', job.data.followUpId);
    console.log('========================================');

    const followUp = await prisma.followUp.findUnique({
      where: {
        id: job.data.followUpId,
      },
    });

    if (!followUp) {
      throw new Error(
        `Follow-up ${job.data.followUpId} not found`,
      );
    }

    if (followUp.status === 'cancelled') {
      console.log(
        `FOLLOW-UP ${followUp.id} already cancelled. Skipping.`,
      );

      return {
        success: true,
        skipped: true,
        reason: 'cancelled',
      };
    }

    if (followUp.status === 'completed') {
      console.log(
        `FOLLOW-UP ${followUp.id} already completed. Skipping.`,
      );

      return {
        success: true,
        skipped: true,
        reason: 'completed',
      };
    }

    /*
     * Check whether the customer replied after the
     * follow-up was created.
     *
     * Prisma relation field is "Conversation"
     * with a capital C in the current schema.
     */
    const customerReply =
      await prisma.message.findFirst({
        where: {
          organizationId: followUp.organizationId,
          role: 'user',
          Conversation: {
            customerId: followUp.customerId,
          },
          createdAt: {
            gt: followUp.createdAt,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

    if (customerReply) {
      const cancelled =
        await prisma.followUp.update({
          where: {
            id: followUp.id,
          },
          data: {
            status: 'cancelled',
            cancellationReason:
              'Customer replied before follow-up execution',
          },
        });

      console.log(
        `FOLLOW-UP ${followUp.id} cancelled because customer replied.`,
      );

      return {
        success: true,
        skipped: true,
        reason: 'customer_replied',
        followUp: cancelled,
      };
    }

    const processing =
      await prisma.followUp.update({
        where: {
          id: followUp.id,
        },
        data: {
          status: 'processing',
          attempts: {
            increment: 1,
          },
        },
      });

    console.log(
      `FOLLOW-UP ${processing.id} marked as processing.`,
    );

    /*
     * Channel delivery is simulated for now.
     * WhatsApp / email / voice providers will be
     * connected here later.
     */
    console.log('----------------------------------------');
    console.log('FOLLOW-UP DELIVERY');
    console.log('Channel:', processing.channel);
    console.log('Action:', processing.action);
    console.log('Customer ID:', processing.customerId);
    console.log('Lead ID:', processing.leadId);
    console.log('Message:', processing.message);
    console.log('----------------------------------------');

    const completed =
      await prisma.followUp.update({
        where: {
          id: processing.id,
        },
        data: {
          status: 'completed',
        },
      });

    console.log(
      `FOLLOW-UP ${completed.id} COMPLETED.`,
    );

    console.log('========================================');

    return {
      success: true,
      followUpId: completed.id,
      status: completed.status,
      attempts: completed.attempts,
      processedAt: new Date().toISOString(),
    };
  },
  {
    connection,
    concurrency: 5,
  },
);

worker.on('completed', (job) => {
  console.log(
    `FOLLOW-UP JOB COMPLETED: ${job.id}`,
  );
});

worker.on('failed', (job, error) => {
  console.error(
    `FOLLOW-UP JOB FAILED: ${job?.id ?? 'unknown'}`,
    error.message,
  );
});

worker.on('error', (error) => {
  console.error(
    'FOLLOW-UP WORKER ERROR:',
    error,
  );
});

async function shutdown() {
  console.log(
    'Shutting down follow-up worker...',
  );

  await worker.close();
  await prisma.$disconnect();
  await connection.quit();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('FOLLOW-UP WORKER STARTED');
console.log('Waiting for jobs...');
