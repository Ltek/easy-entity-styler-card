# Changelog — Easy Entity Styler Card

Build numbers are `vYYYY.MM.DD.N`, where `N` is a monotonic counter that never
resets. Newest first.

---

## v2026.11.21.261

- **Colour choices are all in the colour dropdown.** The "Follow icon color" checkboxes are gone.
  - **Glow** and **Shadow**: Accent / Theme color / Custom color / Custom CSS / **Icon color** / **Border color**.
  - **Border**: the same, with **Icon color** (it can't follow itself).
  - **Edges** (solid colour and each gradient stop): *Match* is now called **Border color**, and
    **Icon color** is new.
  - Stored as before: `follow_icon` / `follow_border` on the part, and `match` / `icon` for edge colours.
    Existing styles are unchanged.
- **Border color** on Glow or Shadow uses the style's border, or the border of a style layered with it.
  With no border at all, it falls back to the part's own colour.
- **Border opacity** (0–1), written only below 1.
- **Edges** has an **Enable edges** box in its header, like the other parts. Turning it on adds a
  centre-fade line at the top and bottom, with one shared editor. Turning it off removes the edges.

## v2026.11.21.260

- **Fixed: turning on Edges made a *Theme (inherit)* background disappear** when the theme's card
  background is a gradient or image. Edge lines and that background are both CSS background images,
  so the edges replaced it. With edges on, the theme background is now drawn on its own layer and the
  edge lines on a layer above it. With opacity below 1, the edges now stay at full strength (in v258
  the faded background covered them). Custom-colour backgrounds are unchanged.

## v2026.11.21.259

- **Sort chips on the library lists:** **A–Z** (default), **Z–A**, **In use** (most uses on this card
  first) and **Not in use**.
  - On Frame Styles, Header Rules (the card's own and the library) and Entity Filter Rules.
  - Each list keeps its own choice, remembered in the browser, not in the card config.
  - Built-In stays first.
  - Sorting changes only what the editor shows, never the order in your config.

## v2026.11.21.258

- **Fixed: background opacity with *Theme (inherit)*.** Below 1 the background disappeared completely
  when the theme's card background is a gradient or an image. The fade used CSS `color-mix()`, which only
  takes a plain colour, so the whole value was dropped. A see-through theme background is now drawn as a
  faded layer behind the card or section, which works for any background. The content and border stay
  fully opaque. Custom colours were not affected.

## v2026.11.21.257

- **Frame Style editor:** the option groups (Glow, Shadow, Border, Background, Edges, Condition) now share
  one row style. Each has a single divider line above it, the same padding whether it's on or off, and
  its title and Enable box centred on one line. Before, groups that were on were indented and spaced
  differently from those that were off, and some rows had a doubled divider.

## v2026.11.21.256

- **A closed card no longer builds its embedded cards** (EES-FEATURE-GAPS item 12). A collapsible card
  that starts collapsed used to build every child card (logbooks, history graphs, auto-entities, …)
  while closed, so it cost as much as an open one. It now builds them the first time it opens, as
  expander-card does, and keeps them after it closes, so they keep their state. A header pop-up card
  builds them when the pop-up opens.
- Header rules, `{count:}` / `{entity:}` titles and *Expand when section has entities* keep working
  while closed. They read Home Assistant's states, not the child cards. A card that opens itself
  builds its children then.
- **Build embedded cards while closed** (`card_preload_children: true`) gives the old behaviour, e.g. so
  a camera stream is already running when you open the card. Expanded and non-collapsible cards are
  unchanged.

## v2026.11.21.255

- **Frame Style editor is shorter.** Glow, Shadow, Border, Background, Edges and Condition are each a
  collapsible group. They start closed, with the Enable box in the group's header, so the Preview
  swatch stays in view. A group you switch on opens, and open groups stay open when the editor redraws.
- **Save / Discard at the top** of a shared Frame Style, kept in view while you scroll its options.
- **See unsaved edits on the real card.** While a shared style has unsaved changes, the card in HA's
  editor preview shows them live, including while you drag a slider. **Card preview: Saved / Edited**
  next to Save / Discard switches it between the stored and the edited version. Other cards on the
  dashboard keep the saved style. Closing the editor or pressing Discard puts the preview back.
  Card-local styles already showed edits live, so they have no switch.

## v2026.11.21.254

- **Show or hide each part.** Glow, Shadow, Border and Background each now have:
  - a **Show when / Hide when** choice;
  - an **any of / all of** choice;
  - the boxes **Always**, **When Active**, **When Expanded** and the new **When Collapsed**.

  For example, *Hide when Collapsed* draws a border only while the card is open, and *Show when all of
  Active + Collapsed* glows only when something is on and the card is closed. *Always* greys out the
  other boxes; with Hide it means "never". The editor flags combinations that can never hold, such as
  "all of Expanded + Collapsed". Stored as `mode: hide` and `match: all` in the part's `show:`, written
  only when used, so v253 settings are unchanged.
- **Regular and Active strength.** Glow and Shadow show **Regular strength** and **Active strength**
  (× regular) next to each other. Active strength is the same value as v253's "Stronger when active".
- **Background opacity.** A custom-colour or theme background can now be see-through (`opacity`, 0–1).
  It's written only below 1.

## v2026.11.21.253

- **Show options per part.** Glow, Shadow, Border and Background each have their own **Always / When
  Expanded / When Active** boxes, under that part in the Frame Style editor. Glow and Shadow each have
  their own **Stronger when active** (×1–×3, default ×1.6). These replace v252's single "Glow and
  shadow show" block.
  - Stored as `show:` inside the part, e.g. `glow: {…, show: {expanded: true, active: true, active_boost: 1.6}}`.
  - A part with no `show` follows the style's condition, as before v252. Edges always do.
- **v252 configs keep their look:** a `glow_when` block is moved into the glow and shadow, and the border
  and background get *Always*, which is what v252 did.
- Turning on Glow or Shadow in the editor starts with every box off, so it shows nothing until you
  pick when.

## v2026.11.21.252

- **Glow modes** (EES-FEATURE-GAPS item 11). Under a Frame Style's glow and shadow, the glow can now
  show **Always**, **When Expanded** and/or **When Active**. While active, it can be stronger:
  **Active glow strength**, ×1–×3, default ×1.6.
  - `glow_when: {always, expanded, active, active_boost}` on the Frame Style.
  - Expanded means the card is open on the card frame, or that section is open on a section frame. A
    frame that can't collapse counts as open.
  - The glow fades in and out over 150 ms, with no re-render.
  - Once the block is set, the style's condition (relabelled **Active when…**) gates only the glow and
    shadow. Its border, background and edges always apply.
- **Nothing changes for existing styles.** Without the block, a conditional glow behaves as before (it
  reads as *When Active*, with no boost), and an unconditional one as *Always*. Only a style you change
  gets the block. A new library style starts with every box off, so no glow.
- The glow and shadow sliders (strength, blur, spread, opacity) now have a number box and a reset.
  Glow strength goes down to ×0.1.
- **Fixed:** exporting a Frame Style dropped its condition but kept a v247 entity-list / Rule Set
  source. Unticking *Only apply when…* also left that source in place, so the condition came back.

## v2026.11.21.251

- **Faster on big HA installs.** A Cards, Group or Entity List section no longer scans and sorts every
  entity in Home Assistant on each update just to pick its header-rule entity. With 1,500 entities and
  52 cards on one view, that was about 1,300 full sorts per 10 state changes.
- An Entity List section's header-rule entity is now its own first member. It used to be the most recently
  changed entity in all of HA, so a header rule without its own `entity:` could match the wrong thing.
- Activity tables sort once per update instead of once per caller, and compute each row's sort keys once
  instead of on every comparison. The order is unchanged.

## v2026.11.20.250

- **Title bar height.** `card_title_height` (px) sets a minimum height for the title bar, with its
  content centred. This is button-card's fixed `height:` on a header. Set it under Card Header →
  *Title bar spacing*. Without it, the title bar sizes to its content as before.
- With this, the 14 non-person headers from EES-FEATURE-GAPS item 9 render natively, without
  button-card. Rendered next to their originals in HA, with the test entities off and on: header
  height, total height, icon, icon colour and text all match. The one exception is AirScape's run mode
  while off, which the original draws fully transparent.

## v2026.11.20.249

- **An entity's picture as the title icon (EES-FEATURE-GAPS 9.6).** Card Header → Title Icon →
  *Show: An entity's picture*. Examples: `person.*`, `image.*` or `camera.*`.
  - It is drawn as a circle at the title icon size, or square with `title_icon_square: true`.
  - It falls back to the icon when the entity has no picture.
  - An optional **ring** (`title_icon_ring` px, `title_icon_ring_color`) can be coloured by a Header
    Rule's new *Ring color* output (`set_icon_ring_color`). Example: green at home, red away, orange
    in any other zone.
- **Title-bar buttons (9.7).** `card_title_buttons:` adds icons on the right of the title bar, each
  with its own tap and hold actions (hold time default 500 ms), e.g. a TV power button that toggles
  on an 800 ms hold.
  - Each button is coloured by its entity: `active_color` when it is active (or `active_when`
    holds), `color` otherwise.
  - Tapping or holding a button never opens or closes the card.
  - Edited under Card Header → *Title buttons*.
- Test: `/shared/user/code/_tests/entity-card-title-icon-buttons.test.mjs` (9 checks; 8 fail against
  v248), now part of the publish gate.

## v2026.11.20.248

- **Title suffix (EES-FEATURE-GAPS 9.3).** A smaller part right after the card title or a section
  name, for example "Living Room TV" followed by a grey "- Plex". Set it under *Title suffix* in each
  header panel; tokens work in it.
  - Keys: `title_suffix`, `title_suffix_color`, `title_suffix_size` (default 14 px); on the card the
    keys are prefixed `card_`.
  - A Header Rule's *Title suffix* (`set_title_suffix`) replaces it while the rule applies.
  - It hides while one of its entities is unavailable, and updates live.
- **Second right-side line (9.5).** `title_right2` sits under `title_right`, with its own colour and
  size (default 12 px). Example: Subfloor's indoor reading with "outdoor: …" below it. Without a second
  line, the markup is unchanged.
- Test: `/shared/user/code/_tests/entity-card-title-extras.test.mjs` (7 checks; 6 fail against v247),
  now part of the publish gate.

## v2026.11.20.247

- **Frame Style conditions use the same sources as header rules (EES-FEATURE-GAPS 9.8).** The
  *Only apply when… → Based on* setting gains two kinds:
  - *Any / all of a list of entities*, `when_source: {type: entities, entities: [...], match: all}`.
    Example: glow while either deadbolt is unlocked.
  - *How many entities a Rule Set matches*, `when_source: {type: rule_set, ref}` with a count test.
    Example: glow while any security zone is on.
- A Frame Style condition whose sub-conditions each name their own entity no longer needs a watched
  entity. Example: Leak glows red while `valve.main` is closed.
- **New operators "is set" / "is not set"** (`is_set`, `not_set`), for filters and conditions. Rule Sets
  can now match "entities that HAVE a `zone` attribute" (EES-FEATURE-GAPS 9.4).
- Test: `/shared/user/code/_tests/entity-card-frame-sources.test.mjs` (7 checks; all 7 fail against
  v246), now part of the publish gate.

## v2026.11.20.246

- **Rules can set the title (EES-FEATURE-GAPS 9.2).** A header rule has a *Title* (`set_title`)
  that replaces the card title, section name, group name or table title while it applies. Tokens
  work in it, e.g. `Door Locks - {count:rs_unlocked} Unlocked`. A set's `default:` supplies the title
  when no rule matches. It updates live.
- **Rule order.** As for every rule output, rules apply in order and the last matching one wins, so
  put the most specific rule last. Example: Garage "Door 1 Open", then "Door 2 Open", then "Both Open".
- **A condition can name its own entity** (`entity:` on a condition, or the entity box on a
  header-rule condition row). That makes rules like "PS4 is playing AND the TV isn't off" possible.
  A rule whose conditions all name their entities needs no bound entity. A named entity that doesn't
  exist never matches.
- Test: `/shared/user/code/_tests/entity-card-set-title.test.mjs` (8 checks; 7 fail against v245),
  now part of the publish gate.

## v2026.11.20.245

- **Header templates (EES-FEATURE-GAPS 9.1).** The card title, section and group names, the
  right-side text, and a rule's right-side text all accept one fixed set of tokens:
  - `{entity:ID}` gives the state as HA formats it; `{entity:ID:attr}` gives an attribute;
    `{entity:ID:raw}` gives the bare state.
  - `{count:rule_set_id}` gives how many entities one of the card's Rule Sets matches, e.g.
    `Open Shades - {count:rs_open}`.
  - `{ago:ID}` / `{ago:ID1,ID2}` gives the time since `last_changed`, using the most recent of
    several: "Just now" / "N mins ago" / "N hrs ago".
  - **Filters** (`round(n)`, `div(n)`, `map(a=Text,b=Text,*=Other)`) chain after `|`, e.g.
    `{entity:sensor.dist:raw|div(5280)|round(1)} mi`.
  - There are no conditionals; those belong in Header Rules.
- **Titles update live** with state changes. Cards that show `{ago:…}` share **one** 30-second
  timer, which stops when the last of them leaves the page, so "5 mins ago" moves on even when
  nothing changes.
- **Behaviour details.**
  - A title or name without `{` renders exactly as before.
  - A token whose entity is unavailable is blank in a title. On the right side it hides the whole
    text, as before.
  - Token values are escaped.
- **Entity Table titles** gain the same `{count:…}`, `{ago:…}` and filters. Their own
  `{entity:ID}` still shows the bare state, as tables always did.
- Test: `/shared/user/code/_tests/entity-card-templates.test.mjs` (11 checks; 10 fail against
  v244), now part of the publish gate.

## v2026.11.20.244

- **Any card as the title bar (EES-FEATURE-GAPS item 9, Option A).** Set it under Card Header →
  *Header card*, or as `card_header_card: {type: …}` in YAML, with the card's own config verbatim
  (HA's YAML editor in the panel). It replaces the built-in title, icon, count and right-side
  text, like expander-card's `title-card`.
  - **Tapping it:** by default it opens / closes the card, through a transparent layer over it
    (expander-card's `title-card-button-overlay`). With `card_header_card_tap: card`, taps reach the
    header card, so its own tap / hold actions run. The chevron still opens the card.
  - It mounts through `hui-card`, gets live updates, and is kept across full redraws while its
    config is unchanged.
  - It also works as the header of a pop-up card.
- `child_margin_top` may now be negative (−64 to 64 px), like expander-card's `child-margin-top:
  -1em`.
- Test: `/shared/user/code/_tests/entity-card-header-card.test.mjs` (8 checks; all 8 fail against
  v243), now part of the publish gate.

## v2026.11.20.243

- **Fixed: an embedded card with its own `card_mod` lost its top padding (EES-FEATURE-GAPS item
  8).** Embedded cards now mount through Home Assistant's own `hui-card` wrapper, the same way HA's
  stacks and expander-card do.
  - **Cause:** before, each child was created bare, and card-mod then inserted a `<card-mod>` element
    as the first child of its `ha-card`. HA's `.card-content:not(:first-child)` rule then removed the
    card content's top padding.
  - **Also new:** a child's own `visibility:` conditions now apply, as they do on a dashboard.
  - **Older frontends:** those without `hui-card` keep the direct mount.
- Test: `/shared/user/code/_tests/entity-card-embed-mount.test.mjs` (3 checks), now part of the
  publish gate.

## v2026.11.20.242

- **Header Rule Sets kept in the card (EES-FEATURE-GAPS 3a).** As well as the shared library, a card
  can carry its own sets in `header_rules:`, so a pasted or copied card keeps its rules. In the
  editor's Header Rules panel, *This card's Header Rules* has three actions: *Add card Header Rule*,
  *Copy a library set into this card* (an independent copy), and delete. The last also removes the
  set from any header that used it.
  - Apply them like library sets. The header's Header Rules picker has a *This card* group.
  - Ids are plain, e.g. `hr_x`. Library ids always start `lib:`.
- **A rule can test more than the bound entity.** Each rule has a new *Test* setting:
  - *A list of entities*, `source: {type: entities, entities: [...], match: all}`. The rule's
    condition must hold for any entity (default) or all of them. Example: "either tuner isn't idle".
  - *How many entities a Rule Set matches*, `source: {type: rule_set, ref: rs_x}`. The condition
    becomes a count test (more than / at least / exactly / not / fewer than / at most N). Example:
    "a Rule Set *switches ending `_privacy` that are on* has more than 0 matches".
  - Counts are cached per state update, so many headers can share a Rule Set.
- **A rule can set the right-side text** (`set_right`, plain text or `{entity:…}` tokens). This is
  how "Active" / "All Idle" is shown. While it applies, it replaces the header's `title_right`
  template, and a set's `default:` supplies the text when no rule matches. `title_right_color` and
  `title_right_size` now also work when only rules supply the text.
- `CARD_DESIGN_SYSTEM.md`: a written exception to "always link" for card-local Frame Styles and
  Header Rule Sets.
- Test: `/shared/user/code/_tests/entity-card-header-rules.test.mjs` (13 checks; 12 fail against
  v241), now part of the publish gate. It is built from the three originals: Live TV, Camera Admin and
  Internet Connectivity.

## v2026.11.19.241

- **Text on the right of any header (EES-FEATURE-GAPS 3b).** The card title and every section
  header (Entity List, Entity Table, Embed Card, Group) take the same four settings, under *Right
  side* in each header panel:
  - `title_right` is a template with live tokens:
    - `{entity:ID}` gives the state as HA formats it, e.g. "1.84 kW".
    - `{entity:ID:attribute}` gives an attribute.
    - `{entity:ID:raw}` gives the bare state.
  - It is **hidden** while any of its entities is missing, unknown or unavailable, and comes back
    when they recover.
  - `title_right_show: false` hides it but keeps the template.
  - `title_right_color` uses the four-mode colour control; `title_right_size` is in px (default 13).
  - On the card the keys are prefixed `card_`.
- **Placement.** It sits side by side with the other right-hand items, in front of them: before
  "last changed" on the card title, before the right-hand count on a section, and first in a table's
  right zone. Each item has its own show/hide. The card pop-up's title bar shows it too. It is
  capped at half the bar's width and truncates with "…" before the title does.
- State text is inserted escaped, so it can't inject markup.
- Fixed: a colour option on a section inside a Group didn't save. The colour writer only searched
  top-level sections.
- Test: `/shared/user/code/_tests/entity-card-title-right.test.mjs` (15 checks; 14 fail against
  v240), now part of the publish gate.

## v2026.11.19.240

Options for replacing `expander-card` + `button-card` headers (EES-FEATURE-GAPS items 1, 2, 4, 5,
6, 7). All are optional and written only when set; an untouched card is unchanged. Rendered next to
the 27 originals in Home Assistant 2026.2.3: all 27 match within 1px collapsed, and 25 match
expanded.

- **Card title bar spacing:** `card_title_pad_v`, `card_title_pad_left`, `card_title_pad_right`
  (defaults 8 / 12 / 12 px) and `card_title_icon_gap` (default 8 px). In Card Header → *Title bar
  spacing*.
- **Padding inside the card frame:** `card_inner_pad_v`, `card_inner_pad_left`,
  `card_inner_pad_right`. This wraps the title bar and the body together, the way an expander-card's
  ha-card padding does. When set, the body's own small inset is dropped. In Card Layout → *Padding
  inside the frame*.
- **Chevron icon and colour:** `card_chevron_icon` (default `mdi:chevron-down`) and
  `card_chevron_color` (the four-mode colour control).
- **Embedded cards section:**
  - `clear_children: true` draws the child cards without their own background, border and shadow,
    like expander-card's `clear-children`.
  - `body_pad_v` / `body_pad_left` / `body_pad_right` inset the body.
  - `child_margin_top` puts space above each card, like expander-card's `child-margin-top`. Use it
    with `card_gap: 0`.
- **Frame Style radius per corner:** `border.radii: [tl, tr, br, bl]`, e.g. `[2, 2, 12, 12]`. An
  unticked corner stays square. In the Frame Style editor → *Different radius per corner*.
- **Fixed: a Frame Style background of *theme* left the card transparent.** It now paints HA's card
  colour. Also fixed: on a collapsible card, a frame background colour and gradient edges were both
  overridden by the stylesheet's `background` shorthand. That rule now sets only the colour, through a
  variable.
- Card-local `frame_presets` are a supported feature, not a legacy path. A pasted card can carry its
  own frames, and the test suite now checks they resolve.
- Test: `/shared/user/code/_tests/entity-card-gaps.test.mjs` (20 checks; 13 fail against v239), now
  part of the publish gate.

## v2026.10.30.239

- **Pop-up per section.** Any collapsible section with its title row shown can open as a pop-up from
  its own header instead of expanding in place. That covers Entity List, Entity Table, Embed Card and
  Group sections. Find it in the section's settings → *Open as: Pop-up (tap the header)*. This is
  for cards like a single "Open Shades" table with no card title, where the section header is the
  only bar to tap and the card-level pop-up (v237) can't reach it.
  - Same options as the card pop-up: Size (Small drops from the header and opens upward when low on
    the screen; Medium is the default; Large; Full screen), Title bar, Close after N seconds (default
    30, 0 = never), Backdrop dim / blur. Closes with the X, a tap on the backdrop, or Escape.
  - **The title bar shows the section's live header**, the same icon, colour rules and
    `{count}` template ("Open Shades - 2"), refreshed on every update.
  - Inside the pop-up the section works as it does inline: table rows, chips, embedded cards and frames
    update live. The section counts as open while its pop-up is, so embedded cards build when it
    opens.
  - Only one section pop-up is open at a time. It stays open, at the same scroll position, through a
    full redraw. A section pop-up inside a card pop-up closes on its own without closing the card.
  - *Default state* and *Keep expanded while entities are displayed* are hidden for a pop-up section
    and never open it inline.
  - The editor preview and dashboard edit mode expand the section in place, so you can still style it.
- Keys on the section, written only when used: `open_mode: popup`,
  `popup_size: small|large|full`, `popup_title: false`, `popup_auto_close`, `popup_dim`,
  `popup_blur`. Existing sections are unchanged.
- The card-level pop-up now targets only its own dialog (`dialog.ees-card-popup`), so it never
  picks up a section's.
- Test: `/shared/user/code/_tests/entity-card-section-popup.test.mjs` (16 checks under happy-dom;
  15 fail against v238), now part of the publish gate.

## v2026.10.30.238

- **The card is named "Easy Entity Styler Card (Ltek)" in Home Assistant's *Add card* picker**,
  matching its HACS name, so searching "Ltek" finds it. The description now says what the card does
  instead of repeating the name. The card type (`custom:easy-entity-styler-card`) is unchanged, so
  existing dashboards are not affected.

## v2026.10.30.237

- **A collapsible card can open as a pop-up instead of expanding.** Card Appearance → *Open as:
  Pop-up*. It's for cards near the bottom of the screen, which expand off it.
  - **Opens from:** *tapping the header* (default), or *a header icon* (default `mdi:open-in-new`)
    while tapping the header still expands in place.
  - **Size:** Small, **Medium** (default), Large, Full screen. Medium, Large and Full are centred,
    so they fit wherever the card sits. Small drops from the header at the header's width. When the
    card is in the lower half of the screen it opens upward, and it's capped to the space on that
    side, scrolling inside.
  - **Title bar** (on by default): the card title, the live count from *Count in title*, and a close
    button. With it off, a small floating close button is shown instead.
  - **Close after N seconds unused:** default 30, 0 = never. Any tap, key, scroll or input inside
    restarts the timer.
  - **Backdrop dim / blur:** default 55% (15% for Small) / 0 px.
  - Closes with the X, a tap on the backdrop, or Escape.
- **How it works:** the pop-up is a native `<dialog>` opened with `showModal()`. That puts it in the
  browser's top layer, above HA's own dialogs, the same as the Easy Thermostat Styler Card. It is a
  child of the card and holds the card's own sections. It is not a second copy of the card, so live
  updates, chip and row taps, tables, embedded cards and frames all work in it unchanged. With the
  icon trigger, the same body moves into the pop-up and back under the header on close.
- **Kept open across a redraw.** A library update or config change while the pop-up is open rebuilds
  it, reopens it, and restores its scroll position.
- **Editor preview and dashboard edit mode** show the card expanding in place, so its contents stay
  styleable. It switches back when you leave edit mode.
- With the header as the trigger there's nothing to expand, so the editor hides *Default state* and
  *Expand when section has entities*. The chevron checkbox becomes *Show the pop-up icon on the title
  row*.
- Keys (all optional, written only when used, and the pop-up ones only in pop-up mode):
  `card_open_mode: popup`, `card_popup_trigger: icon`, `card_popup_icon`,
  `card_popup_size: small|large|full`, `card_popup_title: false`, `card_popup_auto_close`,
  `card_popup_dim`, `card_popup_blur`. Existing cards are unchanged.
- Test: `/shared/user/code/_tests/entity-card-popup.test.mjs` (20 checks under happy-dom; 18 fail
  against v236), now part of the publish gate. Small's on-screen placement is not covered: the test
  DOM has no layout.

## v2026.10.01.236

Docs and examples only; the card code is unchanged from v235.

- **`examples/ees-bypass.yaml`** now uses the v233 card-level settings:
  `card_expand_when_section` (the collapsed card opens on load when anything is bypassed) and
  `card_count_section` (the title shows "Alert Bypasses - 2"), both pointing at the Active section.
- **README:** the *Example configs* table describes those two settings in the bypass row, and lists
  `open-entries-recent.yaml`, which was in `examples/` but missing from the table.

## v2026.10.01.235

- **Fixed: subtitles and open sub-panel borders now use the theme's accent colour.** v234 used the
  theme's *primary* colour (`--primary-color`) for them, the same blue as everything else. They now
  use the HA theme **accent** (`--accent-color`), falling back to the primary colour when the theme
  defines no accent. That applies to group subtitles ("Header style", "Entity count in header"…),
  the top-level group titles, and the border of an open sub-panel. The uppercase sub-panel titles,
  chevrons, slider thumbs and buttons stay on the primary colour.
- **Icon and font sizes are sliders.** Icon size, Title font size, the count's Font size, the entity
  row Icon size and Font size, and the secondary line's Font size and Indent were number boxes. Each
  is now a slider row: label, range, bold px readout. That covers the section header, group header
  and entity row panels. The readout follows the thumb as you drag, and the value is saved on
  release, as before.
- **Single-row field layout.** Style fields were a multi-column grid with small labels stacked over
  each control. Colour selects were squeezed into narrow cells, and "Card default" overflowed its
  box. Each field is now one row: the label at content width, the control beside it. Slider rows
  no longer wrap their readout onto a second line.
- `CARD_DESIGN_SYSTEM.md` §2: theme accent for subtitles, titles and open borders; primary for
  interactive chrome; sizes are sliders; single-row fields.
- `entity-card-editor-style.test.mjs` extended (10 checks).

## v2026.10.01.234

- **Editor sub-panels follow the design guide more closely.**
  - **No shaded backgrounds.** An open sub-panel (Section Header, Entity Rows, Chip Style, Frame,
    library rows…) no longer gets a tinted background. It gets a 1px border in the theme accent
    colour instead, with its content inset so nothing touches the border. Boxed sub-panels lost their
    surface fill as well.
  - **Group subtitles are real subtitles.** "Header style", "Entity count in header", "Section
    display" and the rest used to render as plain white text at body size with no separator. They
    are now accent-coloured, `--ltek-fs-group`, semibold, with a thin divider above. The first one
    in a panel has no divider, since the panel title is right above it. The per-use inline margins
    that fought this were removed. The two muted prompts ("Add a preset…", "Assign a rule set") use
    a separate muted style.
  - **Missing subtitles added:** *Header spacing* (indent + padding override, in both the section
    and group header panels). Chip Style is split into *Chip colors & size* / *Chip content* /
    *Hide the chip when the entity is* / *Layout & shape*, instead of one long run under "Chip
    style".
  - Top-level group titles now use the theme accent token (`--ltek-c-accent`) instead of HA's
    `--accent-color`, which is orange in the default theme. Every heading level is now the same
    accent.
- `CARD_DESIGN_SYSTEM.md` §2 updated to match: sub-panels carry no fill, open = accent border, every
  cluster gets a subtitle, and "accent" means `--ltek-c-accent`.
- Test: `/shared/user/code/_tests/entity-card-editor-style.test.mjs` (structural: CSS rules,
  subtitle presence, no inline overrides), now part of the publish gate. Nothing was rendered
  visually.

## v2026.10.01.233

- **Card title can show a section's live count.** Card Appearance → Card Header → *Count in title*:
  pick a section, and the title reads "Alert Bypasses - 3". It updates live, hides at zero, and takes
  its prefix, colour, size, weight and italic from that section's *Entity count in header*
  settings. It works for a section whose own title row is hidden. Before this, the count was drawn
  only in the section's own title row, so a title-less section's count appeared nowhere. Key:
  `card_count_section` (a section id).
- **Collapsible card can open when a section has entities.** Card Appearance → *Expand when section
  has entities*, below *Default state*, with two modes:
  - *On load only* (default): if the section has entities when the card loads, it starts open. A
    manual collapse after that is left alone.
  - *Keep expanded while it has entities*: also reopens on every update while the section still has
    entities.
  
  Keys: `card_expand_when_section` (a section id), `card_expand_mode: keep`. The default mode is not
  written, and an untouched config stays byte-identical.
- The section pickers list Entity List and Activity Table sections, the two types that have a count.
- Why the section-level *Keep expanded* checkbox was missing for "Active": the editor shows it (and
  *Default state*) only for a collapsible section with its title row on. A title-less section always
  renders open, so in that layout the only thing collapsing is the card. That is what the new
  card-level option covers.
- Test: `/shared/user/code/_tests/entity-card-title-count.test.mjs` (17 checks), now part of the
  publish gate.

## v2026.10.01.232

- **Fixed: dashboards using this card could freeze, especially on mobile.**
  - **Cause:** `set hass` runs on every Home Assistant state update (any entity, anywhere). Each call
    registered a new "library changed" listener with the shared Frame Style and Header Rule
    libraries, and none were ever removed. The next time a library sent an update, each listener ran
    a full card re-render, one after another. Libraries send updates when a style is saved, and very
    likely when the app reconnects, for example when the phone app comes back to the foreground.
    Measured: after 2,000 state updates one library update caused **4,000** full re-renders of the
    card (2,000 per library), and 4,000 re-renders of an open editor.
  - **Fix:** each card and editor registers one listener, reused on every update. It is removed when
    the card or editor leaves the page and added back when it returns, with one catch-up render if a
    library changed while it was away. Bursts are coalesced into one render per frame. After the same
    2,000 updates: 4 listeners in total (card + editor, two libraries each) and 1 render per library
    update. The editor's check that ignores the echo of its own save still runs on every update,
    before coalescing, so typing in a Frame Style is not interrupted.
- Checked and not a problem: no `setInterval`, no fetches or periodic requests. Every `setTimeout` is
  one-shot (the 250 ms state debounce, hold-to-act, save debounces, clipboard button labels). There
  are no resize or mutation observers and no page-wide listeners. Ordinary state updates still only
  patch values in place. Activity-table rows are bound once (`_seedBound`), and only when the table
  is replaced. There is no `this.hass = hass` anywhere in this card.
- Regression test: `/shared/user/code/_tests/entity-card-leak.test.mjs`, now part of the publish gate.

## v2026.09.30.231

- **README brought up to date:** header count badges (v224), the Visibility (shown / hidden) rule
  field (v224), the rule-set usage line and badge clean-up on delete (v228), and section exports that
  now carry their Frame Style and Header Rule entries (v229). The *Repo layout* section still
  described a versioned `easy-entity-styler-card-vN.js` and a `past/` folder; it now shows the fixed
  filename and `hacs.json`. No code changes.

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
