import { tool, type RunContext } from '@openai/agents';
import { z } from 'zod';

const PROPERTY_API_URL =
  process.env.PROPERTY_API_URL ?? 'http://localhost:3000';

export const getPropertyDetails = tool({
  name: 'get_property_details',

  description:
    'Get verified details for a specific property from the business property inventory. Use this when the customer asks for more information about a property that was previously found or identified. Never invent property details.',

  parameters: z.object({
    propertyId: z.string(),
  }),

  async execute(
    {
      propertyId,
    },
    runContext: RunContext<{ organizationId: string }> | undefined,
  ) {
    if (!runContext) {
      throw new Error('Missing Tacksharp agent context');
    }

    const organizationId = runContext.context.organizationId;

    const params = new URLSearchParams();

    params.set('organizationId', organizationId);

    const response = await fetch(
      `${PROPERTY_API_URL}/properties/${encodeURIComponent(propertyId)}?${params.toString()}`,
    );

    if (!response.ok) {
      throw new Error(
        `Property details API request failed: ${response.status}`,
      );
    }

    const property = await response.json();

    if (!property) {
      return {
        found: false,
        propertyId,
      };
    }

    return {
      found: true,
      property,
    };
  },
});