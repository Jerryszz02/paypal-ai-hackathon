export type Role = 'applicant' | 'reviewer';
export type ReviewStatus =
  'draft' | 'checking' | 'needs_info' | 'needs_review' | 'approved' | 'rejected';
export type PaymentStatus =
  | 'not_started'
  | 'queued'
  | 'processing'
  | 'unknown'
  | 'unclaimed'
  | 'paid'
  | 'failed'
  | 'returned'
  | 'cancelled';
export type Category = 'transport' | 'office_supplies' | 'meals' | 'accommodation' | 'other';

export interface Member {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: Role;
}
export interface Organization {
  id: string;
  name: string;
  currency: 'GBP';
  timezone: string;
}
export interface RecipientProfile {
  userId: string;
  organizationId: string;
  version: number;
  email: string;
  confirmedAt: string | null;
}
export interface PolicyInput {
  autoPaymentEnabled: boolean;
  autoCategories: Category[];
  singleLimitMinor: number;
  monthlyLimitMinor: number;
  maxAgeDays: number;
}
export interface Policy extends PolicyInput {
  organizationId: string;
  version: number;
  currency: 'GBP';
  timezone: string;
  updatedAt: string;
}
export interface AttachmentInput {
  name: string;
  mediaType: 'image/jpeg' | 'image/png' | 'application/pdf';
  size: number;
  sha256: string;
  pages: number;
  storageKey: string;
}
export interface Attachment extends AttachmentInput {
  id: string;
  claimId: string;
  ownerId: string;
  organizationId: string;
  createdAt: string;
}
export interface Source {
  attachmentId: string;
  page: number;
  quote: string;
  field: string;
}
export interface Extraction {
  merchant: string | null;
  receiptNumber: string | null;
  date: string | null;
  currency: string | null;
  totalMinor: number | null;
  category?: Category | null;
  items: { description: string; amountMinor: number | null }[];
  sources: Source[];
  issues: string[];
  paidEvidence: boolean;
  purposeMatches: boolean | null;
  status: 'complete' | 'failed';
  provider: 'demo' | 'openai' | 'deepseek';
  model: string;
  requestId?: string;
  schemaVersion?: string;
  errorCode?: string;
  durationMs?: number;
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
}
export interface ClaimInput {
  merchant: string;
  date: string | null;
  amountMinor: number | null;
  currency: string;
  category: Category;
  purpose: string;
  paymentNote: string;
  partialExplanation: string;
  fieldsConfirmed: boolean;
  paidConfirmed: boolean;
}
export interface Finding {
  code: string;
  outcome: 'pass' | 'info' | 'manual' | 'block';
  title: string;
  detail: string;
  nextStep: string;
  sources: Source[];
}
export interface Approval {
  id: string;
  claimVersion: number;
  amountMinor: number;
  currency: string;
  profileVersion: number;
  policyVersion: number;
  kind: 'auto' | 'manual';
  actorId: string;
  reason: string;
  createdAt: string;
  invalidatedAt: string | null;
  reviewedFindingCodes?: string[];
}
export interface TimelineEvent {
  id: string;
  claimId: string;
  actorId: string;
  type: string;
  message: string;
  createdAt: string;
  version: number;
}
export interface Claim extends ClaimInput {
  id: string;
  organizationId: string;
  ownerId: string;
  ownerName: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  firstSubmittedAt: string | null;
  submissionMonth: string | null;
  reviewStatus: ReviewStatus;
  paymentStatus: PaymentStatus;
  attachmentIds: string[];
  extraction: Extraction | null;
  findings: Finding[];
  approval: Approval | null;
  paymentIntentId: string | null;
  manualReasons: string[];
}
export interface ClaimVersion {
  claimId: string;
  version: number;
  snapshot: Claim;
  createdAt: string;
}
export interface ClaimDetail extends Claim {
  attachments: Attachment[];
  timeline: TimelineEvent[];
  versions: ClaimVersion[];
  payment: PaymentIntent | null;
  recipientProfile: RecipientProfile;
  approvalHistory: Approval[];
  paymentHistory: PaymentIntent[];
}
export interface PaymentIntent {
  id: string;
  organizationId: string;
  claimId: string;
  claimVersion: number;
  approvalId: string;
  ownerId: string;
  profileVersion: number;
  policyVersion: number;
  amountMinor: number;
  currency: 'GBP';
  recipientEmail: string;
  senderBatchId: string;
  senderItemId: string;
  fingerprint: string;
  status: PaymentStatus;
  mode: 'demo' | 'sandbox';
  providerBatchId: string | null;
  providerItemId: string | null;
  transactionId: string | null;
  providerStatus: string | null;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  leaseUntil: string | null;
  lastReconciledAt: string | null;
  failureCode: string | null;
}
/** Only pass results obtained by a provider query; webhook text is never authoritative. */
export interface VerifiedPaymentResult {
  status: PaymentStatus;
  amountMinor: number;
  currency: string;
  recipientEmail: string;
  senderBatchId: string;
  senderItemId: string;
  providerBatchId: string;
  providerItemId: string | null;
  transactionId: string | null;
  providerStatus: string;
  failureCode?: string | null;
}
export interface Bootstrap {
  member: Member;
  organization: Organization;
  policy: Policy;
  profile: RecipientProfile;
  claims: Claim[];
  members: Pick<Member, 'id' | 'name' | 'role'>[];
}
export interface ReviewInput {
  decision: 'approve' | 'request_info' | 'reject';
  reason: string;
}
