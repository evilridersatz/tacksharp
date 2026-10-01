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
      organizationId,
      channel,
      externalId,
      message,
      phone,
    } = params;

    /*
     * STEP 1
     *
     * Get or create the conversation.
     */
    const conversation =
      await this.conversationsService.getOrCreateConversation({
        organizationId,
        channel,
        externalId,
      });

    /*
     * STEP 2
     *
     * Load previous conversation messages.
     */
    const previousMessages =
      await this.conversationsService.getMessages(
        organizationId,
        conversation.id,
      );

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
          organizationId,
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
        organizationId,
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
      organizationId,
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
                organizationId,
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
                organizationId,
                phone,
              );

          if (updatedCustomer) {
            await this.leadsService.createLead({
              organizationId,
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
                organizationId,
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
            organizationId,
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
                organizationId,
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
    const result =
      await run(
        realEstateAgent,
        input,
        {
          context,
        },
      );

    const assistantResponse =
      result.finalOutput ?? '';

    /*
     * STEP 8
     *
     * Persist conversation messages.
     */
    await this.conversationsService.addMessage({
      organizationId,
      conversationId:
        conversation.id,
      role: 'user',
      content: message,
    });

    await this.conversationsService.addMessage({
      organizationId,
      conversationId:
        conversation.id,
      role: 'assistant',
      content:
        assistantResponse,
    });

    return {
      conversationId:
        conversation.id,
      response:
        assistantResponse,
    };
  }
}
