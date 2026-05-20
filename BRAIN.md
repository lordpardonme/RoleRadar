# Project Brain

## Product

Job Fit Hunter is a personal Chrome MV3 extension plus API. It helps a candidate scan job/career pages, compare roles against resume, preferences, Big Five traits, and work values, then preview autofill and draft outreach.

## Non-Negotiables

- User-triggered scans only.
- No background browsing-history collection.
- No form auto-submit.
- File uploads stay manual.
- Emails only use verified public contact addresses found on page/source.
- Scores are advisory for candidate self-assessment, not employer hiring decisions.
- Sensitive profile data must be encrypted at rest in backend storage.

## Architecture

- `packages/shared`: Pure domain logic and types.
- `apps/api`: Fastify API, Prisma/Postgres-ready encrypted profile storage, dev memory fallback.
- `apps/extension`: React side panel, MV3 background worker, active-tab content extraction.

## Score Model

Total score is 0-100:

- Skills: 35%
- Experience: 20%
- Preferences: 15%
- Culture/personality: 20%
- Logistics: 10%

Each result must show evidence, gaps, confidence, and next action.

## Current Decisions

- Product scope: personal MVP.
- Job sources: current tab plus common ATS/job boards.
- Automation: review-before-action.
- Data: encrypted backend.
- Personality: Big Five plus work values.
- Outreach: draft only.

## Maintenance Rule

Keep `LOGS.md` updated with each meaningful implementation checkpoint. Commit after completed checkpoints when GitHub remote is available.
