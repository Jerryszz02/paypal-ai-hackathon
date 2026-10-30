import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Database, OrganizationState } from '../db/database';
import type {
  Approval,
  Attachment,
  AttachmentInput,
  Bootstrap,
  Claim,
  ClaimDetail,
  ClaimInput,
  Extraction,
  Finding,
  Member,
  PaymentIntent,
  Policy,
  PolicyInput,
  RecipientProfile,
  ReviewInput,
  VerifiedPaymentResult,
} from '../types';
import { dateInZone, evaluateRules, routeFindings, validDate } from './rules';

export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
const categories = z.enum(['transport', 'office_supplies', 'meals', 'accommodation', 'other']);
const claimInputSchema = z
  .object({
    merchant: z.string().max(200),
    date: z.string().refine(validDate).nullable(),
    amountMinor: z.number().int().positive().max(100_000_000).nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    category: categories,
    purpose: z.string().max(3000),
    paymentNote: z.string().max(3000),
    partialExplanation: z.string().max(3000),
    fieldsConfirmed: z.boolean(),
    paidConfirmed: z.boolean(),
  })
  .strict();
const policySchema = z
  .object({
    autoPaymentEnabled: z.boolean(),
    autoCategories: z.array(categories).max(5),
    singleLimitMinor: z.number().int().positive().max(100_000_000),
    monthlyLimitMinor: z.number().int().positive().max(999_999_999),
    maxAgeDays: z.number().int().min(0).max(365),
  })
  .strict();
