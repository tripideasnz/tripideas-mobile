# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# TRIPIDEAS MOBILE UI/UX CANON

Before introducing or changing user-facing mobile UI, read and follow
[`docs/mobile-ui-ux-style-guide.md`](docs/mobile-ui-ux-style-guide.md). Its
patterns are mandatory defaults. If a task would conflict with the canon and
the user has not explicitly authorised the deviation, stop and ask before
implementing it.

# SHARED API AND SCHEMA CONTRACT

Before changing API environment selection, API DTO assumptions, compatibility
handling, or features backed by the shared database, read and follow
[`../tripideas-architecture/architecture/shared-database-schema-discipline.md`](../tripideas-architecture/architecture/shared-database-schema-discipline.md).

# DEVELOPMENT GUIDELINES (AUTHORITATIVE)

How to work in this repository is defined in
[`docs/development-guidelines.md`](docs/development-guidelines.md): repository
and worktree boundaries (the separate Git repository named `staging` is
off-limits), branching and commits, shared-component reuse, keeping changes
small, test scope, Simulator versus physical-device validation, protecting
existing functionality, and which actions need explicit approval (pushes,
merges, EAS builds, submissions, remote configuration, production). Read it
before starting a task. If it conflicts with a task instruction, follow the
instruction for that task and report the conflict.

# ARCHITECTURE AND RELEASES

- How the app, API, website and CMS fit together: [`docs/architecture.md`](docs/architecture.md).
- Building, verifying and submitting TestFlight builds, MapTiler verification and rollback: [`docs/release-configuration.md`](docs/release-configuration.md).
- Production release briefing: [`docs/mobile-web-api-handover.md`](docs/mobile-web-api-handover.md).
- Documentation index: [`README.md`](README.md). The code is the source of truth; if a document is wrong, say so and fix it in a documentation-only change.

