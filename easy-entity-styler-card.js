// ============================================================================
// Easy Entity Styer Card for Home Assistant
// A highly customizable dashboard card that organizes and displays your
// entities in a clean way while giving you full control over the look and
// behavior of your entity cards.
//
// Over 98 global card styling options
// Over 115 styling options per entity
// Over 162 options per card section
// … all in a super easy to use Visual Editor
// ============================================================================

// Debug logging - disabled by default
let DEBUG = false;
function debugLog(...args) {
  if (DEBUG) console.log('[easy-entity-styler-card]', ...args);
}

const BUILD_NUMBER = 'v2026.08.11.40';

const AUDIO_CHIP_KEYWORDS = [
  'audio_format', 'audio_codec', 'surround_mode', 'stormxt',
  'audio_channel', 'sample_rate', 'input_format', 'bitstream'
];

const VIDEO_CHIP_KEYWORDS = [
  'video_format', 'video_resolution', 'resolution', 'hdr',
  'refresh_rate', 'aspect_ratio', 'video_encoding', 'video_source',
  'colorspace', 'color_space'
];

const DOMAIN_ICONS = {
  switch: 'mdi:toggle-switch-outline',
  input_boolean: 'mdi:toggle-switch-outline',
  binary_sensor: 'mdi:checkbox-marked-circle-outline',
  number: 'mdi:tune-variant',
  select: 'mdi:format-list-bulleted',
  sensor: 'mdi:information-outline',
  media_player: 'mdi:speaker',
  button: 'mdi:gesture-tap-button'
};

function uid() {
  return 'sec_' + Math.random().toString(36).slice(2, 10);
}

function classifyChip(entityId) {
  const id = entityId.toLowerCase();
  if (AUDIO_CHIP_KEYWORDS.some(k => id.includes(k))) return 'audio';
  if (VIDEO_CHIP_KEYWORDS.some(k => id.includes(k))) return 'video';
  return null;
}

function domainOf(entityId) {
  return entityId.split('.')[0];
}

// Format a Date as a short relative time string, e.g. "30 mins ago".
function formatRelativeTime(date) {
  if (!date) return '';
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
}

// Strip user-configured substrings out of a friendly name (e.g. remove
// redundant "StormAudio ISP" prefixes/suffixes from every entity name shown
// on the card). Shared by the card renderer and the editor's live preview.
function stripEntityName(name, stripStrings) {
  if (!name || !Array.isArray(stripStrings) || !stripStrings.length) return name;
  let result = name;
  stripStrings.forEach(s => {
    if (!s) return;
    result = result.split(s).join('');
  });
  return result.replace(/\s{2,}/g, ' ').trim();
}

// Shared by SEEDCard._isSeedEntity and SEEDCardEditor's
// candidate-entity list, so both filter logic paths stay identical.
// filter_type: 'text' (default) matches entity_id / integration platform /
// device name-manufacturer-model against entity_filter. 'label' matches
// entities carrying a given HA label (by id or name). 'group' matches
// entities listed as members of a given group.* entity.
function normalizeFilterTypes(config) {
  let types = config.entity_filter_types;
  if (!Array.isArray(types) || !types.length) {
    // Migrate the old single entity_filter_type string, or default to text.
    types = config.entity_filter_type ? [config.entity_filter_type] : ['text'];
  }
  return types.filter(t => ['text', 'label', 'group'].includes(t));
}

// Multiple text filters can be captured (each becomes a chip in the editor).
// Migrates the old single entity_filter string field.
function normalizeEntityFilterTexts(config) {
  if (Array.isArray(config.entity_filter_texts)) {
    return config.entity_filter_texts.filter(Boolean);
  }
  if (config.entity_filter) return [config.entity_filter];
  return [];
}

// Multiple groups can be captured (each becomes a chip in the editor).
// Migrates the old single entity_filter_group string field.
function normalizeEntityFilterGroups(config) {
  if (Array.isArray(config.entity_filter_groups)) {
    return config.entity_filter_groups.filter(Boolean);
  }
  if (config.entity_filter_group) return [config.entity_filter_group];
  return [];
}

// Multiple labels can be captured as filter criteria (each becomes a chip in
// the editor). Migrates the old single entity_filter_label string field.
function normalizeEntityFilterLabels(config) {
  if (Array.isArray(config.entity_filter_labels)) {
    return config.entity_filter_labels.filter(Boolean);
  }
  if (config.entity_filter_label) return [config.entity_filter_label];
  return [];
}

function isSeedEntity(entityId, config, hass) {
  const types = normalizeFilterTypes(config);
  if (!types.length) return true;

  if (types.includes('text')) {
    const textFilters = normalizeEntityFilterTexts(config)
      .map(t => (t || '').trim().toLowerCase())
      .filter(Boolean);
    if (!textFilters.length) {
      // No text filters configured - only counts as a match if it's the
      // only enabled type (mirrors the original "empty filter = match
      // everything" behavior); otherwise defer to the other enabled types.
      if (types.length === 1) return true;
    } else {
      const idLower = entityId.toLowerCase();
      const reg = hass.entities && hass.entities[entityId];
      const platform = reg && reg.platform ? reg.platform.toLowerCase() : '';
      let deviceFields = '';
      if (reg && reg.device_id && hass.devices) {
        const device = hass.devices[reg.device_id];
        if (device) {
          deviceFields = [device.manufacturer, device.name, device.model].filter(Boolean).join(' ').toLowerCase();
        }
      }
      const matched = textFilters.some(f =>
        idLower.includes(f) || (platform && platform.includes(f)) || (deviceFields && deviceFields.includes(f))
      );
      if (matched) return true;
    }
  }

  if (types.includes('label')) {
    const labelFilters = normalizeEntityFilterLabels(config)
      .map(l => (l || '').trim().toLowerCase())
      .filter(Boolean);
    if (labelFilters.length) {
      const reg = hass.entities && hass.entities[entityId];
      const labelIds = reg && Array.isArray(reg.labels) ? reg.labels : [];
      const idsLower = labelIds.map(id => (id || '').toLowerCase());
      if (labelFilters.some(lf => idsLower.includes(lf))) return true;
      if (hass.labels) {
        const namesLower = labelIds
          .map(id => hass.labels[id] && hass.labels[id].name)
          .filter(Boolean)
          .map(n => n.toLowerCase());
        if (labelFilters.some(lf => namesLower.includes(lf))) return true;
      }
    }
  }

  if (types.includes('group')) {
    const groupFilters = normalizeEntityFilterGroups(config)
      .map(g => (g || '').trim())
      .filter(Boolean);
    for (const groupId of groupFilters) {
      const groupState = hass.states[groupId];
      const members = groupState && Array.isArray(groupState.attributes.entity_id) ? groupState.attributes.entity_id : [];
      if (members.includes(entityId)) return true;
    }
  }

  return false;
}

// Shared by SEEDCard.setConfig and SEEDCardEditor._normalizeConfig
// so the two never drift apart on defaults.
function normalizeSection(s) {
  return {
    id: s.id || uid(),
    name: s.name || 'Section',
    collapsible: s.collapsible !== false,
    show_title: s.show_title !== false,
    disable_glow: s.disable_glow === true,
    disable_border: s.disable_border === true,
    entities: Array.isArray(s.entities) ? [...s.entities] : [],
    type: 'entities',
    // Section header style (blank string = inherit the card's global colors)
    icon: s.icon || '',
    icon_color: s.icon_color || '',
    icon_size: s.icon_size || 20,
    title_color: s.title_color || '',
    title_font_size: s.title_font_size || 14,
    title_font_weight: s.title_font_weight || 600,
    title_font_style: s.title_font_style || 'normal',
    // Entity row style, applied to every entity rendered in this section
    entity_icon_color: s.entity_icon_color || '',
    entity_icon_size: s.entity_icon_size || 20,
    entity_text_color: s.entity_text_color || '',
    entity_font_size: s.entity_font_size || 13,
    entity_font_weight: s.entity_font_weight || 400,
    entity_font_style: s.entity_font_style || 'normal',
    // Format-chip style, per section (blank color = inherit the card's global chip colors)
    chip_bg: s.chip_bg || '',
    chip_border_color: s.chip_border_color || '',
    chip_text_color: s.chip_text_color || '',
    chip_scale: s.chip_scale || 1.0,
    chip_show_icon: s.chip_show_icon !== false,
    // 'auto' = existing audio/video keyword detection, 'entity' = the entity's
    // own icon, 'section' = this section's icon, 'none' = no icon on the chip
    chip_icon_source: s.chip_icon_source || 'auto',
    chip_show_name: s.chip_show_name === true,
    // Hide the chip entirely when the entity's state is off/unknown/unavailable
    chip_hide_when_off: s.chip_hide_when_off === true,
    // Layout of chips within a "Chips Only" section: wrap (flex row, wraps),
    // column (one per line), or grid (fixed-width grid columns)
    chip_layout: s.chip_layout || 'wrap',
    // Shape: pill (fully rounded), rounded (uses chip_radius), square (0 radius)
    chip_shape: s.chip_shape || 'pill',
    chip_radius: s.chip_radius ?? 8,
    // When true, every entity in this section renders as a chip only - no
    // row icon, no row name, chips laid out per chip_layout
    chips_only: s.chips_only === true,

    // Section background override. 'global' inherits the top-level default
    // section background color; 'custom' uses bg_color; 'none' forces
    // transparent regardless of the global default.
    bg_mode: s.bg_mode || 'global',
    bg_color: s.bg_color || '',

    // Section drop-shadow override. This is a plain elevation-style shadow
    // (fixed, not tied to open/close state or an entity), separate from the
    // colored Glow effect above. Same 'global' / 'none' / 'custom' pattern.
    shadow_mode: s.shadow_mode || 'global',
    shadow_color: s.shadow_color || '',
    shadow_x: s.shadow_x ?? 0,
    shadow_y: s.shadow_y ?? 4,
    shadow_blur: s.shadow_blur ?? 12,
    shadow_spread: s.shadow_spread ?? 0,
    shadow_opacity: s.shadow_opacity ?? 0.35,

    // Section border override. 'global' inherits the top-level Section
    // Borders settings; 'none' forces no border; 'custom' uses the fields
    // below. (Migrates the old disable_border boolean automatically.)
    border_mode: s.border_mode || (s.disable_border ? 'none' : 'global'),
    border_width: s.border_width ?? 1,
    border_radius: s.border_radius ?? 12,
    border_top: s.border_top !== false,
    border_bottom: s.border_bottom !== false,
    border_left: s.border_left !== false,
    border_right: s.border_right !== false,
    border_corners: Array.isArray(s.border_corners) ? s.border_corners : [true, true, true, true],
    border_color: s.border_color || '',

    // Section glow override. Same 'global' / 'none' / 'custom' pattern.
    // (Migrates the old disable_glow boolean automatically.)
    glow_mode: s.glow_mode || (s.disable_glow ? 'none' : 'global'),
    glow_color: s.glow_color || '',
    glow_condition: s.glow_condition || 'always',
    glow_borders_only: s.glow_borders_only !== false,
    glow_intensity: s.glow_intensity ?? 1.0,

    // Section divider override. 'global' inherits the top-level Section
    // Dividers settings; 'custom' draws this section's own above/below
    // lines instead (full width, no the global "% length" centering).
    divider_mode: s.divider_mode || 'global',
    divider_above: s.divider_above === true,
    divider_above_width: s.divider_above_width ?? 1,
    divider_above_length: s.divider_above_length ?? 100,
    divider_below: s.divider_below === true,
    divider_below_width: s.divider_below_width ?? 1,
    divider_below_length: s.divider_below_length ?? 100,
    divider_color: s.divider_color || '',

    // Child Row Visuals override (row border + row indent), same pattern.
    row_visuals_mode: s.row_visuals_mode || 'global',
    row_indent: s.row_indent ?? 16,
    row_border_enabled: s.row_border_enabled === true,
    row_border_width: s.row_border_width ?? 1,
    row_border_radius: s.row_border_radius ?? 4,
    row_border_top: s.row_border_top !== false,
    row_border_bottom: s.row_border_bottom !== false,
    row_border_left: s.row_border_left !== false,
    row_border_right: s.row_border_right !== false,
    row_border_corners: Array.isArray(s.row_border_corners) ? s.row_border_corners : [true, true, true, true],
    row_border_color: s.row_border_color || ''
  };
}

