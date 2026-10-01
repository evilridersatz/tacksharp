import 'dotenv/config';
import { addTestFollowUp, followUpQueue } from './follow-up.queue.js';

async function main() {
  try {
    await addTestFollowUp();

    console.log('Test follow-up scheduled for 5 seconds from now.');
  } finally {
    await followUpQueue.close();
  }
}

main().catch((error) => {
  console.error('FAILED TO CREATE FOLLOW-UP:', error);
  process.exit(1);
});
