# TripIdeas Mobile UI/UX Canon

Status: mandatory project canon

Source of truth: the current tested mobile implementation

Scope: user-facing work in `tripideas-mobile`

This guide records the UI and interaction system established across Saved,
Trips, Notebooks, Personal Places, and the editorial Place presentation. Reuse
the referenced implementation before inventing a new treatment. Where prose
and code diverge, inspect the reference code and resolve the discrepancy rather
than silently creating another pattern.

## Governance

### TRIPIDEAS MOBILE UI/UX CANON

The patterns in this guide are mandatory defaults for future TripIdeas mobile
implementation.

Future work must:

1. inspect this guide before introducing or changing user-facing UI;
2. reuse a canonical component or pattern wherever an equivalent exists;
3. avoid a competing implementation for an established interaction;
4. preserve established icon and action semantics; and
5. follow the canonical spacing, layout, and action hierarchy unless the task
   explicitly directs otherwise.

Deviation is permitted only when the current task explicitly directs a
different design or when the canonical pattern genuinely cannot satisfy the
requirement.

### Pause-and-check rule

If a task appears to require an unauthorised breach of the canon, stop before
implementing it and report:

- the canonical rule involved;
- the new requirement;
- why they conflict;
- the smallest proposed deviation; and
- whether it should become canon or remain a scoped exception.

Wait for explicit approval. Do not silently reinterpret this guide.

An explicit task instruction overrides canon only within that task's authorised
scope. Do not propagate the deviation elsewhere or update this guide unless
canon maintenance is explicitly requested. Report the deviation on completion.

## 1. Design principles

- Content dominates controls. Controls support reading and planning without
  becoming the visual subject of a page.
- Reuse before invention. Start with the canonical references at the end of
  this guide.
- Equivalent interactions behave consistently across Saved features.
- Saved, Trips, Notebooks, and Personal Places form one UI estate.
- Preserve proven interactions. Do not replace a working interaction merely
  for theoretical consistency.
- Keep controls grouped by purpose and location; do not scatter active actions
  through content.
- Contextual prompts may interrupt the normal visual rhythm when they concisely
  explain a genuine prerequisite, conflict, recovery step, or guard.
- An editing workspace optimises management; finished content optimises
  reading. Do not make one impersonate the other.

## 2. Screen hierarchy

### Saved hub

`app/(tabs)/saved.tsx` is a navigation hub, not an editor. It contains calm,
whole-row modules for Favourites, Trips, Personal Places, and Notebooks. Each
row has an identity icon, title, restrained state/count text, and blue forward
chevron. Creation and feature content belong inside the destination feature.

### Feature index/list

Trips, Notebooks, and Personal Places establish the pattern:

- native header title;
- white circular back control at top left;
- bare blue `+` at header right;
- content begins at the standard page inset;
- compact, whole-row cards for navigation;
- destructive list action separated from the row press target; and
- compact loading, empty, cached/error, and creation states.

### Content/detail

Content detail establishes a clear hierarchy: hero/cover where relevant,
title and grouped actions, body/notes, map/location, gallery or entries, then
secondary/contextual material. Use `PlaceDetailContent` for editorial-style
Place presentation.

### Create/edit workspace

Editors may expose fields, upload previews, thumbnail grids, remove controls,
location confirmation, readiness guidance, and retry states. These are
management tools and are not the finished-card presentation.

### Finished/read-only content

Finished Personal Places deliberately reuse editorial Place hierarchy,
typography, map, and gallery. Editing controls do not leak into the gallery or
body presentation. A compact edit icon may open the workspace.

### Contextual prompts

Prompts are concise, actionable, and shown near the affected operation. Guards
for attachments, readiness, conflicts, offline recovery, and paused uploads may
interrupt the normal flow because they prevent an invalid or destructive action.

## 3. Navigation

### Back control

Reuse `components/ui/header-back-button.tsx`.

- white `Palette.surface` circle;
- `44 × 44` visible target;
- `10` point additional hit area;
- `22` radius;
- `StyleSheet.hairlineWidth` `Palette.border` outline;
- Ionicons `chevron-back`, size `24`;
- immediate pressed opacity of `0.5`;
- accessible label `Go back`.

Colour is contextual:

- `Palette.trip` blue inside Saved features: Favourites, Trips and Trip
  subpages, Personal Places, and Notebooks;
- `Palette.text` black in Discover, editorial navigation, general Map context,
  and other non-Saved screens.

Preserve destination behavior as well as appearance. Normal detail screens pop
the stack. Notebook list/detail use destination-based dismissal to Saved and
Notebooks respectively. Trip detail pops when possible and falls back to Trips
for direct entry. Avoid replacing a detail screen with another copy of its
index; that leaves duplicate index routes behind.

### Forward navigation

