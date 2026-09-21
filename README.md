# Easy Entity Styler Card

A highly customizable Home Assistant Dashboard card that organizes and displays your entities cleanly while giving you full control over the look and behavior of your entity cards. Bonus: far easier and far better performance than card-mod.

* **Hundreds of styling options** — card-wide, per section, and per entity
* **Reusable rule sets, shared style libraries, and rich entity tables**
* **Everything in a visual editor** — YAML optional, never required

https://github.com/Ltek/easy-entity-styler-card

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Ltek&repository=easy-entity-styler-card&category=dashboard)

Current build: **v2026.09.20.227** · full history in [CHANGELOG.md](CHANGELOG.md)

---

## What's new (2026-09-20)

- **Group sections** — a new **Group** section that acts as a **container**: put other sections inside it and they collapse together under one header and one frame. Add one with the **Group** button, then add member sections to it or move existing sections in/out — members are listed indented under the group in the editor. **Use Header From** mirrors a member's header as the group's own — including a table's live count and per-domain badges — so a group can show a rich summary header while its own table body lives inside (the member's own header is hidden so it isn't shown twice). A group is a real section with its own frame, visibility rules and collapse state; collapsing it hides everything inside, and an embedded card nested in a collapsed group still defers its build until the group is opened. A **Member gap** slider sets the space between its members.
- **Divider spacing** — a divider now has independent **Space above** and **Space below** sliders (default 8px each, so existing dividers are unchanged) — take them to 0 for a divider that hugs its neighbors.
- **Count badge spacing** — each header count badge has a **Space before badge** setting, so you can spread the per-domain badges apart.
- **Editor tidy-up** — the *Entity Group* section is now called **Entity List** (which is what it is). *Section Layout Defaults* is renamed **Global Settings** and the **Global Entity Name Cleaner** moved inside it, so all card-wide settings live in one place. Redundant descriptions on that panel were trimmed — each sub-panel now explains only itself. No card output changed.
- **Header count badges** — a section's header can now show one or more **icon + live count** badges that hide themselves when their count is 0. Each badge counts a **Rule Set** (independent of the section's own rows) or reads a number straight off an entity, so a single header can break its total out by category — e.g. a window / door / lock / garage icon each with its own count, appearing only when that category is non-zero. Add them under **Section Header → Add Count Badge**; set the icon, count source, color, size and label. This replaces the hand-rolled `button-card` JavaScript templates people used for the same effect.
- **Filter by visibility (shown / hidden)** — a new **Visibility** field for rule sets, table filters and value/color rules, matching `shown` or `hidden` (an entity marked *not visible* in **Settings → Entities**). Add a rule like *Visibility ≠ hidden* to drop hidden entities from a section — useful when two entities share a device class and name (e.g. a raw sensor and a hidden mirror of it) and only the visible one should list. Because it's a normal filter field, it applies to the header count badges too, so the counts stay in sync with the rows.

---

## What's new (2026-09-19)

