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
before starting a task. Conflicts are resolved by the precedence rule below.

# INSTRUCTION PRECEDENCE AND GIT PUSHES

These two rules are identical in
[`docs/development-guidelines.md`](docs/development-guidelines.md) (sections
"Instruction precedence" and 2); change them in both places together.

**Instruction precedence.** When instructions conflict, follow them in this order and report the conflict:

1. the owner's explicit instruction for the current task;
2. approved repository and architecture policies (the UI/UX canon, the shared database and API contract in `../tripideas-architecture/`, and `AGENTS.md`);
3. the current development guidelines (`docs/development-guidelines.md`);
4. historical documentation (release issue register, September beta report, audits, dated release notes), which is context only and never overrides the above.

**Git pushes.** The architecture policy is to push validated work on an authorised working branch promptly, and to treat deployment as a separate permission. That default applies only to branches the owner has authorised for pushing. While the owner has restricted pushes (as for the Shared Trips release branches), do not push, merge or open pull requests until explicitly told, and name the branch and destination when asking. A push never implies permission to build, submit or deploy.

# ARCHITECTURE AND RELEASES

- How the app, API, website and CMS fit together: [`docs/architecture.md`](docs/architecture.md).
- Building, verifying and submitting TestFlight builds, MapTiler verification and rollback: [`docs/release-configuration.md`](docs/release-configuration.md).
- Production release briefing: [`docs/mobile-web-api-handover.md`](docs/mobile-web-api-handover.md).
- Documentation index: [`README.md`](README.md). The code is the source of truth; if a document is wrong, say so and fix it in a documentation-only change.

