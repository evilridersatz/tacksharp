import { Injectable, BadRequestException } from '@nestjs/common';

import { LeadsService } from '../../leads/leads.service.js';
import { FollowUpsService } from '../../follow-ups/follow-ups.service.js';

const DEMO_ORGANIZATION_ID = 'org_real_estate_001';

@Injectable()
export class MetaLeadsService {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly followUpsService: FollowUpsService,
  ) {}

  private async getLeadDetails(
    leadgenId: string,
  ) {
    const accessToken =
      process.env.META_PAGE_ACCESS_TOKEN;

    const version =
      process.env.META_GRAPH_API_VERSION ??
      'v23.0';

    if (!accessToken) {
      throw new Error(
        'META_PAGE_ACCESS_TOKEN is missing',
      );
    }

    const url =
      `https://graph.facebook.com/${version}/${leadgenId}` +
      `?access_token=${encodeURIComponent(accessToken)}`;

    const response = await fetch(url);

    const data = await response.json();

    if (!response.ok) {
      console.error(
        'META LEAD LOOKUP FAILED:',
        data,
      );

      throw new Error(
        `Meta lead lookup failed: ${response.status}`,
      );
    }

    return data;
  }

  private extractFields(
    data: any,
  ) {
    const fields: Record<string, string> = {};

    for (
      const field of data?.field_data ?? []
    ) {
      const name =
        String(field?.name ?? '')
          .trim()
          .toLowerCase();

      const value =
        field?.values?.[0];

      if (name && value != null) {
        fields[name] = String(value);
      }
    }

    return fields;
  }

  private pick(
    fields: Record<string, string>,
    names: string[],
  ) {
    for (const name of names) {
      const value = fields[name];
      if (value) {
        return value;
      }
    }

    return undefined;
  }

  async processWebhook(body: any) {
    const results: any[] = [];

    for (
      const entry of body?.entry ?? []
    ) {
      for (
        const change of entry?.changes ?? []
      ) {
        if (
          change?.field !== 'leadgen'
        ) {
          continue;
        }

        const value =
          change?.value ?? {};

        const leadgenId =
          value.leadgen_id;

        if (!leadgenId) {
          continue;
        }

        console.log(
          'META LEAD RECEIVED:',
          leadgenId,
        );

        const metaLead =
          await this.getLeadDetails(
            leadgenId,
          );

        const fields =
          this.extractFields(
            metaLead,
          );

        const name =
          this.pick(fields, [
            'full name',
            'fullname',
            'name',
            'first name',
          ]);

        const phone =
          this.pick(fields, [
            'phone number',
            'phone',
            'mobile',
            'mobile number',
          ]);

        const email =
          this.pick(fields, [
            'email',
            'email address',
          ]);

        const location =
          this.pick(fields, [
            'location',
            'city',
            'preferred location',
            'area',
          ]);

        const budgetRaw =
          this.pick(fields, [
            'budget',
            'budget range',
            'property budget',
          ]);

        const bhkRaw =
          this.pick(fields, [
            'bhk',
            'bedrooms',
            'number of bedrooms',
          ]);

        const propertyType =
          this.pick(fields, [
            'property type',
            'type',
          ]);

        if (!phone) {
          console.warn(
            'META LEAD HAS NO PHONE:',
            leadgenId,
          );
        }

        let budget:
          | number
          | undefined;

        if (budgetRaw) {
          const match =
            budgetRaw.replace(
              /,/g,
              '',
            ).match(
              /\d+(?:\.\d+)?/,
            );

          if (match) {
            budget =
              Number(match[0]);
          }
        }

        let bhk:
          | number
          | undefined;

        if (bhkRaw) {
          const match =
            bhkRaw.match(/\d+/);

          if (match) {
            bhk =
              Number(match[0]);
          }
        }

        const lead =
          await this.leadsService.createLead({
            organizationId:
              DEMO_ORGANIZATION_ID,
            name,
            phone,
            email,
            source: 'meta_lead_ads',
            budget,
            location,
            bhk,
            propertyType,
            notes:
              `Meta Lead ID: ${leadgenId}`,
          });

        let followUps: any[] = [];

        if (
          lead?.id &&
          lead?.customerId
        ) {
          const scheduled =
            await this.followUpsService
              .scheduleLeadFollowUps({
                organizationId:
                  DEMO_ORGANIZATION_ID,
                leadId:
                  lead.id,
                customerId:
                  lead.customerId,
                customerName:
                  name,
              });

          followUps =
            scheduled.map(
              (item) => ({
                followUpId:
                  item.followUp.id,
                jobId:
                  item.jobId,
                scheduledAt:
                  item.followUp.scheduledAt,
              }),
            );
        }

        results.push({
          leadgenId,
          leadId: lead?.id,
          customerId:
            lead?.customerId,
          name,
          phone,
          email,
          source:
            'meta_lead_ads',
          followUps,
        });
      }
    }

    return {
      success: true,
      processed:
        results.length,
      leads: results,
    };
  }
}
