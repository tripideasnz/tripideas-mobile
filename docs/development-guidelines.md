# TripIdeas Mobile: development guidelines

This is the authoritative guide for how work is done in this repository, by people and by AI coding agents. [`AGENTS.md`](../AGENTS.md) points here. It is deliberately practical; reasons are given so the rules can be applied sensibly.

Related: [architecture](architecture.md) · [UI/UX style guide](mobile-ui-ux-style-guide.md) · [release configuration and process](release-configuration.md) · shared API contract: `../tripideas-architecture/architecture/shared-database-schema-discipline.md`.

**Instruction precedence.** When instructions conflict, follow them in this order and report the conflict:

1. the owner's explicit instruction for the current task;
2. approved repository and architecture policies (the UI/UX canon, the shared database and API contract in `../tripideas-architecture/`, and `AGENTS.md`);
3. the current development guidelines (`docs/development-guidelines.md`);
4. historical documentation (release issue register, September beta report, audits, dated release notes), which is context only and never overrides the above.

## 1. Repository and worktree boundaries

- Work only in the mobile repository (`tripideas-mobile` and its worktrees). API, web, CMS and planner repositories are separate; do not edit them from a mobile task. Reading them to confirm a fact is fine; say so in the report.
- **The separate Git repository named `staging` is off-limits** unless the task names it. It is unrelated to Railway's *staging environment* or to the `staging` branch of the web repository.
- Each release candidate lives in its own worktree (for example `tripideas-mobile-rc1` for `release/shared-trips-mobile-rc2`). Do not change another worktree's branch, stash, reset or delete worktrees you did not create. Do documentation or experiments in a new worktree on a new branch from the commit you are documenting (`git worktree add ../<name> -b <branch> <commit>`).
- Do not use bare `git stash`; the stash stack is shared by every worktree.
- Generated and local files stay out of Git: `ios/` is generated and stale, `.env.local` is untracked, scratch work goes outside the repository.

## 2. Branching and commits

- Release work happens on a named release branch (current: `release/shared-trips-mobile-rc2`). Start from a clean working tree and a known HEAD; record the SHA in your report.
- Make small, focused commits with a conventional subject (`fix(mobile): …`, `docs: …`). One concern per commit; do not mix a feature, a layout change and a refactor. Say what changed and what was deliberately left alone.
- AI-assisted commits end with the attribution line the tooling specifies (`Co-Authored-By: …`).
- Commit locally when the work is validated.
- **Git pushes.** The architecture policy is to push validated work on an authorised working branch promptly, and to treat deployment as a separate permission. That default applies only to branches the owner has authorised for pushing. While the owner has restricted pushes (as for the Shared Trips release branches), do not push, merge or open pull requests until explicitly told, and name the branch and destination when asking. A push never implies permission to build, submit or deploy.
- Merges, pull requests and force operations always need explicit authorisation for the specific branch and destination.
- Never rewrite or discard a commit that has been built or submitted: the build record names its SHA.

## 3. Shared component reuse

- Before building UI, look for the canonical component (the [style guide](mobile-ui-ux-style-guide.md) section 17 lists them) and use it. Typical misses: hand-rolled `Pressable` buttons instead of `AppButton`/`ButtonRow`, ad-hoc card surfaces instead of `CardSurface`, local copies of spacing or colour values instead of `constants/design.ts`.
- If a shared component cannot do the job, extend it for **every** user of that pattern or ask. Do not fork a near-copy.
- When a shared component is used by editorial and private content alike (for example `place-photo-grid.tsx`), scope behaviour changes by data, not by screen, and test both sides (see how `isPersonalPhotoCacheKey` scopes the no-fade rule).

## 4. Keeping changes small and unrelated work out

