import { tool, type RunContext } from '@openai/agents';
import { z } from 'zod';

const SITE_VISIT_API_URL =
  process.env.SITE_VISIT_API_URL ??
  process.env.LEAD_API_URL ??
  'http://localhost:3000';

export type BookSiteVisitContext = {
  organizationId: string;
  phone?: string;
};

export const bookSiteVisit = tool({
  name: 'book_site_visit',

  description: `
Book an actual real estate site visit.

ONLY use this tool when:
- The customer explicitly requests or agrees to a site visit.
- A specific verified property is known.
- A specific future date is known.
- A specific future time is known.

When all four conditions are satisfied, you MUST call this tool.

Do not merely say that a request was registered.

Do not claim the visit is booked unless this tool returns booked=true.

The scheduledAt value must be ISO-8601 with timezone offset.

Example:
2026-10-06T11:00:00+05:30
`,

  parameters: z.object({
    propertyId: z.string().min(1),

    scheduledAt: z.string().datetime({
      offset: true,
    }),

    notes: z.string().optional(),
  }),

  async execute(
    data,
    runContext: RunContext<BookSiteVisitContext> | undefined,
  ) {
    console.log(
      '\n========== BOOK_SITE_VISIT TOOL CALLED =========='
    );

    console.log(
      'propertyId:',
      data.propertyId,
    );

    console.log(
      'scheduledAt:',
      data.scheduledAt,
    );

    console.log(
      'notes:',
      data.notes,
    );

    const context =
      runContext?.context;

    if (!context) {
      console.error(
        'BOOK_SITE_VISIT ERROR: Missing context',
      );

      throw new Error(
        'Missing Tacksharp agent context.',
      );
    }

    console.log(
      'organizationId:',
      context.organizationId,
    );

    console.log(
      'phone:',
      context.phone,
    );

    if (!context.organizationId) {
      throw new Error(
        'Missing organizationId.',
      );
    }

    if (!context.phone) {
      console.error(
        'BOOK_SITE_VISIT ERROR: Missing phone',
      );

      return {
        booked: false,
        reason:
          'Customer phone number is not available.',
      };
    }

    const url =
      `${SITE_VISIT_API_URL}/site-visits/book-by-phone`;

    console.log(
      'Calling:',
      url,
    );

    const response =
      await fetch(url, {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          organizationId:
            context.organizationId,

          phone:
            context.phone,

          propertyId:
            data.propertyId,

          scheduledAt:
            data.scheduledAt,

          notes:
            data.notes,
        }),
      });

    const responseText =
      await response.text();

    console.log(
      'SiteVisit API status:',
      response.status,
    );

    console.log(
      'SiteVisit API response:',
      responseText,
    );

    if (!response.ok) {
      throw new Error(
        `Site visit booking failed: ${response.status} ${responseText}`,
      );
    }

    let result: unknown;

    try {
      result =
        JSON.parse(responseText);
    } catch {
      throw new Error(
        'Site visit API returned invalid JSON.',
      );
    }

    console.log(
      '========== BOOK_SITE_VISIT SUCCESS ==========\n',
    );

    return {
      booked: true,
      siteVisit: result,
    };
  },
});
