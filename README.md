# RoleRadar

Personal MVP Chrome MV3 extension + API for job fit scoring, application autofill preview, and outreach drafting.

## Apps

- `apps/extension`: React/TypeScript Chrome extension side panel.
- `apps/api`: Fastify API with Prisma/Postgres support and encrypted profile storage.
- `packages/shared`: Resume parsing, Big Five/work-values scoring, job matching, autofill mapping, and email drafting.

## Quick Start

```powershell
npm install
npm run prisma:generate
npm test
npm run build
npm run dev:api
```

Load `apps/extension/dist` as an unpacked extension after `npm run build:extension`.

## Local Development

```powershell
npm run dev:api
npm run dev:extension
```

Open `http://127.0.0.1:5173` for a preview shell, or load `apps/extension/dist` in Chrome for real active-tab scanning.

## GitHub Checks

CI runs on pushes and pull requests:

- `npm ci`
- `npm run prisma:generate`
- `npm run typecheck`
- `npm test`
- `npm run build`

## Privacy Guardrails

- Scans only after user action.
- Uses `activeTab` and `scripting`, no blanket host permissions.
- Never auto-submits forms.
- Stores profile data encrypted at rest in backend storage.
- Drafts emails only from verified public emails found on page/source.