Saved hub modules use a blue Material Icons `chevron-right`, size `26`.
Feature index cards do not add a forward chevron: the whole row is the
navigation target. Do not infer that every tappable card needs an arrow.

### Whole-row behavior

Rows/cards expose an accessibility role and descriptive label. Overlay actions
such as trash must not trigger row navigation. Use separate sibling/overlay
press targets or stop propagation where nesting is unavoidable.

### Adjacent-card arrows

Up/down arrows in Trips are adjacent-card navigation, not ordering. They scroll
to the measured top of the preceding or following card and briefly highlight
it. They must not reorder Trip entries or regenerate the page. Notebook page
navigation is the corresponding reference behavior.

## 4. Icon system

Material Icons are the default action vocabulary; the canonical back chevron is
Ionicons. Reuse existing names and semantics:

| Meaning | Canonical treatment |
| --- | --- |
| Favourite | heart; `Palette.favourite`; never Personal Place identity |
| Trips | folder/Trip context; `Palette.trip` for feature emphasis |
| Personal Place | `location-on`/place pin; not a heart |
| Notebook | `menu-book` identity |
| Add | bare blue `add`, size `30`, header right |
| Edit | `edit` in `IconAction` |
| Share | `share` in an action cluster |
| Map | map/location icon in an action cluster where that context uses icons |
| Delete | `delete-outline`, destructive `IconAction`; default on full cards, compact on deletable sub-components |
| Overflow | `more-horiz`, with secondary/contextual actions behind it |
| Adjacent navigation | `arrow-upward` / `arrow-downward` |
| Back | shared 44-point white-circle control described above |
| Forward | blue `chevron-right` on Saved hub modules only |

Use `IconAction` for circular active actions:

- default `44 × 44`, icon `22`;
- compact `36 × 36`, icon `18`;
- pill radius and one-point outline;
- `8` point hit area;
- normal colour `Palette.textBody`;
- destructive colour and outline `Palette.danger`;
- disabled opacity `0.35`, pressed opacity `0.55`.

Every icon-only action requires a specific accessibility label. Do not use
colour alone to communicate meaning.

## 5. Action hierarchy

- Page-level actions live in the navigation header or title-row action cluster.
  Examples: add, map, share.
- Object/content actions sit beside the object title or in its compact action
  cluster. Example: edit a finished Personal Place.
- Adjacent navigation arrows stay together and perform navigation only.
- Secondary/contextual actions belong behind `more-horiz` when visible controls
  would dominate the content.
- Destructive actions are secondary, compact, and separated from navigation.
  Prefer list-level trash or overflow over a large red content-page button.
- Retain text on actions that are ambiguous without it. Icon-only treatment is
  not a goal in itself.

## 6. Autosave

Ordinary user-authored Trip notes, Trip entry notes, Notebook metadata/page
text, and Personal Place title/body text autosave. Do not introduce explicit
Save buttons merely to persist equivalent text.

Canonical behavior:

- default debounce: `700 ms`;
- preserve newer local typing when an older response arrives;
- adopt an authoritative response only for the revision it saves;
- refresh/reload authority after relevant conflicts, then retry only through
  the established guarded path;
- serialize mutations where the domain requires ordered versions;
- show `Saving…` in muted caption text;
- show `Could not save. Tap to retry.` in danger colour when retry is available;
- reserve a `17` point status row so text fields do not bounce;
- keep idle/Saved content in that reserved row at opacity zero; current canon
  does not flash a persistent visible `Saved` message.

References are `AutosaveNote`, `AutosaveStatus`, Notebook autosave code, and
Personal Place autosave code.

Known variance: Personal Places currently debounce at `650 ms`. The mandatory
default for new work is `700 ms`; do not silently alter the existing variance
inside an unrelated task.

Photo selection/removal/replacement, upload, location confirmation, reordering,
sharing, attachment, deletion, and other structural changes remain explicit
actions rather than text autosave.

## 7. Long text

Use `ShowMoreText` for read-only text and the established `ExpandableText`
wrapper where the collapsed surface also enters editing.

Canonical presentation:

- measure actual laid-out text;
- collapse to three lines;
- place a separate, right-aligned muted italic caption below;
- wording is exactly `... show more` and `... show less`;
- expansion is in place; collapse returns to three lines;
- expose descriptive Show more/less accessibility labels.

Editors expose the full text input while actively editing. When not actively
editing, editable notes may use the same three-line reading surface.

Editorial Place précis exclude H3 blocks from the collapsed three lines. On
expansion, the complete content-block article renders with all H3 headings in
their original order and style.

Do not create character-count excerpts or inline `read more` variants.
Non-interactive three-line card/share previews are summaries, not Show more
controls, and need not become expandable.

## 8. Lists and index screens

Canonical references are `app/trips/index.tsx`, `app/notebooks/index.tsx`, and
`app/personal-place-cards/index.tsx`.

