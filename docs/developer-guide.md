# Carry developer guide

Updated 2026-10-30. This guide describes the code in this implementation branch. [Planning](planning/README.md) defines the target product and acceptance criteria; it does not establish deployed or provider-verified behavior.

Carry collects paid expense claims, explains receipt checks, routes missing information and finance review, and records an authorized reimbursement independently from its payment result. The interface is English and accepts free-text purposes in other languages. The first implementation uses GBP and one controlled organization.

## Run the local application

Use Node.js 22.14 or later and the committed npm lockfile:

```sh
npm ci
npm run dev
```

Open [http://127.0.0.1:3107](http://127.0.0.1:3107). Choose Alex Morgan or Sam Rivera to submit claims, or Morgan Chen to review and configure policy. Local demo sign-in selects a server-owned synthetic account and issues a signed, HTTP-only cookie; this is a local test facility. Supabase mode uses real Auth accounts instead.

The demo runs one process on loopback. PGlite stores PostgreSQL data under `.local/demo/db`; private receipt bytes, a session-signing secret and registered synthetic fixture hashes live elsewhere under `.local/demo`. `LOCAL_DATA_DIR` changes this directory. Preserve it while any server is using it. Do not run multiple servers against the same PGlite directory, copy it into a deployment, or expose this mode as a public service.

The supplied sample receipts are generated synthetic PDFs. Recognition in demo mode only accepts their registered byte hashes. An arbitrary upload is retained for manual review and returns an explicit unavailable-recognition result. Demo payments have visibly marked simulated provider states and transaction IDs; they do not call PayPal or move money. An accepted demo payment first appears as processing; use **Synchronize existing payment** to query its simulated item result.

For a production build served locally:

```sh
npm run build
npm run start:demo
```

No deployment, real AI call, actual Sandbox payment, competition registration or submission is established by these commands.

## Source map and request flow

| Location | Responsibility |
| --- | --- |
| `src/app/` and `src/components/` | Login, claim list/editor/detail, finance review, recipient and policy settings |
| `src/app/api/[...path]/route.ts` | Authenticated API, bounded request parsing, same-origin mutations, file proxy, worker and verified webhook entry points |
| `src/lib/server/` | Mode configuration, Supabase/demo authentication, file validation and storage, synthetic samples, provider orchestration |
| `src/lib/domain/service.ts` | Trusted membership checks, claim versions, evidence checks, approval, allowance reservations, durable payment intent and state transitions |
| `src/lib/domain/rules.ts` | Integer money parsing, organization calendar dates, complete rule findings and deterministic routing |
| `src/lib/db/database.ts` | Shared SQL persistence through local PGlite or server-side `pg` connections |
| `src/lib/db/schema.sql` | Local schema, kept equal to the committed Supabase migration |
| `src/lib/providers/` | OpenAI receipt extraction and PayPal Sandbox adapters plus explicit local test providers |
| `tests/` | Domain/database, provider and server-boundary regression tests |

Clients send expected claim versions with mutations. The service checks the current member from trusted database records, takes the organization row lock, evaluates rules and commits state in one transaction. Provider calls happen outside database transactions. Claim content changes increment its version; submitted snapshots, approval records and timeline events are append-only. Removing a current attachment reference preserves earlier submitted originals.

The schema uses organization and membership records, current policy/profile records with immutable histories, claims and submitted versions, attachment metadata, approval history, payment intents, extraction jobs, webhook deduplication and audit events. JSON payloads retain typed snapshots; SQL unique constraints prevent two possibly payable intents for one claim and reuse of provider batch IDs. The organization lock serializes allowance decisions. This favors a small controlled workspace over high-volume throughput.

## Configure Supabase and real service adapters

Create or select the intended test project separately. Nothing in `npm run dev` or the provisioning script creates a cloud project or installs a hosted database schema. Copy `.env.example` to the ignored `.env.local` and configure server variables through a secure local editor or deployment secret settings. Never paste credentials into claims, browser settings or source control.

| Variable | Purpose |
| --- | --- |
| `APP_MODE` | Explicit `demo` or `sandbox`; Live mode is unsupported |
| `APP_ORIGIN` | Exact browser origin used for mutation checks and secure session-cookie configuration |
| `LOCAL_DATA_DIR` | Local demo runtime directory; unused for hosted data |
| `SUPABASE_URL` | Intended Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Auth client connection key; this implementation reads it on the server |
| `SUPABASE_SECRET_KEY` | Server-only private receipt storage access |
| `DATABASE_URL` | Server-only PostgreSQL connection string for the intended migrated project |
| `AI_PROVIDER` | `openai` for the implemented real receipt adapter |
| `AI_API_KEY`, `AI_MODEL` | Server-side OpenAI key and explicitly selected vision/file-capable model |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | PayPal Sandbox Payouts OAuth credentials |
| `PAYPAL_WEBHOOK_ID` | Webhook registration ID for signature verification |
| `WORKER_SECRET` | At least 32 characters; bearer credential for the recovery endpoint |

Dependencies are pinned in `package.json` and `package-lock.json`. Missing Sandbox configuration fails rather than falling back to demo recognition or payments.

### Install the schema and private storage

1. Review `supabase/migrations/20261029235851_reimbursement_core.sql` against the intended project. Apply this migration explicitly in a database transaction, for example through the Supabase SQL Editor. The web server does not install hosted tables on startup.
2. Verify the `receipts` Storage bucket exists and is private. The migration creates it when the Supabase Storage schema is available. If that bucket already existed, inspect its privacy and limits before using it; an existing public bucket is unsuitable.
3. Run the project's Supabase database advisors when a real local stack or linked test project is available. The implementation was tested with local PostgreSQL semantics; hosted Auth, Storage and project-specific advisors still require verification.

All application tables enable RLS and revoke direct `anon`/`authenticated` access. Browser requests go through the application API, where membership and ownership are enforced. The database connection is privileged and must stay on the server; RLS alone does not authorize privileged service queries. No authorization decision uses user-editable Auth metadata or a role sent by the browser.

Uploads go through the server, which inspects the actual bytes and enforces JPEG/PNG/PDF, at most three files, 10 MB total, five PDF pages and a 40-megapixel image limit. Encrypted, malformed or active-content PDFs are rejected. PDF previews render drawing operations to a canvas using a locally bundled PDF.js worker; receipt scripts, forms and links are not mounted. The private file proxy rechecks claim access, returns no-store responses and never publishes a storage URL. Do not add public Storage policies to bypass this path.

### Provision controlled accounts and memberships

Create the test Auth users separately in the Supabase dashboard or an already authorized administration workflow. This application has no public registration or invitation flow. Use two applicant accounts and a separate finance reviewer for permission checks. Do not use a reviewer account to submit its own claims.

Prepare a local JSON file under the ignored `.local/` directory with the actual Auth UUIDs and matching Auth emails. The following values are placeholders and must be replaced:

```json
[
  { "id": "00000000-0000-4000-8000-000000000001", "name": "Alex Morgan", "email": "alex@example.test", "role": "applicant" },
  { "id": "00000000-0000-4000-8000-000000000002", "name": "Sam Rivera", "email": "sam@example.test", "role": "applicant" },
  { "id": "00000000-0000-4000-8000-000000000003", "name": "Morgan Chen", "email": "morgan@example.test", "role": "reviewer" }
]
```

Set `APP_MODE=sandbox` and `DATABASE_URL` in `.env.local`, then run from the repository root:

```sh
node --env-file=.env.local --import tsx scripts/provision-workspace.ts ./.local/members.json
```

The script validates UUIDs, unique identities, roles and existing `auth.users` IDs/emails. It creates a single `northstar` / Northstar Studio organization, GBP / Europe/London policy and trusted memberships in one transaction. It refuses an existing organization or membership, including a concurrent duplicate run. It creates no Auth users, sends no emails and calls neither AI nor PayPal. Automatic payments start off. Each applicant must separately confirm their own PayPal email in **Settings**; receipt merchant emails never become payment recipients.

Run `npm run dev:sandbox` after migration and provisioning. Sign in with the controlled Auth accounts, test two applicants and a reviewer, and verify the actual account permissions before enabling any automatic-payment policy. The model and PayPal adapters need their own real-service acceptance; code configuration alone does not prove access or correct results.

## AI checks and payment recovery

OpenAI receives only the authorized receipt files and expense purpose, with `store: false`. It cannot access member directories, PayPal credentials or payment tools. Structured output and source references are validated, and the applicant confirms declared fields. Unknown amounts, missing evidence, category conflicts, duplicate signals and policy exceptions fail closed to information requests or human review. A valid JSON response is evidence to inspect, not proof that the receipt is authentic or that a payment is authorized.

Amounts use integer pence. Approvals bind the claim version, amount, currency, separately confirmed recipient version and policy. Monthly allowance includes approved unpaid and paid claims in the first-submission month. Automatic approval and its queued payment intent commit together. Manual approval requires a separate explicit finance send action. Changes before dispatch invalidate the applicable approval; dispatch freezes recipient and amount. An automatic-payment switch change preserves an otherwise unchanged explicit manual approval.

The worker endpoint is `POST /api/worker`, authenticated by `Authorization: Bearer <WORKER_SECRET>`. Configure a trusted scheduler separately to invoke it periodically. It takes at most three due intents in oldest-updated order, skips active leases, and runs independent provider work concurrently. Schedule setup and hosted runtime limits have not been verified. The finance interface can also synchronize an existing payment.

An API acceptance or batch completion never marks a claim paid. Only a validated single-item query with matching amount, currency, recipient, saved identifiers and transaction ID does so. `UNCLAIMED`, unknown, failed and returned states remain separate. A process crash or timeout retains the original intent and batch identity; recovery queries or safely recovers that request. Never clear payment rows, change batch IDs, release unknown-state allowance or roll back the database to make a retry appear new. A verified return remains part of the history and is not automatically paid again.

For a verified failed or cancelled attempt, finance can explicitly authorize correction with a reason. This preserves the old payment, invalidates the approval and opens a new unconfirmed draft version. The applicant must correct and reconfirm it, then finance must make a fresh approval and explicit send decision. Unknown, unclaimed, paid and returned payments cannot use this correction action. Definitive provider rejection and queried single-item failure are distinct from transport errors; a timeout is never enough to authorize a new attempt.

Register the Sandbox webhook as `POST <APP_ORIGIN>/api/webhooks/paypal` and set its `PAYPAL_WEBHOOK_ID`. The endpoint verifies PayPal's signature, locates an existing intent, queries the provider item and only then records the event ID. An event name or payload status never directly sets paid. A transient query failure remains retryable; repeated events cannot create a new payment.

## Verification and maintenance

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Browser tests use installed Google Chrome locally; CI installs Chromium. The separate `.next-e2e` build directory avoids sharing the development-server lock. Follow `playwright.config.ts` for the current browser, port and isolated runtime-data setup. Browser tests and mocked provider responses are separate from real AI and Sandbox acceptance.

Tests cover exact money boundaries, concurrent allowance reservations, evidence and category checks, stale claim/recipient/policy approval, ownership and role boundaries, append-only history, SQL RLS, durable disk reopening, duplicate payment leases, timeout recovery, single-item validation, late provider states, extraction lease recovery and CSV formula escaping. Current test counts and final verification results belong in the PR and implementation status record.

When changing authentication, state transitions, receipt handling, provider requests, schema or recovery behavior, update this guide in the same PR and run the affected regression tests. Keep `src/lib/db/schema.sql` equal to the migration baseline or introduce an explicit new migration for later schema changes. Preserve transaction and payment history during rollback; pause new dispatch and reconcile outstanding intents before resuming an interrupted test environment.
