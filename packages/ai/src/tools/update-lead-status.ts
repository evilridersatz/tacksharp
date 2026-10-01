import { tool, type RunContext } from '@openai/agents';
import { z } from 'zod';

export type LeadStatus =
  | 'new'
  | 'qualified'
  | 'property_interested'
  | 'site_visit'
  | 'won'
  | 'lost';

export type TacksharpLeadStatusContext = {
  organizationId: string;
  phone?: string;

  updateLeadStatusByCustomer: (
    status: LeadStatus,
  ) => Promise<unknown>;
};

export const updateLeadStatus = tool({
  name: 'update_lead_status',

  description: `
Update the customer's active real estate lead status.

Allowed statuses:

new
qualified
property_interested
site_visit
won
lost

Use qualified when the customer has provided enough core
requirements to become a meaningful sales lead.

For real estate, qualification normally requires:
- Location
- Budget
- BHK or property type

Use property_interested when the customer explicitly shows
interest in a specific verified property.

Use site_visit when the customer actually requests or agrees
to a site visit.

Use won only when the business confirms the deal/order/booking
has been completed.

Use lost only when the customer or business confirms that the
lead is no longer active.

Do not mark a lead qualified based only on a greeting.

Do not invent customer requirements.

Do not mark a site visit unless the customer actually requests
or agrees to one.

Do not mark won or lost without explicit confirmation.
`,

  parameters: z.object({
    status: z.enum([
      'new',
      'qualified',
      'property_interested',
      'site_visit',
      'won',
      'lost',
    ]),
  }),

  async execute(
    { status },
    runContext:
      RunContext<TacksharpLeadStatusContext> | undefined,
  ) {
    if (!runContext) {
      throw new Error(
        'Missing Tacksharp lead status context',
      );
    }

    const {
      phone,
      updateLeadStatusByCustomer,
    } = runContext.context;

    if (!phone) {
      return {
        updated: false,
        reason:
          'Customer phone number is not available.',
      };
    }

    const result =
      await updateLeadStatusByCustomer(status);

    if (!result) {
      return {
        updated: false,
        reason:
          'No active lead found for this customer.',
      };
    }

    return {
      updated: true,
      status,
      result,
    };
  },
});
