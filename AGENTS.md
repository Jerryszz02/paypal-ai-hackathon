# Project instructions

## Context

- This workspace is for the PayPal AI Hackathon 2026.
- Read `README.md` and the relevant `docs/` notes before making changes.
- The user selected a general receipt and reimbursement assistant on 2026-10-29. Read `docs/planning/README.md` and the relevant design documents. The user authorized implementation of the reviewed plan on 2026-10-29. The application has an explicit local demo mode and a separate Supabase / AI / PayPal Sandbox mode; provider code is not proof of a verified live integration.
- Reply in Chinese unless the user requests otherwise. Prepare final competition-facing materials in English or with English translations.

## Development

- Follow the user's global Git workflow: fetch the remote default branch and use an independent `agent/<task-name>` worktree for new implementation work; continue existing work on its branch.
- Keep each change focused, review the diff, run relevant verification, push, and open a ready PR. Do not infer merge authorization from permission to open a PR.
- The implementation uses Next.js, TypeScript, PostgreSQL (PGlite for local demo), Supabase Auth / Storage adapters, Vitest and Playwright. Read `docs/developer-guide.md` for setup and boundaries; run relevant tests and the production build. Local preview binds to 127.0.0.1:3107; E2E uses 3108 with separate data. Do not run multiple demo server processes against the same data directory. Use the installed Next.js documentation under `node_modules/next/dist/docs/` for version-specific APIs.
- Use PayPal Sandbox for this project. Keep secrets server-side and in environment variables; commit only placeholder examples.
- AI extracts evidence and suggests findings; deterministic application rules control routing and payments. Amounts require applicant confirmation, recipients come from separately confirmed profiles, and automatic payments require an administrator-enabled policy and all checks passing. Manual exceptions require an authorized reviewer. The model has no payment credentials or payment tool access.
- Do not infer permission for live payments, outgoing customer messages, public release, or a Devpost submission from a request to implement the prototype.

## Evidence

- Keep official requirements separate from project recommendations, and cite sources with the verification date.
- Distinguish local tests, Sandbox transactions, deployment, competition registration, and submission; report only what has actually been verified.