- page inset: `Screen.gutter` (`24`);
- top content inset: `Screen.top` (`20`);
- bottom inset: `Screen.bottom` (`32`);
- header-right add: bare blue Material Icons `add`, size `30`, hit area `12`;
- card radius: `Radius.card` (`14`), one-point `Palette.border` outline;
- compact montage region: `112 × 92`;
- list title: typically 17–18 point bold, maximum two lines;
- secondary line is muted and restrained;
- list spacing uses established `Space.md`/`Space.lg` rhythm;
- whole row opens the object;
- compact destructive `delete-outline` is independently pressable and confirmed.

Trips use up to four entry/place images. Notebook montage uses the first photo
from up to four pages and caches authorised URLs in memory. Personal Places use
the main photo followed by body photos, up to four. Empty image areas use a calm
feature label rather than a large creation control.

Empty/loading/error language stays compact. Where readable cached content
exists, preserve it and report refresh failure rather than replacing it with a
blank screen. Saved remains a hub, not a combined editor.

## 9. Content and detail screens

`PlaceDetailContent` establishes editorial hierarchy:

1. full-width 16:9 hero;
2. title and compact title actions;
3. body/précis;
4. Location heading and map;
5. finished gallery;
6. contextual/nearby content.

It uses `Screen.gutter`, `Screen.top`, `Space.xl` body/title separation, and
`Space.xxl` around location/gallery sections. Personal Place finished view
reuses this component and `PlacePhotoGrid`; it is not an editor with fields or
thumbnail removal controls.

Trip detail groups Map and Share actions and renders entries in canonical
order. Notes use the shared autosave/expansion pattern. Entry overflow owns
secondary removal; underlying editorial or Personal Place content is not
deleted when removed from a Trip.

## 10. Editing workspaces

Personal Place edit mode is the clearest reference:

- larger bold title input;
- body uses the three-line surface until editing, then a full multiline input;
- fixed-height autosave status;
- explicit coordinate entry and confirmation;
- 16:9 main-photo preview with small circled remove control and replacement;
- body photo multi-select, maximum 10;
- wrapped thumbnail management grid with circled remove controls;
- upload previews and restart recovery;
- concise readiness guidance and Add to Trip controls;
- attached-card edit guards remain authoritative.

The finished gallery never reuses this management grid. Efficiency and clear
state may take precedence over editorial presentation inside the workspace.

Notebook editing similarly keeps page navigation, text editing, photo actions,
conflict recovery, and sharing controls available without turning its index into
an editor.

## 11. Maps and galleries

Use `PlaceMapPreview` for editorial/finished Place maps:

- height `220`;
- `Radius.card` clipping and card shadow;
- non-interactive camera at zoom `13` unless an `onPress` action is supplied;
- reuse the main-map pin semantics: blue for ordinary/default places, darker
  blue for a selected place, and red with a white outline for the focused
  single-place context;
- do not add a `Map preview` label overlay;
- retain MapLibre's standard information/attribution control where applicable.

Map filter sheets place a prominent blue `Apply` action at top left. Ordinary
region, activity, Favourite, and Trip rows use regular text weight; island and
section headers carry the hierarchy through stronger type. Selection is shown
by its check control rather than by changing the row label to bold.

Current action presentation varies by context: Trip title actions use icon
controls, while editorial Place map destinations use clearly labelled buttons.
Preserve this proven distinction unless a task explicitly standardises it.

Use `PlacePhotoGrid` for finished viewing: responsive one-to-four image preview,
clean spacing, additional-photo overlay, full-screen viewer, close control,
count, and horizontal swipe through the complete image set. No X/delete controls
appear in a finished gallery. Editors use their separate thumbnail grid.

## 12. Destructive actions

- Use `delete-outline` with a destructive `IconAction`. Use the default size on
  full index cards and the compact size for deletable sub-components such as a
  Trip entry or Notebook page.
- Keep deletion separate from the row's navigation press.
- Require an explicit confirmation dialog.
- Preserve attachment, ownership, and active-count guards and show actionable
  feedback when deletion is refused.
- Use overflow for contextual removal where list-level trash is inappropriate.
- Do not let a large danger button dominate a finished content screen.
- Removing an entry from a Trip does not delete the underlying Place or
  Personal Place.

## 13. Spacing and visual tokens

Use `constants/design.ts`; do not reproduce these values ad hoc when a token
exists.

### Colour

- background/surface `#ffffff`;
- muted surface `#f7f7f5`;
- border `#dededb`;
- text `#111111`;
- body `#333333`;
- muted text `#717171`;
- Trip/Saved feature blue `#1473e6`;
- Favourite red `#e31b23`;
- danger `#c62828`.

### Spacing

`Space`: 4, 8, 12, 16, 20, 24, 32, and 40. Screen insets are horizontal 24,
top 20, bottom 32.

