import type { Database, OrganizationState } from './database';
import type { Claim, Policy } from '../types';
import { emptyClaimInput } from '../domain/service';

export const DEMO_MEMBERS = [
  {
    id: 'alex',
    organizationId: 'northstar',
    name: 'Alex Morgan',
    email: 'alex@example.test',
    role: 'applicant' as const,
  },
  {
    id: 'sam',
    organizationId: 'northstar',
    name: 'Sam Rivera',
    email: 'sam@example.test',
    role: 'applicant' as const,
  },
  {
    id: 'morgan',
    organizationId: 'northstar',
    name: 'Morgan Chen',
    email: 'morgan@example.test',
    role: 'reviewer' as const,
  },
];
export function createDemoState(
  now = new Date().toISOString(),
  withClaims = true,
): OrganizationState {
  const policy: Policy = {
    organizationId: 'northstar',
    version: 1,
    currency: 'GBP',
    timezone: 'Europe/London',
    autoPaymentEnabled: false,
    autoCategories: ['transport', 'office_supplies'],
    singleLimitMinor: 5000,
    monthlyLimitMinor: 20000,
    maxAgeDays: 30,
    updatedAt: now,
  };
  const state: OrganizationState = {
    organization: {
      id: 'northstar',
      name: 'Northstar Studio',
      currency: 'GBP',
      timezone: 'Europe/London',
    },
    members: structuredClone(DEMO_MEMBERS),
    profiles: [],
    policy,
    claims: [],
    attachments: [],
    versions: [],
    events: [],
    payments: [],
    extractionJobs: [],
    webhookIds: [],
    profileHistory: [],
    policyHistory: [structuredClone(policy)],
    approvals: [],
  };
  if (withClaims) {
    const samples: {
      id: string;
      ownerId: string;
      merchant: string;
      amountMinor: number;
      purpose: string;
      category: Claim['category'];
      reviewStatus: Claim['reviewStatus'];
    }[] = [
      {
        id: 'CL-DEMO-001',
        ownerId: 'alex',
        merchant: 'Northern Rail',
        amountMinor: 2380,
        purpose: 'Travel to the client workshop in Manchester.',
        category: 'transport',
        reviewStatus: 'draft',
      },
      {
        id: 'CL-DEMO-002',
        ownerId: 'alex',
        merchant: 'Fieldwork Supplies',
        amountMinor: 8640,
        purpose: 'Materials for the studio prototype session.',
        category: 'office_supplies',
        reviewStatus: 'needs_info',
      },
      {
        id: 'CL-DEMO-003',
        ownerId: 'sam',
        merchant: 'Corner Table',
        amountMinor: 4200,
        purpose: 'Team lunch after the community workshop.',
        category: 'meals',
        reviewStatus: 'needs_review',
      },
    ];
    for (const sample of samples) {
      const member = state.members.find((m) => m.id === sample.ownerId)!;
      const c: Claim = {
        ...emptyClaimInput,
        ...sample,
        date: now.slice(0, 10),
        organizationId: 'northstar',
        ownerName: member.name,
        version: 1,
        createdAt: now,
        updatedAt: now,
        firstSubmittedAt: sample.reviewStatus === 'draft' ? null : now,
        submissionMonth: sample.reviewStatus === 'draft' ? null : now.slice(0, 7),
        paymentStatus: 'not_started',
        attachmentIds: [],
        extraction: null,
        approval: null,
        paymentIntentId: null,
        manualReasons: [],
        findings:
          sample.reviewStatus === 'draft'
            ? []
            : [
                {
                  code: 'demo_materials',
                  outcome: 'info',
                  title: 'Sample claim — add the original',
                  detail:
                    'This synthetic claim demonstrates the queue. No receipt or real payment is attached.',
                  nextStep: 'Upload materials and confirm the claim before review.',
                  sources: [],
                },
              ],
      };
      state.claims.push(c);
      state.events.push({
        id: `demo-${sample.id}`,
        claimId: c.id,
        actorId: c.ownerId,
        type: 'demo_created',
        message: 'Synthetic demo claim created. No real expense or payment.',
        createdAt: now,
        version: 1,
      });
    }
  }
  return state;
}
export async function seedDemo(db: Database, now?: string): Promise<void> {
  await db.seed(createDemoState(now));
}