// ---------------------------------------------------------------------------
// Minimal YAML serializer for the config preview
// ---------------------------------------------------------------------------
function yamlScalar(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  const s = String(v);
  if (s === '') return "''";
  if (
    /[:#&*!|>'"%@`{}\[\],]/.test(s) ||
    /^[\s\-?]/.test(s) ||
    /\s$/.test(s) ||
    /^(true|false|null|yes|no|on|off)$/i.test(s) ||
    /^[\d.+-]/.test(s)
  ) {
    return "'" + s.replace(/'/g, "''") + "'";
  }
  return s;
}

function toYaml(value, indent = 0) {
  const pad = '  '.repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return pad + '[]';
    return value
      .map(item => {
        if (item !== null && typeof item === 'object') {
          const inner = toYaml(item, indent + 1);
          const lines = inner.split('\n');
          const first = lines[0].replace(/^\s+/, '');
          const rest = lines.slice(1).join('\n');
          return pad + '- ' + first + (rest ? '\n' + rest : '');
        }
        return pad + '- ' + yamlScalar(item);
      })
      .join('\n');
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return pad + '{}';
    return keys
      .map(k => {
        const v = value[k];
        if (v !== null && typeof v === 'object') {
          if (
            (Array.isArray(v) && v.length === 0) ||
            (!Array.isArray(v) && Object.keys(v).length === 0)
          ) {
            return pad + k + ': ' + (Array.isArray(v) ? '[]' : '{}');
          }
          return pad + k + ':\n' + toYaml(v, indent + 1);
        }
        return pad + k + ': ' + yamlScalar(v);
      })
      .join('\n');
  }
  return pad + yamlScalar(value);
}

// ============================================================================
// Main SEED Card
// ============================================================================

class SEEDCard extends HTMLElement {
  static getStubConfig() {
    return {
      title: 'SEED',
      entity_filter_texts: ['storm'],
      entity_filter_types: ['text'],
      entity_filter_labels: [],
      entity_filter_groups: [],
      sections: [
        { id: uid(), name: 'Status', collapsible: true, entities: [], type: 'entities' },
        { id: uid(), name: 'Audio / Video Format', collapsible: true, entities: [], type: 'entities' },
        { id: uid(), name: 'Controls', collapsible: false, entities: [], type: 'entities' }
      ].map(normalizeSection),
      colors: {
        border: '#2196F3',
        glow: '#2196F3',
        icon: '#2196F3',
        text: '#e1e1e1',
        secondary_text: '#808080',
        chip_bg: 'rgba(33, 150, 243, 0.14)',
        chip_border: '#2196F3',
        chip_text: '#64b5f6',
        badge_on: '#4CAF50',
        badge_off: '#555555',
        row_border: '#333333',
        section_divider: '#333333',
        card_border: '#2196F3',
        card_glow: '#2196F3'
      },
      scale: 1.0,
      icon_scale: 1.0,
      title_icon_scale: 1.0,
      title_text_scale: 1.0,
      entity_text_scale: 1.0,
      // Global default section background (blank = transparent). Individual
      // sections can override via bg_mode: 'custom' / 'none'.
      section_bg_color: '',
      // Global default section drop-shadow (a plain elevation shadow,
      // separate from the colored Glow effect). Off by default. Individual
      // sections can override via shadow_mode: 'custom' / 'none'.
      section_shadow_enabled: false,
      section_shadow_color: '#000000',
      section_shadow_x: 0,
      section_shadow_y: 4,
      section_shadow_blur: 12,
      section_shadow_spread: 0,
      section_shadow_opacity: 0.35,
      // Main card wrapper background (blank = transparent) and drop-shadow.
      card_bg_color: '',
      card_shadow_enabled: false,
      card_shadow_color: '#000000',
      card_shadow_x: 0,
      card_shadow_y: 4,
      card_shadow_blur: 16,
      card_shadow_spread: 0,
      card_shadow_opacity: 0.35,
      // Card-level title bar styling (independent of per-section title styling)
      // Title text and icon can be independently shown/hidden.
      show_title: true,
      show_title_icon: true,
      title_icon: 'mdi:surround-sound',
      title_icon_color: '#2196F3',
      title_text_color: '#e1e1e1',
      title_font_size: 16,
      title_font_weight: 700,
      title_font_style: 'normal',
      title_icon_size: 22,
      show_section_count: true,
      auto_close_sections: false,
      // Indent of the entity rows relative to the section title row
      row_indent: 16,
      // Section (group) border visuals
      show_section_border: true,
      section_border_width: 1,
      section_border_radius: 12,
      section_border_top: true,
      section_border_bottom: true,
      section_border_left: true,
      section_border_right: true,
      section_border_corners: [true, true, true, true],
      glow_condition: 'always',
      slider_max_width: 240,
      glow_borders_only: true,
      glow_intensity: 1.0,
      // Divider line drawn between consecutive sections
      show_section_divider: false,
      section_divider_width: 1,
      section_divider_length: 100,
      show_section_divider_bottom: false,
      section_divider_bottom_width: 1,
      section_divider_bottom_length: 100,
      // Child row border visuals
      show_row_border: false,
      row_border_width: 1,
      row_border_radius: 4,
      row_border_top: true,
      row_border_bottom: true,
      row_border_left: true,
      row_border_right: true,
      row_border_corners: [true, true, true, true],
      row_first_border_top: true,
      row_last_border_bottom: true,
      // Substrings to strip out of every entity's displayed name
      strip_entity_strings: [],
      // Whole-card collapsible wrapper (title bar always visible; body toggles)
      card_collapsible: false,
      show_card_chevron: true,
      card_border_enabled: false,
      card_border_width: 1,
      card_border_radius: 12,
      card_border_top: true,
      card_border_bottom: true,
      card_border_left: true,
      card_border_right: true,
      card_border_corners: [true, true, true, true],
      card_glow_condition: 'never',
      card_glow_entity: '',
      card_glow_intensity: 1.0,
      card_glow_borders_only: true,
      // Show relative "last changed" time next to the title
      show_last_changed: false,
      // Gray out icons for entities that are off/unavailable
      gray_icons_when_off: false
    };
  }

  constructor() {
    super();
    this._config = null;
    this._hass = null;
    this._rendered = false;
  }

  setConfig(config) {
    if (!config) throw new Error('Invalid configuration');
    const stub = SEEDCard.getStubConfig();
    const merged = {
      ...stub,
      ...config,
      colors: { ...stub.colors, ...(config.colors || {}) },
      entity_filter_texts: normalizeEntityFilterTexts(config),
      entity_filter_labels: normalizeEntityFilterLabels(config),
      entity_filter_groups: normalizeEntityFilterGroups(config),
      sections: Array.isArray(config.sections)
        ? config.sections.map(normalizeSection)
        : stub.sections
    };
    this._config = merged;
    DEBUG = !!merged.debug;
    if (this._hass) {
      this.renderCard();
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;

    // Only do a full DOM rebuild once. Every hass update after that just
    // patches values in place via updateStates() - a full rebuild here was
    // the cause of open sections collapsing / scroll resetting on every
    // state change (e.g. right after toggling a switch).
    if (!this._rendered) {
      this.renderCard();
      this._rendered = true;
      return;
    }

    this.updateStates();
  }

  getCardSize() {
    const base = (this._config?.sections || []).length;
    return base * 2 + 1 || 3;
  }

  static getConfigElement() {
    return document.createElement('easy-entity-styler-card-editor');
  }

  static getStubConfigForEditor() {
    return SEEDCard.getStubConfig();
  }

  _isSeedEntity(entityId) {
    return isSeedEntity(entityId, this._config, this._hass);
  }

  _getCandidateEntities() {
    if (!this._hass) return [];
    return Object.keys(this._hass.states)
      .filter(id => this._isSeedEntity(id))
      .sort((a, b) => {
        const nameA = this._hass.states[a].attributes.friendly_name || a;
        const nameB = this._hass.states[b].attributes.friendly_name || b;
        return nameA.localeCompare(nameB);
      });
  }

  getColors() {
    const defaults = SEEDCard.getStubConfig().colors;
    return { ...defaults, ...(this._config.colors || {}) };
  }

  _buildGlow(color, intensity = 1) {
    const blur = 12 * intensity;
    const spread = -4 * intensity;
    return `0 0 ${blur}px ${spread}px ${color}`;
  }

  // Converts a #rrggbb (or #rgb) color plus a 0-1 opacity into an rgba()
  // string, for the plain elevation drop-shadow (distinct from the glow
  // effect, which uses solid colors directly).
  _hexToRgba(hex, alpha) {
    let h = (hex || '#000000').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.substring(0, 2), 16) || 0;
    const g = parseInt(h.substring(2, 4), 16) || 0;
    const b = parseInt(h.substring(4, 6), 16) || 0;
    const a = alpha === undefined || alpha === null ? 1 : alpha;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  // Build a box-shadow value for the plain elevation drop-shadow (fixed,
  // not tied to open/close state or an entity - unlike the Glow effect).
  _buildDropShadow(color, x, y, blur, spread, opacity) {
    return `${x}px ${y}px ${blur}px ${spread}px ${this._hexToRgba(color, opacity)}`;
  }

  // Build a box-shadow value for the section glow effect. Mirrors the
  // shades-control-card implementation: bordersOnly=true only glows the
  // sides that actually have a border enabled.
  _buildGlowShadow(color, sides, bordersOnly, intensity) {
    const blur = 12 * intensity;
    const spread = -4 * intensity;
    const offset = 4 * intensity;

    if (!bordersOnly) {
      return `0 0 ${blur}px ${spread}px ${color}`;
    }
    const parts = [];
    if (sides.top) parts.push(`0 -${offset}px ${blur}px ${spread}px ${color}`);
    if (sides.bottom) parts.push(`0 ${offset}px ${blur}px ${spread}px ${color}`);
    if (sides.left) parts.push(`-${offset}px 0 ${blur}px ${spread}px ${color}`);
    if (sides.right) parts.push(`${offset}px 0 ${blur}px ${spread}px ${color}`);
    return parts.length ? parts.join(', ') : 'none';
  }

  // Recompute each section's glow based on glow_condition / open state.
  // Called after render and whenever a section is toggled.
  updateGlow() {
    if (!this._config) return;
    const colors = this.getColors();

    const globalCondition = this._config.glow_condition || 'always';
    const globalBordersOnly = this._config.glow_borders_only !== false;
    const globalIntensity = this._config.glow_intensity || 1.0;
    const globalColor = colors.glow;
    const showSectionBorder = this._config.show_section_border !== false;
    const globalSides = {
      top: showSectionBorder && this._config.section_border_top !== false,
      bottom: showSectionBorder && this._config.section_border_bottom !== false,
      left: showSectionBorder && this._config.section_border_left !== false,
      right: showSectionBorder && this._config.section_border_right !== false
    };

    // Global default drop-shadow (plain elevation shadow, separate from Glow)
    const globalShadowEnabled = this._config.section_shadow_enabled === true;
    const globalShadowColor = this._config.section_shadow_color || '#000000';
    const globalShadowX = this._config.section_shadow_x ?? 0;
    const globalShadowY = this._config.section_shadow_y ?? 4;
    const globalShadowBlur = this._config.section_shadow_blur ?? 12;
    const globalShadowSpread = this._config.section_shadow_spread ?? 0;
    const globalShadowOpacity = this._config.section_shadow_opacity ?? 0.35;

    (this._config.sections || []).forEach(section => {
      const el = this.querySelector(`.seed-section[data-section-id="${section.id}"]`);
      if (!el) return;
      const isOpen = el.tagName === 'DETAILS' ? el.open : true;
      const mode = section.glow_mode || 'global';

      // Drop-shadow resolves independently of the glow mode above, so it
      // still applies even when this section's glow is set to 'none'.
      const shadowMode = section.shadow_mode || 'global';
      let dropShadowStr = 'none';
      if (shadowMode === 'custom') {
        dropShadowStr = this._buildDropShadow(
          section.shadow_color || globalShadowColor,
          section.shadow_x ?? globalShadowX,
          section.shadow_y ?? globalShadowY,
          section.shadow_blur ?? globalShadowBlur,
          section.shadow_spread ?? globalShadowSpread,
          section.shadow_opacity ?? globalShadowOpacity
        );
      } else if (shadowMode === 'global' && globalShadowEnabled) {
        dropShadowStr = this._buildDropShadow(
          globalShadowColor, globalShadowX, globalShadowY, globalShadowBlur, globalShadowSpread, globalShadowOpacity
        );
      }

      if (mode === 'none') {
        el.style.boxShadow = dropShadowStr !== 'none' ? dropShadowStr : 'none';
        return;
      }

      let condition, bordersOnly, intensity, color, sides;
      if (mode === 'custom') {
        condition = section.glow_condition || 'always';
        bordersOnly = section.glow_borders_only !== false;
        intensity = section.glow_intensity || 1.0;
        color = section.glow_color || globalColor;
        const bMode = section.border_mode || 'global';
        sides = bMode === 'custom'
          ? { top: section.border_top !== false, bottom: section.border_bottom !== false, left: section.border_left !== false, right: section.border_right !== false }
          : bMode === 'none' ? { top: false, bottom: false, left: false, right: false } : globalSides;
      } else {
        condition = globalCondition;
        bordersOnly = globalBordersOnly;
        intensity = globalIntensity;
        color = globalColor;
        sides = globalSides;
      }

      let shouldGlow = false;
      if (condition === 'always') shouldGlow = true;
      else if (condition === 'when_expanded') shouldGlow = isOpen;

      const glowStr = shouldGlow ? this._buildGlowShadow(color, sides, bordersOnly, intensity) : 'none';
      const parts = [glowStr, dropShadowStr].filter(s => s && s !== 'none');
      el.style.boxShadow = parts.length ? parts.join(', ') : 'none';
    });
  }

  // Glow for the whole-card collapsible wrapper. Mirrors updateGlow() but
  // supports an entity-driven condition since there's only one wrapper.
  updateCardGlow() {
    if (!this._config) return;
    const wrapper = this.querySelector('.easy-entity-styler-card-wrapper');
    if (!wrapper) return;

    const condition = this._config.card_glow_condition || 'never';
    const bordersOnly = this._config.card_glow_borders_only !== false;
    const intensity = this._config.card_glow_intensity || 1.0;
    const borderEnabled = this._config.card_border_enabled === true;
    const colors = this.getColors();

    const sides = {
      top: borderEnabled && this._config.card_border_top !== false,
      bottom: borderEnabled && this._config.card_border_bottom !== false,
      left: borderEnabled && this._config.card_border_left !== false,
      right: borderEnabled && this._config.card_border_right !== false
    };

    let shouldGlow = false;
    if (condition === 'always') {
      shouldGlow = true;
    } else if (condition === 'when_entity_on') {
      const entityId = this._config.card_glow_entity;
      const st = entityId && this._hass ? this._hass.states[entityId] : null;
      shouldGlow = !!(st && st.state === 'on');
    }

    const glowStr = shouldGlow ? this._buildGlowShadow(colors.card_glow, sides, bordersOnly, intensity) : 'none';
    const dropShadowStr = this._config.card_shadow_enabled === true
      ? this._buildDropShadow(
          this._config.card_shadow_color || '#000000',
          this._config.card_shadow_x ?? 0,
          this._config.card_shadow_y ?? 4,
          this._config.card_shadow_blur ?? 16,
          this._config.card_shadow_spread ?? 0,
          this._config.card_shadow_opacity ?? 0.35
        )
      : 'none';
    const parts = [glowStr, dropShadowStr].filter(s => s && s !== 'none');
    wrapper.style.boxShadow = parts.length ? parts.join(', ') : 'none';
  }

  // Most recent last_changed timestamp across every entity configured on
  // the card, formatted as a short relative string ("30 mins ago").
  _getLastChangedText() {
    if (!this._hass || !this._config) return '';
    const sections = this._config.sections || [];
    let entityIds = [];
    sections.forEach(section => {
      if (section.type === 'entities' && Array.isArray(section.entities)) {
        entityIds = entityIds.concat(section.entities);
      }
    });
    let latest = null;
    entityIds.forEach(id => {
      const st = this._hass.states[id];
      if (!st || !st.last_changed) return;
      const t = new Date(st.last_changed);
      if (!latest || t > latest) latest = t;
    });
    return latest ? formatRelativeTime(latest) : '';
  }

  _getStateValue(entityId) {
    if (!entityId || !this._hass || !this._hass.states[entityId]) return null;
    const st = this._hass.states[entityId];
    if (!st.state || st.state === 'unknown' || st.state === 'unavailable') return null;
    return st.state;
  }

  renderCard() {
    if (!this._hass || !this._config) return;

    const colors = this.getColors();
    const scale = this._config.scale || 1.0;
    const iconScale = this._config.icon_scale || 1.0;
    const titleIconScale = this._config.title_icon_scale || 1.0;
    const titleTextScale = this._config.title_text_scale || 1.0;
    const entityTextScale = this._config.entity_text_scale || 1.0;
    const sliderMaxWidth = this._config.slider_max_width || 240;
    const showSectionCount = this._config.show_section_count !== false;
    const autoClose = this._config.auto_close_sections || false;

    // Section (group) border visuals - these are the GLOBAL defaults, used
    // as CSS var fallbacks so individual sections can override any one of
    // them (border_mode: 'custom') or drop it entirely (border_mode: 'none').
    const showSectionBorder = this._config.show_section_border !== false;
    const sectionBorderWidth = this._config.section_border_width ?? 1;
    const sectionBorderRadius = this._config.section_border_radius ?? 12;
    const sectionCorners = this._config.section_border_corners || [true, true, true, true];
    const gSecBorderTop = showSectionBorder && this._config.section_border_top !== false ? `${sectionBorderWidth}px solid ${colors.border}` : 'none';
    const gSecBorderBottom = showSectionBorder && this._config.section_border_bottom !== false ? `${sectionBorderWidth}px solid ${colors.border}` : 'none';
    const gSecBorderLeft = showSectionBorder && this._config.section_border_left !== false ? `${sectionBorderWidth}px solid ${colors.border}` : 'none';
    const gSecBorderRight = showSectionBorder && this._config.section_border_right !== false ? `${sectionBorderWidth}px solid ${colors.border}` : 'none';
    const gSecBorderRadius = `${sectionCorners[0] ? sectionBorderRadius : 0}px ${sectionCorners[1] ? sectionBorderRadius : 0}px ${sectionCorners[2] ? sectionBorderRadius : 0}px ${sectionCorners[3] ? sectionBorderRadius : 0}px`;

    // Whole-card collapsible wrapper border visuals
    const cardCollapsible = this._config.card_collapsible === true;
    const cardBorderEnabled = this._config.card_border_enabled === true;
    const cardBorderWidth = this._config.card_border_width ?? 1;
    const cardBorderRadius = this._config.card_border_radius ?? 12;
    const cardCorners = this._config.card_border_corners || [true, true, true, true];
    const cardBorderColor = colors.card_border && colors.card_border !== 'transparent' ? colors.card_border : '#2196F3';
    const cardBorderCss = cardBorderEnabled ? `
      border-top: ${this._config.card_border_top !== false ? `${cardBorderWidth}px solid ${cardBorderColor}` : 'none'};
      border-bottom: ${this._config.card_border_bottom !== false ? `${cardBorderWidth}px solid ${cardBorderColor}` : 'none'};
      border-left: ${this._config.card_border_left !== false ? `${cardBorderWidth}px solid ${cardBorderColor}` : 'none'};
      border-right: ${this._config.card_border_right !== false ? `${cardBorderWidth}px solid ${cardBorderColor}` : 'none'};
    ` : 'border: none;';
    const cardRadiusCss = `border-radius: ${cardCorners[0] ? cardBorderRadius : 0}px ${cardCorners[1] ? cardBorderRadius : 0}px ${cardCorners[2] ? cardBorderRadius : 0}px ${cardCorners[3] ? cardBorderRadius : 0}px;`;

    // Divider line drawn between consecutive sections (independent of the
    // section's own border box - this sits between two sections, not
    // around one). Top and bottom are independent so you can enable either,
    // both (giving a double-line gap), or neither.
    const showSectionDividerTop = this._config.show_section_divider === true;
    const sectionDividerTopWidth = this._config.section_divider_width ?? 1;
    const sectionDividerTopLength = this._config.section_divider_length ?? 100;
    const showSectionDividerBottom = this._config.show_section_divider_bottom === true;
    const sectionDividerBottomWidth = this._config.section_divider_bottom_width ?? 1;
    const sectionDividerBottomLength = this._config.section_divider_bottom_length ?? 100;
    const sectionDividerColor = colors.section_divider && colors.section_divider !== 'transparent' ? colors.section_divider : '#333333';
    const sectionDividerCss = [
      showSectionDividerTop
        ? `.seed-section + .seed-section { margin-top: calc(var(--seed-gap) / 2); padding-top: calc(var(--seed-gap) / 2); position: relative; }
           .seed-section + .seed-section::before {
             content: '';
             display: block;
             position: absolute;
             top: 0;
             left: 50%;
             transform: translateX(-50%);
             width: ${sectionDividerTopLength}%;
             border-top: ${sectionDividerTopWidth}px solid ${sectionDividerColor};
           }`
        : '',
      showSectionDividerBottom
        ? `.seed-section:not(:last-child) { margin-bottom: calc(var(--seed-gap) / 2); padding-bottom: calc(var(--seed-gap) / 2); position: relative; }
           .seed-section:not(:last-child)::after {
             content: '';
             display: block;
             position: absolute;
             bottom: 0;
             left: 50%;
             transform: translateX(-50%);
             width: ${sectionDividerBottomLength}%;
             border-bottom: ${sectionDividerBottomWidth}px solid ${sectionDividerColor};
           }`
        : ''
    ].join('\n');

    // Extra left indent so entity rows read as "children" of the section
    // title row rather than sitting flush with it.
    const rowIndent = this._config.row_indent ?? 16;

    // Child row border visuals - GLOBAL defaults, same var-fallback pattern
    // as the section border above.
    const showRowBorder = this._config.show_row_border === true;
    const rowBorderWidth = this._config.row_border_width ?? 1;
    const rowBorderColor = colors.row_border && colors.row_border !== 'transparent' ? colors.row_border : '#333333';
    const rowBorderRadius = this._config.row_border_radius ?? 4;
    const rowCorners = this._config.row_border_corners || [true, true, true, true];
    const rowFirstBorderTop = this._config.row_first_border_top !== false;
    const rowLastBorderBottom = this._config.row_last_border_bottom !== false;
    const gRowBorderTop = showRowBorder && this._config.row_border_top !== false ? `${rowBorderWidth}px solid ${rowBorderColor}` : 'none';
    const gRowBorderBottom = showRowBorder && this._config.row_border_bottom !== false ? `${rowBorderWidth}px solid ${rowBorderColor}` : 'none';
    const gRowBorderLeft = showRowBorder && this._config.row_border_left !== false ? `${rowBorderWidth}px solid ${rowBorderColor}` : 'none';
    const gRowBorderRight = showRowBorder && this._config.row_border_right !== false ? `${rowBorderWidth}px solid ${rowBorderColor}` : 'none';
    const gRowBorderRadius = `${rowCorners[0] ? rowBorderRadius : 0}px ${rowCorners[1] ? rowBorderRadius : 0}px ${rowCorners[2] ? rowBorderRadius : 0}px ${rowCorners[3] ? rowBorderRadius : 0}px`;
    const gRowMargin = showRowBorder ? '2px 0' : '0';
    const gRowPadX = showRowBorder ? '6px' : '0';
    const gRowFirstChild = showRowBorder ? (rowFirstBorderTop ? `${rowBorderWidth}px solid ${rowBorderColor}` : 'none') : 'none';
    const gRowLastChild = showRowBorder ? (rowLastBorderBottom ? `${rowBorderWidth}px solid ${rowBorderColor}` : 'none') : 'none';

    const styles = `
      <style>
        .seed-wrap {
          --seed-scale: ${scale};
          --seed-icon-scale: ${iconScale};
          --seed-title-icon-scale: ${titleIconScale};
          --seed-title-text-scale: ${titleTextScale};
          --seed-entity-text-scale: ${entityTextScale};
          --seed-slider-max-width: ${sliderMaxWidth}px;
          --seed-icon-size: calc(20px * var(--seed-scale) * var(--seed-icon-scale));
          --seed-name-size: calc(14px * var(--seed-scale) * var(--seed-title-text-scale));
          --seed-font-size: calc(13px * var(--seed-scale) * var(--seed-entity-text-scale));
          --seed-gap: calc(10px * var(--seed-scale));
          --seed-pad: calc(8px * var(--seed-scale));
          display: flex;
          flex-direction: column;
          gap: var(--seed-gap);
          padding: var(--seed-pad) 0;
        }
        .seed-title {
          font-size: calc(${this._config.title_font_size || 16}px * var(--seed-scale));
          font-weight: ${this._config.title_font_weight || 700};
          font-style: ${this._config.title_font_style || 'normal'};
          color: ${this._config.title_text_color || colors.text};
          padding: 0 var(--seed-pad);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .seed-title ha-icon {
          color: ${this._config.title_icon_color || colors.icon};
          --mdc-icon-size: calc(${this._config.title_icon_size || 22}px * var(--seed-scale));
        }
        .seed-title-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .seed-title-last-changed {
          font-size: calc(12px * var(--seed-scale));
          font-weight: 400;
          color: ${colors.secondary_text};
          flex-shrink: 0;
        }
        .easy-entity-styler-card-wrapper {
          ${cardBorderCss}
          ${cardRadiusCss}
          box-shadow: none;
          overflow: hidden;
          background: ${this._config.card_bg_color || 'transparent'};
        }
        details.easy-entity-styler-card-wrapper { background: ${this._config.card_bg_color || 'transparent'} !important; }
        .easy-entity-styler-card-summary {
          list-style: none;
          cursor: pointer;
          user-select: none;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: var(--seed-pad) calc(var(--seed-pad) * 1.5);
        }
        .easy-entity-styler-card-summary::-webkit-details-marker { display: none; }
        .easy-entity-styler-card-summary::marker { content: ""; }
        .easy-entity-styler-card-summary .seed-title { flex: 1; padding: 0; }
        .easy-entity-styler-card-chevron {
          transition: transform 0.25s ease;
          color: ${colors.secondary_text};
          --mdc-icon-size: calc(22px * var(--seed-scale));
          flex-shrink: 0;
        }
        details.easy-entity-styler-card-wrapper[open] > .easy-entity-styler-card-summary .easy-entity-styler-card-chevron { transform: rotate(180deg); }
        .easy-entity-styler-card-body {
          display: flex;
          flex-direction: column;
          gap: var(--seed-gap);
          padding: 0 calc(var(--seed-pad) * 0.5) calc(var(--seed-pad) * 0.5) calc(var(--seed-pad) * 0.5);
        }
        /* Non-collapsible card: no summary bar above the body, so restore the
           top padding the summary would otherwise provide, and drop the title
           row's own horizontal padding so it lines up with the sections. */
        .easy-entity-styler-card-wrapper.easy-entity-styler-card-static > .easy-entity-styler-card-body { padding-top: var(--seed-pad); }
        .easy-entity-styler-card-body > .seed-title { padding-left: calc(var(--seed-pad) * 0.5); padding-right: calc(var(--seed-pad) * 0.5); }
        .seed-section {
          border-top: var(--sec-border-top, ${gSecBorderTop});
          border-bottom: var(--sec-border-bottom, ${gSecBorderBottom});
          border-left: var(--sec-border-left, ${gSecBorderLeft});
          border-right: var(--sec-border-right, ${gSecBorderRight});
          border-radius: var(--sec-border-radius, ${gSecBorderRadius});
          box-shadow: none;
          background: var(--sec-bg, ${this._config.section_bg_color || 'transparent'});
          overflow: hidden;
        }
        details.seed-section { background: var(--sec-bg, ${this._config.section_bg_color || 'transparent'}) !important; }
        .seed-summary {
          list-style: none;
          cursor: pointer;
          user-select: none;
          display: flex;
          align-items: center;
          gap: var(--seed-gap);
          padding: var(--seed-pad) calc(var(--seed-pad) * 1.5);
        }
        .seed-summary::-webkit-details-marker { display: none; }
        .seed-summary::marker { content: ""; }
        .seed-section.non-collapsible .seed-summary { cursor: default; }
        .seed-section-icon {
          color: var(--sec-icon-color, ${colors.icon});
          --mdc-icon-size: var(--sec-icon-size, var(--seed-icon-size));
          flex-shrink: 0;
          display: flex;
          align-items: center;
          transition: transform 0.25s ease;
        }
        details.seed-section[open] > .seed-summary .seed-section-icon { transform: rotate(180deg); }
        .seed-section-name {
          flex: 1;
          font-weight: var(--sec-title-weight, 600);
          font-style: var(--sec-title-style, normal);
          font-size: var(--sec-title-size, var(--seed-name-size));
          color: var(--sec-title-color, ${colors.text});
        }
        .seed-section-count {
          font-size: calc(11px * var(--seed-scale));
          color: ${colors.secondary_text};
        }
        .seed-children {
          display: flex;
          flex-direction: column;
          padding: 0 calc(var(--seed-pad) * 1.5) var(--seed-pad) calc(var(--seed-pad) * 1.5 + var(--sec-row-indent, ${rowIndent}px));
          gap: 2px;
        }
        .seed-row {
          display: flex;
          align-items: center;
          gap: var(--seed-gap);
          padding: calc(var(--seed-pad) * 0.6) 0;
          font-size: var(--sec-entity-size, var(--seed-font-size));
          border-top: var(--sec-row-border-top, ${gRowBorderTop});
          border-bottom: var(--sec-row-border-bottom, ${gRowBorderBottom});
          border-left: var(--sec-row-border-left, ${gRowBorderLeft});
          border-right: var(--sec-row-border-right, ${gRowBorderRight});
          border-radius: var(--sec-row-border-radius, ${gRowBorderRadius});
          margin: var(--sec-row-margin, ${gRowMargin});
          padding-left: var(--sec-row-pad-x, ${gRowPadX});
          padding-right: var(--sec-row-pad-x, ${gRowPadX});
          box-sizing: border-box;
        }
        .seed-row:first-child { border-top: var(--sec-row-first-border, ${gRowFirstChild}); }
        .seed-row:last-child { border-bottom: var(--sec-row-last-border, ${gRowLastChild}); }
        ${sectionDividerCss}
        .seed-row-icon {
          --mdc-icon-size: var(--sec-entity-icon-size, var(--seed-icon-size));
          color: var(--sec-entity-icon-color, ${colors.icon});
          flex-shrink: 0;
          display: flex;
          align-items: center;
        }
        .seed-row-name {
          flex: 1;
          min-width: 0;
          font-size: var(--sec-entity-size, var(--seed-font-size));
          font-weight: var(--sec-entity-weight, 400);
          font-style: var(--sec-entity-style, normal);
          color: var(--sec-entity-text-color, ${colors.text});
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          cursor: pointer;
        }
        .seed-row-name:hover { text-decoration: underline; }
        .seed-row-value {
          font-size: var(--sec-entity-size, var(--seed-font-size));
          color: ${colors.secondary_text};
          flex-shrink: 0;
          white-space: nowrap;
        }
        .seed-badge {
          font-size: calc(var(--sec-entity-size, var(--seed-font-size)) * 0.85);
          font-weight: 700;
          padding: 2px 10px;
          border-radius: 10px;
          color: white;
          cursor: pointer;
          flex-shrink: 0;
        }
        .seed-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: calc(var(--sec-entity-size, var(--seed-font-size)) * 0.85 * var(--sec-chip-scale, 1));
          font-weight: 600;
          padding: calc(3px * var(--sec-chip-scale, 1)) calc(10px * var(--sec-chip-scale, 1));
          border-radius: var(--sec-chip-radius, 999px);
          background: var(--sec-chip-bg, ${colors.chip_bg});
          border: 1px solid var(--sec-chip-border, ${colors.chip_border});
          color: var(--sec-chip-text, ${colors.chip_text});
          flex-shrink: 0;
          cursor: pointer;
        }
        .seed-chip ha-icon {
          --mdc-icon-size: calc(var(--sec-entity-size, var(--seed-font-size)) * 1 * var(--sec-chip-scale, 1));
        }
        .seed-children.chips-only {
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }
        .seed-children.chips-only.chip-layout-column {
          flex-direction: column;
          align-items: flex-start;
        }
        .seed-children.chips-only.chip-layout-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          align-items: center;
        }
        .seed-children.chips-only.chip-layout-grid .seed-chip-only-item,
        .seed-children.chips-only.chip-layout-grid .seed-chip {
          width: 100%;
          justify-content: center;
          box-sizing: border-box;
        }
        .seed-chip-only-item { display: inline-flex; }
        .seed-empty {
          font-size: var(--seed-font-size);
          color: ${colors.secondary_text};
          font-style: italic;
          padding: calc(var(--seed-pad) * 0.6) 0;
        }
        .seed-native-toggle {
          --mdc-theme-secondary: var(--sec-entity-icon-color, ${colors.icon});
          --switch-checked-color: var(--sec-entity-icon-color, ${colors.icon});
          --switch-checked-track-color: var(--sec-entity-icon-color, ${colors.icon});
          --switch-checked-button-color: var(--sec-entity-icon-color, ${colors.icon});
          flex-shrink: 0;
        }
        .seed-slider-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          min-width: 0;
          justify-content: flex-end;
        }
        .seed-native-slider {
          -webkit-appearance: none;
          appearance: none;
          flex: 1 1 auto;
          width: 100%;
          max-width: var(--seed-slider-max-width, 240px);
          height: 4px;
          border-radius: 2px;
          outline: none;
          cursor: pointer;
          min-width: 60px;
        }
        .seed-native-slider::-webkit-slider-runnable-track {
          height: 4px;
          border-radius: 2px;
          background: transparent;
        }
        .seed-native-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--sec-entity-icon-color, ${colors.icon});
          margin-top: -6px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.4);
        }
        .seed-native-slider::-moz-range-track {
          height: 4px;
          border-radius: 2px;
          background: #444;
        }
        .seed-native-slider::-moz-range-progress {
          height: 4px;
          border-radius: 2px;
          background: var(--sec-entity-icon-color, ${colors.icon});
        }
        .seed-native-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: none;
          background: var(--sec-entity-icon-color, ${colors.icon});
          box-shadow: 0 1px 3px rgba(0,0,0,0.4);
        }
        .seed-slider-value {
          min-width: 34px;
          text-align: right;
        }
      </style>
    `;

    const container = document.createElement('div');
    container.className = 'seed-wrap';

    let html = styles;

    const lastChangedText = this._config.show_last_changed ? this._getLastChangedText() : '';
    // Title text and icon are independently show/hide-able. The title bar
    // renders if either piece is showing (or, when collapsible, so there's a
    // bar to click - handled below).
    const showTitleText = this._config.show_title !== false && !!this._config.title;
    const showTitleIcon = this._config.show_title_icon !== false && !!this._config.title_icon;
    let titleHtml = '';
    if (showTitleText || showTitleIcon) {
      titleHtml = `
        <div class="seed-title">
          ${showTitleIcon ? `<ha-icon icon="${this._config.title_icon || 'mdi:surround-sound'}"></ha-icon>` : ''}
          ${showTitleText ? `<span class="seed-title-text">${this._config.title}</span>` : ''}
          ${lastChangedText ? `<span class="seed-title-last-changed">${lastChangedText}</span>` : ''}
        </div>
      `;
    }

    let sectionsHtml = '';
    // Custom-mode section dividers need their own generated CSS rules
    // (see below) - collected here and appended after the main stylesheet.
    const customDividerCss = [];
    const sections = this._config.sections || [];
    if (sections.length === 0) {
      sectionsHtml += `<div class="seed-empty">Add sections in the card configuration</div>`;
    }

    for (const section of sections) {
      let contentHtml = '';
      let count = 0;

      {
        const visibleEntities = (section.entities || []).filter(id => {
          const st = this._hass.states[id];
          if (!st) return false;
          if (section.chip_hide_when_off) {
            const isChipRendered = section.chips_only || !!classifyChip(id);
            if (isChipRendered && (st.state === 'off' || st.state === 'unknown' || st.state === 'unavailable')) {
              return false;
            }
          }
          return true;
        });
        count = visibleEntities.length;
        contentHtml = visibleEntities.length
          ? visibleEntities.map(id => this.createRowHTML(id, section)).join('')
          : `<div class="seed-empty">No entities available</div>`;
      }

      const sectionShowTitle = section.show_title !== false;
      const collapsible = sectionShowTitle && section.collapsible !== false;
      const defaultIcon = 'mdi:folder-outline';
      const sectionIcon = section.icon || defaultIcon;

      // Per-section overrides for the top-level border/glow/row-visuals/
      // divider settings. 'global' (the default) adds nothing - the CSS
      // simply falls through to the global var() fallback already baked
      // into the stylesheet.
      const overrideVars = [];

      const bgMode = section.bg_mode || 'global';
      if (bgMode === 'none') {
        overrideVars.push('--sec-bg: transparent');
      } else if (bgMode === 'custom') {
        overrideVars.push(`--sec-bg: ${section.bg_color || this._config.section_bg_color || 'transparent'}`);
      }

      const borderMode = section.border_mode || 'global';
      if (borderMode === 'none') {
        overrideVars.push('--sec-border-top: none', '--sec-border-bottom: none', '--sec-border-left: none', '--sec-border-right: none');
      } else if (borderMode === 'custom') {
        const bw = section.border_width ?? 1;
        const bc = section.border_color || colors.border;
        const br = section.border_radius ?? 12;
        const bCorners = section.border_corners || [true, true, true, true];
        overrideVars.push(
          `--sec-border-top: ${section.border_top !== false ? `${bw}px solid ${bc}` : 'none'}`,
          `--sec-border-bottom: ${section.border_bottom !== false ? `${bw}px solid ${bc}` : 'none'}`,
          `--sec-border-left: ${section.border_left !== false ? `${bw}px solid ${bc}` : 'none'}`,
          `--sec-border-right: ${section.border_right !== false ? `${bw}px solid ${bc}` : 'none'}`,
          `--sec-border-radius: ${bCorners[0] ? br : 0}px ${bCorners[1] ? br : 0}px ${bCorners[2] ? br : 0}px ${bCorners[3] ? br : 0}px`
        );
      }

      const rowVisualsMode = section.row_visuals_mode || 'global';
      if (rowVisualsMode === 'custom') {
        overrideVars.push(`--sec-row-indent: ${section.row_indent ?? 16}px`);
        const showRB = section.row_border_enabled === true;
        const rbw = section.row_border_width ?? 1;
        const rbc = section.row_border_color || colors.row_border || '#333333';
        const rbr = section.row_border_radius ?? 4;
        const rCorners = section.row_border_corners || [true, true, true, true];
        const rTop = showRB && section.row_border_top !== false ? `${rbw}px solid ${rbc}` : 'none';
        const rBottom = showRB && section.row_border_bottom !== false ? `${rbw}px solid ${rbc}` : 'none';
        const rLeft = showRB && section.row_border_left !== false ? `${rbw}px solid ${rbc}` : 'none';
        const rRight = showRB && section.row_border_right !== false ? `${rbw}px solid ${rbc}` : 'none';
        overrideVars.push(
          `--sec-row-border-top: ${rTop}`,
          `--sec-row-border-bottom: ${rBottom}`,
          `--sec-row-border-left: ${rLeft}`,
          `--sec-row-border-right: ${rRight}`,
          `--sec-row-border-radius: ${rCorners[0] ? rbr : 0}px ${rCorners[1] ? rbr : 0}px ${rCorners[2] ? rbr : 0}px ${rCorners[3] ? rbr : 0}px`,
          `--sec-row-margin: ${showRB ? '2px 0' : '0'}`,
          `--sec-row-pad-x: ${showRB ? '6px' : '0'}`,
          `--sec-row-first-border: ${showRB ? rTop : 'none'}`,
          `--sec-row-last-border: ${showRB ? rBottom : 'none'}`
        );
      }

      // Section divider override: draws this section's own above/below
      // line using the same centered-%-width pseudo-element technique as
      // the global mechanism, and suppresses the global pseudo-elements
      // for this specific section so the two don't double up.
      const dividerMode = section.divider_mode || 'global';
      if (dividerMode === 'custom') {
        const dc = section.divider_color || colors.section_divider || '#333333';
        const aboveWidth = section.divider_above_width ?? 1;
        const aboveLength = section.divider_above_length ?? 100;
        const belowWidth = section.divider_below_width ?? 1;
        const belowLength = section.divider_below_length ?? 100;
        const sel = `.seed-section[data-section-id="${section.id}"]`;

        let rule = `
          ${sel}::before { display: none !important; }
          ${sel}::after { display: none !important; }
          ${sel} { position: relative; }
        `;

        if (section.divider_above) {
          rule += `
            ${sel} { margin-top: calc(var(--seed-gap) / 2); padding-top: calc(var(--seed-gap) / 2); }
            ${sel}::before {
              content: '';
              display: block !important;
              position: absolute;
              top: 0;
              left: 50%;
              transform: translateX(-50%);
              width: ${aboveLength}%;
              border-top: ${aboveWidth}px solid ${dc};
            }
          `;
        }

        if (section.divider_below) {
          rule += `
            ${sel} { margin-bottom: calc(var(--seed-gap) / 2); padding-bottom: calc(var(--seed-gap) / 2); }
            ${sel}::after {
              content: '';
              display: block !important;
              position: absolute;
              bottom: 0;
              left: 50%;
              transform: translateX(-50%);
              width: ${belowLength}%;
              border-bottom: ${belowWidth}px solid ${dc};
            }
          `;
        }

        customDividerCss.push(rule);
      }

      const sectionBorderOverride = overrideVars.length ? overrideVars.join('; ') + ';' : '';
      const sectionDisableGlowAttr = section.disable_glow ? ' data-disable-glow="true"' : '';

      const sectionVars = [
        `--sec-icon-color: ${section.icon_color || colors.icon}`,
        `--sec-icon-size: calc(${section.icon_size}px * var(--seed-scale) * var(--seed-title-icon-scale))`,
        `--sec-title-color: ${section.title_color || colors.text}`,
        `--sec-title-size: calc(${section.title_font_size}px * var(--seed-scale) * var(--seed-title-text-scale))`,
        `--sec-title-weight: ${section.title_font_weight || 600}`,
        `--sec-title-style: ${section.title_font_style || 'normal'}`,
        `--sec-entity-icon-color: ${section.entity_icon_color || colors.icon}`,
        `--sec-entity-icon-size: calc(${section.entity_icon_size}px * var(--seed-scale) * var(--seed-icon-scale))`,
        `--sec-entity-text-color: ${section.entity_text_color || colors.text}`,
        `--sec-entity-size: calc(${section.entity_font_size}px * var(--seed-scale) * var(--seed-entity-text-scale))`,
        `--sec-entity-weight: ${section.entity_font_weight || 400}`,
        `--sec-entity-style: ${section.entity_font_style || 'normal'}`,
        `--sec-chip-bg: ${section.chip_bg || colors.chip_bg}`,
        `--sec-chip-border: ${section.chip_border_color || colors.chip_border}`,
        `--sec-chip-text: ${section.chip_text_color || colors.chip_text}`,
        `--sec-chip-scale: ${section.chip_scale || 1.0}`,
        `--sec-chip-radius: ${section.chip_shape === 'square' ? 0 : section.chip_shape === 'rounded' ? (section.chip_radius ?? 8) : 999}px`
      ].join('; ');
      const sectionStyle = `${sectionVars}; ${sectionBorderOverride}`;

      const chipLayoutClass = section.chips_only ? ` chips-only chip-layout-${section.chip_layout || 'wrap'}` : '';
      const bodyHtml = `<div class="seed-children${chipLayoutClass}">${contentHtml}</div>`;
      const headerHtml = `
        <div class="seed-section-name">${section.name}</div>
        ${showSectionCount ? `<div class="seed-section-count">${count}</div>` : ''}
        <div class="seed-section-icon"><ha-icon icon="${sectionIcon}"></ha-icon></div>
      `;

      if (!sectionShowTitle) {
        // Title row removed entirely - just render the section body, always expanded.
        sectionsHtml += `
          <div class="seed-section non-collapsible" data-section-id="${section.id}" style="${sectionStyle}"${sectionDisableGlowAttr}>
            ${bodyHtml}
          </div>
        `;
      } else if (collapsible) {
        sectionsHtml += `
          <details class="seed-section ${autoClose ? 'seed-autoclose' : ''}" data-section-id="${section.id}" style="${sectionStyle}"${sectionDisableGlowAttr}>
            <summary class="seed-summary">${headerHtml}</summary>
            ${bodyHtml}
          </details>
        `;
      } else {
        sectionsHtml += `
          <div class="seed-section non-collapsible" data-section-id="${section.id}" style="${sectionStyle}"${sectionDisableGlowAttr}>
            <div class="seed-summary">${headerHtml}</div>
            ${bodyHtml}
          </div>
        `;
      }
    }

    if (customDividerCss.length) {
      sectionsHtml += `<style>${customDividerCss.join('\n')}</style>`;
    }

    // The card wrapper is ALWAYS rendered so the card border / glow /
    // drop-shadow / background apply whether or not the card is collapsible
    // (mirrors the Color card's always-present .cpc-card container). Making
    // the card collapsible only changes the wrapper into a <details> whose
    // title bar toggles the body - it does not gate the wrapper's visuals.
    if (cardCollapsible) {
      const showCardChevronFlag = this._config.show_card_chevron !== false;
      // When both the title text and icon are hidden there's no title bar, so
      // fall back to an empty spacer that keeps the summary clickable and
      // pushes the chevron to the right.
      const summaryTitleHtml = titleHtml || '<div class="seed-title"><span class="seed-title-text"></span></div>';
      html += `
        <details class="easy-entity-styler-card-wrapper" open>
          <summary class="easy-entity-styler-card-summary">
            ${summaryTitleHtml}
            ${showCardChevronFlag ? '<ha-icon class="easy-entity-styler-card-chevron" icon="mdi:chevron-down"></ha-icon>' : ''}
          </summary>
          <div class="easy-entity-styler-card-body">${sectionsHtml}</div>
        </details>
      `;
    } else {
      // Non-collapsible: same wrapper (so border/glow/shadow still apply), but
      // a plain <div> with the title rendered at the top of the body.
      html += `
        <div class="easy-entity-styler-card-wrapper easy-entity-styler-card-static">
          <div class="easy-entity-styler-card-body">${titleHtml}${sectionsHtml}</div>
        </div>
      `;
    }

    container.innerHTML = html;
    this.innerHTML = '';
    this.appendChild(container);
    this._rendered = true;
    this.attachEventListeners();
    this.updateGlow();
    this.updateCardGlow();
  }

  // Builds the <span class="seed-chip">...</span> markup for one entity,
  // honoring that section's icon-source / show-name / show-icon settings.
  _buildChipHtml(entityId, state, section) {
    const domain = domainOf(entityId);
    const rawName = state.attributes.friendly_name || entityId;
    const cleanName = stripEntityName(rawName, this._config.strip_entity_strings);
    const value = state.state && state.state !== 'unknown' && state.state !== 'unavailable' ? state.state : '—';
    const text = section.chip_show_name ? `${cleanName}: ${value}` : value;

    let iconHtml = '';
    if (section.chip_show_icon !== false) {
      const source = section.chip_icon_source || 'auto';
      let chipIcon = '';
      if (source === 'entity') {
        chipIcon = state.attributes.icon || DOMAIN_ICONS[domain] || 'mdi:help-circle-outline';
      } else if (source === 'section') {
        chipIcon = section.icon || 'mdi:folder-outline';
      } else if (source === 'none') {
        chipIcon = '';
      } else {
        // 'auto' - the original audio/video keyword detection
        const chipType = classifyChip(entityId);
        chipIcon = chipType === 'audio' ? 'mdi:surround-sound' : chipType === 'video' ? 'mdi:video-outline' : 'mdi:shape-outline';
      }
      if (chipIcon) iconHtml = `<ha-icon icon="${chipIcon}"></ha-icon>`;
    }

    return `<span class="seed-chip" data-entity-id="${entityId}">${iconHtml}<span class="seed-chip-text">${text}</span></span>`;
  }

  createRowHTML(entityId, section) {
    const state = this._hass.states[entityId];
    const domain = domainOf(entityId);
    const name = stripEntityName(state.attributes.friendly_name || entityId, this._config.strip_entity_strings);
    const sec = section || {};
    const chipType = classifyChip(entityId);

    // Chips-only sections: every entity renders as just its chip, no
    // row icon or name, laid out in a wrapping flex row (see
    // .seed-children.chips-only).
    if (sec.chips_only) {
      return `<div class="seed-chip-only-item" data-entity-id="${entityId}">${this._buildChipHtml(entityId, state, sec)}</div>`;
    }

    const icon = state.attributes.icon || DOMAIN_ICONS[domain] || 'mdi:help-circle-outline';

    const isOffState = state.state === 'off' || state.state === 'unavailable' || state.state === 'unknown';
    const iconColorStyle = (this._config.gray_icons_when_off && isOffState)
      ? ` style="color: ${this.getColors().secondary_text};"`
      : '';

    let valueHtml;

    if (chipType) {
      valueHtml = this._buildChipHtml(entityId, state, sec);
    } else if (domain === 'switch' || domain === 'input_boolean') {
      const isOn = state.state === 'on';
      valueHtml = `<ha-switch class="seed-native-toggle" data-entity-id="${entityId}" data-domain="${domain}" ${isOn ? 'checked' : ''}></ha-switch>`;
    } else if (domain === 'binary_sensor') {
      const isOn = state.state === 'on';
      const bg = isOn ? this.getColors().badge_on : this.getColors().badge_off;
      valueHtml = `<span class="seed-badge" style="background:${bg}; cursor:default;">${isOn ? 'ON' : 'OFF'}</span>`;
    } else if (domain === 'number') {
      const unit = state.attributes.unit_of_measurement || '';
      const min = state.attributes.min ?? 0;
      const max = state.attributes.max ?? 100;
      const step = state.attributes.step ?? 1;
      const value = parseFloat(state.state);
      const safeValue = Number.isNaN(value) ? min : value;
      const pct = max > min ? ((safeValue - min) / (max - min)) * 100 : 0;
      const trackColor = 'rgba(128,128,128,0.35)';
      valueHtml = `
        <div class="seed-slider-wrap">
          <input type="range" class="seed-native-slider" data-entity-id="${entityId}"
            min="${min}" max="${max}" step="${step}" value="${safeValue}"
            style="background: linear-gradient(to right, var(--sec-entity-icon-color, ${this.getColors().icon}) 0%, var(--sec-entity-icon-color, ${this.getColors().icon}) ${pct}%, ${trackColor} ${pct}%, ${trackColor} 100%);" />
          <span class="seed-row-value seed-slider-value">${Number.isNaN(value) ? '—' : value}${unit}</span>
        </div>
      `;
    } else {
      const unit = state.attributes.unit_of_measurement || '';
      const value =
        state.state && state.state !== 'unknown' && state.state !== 'unavailable'
          ? `${state.state}${unit}`
          : '—';
      valueHtml = `<span class="seed-row-value">${value}</span>`;
    }

    return `
      <div class="seed-row" data-entity-id="${entityId}">
        <div class="seed-row-icon"><ha-icon icon="${icon}"${iconColorStyle}></ha-icon></div>
        <div class="seed-row-name" data-entity-id="${entityId}">${name}</div>
        ${valueHtml}
      </div>
    `;
  }

  attachEventListeners() {
    const autoClose = this._config.auto_close_sections || false;

    this.querySelectorAll('details.seed-section').forEach(details => {
      details.addEventListener('toggle', () => {
        if (autoClose && details.open) {
          this.querySelectorAll('details.seed-section').forEach(other => {
            if (other !== details && other.open) other.open = false;
          });
        }
        this.updateGlow();
      });
    });

    this.querySelectorAll('.seed-row-name').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const entityId = el.dataset.entityId;
        this.dispatchEvent(
          new CustomEvent('hass-more-info', {
            detail: { entityId },
            bubbles: true,
            composed: true
          })
        );
      });
    });

    this.querySelectorAll('.seed-chip[data-entity-id]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const entityId = el.dataset.entityId;
        this.dispatchEvent(
          new CustomEvent('hass-more-info', {
            detail: { entityId },
            bubbles: true,
            composed: true
          })
        );
      });
    });

    this.querySelectorAll('.seed-native-toggle').forEach(el => {
      el.addEventListener('click', e => e.stopPropagation());
      el.addEventListener('change', e => {
        e.stopPropagation();
        const entityId = el.dataset.entityId;
        const domain = el.dataset.domain;
        const service = el.checked ? 'turn_on' : 'turn_off';
        this._hass.callService(domain, service, {}, { entity_id: entityId });
      });
    });

    this.querySelectorAll('.seed-native-slider').forEach(el => {
      el.addEventListener('click', e => e.stopPropagation());
      el.addEventListener('input', () => {
        const entityId = el.dataset.entityId;
        const state = this._hass.states[entityId];
        const unit = state?.attributes.unit_of_measurement || '';
        const wrap = el.closest('.seed-slider-wrap');
        const valEl = wrap ? wrap.querySelector('.seed-slider-value') : null;
        if (valEl) valEl.textContent = `${el.value}${unit}`;
        const min = parseFloat(el.min);
        const max = parseFloat(el.max);
        const pct = max > min ? ((parseFloat(el.value) - min) / (max - min)) * 100 : 0;
        const iconColor = (getComputedStyle(el).getPropertyValue('--sec-entity-icon-color').trim() || this.getColors().icon);
        el.style.background = `linear-gradient(to right, ${iconColor} 0%, ${iconColor} ${pct}%, rgba(128,128,128,0.35) ${pct}%, rgba(128,128,128,0.35) 100%)`;
      });
      el.addEventListener('change', () => {
        const entityId = el.dataset.entityId;
        this._hass.callService('number', 'set_value', { value: parseFloat(el.value) }, { entity_id: entityId });
      });
    });
  }

  updateStates() {
    if (!this._hass) return;

    if (this._config.show_last_changed) {
      const lastChangedEl = this.querySelector('.seed-title-last-changed');
      const text = this._getLastChangedText();
      if (lastChangedEl) {
        lastChangedEl.textContent = text;
      }
    }
    if ((this._config.card_glow_condition || 'never') === 'when_entity_on') {
      this.updateCardGlow();
    }

    this.querySelectorAll('.seed-row').forEach(row => {
      const entityId = row.dataset.entityId;
      const state = this._hass.states[entityId];
      if (!state) return;

      const domain = domainOf(entityId);
      const chipType = classifyChip(entityId);

      if (this._config.gray_icons_when_off) {
        const iconEl = row.querySelector('.seed-row-icon ha-icon');
        if (iconEl) {
          const isOffState = state.state === 'off' || state.state === 'unavailable' || state.state === 'unknown';
          iconEl.style.color = isOffState ? this.getColors().secondary_text : '';
        }
      }

      if (chipType) {
        const chip = row.querySelector('.seed-chip');
        if (chip) {
          const textEl = chip.querySelector('.seed-chip-text');
          if (textEl) {
            const rawName = state.attributes.friendly_name || entityId;
            const cleanName = stripEntityName(rawName, this._config.strip_entity_strings);
            const value = state.state && state.state !== 'unknown' && state.state !== 'unavailable' ? state.state : '—';
            // We don't have the owning section object handy here, but the
            // chip's own presence/absence of a name prefix was baked in at
            // render time - just refresh whichever form it already has.
            textEl.textContent = textEl.textContent.includes(': ') ? `${cleanName}: ${value}` : value;
          }
        }
      } else if (domain === 'switch' || domain === 'input_boolean') {
        const toggle = row.querySelector('.seed-native-toggle');
        if (toggle && document.activeElement !== toggle) {
          toggle.checked = state.state === 'on';
        }
      } else if (domain === 'binary_sensor') {
        const badge = row.querySelector('.seed-badge');
        if (badge) {
          const isOn = state.state === 'on';
          badge.textContent = isOn ? 'ON' : 'OFF';
          badge.style.background = isOn ? this.getColors().badge_on : this.getColors().badge_off;
        }
      } else if (domain === 'number') {
        const slider = row.querySelector('.seed-native-slider');
        const valEl = row.querySelector('.seed-slider-value');
        // Don't fight the user mid-drag
        if (slider && document.activeElement !== slider) {
          const unit = state.attributes.unit_of_measurement || '';
          const min = parseFloat(slider.min);
          const max = parseFloat(slider.max);
          const value = parseFloat(state.state);
          if (!Number.isNaN(value)) {
            slider.value = value;
            if (valEl) valEl.textContent = `${value}${unit}`;
            const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
            const iconColor = (getComputedStyle(slider).getPropertyValue('--sec-entity-icon-color').trim() || this.getColors().icon);
            slider.style.background = `linear-gradient(to right, ${iconColor} 0%, ${iconColor} ${pct}%, rgba(128,128,128,0.35) ${pct}%, rgba(128,128,128,0.35) 100%)`;
          }
        }
      } else {
        const valEl = row.querySelector('.seed-row-value');
        if (valEl) {
          const unit = state.attributes.unit_of_measurement || '';
          valEl.textContent = state.state && state.state !== 'unknown' && state.state !== 'unavailable' ? `${state.state}${unit}` : '—';
        }
      }
    });

    // Hide/show chip-rendered entities live as their state crosses the
    // off/unknown/unavailable threshold, for sections with
    // chip_hide_when_off enabled. (The visible-entity count in the section
    // header is computed at render time and won't retroactively update -
    // a minor cosmetic gap, not worth a full rebuild on every tick.)
    this.querySelectorAll('.seed-row[data-entity-id], .seed-chip-only-item[data-entity-id]').forEach(el => {
      const entityId = el.dataset.entityId;
      const state = this._hass.states[entityId];
      if (!state) return;
      const sectionEl = el.closest('[data-section-id]');
      const sectionId = sectionEl ? sectionEl.dataset.sectionId : null;
      const section = sectionId ? (this._config.sections || []).find(s => s.id === sectionId) : null;
      if (section && section.chip_hide_when_off) {
        const isChipRendered = section.chips_only || !!classifyChip(entityId);
        if (isChipRendered) {
          const shouldHide = state.state === 'off' || state.state === 'unknown' || state.state === 'unavailable';
          el.style.display = shouldHide ? 'none' : '';
        }
      }
    });

    // Chips-only sections: the entity wrapper is .seed-chip-only-item, not
    // .seed-row, so it isn't covered by the loop above.
    this.querySelectorAll('.seed-chip-only-item').forEach(item => {
      const entityId = item.dataset.entityId;
      const state = this._hass.states[entityId];
      if (!state) return;
      const chip = item.querySelector('.seed-chip');
      const textEl = chip ? chip.querySelector('.seed-chip-text') : null;
      if (textEl) {
        const rawName = state.attributes.friendly_name || entityId;
        const cleanName = stripEntityName(rawName, this._config.strip_entity_strings);
        const value = state.state && state.state !== 'unknown' && state.state !== 'unavailable' ? state.state : '—';
        textEl.textContent = textEl.textContent.includes(': ') ? `${cleanName}: ${value}` : value;
      }
    });
  }
}