export const emptyClaimInput: ClaimInput = {
  merchant: '',
  date: null,
  amountMinor: null,
  currency: 'GBP',
  category: 'transport',
  purpose: '',
  paymentNote: '',
  partialExplanation: '',
  fieldsConfirmed: false,
  paidConfirmed: false,
};
const frozenPaymentStatuses = ['processing', 'unknown', 'unclaimed', 'paid'];
function requireVersion(claim: Claim, version: number): void {
  if (claim.version !== version)
    throw new DomainError(
      'version_conflict',
      'This claim changed. Refresh before continuing.',
      409,
    );
}
function requireOwner(actor: Member, claim: Claim): void {
  if (claim.organizationId !== actor.organizationId || claim.ownerId !== actor.id)
    throw new DomainError('forbidden', 'You cannot edit this claim.', 403);
  if (actor.role !== 'applicant')
    throw new DomainError(
      'reviewer_cannot_submit',
      'Finance accounts cannot submit their own claims.',
      403,
    );
}
function requireReviewer(actor: Member): void {
  if (actor.role !== 'reviewer')
    throw new DomainError('forbidden', 'Finance access is required.', 403);
}
function requireVisible(actor: Member, claim: Claim): void {
  if (
    actor.organizationId !== claim.organizationId ||
    (actor.role !== 'reviewer' && actor.id !== claim.ownerId)
  )
    throw new DomainError('not_found', 'Claim not found.', 404);
}
function currentProfile(state: OrganizationState, userId: string): RecipientProfile {
  return (
    state.profiles.find((p) => p.userId === userId) ?? {
      userId,
      organizationId: state.organization.id,
      email: '',
      version: 0,
      confirmedAt: null,
    }
  );
}
function findClaim(state: OrganizationState, id: string): Claim {
  const claim = state.claims.find((c) => c.id === id);
  if (!claim) throw new DomainError('not_found', 'Claim not found.', 404);
  return claim;
}
function detail(state: OrganizationState, claim: Claim): ClaimDetail {
  return {
    ...claim,
    attachments: state.attachments.filter((a) => claim.attachmentIds.includes(a.id)),
    timeline: state.events
      .filter((e) => e.claimId === claim.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    versions: state.versions
      .filter((v) => v.claimId === claim.id)
      .sort((a, b) => b.version - a.version),
    payment: state.payments.find((p) => p.id === claim.paymentIntentId) ?? null,
    recipientProfile: currentProfile(state, claim.ownerId),
    approvalHistory: state.approvals.filter((approval) => approval.claimId === claim.id),
    paymentHistory: state.payments.filter((p) => p.claimId === claim.id),
  };
}
function policyCompatible(state: OrganizationState, approval: Approval): boolean {
  if (approval.policyVersion === state.policy.version) return true;
  if (approval.kind !== 'manual') return false;
  const previous = state.policyHistory.find((p) => p.version === approval.policyVersion);
  return Boolean(
    previous &&
    [
      'singleLimitMinor',
      'monthlyLimitMinor',
      'maxAgeDays',
      'autoCategories',
      'currency',
      'timezone',
    ].every(
      (key) =>
        JSON.stringify(previous[key as keyof Policy]) ===
        JSON.stringify(state.policy[key as keyof Policy]),
    ),
  );
}
function findingsCompatible(approval: Approval, findings: Finding[]): boolean {
  return !findings.some(
    (f) =>
      f.outcome === 'info' ||
      f.outcome === 'block' ||
      (f.outcome === 'manual' && !approval.reviewedFindingCodes?.includes(f.code)),
  );
}
function monthlyReserved(state: OrganizationState, claim: Claim): number {
  return state.claims
    .filter(
      (other) =>
        other.id !== claim.id &&
        other.ownerId === claim.ownerId &&
        other.submissionMonth === claim.submissionMonth &&
        other.approval &&
        !other.approval.invalidatedAt &&
        !['failed', 'returned', 'cancelled'].includes(other.paymentStatus),
    )
    .reduce((total, other) => total + (other.approval?.amountMinor ?? 0), 0);
}
function rules(state: OrganizationState, claim: Claim, now: string): Finding[] {
  const findings = evaluateRules({
    claim,
    now,
    policy: state.policy,
    profile: currentProfile(state, claim.ownerId),
    claims: state.claims,
    attachments: state.attachments.filter((a) => claim.attachmentIds.includes(a.id)),
    allAttachments: state.attachments,
    reservedMinor: monthlyReserved(state, claim),
  });
  // A condition previously needing judgment must be resolved explicitly, not disappear after a looser policy.
  const disappeared = claim.manualReasons.filter(
    (code) =>
      !findings.some((f) => f.code === code && (f.outcome === 'manual' || f.outcome === 'block')),
  );
  if (disappeared.length)
    findings.push({
      code: 'prior_manual_review',
      outcome: 'manual',
      title: 'Previous concerns need a decision',
      detail: `Earlier checks raised: ${disappeared.join(', ')}.`,
      nextStep: 'Finance must record why these concerns are resolved.',
      sources: [],
    });
  if (state.payments.some((p) => p.claimId === claim.id && p.sentAt))
    findings.push({
      code: 'previous_payment_attempt',
      outcome: 'manual',
      title: 'Previous payment needs review',
      detail: 'This claim has an earlier payment attempt. It must not be paid again automatically.',
      nextStep: 'Finance must verify the previous outcome before approving another attempt.',
      sources: [],
    });
  return findings;
}

export interface ServiceOptions {
  clock?: () => Date;
  mode?: 'demo' | 'sandbox';
}
export class ReimbursementService {
  private clock: () => Date;
  private mode: 'demo' | 'sandbox';
  constructor(
    public readonly db: Database,
    options: ServiceOptions = {},
  ) {
    this.clock = options.clock ?? (() => new Date());
    this.mode = options.mode ?? 'demo';
  }
  private now() {
    return this.clock().toISOString();
  }
  private event(
    state: OrganizationState,
    claim: Claim,
    actorId: string,
    type: string,
    message: string,
    version = claim.version,
  ) {
    state.events.push({
      id: randomUUID(),
      claimId: claim.id,
      actorId,
      type,
      message,
      createdAt: this.now(),
      version,
    });
    claim.updatedAt = this.now();
  }
  private async asActor<T>(
    actorId: string,
    work: (state: OrganizationState, actor: Member) => T | Promise<T>,
  ): Promise<T> {
    const actor = await this.getMember(actorId);
    return this.db.transaction(actor.organizationId, (state) => {
      const trusted = state.members.find((m) => m.id === actorId);
      if (!trusted)
        throw new DomainError(
          'unauthorized',
          'Your organization membership is no longer active.',
          401,
        );
      return work(state, trusted);
    });
  }
  async getMember(id: string): Promise<Member> {
    const member = await this.db.getMember(id);
    if (!member)
      throw new DomainError('unauthorized', 'Sign in with an organization account.', 401);
    return member;
  }
  async listDemoMembers(): Promise<Member[]> {
    if (this.mode !== 'demo') return [];
    return (await this.db.members()).filter((m) => m.organizationId === 'northstar');
  }
  async bootstrap(actorId: string): Promise<Bootstrap> {
    return this.asActor(actorId, (s, a) => ({
      member: a,
      organization: s.organization,
      policy: s.policy,
      profile: currentProfile(s, a.id),
      claims: s.claims
        .filter((c) => a.role === 'reviewer' || c.ownerId === a.id)
        .sort((x, y) => y.updatedAt.localeCompare(x.updatedAt)),
      members: s.members
        .filter((m) => a.role === 'reviewer' || m.id === a.id)
        .map(({ id, name, role }) => ({ id, name, role })),
    }));
  }
  async getClaim(actorId: string, id: string): Promise<ClaimDetail> {
    return this.asActor(actorId, (s, a) => {
      const c = findClaim(s, id);
      requireVisible(a, c);
      return detail(s, c);
    });
  }
  async createDraft(actorId: string, input: Partial<ClaimInput> = {}): Promise<ClaimDetail> {
    const fields = claimInputSchema.parse({ ...emptyClaimInput, ...input });
    return this.asActor(actorId, (s, a) => {
      if (a.role !== 'applicant')
        throw new DomainError(
          'reviewer_cannot_submit',
          'Finance accounts cannot submit their own claims.',
          403,
        );
      const now = this.now();
      const c: Claim = {
        ...fields,
        id: `CL-${randomUUID().slice(0, 8).toUpperCase()}`,
        organizationId: a.organizationId,
        ownerId: a.id,
        ownerName: a.name,
        version: 1,
        createdAt: now,
        updatedAt: now,
        firstSubmittedAt: null,
        submissionMonth: null,
        reviewStatus: 'draft',
        paymentStatus: 'not_started',
        attachmentIds: [],
        extraction: null,
        findings: [],
        approval: null,
        paymentIntentId: null,
        manualReasons: [],
      };
      s.claims.push(c);
      this.event(s, c, a.id, 'created', 'Draft created.');
      return detail(s, c);
    });
  }
  private invalidate(state: OrganizationState, claim: Claim, actorId: string, reason: string) {
    const intent = state.payments.find((p) => p.id === claim.paymentIntentId);
    if (intent && (frozenPaymentStatuses.includes(intent.status) || intent.sentAt))
      throw new DomainError(
        'payment_locked',
        'A payment has started. Finance must verify its outcome and authorize corrections before changing this claim.',
        409,
      );
    if (intent?.status === 'queued') {
      intent.status = 'cancelled';
      intent.failureCode = 'approval_invalidated';
      intent.updatedAt = this.now();
    }
    if (claim.approval && !claim.approval.invalidatedAt) {
      claim.approval.invalidatedAt = this.now();
      this.event(state, claim, actorId, 'approval_invalidated', reason);
    }
    claim.paymentIntentId = null;
    claim.paymentStatus = 'not_started';
    claim.reviewStatus = 'draft';
  }
  async updateDraft(
    actorId: string,
    id: string,
    expectedVersion: number,
    input: Partial<ClaimInput>,
  ): Promise<ClaimDetail> {
    const fields = claimInputSchema.partial().parse(input);
    return this.asActor(actorId, (s, a) => {
      const c = findClaim(s, id);
      requireOwner(a, c);
      requireVersion(c, expectedVersion);
      this.invalidate(
        s,
        c,
        a.id,
        'The applicant changed the claim; the old approval cannot be used.',
      );
      const changedEvidence = [
        'merchant',
        'date',
        'amountMinor',
        'currency',
        'purpose',
        'paymentNote',
        'category',
      ].some(
        (key) => key in fields && fields[key as keyof ClaimInput] !== c[key as keyof ClaimInput],
      );
      Object.assign(c, fields);
      c.version += 1;
      // Purpose and supporting payment text affect semantic checks, so old extraction must be rerun.
      if (changedEvidence && ('purpose' in fields || 'paymentNote' in fields)) c.extraction = null;
      if (changedEvidence && fields.fieldsConfirmed !== true) c.fieldsConfirmed = false;
      this.event(
        s,
        c,
        a.id,
        'updated',
        'Claim fields updated; submit this version for fresh checks.',
      );
      return detail(s, c);
    });
  }
  async addAttachment(
    actorId: string,
    id: string,
    expectedVersion: number,
    input: AttachmentInput,
  ): Promise<ClaimDetail> {
    const attachmentSchema = z
      .object({
        name: z.string().min(1).max(255),
        mediaType: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
        size: z
          .number()
          .int()
          .positive()
          .max(10 * 1024 * 1024),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        pages: z.number().int().positive().max(5),
        storageKey: z.string().min(1).max(512),
      })
      .strict();
    const data = attachmentSchema.parse(input);
    return this.asActor(actorId, (s, a) => {
      const c = findClaim(s, id);
      requireOwner(a, c);
      requireVersion(c, expectedVersion);
      const existing = s.attachments.filter((f) => c.attachmentIds.includes(f.id));
      if (
        existing.length >= 3 ||
        existing.reduce((sum, f) => sum + f.size, 0) + data.size > 10 * 1024 * 1024 ||
        existing
          .filter((f) => f.mediaType === 'application/pdf')
          .reduce((sum, f) => sum + f.pages, 0) +
          (data.mediaType === 'application/pdf' ? data.pages : 0) >
          5
      )
        throw new DomainError('upload_limit', 'Use at most 3 files, 10 MB total and 5 PDF pages.');
      this.invalidate(s, c, a.id, 'Receipt material changed; approval must be repeated.');
      const attachment: Attachment = {
        ...data,
        id: randomUUID(),
        claimId: id,
        ownerId: a.id,
        organizationId: a.organizationId,
        createdAt: this.now(),
      };
      s.attachments.push(attachment);
      c.attachmentIds.push(attachment.id);
      c.extraction = null;
      c.fieldsConfirmed = false;
      c.version += 1;
      this.event(
        s,
        c,
        a.id,
        'attachment_added',
        `Added ${data.name}; original materials are retained.`,
      );
      return detail(s, c);
    });
  }
  async getAttachment(actorId: string, id: string): Promise<Attachment> {
    return this.asActor(actorId, (s, a) => {
      const attachment = s.attachments.find((f) => f.id === id);
      if (!attachment) throw new DomainError('not_found', 'Attachment not found.', 404);
      requireVisible(a, findClaim(s, attachment.claimId));
      return attachment;
    });
  }
  async removeAttachment(
    actorId: string,
    id: string,
    expectedVersion: number,
    attachmentId: string,
  ): Promise<ClaimDetail> {
    return this.asActor(actorId, (s, a) => {
      const c = findClaim(s, id);
      requireOwner(a, c);
      requireVersion(c, expectedVersion);
      if (!c.attachmentIds.includes(attachmentId))
        throw new DomainError('not_found', 'Attachment is not part of this version.', 404);
      this.invalidate(s, c, a.id, 'Receipt material changed; approval must be repeated.');
      c.attachmentIds = c.attachmentIds.filter((existing) => existing !== attachmentId);
      c.extraction = null;
      c.fieldsConfirmed = false;
      c.version += 1;
      this.event(
        s,
        c,
        a.id,
        'attachment_removed',
        'Removed an attachment from the current version; earlier submitted originals are retained.',
      );
      return detail(s, c);
    });
  }
  async startExtraction(
    actorId: string,
    id: string,
    expectedVersion: number,
  ): Promise<{ claim: ClaimDetail; shouldRun: boolean; jobId: string }> {
    return this.asActor(actorId, (s, a) => {
      const c = findClaim(s, id);
      requireOwner(a, c);
      requireVersion(c, expectedVersion);
      if (frozenPaymentStatuses.includes(c.paymentStatus))
        throw new DomainError('payment_locked', 'A payment has started.', 409);
      if (!c.attachmentIds.length)
        throw new DomainError('missing_receipt', 'Upload a receipt first.');
      let job = s.extractionJobs.find((j) => j.claimId === id && j.version === expectedVersion);
      const now = this.now();
      if (job?.status === 'complete' || (job?.status === 'running' && job.leaseUntil > now))
        return { claim: detail(s, c), shouldRun: false, jobId: job.runToken ?? job.id };
      if (job && job.attempts >= 2)
        throw new DomainError(
          'extraction_retry_limit',
          'Extraction has already been attempted twice for this version. Finance can review the original.',
          409,
        );
      if (!job) {
        job = {
          id: randomUUID(),
          organizationId: a.organizationId,
          claimId: id,
          version: expectedVersion,
          status: 'running',
          attempts: 0,
          leaseUntil: now,
          result: null,
        };
        s.extractionJobs.push(job);
      }
      job.status = 'running';
      job.attempts += 1;
      job.runToken = randomUUID();
      job.leaseUntil = new Date(this.clock().getTime() + 120_000).toISOString();
      this.invalidate(
        s,
        c,
        a.id,
        'Receipt extraction restarted; the previous approval is invalid.',
      );
      c.reviewStatus = 'checking';
      this.event(s, c, a.id, 'extraction_started', 'Checking the original receipt.');
      return { claim: detail(s, c), shouldRun: true, jobId: job.runToken };
    });
  }
  async saveExtraction(
    actorId: string,
    id: string,
    expectedVersion: number,
    extraction: Extraction,
    jobId?: string,
  ): Promise<ClaimDetail> {
    return this.asActor(actorId, (s, a) => {
      const c = findClaim(s, id);
      requireOwner(a, c);
      const attachments = s.attachments.filter(
        (f) =>
          f.claimId === id && (c.version !== expectedVersion || c.attachmentIds.includes(f.id)),
      );
      if (
        extraction.sources.some(
          (source) =>
            !attachments.some(
              (f) => f.id === source.attachmentId && source.page >= 1 && source.page <= f.pages,
            ),
        )
      )
        throw new DomainError(
          'invalid_source',
          'Receipt extraction cited a source outside this claim.',
        );
      const job = s.extractionJobs.find(
        (j) =>
          j.claimId === id &&
          j.version === expectedVersion &&
          (!jobId || (j.runToken ?? j.id) === jobId),
      );
      if (jobId && !job) {
        this.event(
          s,
          c,
          a.id,
          'stale_extraction',
          'An expired extraction attempt completed and was ignored.',
          expectedVersion,
        );
        return detail(s, c);
      }
      if (job?.status === 'complete') return detail(s, c);
      if (job) {
        job.status = extraction.status === 'complete' ? 'complete' : 'failed';
        job.result = structuredClone(extraction);
      }
      if (c.version !== expectedVersion) {
        this.event(
          s,
          c,
          a.id,
          'stale_extraction',
          'A check completed for an older version and was retained only as history.',
          expectedVersion,
        );
        return detail(s, c);
      }
      if (frozenPaymentStatuses.includes(c.paymentStatus))
        throw new DomainError('payment_locked', 'A payment has started.', 409);
      c.extraction = structuredClone(extraction);
      c.fieldsConfirmed = false;
      c.reviewStatus = c.firstSubmittedAt ? 'needs_review' : 'draft';
      this.event(
        s,
        c,
        a.id,
        extraction.status === 'complete' ? 'extracted' : 'extraction_failed',
        extraction.status === 'complete'
          ? 'Receipt fields extracted. Confirm them before submitting.'
          : 'Receipt extraction failed. The original is retained for retry or finance review.',
      );
      return detail(s, c);
    });
  }
  private approve(
    state: OrganizationState,
    claim: Claim,
    actorId: string,
    kind: Approval['kind'],
    reason: string,
  ): void {
    const profile = currentProfile(state, claim.ownerId);
    if (
      !profile.confirmedAt ||
      claim.amountMinor === null ||
      !claim.fieldsConfirmed ||
      !claim.paidConfirmed
    )
      throw new DomainError(
        'approval_blocked',
        'Confirmed fields, proof of payment and a confirmed recipient are required.',
      );
    claim.approval = {
      id: randomUUID(),
      claimVersion: claim.version,
      amountMinor: claim.amountMinor,
      currency: claim.currency,
      profileVersion: profile.version,
      policyVersion: state.policy.version,
      kind,
      actorId,
      reason,
      createdAt: this.now(),
      invalidatedAt: null,
      reviewedFindingCodes: claim.findings.filter((f) => f.outcome === 'manual').map((f) => f.code),
    };
    state.approvals.push({
      ...structuredClone(claim.approval),
      claimId: claim.id,
      organizationId: claim.organizationId,
      ownerId: claim.ownerId,
    });
    claim.reviewStatus = 'approved';
    this.event(
      state,
      claim,
      actorId,
      'approved',
      kind === 'auto'
        ? 'Automatically approved under the current policy. Allowance reserved.'
        : `Finance approved this version. ${reason}`,
    );
  }
  async submit(actorId: string, id: string, expectedVersion: number): Promise<ClaimDetail> {
    return this.asActor(actorId, (s, a) => {
      const c = findClaim(s, id);
      requireOwner(a, c);
      requireVersion(c, expectedVersion);
      if (c.reviewStatus === 'approved' && c.approval && !c.approval.invalidatedAt)
        return detail(s, c);
      if (frozenPaymentStatuses.includes(c.paymentStatus))
        throw new DomainError('payment_locked', 'A payment has started.', 409);
      // Repeating submission is not a finance decision or a correction. Preserve the
      // current rejection/information request until the applicant creates a new version.
      if (
        c.reviewStatus === 'rejected' ||
        (c.reviewStatus === 'needs_info' &&
          c.findings.some((finding) => finding.code === 'reviewer_information'))
      )
        return detail(s, c);
      if (!c.firstSubmittedAt) {
        c.firstSubmittedAt = this.now();
        c.submissionMonth = dateInZone(c.firstSubmittedAt, s.policy.timezone).slice(0, 7);
      }
      c.findings = rules(s, c, this.now());
      c.manualReasons = [
        ...new Set([
          ...c.manualReasons,
          ...c.findings
            .filter((f) => f.outcome === 'manual' || f.outcome === 'block')
            .map((f) => f.code),
        ]),
      ];
      const route = routeFindings(c.findings);
      c.reviewStatus = route === 'clear' ? 'needs_review' : route;
      if (route === 'clear' && s.policy.autoPaymentEnabled) {
        this.approve(s, c, a.id, 'auto', 'All deterministic checks passed.');
        this.queuePayment(s, c, a.id);
      } else if (route === 'clear')
        c.findings.push({
          code: 'auto_disabled',
          outcome: 'manual',
          title: 'Ready for finance review',
          detail: 'Automatic payments are switched off for this organization.',
          nextStep: 'Finance can approve this confirmed version.',
          sources: [],
        });
      this.event(
        s,
        c,
        a.id,
        'submitted',
        c.reviewStatus === 'needs_info'
          ? 'Submitted. Add the requested information to continue.'
          : c.approval && !c.approval.invalidatedAt
            ? 'Submitted and automatically approved.'
            : 'Submitted to finance for review.',
      );
      if (!s.versions.some((v) => v.claimId === c.id && v.version === c.version))
        s.versions.push({
          claimId: c.id,
          version: c.version,
          snapshot: structuredClone(c),
          createdAt: this.now(),
        });
      return detail(s, c);
    });
  }
  async review(
    actorId: string,
    id: string,
    expectedVersion: number,
    input: ReviewInput,
  ): Promise<ClaimDetail> {
    const review = z
      .object({
        decision: z.enum(['approve', 'request_info', 'reject']),
        reason: z.string().trim().min(3).max(3000),
      })
      .strict()
      .parse(input);
    return this.asActor(actorId, (s, a) => {
      requireReviewer(a);
      const c = findClaim(s, id);
      requireVisible(a, c);
      requireVersion(c, expectedVersion);
      if (c.ownerId === a.id)
        throw new DomainError('self_approval', 'You cannot review your own claim.', 403);
      if (
        frozenPaymentStatuses.includes(c.paymentStatus) ||
        s.payments.some((p) => p.id === c.paymentIntentId && p.sentAt)
      )
        throw new DomainError(
          'payment_locked',
          'Finance must authorize corrections after a verified failed payment before this claim can be reviewed again.',
          409,
        );
      if (!c.firstSubmittedAt || c.reviewStatus === 'draft' || c.reviewStatus === 'checking')
        throw new DomainError(
          'not_submitted',
          'The applicant must submit this version before review.',
          409,
        );
      if (review.decision === 'approve') {
        c.findings = rules(s, c, this.now());
        if (c.findings.some((f) => f.outcome === 'info' || f.outcome === 'block'))
          throw new DomainError(
            'approval_blocked',
            'Resolve missing evidence and payment blockers before approval.',
            409,
          );
        if (c.approval && !c.approval.invalidatedAt) {
          if (findingsCompatible(c.approval, c.findings)) return detail(s, c);
          this.invalidate(s, c, a.id, 'New review conditions require a fresh explicit approval.');
        }
        this.approve(s, c, a.id, 'manual', review.reason);
      } else {
        this.invalidate(
          s,
          c,
          a.id,
          'Finance changed the decision; any unsent payment was cancelled.',
        );
        c.reviewStatus = review.decision === 'request_info' ? 'needs_info' : 'rejected';
        // Keep human concerns across edits, extraction and policy changes. The rule
        // evaluator carries them into prior_manual_review, requiring an explicit
        // finance approval rather than allowing a later automatic approval.
        c.manualReasons = [
          ...new Set([
            ...c.manualReasons,
            review.decision === 'reject' ? 'reviewer_rejection' : 'reviewer_information',
          ]),
        ];
        this.event(s, c, a.id, review.decision, review.reason);
        if (review.decision === 'request_info')
          c.findings.push({
            code: 'reviewer_information',
            outcome: 'info',
            title: 'Finance requested information',
            detail: review.reason,
            nextStep: 'Update this claim and submit the new version.',
            sources: [],
          });
      }
      return detail(s, c);
    });
  }
  async updateProfile(
    actorId: string,
    input: { email: string; confirmed: true; expectedVersion?: number },
  ): Promise<RecipientProfile> {
    const data = z
      .object({
        email: z.email().max(127),
        confirmed: z.literal(true),
        expectedVersion: z.number().int().min(0).optional(),
      })
      .strict()
      .parse(input);
    return this.asActor(actorId, (s, a) => {
      const old = currentProfile(s, a.id);
      if (data.expectedVersion !== undefined && data.expectedVersion !== old.version)
        throw new DomainError(
          'version_conflict',
          'Your recipient profile changed. Refresh and confirm it again.',
          409,
        );
      const email = data.email.trim().toLowerCase();
      if (email === old.email && old.confirmedAt) return old;
      const affected = s.claims.filter(
        (c) =>
          c.ownerId === a.id &&
          c.approval &&
          !c.approval.invalidatedAt &&
          !frozenPaymentStatuses.includes(c.paymentStatus) &&
          !s.payments.some((p) => p.id === c.paymentIntentId && p.sentAt),
      );
      for (const c of affected)
        this.invalidate(
          s,
          c,
          a.id,
          'The recipient profile changed. Submit the claim for a fresh approval.',
        );
      const profile: RecipientProfile = {
        userId: a.id,
        organizationId: a.organizationId,
        version: old.version + 1,
        email,
        confirmedAt: this.now(),
      };
      s.profiles = s.profiles.filter((p) => p.userId !== a.id);
      s.profiles.push(profile);
      s.profileHistory.push(structuredClone(profile));
      return profile;
    });
  }
  async updatePolicy(
    actorId: string,
    expectedVersion: number,
    input: PolicyInput,
  ): Promise<Policy> {
    const data = policySchema.parse(input);
    return this.asActor(actorId, (s, a) => {
      requireReviewer(a);
      if (s.policy.version !== expectedVersion)
        throw new DomainError(
          'version_conflict',
          'The policy changed. Refresh before saving.',
          409,
        );
      const previous = s.policy;
      s.policy = { ...s.policy, ...data, version: s.policy.version + 1, updatedAt: this.now() };
      s.policyHistory.push(structuredClone(s.policy));
      const onlyToggle = Object.keys(data).every(
        (key) =>
          key === 'autoPaymentEnabled' ||
          JSON.stringify(data[key as keyof PolicyInput]) ===
            JSON.stringify(previous[key as keyof PolicyInput]),
      );
      // No policy edit ever sends money or silently upgrades a pending claim.
      for (const c of s.claims.filter(
        (c) =>
          c.approval &&
          !c.approval.invalidatedAt &&
          !frozenPaymentStatuses.includes(c.paymentStatus) &&
          !s.payments.some((p) => p.id === c.paymentIntentId && p.sentAt),
      )) {
        if (onlyToggle && c.approval?.kind === 'manual') {
          this.event(
            s,
            c,
            a.id,
            'policy_rechecked',
            'The automatic-payment switch changed; this explicit finance approval remains valid.',
          );
          continue;
        }
        this.invalidate(
          s,
          c,
          a.id,
          'Policy changed. Finance must review the claim under the current policy.',
        );
        c.findings = rules(s, c, this.now());
        c.reviewStatus = routeFindings(c.findings) === 'needs_info' ? 'needs_info' : 'needs_review';
      }
      return s.policy;
    });
  }
  private queuePayment(s: OrganizationState, c: Claim, actorId: string): PaymentIntent {
    const approval = c.approval!;
    const profile = currentProfile(s, c.ownerId);
    const paymentId = randomUUID();
    const now = this.now();
    const intent: PaymentIntent = {
      id: paymentId,
      organizationId: c.organizationId,
      claimId: c.id,
      claimVersion: c.version,
      approvalId: approval.id,
      ownerId: c.ownerId,
      profileVersion: profile.version,
      policyVersion: s.policy.version,
      amountMinor: approval.amountMinor,
      currency: 'GBP',
      recipientEmail: profile.email,
      senderBatchId: `carry-${paymentId}`,
      senderItemId: `claim-${paymentId}`,
      fingerprint: createHash('sha256')
        .update(
          JSON.stringify([
            c.id,
            c.version,
            approval.id,
            profile.version,
            approval.amountMinor,
            approval.currency,
            profile.email,
          ]),
        )
        .digest('hex'),
      status: 'queued',
      mode: this.mode,
      providerBatchId: null,
      providerItemId: null,
      transactionId: null,
      providerStatus: null,
      createdAt: now,
      updatedAt: now,
      sentAt: null,
      leaseUntil: null,
      lastReconciledAt: null,
      failureCode: null,
    };
    s.payments.push(intent);
    c.paymentIntentId = intent.id;
    c.paymentStatus = 'queued';
    this.event(
      s,
      c,
      actorId,
      'payment_queued',
      'Payment intent saved. Repeated requests reuse this intent.',
    );
    return intent;
  }
  async preparePayment(
    actorId: string,
    id: string,
    expectedVersion: number,
  ): Promise<PaymentIntent> {
    return this.asActor(actorId, (s, a) => {
      const c = findClaim(s, id);
      requireVisible(a, c);
      requireVersion(c, expectedVersion);
      if (a.role !== 'reviewer' && !(a.id === c.ownerId && c.approval?.kind === 'auto'))
        throw new DomainError(
          'forbidden',
          'Finance must explicitly send manually approved payments.',
          403,
        );
      if (c.ownerId === a.id && a.role === 'reviewer')
        throw new DomainError('self_approval', 'You cannot pay your own claim.', 403);
      const existing = s.payments.find((p) => p.id === c.paymentIntentId);
      if (existing && !['cancelled', 'failed', 'returned'].includes(existing.status))
        return existing;
      if (existing?.sentAt)
        throw new DomainError(
          'recovery_required',
          'Finance must authorize corrections after a verified failure; the applicant must then reconfirm and resubmit a new version.',
          409,
        );
      const approval = c.approval;
      const profile = currentProfile(s, c.ownerId);
      if (
        !approval ||
        approval.invalidatedAt ||
        c.reviewStatus !== 'approved' ||
        approval.claimVersion !== c.version ||
        approval.profileVersion !== profile.version ||
        !policyCompatible(s, approval) ||
        approval.amountMinor !== c.amountMinor ||
        approval.currency !== c.currency
      )
        throw new DomainError(
          'approval_stale',
          'This claim needs a current approval before payment.',
          409,
        );
      if (approval.kind === 'auto' && !s.policy.autoPaymentEnabled)
        throw new DomainError('automatic_payments_paused', 'Automatic payments are paused.', 409);
      const current = rules(s, c, this.now());
      if (
        !findingsCompatible(approval, current) ||
        (approval.kind === 'auto' && routeFindings(current) !== 'clear')
      )
        throw new DomainError(
          'payment_blocked',
          'The claim no longer meets its approval conditions. Finance must review it again.',
          409,
        );
      return this.queuePayment(s, c, a.id);
    });
  }
  private async withPayment<T>(
    id: string,
    work: (s: OrganizationState, p: PaymentIntent, c: Claim) => T,
  ): Promise<T> {
    const found = await this.db.findPayment(id);
    if (!found) throw new DomainError('not_found', 'Payment intent not found.', 404);
    return this.db.transaction(found.organizationId, (s) => {
      const p = s.payments.find((p) => p.id === id)!;
      return work(s, p, findClaim(s, p.claimId));
    });
  }
  async acquirePayment(
    id: string,
  ): Promise<{ intent: PaymentIntent; action: 'send' | 'query' } | null> {
    return this.withPayment(id, (s, p, c) => {
      const now = this.now();
      if (p.leaseUntil && p.leaseUntil > now) return null;
      if (['paid', 'failed', 'returned', 'cancelled'].includes(p.status)) return null;
      const profile = currentProfile(s, c.ownerId);
      const approval = c.approval;
      if (!p.sentAt) {
        const current = rules(s, c, now);
        if (
          !approval ||
          approval.invalidatedAt ||
          approval.id !== p.approvalId ||
          c.version !== p.claimVersion ||
          profile.version !== p.profileVersion ||
          !policyCompatible(s, approval) ||
          !findingsCompatible(approval, current) ||
          (approval.kind === 'auto' &&
            (!s.policy.autoPaymentEnabled || routeFindings(current) !== 'clear'))
        ) {
          p.status = 'cancelled';
          p.failureCode = 'approval_invalidated';
          p.updatedAt = now;
          c.paymentStatus = 'cancelled';
          if (approval) approval.invalidatedAt = now;
          c.reviewStatus = 'needs_review';
          c.findings = current;
          this.event(
            s,
            c,
            'system',
            'payment_paused',
            'Payment stopped before sending because the approval conditions changed.',
          );
          return null;
        }
        p.sentAt = now;
        p.status = 'processing';
        c.paymentStatus = 'processing';
        p.leaseUntil = new Date(this.clock().getTime() + 90_000).toISOString();
        p.updatedAt = now;
        this.event(
          s,
          c,
          'system',
          'payment_started',
          'Payment parameters frozen; waiting for the provider.',
        );
        return { intent: p, action: 'send' as const };
      }
      // A crash after dispatch is indistinguishable from a timeout: recover the old request only.
      p.status = p.status === 'unclaimed' ? 'unclaimed' : 'unknown';
      c.paymentStatus = p.status;
      p.leaseUntil = new Date(this.clock().getTime() + 90_000).toISOString();
      p.updatedAt = now;
      return { intent: p, action: 'query' as const };
    });
  }
  async recordPaymentSubmission(
    id: string,
    result: {
      status: 'processing' | 'unknown' | 'failed';
      providerBatchId: string | null;
      providerStatus: string;
      failureCode?: string;
    },
  ): Promise<PaymentIntent> {
    return this.withPayment(id, (s, p, c) => {
      if (['paid', 'returned', 'cancelled'].includes(p.status)) return p;
      if (
        p.providerBatchId &&
        result.providerBatchId &&
        p.providerBatchId !== result.providerBatchId
      )
        throw new DomainError(
          'provider_mismatch',
          'The provider batch does not match this payment.',
          409,
        );
      p.providerBatchId = result.providerBatchId ?? p.providerBatchId;
      p.status = result.status;
      p.providerStatus = result.providerStatus;
      p.failureCode = result.failureCode ?? null;
      if (result.status === 'failed') p.lastReconciledAt = this.now(); // Definitive provider rejection, not a timeout.
      p.leaseUntil = null;
      p.updatedAt = this.now();
      if (c.paymentIntentId === p.id) c.paymentStatus = p.status;
      this.event(
        s,
        c,
        'system',
        'payment_submitted',
        result.status === 'unknown'
          ? 'The payment result is unknown. Reconcile the original request before taking any other action.'
          : result.status === 'failed'
            ? 'The provider rejected this payment. Finance must review the error.'
            : 'The provider accepted the request. This does not confirm that the recipient has been paid.',
      );
      return p;
    });
  }
  async recordPaymentUnknown(
    id: string,
    failureCode = 'provider_unavailable',
  ): Promise<PaymentIntent> {
    return this.withPayment(id, (s, p, c) => {
      if (['paid', 'failed', 'returned', 'cancelled'].includes(p.status)) return p;
      p.status = 'unknown';
      p.failureCode = failureCode;
      p.leaseUntil = null;
      p.updatedAt = this.now();
      if (c.paymentIntentId === p.id) c.paymentStatus = 'unknown';
      this.event(
        s,
        c,
        'system',
        'payment_unknown',
        'Payment result unknown. The saved request will be reconciled; no second payment has been created.',
      );
      return p;
    });
  }
  async recordPaymentResult(id: string, result: VerifiedPaymentResult): Promise<PaymentIntent> {
    return this.withPayment(id, (s, p, c) => {
      if (
        result.amountMinor !== p.amountMinor ||
        result.currency !== p.currency ||
        result.recipientEmail.toLowerCase() !== p.recipientEmail.toLowerCase() ||
        result.senderBatchId !== p.senderBatchId ||
        result.senderItemId !== p.senderItemId ||
        (p.providerBatchId && p.providerBatchId !== result.providerBatchId) ||
        (p.providerItemId && result.providerItemId !== p.providerItemId)
      )
        throw new DomainError(
          'provider_mismatch',
          'The provider item does not match the saved payment amount, currency, recipient and identifiers.',
          409,
        );
      if (!p.sentAt)
        throw new DomainError(
          'payment_not_started',
          'An unsent payment cannot be reconciled.',
          409,
        );
      if (result.status === 'paid' && (!result.providerItemId || !result.transactionId))
        throw new DomainError(
          'payment_not_verified',
          'A provider item and transaction identifier are required before showing paid.',
          409,
        );
      // Verified returns after success matter; late pending events must never regress a final result.
      if (p.status === 'paid' && result.status !== 'paid' && result.status !== 'returned') return p;
      if (['returned', 'failed', 'cancelled'].includes(p.status) && result.status !== p.status)
        return p;
      const previous = p.status;
      p.status = result.status;
      p.providerBatchId = result.providerBatchId;
      p.providerItemId = result.providerItemId;
      p.transactionId = result.transactionId;
      p.providerStatus = result.providerStatus;
      p.failureCode = result.failureCode ?? null;
      p.leaseUntil = null;
      p.updatedAt = this.now();
      p.lastReconciledAt = this.now();
      // Webhooks may reconcile a superseded attempt. Preserve its verified history
      // without replacing the current attempt's status or releasing its allowance.
      if (c.paymentIntentId === p.id) c.paymentStatus = p.status;
      if (previous !== p.status)
        this.event(
          s,
          c,
          'system',
          'payment_reconciled',
          `${this.mode === 'demo' ? 'Demo provider' : 'PayPal Sandbox'} single-item status verified: ${result.providerStatus}.`,
        );
      return p;
    });
  }
  async listRecoverablePayments(actorId?: string): Promise<PaymentIntent[]> {
    const collect = (s: OrganizationState) =>
      s.payments.filter((p) => ['queued', 'processing', 'unknown', 'unclaimed'].includes(p.status));
    if (actorId)
      return this.asActor(actorId, (s, a) => {
        requireReviewer(a);
        return collect(s);
      });
    const results: PaymentIntent[] = [];
    for (const orgId of await this.db.listOrganizationIds())
      results.push(...(await this.db.transaction(orgId, collect)));
    return results;
  }
  async getPayment(actorId: string, id: string): Promise<PaymentIntent> {
    return this.asActor(actorId, (s, a) => {
      const p = s.payments.find((p) => p.id === id);
      if (!p) throw new DomainError('not_found', 'Payment not found.', 404);
      requireVisible(a, findClaim(s, p.claimId));
      return p;
    });
  }
  async reopenAfterFailedPayment(
    actorId: string,
    id: string,
    expectedVersion: number,
    reason: string,
  ): Promise<ClaimDetail> {
    const explanation = z.string().trim().min(3).max(3000).parse(reason);
    return this.asActor(actorId, (s, a) => {
      requireReviewer(a);
      const c = findClaim(s, id);
      requireVisible(a, c);
      requireVersion(c, expectedVersion);
      if (c.ownerId === a.id)
        throw new DomainError(
          'self_approval',
          'You cannot authorize your own payment correction.',
          403,
        );
      const payment = s.payments.find((p) => p.id === c.paymentIntentId);
      if (
        !payment?.sentAt ||
        !payment.lastReconciledAt ||
        !['failed', 'cancelled'].includes(payment.status)
      )
        throw new DomainError(
          'recovery_not_allowed',
          'Only a verified failed or cancelled payment can be reopened. Unknown, unclaimed, paid and returned payments require separate finance investigation.',
          409,
        );
      if (c.approval) c.approval.invalidatedAt = this.now();
      c.paymentIntentId = null;
      c.paymentStatus = 'not_started';
      c.reviewStatus = 'draft';
      c.fieldsConfirmed = false;
      c.version += 1;
      c.manualReasons = [...new Set([...c.manualReasons, 'previous_payment_attempt'])];
      this.event(
        s,
        c,
        a.id,
        'payment_correction_authorized',
        `Finance authorized correction after verified ${payment.status} payment ${payment.id}. ${explanation} The applicant must confirm and resubmit; another payment is not authorized yet.`,
      );
      return detail(s, c);
    });
  }
  async findPaymentByProvider(input: {
    batchId?: string;
    itemId?: string;
    senderItemId?: string;
  }): Promise<PaymentIntent | null> {
    if (!input.batchId && !input.itemId && !input.senderItemId) return null;
    for (const orgId of await this.db.listOrganizationIds()) {
      const match = await this.db.transaction(
        orgId,
        (s) =>
          s.payments.find(
            (p) =>
              (!input.batchId || p.providerBatchId === input.batchId) &&
              (!input.itemId || p.providerItemId === input.itemId) &&
              (!input.senderItemId || p.senderItemId === input.senderItemId),
          ) ?? null,
      );
      if (match) return match;
    }
    return null;
  }
  async claimWebhookEvent(organizationId: string, eventId: string): Promise<boolean> {
    if (!eventId || eventId.length > 200)
      throw new DomainError('invalid_event', 'Invalid webhook event identifier.');
    return this.db.transaction(organizationId, (s) => {
      if (s.webhookIds.includes(eventId)) return false;
      s.webhookIds.push(eventId);
      return true;
    });
  }
  async exportClaims(actorId: string): Promise<string> {
    const { claims } = await this.bootstrap(actorId);
    const cell = (value: unknown) => {
      let text = String(value ?? '');
      if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const rows: unknown[][] = [
      [
        'Claim ID',
        'Merchant',
        'Date',
        'Category',
        'Amount GBP',
        'Review status',
        'Payment status',
        'Transaction ID',
      ],
    ];
    for (const c of claims) {
      const d = await this.getClaim(actorId, c.id);
      rows.push([
        c.id,
        c.merchant,
        c.date,
        c.category,
        c.amountMinor === null ? '' : (c.amountMinor / 100).toFixed(2),
        c.reviewStatus,
        c.paymentStatus,
        d.payment?.transactionId ?? '',
      ]);
    }
    return rows.map((r) => r.map(cell).join(',')).join('\r\n');
  }
}
