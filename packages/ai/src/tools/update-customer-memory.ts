import { tool, type RunContext } from '@openai/agents';
import { z } from 'zod';

export type CustomerMemoryUpdate = {
  name?: string;
  language?: string;
  location?: string;
  budget?: number;
  bhk?: number;
  propertyType?: string;
};

export type TacksharpAgentContext = {
  organizationId: string;
  phone?: string;

  updateCustomerMemory: (
    update: CustomerMemoryUpdate,
  ) => Promise<unknown>;
};

export const updateCustomerMemory = tool({
  name: 'update_customer_memory',

  description: `
Update customer memory when the customer explicitly provides
new or corrected information.

Use this for:
- Name
- Language
- Location
- Budget
- BHK
- Property type

Only update information explicitly provided by the customer.

Never guess or invent customer information.

Budget must be provided in Indian rupees.

Examples:

"Budget 90 lakhs"
=> budget = 9000000

"90L budget"
=> budget = 9000000

"1 crore budget"
=> budget = 10000000
`,

  parameters: z.object({
    name: z.string().optional(),
    language: z.string().optional(),
    location: z.string().optional(),
    budget: z.number().positive().optional(),
    bhk: z.number().int().positive().optional(),
    propertyType: z.string().optional(),
  }),

  async execute(
    update: CustomerMemoryUpdate,
    runContext:
      RunContext<TacksharpAgentContext> | undefined,
  ) {
    if (!runContext) {
      throw new Error(
        'Missing Tacksharp agent context',
      );
    }

    const {
      phone,
      updateCustomerMemory,
    } = runContext.context;

    if (!phone) {
      return {
        updated: false,
        reason:
          'Customer phone number is not available.',
      };
    }

    const result =
      await updateCustomerMemory(update);

    return {
      updated: true,
      phone,
      result,
    };
  },
});
