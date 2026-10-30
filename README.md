# Carry — receipt to reimbursement

Carry helps a small team collect receipts, explain reimbursement checks, request missing information, and review payments in one place. It is the first implementation for the PayPal AI Hackathon 2026.

**This version runs locally without credentials.** Demo extraction uses clearly labeled synthetic receipts; demo payments are simulated. Separate OpenAI / DeepSeek, Supabase and PayPal Sandbox adapters are implemented. Limited checks against a real Supabase test project passed for authentication, private storage and access controls; real AI / PayPal calls, the application's complete Sandbox flow, a hosted deployment and competition submission remain unverified.

## Run the local demo

Requires Node.js 22.14 or later and npm.

```bash
npm ci
npm run dev
```

Open [Carry on localhost](http://127.0.0.1:3107). Choose **Alex Morgan** or **Sam Rivera** to submit claims, or **Morgan Chen** to review them. The preview binds only to this computer. No keys are needed, and demo mode makes no AI or payment network calls.

A short walkthrough:

1. As Alex, open Settings and separately confirm a synthetic PayPal recipient such as `alex@example.test`.
2. Create a claim, choose **Clear · £23.80**, inspect the receipt and confirm the expense details and payment evidence. Submit for checks.
3. Sign out and enter as Morgan. Open the claim, review the findings and record an approval reason.
4. Confirm the exact amount and recipient in **Simulate approved payment**. The initial result is Processing; **Synchronize existing payment** checks the simulated item and marks it Paid.
5. Try **Blurry · £420** and its clear replacement: missing evidence requests information; a clear large expense still requires finance review. **Partial · £30** demonstrates a claim that differs from a £45 receipt.

Automatic payments are off by default. Finance can enable the example GBP policy: £50 per claim, £200 per person per original submission month, and a 30-day submission window. Unknown values, unresolved evidence, unsupported categories, suspected duplicates and policy exceptions prevent automatic payment. AI does not choose the recipient or authorize money.

Local database, uploads and session secrets persist under `.local/demo/` and are ignored by Git. Run one demo server per data directory. The demo accounts are not production authentication. Arbitrary uploads are retained for manual review; they are **not** recognized by simulated AI.

## Verify

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Browser tests use installed Google Chrome locally and isolated data on port 3108; CI installs Chromium. A production-mode local preview is available with `npm run build` followed by `npm run start:demo` after stopping the dev server.

Tests distinguish application rules, local PostgreSQL persistence, API boundaries, provider test doubles and browser workflows. They do not establish real model accuracy or a completed PayPal Sandbox transaction.

## Configure real Sandbox services

See [Developer guide](docs/developer-guide.md) for server-only configuration, explicit database migration and controlled-account provisioning, private receipts, webhook verification and durable payment recovery. [`.env.example`](.env.example) lists the variables. Use `npm run dev:sandbox` only after configuring those services; missing configuration never silently switches to the demo.

Receipt recognition supports either `AI_PROVIDER=openai` with a configured vision/file-capable model or `AI_PROVIDER=deepseek` with `AI_MODEL=deepseek-flash`. DeepSeek receives JPEG/PNG receipts as images and PDF receipts as locally rendered page images, with original attachment/page references. Both adapters still require real-service acceptance; selecting a provider does not verify model accuracy.

The application supports Sandbox payments only. Creating cloud resources, sending real payouts, publishing a demo, changing repository visibility and submitting to Devpost are separate steps.

## Project notes

- [Planning and verified implementation status](docs/planning/README.md)
- [Product requirements and acceptance scenarios](docs/planning/prd.md)
- [Technical design](docs/planning/technical-design.md)
- [Development stages and remaining integration gates](docs/planning/development-plan.md)
- [Direction and decision history](docs/project-direction.md)
- [Hackathon requirements](docs/hackathon-rules.md) · [Official competition](https://paypalaihackathon.devpost.com/)
- [Contributing instructions](AGENTS.md)

## License

Carry's source code is available under the [MIT License](LICENSE). Dependencies retain their respective licenses. Public source availability does not establish a hosted deployment, verified provider integration or a completed competition submission.
