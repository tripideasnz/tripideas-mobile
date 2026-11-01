# TripIdeas Mobile: project scope

Mobile companion app for TripIdeas.nz. How it works: [docs/architecture.md](docs/architecture.md). Getting started: [README.md](README.md). Rules for working here: [docs/development-guidelines.md](docs/development-guidelines.md).

## Stack
- Expo SDK 54, React Native 0.81, React 19, Expo Router, TypeScript
- Sanity CMS (editorial content, read-only from the app)
- TripIdeas API (accounts, Trips, sharing, Personal Places, photos), WorkOS sign-in
- MapLibre with MapTiler styles
- EAS cloud builds and TestFlight

## Scope today (release candidate, integration environment)
- Discover, Search, Saved, Map and Profile tabs
- Favourites, Trips (server-backed, offline-readable), live Trip sharing with Join and Save a Copy, Shared With Me
- Personal Places with private photos, attachable to Trips
- Map filters (Regions, Activities, Saved), location, place selection

## Not in this release
- Notebooks and Diaries (code present, feature-flagged off)
- Planner / AI itinerary builder, Bookit integration, Android (untested)
- Account switching, in-app account deletion, Terms of Use (open items)

## Guiding principles
1. Reuse existing TripIdeas content and metadata wherever possible; no separate mobile-only content store.
2. Prefer simple solutions over complex architecture.
3. Keep the mobile app aligned with the Sanity CMS and the API contract.
4. Keep the app runnable. Commit validated work locally; pushing, builds and releases need explicit approval ([development guidelines](docs/development-guidelines.md) section 8).
5. Preserve approved designs ([style guide](docs/mobile-ui-ux-style-guide.md) section 20).

The original MVP and future-feature list that this file used to hold (collections, shared Trips, maps, AI itinerary, Bookit) is superseded by the scope above; Collections and shared Trips are implemented as Trips and live sharing.
