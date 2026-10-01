import 'dotenv/config';
import { run } from '@openai/agents';
import { realEstateAgent } from './agents/real-estate-agent.js';

async function main() {
  const firstTurn = await run(
    realEstateAgent,
    `Organization ID: org_real_estate_001

Customer name: Ravi
Phone: 9876543210

Hi, enakku Porur la 2BHK venum. Budget around 70 lakhs.`,
  );

  console.log('\nTacksharp AI - Turn 1:\n');
  console.log(firstTurn.finalOutput);

  const secondTurn = await run(
    realEstateAgent,
    [
      ...firstTurn.history,
      {
        role: 'user',
        content:
          'Yes, interested. Please save my requirement and arrange a site visit.',
      },
    ],
  );

  console.log('\nTacksharp AI - Turn 2:\n');
  console.log(secondTurn.finalOutput);
}

main().catch((error) => {
  console.error('AI run failed:', error);
  process.exit(1);
});