# Project instructions

## Context

- This workspace is for the PayPal AI Hackathon 2026.
- Read `README.md` and the relevant `docs/` notes before making changes.
- The user selected a general receipt and reimbursement assistant on 2026-10-29. Read `docs/planning/README.md` and the relevant design documents. Detailed MVP, stack, and schedule are review proposals until approved; the current request is documentation only, with no application implementation.
- Reply in Chinese unless the user requests otherwise. Prepare final competition-facing materials in English or with English translations.

## Development

- Follow the user's global Git workflow: fetch the remote default branch and use an independent `agent/<task-name>` worktree for new implementation work; continue existing work on its branch.
- Keep each change focused, review the diff, run relevant verification, push, and open a ready PR. Do not infer merge authorization from permission to open a PR.
- The proposed stack and verification tools are in `docs/planning/technical-design.md`; none are installed or verified yet. Document actual setup commands when implementation begins.
- Use PayPal Sandbox for this project. Keep secrets server-side and in environment variables; commit only placeholder examples.
- AI extracts evidence and suggests findings; deterministic application rules control routing and payments. Amounts require applicant confirmation, recipients come from separately confirmed profiles, and automatic payments require an administrator-enabled policy and all checks passing. Manual exceptions require an authorized reviewer. The model has no payment credentials or payment tool access.
- Do not infer permission for live payments, outgoing customer messages, public release, or a Devpost submission from a request to implement the prototype.

## Evidence

- Keep official requirements separate from project recommendations, and cite sources with the verification date.
- Distinguish local tests, Sandbox transactions, deployment, competition registration, and submission; report only what has actually been verified.
