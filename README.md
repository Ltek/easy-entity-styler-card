# Easy Entity Styler Card

A highly customizable Home Assistant Dashboard card that organizes and displays your entities cleanly while giving you full control over the look and behavior of your entity cards. Bonus: far easier and far better performance than card-mod.

* **Hundreds of styling options** — card-wide, per section, and per entity
* **Reusable rule sets, shared style libraries, and rich entity tables**
* **Everything in a visual editor** — YAML optional, never required

https://github.com/Ltek/easy-entity-styler-card

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Ltek&repository=easy-entity-styler-card&category=dashboard)

Current build: **v2026.10.01.236** · full history in [CHANGELOG.md](CHANGELOG.md)

---

## Options at a glance

Every option below is fully point-and-click in the visual editor.

### Sections & layout
- **Collapsible sections and card** — sections expand/collapse individually; the whole card can collapse to just its title bar (or run with no title bar); sections can auto-stay-open when they hold entities. The card itself can open when a chosen section has entities (on load only, or kept open), and its title can show that section's live count ("Alert Bypasses - 3"), which hides at zero.
- **Five section types** — an **Entity List** (rows and/or chips), an **Entity Table** (rich multi-column table), a standalone **Divider** (a styled line with an optional label and icon — thickness, length, dashed/dotted, gradient or center-fade, text above / on / below the line, independent top/bottom spacing), an **Embed Card** section (any Home Assistant cards, see below), and a **Group** (a container that nests other sections).
- **Group** — a container section: put other sections inside it and they collapse together under one header and one frame. **Use Header From** mirrors a member's header (including a table's live count + per-domain badges) as the group's own. A group has its own frame, visibility rules and collapse state; a collapsed group defers building any embedded cards inside it.
- **Embed Card** — embed any Home Assistant cards inside a section, so they collapse with it, sit inside its frame, and follow its conditional visibility. Each stays fully interactive and live, and a collapsed section builds nothing until it's opened. Edit a child's own options as YAML (paste it from that card's **Show code editor**), reorder / duplicate / remove them, and set the gap between them. A child with a bad config shows an inline error rather than breaking the card.
- **Header count badges** — a section header can show one or more **icon + live count** badges that hide at zero, each counting a rule set or reading a number off an entity (e.g. per-domain window / door / lock / garage counts), with adjustable space between badges.
- **Conditional visibility** — show the whole card, a section, or an entity only when your rules pass (entity + operator + value, chained AND/OR); auto-hide a section when it has nothing to show, and optionally auto-hide the **whole card** once every such section is empty (no leftover empty box in the grid). Hidden cards/sections still appear while editing the dashboard.
- **Copy sections between cards** — export a section as JSON and import it elsewhere. The export carries its rule sets **and the Frame Style and Header Rule entries it uses**, so it keeps its look on another system; import adds anything missing and never overwrites an entry you already have with the same name.

### Entity selection
- **Rules engine** — build named, reusable rule sets with point-and-click include/exclude groups (match ALL or ANY); match on id, name, state, attribute, domain, area, label, group helper, integration, device class, or **visibility** (whether the entity is shown or hidden in Settings → Entities), with operators like equals / contains / in / regex / numeric compare. Live dropdowns pull real values from your system.
- **Static & dynamic lists** — populate a section automatically from a rule set (dynamic re-evaluates live; static is a hand-curatable snapshot). Preview resolved entities before assigning. Each rule set shows what uses it — groups, sections and header badges — so you can see what it feeds before deleting it; deleting one also cleans up the badges that referenced it.

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
| [`ees-bypass.yaml`](examples/ees-bypass.yaml) | Active / Inactive bypass toggles as two chip-only sections, split by an `on`/`off` entity rule, each hiding when empty; conditional card glow driven by the Active section having entities; the collapsed card opens on load when anything is bypassed and its title shows the live Active count ("Alert Bypasses - 2") |
| [`open-entries-recent.yaml`](examples/open-entries-recent.yaml) | A **Group** that mirrors its table's header (`header_from`): lock tiles in a `type: cards` section, a divider, and an *Open Entries* table fed by eight rule sets (open / recently closed doors, windows, garage doors, unlocked locks) with per-domain header count badges |

---

## Repo layout

```
easy-entity-styler-card.js      the card (fixed filename; the version is inside the file)
hacs.json                       tells HACS which file to install
examples/                       copy-paste card YAML
README.md                       this file
CHANGELOG.md                    version history
ACTIVITY_TABLE_DESIGN.md        Entity Table subsystem design notes
```

---

## Screenshots

<!-- SCREENSHOTS:START -->
<table>
  <tr>
    <td align="center" valign="top">
      <img src="screenshots/editor-frame.jpg" width="100%" alt="editor frame">
    </td>
    <td align="center" valign="top">
      <img src="screenshots/editor1.jpg" width="100%" alt="editor1">
    </td>
    <td align="center" valign="top">
      <img src="screenshots/example-bypass.JPG" width="100%" alt="example bypass">
    </td>
    <td align="center" valign="top">
      <img src="screenshots/example-climate.JPG" width="100%" alt="example climate">
    </td>
  </tr>
  <tr>
    <td align="center" valign="top">
      <img src="screenshots/example-lux.JPG" width="100%" alt="example lux">
    </td>
    <td align="center" valign="top">
      <img src="screenshots/example-modes.JPG" width="100%" alt="example modes">
    </td>
    <td align="center" valign="top">
      <img src="screenshots/example-stormaudio.jpg" width="100%" alt="example stormaudio">
    </td>
    <td align="center" valign="top">
      <img src="screenshots/example-styles.jpg" width="100%" alt="example styles">
    </td>
  </tr>
</table>
<!-- SCREENSHOTS:END -->
