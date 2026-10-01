import { Injectable } from '@nestjs/common';
import { run } from '@openai/agents';

import {
  realEstateAgent,
  type TacksharpAgentContext,
  type LeadStatus,
} from 'ai/agents/real-estate-agent.js';

import { ConversationsService } from '../conversations/conversations.service.js';
import { LeadsService } from '../leads/leads.service.js';

@Injectable()
export class AiService {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly leadsService: LeadsService,
  ) {}

  async generateResponse(params: {
    organizationId: string;
    channel: string;
    externalId: string;
    message: string;
    phone?: string;
  }) {
    const {
      organizationId: inputOrganizationId,
      channel,
      externalId,
      message,
      phone,
    } = params;

    // Tacksharp demo organization.
    // Use the database organization for the current demo.
    const effectiveOrganizationId =
      'org_real_estate_001';

    /*
     * STEP 1
     *
     * Get or create the conversation.
     */
    const aiTurnStartedAt = Date.now();

    console.log("\n========== AI TURN START ==========");

    const conversationStartedAt = Date.now();

    const conversation =
      await this.conversationsService.getOrCreateConversation({
        organizationId: effectiveOrganizationId,
        channel,
        externalId,
      });

    console.log(
      `AI TIMING conversation: ${Date.now() - conversationStartedAt}ms`,
    );

    const messagesStartedAt = Date.now();

    /*
     * STEP 2
     *
     * Load previous conversation messages.
     */
    const previousMessages =
      await this.conversationsService.getMessages(
        effectiveOrganizationId,
        conversation.id,
      );

    console.log(
      `AI TIMING messages: ${Date.now() - messagesStartedAt}ms`,
    );

    const leadStartedAt = Date.now();

    const recentMessages =
      previousMessages.slice(-20);

    const conversationHistory =
      recentMessages
        .map(
          (item) =>
            `${
              item.role === 'user'
                ? 'Customer'
                : 'Assistant'
            }: ${item.content}`,
        )
        .join('\n');

    /*
     * STEP 3
     *
     * Load structured customer memory.
     */
    let customerMemory = '';

    let existingCustomer:
      Awaited<
        ReturnType<
          ConversationsService['getCustomerByPhone']
        >
      > = null;

    if (phone) {
      existingCustomer =
        await this.conversationsService.getCustomerByPhone(
          effectiveOrganizationId,
          phone,
        );

      if (existingCustomer) {
        customerMemory = `
Known customer information:

Name: ${existingCustomer.name ?? 'Unknown'}
Phone: ${existingCustomer.phone ?? 'Unknown'}
Language: ${existingCustomer.language ?? 'Unknown'}
Location: ${existingCustomer.location ?? 'Unknown'}
Budget: ${
          existingCustomer.budget?.toString() ??
          'Unknown'
}
BHK: ${existingCustomer.bhk ?? 'Unknown'}
Property type: ${
          existingCustomer.propertyType ??
          'Unknown'
}
`;
      }
    }

    /*
     * STEP 4
     *
     * Guarantee that a customer with a phone number
     * has an active lead before the AI agent runs.
     *
     * IMPORTANT:
     * Pass the latest structured customer requirements
     * into createLead() so the Lead stays aligned with
     * Customer memory.
     */
    if (phone) {
      await this.leadsService.createLead({
        organizationId: effectiveOrganizationId,
        phone,
        source: channel,
        name: existingCustomer?.name ?? undefined,
        language:
          existingCustomer?.language ?? undefined,
        budget:
          existingCustomer?.budget != null
            ? Number(existingCustomer.budget)
            : undefined,
        location:
          existingCustomer?.location ?? undefined,
        bhk:
          existingCustomer?.bhk ?? undefined,
        propertyType:
          existingCustomer?.propertyType ?? undefined,
      });

      console.log(
        `AI TIMING lead: ${Date.now() - leadStartedAt}ms`,
      );
    }

    if (!phone) {
      console.log('AI TIMING lead: skipped (no phone)');
    }

    /*
     * STEP 5
     *
     * Build AI input.
     */
    const inputParts: string[] = [];

    if (customerMemory) {
      inputParts.push(
        customerMemory.trim(),
      );
    }

    if (conversationHistory) {
      inputParts.push(
        `Previous conversation:\n${conversationHistory}`,
      );
    }

    inputParts.push(
      `Customer's latest message:\n${message}`,
    );

    const input =
      inputParts.join('\n\n');

    /*
     * STEP 6
     *
     * Build AI agent context.
     */
    const context: TacksharpAgentContext = {
      organizationId: effectiveOrganizationId,
      phone,

      updateCustomerMemory:
        async (update) => {
          if (!phone) {
            return {
              updated: false,
              reason:
                'Customer phone number is not available.',
            };
          }

          const result =
            await this.conversationsService
              .updateCustomerMemory({
                organizationId: effectiveOrganizationId,
                phone,
                update,
              });

          /*
           * Keep the active lead synchronized with the
           * newly updated customer memory.
           */
          const updatedCustomer =
            await this.conversationsService
              .getCustomerByPhone(
                effectiveOrganizationId,
                phone,
              );

          if (updatedCustomer) {
            await this.leadsService.createLead({
              organizationId: effectiveOrganizationId,
              phone,
              source: channel,
              name:
                updatedCustomer.name ??
                undefined,
              language:
                updatedCustomer.language ??
                undefined,
              budget:
                updatedCustomer.budget != null
                  ? Number(
                      updatedCustomer.budget,
                    )
                  : undefined,
              location:
                updatedCustomer.location ??
                undefined,
              bhk:
                updatedCustomer.bhk ??
                undefined,
              propertyType:
                updatedCustomer.propertyType ??
                undefined,
            });
          }

          return result;
        },

      updateLeadStatusByCustomer:
        async (status: LeadStatus) => {
          if (!phone) {
            return {
              updated: false,
              reason:
                'Customer phone number is not available.',
            };
          }

          const customer =
            await this.conversationsService
              .getCustomerByPhone(
                effectiveOrganizationId,
                phone,
              );

          if (!customer) {
            return {
              updated: false,
              reason:
                'Customer not found.',
            };
          }

          /*
           * Before changing status, synchronize the
           * latest customer requirements into the lead.
           */
          await this.leadsService.createLead({
            organizationId: effectiveOrganizationId,
            phone,
            source: channel,
            name:
              customer.name ?? undefined,
            language:
              customer.language ??
              undefined,
            budget:
              customer.budget != null
                ? Number(customer.budget)
                : undefined,
            location:
              customer.location ??
              undefined,
            bhk:
              customer.bhk ?? undefined,
            propertyType:
              customer.propertyType ??
              undefined,
          });

          const result =
            await this.leadsService
              .updateLeadStatusByCustomer({
                organizationId: effectiveOrganizationId,
                customerId:
                  customer.id,
                status,
              });

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
            lead: result,
          };
        },
    };

    /*
     * STEP 7
     *
     * Run the AI agent.
     */
    const agentStartedAt = Date.now();

    const result =
      await run(
        realEstateAgent,
        input,
        {
          context,
        },
      );

    console.log(
      `AI TIMING agent: ${Date.now() - agentStartedAt}ms`,
    );

    const assistantResponse =
      result.finalOutput ?? '';

    /*
     * STEP 8
     *
     * Persist conversation messages.
     */
    const saveStartedAt = Date.now();

    await this.conversationsService.addMessage({
      organizationId: effectiveOrganizationId,
      conversationId:
        conversation.id,
      role: 'user',
      content: message,
    });

    await this.conversationsService.addMessage({
      organizationId: effectiveOrganizationId,
      conversationId:
        conversation.id,
      role: 'assistant',
      content:
        assistantResponse,
    });

    console.log(
      `AI TIMING save messages: ${Date.now() - saveStartedAt}ms`,
    );

    console.log(
      `AI TURN TOTAL: ${Date.now() - aiTurnStartedAt}ms`,
    );
    console.log("========== AI TURN END ==========");

    return {
      conversationId:
        conversation.id,
      response:
        assistantResponse,
    };
  }
}
