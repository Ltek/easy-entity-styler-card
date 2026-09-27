# Changelog — Easy Entity Styler Card

Build numbers are `vYYYY.MM.DD.N`, where `N` is a monotonic counter that never
resets. Newest first.

---

## v2026.09.27.230

- **Fixed: the four-mode colour control was cramped and stacked.** Its wrapper used
  the generic `.seed-ed-style-field`, which is a **column** with `width:100%`
  children — correct for a labelled swatch in a grid cell, wrong for this control.
  The result was the mode select rendering *above* the theme select, both squeezed
  into a narrow right-hand column. It now lays out as a row matching the Color
  Manager card: fixed-width mode select, value field flexing beside it. Scoped to a
  new `.seed-ed-color-row` class so every other style field is untouched.
- **Colour control no longer compresses inside a size/weight pair.** The pair gave it
  `flex: 0 0 auto`, pinning it to a narrow column — and in Theme mode it holds *two*
  selects, so it had nowhere to go but downward. It now has a real flex basis, so it
  shares the row when there is space and wraps to its own full-width line when there
  is not.
- Confirmed all three cards offer the **same ten theme colour options**, in the same
  order (they already did — no change needed).

## v2026.09.27.229

- **Fixed: a style library could only ever notify ONE listener.** Both
  `ensureFrameLibrary` and `ensureHeaderLibrary` subscribed once and captured only the
  *first* caller's callback, so whichever of the card or the editor registered second
  was never told an entry had changed. The visible symptom: editing a Frame or Header
  style did not refresh the card sitting beside the editor — it only picked the change
  up when the element was recreated. They now keep a listener set and notify every
  one; the subscription itself still happens only once.
- **Section exports now carry their dependencies.** A section already bundled its rule
  sets; it now also bundles the **Frame and Header library entries it references**, so
  an imported section keeps the look it was exported with instead of silently falling
  back to defaults on an install that lacks them. Refs are collected by walking the
  payload rather than by naming fields, so a ref stored under a new key is still
  found. Import adds anything missing and **never overwrites** an existing entry of
  the same slug — a local style of that name wins. Envelopes written before this have
  no `requires` block and still import fine.
- **`hacs.json` added**, and the shipped file is now the unversioned
  `easy-entity-styler-card.js`. Without a `hacs.json` HACS looks for
  `<repo-name>.js`, which never existed while the file carried a version — so
  installing from the HACS button would have failed. This also matches what the
  README's manual-install section already documented.

## v2026.09.20.228

- **Entity Filter Rules usage line.** Each rule set now shows one comma-separated
  sub-line under its name — groups, sections, and **header count badges** that use
  it (or "unused") — so you can see at a glance what a set feeds before deleting
  it. The section count is group-aware (previously ignored sections nested in a
  group) and reflects genuine membership; badge use is shown separately (a
  badge-only set is "N groups, 1 badge", not a phantom section). Deleting a rule
  set cleans its header-badge references and the confirm names them.

## v2026.09.20.227

- **Divider spacing, per side.** A divider's vertical padding is now independent
  **Space above** and **Space below** sliders (each defaults to the historical
  8px; a legacy combined value still applies to both sides).
- **Group member gap + divider spacing are always-shown sliders.** Removed the
  "enable" checkboxes; each slider shows at its effective value and only writes
  its key when you drag it, so an untouched section still inherits.
- **Space before badge.** Each header count badge gained an indent (left margin)
  so per-domain badges can be spread apart.
- **Fixed: editing a section nested in a Group did nothing.** Every editor
  control on a member section — the Count Badge, sliders, colors, dropdowns —
  now persists, updates the preview, and dirties Save. (`_atTarget` was
  top-level-only; it's now container-aware.)
- **All editor sub-panels start collapsed** on a fresh open and no longer force
  themselves open (Icon/Title/Count parts, Columns, embedded-cards list). Open
  state is per-session only, never saved across editing sessions.

## v2026.09.20.226

- **Group section — editor.** Add a Group with the **Group** button; its members
  are listed indented beneath it with their own accent edge. **Use Header From**
  mirrors a member's *full* header (a table's live count + per-domain badges),
  add members or move existing sections in/out, and a per-side divider padding
  gap fix so a divider inside a group edits correctly.
