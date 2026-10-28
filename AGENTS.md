# Project instructions

## Context

- This workspace is for the PayPal AI Hackathon 2026.
- Read `README.md` and the relevant `docs/` notes before making changes.
- Product ideas and the schedule in `docs/project-direction.md` are proposals, not approved implementation requirements.
- Reply in Chinese unless the user requests otherwise. Prepare final competition-facing materials in English or with English translations.

## Development

- Follow the user's global Git workflow: fetch the remote default branch and use an independent `agent/<task-name>` worktree for new implementation work; continue existing work on its branch.
- Keep each change focused, review the diff, run relevant verification, push, and open a ready PR. Do not infer merge authorization from permission to open a PR.
- No application stack or test runner has been selected yet. Document actual setup commands when implementation begins.
- Use PayPal Sandbox for this project. Keep secrets server-side and in environment variables; commit only placeholder examples.
- Treat AI-generated amounts, recipients, and payment instructions as proposals requiring validated application logic and explicit user confirmation.
- Do not infer permission for live payments, outgoing customer messages, public release, or a Devpost submission from a request to implement the prototype.

## Evidence

- Keep official requirements separate from project recommendations, and cite sources with the verification date.
- Distinguish local tests, Sandbox transactions, deployment, competition registration, and submission; report only what has actually been verified.
