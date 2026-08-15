# Easy Entity Styler Card

A highly customizable dashboard card that organizes and displays your entities in a clean way while giving you full control over the look and behavior of your entity cards. Bonus: 1000x easier and better performance than card-mod.

* **Over 98 global card styling options**
* **Over 115 styling options per entity**
* **Over 162 options per card section**

... all in a super easy to use Visual Editor

https://github.com/Ltek/easy-entity-styler-card

### ✨ Features

* **Collapsible card and Group entities into collapsible sections** – Organize your entities with sections that can be individually expanded or collapsed. Collapse the entire card down to just the title bar if you choose, or have no title bar at all and it is still collapsible. Optionally **keep a section expanded** whenever it has entities to show.
* **Conditional Entity Display Rules** – Per section, show each entity only when it passes your rules (its value *is* / *is not* equal to a static value or another entity's value), chained with AND / OR and evaluated live.
* **Section display conditions** – Automatically hide an entire section (header included) when its rules leave it with no entities to show.
* **Entity count in the header** – Show a live count next to the section title or on the far right, with full color / size / weight styling.
* **Powerful filtering system** – populate section selectors using:
  * Text matching (entity ID, integration platform, or device name)
  * Entity Labels
  * Group helpers
* **Full visual editor** – Everything is configurable through the visual editor – no YAML required unless you prefer it. Includes **per-group Reset buttons** to revert any style group to defaults, and clear inherit-vs-custom color toggles.
* **Chips** – Fully customizable: colorful, compact chips for instant readability. Wrap, column, or grid layouts. Optional per Section. Configure separate **tap and hold actions** (more-info, toggle, navigate, URL, or call-service).
* **Native entity controls** – Toggle switches, adjust sliders, and interact with entities just like standard HA cards. Or use Chips for a more compact display.
* **Styling - Card level, Global defaults, and Custom per-Section** – Settings at Global Level (set all at once, the same) with each section having 'Custom' individual setting overrides: colors, borders, glow, shadows, and fonts, etc. Separate 'Card Wrapper' (the overall card) for all settings.
* **Glow effect rules** – Global for card and/or Sections, including glow **when a chosen section has (or has no) displayed entities**.
* **Entity name stripping** – Remove redundant text (e.g., "Living Room") from all displayed names.

### 🚀 Installation

1. Create the folder `\config\www\community\easy-entity-styler-card`
2. Download [`easy-entity-styler-card.js`](https://github.com/Ltek/seed-card/blob/main/easy-entity-styler-card.js) and place it in that folder.
3. Add as a Dashboard Resource:

   * Go to Settings > Dashboards > three-dot menu > Add Resource
   * Enter `/local/community/easy-entity-styler-card/easy-entity-styler-card.js` and select "JavaScript Module"
   * Click "Add"
4. Clear your browser cache and refresh.

### 📸 Screenshots

Example showing just a fraction of the available options...

<img alt="Bypass Card with Chips" src="https://github.com/user-attachments/assets/ea8ebc15-1edd-4240-a0c7-6a6f605e6bd7" style="width: 25%; height: auto;" />

<img alt="StormAudio remote 3 ways" src="https://github.com/user-attachments/assets/e9a50f24-b7bf-4715-95a2-0837309a585f" style="width: 50%; height: auto;" />
