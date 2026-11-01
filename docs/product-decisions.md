# Future product decisions

## Saved-content authentication consistency

The web app currently requires authentication for favourites and Trip Ideas,
while the mobile app currently allows local-first saved content but requires
authentication for Notebooks.

After Notebook MVP acceptance, review whether mobile should adopt the same
authentication model as the web for consistency.

# Decisions recorded during the Shared Trips release (2026-10 to 2026-11)

These are decisions taken by the product owner that the code reflects. Record changes here.

- **Sign-in uses the standard WorkOS authentication browser.** An ephemeral (private) session that would allow choosing another Google account was tried and removed. Consequence: sign-out is local-only and the browser session persists, so there is no account switching in the app. Revisit with the production sign-out design.
- **Live sharing is the supported way to share a Trip; Personal Places cannot be shared.** Opening a link only previews; Join Trip and Save a Copy are explicit taps. The older public snapshot share exists only against the production API and excludes Personal Places.
- **Dynamic Type:** body text scales fully; controls are capped at 1.4×; paired buttons stay side by side and fit their labels (never stacked). Stacked pairs at large sizes were tried and rejected.
- **Approved device-checked layouts are frozen** unless the owner approves a change (style guide section 20).
- **Personal Place photos appear immediately and without a fade**; other images keep their 150 ms fade.
- **Notebooks and Diaries are switched off** for this release (`config/personal-content-features.ts`).
- **Release gating:** physical-device acceptance by the owner is required before production deployment, the final handover or any external TestFlight; every build, submission and push needs explicit approval.

