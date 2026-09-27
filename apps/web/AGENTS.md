# apps/web — Home Health

Next.js product frontend for Home Health, a Brazilian healthcare-SaaS fork of Medplum. This is the only UI in the product — Medplum's own app (`packages/app`) is not used.

## Commands

Run from this directory, or from the repo root with `--workspace=@hh/web`.

- `npm run dev` — start dev server (localhost:3000, falls back to 3001)
- `npm run build` — production build
- `npm run typecheck` — `tsc --noEmit`, must pass before committing
- `npm run lint` — `eslint . --max-warnings 0`, must pass before committing
- `npm run test:e2e` — Playwright, config at `playwright.config.ts`, specs under `e2e/`
- `npm run test:e2e:ui` / `test:e2e:report` — interactive runner / last HTML report

CI (`.github/workflows/pr-checks.yml`) runs typecheck, lint, and the e2e job on every PR to `main` — mirror that locally before pushing.

## Boundaries

- Never edit `packages/server`, `packages/core`, `packages/fhirtypes`, or `packages/react` — upstream Medplum, wrap it, don't fork it.
- Product code lives here and in `packages/hh-*`. Only four exist: `hh-core`, `hh-fhir`, `hh-billing`, `hh-whatsapp`. Don't invent others without checking `packages/` first.
- The browser never calls the Medplum FHIR server directly — always through this app's `app/api/*` routes (BFF pattern). Medplum client/auth helpers live in `lib/medplum-client.ts` and `lib/medplum-auth.ts`.
- Routes are canonical English (`/signup`, `/schedule`, `/patients`, `/notes`, `/billing`, `/settings`); legacy Portuguese paths (`/cadastro`, `/agenda`, `/pacientes`, `/evolucoes`, `/financeiro`, `/configuracoes`) exist only as permanent redirects in `next.config.ts`. Use the English names for anything new.

## Known gotchas

- Turbopack does not hot-reload files under `app/api/` or `packages/hh-*`. After editing those, kill the dev server and restart with `.next` removed (see the `run-dev` skill), or edits silently won't take effect.
- `next.config.ts` sets `output: "standalone"`, so `next start` is a no-op. The runnable entry point is `.next/standalone/apps/web/server.js`, and `.next/static` + `public/` must be copied into the standalone dir manually — see the `Prepare standalone server` step in `pr-checks.yml` for the exact commands.
- Non-localhost hosts (CI, staging) need `AUTH_TRUST_HOST=true` for NextAuth v5 to accept the request.

## Conventions

- PR titles and descriptions in English, even though the product UI is Portuguese.
- Don't treat `/mnt/c/home-health/ARCHITECTURE.md` as current — it's the original pre-build plan and is wrong in specifics (package list, Next version, route names, deploy target). Prefer reading this directory and `git log` over that doc.
