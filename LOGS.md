# Implementation Logs

## 2026-05-20

- Created monorepo skeleton with root package scripts, TypeScript base config, README, Docker Compose for Postgres, and git ignore.
- Added `packages/shared` with core types, resume parser, Big Five/work-values scoring, company culture extraction, weighted job scoring, contact extraction, email drafting, and autofill planning.
- Added shared unit tests covering resume parsing, personality scoring, weighted job scoring, verified contact extraction, and file-upload autofill guardrails.
- Added `apps/api` Fastify service with profile storage endpoints, personality/culture/job/form/email endpoints, HTTPS production guard, encrypted profile repository, Prisma schema, and route test.
- Added `BRAIN.md` as durable project memory and this log file as implementation ledger.
- GitHub repo creation requested. Local shell had no `gh` command and no remote configured; GitHub CLI install attempts timed out.
- User provided `git@github.com:lordpardonme/RoleRadar.git`; added as `origin` and pushed baseline commit `a319ea8` to `origin/master`.
- Added Chrome MV3 extension scaffold with manifest, service worker, content runtime, active-tab scanning, form extraction, reviewed autofill application, and React side-panel UI for onboarding, scoring, autofill preview, outreach draft, export, delete, and hidden-company controls.
- Installed dependencies and generated Prisma client.
- Fixed strict TypeScript issues in Prisma JSON storage, extension optional-property construction, form controls, and Vite config.
- Excluded source test files from TypeScript build output so Vitest runs source tests once instead of also seeing compiled `dist` copies.
- Browser smoke at Vite URL exposed missing Chrome storage APIs outside extension context; added memory-only dev fallback and demo runtime so side-panel UI can be previewed locally while packaged extension keeps Chrome storage/runtime behavior.
- Added extension-context API gating and fetch timeout so local preview does not stall when backend is offline.
- Verified with `npm run typecheck`, `npm test`, and `npm run build`.
- Browser smoke checked Vite side-panel preview: onboarding save, demo scan, score display, autofill preview, manual resume warning, verified email draft.
- Started local dev servers for extension preview (`http://127.0.0.1:5173`) and API (`http://127.0.0.1:8787/health`).

## 2026-05-21

- Extracted RoleRadar content scraping into testable pure DOM helpers.
- Added extension fixture tests for JSON-LD job postings, Lever/Ashby/Workday/generic career lists, current-page job fallback, form extraction, and safe autofill behavior.
- Fixed linked-job text extraction so adjacent title/location elements do not merge and hide location signals.
- Tightened culture URL extraction so job links are not misclassified as culture pages.
- Verified with `npm run typecheck`, `npm test`, and `npm run build`.
- Added GitHub Actions CI for install, Prisma generation, typecheck, tests, and build on `master` pushes and pull requests.
- Updated docs/brain to use the RoleRadar name consistently.
- Added per-field autofill review checkboxes so users can exclude individual fields before applying reviewed autofill.