### Radius

Small 8, control 10, input 12, card 14, sheet 18, pill 999. The back control is
an explicit 44-point circle with radius 22.

### Typography

| Token | Size / line / weight |
| --- | --- |
| display | 34 / 40 / 700 |
| title | 28 / 34 / 700 |
| section | 22 / 28 / 700 |
| cardTitle | 18 / 23 / 700 |
| body | 16 / 24 / 400 |
| bodyStrong | 16 / 22 / 700 |
| label | 14 / 18 / 700 |
| caption | 13 / 17 / 400 |

Use `CardSurface` for canonical white cards with radius 14, one-point border,
clipping, and the shared card shadow. Images inside cards normally clip to the
card; editorial heroes are full-width 16:9.

## 14. States and prompts

- Loading: use `LoadingView` or compact `StatusText`; do not rearrange the
  surrounding screen unnecessarily.
- Empty: concise muted guidance, with creation remaining in the header.
- Autosaving: fixed-height status described above.
- Offline/cached: retain readable user-scoped cache and explain refresh failure.
- Error: safe, actionable language; retry close to the failed operation.
- Disabled: preserve control geometry and accessibility state; lower opacity.
- Confirmation: name the destructive scope and offer Cancel first.
- Contextual prompts: explain the missing prerequisite and the next action,
  then disappear or become irrelevant when resolved.

## 15. Accessibility

- Icon-only controls require explicit action labels and button roles.
- Use at least a 44-point primary touch target or supplemental hit area. Compact
  contextual icons retain hit slop.
- Whole-row navigation has a descriptive `Open …` label.
- Disabled state is exposed through `accessibilityState` where supported.
- Autosave messages use a polite live region.
- Show more/less labels identify the affected content.
- Gallery tiles identify image position; the full-screen viewer has an explicit
  close action and count.
- Overlay actions must not activate the underlying row/card.
- Destructive actions require both accessible labels and confirmation.

## 16. Extensibility

New Saved features must fit the existing hub → feature index → detail/editor
grammar without redesigning the surrounding estate. Compose existing
primitives first. Extract only genuine repeated behavior; do not create a new
feature-specific UI system for an interaction that already has canon.

When no reference fits, apply the governance pause-and-check rule before adding
a competing pattern.

## 17. Canonical implementation references

| Pattern | Canonical implementation |
| --- | --- |
| Tokens | `constants/design.ts` |
| Back control | `components/ui/header-back-button.tsx` |
| General circular action | `components/ui/icon-action.tsx` |
| Saved hub module | `components/saved-module.tsx`, `app/(tabs)/saved.tsx` |
| Trips feature index | `app/trips/index.tsx` |
| Notebook feature index | `app/notebooks/index.tsx` |
| Personal Places feature index | `app/personal-place-cards/index.tsx` |
| Image montage | `components/trip-image-collage.tsx` |
| Autosave note | `components/ui/autosave-note.tsx` |
| Autosave status | `components/ui/autosave-status.tsx` |
| Notebook autosave/conflicts | `app/notebooks/[notebookId].tsx`, `notebooks/autosave.ts` |
| Personal Place autosave | `app/personal-place-cards/[cardId].tsx`, `personal-place-cards/autosave.ts` |
| Read-only long text | `components/ui/show-more-text.tsx` |
| Editable collapsed text | `components/ui/expandable-text.tsx` |
| Editorial/finished Place hierarchy | `components/place-detail-content.tsx` |
| Editorial Place screen | `app/(tabs)/(discover)/place/[slug].tsx` |
| Personal Place finished/editor | `app/personal-place-cards/[cardId].tsx` |
| Map preview and shared pin | `components/place-map-preview.tsx`, `components/map/map-pin.tsx` |
| Finished gallery/viewer | `components/place-photo-grid.tsx` |
| Trip detail/actions/arrows | `app/trips/[tripId].tsx`, `components/trip-entry-card.tsx` |
| Notebook adjacent-page navigation | `app/notebooks/[notebookId].tsx`, `notebooks/model.ts`, `content-blocks/pages.ts` |
| Destructive Trip-entry action | `components/trip-entry-card.tsx` |
| Card surface | `components/ui/card-surface.tsx` |

## Recorded implementation inconsistencies

These are current facts, not invitations to spread the variance:

1. Personal Place text uses a 650 ms debounce; the canonical default is 700 ms.
2. Map destination actions are icon-based in Trip title actions but labelled
   buttons on editorial Place pages. Preserve the contextual distinction until
   an explicitly scoped task changes it.
3. Long-text editing wrappers and read-only content use different components,
   but share the same three-line wording and presentation intentionally.

Do not fix recorded inconsistencies as incidental work. A task that changes
canon should update this document only when explicitly authorised.