// ============================================================================
// SEED Card Editor
// ============================================================================

class SEEDCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = null;
    this._hass = null;
    this._rendered = false;
    this._lastKnownJSON = null;
    this._openSections = new Set();
    this._openTopLevelRows = new Set();
    this._scrollPositions = {};
    this._panelScroll = 0;
    // Editor-only UI preference - not part of the saved card config, since
    // it doesn't affect how the live card renders.
    this._editorAutoClose = true;
  }

  _normalizeConfig(config) {
    const stub = SEEDCard.getStubConfig();
    const cfg = config || {};
    const merged = {
      ...stub,
      ...cfg,
      colors: { ...stub.colors, ...(cfg.colors || {}) },
      entity_filter_texts: normalizeEntityFilterTexts(cfg),
      entity_filter_labels: normalizeEntityFilterLabels(cfg),
      entity_filter_groups: normalizeEntityFilterGroups(cfg),
      sections: Array.isArray(cfg.sections)
        ? cfg.sections.map(normalizeSection)
        : stub.sections
    };
    return JSON.parse(JSON.stringify(merged));
  }

  setConfig(config) {
    const normalized = this._normalizeConfig(config);
    const json = JSON.stringify(normalized);

    // If the incoming config is identical to what we last rendered/emitted,
    // this is HA echoing our own edit back to us - the DOM already reflects
    // it (native input state, checkbox state, etc.), so skip the rebuild.
    // Comparing by content (rather than a single-shot boolean flag) means
    // this still works correctly even when several edits fire in quick
    // succession before HA calls back.
    if (this._lastKnownJSON === json) {
      this._config = normalized;
      return;
    }

    this._config = normalized;
    this._rendered = false;
    this.renderEditor();
  }

  set hass(hass) {
    this._hass = hass;
    // Only render if we haven't rendered yet or if config changed
    if (this._config && !this._rendered) {
      this.renderEditor();
    }
  }

  _fireConfigChanged() {
    this._lastKnownJSON = JSON.stringify(this._config);
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: { config: JSON.parse(JSON.stringify(this._config)) },
        bubbles: true,
        composed: true
      })
    );
    this._updateYamlPreview();
  }

  _getCandidateEntities() {
    if (!this._hass) return [];
    return Object.keys(this._hass.states)
      .filter(id => isSeedEntity(id, this._config, this._hass))
      .sort((a, b) => {
        const nameA = this._hass.states[a].attributes.friendly_name || a;
        const nameB = this._hass.states[b].attributes.friendly_name || b;
        return nameA.localeCompare(nameB);
      });
  }

  _getEntityOptions() {
    const candidates = this._getCandidateEntities();
    return candidates.map(id => {
      const st = this._hass.states[id];
      const name = st ? st.attributes.friendly_name || id : id;
      return { value: id, label: `${name} (${id})` };
    });
  }

  _entitySelect(id, label, value, options, extraAttrs = '') {
    const optionHtml = options.length
      ? `<option value="">-- Select --</option>` +
        options.map(opt =>
          `<option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>`
        ).join('')
      : `<option value="">No entities found</option>`;

    return `
      <div class="seed-ed-subsection">
        <label>${label}</label>
        <select id="${id}" ${extraAttrs}>
          ${optionHtml}
        </select>
      </div>
    `;
  }

  _updateYamlPreview() {
    const pre = this.querySelector('#seed-yaml-preview');
    if (!pre || !this._config) return;
    const configCopy = JSON.parse(JSON.stringify(this._config));
    if (configCopy.sections) {
      configCopy.sections = configCopy.sections.map(s => {
        const { id, ...rest } = s;
        return rest;
      });
    }
    if (configCopy.zones) {
      delete configCopy.zones;
    }
    pre.textContent = toYaml({ type: 'custom:easy-entity-styler-card', ...configCopy });
  }

  // Save which editor sections are currently open
  _saveOpenState() {
    this._openSections.clear();
    const details = this.querySelectorAll('details.seed-ed-section');
    details.forEach(details => {
      if (details.open) {
        this._openSections.add(details.dataset.sectionId);
      }
    });

    this._openTopLevelRows = this._openTopLevelRows || new Set();
    this._openTopLevelRows.clear();
    this.querySelectorAll('details.seed-ed-row').forEach(d => {
      if (d.open) {
        const summary = d.querySelector('summary');
        if (summary) this._openTopLevelRows.add(summary.textContent.trim());
      }
    });
  }

  // Restore open state after re-render
  _restoreOpenState() {
    const details = this.querySelectorAll('details.seed-ed-section');
    details.forEach(details => {
      if (this._openSections.has(details.dataset.sectionId)) {
        details.open = true;
      }
    });

    if (this._openTopLevelRows && this._openTopLevelRows.size) {
      this.querySelectorAll('details.seed-ed-row').forEach(d => {
        const summary = d.querySelector('summary');
        if (summary && this._openTopLevelRows.has(summary.textContent.trim())) {
          d.open = true;
        }
      });
    }
  }

  // Same idea as _saveOpenState/_restoreOpenState, but for the scroll
  // position of each section's entity checklist - without this, every
  // full re-render throws the list back to the top mid-scroll.
  _saveScrollState() {
    this._scrollPositions = {};
    this.querySelectorAll('.seed-ed-entity-list').forEach(el => {
      this._scrollPositions[el.dataset.sectionId] = el.scrollTop;
    });
    this._panelScroll = this.scrollTop;
  }

  _restoreScrollState() {
    if (!this._scrollPositions) return;
    this.querySelectorAll('.seed-ed-entity-list').forEach(el => {
      const v = this._scrollPositions[el.dataset.sectionId];
      if (v != null) el.scrollTop = v;
    });
    if (this._panelScroll != null) this.scrollTop = this._panelScroll;
  }

  renderEditor() {
    if (!this._hass || !this._config) {
      this.innerHTML = '<div style="padding: 20px; color: #888;">Loading entities...</div>';
      return;
    }

    // Save current open/scroll state before re-render
    this._saveOpenState();
    this._saveScrollState();

    const entityOptions = this._getEntityOptions();
    const colors = this._config.colors || SEEDCard.getStubConfig().colors;

    const styles = `
      <style>
        .seed-ed { display: flex; flex-direction: column; gap: 8px; padding: 8px 0; }
        .seed-ed-row {
          display: flex;
          flex-direction: column;
          gap: 10px;
          border: 1px solid #3a3a3a;
          border-radius: 12px;
          padding: 16px;
          background: rgba(255,255,255,0.015);
        }
        .seed-ed-row label { font-size: 13px; font-weight: 600; color: var(--primary-text-color, #e1e1e1); }
        .seed-ed-row > label:first-child {
          font-size: 17px;
          font-weight: 700;
        }
        .seed-ed-row > .seed-ed-hint:first-of-type {
          font-size: 12px;
          padding-bottom: 12px;
          margin-top: -2px;
          border-bottom: 1px solid #3a3a3a;
        }
        details.seed-ed-row { padding: 0; }
        details.seed-ed-row > summary {
          list-style: none;
          cursor: pointer;
          user-select: none;
          padding: 8px 14px;
          font-size: 15px;
          font-weight: 700;
          color: var(--primary-text-color, #e1e1e1);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        /* Group heading inside a panel: labels a cluster of related settings
           (e.g. the "Title", "Scaling", "Card Wrapper" groups within the
           single Card Appearance panel). */
        .seed-ed-group-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--primary-text-color, #e1e1e1);
          margin-top: 6px;
          padding-bottom: 6px;
          border-bottom: 1px solid #3a3a3a;
        }
        .seed-ed-group-title:first-child { margin-top: 0; }
        details.seed-ed-row > summary > ha-icon.seed-ed-summary-icon {
          --mdc-icon-size: 20px;
          color: ${colors.icon || '#2196F3'};
          flex-shrink: 0;
        }
        details.seed-ed-row > summary::-webkit-details-marker { display: none; }
        details.seed-ed-row > summary::marker { content: ""; }
        details.seed-ed-row > summary::after {
          content: "";
          margin-left: auto;
          width: 10px;
          height: 10px;
          border-right: 2px solid #999;
          border-bottom: 2px solid #999;
          transform: rotate(45deg);
          transition: transform 0.2s ease;
        }
        details.seed-ed-row[open] > summary::after { transform: rotate(-135deg); }
        details.seed-ed-row > .seed-ed-collapsible-body {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 0 16px 16px 16px;
        }
        details.seed-ed-row > .seed-ed-collapsible-body > .seed-ed-hint:first-of-type {
          padding-bottom: 12px;
          margin-top: -6px;
          border-bottom: 1px solid #3a3a3a;
        }
        .seed-ed-row input[type="text"], .seed-ed-row input[type="number"], .seed-ed-row select {
          background: var(--secondary-background-color, #1c1c1c);
          border: 1px solid #444;
          border-radius: 6px;
          padding: 8px 10px;
          color: var(--primary-text-color, #e1e1e1);
          font-size: 14px;
          width: 100%;
          box-sizing: border-box;
        }
        .seed-ed-row select option { background: #1c1c1c; }
        .seed-ed-row input[type="checkbox"] { cursor: pointer; }
        .seed-ed-hint { font-size: 11px; color: #888; }
        .seed-ed-colors { display: flex; flex-wrap: wrap; gap: 16px; padding: 4px 0; }
        .seed-ed-color {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--primary-text-color, #e1e1e1);
          font-size: 12px;
        }
        .seed-ed-color label { min-width: 0; color: #ccc; }
        .seed-ed-color input[type="color"] {
          width: 36px;
          height: 28px;
          padding: 2px;
          border: 1px solid #333;
          border-radius: 4px;
          background: transparent;
          cursor: pointer;
        }
        .seed-ed-color input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
        .seed-ed-color input[type="color"]::-webkit-color-swatch { border: none; border-radius: 3px; }
        .seed-ed-section {
          border: 1px solid #444;
          border-radius: 10px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          background: rgba(255,255,255,0.02);
        }
        details.seed-ed-section { 
          background: transparent !important;
          padding: 0;
          border: 1px solid #444;
          border-radius: 10px;
        }
        details.seed-ed-section > summary {
          list-style: none;
          cursor: pointer;
          padding: 8px 12px;
          user-select: none;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        details.seed-ed-section > summary::-webkit-details-marker { display: none; }
        details.seed-ed-section > summary::marker { content: ""; }
        details.seed-ed-section > .seed-ed-section-body {
          padding: 0 12px 12px 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .seed-ed-section-head { display: flex; align-items: center; gap: 8px; flex: 1; }
        .seed-ed-section-head input[type="text"] { flex: 1; }
        .seed-ed-icon-btn {
          cursor: pointer;
          --mdc-icon-size: 20px;
          color: #aaa;
          display: flex;
          align-items: center;
        }
        .seed-ed-icon-btn:hover { color: #fff; }
        .seed-ed-icon-btn.disabled { opacity: 0.25; pointer-events: none; }
        .seed-ed-checkbox-row { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #ccc; }
        .seed-ed-style-block {
          border: 1px solid #333;
          border-radius: 8px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .seed-ed-style-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #999;
        }
        .seed-ed-style-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
          gap: 10px;
        }
        .seed-ed-style-field { display: flex; flex-direction: column; gap: 3px; }
        .seed-ed-style-field label { font-size: 10px; color: #999; font-weight: 400; }
        .seed-ed-style-field input[type="color"] {
          width: 100%;
          height: 30px;
          padding: 2px;
          border-radius: 6px;
          border: 1px solid #444;
          background: transparent;
          cursor: pointer;
        }
        .seed-ed-style-field input[type="number"] {
          background: var(--secondary-background-color, #1c1c1c);
          border: 1px solid #444;
          border-radius: 6px;
          padding: 5px 8px;
          color: #e1e1e1;
          font-size: 12px;
          width: 100%;
          box-sizing: border-box;
        }
        .seed-ed-icon-input-row { display: flex; align-items: center; gap: 6px; }
        .seed-ed-icon-input-row ha-icon { --mdc-icon-size: 20px; color: #ccc; flex-shrink: 0; }
        .seed-ed-icon-input-row input[type="text"] {
          background: var(--secondary-background-color, #1c1c1c);
          border: 1px solid #444;
          border-radius: 6px;
          padding: 5px 8px;
          color: #e1e1e1;
          font-size: 12px;
          width: 100%;
          box-sizing: border-box;
        }
        .seed-ed-search {
          width: 100%;
          box-sizing: border-box;
          background: var(--secondary-background-color, #1c1c1c);
          border: 1px solid #444;
          border-radius: 6px;
          padding: 6px 8px;
          color: #e1e1e1;
          font-size: 12px;
        }
        .seed-ed-entity-list {
          max-height: 180px;
          overflow-y: auto;
          border: 1px solid #333;
          border-radius: 6px;
          padding: 4px;
        }
        .seed-ed-entity-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 6px;
          font-size: 12px;
          color: #ddd;
          border-radius: 4px;
        }
        .seed-ed-entity-item:hover { background: rgba(255,255,255,0.05); }
        .seed-ed-entity-item .eid { color: #888; font-size: 10px; }
        .seed-ed-add-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px;
          border: 1px dashed ${colors.border || '#2196F3'};
          border-radius: 8px;
          color: ${colors.icon || '#2196F3'};
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
        }
        .seed-ed-add-btn:hover { background: rgba(33,150,243,0.08); }
        .seed-ed-empty-candidates { font-size: 12px; color: #888; padding: 8px; text-align: center; font-style: italic; }
        .seed-ed-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
        }
        .seed-ed-subsection {
          border: 1px solid #333;
          border-radius: 8px;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .seed-ed-subsection label {
          font-size: 12px;
          font-weight: 600;
        }
        .seed-ed-subsection select {
          font-size: 12px;
          padding: 6px 8px;
        }
        .seed-ed-yaml {
          border: 1px solid ${colors.border || '#2196F3'};
          border-radius: 10px;
          padding: 12px;
          background: rgba(0,0,0,0.25);
          color: #cde6ff;
          font-family: monospace;
          font-size: 12px;
          line-height: 1.5;
          margin: 0;
          max-height: 320px;
          overflow: auto;
          white-space: pre;
        }
        .seed-ed-hint-text {
          font-size: 11px;
          color: #888;
          font-style: italic;
          padding: 4px 0;
        }
        .seed-ed-section-type-badge {
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 10px;
          background: ${colors.border || '#2196F3'}33;
          color: ${colors.border || '#2196F3'};
          border: 1px solid ${colors.border || '#2196F3'}66;
        }
        .seed-ed-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 2px 2px 10px;
          border-bottom: 1px solid #333;
          margin-bottom: 4px;
        }
        .seed-ed-header ha-icon { --mdc-icon-size: 22px; color: ${colors.icon || '#2196F3'}; }
        .seed-ed-header-title { font-size: 15px; font-weight: 700; color: var(--primary-text-color, #e1e1e1); }
        .seed-ed-header-build { margin-left: auto; font-size: 11px; color: #888; font-family: var(--code-font-family, monospace); }
        .seed-ed-slider-row { display: flex; align-items: center; gap: 10px; padding: 4px 0; flex-wrap: wrap; }
        .seed-ed-slider-row label { font-size: 12px; color: #ccc; display: flex; align-items: center; gap: 8px; }
        .seed-ed-slider-row input[type="range"] { flex: 1; min-width: 100px; accent-color: ${colors.border || '#2196F3'}; cursor: pointer; }
        .seed-ed-slider-value { min-width: 40px; text-align: center; font-size: 12px; color: #e1e1e1; font-weight: 500; }
        .seed-ed-side-toggles { display: flex; flex-wrap: wrap; gap: 12px; padding: 4px 0; }
        .seed-ed-side-toggles label { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #ccc; cursor: pointer; }
        .seed-ed-corner-toggles { display: flex; gap: 10px; flex-wrap: wrap; padding: 4px 0; }
        .seed-ed-corner-toggles label { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #ccc; cursor: pointer; }
        .seed-ed-strip-tags { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 0; }
        .seed-ed-strip-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.06);
          border: 1px solid #444;
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 12px;
          color: #e1e1e1;
        }
        .seed-ed-strip-tag .strip-remove { cursor: pointer; opacity: 0.7; font-weight: bold; }
        .seed-ed-strip-tag .strip-remove:hover { opacity: 1; color: #f44336; }
        .seed-ed-font-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          padding: 4px 0;
        }
        .seed-ed-font-row label { font-size: 12px; color: #ccc; font-weight: 400; display: flex; align-items: center; gap: 6px; }
        .seed-ed-font-row select {
          background: var(--secondary-background-color, #1c1c1c);
          border: 1px solid #444;
          border-radius: 6px;
          padding: 5px 8px;
          color: #e1e1e1;
          font-size: 12px;
        }
      </style>
    `;

    let html = styles + `<div class="seed-ed">`;

    // Used by the Title box below (and, for grayIconsWhenOff, by Child Row Visuals further down)
    const showLastChanged = this._config.show_last_changed === true;
    const grayIconsWhenOff = this._config.gray_icons_when_off === true;
    const showCardChevron = this._config.show_card_chevron !== false;

    // Editor header - icon + name + build, matching the Color card's layout.
    html += `
      <div class="seed-ed-header">
        <ha-icon icon="mdi:surround-sound"></ha-icon>
        <span class="seed-ed-header-title">SEED Card</span>
        <span class="seed-ed-header-build">${BUILD_NUMBER}</span>
      </div>
    `;

    // Auto-collapse toggle - governs the accordion behavior for every
    // collapsible area below (mirrors "Auto-close other sections" on the
    // live card, but for the editor panels themselves).
    html += `
      <div class="seed-ed-checkbox-row" style="padding: 2px 4px 4px;">
        <input type="checkbox" id="ed-editor-auto-close" ${this._editorAutoClose ? 'checked' : ''} />
        <label for="ed-editor-auto-close">Auto-collapse other areas when opening one</label>
      </div>
    `;

    // Basic settings
    const activeFilterTypes = normalizeFilterTypes(this._config);
    // Group Helpers keep the domain of their members (media_player.*, switch.*,
    // sensor.*, etc.) - only the legacy YAML "group:" platform actually uses the
    // group. domain. The reliable signal (same one the Shades card uses for
    // cover groups) is the attributes.entity_id array listing the members, so
    // scan every domain for that shape rather than filtering by id prefix.
    const groupOptions = this._hass ? Object.keys(this._hass.states)
      .filter(id => {
        const attrs = this._hass.states[id].attributes;
        return Array.isArray(attrs.entity_id) && attrs.entity_id.length > 0;
      })
      .map(id => {
        const state = this._hass.states[id];
        const memberCount = state.attributes.entity_id.length;
        return { value: id, label: `${state.attributes.friendly_name || id} (${id}) — ${memberCount} member${memberCount === 1 ? '' : 's'}` };
      })
      .sort((a, b) => a.label.localeCompare(b.label)) : [];

    // Get available labels from the label registry (hass.labels) when exposed;
    // otherwise fall back to whatever label ids are actually used on entities,
    // since some HA versions don't expose hass.labels to custom cards. Mirrors
    // the Shades card's availableLabels logic.
    let labelOptions = this._hass && this._hass.labels ? Object.keys(this._hass.labels)
      .map(id => ({ value: id, label: this._hass.labels[id].name || id })) : [];
    if (labelOptions.length === 0 && this._hass && this._hass.entities) {
      const knownLabelIds = new Set();
      Object.values(this._hass.entities).forEach(e => (e.labels || []).forEach(l => knownLabelIds.add(l)));
      labelOptions = [...knownLabelIds].map(id => ({ value: id, label: id }));
    }
    labelOptions.sort((a, b) => a.label.localeCompare(b.label));
    const entityFilterLabels = normalizeEntityFilterLabels(this._config);
    const entityFilterTexts = normalizeEntityFilterTexts(this._config);
    const entityFilterGroups = normalizeEntityFilterGroups(this._config);
    const groupDisplayLabel = (id) => {
      const found = groupOptions.find(opt => opt.value === id);
      return found ? found.label : id;
    };
    const labelDisplayName = (id) => {
      if (this._hass && this._hass.labels && this._hass.labels[id]) return this._hass.labels[id].name || id;
      const found = labelOptions.find(opt => opt.value === id);
      return found ? found.label : id;
    };

    // ---- Card Appearance panel variables (Title, Section Header, Scaling,
    // and the whole-card collapsible wrapper are all merged into one panel) ----
    // Section header visibility / behavior
    const showSectionCount = this._config.show_section_count !== false;
    const autoCloseSections = this._config.auto_close_sections || false;

    // Scaling
    const currentScale = this._config.scale || 1.0;
    const currentIconScale = this._config.icon_scale || 1.0;
    const currentTitleIconScale = this._config.title_icon_scale || 1.0;
    const currentTitleTextScale = this._config.title_text_scale || 1.0;
    const currentEntityTextScale = this._config.entity_text_scale || 1.0;
    const currentSliderMaxWidth = this._config.slider_max_width || 240;

    // Whole-card collapsible wrapper
    const cardCollapsible = this._config.card_collapsible === true;
    const cardBorderEnabled = this._config.card_border_enabled === true;
    const cardBorderWidth = this._config.card_border_width ?? 1;
    const cardBorderRadius = this._config.card_border_radius ?? 12;
    const cardBorderTop = this._config.card_border_top !== false;
    const cardBorderBottom = this._config.card_border_bottom !== false;
    const cardBorderLeft = this._config.card_border_left !== false;
    const cardBorderRight = this._config.card_border_right !== false;
    const cardCorners = this._config.card_border_corners || [true, true, true, true];
    const cardGlowCondition = this._config.card_glow_condition || 'never';
    const cardGlowEntity = this._config.card_glow_entity || '';
    const cardGlowIntensity = this._config.card_glow_intensity || 1.0;
    const cardGlowBordersOnly = this._config.card_glow_borders_only !== false;
    const cardBorderColorVal = colors.card_border || '#2196F3';
    const cardGlowColorVal = colors.card_glow || '#2196F3';

    html += `
      <details class="seed-ed-row">
        <summary><ha-icon class="seed-ed-summary-icon" icon="mdi:palette-outline"></ha-icon>Card Appearance</summary>
        <div class="seed-ed-collapsible-body">
        <span class="seed-ed-hint">Title bar, section headers, scaling, and the whole-card collapsible wrapper.</span>

        <div class="seed-ed-group-title">Title</div>
        <div class="seed-ed-checkbox-row">
          <input type="checkbox" id="ed-show-title" ${this._config.show_title !== false ? 'checked' : ''} />
          <label for="ed-show-title">Show card title text</label>
        </div>
        <input type="text" id="ed-title" value="${this._config.title || ''}" placeholder="e.g. SEED" />
        <div class="seed-ed-checkbox-row" style="margin-top:8px;">
          <input type="checkbox" id="ed-show-title-icon" ${this._config.show_title_icon !== false ? 'checked' : ''} />
          <label for="ed-show-title-icon">Show title icon</label>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Icon:</span></label>
          <input type="text" id="ed-title-icon" value="${this._config.title_icon || 'mdi:surround-sound'}" style="flex:1;" placeholder="mdi:surround-sound" />
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Text Size:</span></label>
          <input type="range" id="ed-title-font-size" min="10" max="40" step="1" value="${this._config.title_font_size || 16}" />
          <span class="seed-ed-slider-value" id="ed-title-font-size-value">${this._config.title_font_size || 16}px</span>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Icon Size:</span></label>
          <input type="range" id="ed-title-icon-size" min="10" max="48" step="1" value="${this._config.title_icon_size || 22}" />
          <span class="seed-ed-slider-value" id="ed-title-icon-size-value">${this._config.title_icon_size || 22}px</span>
        </div>
        <div class="seed-ed-font-row">
          <label>Weight:
            <select id="ed-title-font-weight">
              <option value="400" ${(this._config.title_font_weight || 700) == 400 ? 'selected' : ''}>Normal</option>
              <option value="600" ${(this._config.title_font_weight || 700) == 600 ? 'selected' : ''}>Semibold</option>
              <option value="700" ${(this._config.title_font_weight || 700) == 700 ? 'selected' : ''}>Bold</option>
              <option value="900" ${(this._config.title_font_weight || 700) == 900 ? 'selected' : ''}>Black</option>
            </select>
          </label>
          <label><input type="checkbox" id="ed-title-italic" ${this._config.title_font_style === 'italic' ? 'checked' : ''} /> Italic</label>
        </div>
        <div class="seed-ed-colors">
          <div class="seed-ed-color">
            <label>Text:</label>
            <input type="color" id="ed-color-title-text" value="${this._config.title_text_color || '#e1e1e1'}" />
          </div>
          <div class="seed-ed-color">
            <label>Icon:</label>
            <input type="color" id="ed-color-title-icon" value="${this._config.title_icon_color || '#2196F3'}" />
          </div>
        </div>
        <div class="seed-ed-checkbox-row">
          <input type="checkbox" id="ed-show-last-changed" ${showLastChanged ? 'checked' : ''} />
          <label for="ed-show-last-changed">Show "last changed" time next to the title</label>
        </div>

        <div class="seed-ed-group-title">Section Headers</div>
        <span class="seed-ed-hint">"Show title row" is set per-section below, in each section's settings.</span>
        <div class="seed-ed-checkbox-row">
          <input type="checkbox" id="ed-show-section-count" ${showSectionCount ? 'checked' : ''} />
          <label for="ed-show-section-count">Show the entity count in the title row</label>
        </div>
        <div class="seed-ed-checkbox-row">
          <input type="checkbox" id="ed-auto-close-sections" ${autoCloseSections ? 'checked' : ''} />
          <label for="ed-auto-close-sections">Auto-close other sections when expanding one</label>
        </div>

        <div class="seed-ed-group-title">Scaling</div>
        <span class="seed-ed-hint">Adjust the size of different card elements independently</span>
        <div class="seed-ed-slider-row">
          <label><span>Overall Scale:</span></label>
          <input type="range" id="ed-scale-slider" min="0.5" max="3.0" step="0.05" value="${currentScale}" />
          <span class="seed-ed-slider-value" id="ed-scale-slider-value">${Math.round(currentScale * 100)}%</span>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Entity Icons:</span></label>
          <input type="range" id="ed-icon-scale" min="0.5" max="3.0" step="0.05" value="${currentIconScale}" />
          <span class="seed-ed-slider-value" id="ed-icon-scale-value">${Math.round(currentIconScale * 100)}%</span>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Section Title Icons:</span></label>
          <input type="range" id="ed-title-icon-scale" min="0.5" max="3.0" step="0.05" value="${currentTitleIconScale}" />
          <span class="seed-ed-slider-value" id="ed-title-icon-scale-value">${Math.round(currentTitleIconScale * 100)}%</span>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Section Title Text:</span></label>
          <input type="range" id="ed-title-text-scale" min="0.5" max="3.0" step="0.05" value="${currentTitleTextScale}" />
          <span class="seed-ed-slider-value" id="ed-title-text-scale-value">${Math.round(currentTitleTextScale * 100)}%</span>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Entity Text:</span></label>
          <input type="range" id="ed-entity-text-scale" min="0.5" max="3.0" step="0.05" value="${currentEntityTextScale}" />
          <span class="seed-ed-slider-value" id="ed-entity-text-scale-value">${Math.round(currentEntityTextScale * 100)}%</span>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Slider Width:</span></label>
          <input type="range" id="ed-slider-max-width" min="80" max="500" step="10" value="${currentSliderMaxWidth}" />
          <span class="seed-ed-slider-value" id="ed-slider-max-width-value">${currentSliderMaxWidth}px</span>
        </div>

        <div class="seed-ed-group-title">Card Wrapper</div>
        <span class="seed-ed-hint">Collapse the entire card down to just the title bar. Border, glow, background, and shadow here wrap the whole card and are independent of the per-section settings.</span>
        <div class="seed-ed-checkbox-row">
          <input type="checkbox" id="ed-card-collapsible" ${cardCollapsible ? 'checked' : ''} />
          <label for="ed-card-collapsible">Make the whole card collapsible (title bar only when collapsed)</label>
        </div>
        ${cardCollapsible ? `
        <div class="seed-ed-checkbox-row">
          <input type="checkbox" id="ed-show-card-chevron" ${showCardChevron ? 'checked' : ''} />
          <label for="ed-show-card-chevron">Show expand/collapse chevron on the title row</label>
        </div>
        ` : ''}
        <div class="seed-ed-checkbox-row">
          <input type="checkbox" id="ed-card-border-enabled" ${cardBorderEnabled ? 'checked' : ''} />
          <label for="ed-card-border-enabled">Enable border around the card</label>
        </div>
        <div class="seed-ed-colors">
          <div class="seed-ed-color">
            <label>Border:</label>
            <input type="color" id="ed-color-card-border" value="${cardBorderColorVal}" />
          </div>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Border Weight:</span></label>
          <input type="range" id="ed-card-border-width" min="1" max="8" step="1" value="${cardBorderWidth}" />
          <span class="seed-ed-slider-value" id="ed-card-border-width-value">${cardBorderWidth}px</span>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Corner Radius:</span></label>
          <input type="range" id="ed-card-border-radius" min="0" max="24" step="1" value="${cardBorderRadius}" />
          <span class="seed-ed-slider-value" id="ed-card-border-radius-value">${cardBorderRadius}px</span>
        </div>
        <div class="seed-ed-side-toggles">
          <label><input type="checkbox" class="ed-card-border-side" data-side="top" ${cardBorderTop ? 'checked' : ''}/> Top</label>
          <label><input type="checkbox" class="ed-card-border-side" data-side="bottom" ${cardBorderBottom ? 'checked' : ''}/> Bottom</label>
          <label><input type="checkbox" class="ed-card-border-side" data-side="left" ${cardBorderLeft ? 'checked' : ''}/> Left</label>
          <label><input type="checkbox" class="ed-card-border-side" data-side="right" ${cardBorderRight ? 'checked' : ''}/> Right</label>
        </div>
        <span class="seed-ed-hint">Corners: TL, TR, BR, BL</span>
        <div class="seed-ed-corner-toggles">
          <label><input type="checkbox" class="ed-card-corner" data-corner="0" ${cardCorners[0] ? 'checked' : ''}/> TL</label>
          <label><input type="checkbox" class="ed-card-corner" data-corner="1" ${cardCorners[1] ? 'checked' : ''}/> TR</label>
          <label><input type="checkbox" class="ed-card-corner" data-corner="2" ${cardCorners[2] ? 'checked' : ''}/> BR</label>
          <label><input type="checkbox" class="ed-card-corner" data-corner="3" ${cardCorners[3] ? 'checked' : ''}/> BL</label>
        </div>
        <div class="seed-ed-checkbox-row" style="margin-top:8px;">
          <span style="font-size:12px; color:#ccc;">Glow Condition:</span>
          <select id="ed-card-glow-condition">
            <option value="never" ${cardGlowCondition === 'never' ? 'selected' : ''}>Never</option>
            <option value="always" ${cardGlowCondition === 'always' ? 'selected' : ''}>Always</option>
            <option value="when_entity_on" ${cardGlowCondition === 'when_entity_on' ? 'selected' : ''}>When Specific Entity is On</option>
          </select>
        </div>
        ${cardGlowCondition === 'when_entity_on' ? `
        <div class="seed-ed-row" style="padding-left:0;">
          <input type="text" id="ed-card-glow-entity" value="${cardGlowEntity}" placeholder="e.g. switch.stormaudio_power" />
        </div>` : ''}
        <div class="seed-ed-checkbox-row">
          <input type="checkbox" id="ed-card-glow-borders-only" ${cardGlowBordersOnly ? 'checked' : ''} />
          <label for="ed-card-glow-borders-only">Glow stronger on sides with borders (when borders enabled)</label>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Glow Intensity:</span></label>
          <input type="range" id="ed-card-glow-intensity" min="0.25" max="3.0" step="0.05" value="${cardGlowIntensity}" />
          <span class="seed-ed-slider-value" id="ed-card-glow-intensity-value">${Math.round(cardGlowIntensity * 100)}%</span>
        </div>
        <div class="seed-ed-colors">
          <div class="seed-ed-color">
            <label>Glow:</label>
            <input type="color" id="ed-color-card-glow" value="${cardGlowColorVal}" />
          </div>
        </div>
        <div class="seed-ed-checkbox-row" style="margin-top:8px;">
          <span style="font-size:12px; color:#ccc;">Background:</span>
          <input type="color" id="ed-color-card-bg" value="${this._config.card_bg_color || '#1c1c1c'}" />
          <label><input type="checkbox" id="ed-card-bg-transparent" ${!this._config.card_bg_color ? 'checked' : ''} /> Transparent</label>
        </div>
        <div class="seed-ed-checkbox-row">
          <input type="checkbox" id="ed-card-shadow-enabled" ${this._config.card_shadow_enabled === true ? 'checked' : ''} />
          <label for="ed-card-shadow-enabled">Enable drop-shadow (separate from Glow above)</label>
        </div>
        <div class="seed-ed-colors">
          <div class="seed-ed-color">
            <label>Shadow:</label>
            <input type="color" id="ed-color-card-shadow" value="${this._config.card_shadow_color || '#000000'}" />
          </div>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>X Offset:</span></label>
          <input type="range" id="ed-card-shadow-x" min="-40" max="40" step="1" value="${this._config.card_shadow_x ?? 0}" />
          <span class="seed-ed-slider-value" id="ed-card-shadow-x-value">${this._config.card_shadow_x ?? 0}px</span>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Y Offset:</span></label>
          <input type="range" id="ed-card-shadow-y" min="-40" max="40" step="1" value="${this._config.card_shadow_y ?? 4}" />
          <span class="seed-ed-slider-value" id="ed-card-shadow-y-value">${this._config.card_shadow_y ?? 4}px</span>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Blur:</span></label>
          <input type="range" id="ed-card-shadow-blur" min="0" max="60" step="1" value="${this._config.card_shadow_blur ?? 16}" />
          <span class="seed-ed-slider-value" id="ed-card-shadow-blur-value">${this._config.card_shadow_blur ?? 16}px</span>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Spread:</span></label>
          <input type="range" id="ed-card-shadow-spread" min="-20" max="20" step="1" value="${this._config.card_shadow_spread ?? 0}" />
          <span class="seed-ed-slider-value" id="ed-card-shadow-spread-value">${this._config.card_shadow_spread ?? 0}px</span>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Opacity:</span></label>
          <input type="range" id="ed-card-shadow-opacity" min="0" max="1" step="0.05" value="${this._config.card_shadow_opacity ?? 0.35}" />
          <span class="seed-ed-slider-value" id="ed-card-shadow-opacity-value">${Math.round((this._config.card_shadow_opacity ?? 0.35) * 100)}%</span>
        </div>
        </div>
      </details>

      <details class="seed-ed-row">
        <summary><ha-icon class="seed-ed-summary-icon" icon="mdi:filter-variant"></ha-icon>Entity Filter</summary>
        <div class="seed-ed-collapsible-body">
        <span class="seed-ed-hint">Enable one or more filters below. An entity is a candidate if it matches ANY enabled filter.</span>
        <div class="seed-ed-side-toggles">
          <label><input type="checkbox" class="ed-filter-type-toggle" data-type="text" ${activeFilterTypes.includes('text') ? 'checked' : ''}/> Text</label>
          <label><input type="checkbox" class="ed-filter-type-toggle" data-type="label" ${activeFilterTypes.includes('label') ? 'checked' : ''}/> Label</label>
          <label><input type="checkbox" class="ed-filter-type-toggle" data-type="group" ${activeFilterTypes.includes('group') ? 'checked' : ''}/> Group</label>
        </div>
        ${activeFilterTypes.includes('text') ? `
        <div style="display:flex; gap:6px;">
          <input type="text" id="ed-filter-text-input" placeholder="e.g. storm" style="flex:1;" />
          <div class="seed-ed-icon-btn" id="ed-add-filter-text" style="border:1px solid #444; border-radius:6px; padding:6px 10px;">
            <ha-icon icon="mdi:plus"></ha-icon>
          </div>
        </div>
        <div class="seed-ed-strip-tags" id="ed-filter-text-tags">
          ${entityFilterTexts.map(t => `
            <span class="seed-ed-strip-tag">
              ${t}
              <span class="filter-text-remove" data-value="${t}">×</span>
            </span>
          `).join('')}
        </div>
        <span class="seed-ed-hint">Entities matching ANY captured text above (entity_id, integration platform, or device name/manufacturer) become candidates.</span>
        ` : ''}
        ${activeFilterTypes.includes('label') ? `
        <div style="display:flex; gap:6px;">
          <select id="ed-filter-label-picker" style="flex:1;">
            <option value="">${labelOptions.length ? '-- Select a label to add --' : 'No labels found in this Home Assistant instance yet'}</option>
            ${labelOptions.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
          </select>
          <div class="seed-ed-icon-btn" id="ed-add-filter-label" style="border:1px solid #444; border-radius:6px; padding:6px 10px;">
            <ha-icon icon="mdi:plus"></ha-icon>
          </div>
        </div>
        <div class="seed-ed-strip-tags" id="ed-filter-label-tags">
          ${entityFilterLabels.map(id => `
            <span class="seed-ed-strip-tag">
              ${labelDisplayName(id)}
              <span class="filter-label-remove" data-value="${id}">×</span>
            </span>
          `).join('')}
        </div>
        <span class="seed-ed-hint">Entities carrying ANY captured label above become candidates.</span>
        ` : ''}
        ${activeFilterTypes.includes('group') ? `
        <div style="display:flex; gap:6px;">
          <select id="ed-filter-group-picker" style="flex:1;">
            <option value="">${groupOptions.length ? '-- Select a group to add --' : 'No Group Helper entities found in this Home Assistant instance'}</option>
            ${groupOptions.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
          </select>
          <div class="seed-ed-icon-btn" id="ed-add-filter-group" style="border:1px solid #444; border-radius:6px; padding:6px 10px;">
            <ha-icon icon="mdi:plus"></ha-icon>
          </div>
        </div>
        <div class="seed-ed-strip-tags" id="ed-filter-group-tags">
          ${entityFilterGroups.map(id => `
            <span class="seed-ed-strip-tag">
              ${groupDisplayLabel(id)}
              <span class="filter-group-remove" data-value="${id}">×</span>
            </span>
          `).join('')}
        </div>
        <span class="seed-ed-hint">All member entities of ANY captured group above become candidates.</span>
        ` : ''}
        </div>
      </details>
    `;

    // Glow settings
    const glowBordersOnly = this._config.glow_borders_only !== false;
    const glowCondition = this._config.glow_condition || 'always';
    const glowIntensity = this._config.glow_intensity || 1.0;

    html += `
      <details class="seed-ed-row">
        <summary><ha-icon class="seed-ed-summary-icon" icon="mdi:blur"></ha-icon>Global Section Glow Settings</summary>
        <div class="seed-ed-collapsible-body">
        <div class="seed-ed-checkbox-row">
          <span style="font-size:12px; color:#ccc;">Glow Rule:</span>
          <select id="ed-glow-condition">
            <option value="never" ${glowCondition === 'never' ? 'selected' : ''}>Never</option>
            <option value="always" ${glowCondition === 'always' ? 'selected' : ''}>Always</option>
            <option value="when_expanded" ${glowCondition === 'when_expanded' ? 'selected' : ''}>When Section is Expanded</option>
          </select>
        </div>
        <div class="seed-ed-checkbox-row">
          <input type="checkbox" id="ed-glow-borders-only" ${glowBordersOnly ? 'checked' : ''} />
          <label for="ed-glow-borders-only">Glow stronger on sides with borders (when borders enabled)</label>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Glow Intensity:</span></label>
          <input type="range" id="ed-glow-intensity" min="0.25" max="3.0" step="0.05" value="${glowIntensity}" />
          <span class="seed-ed-slider-value" id="ed-glow-intensity-value">${Math.round(glowIntensity * 100)}%</span>
        </div>
        <div class="seed-ed-colors">
          <div class="seed-ed-color">
            <label>Glow:</label>
            <input type="color" id="ed-color-glow" value="${colors.glow || '#2196F3'}" />
          </div>
        </div>
        </div>
      </details>
    `;

    // Section (group) border + child row visuals + entity name stripping
    const showSectionBorder = this._config.show_section_border !== false;
    const sectionBorderWidth = this._config.section_border_width ?? 1;
    const sectionBorderRadius = this._config.section_border_radius ?? 12;
    const sectionBorderTop = this._config.section_border_top !== false;
    const sectionBorderBottom = this._config.section_border_bottom !== false;
    const sectionBorderLeft = this._config.section_border_left !== false;
    const sectionBorderRight = this._config.section_border_right !== false;
    const sectionCorners = this._config.section_border_corners || [true, true, true, true];

    const showRowBorder = this._config.show_row_border === true;
    const rowBorderWidth = this._config.row_border_width ?? 1;
    const rowBorderRadius = this._config.row_border_radius ?? 4;
    const rowBorderTop = this._config.row_border_top !== false;
    const rowBorderBottom = this._config.row_border_bottom !== false;
    const rowBorderLeft = this._config.row_border_left !== false;
    const rowBorderRight = this._config.row_border_right !== false;
    const rowCorners = this._config.row_border_corners || [true, true, true, true];
    const rowFirstBorderTop = this._config.row_first_border_top !== false;
    const rowLastBorderBottom = this._config.row_last_border_bottom !== false;
    const rowBorderColorVal = colors.row_border && colors.row_border !== 'transparent' ? colors.row_border : '#333333';
    const stripStrings = this._config.strip_entity_strings || [];

    // (Whole-card collapsible wrapper variables are declared earlier, with the
    // rest of the merged Card Appearance panel's variables.)
    const showSectionDivider = this._config.show_section_divider === true;
    const sectionDividerWidth = this._config.section_divider_width ?? 1;
    const sectionDividerTopLength = this._config.section_divider_length ?? 100;
    const showSectionDividerBottom = this._config.show_section_divider_bottom === true;
    const sectionDividerBottomWidth = this._config.section_divider_bottom_width ?? 1;
    const sectionDividerBottomLength = this._config.section_divider_bottom_length ?? 100;
    const sectionDividerColorVal = colors.section_divider && colors.section_divider !== 'transparent' ? colors.section_divider : '#333333';
    const rowIndent = this._config.row_indent ?? 16;

    html += `
      <details class="seed-ed-row">
        <summary><ha-icon class="seed-ed-summary-icon" icon="mdi:border-all-variant"></ha-icon>Global Section Borders</summary>
        <div class="seed-ed-collapsible-body">
        <span class="seed-ed-hint">Border style for each section (group) card</span>
        <div class="seed-ed-checkbox-row">
          <input type="checkbox" id="ed-show-section-border" ${showSectionBorder ? 'checked' : ''} />
          <label for="ed-show-section-border">Enable section borders</label>
        </div>
        <div class="seed-ed-colors">
          <div class="seed-ed-color">
            <label>Border:</label>
            <input type="color" id="ed-color-border" value="${colors.border || '#2196F3'}" />
          </div>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Border Weight:</span></label>
          <input type="range" id="ed-section-border-width" min="1" max="8" step="1" value="${sectionBorderWidth}" />
          <span class="seed-ed-slider-value" id="ed-section-border-width-value">${sectionBorderWidth}px</span>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Corner Radius:</span></label>
          <input type="range" id="ed-section-border-radius" min="0" max="24" step="1" value="${sectionBorderRadius}" />
          <span class="seed-ed-slider-value" id="ed-section-border-radius-value">${sectionBorderRadius}px</span>
        </div>
        <div class="seed-ed-side-toggles">
          <label><input type="checkbox" class="ed-section-border-side" data-side="top" ${sectionBorderTop ? 'checked' : ''}/> Top</label>
          <label><input type="checkbox" class="ed-section-border-side" data-side="bottom" ${sectionBorderBottom ? 'checked' : ''}/> Bottom</label>
          <label><input type="checkbox" class="ed-section-border-side" data-side="left" ${sectionBorderLeft ? 'checked' : ''}/> Left</label>
          <label><input type="checkbox" class="ed-section-border-side" data-side="right" ${sectionBorderRight ? 'checked' : ''}/> Right</label>
        </div>
        <span class="seed-ed-hint">Corners: TL, TR, BR, BL</span>
        <div class="seed-ed-corner-toggles">
          <label><input type="checkbox" class="ed-section-corner" data-corner="0" ${sectionCorners[0] ? 'checked' : ''}/> TL</label>
          <label><input type="checkbox" class="ed-section-corner" data-corner="1" ${sectionCorners[1] ? 'checked' : ''}/> TR</label>
          <label><input type="checkbox" class="ed-section-corner" data-corner="2" ${sectionCorners[2] ? 'checked' : ''}/> BR</label>
          <label><input type="checkbox" class="ed-section-corner" data-corner="3" ${sectionCorners[3] ? 'checked' : ''}/> BL</label>
        </div>
        </div>
      </details>

      <details class="seed-ed-row">
        <summary><ha-icon class="seed-ed-summary-icon" icon="mdi:box-shadow"></ha-icon>Global Section Background &amp; Shadow</summary>
        <div class="seed-ed-collapsible-body">
        <span class="seed-ed-hint">Default background fill and drop-shadow for every section card. Individual sections can override either under their own Background/Shadow settings below.</span>
        <div class="seed-ed-checkbox-row">
          <span style="font-size:12px; color:#ccc;">Background:</span>
          <input type="color" id="ed-color-section-bg" value="${this._config.section_bg_color || '#1c1c1c'}" />
          <label><input type="checkbox" id="ed-section-bg-transparent" ${!this._config.section_bg_color ? 'checked' : ''} /> Transparent</label>
        </div>
        <div class="seed-ed-checkbox-row">
          <input type="checkbox" id="ed-section-shadow-enabled" ${this._config.section_shadow_enabled === true ? 'checked' : ''} />
          <label for="ed-section-shadow-enabled">Enable drop-shadow</label>
        </div>
        <div class="seed-ed-colors">
          <div class="seed-ed-color">
            <label>Shadow:</label>
            <input type="color" id="ed-color-section-shadow" value="${this._config.section_shadow_color || '#000000'}" />
          </div>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>X Offset:</span></label>
          <input type="range" id="ed-section-shadow-x" min="-40" max="40" step="1" value="${this._config.section_shadow_x ?? 0}" />
          <span class="seed-ed-slider-value" id="ed-section-shadow-x-value">${this._config.section_shadow_x ?? 0}px</span>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Y Offset:</span></label>
          <input type="range" id="ed-section-shadow-y" min="-40" max="40" step="1" value="${this._config.section_shadow_y ?? 4}" />
          <span class="seed-ed-slider-value" id="ed-section-shadow-y-value">${this._config.section_shadow_y ?? 4}px</span>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Blur:</span></label>
          <input type="range" id="ed-section-shadow-blur" min="0" max="60" step="1" value="${this._config.section_shadow_blur ?? 12}" />
          <span class="seed-ed-slider-value" id="ed-section-shadow-blur-value">${this._config.section_shadow_blur ?? 12}px</span>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Spread:</span></label>
          <input type="range" id="ed-section-shadow-spread" min="-20" max="20" step="1" value="${this._config.section_shadow_spread ?? 0}" />
          <span class="seed-ed-slider-value" id="ed-section-shadow-spread-value">${this._config.section_shadow_spread ?? 0}px</span>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Opacity:</span></label>
          <input type="range" id="ed-section-shadow-opacity" min="0" max="1" step="0.05" value="${this._config.section_shadow_opacity ?? 0.35}" />
          <span class="seed-ed-slider-value" id="ed-section-shadow-opacity-value">${Math.round((this._config.section_shadow_opacity ?? 0.35) * 100)}%</span>
        </div>
        </div>
      </details>

      <details class="seed-ed-row">
        <summary><ha-icon class="seed-ed-summary-icon" icon="mdi:minus"></ha-icon>Global Section Dividers</summary>
        <div class="seed-ed-collapsible-body">
        <span class="seed-ed-hint">A line drawn between consecutive sections (independent of each section's own border). Above and below are independent - enable either or both.</span>
        <div class="seed-ed-colors">
          <div class="seed-ed-color">
            <label>Divider:</label>
            <input type="color" id="ed-color-section-divider" value="${sectionDividerColorVal}" />
          </div>
        </div>
        <div class="seed-ed-checkbox-row">
          <input type="checkbox" id="ed-show-section-divider" ${showSectionDivider ? 'checked' : ''} />
          <label for="ed-show-section-divider">Enable divider above each section</label>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Line Weight (Above):</span></label>
          <input type="range" id="ed-section-divider-width" min="1" max="8" step="1" value="${sectionDividerWidth}" />
          <span class="seed-ed-slider-value" id="ed-section-divider-width-value">${sectionDividerWidth}px</span>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Length (Above):</span></label>
          <input type="range" id="ed-section-divider-length" min="5" max="100" step="5" value="${sectionDividerTopLength}" />
          <span class="seed-ed-slider-value" id="ed-section-divider-length-value">${sectionDividerTopLength}%</span>
        </div>
        <div class="seed-ed-checkbox-row">
          <input type="checkbox" id="ed-show-section-divider-bottom" ${showSectionDividerBottom ? 'checked' : ''} />
          <label for="ed-show-section-divider-bottom">Enable divider below each section</label>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Line Weight (Below):</span></label>
          <input type="range" id="ed-section-divider-bottom-width" min="1" max="8" step="1" value="${sectionDividerBottomWidth}" />
          <span class="seed-ed-slider-value" id="ed-section-divider-bottom-width-value">${sectionDividerBottomWidth}px</span>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Length (Below):</span></label>
          <input type="range" id="ed-section-divider-bottom-length" min="5" max="100" step="5" value="${sectionDividerBottomLength}" />
          <span class="seed-ed-slider-value" id="ed-section-divider-bottom-length-value">${sectionDividerBottomLength}%</span>
        </div>
        </div>
      </details>

      <details class="seed-ed-row">
        <summary><ha-icon class="seed-ed-summary-icon" icon="mdi:format-list-bulleted"></ha-icon>Global Child Row Visuals</summary>
        <div class="seed-ed-collapsible-body">
        <span class="seed-ed-hint">Visual settings for each individual entity row inside a section</span>
        <div class="seed-ed-slider-row">
          <label><span>Row Indent:</span></label>
          <input type="range" id="ed-row-indent" min="0" max="48" step="2" value="${rowIndent}" />
          <span class="seed-ed-slider-value" id="ed-row-indent-value">${rowIndent}px</span>
        </div>
        <div class="seed-ed-checkbox-row">
          <input type="checkbox" id="ed-gray-icons-when-off" ${grayIconsWhenOff ? 'checked' : ''} />
          <label for="ed-gray-icons-when-off">Gray out icons for entities that are off or unavailable</label>
        </div>
        <div class="seed-ed-colors">
          <div class="seed-ed-color">
            <label>Default Icon:</label>
            <input type="color" id="ed-color-icon" value="${colors.icon || '#2196F3'}" />
          </div>
        </div>
        <div class="seed-ed-checkbox-row">
          <input type="checkbox" id="ed-show-row-border" ${showRowBorder ? 'checked' : ''} />
          <label for="ed-show-row-border">Enable row borders</label>
        </div>
        <div class="seed-ed-colors">
          <div class="seed-ed-color">
            <label>Border:</label>
            <input type="color" id="ed-color-row-border" value="${rowBorderColorVal}" />
          </div>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Border Weight:</span></label>
          <input type="range" id="ed-row-border-width" min="1" max="8" step="1" value="${rowBorderWidth}" />
          <span class="seed-ed-slider-value" id="ed-row-border-width-value">${rowBorderWidth}px</span>
        </div>
        <div class="seed-ed-slider-row">
          <label><span>Corner Radius:</span></label>
          <input type="range" id="ed-row-border-radius" min="0" max="16" step="1" value="${rowBorderRadius}" />
          <span class="seed-ed-slider-value" id="ed-row-border-radius-value">${rowBorderRadius}px</span>
        </div>
        <div class="seed-ed-side-toggles">
          <label><input type="checkbox" class="ed-row-border-side" data-side="top" ${rowBorderTop ? 'checked' : ''}/> Top</label>
          <label><input type="checkbox" class="ed-row-border-side" data-side="bottom" ${rowBorderBottom ? 'checked' : ''}/> Bottom</label>
          <label><input type="checkbox" class="ed-row-border-side" data-side="left" ${rowBorderLeft ? 'checked' : ''}/> Left</label>
          <label><input type="checkbox" class="ed-row-border-side" data-side="right" ${rowBorderRight ? 'checked' : ''}/> Right</label>
        </div>
        <span class="seed-ed-hint">Corners: TL, TR, BR, BL</span>
        <div class="seed-ed-corner-toggles">
          <label><input type="checkbox" class="ed-row-corner" data-corner="0" ${rowCorners[0] ? 'checked' : ''}/> TL</label>
          <label><input type="checkbox" class="ed-row-corner" data-corner="1" ${rowCorners[1] ? 'checked' : ''}/> TR</label>
          <label><input type="checkbox" class="ed-row-corner" data-corner="2" ${rowCorners[2] ? 'checked' : ''}/> BR</label>
          <label><input type="checkbox" class="ed-row-corner" data-corner="3" ${rowCorners[3] ? 'checked' : ''}/> BL</label>
        </div>
        <span class="seed-ed-hint">💡 These override the settings above for the first/last row in each section</span>
        <div class="seed-ed-side-toggles">
          <label><input type="checkbox" id="ed-row-first-border-top" ${rowFirstBorderTop ? 'checked' : ''}/> First row — top border</label>
          <label><input type="checkbox" id="ed-row-last-border-bottom" ${rowLastBorderBottom ? 'checked' : ''}/> Last row — bottom border</label>
        </div>
        </div>
      </details>

      <details class="seed-ed-row">
        <summary><ha-icon class="seed-ed-summary-icon" icon="mdi:format-text"></ha-icon>Remove Text From Entity Names</summary>
        <div class="seed-ed-collapsible-body">
        <span class="seed-ed-hint">Strip a substring (e.g. "StormAudio ISP") out of every entity name shown on the card.</span>
        <div style="display:flex; gap:6px;">
          <input type="text" id="ed-strip-string-input" placeholder="e.g. StormAudio ISP" style="flex:1;" />
          <div class="seed-ed-icon-btn" id="ed-add-strip-string" style="border:1px solid #444; border-radius:6px; padding:6px 10px;">
            <ha-icon icon="mdi:plus"></ha-icon>
          </div>
        </div>
        <div class="seed-ed-strip-tags" id="ed-strip-tags">
          ${stripStrings.map(s => `
            <span class="seed-ed-strip-tag">
              ${s}
              <span class="strip-remove" data-value="${s}">×</span>
            </span>
          `).join('')}
        </div>
        </div>
      </details>

    `;

    // Sections editor - this is where all sections are ordered
    html += `<div class="seed-ed-row"><label>Sections (Order & Display)</label></div>`;
    html += `<div class="seed-ed-hint">Sections appear in this order.</div>`;

    const sections = this._config.sections || [];
    sections.forEach((section, idx) => {
      const assigned = new Set(section.entities || []);
      const entityListHtml = entityOptions.length
        ? entityOptions.map(opt => {
            const checked = assigned.has(opt.value) ? 'checked' : '';
            const st = this._hass.states[opt.value];
            const rawName = st ? st.attributes.friendly_name || opt.value : opt.value;
            const name = stripEntityName(rawName, this._config.strip_entity_strings);
            return `
              <label class="seed-ed-entity-item" data-search="${(name + ' ' + opt.value).toLowerCase()}">
                <input type="checkbox" class="ed-entity-checkbox" data-section-id="${section.id}" data-entity-id="${opt.value}" ${checked} />
                <span>${name}<br/><span class="eid">${opt.value}</span></span>
              </label>
            `;
          }).join('')
        : `<div class="seed-ed-empty-candidates">No entities match the filter</div>`;

      const showEntityList = true;

      const headerIcon = section.icon || 'mdi:folder-outline';

      html += `
        <details class="seed-ed-section" data-section-id="${section.id}">
          <summary>
            <span class="seed-ed-section-head">
              <ha-icon class="ed-section-icon-preview" data-section-id="${section.id}" icon="${headerIcon}" style="color: ${section.icon_color || colors.icon || '#2196F3'};"></ha-icon>
              <input type="text" class="ed-section-name" data-section-id="${section.id}" value="${section.name}" placeholder="Section Name" style="flex:1;" />
              <span class="seed-ed-section-type-badge">Entities</span>
              <ha-icon class="seed-ed-icon-btn ed-move-up ${idx === 0 ? 'disabled' : ''}" icon="mdi:arrow-up-bold" data-section-id="${section.id}"></ha-icon>
              <ha-icon class="seed-ed-icon-btn ed-move-down ${idx === sections.length - 1 ? 'disabled' : ''}" icon="mdi:arrow-down-bold" data-section-id="${section.id}"></ha-icon>
              <ha-icon class="seed-ed-icon-btn ed-remove-section" icon="mdi:trash-can-outline" data-section-id="${section.id}"></ha-icon>
            </span>
          </summary>
          <div class="seed-ed-section-body">
            <div class="seed-ed-checkbox-row">
              <input type="checkbox" class="ed-section-show-title" data-section-id="${section.id}" ${section.show_title !== false ? 'checked' : ''} />
              <label>Show Section's Title Row</label>
            </div>
            <div class="seed-ed-checkbox-row">
              <input type="checkbox" class="ed-section-collapsible" data-section-id="${section.id}" ${section.collapsible !== false ? 'checked' : ''} />
              <label>Collapsible Section</label>
            </div>
            ${section.show_title === false ? '<span class="seed-ed-hint">With the title row hidden, this section always renders expanded.</span>' : ''}
            <div class="seed-ed-checkbox-row">
              <input type="checkbox" class="ed-section-chips-only" data-section-id="${section.id}" ${section.chips_only ? 'checked' : ''} />
              <label>Chips Only (every entity in this section renders as just its chip - no row icon or name)</label>
            </div>

            <div class="seed-ed-style-block">
              <div class="seed-ed-style-title">Background</div>
              <div class="seed-ed-checkbox-row">
                <span style="font-size:12px; color:#ccc;">Mode:</span>
                <select class="ed-section-bg-mode" data-section-id="${section.id}">
                  <option value="global" ${(section.bg_mode || 'global') === 'global' ? 'selected' : ''}>Use Global Section Background</option>
                  <option value="custom" ${section.bg_mode === 'custom' ? 'selected' : ''}>Custom</option>
                  <option value="none" ${section.bg_mode === 'none' ? 'selected' : ''}>Transparent</option>
                </select>
              </div>
              ${section.bg_mode === 'custom' ? `
              <div class="seed-ed-style-grid">
                <div class="seed-ed-style-field">
                  <label>Color</label>
                  <input type="color" class="ed-sec-bg-color" data-section-id="${section.id}" value="${section.bg_color || this._config.section_bg_color || '#1c1c1c'}" />
                </div>
              </div>
              ` : ''}
            </div>

            <div class="seed-ed-style-block">
              <div class="seed-ed-style-title">Border</div>
              <div class="seed-ed-checkbox-row">
                <span style="font-size:12px; color:#ccc;">Mode:</span>
                <select class="ed-section-border-mode" data-section-id="${section.id}">
                  <option value="global" ${(section.border_mode || 'global') === 'global' ? 'selected' : ''}>Use Global Section Borders</option>
                  <option value="custom" ${section.border_mode === 'custom' ? 'selected' : ''}>Custom</option>
                  <option value="none" ${section.border_mode === 'none' ? 'selected' : ''}>No Border</option>
                </select>
              </div>
              ${section.border_mode === 'custom' ? `
              <div class="seed-ed-style-grid">
                <div class="seed-ed-style-field">
                  <label>Color</label>
                  <input type="color" class="ed-sec-border-color" data-section-id="${section.id}" value="${section.border_color || colors.border || '#2196F3'}" />
                </div>
              </div>
              <div class="seed-ed-slider-row">
                <label><span>Weight:</span></label>
                <input type="range" class="ed-sec-border-width" data-section-id="${section.id}" min="1" max="8" step="1" value="${section.border_width ?? 1}" />
                <span class="seed-ed-slider-value ed-sec-border-width-value" data-section-id="${section.id}">${section.border_width ?? 1}px</span>
              </div>
              <div class="seed-ed-slider-row">
                <label><span>Corner Radius:</span></label>
                <input type="range" class="ed-sec-border-radius" data-section-id="${section.id}" min="0" max="24" step="1" value="${section.border_radius ?? 12}" />
                <span class="seed-ed-slider-value ed-sec-border-radius-value" data-section-id="${section.id}">${section.border_radius ?? 12}px</span>
              </div>
              <div class="seed-ed-side-toggles">
                <label><input type="checkbox" class="ed-sec-border-side" data-section-id="${section.id}" data-side="top" ${section.border_top !== false ? 'checked' : ''}/> Top</label>
                <label><input type="checkbox" class="ed-sec-border-side" data-section-id="${section.id}" data-side="bottom" ${section.border_bottom !== false ? 'checked' : ''}/> Bottom</label>
                <label><input type="checkbox" class="ed-sec-border-side" data-section-id="${section.id}" data-side="left" ${section.border_left !== false ? 'checked' : ''}/> Left</label>
                <label><input type="checkbox" class="ed-sec-border-side" data-section-id="${section.id}" data-side="right" ${section.border_right !== false ? 'checked' : ''}/> Right</label>
              </div>
              ` : ''}
            </div>

            <div class="seed-ed-style-block">
              <div class="seed-ed-style-title">Glow</div>
              <div class="seed-ed-checkbox-row">
                <span style="font-size:12px; color:#ccc;">Mode:</span>
                <select class="ed-section-glow-mode" data-section-id="${section.id}">
                  <option value="global" ${(section.glow_mode || 'global') === 'global' ? 'selected' : ''}>Use Global Section Glow Settings</option>
                  <option value="custom" ${section.glow_mode === 'custom' ? 'selected' : ''}>Custom</option>
                  <option value="none" ${section.glow_mode === 'none' ? 'selected' : ''}>No Glow</option>
                </select>
              </div>
              ${section.glow_mode === 'custom' ? `
              <div class="seed-ed-style-grid">
                <div class="seed-ed-style-field">
                  <label>Color</label>
                  <input type="color" class="ed-sec-glow-color" data-section-id="${section.id}" value="${section.glow_color || colors.glow || '#2196F3'}" />
                </div>
              </div>
              <div class="seed-ed-checkbox-row">
                <span style="font-size:12px; color:#ccc;">Glow Rule:</span>
                <select class="ed-sec-glow-condition" data-section-id="${section.id}">
                  <option value="always" ${(section.glow_condition || 'always') === 'always' ? 'selected' : ''}>Always</option>
                  <option value="when_expanded" ${section.glow_condition === 'when_expanded' ? 'selected' : ''}>When Expanded</option>
                </select>
              </div>
              <div class="seed-ed-checkbox-row">
                <input type="checkbox" class="ed-sec-glow-borders-only" data-section-id="${section.id}" ${section.glow_borders_only !== false ? 'checked' : ''} />
                <label>Glow stronger on sides with borders</label>
              </div>
              <div class="seed-ed-slider-row">
                <label><span>Intensity:</span></label>
                <input type="range" class="ed-sec-glow-intensity" data-section-id="${section.id}" min="0.25" max="3.0" step="0.05" value="${section.glow_intensity ?? 1.0}" />
                <span class="seed-ed-slider-value ed-sec-glow-intensity-value" data-section-id="${section.id}">${Math.round((section.glow_intensity ?? 1.0) * 100)}%</span>
              </div>
              ` : ''}
            </div>

            <div class="seed-ed-style-block">
              <div class="seed-ed-style-title">Shadow</div>
              <span class="seed-ed-hint" style="margin-bottom:4px;">A plain elevation drop-shadow, separate from the colored Glow effect above.</span>
              <div class="seed-ed-checkbox-row">
                <span style="font-size:12px; color:#ccc;">Mode:</span>
                <select class="ed-section-shadow-mode" data-section-id="${section.id}">
                  <option value="global" ${(section.shadow_mode || 'global') === 'global' ? 'selected' : ''}>Use Global Section Shadow Settings</option>
                  <option value="custom" ${section.shadow_mode === 'custom' ? 'selected' : ''}>Custom</option>
                  <option value="none" ${section.shadow_mode === 'none' ? 'selected' : ''}>No Shadow</option>
                </select>
              </div>
              ${section.shadow_mode === 'custom' ? `
              <div class="seed-ed-style-grid">
                <div class="seed-ed-style-field">
                  <label>Color</label>
                  <input type="color" class="ed-sec-shadow-color" data-section-id="${section.id}" value="${section.shadow_color || this._config.section_shadow_color || '#000000'}" />
                </div>
              </div>
              <div class="seed-ed-slider-row">
                <label><span>X Offset:</span></label>
                <input type="range" class="ed-sec-shadow-x" data-section-id="${section.id}" min="-40" max="40" step="1" value="${section.shadow_x ?? 0}" />
                <span class="seed-ed-slider-value ed-sec-shadow-x-value" data-section-id="${section.id}">${section.shadow_x ?? 0}px</span>
              </div>
              <div class="seed-ed-slider-row">
                <label><span>Y Offset:</span></label>
                <input type="range" class="ed-sec-shadow-y" data-section-id="${section.id}" min="-40" max="40" step="1" value="${section.shadow_y ?? 4}" />
                <span class="seed-ed-slider-value ed-sec-shadow-y-value" data-section-id="${section.id}">${section.shadow_y ?? 4}px</span>
              </div>
              <div class="seed-ed-slider-row">
                <label><span>Blur:</span></label>
                <input type="range" class="ed-sec-shadow-blur" data-section-id="${section.id}" min="0" max="60" step="1" value="${section.shadow_blur ?? 12}" />
                <span class="seed-ed-slider-value ed-sec-shadow-blur-value" data-section-id="${section.id}">${section.shadow_blur ?? 12}px</span>
              </div>
              <div class="seed-ed-slider-row">
                <label><span>Spread:</span></label>
                <input type="range" class="ed-sec-shadow-spread" data-section-id="${section.id}" min="-20" max="20" step="1" value="${section.shadow_spread ?? 0}" />
                <span class="seed-ed-slider-value ed-sec-shadow-spread-value" data-section-id="${section.id}">${section.shadow_spread ?? 0}px</span>
              </div>
              <div class="seed-ed-slider-row">
                <label><span>Opacity:</span></label>
                <input type="range" class="ed-sec-shadow-opacity" data-section-id="${section.id}" min="0" max="1" step="0.05" value="${section.shadow_opacity ?? 0.35}" />
                <span class="seed-ed-slider-value ed-sec-shadow-opacity-value" data-section-id="${section.id}">${Math.round((section.shadow_opacity ?? 0.35) * 100)}%</span>
              </div>
              ` : ''}
            </div>

            <div class="seed-ed-style-block">
              <div class="seed-ed-style-title">Divider</div>
              <div class="seed-ed-checkbox-row">
                <span style="font-size:12px; color:#ccc;">Mode:</span>
                <select class="ed-section-divider-mode" data-section-id="${section.id}">
                  <option value="global" ${(section.divider_mode || 'global') === 'global' ? 'selected' : ''}>Use Global Section Dividers</option>
                  <option value="custom" ${section.divider_mode === 'custom' ? 'selected' : ''}>Custom</option>
                </select>
              </div>
              ${section.divider_mode === 'custom' ? `
              <div class="seed-ed-style-grid">
                <div class="seed-ed-style-field">
                  <label>Color</label>
                  <input type="color" class="ed-sec-divider-color" data-section-id="${section.id}" value="${section.divider_color || colors.section_divider || '#333333'}" />
                </div>
              </div>
              <div class="seed-ed-checkbox-row">
                <input type="checkbox" class="ed-sec-divider-above" data-section-id="${section.id}" ${section.divider_above ? 'checked' : ''} />
                <label>Show divider above this section</label>
              </div>
              <div class="seed-ed-slider-row">
                <label><span>Weight (Above):</span></label>
                <input type="range" class="ed-sec-divider-above-width" data-section-id="${section.id}" min="1" max="8" step="1" value="${section.divider_above_width ?? 1}" />
                <span class="seed-ed-slider-value ed-sec-divider-above-width-value" data-section-id="${section.id}">${section.divider_above_width ?? 1}px</span>
              </div>
              <div class="seed-ed-slider-row">
                <label><span>Length (Above):</span></label>
                <input type="range" class="ed-sec-divider-above-length" data-section-id="${section.id}" min="5" max="100" step="5" value="${section.divider_above_length ?? 100}" />
                <span class="seed-ed-slider-value ed-sec-divider-above-length-value" data-section-id="${section.id}">${section.divider_above_length ?? 100}%</span>
              </div>
              <div class="seed-ed-checkbox-row">
                <input type="checkbox" class="ed-sec-divider-below" data-section-id="${section.id}" ${section.divider_below ? 'checked' : ''} />
                <label>Show divider below this section</label>
              </div>
              <div class="seed-ed-slider-row">
                <label><span>Weight (Below):</span></label>
                <input type="range" class="ed-sec-divider-below-width" data-section-id="${section.id}" min="1" max="8" step="1" value="${section.divider_below_width ?? 1}" />
                <span class="seed-ed-slider-value ed-sec-divider-below-width-value" data-section-id="${section.id}">${section.divider_below_width ?? 1}px</span>
              </div>
              <div class="seed-ed-slider-row">
                <label><span>Length (Below):</span></label>
                <input type="range" class="ed-sec-divider-below-length" data-section-id="${section.id}" min="5" max="100" step="5" value="${section.divider_below_length ?? 100}" />
                <span class="seed-ed-slider-value ed-sec-divider-below-length-value" data-section-id="${section.id}">${section.divider_below_length ?? 100}%</span>
              </div>
              ` : ''}
            </div>

            <div class="seed-ed-style-block">
              <div class="seed-ed-style-title">Row Visuals</div>
              <div class="seed-ed-checkbox-row">
                <span style="font-size:12px; color:#ccc;">Mode:</span>
                <select class="ed-section-row-visuals-mode" data-section-id="${section.id}">
                  <option value="global" ${(section.row_visuals_mode || 'global') === 'global' ? 'selected' : ''}>Use Global Child Row Visuals</option>
                  <option value="custom" ${section.row_visuals_mode === 'custom' ? 'selected' : ''}>Custom</option>
                </select>
              </div>
              ${section.row_visuals_mode === 'custom' ? `
              <div class="seed-ed-slider-row">
                <label><span>Row Indent:</span></label>
                <input type="range" class="ed-sec-row-indent" data-section-id="${section.id}" min="0" max="48" step="2" value="${section.row_indent ?? 16}" />
                <span class="seed-ed-slider-value ed-sec-row-indent-value" data-section-id="${section.id}">${section.row_indent ?? 16}px</span>
              </div>
              <div class="seed-ed-checkbox-row">
                <input type="checkbox" class="ed-sec-row-border-enabled" data-section-id="${section.id}" ${section.row_border_enabled ? 'checked' : ''} />
                <label>Enable row borders</label>
              </div>
              <div class="seed-ed-style-grid">
                <div class="seed-ed-style-field">
                  <label>Border Color</label>
                  <input type="color" class="ed-sec-row-border-color" data-section-id="${section.id}" value="${section.row_border_color || colors.row_border || '#333333'}" />
                </div>
              </div>
              <div class="seed-ed-slider-row">
                <label><span>Border Weight:</span></label>
                <input type="range" class="ed-sec-row-border-width" data-section-id="${section.id}" min="1" max="8" step="1" value="${section.row_border_width ?? 1}" />
                <span class="seed-ed-slider-value ed-sec-row-border-width-value" data-section-id="${section.id}">${section.row_border_width ?? 1}px</span>
              </div>
              <div class="seed-ed-slider-row">
                <label><span>Corner Radius:</span></label>
                <input type="range" class="ed-sec-row-border-radius" data-section-id="${section.id}" min="0" max="16" step="1" value="${section.row_border_radius ?? 4}" />
                <span class="seed-ed-slider-value ed-sec-row-border-radius-value" data-section-id="${section.id}">${section.row_border_radius ?? 4}px</span>
              </div>
              <div class="seed-ed-side-toggles">
                <label><input type="checkbox" class="ed-sec-row-border-side" data-section-id="${section.id}" data-side="top" ${section.row_border_top !== false ? 'checked' : ''}/> Top</label>
                <label><input type="checkbox" class="ed-sec-row-border-side" data-section-id="${section.id}" data-side="bottom" ${section.row_border_bottom !== false ? 'checked' : ''}/> Bottom</label>
                <label><input type="checkbox" class="ed-sec-row-border-side" data-section-id="${section.id}" data-side="left" ${section.row_border_left !== false ? 'checked' : ''}/> Left</label>
                <label><input type="checkbox" class="ed-sec-row-border-side" data-section-id="${section.id}" data-side="right" ${section.row_border_right !== false ? 'checked' : ''}/> Right</label>
              </div>
              ` : ''}
            </div>

            <div class="seed-ed-style-block">
              <div class="seed-ed-style-title">Section header style</div>
              <div class="seed-ed-style-grid">
                <div class="seed-ed-style-field">
                  <label>Icon</label>
                  <div class="seed-ed-icon-input-row">
                    <ha-icon class="ed-section-icon-livepreview" data-section-id="${section.id}" icon="${headerIcon}"></ha-icon>
                    <input type="text" class="ed-section-icon" data-section-id="${section.id}" value="${section.icon || ''}" placeholder="mdi:folder-outline" />
                  </div>
                </div>
                <div class="seed-ed-style-field">
                  <label>Icon color</label>
                  <input type="color" class="ed-section-icon-color" data-section-id="${section.id}" value="${section.icon_color || colors.icon || '#2196F3'}" />
                </div>
                <div class="seed-ed-style-field">
                  <label>Icon size (px)</label>
                  <input type="number" class="ed-section-icon-size" data-section-id="${section.id}" min="8" max="48" value="${section.icon_size}" />
                </div>
                <div class="seed-ed-style-field">
                  <label>Title color</label>
                  <input type="color" class="ed-section-title-color" data-section-id="${section.id}" value="${section.title_color || colors.text || '#e1e1e1'}" />
                </div>
                <div class="seed-ed-style-field">
                  <label>Title font size (px)</label>
                  <input type="number" class="ed-section-title-size" data-section-id="${section.id}" min="8" max="40" value="${section.title_font_size}" />
                </div>
              </div>
              <div class="seed-ed-font-row">
                <label>Weight:
                  <select class="ed-section-title-weight" data-section-id="${section.id}">
                    <option value="400" ${section.title_font_weight == 400 ? 'selected' : ''}>Normal</option>
                    <option value="600" ${section.title_font_weight == 600 ? 'selected' : ''}>Semibold</option>
                    <option value="700" ${section.title_font_weight == 700 ? 'selected' : ''}>Bold</option>
                    <option value="900" ${section.title_font_weight == 900 ? 'selected' : ''}>Black</option>
                  </select>
                </label>
                <label><input type="checkbox" class="ed-section-title-italic" data-section-id="${section.id}" ${section.title_font_style === 'italic' ? 'checked' : ''} /> Italic</label>
              </div>
            </div>

            <div class="seed-ed-style-block">
              <div class="seed-ed-style-title">Entity row style (applies to every entity in this section)</div>
              <div class="seed-ed-style-grid">
                <div class="seed-ed-style-field">
                  <label>Icon color</label>
                  <input type="color" class="ed-entity-icon-color" data-section-id="${section.id}" value="${section.entity_icon_color || colors.icon || '#2196F3'}" />
                </div>
                <div class="seed-ed-style-field">
                  <label>Icon size (px)</label>
                  <input type="number" class="ed-entity-icon-size" data-section-id="${section.id}" min="8" max="44" value="${section.entity_icon_size}" />
                </div>
                <div class="seed-ed-style-field">
                  <label>Text color</label>
                  <input type="color" class="ed-entity-text-color" data-section-id="${section.id}" value="${section.entity_text_color || colors.text || '#e1e1e1'}" />
                </div>
                <div class="seed-ed-style-field">
                  <label>Font size (px)</label>
                  <input type="number" class="ed-entity-font-size" data-section-id="${section.id}" min="8" max="36" value="${section.entity_font_size}" />
                </div>
              </div>
              <div class="seed-ed-font-row">
                <label>Weight:
                  <select class="ed-entity-font-weight" data-section-id="${section.id}">
                    <option value="400" ${section.entity_font_weight == 400 ? 'selected' : ''}>Normal</option>
                    <option value="600" ${section.entity_font_weight == 600 ? 'selected' : ''}>Semibold</option>
                    <option value="700" ${section.entity_font_weight == 700 ? 'selected' : ''}>Bold</option>
                    <option value="900" ${section.entity_font_weight == 900 ? 'selected' : ''}>Black</option>
                  </select>
                </label>
                <label><input type="checkbox" class="ed-entity-font-italic" data-section-id="${section.id}" ${section.entity_font_style === 'italic' ? 'checked' : ''} /> Italic</label>
              </div>
            </div>

            <div class="seed-ed-style-block">
              <div class="seed-ed-style-title">Chip style (audio/video format chips in this section)</div>
              <div class="seed-ed-style-grid">
                <div class="seed-ed-style-field">
                  <label>Background</label>
                  <input type="color" class="ed-chip-bg" data-section-id="${section.id}" value="${section.chip_bg || colors.chip_bg || '#2196F3'}" />
                </div>
                <div class="seed-ed-style-field">
                  <label>Border</label>
                  <input type="color" class="ed-chip-border-color" data-section-id="${section.id}" value="${section.chip_border_color || colors.chip_border || '#2196F3'}" />
                </div>
                <div class="seed-ed-style-field">
                  <label>Text</label>
                  <input type="color" class="ed-chip-text-color" data-section-id="${section.id}" value="${section.chip_text_color || colors.chip_text || '#64b5f6'}" />
                </div>
              </div>
              <div class="seed-ed-slider-row">
                <label><span>Chip Scale:</span></label>
                <input type="range" class="ed-chip-scale" data-section-id="${section.id}" min="0.5" max="2.5" step="0.05" value="${section.chip_scale || 1.0}" />
                <span class="seed-ed-slider-value ed-chip-scale-value" data-section-id="${section.id}">${Math.round((section.chip_scale || 1.0) * 100)}%</span>
              </div>
              <div class="seed-ed-checkbox-row">
                <input type="checkbox" class="ed-chip-show-icon" data-section-id="${section.id}" ${section.chip_show_icon !== false ? 'checked' : ''} />
                <label>Show icon on chip</label>
              </div>
              <div class="seed-ed-checkbox-row">
                <span style="font-size:12px; color:#ccc;">Chip icon:</span>
                <select class="ed-chip-icon-source" data-section-id="${section.id}">
                  <option value="auto" ${(section.chip_icon_source || 'auto') === 'auto' ? 'selected' : ''}>Auto (audio/video detection)</option>
                  <option value="entity" ${section.chip_icon_source === 'entity' ? 'selected' : ''}>Entity's own icon</option>
                  <option value="section" ${section.chip_icon_source === 'section' ? 'selected' : ''}>This section's icon</option>
                  <option value="none" ${section.chip_icon_source === 'none' ? 'selected' : ''}>None</option>
                </select>
              </div>
              <div class="seed-ed-checkbox-row">
                <input type="checkbox" class="ed-chip-show-name" data-section-id="${section.id}" ${section.chip_show_name ? 'checked' : ''} />
                <label>Show the entity's (stripped) name in the chip</label>
              </div>
              <div class="seed-ed-checkbox-row">
                <input type="checkbox" class="ed-chip-hide-when-off" data-section-id="${section.id}" ${section.chip_hide_when_off ? 'checked' : ''} />
                <label>Hide chip if entity is off, unknown, or unavailable</label>
              </div>
              <div class="seed-ed-checkbox-row">
                <span style="font-size:12px; color:#ccc;">Layout (Chips Only sections):</span>
                <select class="ed-chip-layout" data-section-id="${section.id}">
                  <option value="wrap" ${(section.chip_layout || 'wrap') === 'wrap' ? 'selected' : ''}>Wrap (flows left to right)</option>
                  <option value="column" ${section.chip_layout === 'column' ? 'selected' : ''}>Column (one per line)</option>
                  <option value="grid" ${section.chip_layout === 'grid' ? 'selected' : ''}>Grid (equal-width columns)</option>
                </select>
              </div>
              <div class="seed-ed-checkbox-row">
                <span style="font-size:12px; color:#ccc;">Shape:</span>
                <select class="ed-chip-shape" data-section-id="${section.id}">
                  <option value="pill" ${(section.chip_shape || 'pill') === 'pill' ? 'selected' : ''}>Pill</option>
                  <option value="rounded" ${section.chip_shape === 'rounded' ? 'selected' : ''}>Rounded</option>
                  <option value="square" ${section.chip_shape === 'square' ? 'selected' : ''}>Square</option>
                </select>
              </div>
              ${section.chip_shape === 'rounded' ? `
              <div class="seed-ed-slider-row">
                <label><span>Corner Radius:</span></label>
                <input type="range" class="ed-chip-radius" data-section-id="${section.id}" min="0" max="24" step="1" value="${section.chip_radius ?? 8}" />
                <span class="seed-ed-slider-value ed-chip-radius-value" data-section-id="${section.id}">${section.chip_radius ?? 8}px</span>
              </div>
              ` : ''}
            </div>

            ${showEntityList ? `
              <input type="text" class="seed-ed-search" placeholder="Search entities..." data-section-id="${section.id}" />
              <div class="seed-ed-entity-list" data-section-id="${section.id}">${entityListHtml}</div>
            ` : entityListHtml}
          </div>
        </details>
      `;
    });

    html += `<div class="seed-ed-add-btn" id="ed-add-section"><ha-icon icon="mdi:plus"></ha-icon>Add Entities Section</div>`;

    // YAML config preview
    html += `
      <details class="seed-ed-row">
        <summary><ha-icon class="seed-ed-summary-icon" icon="mdi:code-braces"></ha-icon>YAML Config Preview</summary>
        <div class="seed-ed-collapsible-body">
        <pre class="seed-ed-yaml" id="seed-yaml-preview"></pre>
        <div class="seed-ed-hint-text">💡 This YAML shows the current configuration. The rendered card preview appears in the right panel.</div>
        </div>
      </details>
    `;

    html += `</div>`;

    this.innerHTML = html;
    this.attachEditorListeners();
    this._updateYamlPreview();
    this._rendered = true;
    this._lastKnownJSON = JSON.stringify(this._config);

    // Restore open/scroll state after re-render
    this._restoreOpenState();
    this._restoreScrollState();

    // Save open state when user toggles sections
    this.querySelectorAll('details.seed-ed-section').forEach(details => {
      details.addEventListener('toggle', () => {
        this._saveOpenState();
      });
    });
  }

  attachEditorListeners() {
    const editorAutoCloseEl = this.querySelector('#ed-editor-auto-close');
    if (editorAutoCloseEl) {
      editorAutoCloseEl.addEventListener('change', () => {
        this._editorAutoClose = editorAutoCloseEl.checked;
      });
    }

    // Accordion behavior: when auto-close is on, opening one collapsible
    // area closes the others in its own group (top-level settings boxes
    // and per-section boxes are treated as two separate groups).
    this.querySelectorAll('details.seed-ed-row').forEach(d => {
      d.addEventListener('toggle', () => {
        if (d.open && this._editorAutoClose) {
          this.querySelectorAll('details.seed-ed-row').forEach(other => {
            if (other !== d) other.open = false;
          });
        }
      });
    });

    this.querySelectorAll('details.seed-ed-section').forEach(d => {
      d.addEventListener('toggle', () => {
        if (d.open && this._editorAutoClose) {
          this.querySelectorAll('details.seed-ed-section').forEach(other => {
            if (other !== d) other.open = false;
          });
        }
      });
    });

    const titleEl = this.querySelector('#ed-title');
    if (titleEl) {
      titleEl.addEventListener('input', () => {
        this._config.title = titleEl.value;
        this._fireConfigChanged();
      });
    }

    const addFilterTextBtn = this.querySelector('#ed-add-filter-text');
    const filterTextInputEl = this.querySelector('#ed-filter-text-input');
    if (addFilterTextBtn && filterTextInputEl) {
      const addFilterText = () => {
        const val = filterTextInputEl.value.trim();
        if (!val) return;
        const current = normalizeEntityFilterTexts(this._config);
        if (!current.includes(val)) {
          this._config.entity_filter_texts = [...current, val];
          delete this._config.entity_filter; // fully migrated off the old single-value field
          this._fireConfigChanged();
          this.renderEditor();
        }
        filterTextInputEl.value = '';
      };
      addFilterTextBtn.addEventListener('click', addFilterText);
      filterTextInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addFilterText();
        }
      });
    }

    this.querySelectorAll('#ed-filter-text-tags .filter-text-remove').forEach(el => {
      el.addEventListener('click', () => {
        const val = el.dataset.value;
        this._config.entity_filter_texts = normalizeEntityFilterTexts(this._config).filter(t => t !== val);
        this._fireConfigChanged();
        this.renderEditor();
      });
    });

    this.querySelectorAll('.ed-filter-type-toggle').forEach(el => {
      el.addEventListener('change', () => {
        const current = new Set(normalizeFilterTypes(this._config));
        if (el.checked) current.add(el.dataset.type);
        else current.delete(el.dataset.type);
        this._config.entity_filter_types = Array.from(current);
        delete this._config.entity_filter_type; // fully migrated off the old single-value field
        this._fireConfigChanged();
        this.renderEditor();
      });
    });

    const addFilterLabelBtn = this.querySelector('#ed-add-filter-label');
    const filterLabelPickerEl = this.querySelector('#ed-filter-label-picker');
    if (addFilterLabelBtn && filterLabelPickerEl) {
      addFilterLabelBtn.addEventListener('click', () => {
        const val = filterLabelPickerEl.value;
        if (!val) return;
        const current = normalizeEntityFilterLabels(this._config);
        if (!current.includes(val)) {
          this._config.entity_filter_labels = [...current, val];
          delete this._config.entity_filter_label; // fully migrated off the old single-value field
          this._fireConfigChanged();
          this.renderEditor();
        }
      });
    }

    this.querySelectorAll('#ed-filter-label-tags .filter-label-remove').forEach(el => {
      el.addEventListener('click', () => {
        const val = el.dataset.value;
        this._config.entity_filter_labels = normalizeEntityFilterLabels(this._config).filter(id => id !== val);
        this._fireConfigChanged();
        this.renderEditor();
      });
    });

    const addFilterGroupBtn = this.querySelector('#ed-add-filter-group');
    const filterGroupPickerEl = this.querySelector('#ed-filter-group-picker');
    if (addFilterGroupBtn && filterGroupPickerEl) {
      addFilterGroupBtn.addEventListener('click', () => {
        const val = filterGroupPickerEl.value;
        if (!val) return;
        const current = normalizeEntityFilterGroups(this._config);
        if (!current.includes(val)) {
          this._config.entity_filter_groups = [...current, val];
          delete this._config.entity_filter_group; // fully migrated off the old single-value field
          this._fireConfigChanged();
          this.renderEditor();
        }
      });
    }

    this.querySelectorAll('#ed-filter-group-tags .filter-group-remove').forEach(el => {
      el.addEventListener('click', () => {
        const val = el.dataset.value;
        this._config.entity_filter_groups = normalizeEntityFilterGroups(this._config).filter(id => id !== val);
        this._fireConfigChanged();
        this.renderEditor();
      });
    });

    // Title panel
    const titleIconEl = this.querySelector('#ed-title-icon');
    if (titleIconEl) {
      titleIconEl.addEventListener('input', () => {
        this._config.title_icon = titleIconEl.value;
        this._fireConfigChanged();
      });
    }

    const titleFontSizeEl = this.querySelector('#ed-title-font-size');
    if (titleFontSizeEl) {
      titleFontSizeEl.addEventListener('input', () => {
        const val = parseInt(titleFontSizeEl.value, 10);
        this._config.title_font_size = val;
        const label = this.querySelector('#ed-title-font-size-value');
        if (label) label.textContent = `${val}px`;
        this._fireConfigChanged();
      });
    }

    const titleIconSizeEl = this.querySelector('#ed-title-icon-size');
    if (titleIconSizeEl) {
      titleIconSizeEl.addEventListener('input', () => {
        const val = parseInt(titleIconSizeEl.value, 10);
        this._config.title_icon_size = val;
        const label = this.querySelector('#ed-title-icon-size-value');
        if (label) label.textContent = `${val}px`;
        this._fireConfigChanged();
      });
    }

    const titleFontWeightEl = this.querySelector('#ed-title-font-weight');
    if (titleFontWeightEl) {
      titleFontWeightEl.addEventListener('change', () => {
        this._config.title_font_weight = parseInt(titleFontWeightEl.value, 10);
        this._fireConfigChanged();
      });
    }

    const titleItalicEl = this.querySelector('#ed-title-italic');
    if (titleItalicEl) {
      titleItalicEl.addEventListener('change', () => {
        this._config.title_font_style = titleItalicEl.checked ? 'italic' : 'normal';
        this._fireConfigChanged();
      });
    }

    const titleTextColorEl = this.querySelector('#ed-color-title-text');
    if (titleTextColorEl) {
      titleTextColorEl.addEventListener('input', () => {
        this._config.title_text_color = titleTextColorEl.value;
        this._fireConfigChanged();
      });
    }

    const titleIconColorEl = this.querySelector('#ed-color-title-icon');
    if (titleIconColorEl) {
      titleIconColorEl.addEventListener('input', () => {
        this._config.title_icon_color = titleIconColorEl.value;
        this._fireConfigChanged();
      });
    }

    // Section header visibility / behavior
    const showSectionCountEl = this.querySelector('#ed-show-section-count');
    if (showSectionCountEl) {
      showSectionCountEl.addEventListener('change', () => {
        this._config.show_section_count = showSectionCountEl.checked;
        this._fireConfigChanged();
      });
    }

    const autoCloseEl = this.querySelector('#ed-auto-close-sections');
    if (autoCloseEl) {
      autoCloseEl.addEventListener('change', () => {
        this._config.auto_close_sections = autoCloseEl.checked;
        this._fireConfigChanged();
      });
    }

    // Glow settings
    const glowBordersOnlyEl = this.querySelector('#ed-glow-borders-only');
    if (glowBordersOnlyEl) {
      glowBordersOnlyEl.addEventListener('change', () => {
        this._config.glow_borders_only = glowBordersOnlyEl.checked;
        this._fireConfigChanged();
      });
    }

    const glowConditionEl = this.querySelector('#ed-glow-condition');
    if (glowConditionEl) {
      glowConditionEl.addEventListener('change', () => {
        this._config.glow_condition = glowConditionEl.value;
        this._fireConfigChanged();
      });
    }

    const glowIntensityEl = this.querySelector('#ed-glow-intensity');
    if (glowIntensityEl) {
      glowIntensityEl.addEventListener('input', () => {
        const val = parseFloat(glowIntensityEl.value);
        this._config.glow_intensity = val;
        const label = this.querySelector('#ed-glow-intensity-value');
        if (label) label.textContent = `${Math.round(val * 100)}%`;
        this._fireConfigChanged();
      });
    }

    // Scaling sliders
    const scaleMap = {
      'ed-scale-slider': 'scale',
      'ed-icon-scale': 'icon_scale',
      'ed-title-icon-scale': 'title_icon_scale',
      'ed-title-text-scale': 'title_text_scale',
      'ed-entity-text-scale': 'entity_text_scale'
    };
    Object.entries(scaleMap).forEach(([elId, configKey]) => {
      const el = this.querySelector(`#${elId}`);
      if (!el) return;
      el.addEventListener('input', () => {
        const val = parseFloat(el.value) || 1.0;
        this._config[configKey] = val;
        const label = this.querySelector(`#${elId}-value`);
        if (label) label.textContent = `${Math.round(val * 100)}%`;
        this._fireConfigChanged();
      });
    });

    const sliderMaxWidthEl = this.querySelector('#ed-slider-max-width');
    if (sliderMaxWidthEl) {
      sliderMaxWidthEl.addEventListener('input', () => {
        const val = parseInt(sliderMaxWidthEl.value, 10) || 240;
        this._config.slider_max_width = val;
        const label = this.querySelector('#ed-slider-max-width-value');
        if (label) label.textContent = `${val}px`;
        this._fireConfigChanged();
      });
    }

    ['border', 'glow', 'icon'].forEach(key => {
      const el = this.querySelector(`#ed-color-${key}`);
      if (el) {
        el.addEventListener('input', () => {
          this._config.colors = { ...this._config.colors, [key]: el.value };
          this._fireConfigChanged();
        });
      }
    });

    // Section (group) border controls
    const showSectionBorderEl = this.querySelector('#ed-show-section-border');
    if (showSectionBorderEl) {
      showSectionBorderEl.addEventListener('change', () => {
        this._config.show_section_border = showSectionBorderEl.checked;
        this._fireConfigChanged();
      });
    }

    const sectionBorderWidthEl = this.querySelector('#ed-section-border-width');
    if (sectionBorderWidthEl) {
      sectionBorderWidthEl.addEventListener('input', () => {
        const val = parseInt(sectionBorderWidthEl.value, 10);
        this._config.section_border_width = val;
        const label = this.querySelector('#ed-section-border-width-value');
        if (label) label.textContent = `${val}px`;
        this._fireConfigChanged();
      });
    }

    const sectionRadiusEl = this.querySelector('#ed-section-border-radius');
    if (sectionRadiusEl) {
      sectionRadiusEl.addEventListener('input', () => {
        const val = parseInt(sectionRadiusEl.value, 10);
        this._config.section_border_radius = val;
        const label = this.querySelector('#ed-section-border-radius-value');
        if (label) label.textContent = `${val}px`;
        this._fireConfigChanged();
      });
    }

    this.querySelectorAll('.ed-section-border-side').forEach(el => {
      el.addEventListener('change', () => {
        this._config[`section_border_${el.dataset.side}`] = el.checked;
        this._fireConfigChanged();
      });
    });

    this.querySelectorAll('.ed-section-corner').forEach(el => {
      el.addEventListener('change', () => {
        const corners = this._config.section_border_corners || [true, true, true, true];
        corners[parseInt(el.dataset.corner, 10)] = el.checked;
        this._config.section_border_corners = corners;
        this._fireConfigChanged();
      });
    });

    // Global Section Background & Shadow controls
    const sectionBgColorEl = this.querySelector('#ed-color-section-bg');
    const sectionBgTransparentEl = this.querySelector('#ed-section-bg-transparent');
    if (sectionBgColorEl) {
      sectionBgColorEl.addEventListener('input', () => {
        this._config.section_bg_color = sectionBgColorEl.value;
        if (sectionBgTransparentEl) sectionBgTransparentEl.checked = false;
        this._fireConfigChanged();
      });
    }
    if (sectionBgTransparentEl) {
      sectionBgTransparentEl.addEventListener('change', () => {
        this._config.section_bg_color = sectionBgTransparentEl.checked ? '' : (sectionBgColorEl ? sectionBgColorEl.value : '#1c1c1c');
        this._fireConfigChanged();
      });
    }

    const sectionShadowEnabledEl = this.querySelector('#ed-section-shadow-enabled');
    if (sectionShadowEnabledEl) {
      sectionShadowEnabledEl.addEventListener('change', () => {
        this._config.section_shadow_enabled = sectionShadowEnabledEl.checked;
        this._fireConfigChanged();
      });
    }

    const sectionShadowColorEl = this.querySelector('#ed-color-section-shadow');
    if (sectionShadowColorEl) {
      sectionShadowColorEl.addEventListener('input', () => {
        this._config.section_shadow_color = sectionShadowColorEl.value;
        this._fireConfigChanged();
      });
    }

    ['x', 'y', 'blur', 'spread'].forEach(suffix => {
      const key = `section_shadow_${suffix}`;
      const el = this.querySelector(`#ed-section-shadow-${suffix}`);
      if (el) {
        el.addEventListener('input', () => {
          const val = parseInt(el.value, 10);
          this._config[key] = val;
          const label = this.querySelector(`#ed-section-shadow-${suffix}-value`);
          if (label) label.textContent = `${val}px`;
          this._fireConfigChanged();
        });
      }
    });

    const sectionShadowOpacityEl = this.querySelector('#ed-section-shadow-opacity');
    if (sectionShadowOpacityEl) {
      sectionShadowOpacityEl.addEventListener('input', () => {
        const val = parseFloat(sectionShadowOpacityEl.value) || 0;
        this._config.section_shadow_opacity = val;
        const label = this.querySelector('#ed-section-shadow-opacity-value');
        if (label) label.textContent = `${Math.round(val * 100)}%`;
        this._fireConfigChanged();
      });
    }

    // Section divider controls
    const showSectionDividerEl = this.querySelector('#ed-show-section-divider');
    if (showSectionDividerEl) {
      showSectionDividerEl.addEventListener('change', () => {
        this._config.show_section_divider = showSectionDividerEl.checked;
        this._fireConfigChanged();
      });
    }

    const sectionDividerColorEl = this.querySelector('#ed-color-section-divider');
    if (sectionDividerColorEl) {
      sectionDividerColorEl.addEventListener('input', () => {
        this._config.colors = { ...this._config.colors, section_divider: sectionDividerColorEl.value };
        this._fireConfigChanged();
      });
    }

    const sectionDividerWidthEl = this.querySelector('#ed-section-divider-width');
    if (sectionDividerWidthEl) {
      sectionDividerWidthEl.addEventListener('input', () => {
        const val = parseInt(sectionDividerWidthEl.value, 10);
        this._config.section_divider_width = val;
        const label = this.querySelector('#ed-section-divider-width-value');
        if (label) label.textContent = `${val}px`;
        this._fireConfigChanged();
      });
    }

    const sectionDividerLengthEl = this.querySelector('#ed-section-divider-length');
    if (sectionDividerLengthEl) {
      sectionDividerLengthEl.addEventListener('input', () => {
        const val = parseInt(sectionDividerLengthEl.value, 10);
        this._config.section_divider_length = val;
        const label = this.querySelector('#ed-section-divider-length-value');
        if (label) label.textContent = `${val}%`;
        this._fireConfigChanged();
      });
    }

    const showSectionDividerBottomEl = this.querySelector('#ed-show-section-divider-bottom');
    if (showSectionDividerBottomEl) {
      showSectionDividerBottomEl.addEventListener('change', () => {
        this._config.show_section_divider_bottom = showSectionDividerBottomEl.checked;
        this._fireConfigChanged();
      });
    }

    const sectionDividerBottomWidthEl = this.querySelector('#ed-section-divider-bottom-width');
    if (sectionDividerBottomWidthEl) {
      sectionDividerBottomWidthEl.addEventListener('input', () => {
        const val = parseInt(sectionDividerBottomWidthEl.value, 10);
        this._config.section_divider_bottom_width = val;
        const label = this.querySelector('#ed-section-divider-bottom-width-value');
        if (label) label.textContent = `${val}px`;
        this._fireConfigChanged();
      });
    }

    const sectionDividerBottomLengthEl = this.querySelector('#ed-section-divider-bottom-length');
    if (sectionDividerBottomLengthEl) {
      sectionDividerBottomLengthEl.addEventListener('input', () => {
        const val = parseInt(sectionDividerBottomLengthEl.value, 10);
        this._config.section_divider_bottom_length = val;
        const label = this.querySelector('#ed-section-divider-bottom-length-value');
        if (label) label.textContent = `${val}%`;
        this._fireConfigChanged();
      });
    }

    // Row indent
    const rowIndentEl = this.querySelector('#ed-row-indent');
    if (rowIndentEl) {
      rowIndentEl.addEventListener('input', () => {
        const val = parseInt(rowIndentEl.value, 10);
        this._config.row_indent = val;
        const label = this.querySelector('#ed-row-indent-value');
        if (label) label.textContent = `${val}px`;
        this._fireConfigChanged();
      });
    }

    // Child row border controls
    const showRowBorderEl = this.querySelector('#ed-show-row-border');
    if (showRowBorderEl) {
      showRowBorderEl.addEventListener('change', () => {
        this._config.show_row_border = showRowBorderEl.checked;
        this._fireConfigChanged();
      });
    }

    const rowBorderColorEl = this.querySelector('#ed-color-row-border');
    if (rowBorderColorEl) {
      rowBorderColorEl.addEventListener('input', () => {
        this._config.colors = { ...this._config.colors, row_border: rowBorderColorEl.value };
        this._fireConfigChanged();
      });
    }

    const rowBorderWidthEl = this.querySelector('#ed-row-border-width');
    if (rowBorderWidthEl) {
      rowBorderWidthEl.addEventListener('input', () => {
        const val = parseInt(rowBorderWidthEl.value, 10);
        this._config.row_border_width = val;
        const label = this.querySelector('#ed-row-border-width-value');
        if (label) label.textContent = `${val}px`;
        this._fireConfigChanged();
      });
    }

    const rowRadiusEl = this.querySelector('#ed-row-border-radius');
    if (rowRadiusEl) {
      rowRadiusEl.addEventListener('input', () => {
        const val = parseInt(rowRadiusEl.value, 10);
        this._config.row_border_radius = val;
        const label = this.querySelector('#ed-row-border-radius-value');
        if (label) label.textContent = `${val}px`;
        this._fireConfigChanged();
      });
    }

    this.querySelectorAll('.ed-row-border-side').forEach(el => {
      el.addEventListener('change', () => {
        this._config[`row_border_${el.dataset.side}`] = el.checked;
        this._fireConfigChanged();
      });
    });

    this.querySelectorAll('.ed-row-corner').forEach(el => {
      el.addEventListener('change', () => {
        const corners = this._config.row_border_corners || [true, true, true, true];
        corners[parseInt(el.dataset.corner, 10)] = el.checked;
        this._config.row_border_corners = corners;
        this._fireConfigChanged();
      });
    });

    const rowFirstBorderTopEl = this.querySelector('#ed-row-first-border-top');
    if (rowFirstBorderTopEl) {
      rowFirstBorderTopEl.addEventListener('change', () => {
        this._config.row_first_border_top = rowFirstBorderTopEl.checked;
        this._fireConfigChanged();
      });
    }

    const rowLastBorderBottomEl = this.querySelector('#ed-row-last-border-bottom');
    if (rowLastBorderBottomEl) {
      rowLastBorderBottomEl.addEventListener('change', () => {
        this._config.row_last_border_bottom = rowLastBorderBottomEl.checked;
        this._fireConfigChanged();
      });
    }

    // Entity name string stripping
    const addStripBtn = this.querySelector('#ed-add-strip-string');
    const stripInputEl = this.querySelector('#ed-strip-string-input');
    if (addStripBtn && stripInputEl) {
      const addStrip = () => {
        const val = stripInputEl.value.trim();
        if (!val) return;
        const current = this._config.strip_entity_strings || [];
        if (!current.includes(val)) {
          this._config.strip_entity_strings = [...current, val];
          this._fireConfigChanged();
          this.renderEditor();
        }
        stripInputEl.value = '';
      };
      addStripBtn.addEventListener('click', addStrip);
      stripInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addStrip();
        }
      });
    }

    this.querySelectorAll('#ed-strip-tags .strip-remove').forEach(el => {
      el.addEventListener('click', () => {
        const val = el.dataset.value;
        this._config.strip_entity_strings = (this._config.strip_entity_strings || []).filter(s => s !== val);
        this._fireConfigChanged();
        this.renderEditor();
      });
    });

    // Card Wrapper
    const cardCollapsibleEl = this.querySelector('#ed-card-collapsible');
    if (cardCollapsibleEl) {
      // Toggling collapsible shows/hides the chevron sub-option, so re-render.
      cardCollapsibleEl.addEventListener('change', () => {
        this._config.card_collapsible = cardCollapsibleEl.checked;
        this._fireConfigChanged();
        this.renderEditor();
      });
    }

    const cardBorderEnabledEl = this.querySelector('#ed-card-border-enabled');
    if (cardBorderEnabledEl) {
      cardBorderEnabledEl.addEventListener('change', () => {
        this._config.card_border_enabled = cardBorderEnabledEl.checked;
        this._fireConfigChanged();
      });
    }

    const cardBorderColorEl = this.querySelector('#ed-color-card-border');
    if (cardBorderColorEl) {
      cardBorderColorEl.addEventListener('input', () => {
        this._config.colors = { ...this._config.colors, card_border: cardBorderColorEl.value };
        this._fireConfigChanged();
      });
    }

    const cardBorderWidthEl = this.querySelector('#ed-card-border-width');
    if (cardBorderWidthEl) {
      cardBorderWidthEl.addEventListener('input', () => {
        const val = parseInt(cardBorderWidthEl.value, 10);
        this._config.card_border_width = val;
        const label = this.querySelector('#ed-card-border-width-value');
        if (label) label.textContent = `${val}px`;
        this._fireConfigChanged();
      });
    }

    const cardBorderRadiusEl = this.querySelector('#ed-card-border-radius');
    if (cardBorderRadiusEl) {
      cardBorderRadiusEl.addEventListener('input', () => {
        const val = parseInt(cardBorderRadiusEl.value, 10);
        this._config.card_border_radius = val;
        const label = this.querySelector('#ed-card-border-radius-value');
        if (label) label.textContent = `${val}px`;
        this._fireConfigChanged();
      });
    }

    this.querySelectorAll('.ed-card-border-side').forEach(el => {
      el.addEventListener('change', () => {
        this._config[`card_border_${el.dataset.side}`] = el.checked;
        this._fireConfigChanged();
      });
    });

    this.querySelectorAll('.ed-card-corner').forEach(el => {
      el.addEventListener('change', () => {
        const corners = this._config.card_border_corners || [true, true, true, true];
        corners[parseInt(el.dataset.corner, 10)] = el.checked;
        this._config.card_border_corners = corners;
        this._fireConfigChanged();
      });
    });

    const cardGlowConditionEl = this.querySelector('#ed-card-glow-condition');
    if (cardGlowConditionEl) {
      cardGlowConditionEl.addEventListener('change', () => {
        this._config.card_glow_condition = cardGlowConditionEl.value;
        this._fireConfigChanged();
        this.renderEditor();
      });
    }

    const cardGlowEntityEl = this.querySelector('#ed-card-glow-entity');
    if (cardGlowEntityEl) {
      cardGlowEntityEl.addEventListener('input', () => {
        this._config.card_glow_entity = cardGlowEntityEl.value;
        this._fireConfigChanged();
      });
    }

    const cardGlowBordersOnlyEl = this.querySelector('#ed-card-glow-borders-only');
    if (cardGlowBordersOnlyEl) {
      cardGlowBordersOnlyEl.addEventListener('change', () => {
        this._config.card_glow_borders_only = cardGlowBordersOnlyEl.checked;
        this._fireConfigChanged();
      });
    }

    const cardGlowIntensityEl = this.querySelector('#ed-card-glow-intensity');
    if (cardGlowIntensityEl) {
      cardGlowIntensityEl.addEventListener('input', () => {
        const val = parseFloat(cardGlowIntensityEl.value);
        this._config.card_glow_intensity = val;
        const label = this.querySelector('#ed-card-glow-intensity-value');
        if (label) label.textContent = `${Math.round(val * 100)}%`;
        this._fireConfigChanged();
      });
    }

    const cardGlowColorEl = this.querySelector('#ed-color-card-glow');
    if (cardGlowColorEl) {
      cardGlowColorEl.addEventListener('input', () => {
        this._config.colors = { ...this._config.colors, card_glow: cardGlowColorEl.value };
        this._fireConfigChanged();
      });
    }

    // Card wrapper Background & Shadow controls
    const cardBgColorEl = this.querySelector('#ed-color-card-bg');
    const cardBgTransparentEl = this.querySelector('#ed-card-bg-transparent');
    if (cardBgColorEl) {
      cardBgColorEl.addEventListener('input', () => {
        this._config.card_bg_color = cardBgColorEl.value;
        if (cardBgTransparentEl) cardBgTransparentEl.checked = false;
        this._fireConfigChanged();
      });
    }
    if (cardBgTransparentEl) {
      cardBgTransparentEl.addEventListener('change', () => {
        this._config.card_bg_color = cardBgTransparentEl.checked ? '' : (cardBgColorEl ? cardBgColorEl.value : '#1c1c1c');
        this._fireConfigChanged();
      });
    }

    const cardShadowEnabledEl = this.querySelector('#ed-card-shadow-enabled');
    if (cardShadowEnabledEl) {
      cardShadowEnabledEl.addEventListener('change', () => {
        this._config.card_shadow_enabled = cardShadowEnabledEl.checked;
        this._fireConfigChanged();
      });
    }

    const cardShadowColorEl = this.querySelector('#ed-color-card-shadow');
    if (cardShadowColorEl) {
      cardShadowColorEl.addEventListener('input', () => {
        this._config.card_shadow_color = cardShadowColorEl.value;
        this._fireConfigChanged();
      });
    }

    ['x', 'y', 'blur', 'spread'].forEach(suffix => {
      const key = `card_shadow_${suffix}`;
      const el = this.querySelector(`#ed-card-shadow-${suffix}`);
      if (el) {
        el.addEventListener('input', () => {
          const val = parseInt(el.value, 10);
          this._config[key] = val;
          const label = this.querySelector(`#ed-card-shadow-${suffix}-value`);
          if (label) label.textContent = `${val}px`;
          this._fireConfigChanged();
        });
      }
    });

    const cardShadowOpacityEl = this.querySelector('#ed-card-shadow-opacity');
    if (cardShadowOpacityEl) {
      cardShadowOpacityEl.addEventListener('input', () => {
        const val = parseFloat(cardShadowOpacityEl.value) || 0;
        this._config.card_shadow_opacity = val;
        const label = this.querySelector('#ed-card-shadow-opacity-value');
        if (label) label.textContent = `${Math.round(val * 100)}%`;
        this._fireConfigChanged();
      });
    }

    // Title extras / entity icon colors
    const showLastChangedEl = this.querySelector('#ed-show-last-changed');
    if (showLastChangedEl) {
      showLastChangedEl.addEventListener('change', () => {
        this._config.show_last_changed = showLastChangedEl.checked;
        this._fireConfigChanged();
      });
    }

    const grayIconsWhenOffEl = this.querySelector('#ed-gray-icons-when-off');
    if (grayIconsWhenOffEl) {
      grayIconsWhenOffEl.addEventListener('change', () => {
        this._config.gray_icons_when_off = grayIconsWhenOffEl.checked;
        this._fireConfigChanged();
      });
    }

    const showCardChevronEl = this.querySelector('#ed-show-card-chevron');
    if (showCardChevronEl) {
      showCardChevronEl.addEventListener('change', () => {
        this._config.show_card_chevron = showCardChevronEl.checked;
        this._fireConfigChanged();
      });
    }

    const showTitleEl = this.querySelector('#ed-show-title');
    if (showTitleEl) {
      showTitleEl.addEventListener('change', () => {
        this._config.show_title = showTitleEl.checked;
        this._fireConfigChanged();
      });
    }

    const showTitleIconEl = this.querySelector('#ed-show-title-icon');
    if (showTitleIconEl) {
      showTitleIconEl.addEventListener('change', () => {
        this._config.show_title_icon = showTitleIconEl.checked;
        this._fireConfigChanged();
      });
    }

    // Add section (entities only)
    const addSectionBtn = this.querySelector('#ed-add-section');
    if (addSectionBtn) {
      addSectionBtn.addEventListener('click', () => {
        this._config.sections.push(normalizeSection({
          name: 'New Section',
          collapsible: true,
          entities: [],
          type: 'entities'
        }));
        this._fireConfigChanged();
        this.renderEditor();
      });
    }

    // Move section
    this.querySelectorAll('.ed-move-up').forEach(el => {
      el.addEventListener('click', () => {
        if (el.classList.contains('disabled')) return;
        const sections = this._config.sections;
        const idx = sections.findIndex(s => s.id === el.dataset.sectionId);
        if (idx > 0) {
          [sections[idx], sections[idx - 1]] = [sections[idx - 1], sections[idx]];
          this._fireConfigChanged();
          this.renderEditor();
        }
      });
    });

    this.querySelectorAll('.ed-move-down').forEach(el => {
      el.addEventListener('click', () => {
        if (el.classList.contains('disabled')) return;
        const sections = this._config.sections;
        const idx = sections.findIndex(s => s.id === el.dataset.sectionId);
        if (idx < sections.length - 1) {
          [sections[idx], sections[idx + 1]] = [sections[idx + 1], sections[idx]];
          this._fireConfigChanged();
          this.renderEditor();
        }
      });
    });

    // Remove section (entities only)
    this.querySelectorAll('.ed-remove-section').forEach(el => {
      el.addEventListener('click', () => {
        this._config.sections = this._config.sections.filter(
          s => s.id !== el.dataset.sectionId
        );
        this._fireConfigChanged();
        this.renderEditor();
      });
    });

    // Section name
    this.querySelectorAll('.ed-section-name').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.name = el.value;
          this._fireConfigChanged();
        }
      });
    });

    // Section title row visibility (per section)
    this.querySelectorAll('.ed-section-show-title').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.show_title = el.checked;
          this._fireConfigChanged();
          this.renderEditor();
        }
      });
    });

    // Section collapsible - ALL sections get this option now
    this.querySelectorAll('.ed-section-collapsible').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.collapsible = el.checked;
          this._fireConfigChanged();
        }
      });
    });

    // Per-section Background override
    this.querySelectorAll('.ed-section-bg-mode').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.bg_mode = el.value;
          this._fireConfigChanged();
          this.renderEditor();
        }
      });
    });

    this.querySelectorAll('.ed-sec-bg-color').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.bg_color = el.value;
          this._fireConfigChanged();
        }
      });
    });

    // Per-section Border override
    this.querySelectorAll('.ed-section-border-mode').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.border_mode = el.value;
          this._fireConfigChanged();
          this.renderEditor();
        }
      });
    });

    this.querySelectorAll('.ed-sec-border-color').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.border_color = el.value;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-sec-border-width').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          const val = parseInt(el.value, 10);
          section.border_width = val;
          const label = this.querySelector(`.ed-sec-border-width-value[data-section-id="${el.dataset.sectionId}"]`);
          if (label) label.textContent = `${val}px`;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-sec-border-radius').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          const val = parseInt(el.value, 10);
          section.border_radius = val;
          const label = this.querySelector(`.ed-sec-border-radius-value[data-section-id="${el.dataset.sectionId}"]`);
          if (label) label.textContent = `${val}px`;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-sec-border-side').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section[`border_${el.dataset.side}`] = el.checked;
          this._fireConfigChanged();
        }
      });
    });

    // Per-section Glow override
    this.querySelectorAll('.ed-section-glow-mode').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.glow_mode = el.value;
          this._fireConfigChanged();
          this.renderEditor();
        }
      });
    });

    this.querySelectorAll('.ed-sec-glow-color').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.glow_color = el.value;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-sec-glow-condition').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.glow_condition = el.value;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-sec-glow-borders-only').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.glow_borders_only = el.checked;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-sec-glow-intensity').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          const val = parseFloat(el.value) || 1.0;
          section.glow_intensity = val;
          const label = this.querySelector(`.ed-sec-glow-intensity-value[data-section-id="${el.dataset.sectionId}"]`);
          if (label) label.textContent = `${Math.round(val * 100)}%`;
          this._fireConfigChanged();
        }
      });
    });

    // Per-section Shadow override
    this.querySelectorAll('.ed-section-shadow-mode').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.shadow_mode = el.value;
          this._fireConfigChanged();
          this.renderEditor();
        }
      });
    });

    this.querySelectorAll('.ed-sec-shadow-color').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.shadow_color = el.value;
          this._fireConfigChanged();
        }
      });
    });

    ['x', 'y', 'blur', 'spread'].forEach(suffix => {
      const key = `shadow_${suffix}`;
      this.querySelectorAll(`.ed-sec-shadow-${suffix}`).forEach(el => {
        el.addEventListener('input', () => {
          const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
          if (section) {
            const val = parseInt(el.value, 10);
            section[key] = val;
            const label = this.querySelector(`.ed-sec-shadow-${suffix}-value[data-section-id="${el.dataset.sectionId}"]`);
            if (label) label.textContent = `${val}px`;
            this._fireConfigChanged();
          }
        });
      });
    });

    this.querySelectorAll('.ed-sec-shadow-opacity').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          const val = parseFloat(el.value) || 0;
          section.shadow_opacity = val;
          const label = this.querySelector(`.ed-sec-shadow-opacity-value[data-section-id="${el.dataset.sectionId}"]`);
          if (label) label.textContent = `${Math.round(val * 100)}%`;
          this._fireConfigChanged();
        }
      });
    });

    // Per-section Divider override
    this.querySelectorAll('.ed-section-divider-mode').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.divider_mode = el.value;
          this._fireConfigChanged();
          this.renderEditor();
        }
      });
    });

    this.querySelectorAll('.ed-sec-divider-color').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.divider_color = el.value;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-sec-divider-above').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.divider_above = el.checked;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-sec-divider-above-width').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          const val = parseInt(el.value, 10);
          section.divider_above_width = val;
          const label = this.querySelector(`.ed-sec-divider-above-width-value[data-section-id="${el.dataset.sectionId}"]`);
          if (label) label.textContent = `${val}px`;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-sec-divider-above-length').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          const val = parseInt(el.value, 10);
          section.divider_above_length = val;
          const label = this.querySelector(`.ed-sec-divider-above-length-value[data-section-id="${el.dataset.sectionId}"]`);
          if (label) label.textContent = `${val}%`;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-sec-divider-below').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.divider_below = el.checked;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-sec-divider-below-width').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          const val = parseInt(el.value, 10);
          section.divider_below_width = val;
          const label = this.querySelector(`.ed-sec-divider-below-width-value[data-section-id="${el.dataset.sectionId}"]`);
          if (label) label.textContent = `${val}px`;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-sec-divider-below-length').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          const val = parseInt(el.value, 10);
          section.divider_below_length = val;
          const label = this.querySelector(`.ed-sec-divider-below-length-value[data-section-id="${el.dataset.sectionId}"]`);
          if (label) label.textContent = `${val}%`;
          this._fireConfigChanged();
        }
      });
    });

    // Per-section Row Visuals override
    this.querySelectorAll('.ed-section-row-visuals-mode').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.row_visuals_mode = el.value;
          this._fireConfigChanged();
          this.renderEditor();
        }
      });
    });

    this.querySelectorAll('.ed-sec-row-indent').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          const val = parseInt(el.value, 10);
          section.row_indent = val;
          const label = this.querySelector(`.ed-sec-row-indent-value[data-section-id="${el.dataset.sectionId}"]`);
          if (label) label.textContent = `${val}px`;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-sec-row-border-enabled').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.row_border_enabled = el.checked;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-sec-row-border-color').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.row_border_color = el.value;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-sec-row-border-width').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          const val = parseInt(el.value, 10);
          section.row_border_width = val;
          const label = this.querySelector(`.ed-sec-row-border-width-value[data-section-id="${el.dataset.sectionId}"]`);
          if (label) label.textContent = `${val}px`;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-sec-row-border-radius').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          const val = parseInt(el.value, 10);
          section.row_border_radius = val;
          const label = this.querySelector(`.ed-sec-row-border-radius-value[data-section-id="${el.dataset.sectionId}"]`);
          if (label) label.textContent = `${val}px`;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-sec-row-border-side').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section[`row_border_${el.dataset.side}`] = el.checked;
          this._fireConfigChanged();
        }
      });
    });

    // Section header style: icon (text entry, with a live preview)
    this.querySelectorAll('.ed-section-icon').forEach(el => {
      el.addEventListener('input', () => {
        const preview = this.querySelector(`.ed-section-icon-livepreview[data-section-id="${el.dataset.sectionId}"]`);
        if (preview && el.value) preview.setAttribute('icon', el.value);
      });
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.icon = el.value.trim();
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-section-icon-color').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.icon_color = el.value;
          const preview = this.querySelector(`.ed-section-icon-preview[data-section-id="${el.dataset.sectionId}"]`);
          if (preview) preview.style.color = el.value;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-section-icon-size').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        const value = parseInt(el.value, 10);
        if (section && !Number.isNaN(value)) {
          section.icon_size = value;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-section-title-color').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.title_color = el.value;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-section-title-size').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        const value = parseInt(el.value, 10);
        if (section && !Number.isNaN(value)) {
          section.title_font_size = value;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-section-title-weight').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.title_font_weight = parseInt(el.value, 10);
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-section-title-italic').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.title_font_style = el.checked ? 'italic' : 'normal';
          this._fireConfigChanged();
        }
      });
    });

    // Entity row style (per section)
    this.querySelectorAll('.ed-entity-icon-color').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.entity_icon_color = el.value;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-entity-icon-size').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        const value = parseInt(el.value, 10);
        if (section && !Number.isNaN(value)) {
          section.entity_icon_size = value;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-entity-text-color').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.entity_text_color = el.value;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-entity-font-size').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        const value = parseInt(el.value, 10);
        if (section && !Number.isNaN(value)) {
          section.entity_font_size = value;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-entity-font-weight').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.entity_font_weight = parseInt(el.value, 10);
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-entity-font-italic').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.entity_font_style = el.checked ? 'italic' : 'normal';
          this._fireConfigChanged();
        }
      });
    });

    // Chips Only toggle
    this.querySelectorAll('.ed-section-chips-only').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.chips_only = el.checked;
          this._fireConfigChanged();
          this.renderEditor();
        }
      });
    });

    // Per-section chip style
    this.querySelectorAll('.ed-chip-bg').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.chip_bg = el.value;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-chip-border-color').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.chip_border_color = el.value;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-chip-text-color').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.chip_text_color = el.value;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-chip-scale').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          const val = parseFloat(el.value) || 1.0;
          section.chip_scale = val;
          const label = this.querySelector(`.ed-chip-scale-value[data-section-id="${el.dataset.sectionId}"]`);
          if (label) label.textContent = `${Math.round(val * 100)}%`;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-chip-show-icon').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.chip_show_icon = el.checked;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-chip-icon-source').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.chip_icon_source = el.value;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-chip-show-name').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.chip_show_name = el.checked;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-chip-hide-when-off').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.chip_hide_when_off = el.checked;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-chip-layout').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.chip_layout = el.value;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-chip-shape').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.chip_shape = el.value;
          this._fireConfigChanged();
          this.renderEditor();
        }
      });
    });

    this.querySelectorAll('.ed-chip-radius').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          const val = parseInt(el.value, 10);
          section.chip_radius = val;
          const label = this.querySelector(`.ed-chip-radius-value[data-section-id="${el.dataset.sectionId}"]`);
          if (label) label.textContent = `${val}px`;
          this._fireConfigChanged();
        }
      });
    });

    // Entity checkboxes
    this.querySelectorAll('.ed-entity-checkbox').forEach(el => {
      el.addEventListener('change', () => {
        const sectionId = el.dataset.sectionId;
        const entityId = el.dataset.entityId;
        const section = this._config.sections.find(s => s.id === sectionId);
        if (!section) return;
        const entities = new Set(section.entities || []);
        if (el.checked) entities.add(entityId);
        else entities.delete(entityId);
        section.entities = Array.from(entities);
        this._fireConfigChanged();
      });
    });

    // Search
    this.querySelectorAll('.seed-ed-search').forEach(el => {
      el.addEventListener('input', () => {
        const term = el.value.toLowerCase();
        const list = this.querySelector(
          `.seed-ed-entity-list[data-section-id="${el.dataset.sectionId}"]`
        );
        if (!list) return;
        list.querySelectorAll('.seed-ed-entity-item').forEach(item => {
          const hay = item.dataset.search || '';
          item.style.display = hay.includes(term) ? '' : 'none';
        });
      });
    });

  }
}

// ============ REGISTER CUSTOM ELEMENTS ============
console.log(`📦 Registering easy-entity-styler-card custom elements... [${BUILD_NUMBER}]`);

customElements.define('easy-entity-styler-card', SEEDCard);
customElements.define('easy-entity-styler-card-editor', SEEDCardEditor);

console.log('[easy-entity-styler-card] Loaded successfully -', BUILD_NUMBER);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'easy-entity-styler-card',
  name: 'Smart & Easy Entity Display Card',
  description: 'Smart & Easy Entity Display Card',
});

console.log(`✅ easy-entity-styler-card registered successfully! [${BUILD_NUMBER}]`);
