import type { Attachment, Claim, Finding, Policy, RecipientProfile } from '../types';

export function parseMoney(value: string): number {
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(value))
    throw new Error('Enter an amount with at most two decimal places.');
  const [whole, fraction = ''] = value.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100_000_000)
    throw new Error('Amount must be between £0.01 and £1,000,000.00.');
  return amount;
}
export function money(amountMinor: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(
    amountMinor / 100,
  );
}
export function dateInZone(instant: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant));
}
export function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function calendarDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export interface RuleContext {
  claim: Claim;
  policy: Policy;
  profile: RecipientProfile;
  attachments: Attachment[];
  claims: Claim[];
  allAttachments: Attachment[];
  reservedMinor: number;
  now: string;
}
export function evaluateRules(context: RuleContext): Finding[] {
  const {
    claim: c,
    policy: p,
    profile,
    attachments,
    claims,
    allAttachments,
    reservedMinor,
    now,
  } = context;
  const findings: Finding[] = [];
  const evidence = c.extraction?.sources ?? [];
  const add = (
    code: string,
    outcome: Finding['outcome'],
    title: string,
    detail: string,
    nextStep: string,
    field?: string,
  ) =>
    findings.push({
      code,
      outcome,
      title,
      detail,
      nextStep,
      sources: field ? evidence.filter((s) => s.field === field) : [],
    });
  if (!attachments.length)
    add(
      'missing_receipt',
      'info',
      'Add your receipt',
      'No original receipt is attached.',
      'Upload a JPEG, PNG or PDF receipt.',
    );
  else
    add(
      'receipt_attached',
      'pass',
      'Receipt attached',
      `${attachments.length} private document(s) attached.`,
      'Keep the original document.',
    );
  if (!c.fieldsConfirmed)
    add(
      'fields_unconfirmed',
      'info',
      'Confirm the receipt fields',
      'The applicant has not confirmed the declared fields.',
      'Check the extracted amount, date and currency, then confirm them.',
    );
  if (c.amountMinor === null || !Number.isSafeInteger(c.amountMinor) || c.amountMinor <= 0)
    add(
      'missing_amount',
      'info',
      'Amount is missing',
      'An unknown amount cannot qualify for automatic payment.',
      'Enter and confirm the amount supported by the receipt.',
      'totalMinor',
    );
  if (!validDate(c.date))
    add(
      'missing_date',
      'info',
      'Date is missing',
      'The expense date could not be confirmed.',
      'Provide a readable date and confirm it.',
      'date',
    );
  if (!c.merchant.trim())
    add(
      'missing_merchant',
      'info',
      'Merchant is missing',
      'The merchant has not been confirmed.',
      'Enter the merchant shown on the receipt.',
      'merchant',
    );
  if (!c.purpose.trim())
    add(
      'missing_purpose',
      'info',
      'Explain the expense',
      'A business purpose is required.',
      'Explain what the expense was for.',
    );
  if (!c.paidConfirmed || !c.paymentNote.trim())
    add(
      'missing_payment_confirmation',
      'info',
      'Confirm that you paid',
      'Reimbursements cover expenses already paid by the applicant.',
      'Confirm payment and describe the supporting evidence.',
    );
  if (!profile.confirmedAt || !profile.email)
    add(
      'recipient_unconfirmed',
      'info',
      'Confirm your PayPal account',
      'The recipient must come from your separately confirmed profile.',
      'Confirm your PayPal email in Settings.',
    );
  const x = c.extraction;
  if (!x || x.status === 'failed') {
    add(
      'extraction_unavailable',
      'manual',
      'Receipt needs a human check',
      x?.errorCode
        ? `Receipt extraction failed (${x.errorCode}).`
        : 'Receipt extraction has not completed.',
      'Retry receipt extraction or ask finance to check the original.',
    );
  } else {
    for (const issue of x.issues)
      add(
        'receipt_issue',
        'manual',
        'Check the receipt',
        issue,
        'Finance must resolve this concern against the original document.',
      );
    const sourceFor = (field: string) =>
      evidence.some(
        (s) =>
          s.field === field &&
          s.quote.trim() &&
          attachments.some((a) => a.id === s.attachmentId && s.page >= 1 && s.page <= a.pages),
      );
    if (x.totalMinor === null || !sourceFor('totalMinor'))
      add(
        'receipt_amount_unreadable',
        'info',
        'Receipt amount needs evidence',
        'The material does not contain a readable, sourced total.',
        'Upload a clearer receipt with its total visible.',
        'totalMinor',
      );
    if (!validDate(x.date) || !sourceFor('date'))
      add(
        'receipt_date_unreadable',
        'info',
        'Receipt date needs evidence',
        'The material does not contain a readable, sourced date.',
        'Upload a clearer receipt with its date visible.',
        'date',
      );
    if (!x.currency || !sourceFor('currency'))
      add(
        'receipt_currency_unreadable',
        'info',
        'Receipt currency needs evidence',
        'The receipt currency could not be verified.',
        'Provide material that identifies the currency.',
        'currency',
      );
    if (!x.merchant || !sourceFor('merchant'))
      add(
        'receipt_merchant_unreadable',
        'info',
        'Receipt merchant needs evidence',
        'The merchant could not be sourced to an original document.',
        'Provide a readable merchant name.',
        'merchant',
      );
    if (!x.category || !sourceFor('category'))
      add(
        'category_evidence',
        'manual',
        'Receipt category needs review',
        'The automatic-payment category could not be supported by the receipt items.',
        'Finance must check the expense category against the original items.',
        'category',
      );
    else if (x.category !== c.category)
      add(
        'category_mismatch',
        'manual',
        'Category differs from the receipt',
        `The claim is labelled ${c.category.replaceAll('_', ' ')}; the receipt supports ${x.category.replaceAll('_', ' ')}.`,
        'Correct the category or ask finance to resolve the difference.',
        'category',
      );
    if (!x.paidEvidence)
      add(
        'missing_payment_evidence',
        'info',
        'Add proof of payment',
        'The materials do not establish that the expense has already been paid.',
        'Add a paid receipt or payment confirmation.',
      );
    if (x.purposeMatches !== true)
      add(
        'purpose_match',
        'manual',
        'Check the business purpose',
        'The receipt items and declared purpose need a human check.',
        'Finance must compare the purpose with the original items.',
      );
    if (x.totalMinor !== null && c.amountMinor !== null && x.totalMinor !== c.amountMinor) {
      add(
        'amount_mismatch',
        'manual',
        'Claim differs from receipt',
        `Claimed ${money(c.amountMinor)}; receipt total ${money(x.totalMinor)}.`,
        'Explain any partial reimbursement; finance must approve the confirmed amount.',
        'totalMinor',
      );
      if (!c.partialExplanation.trim())
        add(
          'partial_explanation',
          'info',
          'Explain the amount difference',
          'The claimed amount differs from the receipt without an explanation.',
          'Explain the exact items and amount being claimed.',
        );
    }
    if (x.date && c.date && x.date !== c.date)
      add(
        'date_mismatch',
        'manual',
        'Check the declared date',
        'The declared date differs from the receipt date.',
        'Correct the date or explain it to finance.',
        'date',
      );
    if (x.currency && x.currency !== c.currency)
      add(
        'currency_mismatch',
        'block',
        'Currency does not match',
        'The declared and receipt currencies differ.',
        'Correct and confirm the currency; currency conversion is outside this version.',
        'currency',
      );
    if (
      x.merchant &&
      c.merchant &&
      x.merchant.trim().toLowerCase() !== c.merchant.trim().toLowerCase()
    )
      add(
        'merchant_mismatch',
        'manual',
        'Check the merchant',
        'The declared merchant differs from the receipt.',
        'Correct the merchant or ask finance to resolve the difference.',
        'merchant',
      );
  }
  if (c.currency !== p.currency)
    add(
      'unsupported_currency',
      'block',
      'Only GBP is supported',
      `This organization reimburses in ${p.currency}.`,
      'Submit a GBP expense or ask finance for an alternative.',
    );
  if (c.amountMinor !== null) {
    if (c.amountMinor > p.singleLimitMinor)
      add(
        'single_limit',
        'manual',
        'Above the automatic limit',
        `${money(c.amountMinor)} exceeds the ${money(p.singleLimitMinor)} single-claim limit.`,
        'Finance must review this amount.',
      );
    else
      add(
        'single_limit',
        'pass',
        'Within the single-claim limit',
        `${money(c.amountMinor)} is within ${money(p.singleLimitMinor)}.`,
        'Continue with the remaining checks.',
      );
    if (reservedMinor + c.amountMinor > p.monthlyLimitMinor)
      add(
        'monthly_limit',
        'manual',
        'Monthly allowance needs review',
        `This claim brings the reserved and paid total to ${money(reservedMinor + c.amountMinor)}; the limit is ${money(p.monthlyLimitMinor)}.`,
        'Finance must review the cumulative amount.',
      );
    else
      add(
        'monthly_limit',
        'pass',
        'Within the monthly allowance',
        `${money(reservedMinor + c.amountMinor)} including this claim, of ${money(p.monthlyLimitMinor)}.`,
        'Allowance is reserved atomically when approved.',
      );
  }
  if (!p.autoCategories.includes(c.category))
    add(
      'category_review',
      'manual',
      'Category needs finance review',
      `${c.category.replaceAll('_', ' ')} is outside automatic-payment categories.`,
      'Finance must review the category and purpose.',
    );
  if (validDate(c.date) && c.firstSubmittedAt) {
    const firstDate = dateInZone(c.firstSubmittedAt, p.timezone);
    const age = calendarDays(c.date, firstDate);
    if (age < 0 || age > p.maxAgeDays)
      add(
        'expense_age',
        'manual',
        'Expense date needs review',
        `The expense is ${age} calendar days before first submission; the allowed range is 0–${p.maxAgeDays}.`,
        'Finance must review the date exception.',
        'date',
      );
    else
      add(
        'expense_age',
        'pass',
        'Submitted within the deadline',
        `Submitted ${age} calendar days after the expense, within ${p.maxAgeDays} days.`,
        'The original submission date is retained after corrections.',
        'date',
      );
    if (dateInZone(now, p.timezone).slice(0, 7) !== c.submissionMonth)
      add(
        'cross_month',
        'manual',
        'Updated in a later month',
        `The claim remains assigned to its first-submission month (${c.submissionMonth}).`,
        'Finance must review this resubmission.',
      );
  }
  const otherClaims = claims.filter(
    (other) =>
      other.id !== c.id && other.reviewStatus !== 'draft' && other.reviewStatus !== 'rejected',
  );
  const hashes = new Set(attachments.map((a) => a.sha256));
  const duplicateMatches = otherClaims
    .map((other) => {
      const sameFile = allAttachments.some(
        (a) => other.attachmentIds.includes(a.id) && hashes.has(a.sha256),
      );
      const sameFacts =
        c.extraction?.receiptNumber &&
        c.extraction.receiptNumber === other.extraction?.receiptNumber &&
        c.extraction.merchant?.toLowerCase() === other.extraction?.merchant?.toLowerCase();
      const similarFacts =
        c.merchant.trim() &&
        c.merchant.toLowerCase() === other.merchant.toLowerCase() &&
        c.date &&
        c.date === other.date &&
        c.amountMinor === other.amountMinor &&
        c.currency === other.currency;
      return {
        claim: other,
        exact: Boolean(sameFile || sameFacts),
        matches: Boolean(sameFile || sameFacts || similarFacts),
      };
    })
    .filter((match) => match.matches);
  const match =
    duplicateMatches.find(
      (candidate) => candidate.exact && candidate.claim.paymentStatus === 'paid',
    ) ??
    duplicateMatches.find((candidate) => candidate.exact) ??
    duplicateMatches[0];
  const duplicate = match?.claim;
  const definitelyPaid = duplicate?.paymentStatus === 'paid' && match.exact;
  if (duplicate)
    add(
      definitelyPaid ? 'already_paid' : 'possible_duplicate',
      definitelyPaid ? 'block' : 'manual',
      definitelyPaid ? 'Matching expense already paid' : 'Possible duplicate expense',
      `A matching expense exists (${duplicate.id}). This is a review signal, not a fraud determination.`,
      definitelyPaid
        ? 'Finance must correct the original record; another payment is blocked.'
        : 'Finance must compare both original receipts.',
    );
  return findings;
}

export function routeFindings(findings: Finding[]): 'needs_info' | 'needs_review' | 'clear' {
  if (findings.some((f) => f.outcome === 'info')) return 'needs_info';
  if (findings.some((f) => f.outcome === 'manual' || f.outcome === 'block')) return 'needs_review';
  return 'clear';
}
