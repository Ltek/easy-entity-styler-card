# Smart & Easy Entity Display (SEED) Card

A highly customizable dashboard card that organizes and displays your entities in a clean, visually appealing way. SEED Card gives you full control over the look and behavior of your entity cards.

https://github.com/Ltek/seed-card

### ✨ Features

* **Group entities into collapsible sections** – Organize your entities with sections that can be individually expanded or collapsed.
* **Powerful filtering system** – Automatically populate sections using:
  * Text matching (entity ID, integration platform, or device name)
  * Home Assistant labels
  * Group helpers
* **Chips option for status entities** – Fully customizable: colorful, compact chips for instant readability. Wrap, column, or grid layouts.
* **Full visual editor** – Everything is configurable through the visual editor – no YAML required unless you prefer it.
* **Native entity controls** – Toggle switches, adjust sliders, and interact with entities just like standard HA cards.
* **Styling: global and per-section** – Each section can have its own colors, borders, glow, shadows, and fonts.
* **Glow effects** – Sections can glow when expanded or based on custom rules.
* **Entity name stripping** – Remove redundant text (e.g., "Living Room") from all displayed names.
* **Collapsible card** – Collapse the entire card down to just the title bar.
* **Live updates** – States update without page refresh.

### 🚀 Installation

1. Create the folder `\config\www\community\seed-card`
2. Download [`seed-card.js`](https://github.com/Ltek/seed-card/blob/main/seed-card.js) and place it in that folder.
3. Add as a Dashboard Resource:
  * Go to Settings > Dashboards > three-dot menu > Add Resource
  * Enter `/local/community/seed-card/seed-card.js` and select "JavaScript Module"
  * Click "Add"
4. Clear your browser cache and refresh.

### 📸 Screenshots

Example showing just a fraction of the available options...



