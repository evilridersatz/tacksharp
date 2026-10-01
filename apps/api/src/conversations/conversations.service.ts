import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';

interface CreateConversationInput {
  organizationId: string;
  customerId?: string;
  channel: string;
  externalId?: string;
}

interface CreateMessageInput {
  organizationId: string;
  conversationId: string;
  role: string;
  content: string;
  externalId?: string;
  metadata?: Prisma.InputJsonValue;
}

interface CustomerMemoryUpdate {
  name?: string;
  language?: string;
  location?: string;
  budget?: number | string;
  bhk?: number;
  propertyType?: string;
}

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find an existing conversation by organization + externalId.
   * If it does not exist, create it.
   */
  async getOrCreateConversation(
    input: CreateConversationInput,
  ) {
    const organization =
      await this.prisma.organization.findUnique({
        where: {
          id: input.organizationId,
        },
      });

    if (!organization) {
      throw new NotFoundException(
        'Organization not found',
      );
    }

    if (input.externalId) {
      const existing =
        await this.prisma.conversation.findFirst({
          where: {
            organizationId: input.organizationId,
            externalId: input.externalId,
          },
        });

      if (existing) {
        return existing;
      }
    }

    if (input.customerId) {
      const customer =
        await this.prisma.customer.findFirst({
          where: {
            id: input.customerId,
            organizationId: input.organizationId,
          },
        });

      if (!customer) {
        throw new NotFoundException(
          'Customer not found for this organization',
        );
      }
    }

    return this.prisma.conversation.create({
      data: {
        id: randomUUID(),
        organizationId: input.organizationId,
        customerId: input.customerId,
        channel: input.channel,
        externalId: input.externalId,
        status: 'active',
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Backwards-compatible explicit create method.
   */
  async createConversation(
    input: CreateConversationInput,
  ) {
    const organization =
      await this.prisma.organization.findUnique({
        where: {
          id: input.organizationId,
        },
      });

    if (!organization) {
      throw new NotFoundException(
        'Organization not found',
      );
    }

    if (input.customerId) {
      const customer =
        await this.prisma.customer.findFirst({
          where: {
            id: input.customerId,
            organizationId: input.organizationId,
          },
        });

      if (!customer) {
        throw new NotFoundException(
          'Customer not found for this organization',
        );
      }
    }

    return this.prisma.conversation.create({
      data: {
        id: randomUUID(),
        organizationId: input.organizationId,
        customerId: input.customerId,
        channel: input.channel,
        externalId: input.externalId,
        status: 'active',
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Find a customer by phone number within one organization.
   */
  async getCustomerByPhone(
    organizationId: string,
    phone: string,
  ) {
    if (!phone?.trim()) {
      return null;
    }

    return this.prisma.customer.findFirst({
      where: {
        organizationId,
        phone: phone.trim(),
      },
    });
  }

  /**
   * Update structured customer memory.
   *
   * Only fields explicitly supplied are changed.
   * Existing values are preserved otherwise.
   */
  async updateCustomerMemory(params: {
    organizationId: string;
    phone: string;
    update: CustomerMemoryUpdate;
  }) {
    const phone = params.phone.trim();

    if (!phone) {
      return {
        updated: false,
        reason: 'Customer phone number is required.',
      };
    }

    let customer =
      await this.getCustomerByPhone(
        params.organizationId,
        phone,
      );

    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          id: randomUUID(),
          organizationId: params.organizationId,
          phone,
          name: params.update.name,
          language: params.update.language,
          location: params.update.location,
          budget:
            params.update.budget !== undefined
              ? String(params.update.budget)
              : undefined,
          bhk: params.update.bhk,
          propertyType:
            params.update.propertyType,
          updatedAt: new Date(),
        },
      });

      return {
        updated: true,
        customer,
      };
    }

    const data: Prisma.CustomerUpdateInput = {};

    if (params.update.name !== undefined) {
      data.name = params.update.name;
    }

    if (params.update.language !== undefined) {
      data.language = params.update.language;
    }

    if (params.update.location !== undefined) {
      data.location = params.update.location;
    }

    if (params.update.budget !== undefined) {
      data.budget = String(params.update.budget);
    }

    if (params.update.bhk !== undefined) {
      data.bhk = params.update.bhk;
    }

    if (params.update.propertyType !== undefined) {
      data.propertyType = params.update.propertyType;
    }

    if (Object.keys(data).length === 0) {
      return {
        updated: false,
        reason: 'No customer memory fields supplied.',
        customer,
      };
    }

    const updatedCustomer =
      await this.prisma.customer.update({
        where: {
          id: customer.id,
        },
        data,
      });

    return {
      updated: true,
      customer: updatedCustomer,
    };
  }

  /**
   * Add a message to an existing conversation.
   */
  async addMessage(input: CreateMessageInput) {
    const conversation =
      await this.prisma.conversation.findFirst({
        where: {
          id: input.conversationId,
          organizationId: input.organizationId,
        },
      });

    if (!conversation) {
      throw new NotFoundException(
        'Conversation not found for this organization',
      );
    }

    if (!input.content?.trim()) {
      throw new BadRequestException(
        'Message content is required',
      );
    }

    const message =
      await this.prisma.message.create({
        data: {
          id: randomUUID(),
          organizationId: input.organizationId,
          conversationId: input.conversationId,
          role: input.role,
          content: input.content,
          externalId: input.externalId,
          metadata: input.metadata,
        },
      });

    await this.prisma.conversation.update({
      where: {
        id: conversation.id,
      },
      data: {
        updatedAt: new Date(),
      },
    });

    return message;
  }

  /**
   * Backwards-compatible explicit message creation.
   */
  async createMessage(input: CreateMessageInput) {
    return this.addMessage(input);
  }

  async getConversation(
    organizationId: string,
    conversationId: string,
  ) {
    const conversation =
      await this.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          organizationId,
        },
      });

    if (!conversation) {
      throw new NotFoundException(
        'Conversation not found',
      );
    }

    return conversation;
  }

  async getMessages(
    organizationId: string,
    conversationId: string,
  ) {
    const conversation =
      await this.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          organizationId,
        },
      });

    if (!conversation) {
      throw new NotFoundException(
        'Conversation not found',
      );
    }

    return this.prisma.message.findMany({
      where: {
        organizationId,
        conversationId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }
}