- **Put other cards inside a section** — a new section type, **Other Cards**, holds any Home Assistant cards you like (a graph, a thermostat, a media player, a custom card) and renders them inside this card's collapsible section, with its header and its frame. They behave exactly as they would on a dashboard: fully interactive, updating live, and a collapsed section doesn't build its cards at all until you open it, so a heavy graph or camera costs nothing while closed. Each card's own options are edited as YAML right in the section — paste it straight from the card's **Show code editor** on any dashboard — because those options belong to that card, not to this one. Reorder, duplicate or remove any of them, and set the gap between them. A card with a broken config says so in place instead of taking the whole card down with it.
- **Section header padding is now adjustable** — the space above and below a section's title text was fixed at 8px and the *only* way to shrink it was the overall **Scale** slider, which also shrinks your text. Set it card-wide under **Section Header Defaults → Header padding**, or override it on any individual section in its own **Section Header** settings. Combined with **Card Padding** you can now take a collapsed section from 16px of space above its title down to none at all. Defaults are unchanged, so existing cards render exactly as before.
- **Fixed: extra blank space above a card with no title bar.** A card with both its title text and title icon hidden was still reserving room for the title row that never rendered — 8px of padding stacked on the card's own 8px, which on a collapsed single-section card was most of the gap you saw above it. The space is simply gone; a card that *does* show a title is unchanged.
- **Card Padding** — two new sliders under **Spacing & Scaling** set the space around the **outside** edge of the card (top/bottom and left/right), so you can sit a card tight against its neighbors. It deliberately doesn't touch anything inside, so your section headers, rows and tables keep their spacing — unlike the overall **Scale** slider, which shrinks the text too. **Reset card padding to default** restores the original 8px. Untouched cards render exactly as before.
- **Hide the whole card when it has nothing to show** — a new checkbox under **Conditional Visibility**. Previously *hide when empty* was only a per-**section** setting: the section vanished, but the card itself stayed on the dashboard as an empty box taking up a grid slot — most obvious on a card with no title bar and one section, which looked completely blank. Tick the new card-level box and the card removes itself entirely (no blank space) once every section set to *hide when empty* has come up empty, then reappears the moment an entity matches again. Off by default, so nothing changes unless you turn it on; a section left on **always show** keeps the card visible, since it still draws its header. Always shown while editing.
- **Fixed: two cards on one dashboard no longer style each other.** A card's **title font weight, size, color and icon size** (and its row, chip and spacing defaults) could be silently replaced by those of *another* EES card on the same dashboard — whichever one happened to render last won for every card. It looked correct while editing, because the config dialog's preview renders last, and then changed the moment you saved. Each card now carries its own values privately, so a card only ever shows its own styling no matter how many are on the page. Nothing to change in your config; a lone card looks exactly as it did.
- **Clearer "defaults" wording in the editor** — **Section Layout Defaults** now spells out that its two panels behave differently: **Entity Group Row Defaults** apply *live* to existing group sections, while **Entity Table Defaults** are only a starting point copied into **newly added** tables and never restyle a table you already have. The header hint inside a table now says "this table", and the one under the defaults says "newly added" — no behavior changed, only the help text.
- **Unified column-header styling** — **color, size, weight and italic** now all exist at *both* levels and work the same way: set the look once for the whole table in **Table Styles**, and override any of the four on an individual column in **Columns → Layout & header**. Previously size was table-only and weight/italic didn't exist at all. A column left alone follows the table; a column's italic can be explicitly turned *off* to override a table that's italic.
- **Every color option offers a theme color** — each color control is now a mode picker plus a value field: **Default** (inherit), **Theme color** (pick from your theme's Primary / Accent / text / State active / Error / Warning / Success / Info variables, so the color follows your theme), **Custom color** (the native swatch), or **Custom CSS…** (any CSS color, e.g. `tomato`). This replaces the bare text box that color rules used — a theme color no longer has to be typed as `var(--primary-color)` from memory. A color you'd already typed by hand is kept as-is under **Custom CSS…**.
- **Fixed:** a theme-colored drop shadow rendered black; the divider's **Theme** text/icon mode was locked to one variable instead of letting you choose.
- **Never list unavailable / unknown entities** — two checkboxes per section (**Row Limits** on Entity Tables, **Never list an entity** on Entity Groups). The row is dropped before the row cap and the recency window, so a dead entity can't take a slot from a live one.
- **Replace a zero value** — a value column can show **Leave blank** or **custom text** (e.g. "Closed") when its value is 0, instead of printing `0`. Color rules still see the real 0, so your rule colors don't change.
- **Icon Rules** — an icon column's rules now pick from a short list instead of a raw token field: **This icon…** (a named MDI glyph, with a live preview), **Entity's own icon**, or **No icon (hidden)**.
- **Row Limits** — a new per-section panel with **Maximum rows** and **Only include recent rows** (a number plus **minutes / hours / days**). Rows that are currently active always show.
- **Duplicate column** — copy any Entity Table column, with all of its rules, via the copy icon in its header.
- **Rules can test an attribute** — a condition can now target **an attribute** or the **entity state** directly, not just the column's own value. This is what text columns (e.g. a clock or "last changed" column) need in order to be colored by a number like `current_position`.
- **Unset colors look unset** — a color swatch with no color set is dashed and faded instead of showing mid-grey, so a rule that changes nothing is obvious. New color rules start from a real color.
- **Fixed:** a title part's **font size** (and color, weight, italic) no longer reverted moments after being set.

---

## What's new (2026-09-07)

- **Conditional Visibility** — show the whole **card** or any individual **section** only when your rules pass (entity + operator + value, chained with AND/OR). Editor-safe: hidden cards/sections stay visible while editing or previewing the dashboard.
- **Copy sections between cards** — export any section (with its referenced rule sets) as JSON and import it into another card.

---

## What's new (2026-08-31)

- **Per-location Frame Style condition override** — a card/section can override an applied conditional Frame Style's condition (entity + operator + value) without changing the shared library style.
- **Auto-migrate local Frame Styles** — any leftover card-local frame presets are published to the shared System library on edit (collision-safe, one-time).
- **Library UI refresh** — Frame Styles, Header Rules, and Entity Filter Rules now use a cleaner flat list (two-line rows, muted subtitle, lock icon on Built-In, theme-color accent when expanded).
- **Section Layout & Config polish** — even row height/spacing, accent icons, and lighter labels.
- **Fixes** — Frame Style live preview now updates on slider/color edits.

---

## Options at a glance

Every option below is fully point-and-click in the visual editor.

### Sections & layout
- **Collapsible sections and card** — sections expand/collapse individually; the whole card can collapse to just its title bar (or run with no title bar); sections can auto-stay-open when they hold entities.
- **Five section types** — an **Entity List** (rows and/or chips), an **Entity Table** (rich multi-column table), a standalone **Divider** (a styled line with an optional label and icon — thickness, length, dashed/dotted, gradient or center-fade, text above / on / below the line, independent top/bottom spacing), an **Embed Card** section (any Home Assistant cards, see below), and a **Group** (a container that nests other sections).
- **Group** — a container section: put other sections inside it and they collapse together under one header and one frame. **Use Header From** mirrors a member's header (including a table's live count + per-domain badges) as the group's own. A group has its own frame, visibility rules and collapse state; a collapsed group defers building any embedded cards inside it.
- **Embed Card** — embed any Home Assistant cards inside a section, so they collapse with it, sit inside its frame, and follow its conditional visibility. Each stays fully interactive and live, and a collapsed section builds nothing until it's opened. Edit a child's own options as YAML (paste it from that card's **Show code editor**), reorder / duplicate / remove them, and set the gap between them. A child with a bad config shows an inline error rather than breaking the card.
- **Conditional visibility** — show the whole card, a section, or an entity only when your rules pass (entity + operator + value, chained AND/OR); auto-hide a section when it has nothing to show, and optionally auto-hide the **whole card** once every such section is empty (no leftover empty box in the grid). Hidden cards/sections still appear while editing the dashboard.
- **Copy sections between cards** — export a section (with its rule sets) as JSON and import it elsewhere. On import the card tells you up front which referenced **Frame Styles** or **Header Rule Sets** don't exist on this system, so a silent fallback never surprises you.

### Entity selection
- **Rules engine** — build named, reusable rule sets with point-and-click include/exclude groups (match ALL or ANY); match on id, name, state, attribute, domain, area, label, group helper, integration, or device class, with operators like equals / contains / in / regex / numeric compare. Live dropdowns pull real values from your system.
- **Static & dynamic lists** — populate a section automatically from a rule set (dynamic re-evaluates live; static is a hand-curatable snapshot). Preview resolved entities before assigning.

### Entity tables
- Multi-column tables from your entities or from a sensor's array attribute (one row per element).
- Columns for icon, name, value, "last changed" age, change clock time, or any attribute — plus the entity's **name**, **entity id**, or **area**; flexible widths (px / % / fr / auto). **Duplicate** a column (with all its rules) in one click.
- **Pull in a matched entity's value** — a column can show a value from a *different* entity paired to the row, found either on the **same device** by device class (a temperature row also showing its humidity sensor) or by **find/replace on the entity id** (`_temperature` → `_humidity`). The editor previews the match it resolves for a real row before you commit.
- **Value transforms** per column — ÷255 → %, ×100, round, integer, lowercase, timestamp → time / date, seconds → duration.
- Rule-based color coding, state/time-based icon rules, rule-based sorting with pin-to-top, templated title row, and global table defaults.
- **Header styling, two levels** — the per-table **Table Styles** panel sets header show/hide plus **color, size, weight and italic** for every column at once; any column can override the same four (plus its **alignment**) in **Layout & header**. Unset means "follow the table", so you only touch the columns that differ.
- **Entity Table Defaults vs. Table Styles** — **Entity Table Defaults** (under *Section Layout Defaults*) is the house style **copied into a new table when you add it**; changing it never restyles a table you already created. **Table Styles** inside a table is the live look of *that* table. To pull the current defaults into an existing table, press *Reset to Table Defaults* in its Table Styles panel (it overwrites that table's headers and row style). By contrast, **Entity Group Row Defaults** *do* apply live to every group section left on *Use Section Default Row Visuals*.
- **Separator rows** — insert a labeled subheader or a plain spacer above all rows, between the pinned block and the rest, or below all, each with its own text color, background, weight, italic, size, height, and spacing.
- **Title row count** — the count chip can show *all rows* or only the **entities matching a condition** you set.
- **Icon rules** pick per state between a named MDI glyph, the entity's own icon, or no icon at all.
- **Row limits** — cap the number of rows, and/or list only rows that changed within a window you set in minutes / hours / days (currently-active rows always show).
- **Value substitutions** — per column, choose what shows when there's **no value** (missing attribute / unavailable / unknown) and, separately, when the value is **zero** (leave blank, or your own text). Color rules still see the real value.
- **Never list** an entity whose state is unavailable or unknown — dropped before the row cap, so a dead entity can't take a live one's slot.

### Appearance & styling
- **Colors, fonts & scaling** — global palette plus independent scale sliders (overall, icons, title icon/text, entity text); per-section header/row/chip styling; a secondary info line under entity names.
- **Card padding** — set the space around the outside edge of the card (vertical and horizontal) independently of its contents, to tune how tightly it sits against neighboring cards without shrinking any text.
- **Section header padding** — set the height of the section title band (the space above and below the title text) card-wide, and override it per section. Independent of the **Scale** slider, so tightening the header never shrinks your text.
- **Chips** — compact, colorful chips in wrap / column / grid layouts, with separate tap and hold actions.
- **Color blender** — smooth value-driven color gradients for any icon or text color (value → color stops, interpolated).
- **State-driven header icons** — a section or title header icon whose glyph and color change from any entity's value; pull entity values into title text with `{entity:…}` tokens.
- **Entity name cleaner** — strip repeated text (e.g. "Living Room") card-wide or per section.
- **Theme color or your own color, everywhere** — every color option is one control with four choices: **Default** (inherit), **Theme color** (a named theme variable, so the color follows your theme), **Custom color** (swatch), or **Custom CSS…** (any CSS color).
- **Native entity icons** — a section can show each entity's own HA icon, with icon rules still overriding it per state.
- **Frame Styles** and **Header Rules** — see **Libraries** below.

### Interaction
- **Native entity controls** — toggle switches, adjust sliders, and interact with entities just like standard HA cards.

---

## Libraries

Both this card and the **Color Light & Scene Manager** card share the same two style libraries, stored in Home Assistant's built-in frontend key/value store — **no add-on or custom integration required**. A style you save in one place is available to every card of either type on the instance, and edits propagate live.

- **Scope is system-wide.** Libraries are shared across all users of the instance (Dashboard editing is admin-only, so there's a single shared author). There is no per-user scope.
- **Built-In styles are read-only.** Each library ships with a set of Built-In examples you can't overwrite; **duplicate** one to create an editable copy.
- **Edit once, updates everywhere.** A card references a library entry by name; editing that entry updates every card using it, live — no reload.
- **Portable.** Any entry can be **exported** as text and **imported** on another system to share a style with someone else.

### Frame Styles
Named, reusable frame bundles — borders, glow, shadow, background, and per-side edge lines. Each style is **sparse** (it stores only the properties you set), so you can layer an ordered list on a section or the whole card and the last one wins per property. Styles can be **conditional** — applied only when an entity is in a given state, or when a section currently has / has no visible entities.

*Storage key:* `ltek_frame_library`

### Header Rules
Named, reusable, state-driven header styling. A rule set is an ordered list of rules (a condition → the outputs it sets) plus optional defaults. Outputs can set the header's **icon color, icon glyph, text color, icon size, text size,** and a **secondary text line** driven by an entity value. Outputs are sparse — anything left "Not set" defers to the card's own header look — and revert automatically when a rule stops matching. Apply a set to the card title and/or to any section.

*Storage key:* `ltek_header_library`

---

## Installation

**Via HACS (recommended)** — click the badge at the top of this page, or add
`Ltek/easy-entity-styler-card` as a custom repository with category **Dashboard**,
then install and hard-refresh.

**Manually:**

1. Create the folder `\config\www\community\easy-entity-styler-card`.
2. Download [`easy-entity-styler-card.js`](https://github.com/Ltek/easy-entity-styler-card) and place it in that folder.
3. Add it as a Dashboard resource:
   - **Settings → Dashboards → ⋮ → Resources → Add Resource**
   - URL: `/local/community/easy-entity-styler-card/easy-entity-styler-card.js`  ·  Type: **JavaScript Module**
4. Clear your browser cache and hard-refresh.

---

## Example configs

Ready-to-use card YAML you can paste straight into the Dashboard's raw editor,
in [`examples/`](examples):

| File | What it shows |
|---|---|
| [`ees-shades-table.yaml`](examples/ees-shades-table.yaml) | Entity Table: shade position, icon rules, "last changed" + clock columns, rule-based sorting and colors, zero-value blanking |
| [`ees-network-sections.yaml`](examples/ees-network-sections.yaml) | Four dynamic sections driven entirely by rule sets (router, per-device internet blocking, AdGuard) |
| [`garage-climate-card.yaml`](examples/garage-climate-card.yaml) | Climate readouts with gradient coloring, plus matched-entity columns (temperature rows pulling in their paired humidity sensors) |
| [`window-tracker-card.yaml`](examples/window-tracker-card.yaml) | Array-attribute table — one row per element of a tracker sensor's list |
| [`ees-lights-on-card.yaml`](examples/ees-lights-on-card.yaml) | **Replaces a 4-card stack + 2 template sensors** — the *Lights On* table rebuilt as one card. The Jinja include/exclude logic (RGB labels, area, name/id keywords) became a rule set, the 120-minute recency window and grey decay colors became config, and the count + empty-hiding replaced the `conditional` wrapper and its counter sensor. No `html-template-card`, `button-card`, `expander-card`, `mod-card`, or `card_mod`. |
| [`entity-button-sections.yaml`](examples/entity-button-sections.yaml) | **Replaces an `expander-card` + `button-card` + `html-template-card` stack** — the *Open Entries* summary and its recent-entries table become one native table (four rule sets union open doors / windows / garage / unlocked locks), with a live count, an "All Entries Secure" zero state, and a state-driven security/shield icon. The two interactive lock tiles keep their exact per-state lock/unlock behaviour by riding verbatim in a `type: cards` section. |
| [`ees-bypass.yaml`](examples/ees-bypass.yaml) | Active / Inactive bypass toggles as two chip-only sections, split by an `on`/`off` entity rule, each hiding when empty; conditional card glow driven by the Active section having entities |

---

## Repo layout

```
easy-entity-styler-card-vN.js   the card (highest N is current)
past/                           previous versions
examples/                       copy-paste card YAML
README.md                       this file
CHANGELOG.md                    version history
ACTIVITY_TABLE_DESIGN.md        Entity Table subsystem design notes
```

---

## Screenshots

<!-- SCREENSHOTS:START -->
<!-- SCREENSHOTS:END -->
