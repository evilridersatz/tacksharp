import { tool, type RunContext } from '@openai/agents';
import { z } from 'zod';

const PROPERTY_API_URL =
  process.env.PROPERTY_API_URL ?? 'http://localhost:3000';

export const searchProperties = tool({
  name: 'search_properties',

  description:
    'Search the business property inventory. MUST be called whenever the customer provides enough information to search for properties. Use this tool to find actual matching properties; never answer whether properties are available from your own knowledge. Required search information: location plus BHK or property type. Include maxBudget when the customer provides a budget.',

  parameters: z.object({
    location: z.string().optional(),
    bhk: z.number().int().positive().optional(),
    propertyType: z.string().optional(),
    maxBudget: z.number().positive().optional(),
  }),

    async execute(
    {
      location,
      bhk,
      propertyType,
      maxBudget,
    },
    runContext: RunContext<{ organizationId: string }> | undefined,
  ) {
    

    if (!runContext) {
      throw new Error('Missing Tacksharp agent context');
    }

    const organizationId = runContext.context.organizationId;

    const params = new URLSearchParams();

    params.set('organizationId', organizationId);

    if (location) params.set('location', location);
    if (bhk) params.set('bhk', String(bhk));
    if (propertyType) params.set('propertyType', propertyType);
    if (maxBudget) params.set('maxBudget', String(maxBudget));

    const response = await fetch(
      `${PROPERTY_API_URL}/properties/search?${params.toString()}`,
    );

    if (!response.ok) {
      throw new Error(
        `Property API request failed: ${response.status}`,
      );
    }

    const data = await response.json();

    

   
      return data;
  },
});