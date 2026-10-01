import { tool } from '@openai/agents';
import { z } from 'zod';

const LEAD_API_URL =
  process.env.LEAD_API_URL ??
  'http://localhost:3000';

export const createLead = tool({
  name: 'create_lead',

  description: `
Create or update the customer's real estate lead.

IMPORTANT:
Use this tool for every genuine real estate enquiry once the customer
has provided meaningful requirements.

A genuine enquiry includes any combination of:
- Location
- Budget
- BHK
- Property type
- Explicit interest in a named property

Do NOT wait for:
- A property to be found
- A site visit request
- The customer to say they want to proceed
- The customer to provide their name

If a phone number is available, include it.

The backend handles duplicate detection and will update an existing
matching lead instead of unnecessarily creating another identical lead.

Examples:

"Porur la 3BHK apartment venum. Budget 95 lakhs."
=> create_lead

"Porur la 2BHK venum. Budget 70 lakhs."
=> create_lead

"Green Valley Residency interested."
=> create_lead if enough customer/property information is available

If the customer has given meaningful property requirements, do not
skip this tool merely because the property search returned no results.
`,

  parameters: z.object({
    organizationId: z.string(),

    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),

    language: z.string().optional(),
    source: z.string().optional(),

    budget: z.number().positive().optional(),
    location: z.string().optional(),
    bhk: z.number().int().positive().optional(),
    propertyType: z.string().optional(),

    notes: z.string().optional(),
  }),

  async execute(data) {
    const response = await fetch(
      `${LEAD_API_URL}/leads`,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      const errorText =
        await response.text();

      throw new Error(
        `Lead API request failed: ${response.status} ${errorText}`,
      );
    }

    return response.json();
  },
});