- Implement what was asked. Note other defects you find in the report; do not fix them in the same change. Recorded inconsistencies in the style guide are not incidental work.
- **Preserve approved designs.** Treat anything the product owner has approved on a device (Personal Place Location/Photos rows, Trip membership buttons, Regions/Activities filters, the Trips segmented control, Trip card delete) as frozen. A change that touches one needs explicit approval and a before/after check.
- Do not add dependencies, delete files, or change build settings, bundle identifiers, signing or associated domains without being asked. Ask before deleting files.
- Do not change typography globally. Dynamic Type is handled per control (see the style guide section 18); body text scales fully.
- Silent fallbacks are bugs: when you add configuration, prefer failing loudly to defaulting to production.

## 5. Test scope

- Run **targeted** tests for what you touched, plus `npx tsc --noEmit`. Add a regression test for each defect you fix, next to the feature (`<feature>/*.test.js`, `components/*.test.js`).
- Command: `node --loader ./scripts/test-loader.mjs --test <file> [<file> …]` (quote globs in zsh). `npx expo lint` for lint. `npm run validate:release -- --profile <name> --remote --live` before any build ([release configuration](release-configuration.md)).
- Many tests assert on source text or use the render harness. They prove wiring and logic, not appearance. When a change is visual, say how it was looked at.
- Run the whole suite only when a release or shared-infrastructure change calls for it; do not repeat unrelated testing to look thorough.

## 6. Simulator versus physical device

The iOS Simulator is good for layout, navigation, state and flows. It **cannot** establish:

- Universal Links from Messages/Notes/Mail, Google sign-in with 2FA, the real photo picker, location permission prompts, push or background behaviour;
- release-build performance (a debug build against Metro is much slower; do not judge flicker, frame rate or memory from it);
- real network and API latency.

Say which of these a report did *not* cover. Physical-device acceptance by the owner is the gate for release; "passed in the Simulator" is not acceptance. Run Metro with the same `EXPO_PUBLIC_*` values a build would use, or maps will be blank (`MISSING_KEY`).

Check Dynamic Type at normal, an enlarged size and an accessibility size on at least one narrow and one wide device when touching text or controls.

## 7. Protecting existing functionality

- Never change authentication, token storage, account isolation, photo authorisation or sharing behaviour as a side effect. These have race-condition tests; keep them green and extend them.
- Keep offline, user-scoped caches working when the API is unreachable or incompatible.
- A route `404` is an environment problem, not "your content was deleted" (shared contract, rule 8).
- Never print, log or commit secrets. The MapTiler key ships in the app but is still never written into reports; verify it by **fingerprint** (section 8 of [release configuration](release-configuration.md)).

## 8. Approvals

The following always need explicit, specific approval, and approval for one does not extend to the next:

| Action | Notes |
|---|---|
| `git push` (see section 2), merge, PR, force operations | Name branch and destination; a push is allowed only where the owner has authorised the branch |
| EAS builds (cloud) and local iOS builds | Name profile and commit; cloud builds only, no local iOS builds |
| `eas submit` / TestFlight | Separate from the build approval |
| EAS Update (OTA) | Reaches every build on a channel; not used for this release |
| Changes to EAS environments or secrets | Record the before state and rollback |
| Any API, web, database or Railway/WorkOS change | Not mobile's to make |
| Production deployment, App Store submission or external TestFlight | Needs the owner's confirmation of physical-device acceptance first |
| Deleting files, branches or worktrees; adding dependencies | Ask first |

If an instruction says "stop", stop and report. If the approved plan hits a blocker (for example a verification fails), stop and report rather than improvising a workaround.

## 9. Reporting

End a task with: what changed (files, SHA), what was tested and how, what was **not** tested, anything that conflicts with documentation or approved designs, and what you need decided. Distinguish verified facts from assumptions.

## 10. Practical notes

- Expo changes between SDKs: read the [versioned docs](https://docs.expo.dev/versions/v54.0.0/) before writing Expo code.
- The shell is zsh: quote globs (`'*.test.js'`), and `=` at the start of a word is expanded (`echo "=== x"`, not `echo === x`).
- Metro caches endpoints: restart with `--clear` after changing `EXPO_PUBLIC_*` values.