- Shortened add-row labels (**Table**, **List**, **Embed Card**), an
  Entity-List list icon, and the group icon/chip in the theme accent color.

## v2026.09.20.225

- **Group section — data model + renderer + editor cleanup.** Introduced
  `type: group` (a pure container that nests other sections, collapses them
  together, and wraps them in one frame; one level deep; deferral holds through
  a collapsed group). Renamed *Entity Group* → **Entity List**, *Section Layout
  Defaults* → **Global Settings** (with the **Global Entity Name Cleaner** moved
  inside), and de-duplicated that panel's help text.

## v2026.09.20.224

- **Header count badges.** A section header can show one or more **icon + live
  count** badges that hide at zero, each counting a Rule Set or reading a number
  off an entity — reproducing the old per-domain (window/door/lock/garage)
  button-card header natively.
- **Filter by visibility (shown / hidden).** A new **Visibility** field for rule
  sets, table filters, and value/color rules, matching an entity's *shown* /
  *hidden* state from Settings → Entities.
- **Fixed: native entity icons for device-class entities.** A `use_native_icon`
  column now shows the true window/door/etc. glyph instead of the generic
  domain icon.

## v2026.09.19.223

- **Embed other cards in a section** (`type: cards`). A section can hold any
  Home Assistant cards — they collapse with it, sit inside its frame, stay live
  and interactive, and a collapsed section builds nothing until opened. Each
  child's options are edited as YAML; a bad child shows an inline error instead
  of breaking the card.

## v2026.09.19.222

- **Section header padding** is adjustable — card-wide under *Section Header
  Defaults* and overridable per section (independent of the Scale slider).

## v2026.09.19.221

- **Card padding.** Two sliders set the space around the outside edge of the
  card (vertical + horizontal), independent of its contents.
- **Fixed: extra blank space above a card with no title bar.**

## v2026.09.19.220

- **Hide the whole card when it has nothing to show** — a card-level option that
  removes the card from the grid once every *hide-when-empty* section is empty,
  and restores it when an entity matches again.

## v2026.09.19.219

- **Fixed: two cards on one dashboard could style each other.** Per-card values
  (title font/size/color, icon size, row/chip/spacing defaults) are now private
  to each instance, so the last-rendered card no longer wins for all of them.

## v2026.09.19.213 – .218

- **Unified column-header styling** — color, size, weight and italic at both the
  table and per-column level.
- **Every color option is a four-mode control** — Default / Theme color / Custom
  color / Custom CSS.
- **Never list unavailable / unknown entities**; **replace a zero value** with
  blank or custom text; **icon rules** pick a named glyph / native icon / hidden;
  **row limits** (max rows + recency window); **duplicate a column**; **rules can
  test an attribute or the entity state**; unset color swatches read as unset.
- Wording clarity for *Section Layout Defaults* vs *Entity Table Defaults*.
- Fixes: a title part's font size/color/weight/italic no longer reverted after
  being set; a theme-colored drop shadow rendered black; the divider Theme
  text/icon mode was locked to one variable.

## v2026.09.16.206 – .212

- Entity Table subsystem maturing: array-attribute row sources, matched-entity
  columns (same-device / find-replace on entity id), value transforms, rule-based
  color/icon/sort with pin-to-top, templated title rows, separator rows, and
  global table defaults. State-driven header icons and `{entity:…}` title tokens.

## v2026.09.07.205

- **Conditional Visibility** — show the whole card or an individual section only
  when your rules pass (entity + operator + value, chained AND/OR); editor-safe.
- **Copy sections between cards** — export a section (with its referenced rule
  sets) as JSON and import it into another card.
- **Per-location Frame Style condition override**; auto-migrate leftover local
  Frame Styles to the shared System library; library UI refresh; Section Layout
  & Config polish; Frame Style live-preview fix.
