import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const connection = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  maxRetriesPerRequest: null,
});

export const followUpQueue = new Queue('follow-up', {
  connection,
});

export async function addTestFollowUp() {
  const job = await followUpQueue.add(
    'test-follow-up',
    {
      phone: '9000000000',
      message: 'Tacksharp follow-up test',
    },
    {
      delay: 5000,
      removeOnComplete: true,
      removeOnFail: false,
    },
  );

  console.log(`FOLLOW-UP JOB CREATED: ${job.id}`);

  return job;
}