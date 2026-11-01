# TripIdeas Mobile

The TripIdeas.nz iPhone app: discover New Zealand places from the shared editorial content, search and map them, save Favourites, plan Trips, keep private Personal Places with photos, and share Trips with other people. Built with Expo (SDK 54), React Native and TypeScript; content comes from Sanity and user data from the TripIdeas API.

Status: release candidate on `release/shared-trips-mobile-rc2`, distributed to internal TestFlight against the **integration** environment. It has not been released to production. See [docs/mobile-web-api-handover.md](docs/mobile-web-api-handover.md) for what is verified and what is not.

## Start here

| If you want to… | Read |
|---|---|
| Understand how the app, API, website and CMS fit together | [docs/architecture.md](docs/architecture.md) |
| Work in this repository (rules, branching, tests, approvals) | [docs/development-guidelines.md](docs/development-guidelines.md) |
| Change any user-facing UI | [docs/mobile-ui-ux-style-guide.md](docs/mobile-ui-ux-style-guide.md) (mandatory) |
| Build, verify and submit a TestFlight build, or prepare production | [docs/release-configuration.md](docs/release-configuration.md) |
| Brief the production release owner | [docs/mobile-web-api-handover.md](docs/mobile-web-api-handover.md) |
| Change API, schema or environment selection | `../tripideas-architecture/architecture/shared-database-schema-discipline.md` |
| Instructions for AI coding agents | [AGENTS.md](AGENTS.md) |

Other documents: [photo upload transport](docs/photo-upload-transport.md), [product decisions](docs/product-decisions.md), [project scope](PROJECT.md). Historical records, kept for context and **not current**: [release issue register](docs/release-issue-register.md), [September 2026 beta report](docs/beta-feedback-september-2026.md) and the Personal Place audits in [`audit/personal-place-cards/`](audit/personal-place-cards/).

## Quick start (development)

```bash
npm install
cp .env.example .env.local   # then fill in the three EXPO_PUBLIC_* values
npx expo start               # open in the iOS Simulator, or a development build
```

Set all three `EXPO_PUBLIC_*` variables in `.env.local`. **If `EXPO_PUBLIC_API_URL` is missing the app silently talks to the production API, and without `EXPO_PUBLIC_MAP_STYLE_URL` every map is blank.** Use the integration values (see [release configuration](docs/release-configuration.md) section 2), never production credentials, for development. Never commit `.env.local` or print the map key.

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | TripIdeas API base URL |
| `EXPO_PUBLIC_MAP_STYLE_URL` | MapTiler style URL (contains the map key) |
| `EXPO_PUBLIC_TRIP_SHARE_API_URL` | Website snapshot route for the older shared-Trip links |
| `APP_VARIANT` | `integration` adds the staging website to the associated domains |

## Commands

| Command | Use |
|---|---|
| `npx expo start` | Metro and development server |
| `npx tsc --noEmit` | Type check |
| `npx expo lint` | Lint |
| `node --loader ./scripts/test-loader.mjs --test <files>` | Run tests (plain Node tests; quote globs) |
| `npm run validate:release -- --profile <name> --remote --live` | Release configuration preflight |
| `npm run verify:bundle -- --variant integration --ipa <file>` | Verify a finished build's endpoints |

`npm run ios`/`android` (`expo run:*`) create native projects locally; releases are built with EAS in the cloud only.

## Layout

`app/` Expo Router screens · `components/` shared and feature components (primitives in `components/ui/`) · `constants/design.ts` tokens · feature modules (`auth/`, `saved/`, `trips/`, `shared-trips/`, `personal-place-cards/`, `photo-uploads/`, `location/`, …) each with API client, provider, storage and tests · `sanity/` editorial client and queries · `config/` release endpoints and feature flags · `scripts/` test loader and release validation · `docs/` documentation. Notebooks and Diaries exist in code but are switched off (`config/personal-content-features.ts`).
