// ============================================================================
// Easy Entity Stlyer Card for Home Assistant
//
//   A highly customizable dashboard card that organizes and displays your entities in a clean way
//   while giving you full control over the look and behavior of your entity cards.
//   Bonus: 1000x easier and better performance than card-mod.
//
//   Hundreds of styling options — card-wide, per section, and per entity
//   Reusable Rule Sets, Frame Presets, and a shared Preset Library
//   Entity Tables with rule-based color / icons / sorting
//    ... all in a super easy to use Visual Editor — YAML optional, never required
//
// Version: v2026.08.29.186
//
// Author:  LTek
// Card:    https://github.com/Ltek/easy-entity-styler-card
//
// ============================================================================
// Debug logging - disabled by default
let DEBUG = false;
function debugLog(...args) {
  if (DEBUG) console.log('[easy-entity-styler-card]', ...args);
}

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

// Strip user-configured substrings out of a friendly name (e.g. remove a
// redundant integration/device prefix or suffix from every entity name shown
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

// One Entity Display Rule: compares an entity's live state to either a static
// value or another entity's live state. Rules are evaluated per entity, in
// order, and joined to the running result by each rule's `join` (AND/OR).
//   operator: 'eq' (value is equal to) | 'ne' (value is not equal to)
//   compare_type: 'value' (static text in `value`) | 'entity' (state of
//     `compare_entity`)
//   join: 'and' | 'or' — how this rule combines with the result of the rules
//     above it (ignored for the first rule)
function normalizeRule(r) {
  r = r || {};
  return {
    operator: r.operator === 'ne' ? 'ne' : 'eq',
    compare_type: r.compare_type === 'entity' ? 'entity' : 'value',
    value: r.value != null ? String(r.value) : '',
    compare_entity: r.compare_entity || '',
    join: r.join === 'or' ? 'or' : 'and'
  };
}

// Normalize a chip tap/hold action config. Supported actions:
//   none         - do nothing
//   more-info    - open the entity's more-info dialog (uses action_entity or
//                  the chip's own entity)
//   toggle       - call homeassistant.toggle on the target entity
//   navigate     - navigate to navigation_path (a Lovelace path)
//   url          - open url_path in a new tab
//   call-service - call `service` ("domain.service") with service_data
// action_entity overrides the target entity for more-info / toggle (blank =
// use the chip's own entity).
const CHIP_ACTIONS = ['none', 'more-info', 'toggle', 'navigate', 'url', 'call-service'];
function normalizeAction(a, defaultAction) {
  a = a || {};
  const action = CHIP_ACTIONS.includes(a.action) ? a.action : (defaultAction || 'none');
  return {
    action,
    action_entity: a.action_entity || '',
    navigation_path: a.navigation_path || '',
    url_path: a.url_path || '',
    service: a.service || '',
    service_data: (a.service_data && typeof a.service_data === 'object') ? a.service_data : {}
  };
}

// Per-section style groups and the config keys each owns. The editor's Reset
// button reverts just its group's keys to normalizeSection() defaults. Keys
// listed here are exactly the ones each style block's controls edit.
const SEED_STYLE_GROUPS = {
  // NOTE: frame groups (background/border/glow/shadow) were removed — a section's
  // frame is defined solely by Frame Styles now. Only layout/content groups
  // still have inline controls + a per-group Reset.
  row_visuals: ['row_visuals_mode', 'row_indent', 'row_border_enabled', 'row_border_width', 'row_border_radius', 'row_border_top', 'row_border_bottom', 'row_border_left', 'row_border_right', 'row_border_corners', 'row_border_color'],
  header: ['icon', 'icon_color', 'icon_size', 'title_color', 'title_font_size', 'title_font_weight', 'title_font_style', 'title_indent'],
  entity_row: ['entity_icon_color', 'entity_icon_size', 'entity_text_color', 'entity_font_size', 'entity_font_weight', 'entity_font_style'],
  chip: ['chip_bg', 'chip_border_color', 'chip_text_color', 'chip_scale', 'chip_show_icon', 'chip_icon_source', 'chip_show_name', 'chip_hide_state', 'chip_hide_off', 'chip_hide_unknown', 'chip_hide_unavailable', 'chip_layout', 'chip_shape', 'chip_radius'],
  chip_actions: ['chip_tap_action', 'chip_hold_action'],
  count: ['count_mode', 'count_prefix', 'count_color', 'count_font_size', 'count_font_weight', 'count_font_style']
};

// Evaluate a section's ordered Entity Display Rules against one entity.
// Returns true if the entity should be shown. Empty rule list = always show.
// Left-to-right evaluation with each rule's own AND/OR join (no precedence
// beyond order, matching the documented "processed top to bottom" behavior).
function entityPassesRules(entityId, rules, hass) {
  if (!Array.isArray(rules) || rules.length === 0) return true;
  const st = hass && hass.states ? hass.states[entityId] : null;
  const entityVal = st ? st.state : '';

  let result = null;
  for (const rule of rules) {
    let target;
    if (rule.compare_type === 'entity') {
      const cmp = rule.compare_entity && hass && hass.states ? hass.states[rule.compare_entity] : null;
      target = cmp ? cmp.state : '';
    } else {
      target = rule.value != null ? String(rule.value) : '';
    }
    // Case-insensitive, trimmed comparison so "On" matches "on" etc.
    const a = String(entityVal).trim().toLowerCase();
    const b = String(target).trim().toLowerCase();
    const pass = rule.operator === 'ne' ? a !== b : a === b;

    if (result === null) {
      result = pass;
    } else if (rule.join === 'or') {
      result = result || pass;
    } else {
      result = result && pass;
    }
  }
  return result === null ? true : result;
}

// ===========================================================================
// ACTIVITY TABLE — value / condition / filter engine
// ---------------------------------------------------------------------------
// Shared, declarative primitives that power the activity_table section type:
//   ValueRef   - "what value are we looking at?" (state, attribute, area, …)
//   Condition  - "does that value match?" (eq/lt/between/is_on/in/regex/…)
//   RuleSet    - ordered Condition->result list (first match wins + default),
//                used identically for color rules, icon rules and sort weights
//   Filter     - include (AND) / exclude (OR) FilterRule lists with one level
//                of any_of / all_of nesting, over addressable entity fields.
// The same engine backs every "based on entity state / column value" feature,
// so there is exactly one place that decides what a value is and whether it
// matches.
// ===========================================================================

// Escape a string for safe interpolation into HTML/attribute contexts. Entity
// names, icon strings and rule results are all user/HA-derived, so every
// activity-table interpolation runs through this.
function escapeHtml(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Short "2 h 5 m" / "45 m" / "30 s" duration, matching the template tables.
function formatDurationShort(sec) {
  if (sec == null || Number.isNaN(sec)) return '';
  sec = Math.max(0, Math.floor(sec));
  if (sec < 60) return sec + ' s';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0 && m > 0) return h + ' h ' + m + ' m';
  if (h > 0) return h + ' h';
  return m + ' m';
}

// ---- Attribute-array table helpers (row-per-array-element sources) ----
// A unix-seconds timestamp -> local clock time like "6:00 AM".
function formatTsTime(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return '';
  const d = new Date(n * 1000);
  let h = d.getHours(); const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${m < 10 ? '0' + m : m} ${ampm}`;
}
// A unix-seconds timestamp -> "Today" / "Yest" / "M/D" (local), mirroring the
// native template's fmt_date.
function formatTsDate(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return '';
  const d = new Date(n * 1000);
  const now = new Date();
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const yest = new Date(now.getTime() - 86400000);
  if (sameDay(d, now)) return 'Today';
  if (sameDay(d, yest)) return 'Yest';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
// Seconds -> "1d 2h 3m" (omitting zero leading units). Seconds are only shown
// when the total is UNDER a minute (e.g. "29s"); at >= 1 minute the seconds
// component is dropped ("50m", "7h 25m") - this also stops the display from
// ticking every second for long-running durations, cutting re-renders.
function formatDurationLong(secs) {
  let s = Number(secs);
  if (!Number.isFinite(s) || s < 0) return '';
  s = Math.floor(s);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (s < 60) return sec + 's';
  let out = '';
  if (d > 0) out += d + 'd ';
  if (h > 0) out += h + 'h ';
  if (m > 0) out += m + 'm ';
  return out.trim();
}

// Resolve a field ValueRef against one array ELEMENT (a plain object) into the
// same { raw, num, display, badState } shape as resolveValueRef, so columns,
// color rules, and icon rules all work identically for array-sourced rows.
// `ref.field` names the element key; `ref.transform` adds the timestamp/date/
// duration formats. An `open` element (end == null) makes end-fields render as
// "Now" and lets a live-duration transform compute now-start.
function resolveFieldRef(element, ref, nowSec) {
  ref = ref || {};
  const field = ref.field || '';
  let raw = element ? element[field] : undefined;
  const t = ref.transform || 'none';

  // Open (current) row: end is null/absent.
  const isEnd = field === 'end';
  const open = element && (element.end === null || element.end === undefined);

  let display, num = null, badState = false;
  if (t === 'ts_time') {
    if (isEnd && open) { display = 'Now'; }
    else { display = formatTsTime(raw); }
  } else if (t === 'ts_date') {
    display = formatTsDate(raw);
  } else if (t === 'duration') {
    // If this element is open and has no stored duration, compute it live.
    let secs = raw;
    if ((secs === null || secs === undefined) && open && element && element.start != null) {
      secs = (nowSec != null ? nowSec : Math.floor(Date.now() / 1000)) - Number(element.start);
    }
    num = Number(secs);
    display = formatDurationLong(secs);
  } else {
    if (raw === null || raw === undefined) { badState = true; display = ''; }
    else {
      num = Number(raw); if (Number.isNaN(num)) num = null;
      display = String(raw);
      if (t === 'lower') display = display.toLowerCase();
    }
  }
  if (ref.unit && display && display !== 'Now') display = display + ref.unit;
  return { raw, num, display: display == null ? '' : display, seconds: null, badState, open };
}

// Module-level label-registry cache (label_id -> name). Some HA builds don't
// populate `hass.labels` on the object passed to custom cards, which broke
// label rules two ways: (1) editor dropdowns showed raw ULID ids, and more
// seriously (2) the RENDERER filter couldn't translate an entity's label ids
// to names, so `label eq "RGB Group"` never matched and exclude groups silently
// failed. Both the renderer and editor call ensureLabelRegistry() to populate
// this once over the WS connection; haEntityLabels() consults it as a fallback.
const HA_LABEL_REGISTRY = {};       // label_id -> name
let HA_LABEL_REGISTRY_LOADED = false;
let HA_LABEL_REGISTRY_LOADING = false;

// Fetch the label registry over the WS connection if hass.labels is absent.
// onDone is called (once loaded) so callers can re-render/re-filter.
function ensureLabelRegistry(hass, onDone) {
  if (!hass) return;
  if (hass.labels && Object.keys(hass.labels).length) return; // already have names
  if (HA_LABEL_REGISTRY_LOADED || HA_LABEL_REGISTRY_LOADING) return;
  if (!hass.connection || typeof hass.connection.sendMessagePromise !== 'function') return;
  HA_LABEL_REGISTRY_LOADING = true;
  hass.connection.sendMessagePromise({ type: 'config/label_registry/list' })
    .then(list => {
      (list || []).forEach(l => { if (l && l.label_id) HA_LABEL_REGISTRY[l.label_id] = l.name || l.label_id; });
      HA_LABEL_REGISTRY_LOADED = true;
      HA_LABEL_REGISTRY_LOADING = false;
      if (typeof onDone === 'function') { try { onDone(); } catch (e) {} }
    })
    .catch(() => { HA_LABEL_REGISTRY_LOADING = false; HA_LABEL_REGISTRY_LOADED = true; });
}

// Resolve a label id to a display name: hass.labels first, then the WS cache,
// else the id itself.
function haLabelName(id, hass) {
  if (hass && hass.labels && hass.labels[id] && hass.labels[id].name) return hass.labels[id].name;
  if (HA_LABEL_REGISTRY[id]) return HA_LABEL_REGISTRY[id];
  return id;
}

// area_name(entity) equivalent: entity's own area_id, else its device's.
function haEntityArea(entityId, hass) {
  const reg = hass && hass.entities ? hass.entities[entityId] : null;
  let areaId = reg && reg.area_id ? reg.area_id : null;
  if (!areaId && reg && reg.device_id && hass.devices) {
    const dev = hass.devices[reg.device_id];
    if (dev && dev.area_id) areaId = dev.area_id;
  }
  if (!areaId) return '';
  const area = hass.areas && hass.areas[areaId];
  return area && area.name ? area.name : areaId;
}

// Both label ids AND their human names, so a rule can match by either.
function haEntityLabels(entityId, hass) {
  if (!hass) return [];
  const reg = hass.entities ? hass.entities[entityId] : null;
  // A label may be applied to the ENTITY, its DEVICE, or its AREA. HA's
  // label_entities() returns an entity if any of those carry the label, so we
  // union all three sources here. (Previously only entity labels were read,
  // which missed device-/area-applied labels like "RGB Group".)
  const ids = new Set();
  const addFrom = arr => { if (Array.isArray(arr)) arr.forEach(id => id && ids.add(id)); };

  addFrom(reg && reg.labels);

  const devId = reg && reg.device_id;
  const dev = devId && hass.devices ? hass.devices[devId] : null;
  addFrom(dev && dev.labels);

  // Area: the entity's own area_id, else its device's.
  let areaId = reg && reg.area_id ? reg.area_id : (dev && dev.area_id) || null;
  const area = areaId && hass.areas ? hass.areas[areaId] : null;
  addFrom(area && area.labels);

  // Emit both the label id AND its human display name, so a rule can match by
  // either (the editor exposes names).
  const out = [];
  ids.forEach(id => {
    out.push(id);
    const nm = haLabelName(id, hass);
    if (nm && nm !== id) out.push(nm);
  });
  return out;
}

// group.* entities that list this entity as a member.
// Group entities the given entity belongs to. Covers BOTH legacy YAML groups
// (group.* domain) AND modern Group helpers (the `group` integration, whose
// entities can live in any domain - light.*, switch.*, etc. - and are
// registered with platform 'group'). Membership is the `entity_id` attribute.
function haGroupEntityIds(hass) {
  if (!hass || !hass.states) return [];
  const ids = new Set();
  // Legacy group.* domain entities.
  Object.keys(hass.states).forEach(id => { if (id.indexOf('group.') === 0) ids.add(id); });
  // Group-helper entities (platform 'group') from the entity registry.
  if (hass.entities) {
    Object.keys(hass.entities).forEach(id => {
      const reg = hass.entities[id];
      if (reg && reg.platform === 'group' && hass.states[id]) ids.add(id);
    });
  }
  // Fallback: any entity exposing a group-style `entity_id` members array.
  Object.keys(hass.states).forEach(id => {
    const a = hass.states[id] && hass.states[id].attributes;
    if (a && Array.isArray(a.entity_id)) ids.add(id);
  });
  return [...ids];
}

function haEntityGroups(entityId, hass) {
  const out = [];
  haGroupEntityIds(hass).forEach(gid => {
    const st = hass.states[gid];
    const members = st && st.attributes ? st.attributes.entity_id : null;
    if (Array.isArray(members) && members.includes(entityId)) out.push(gid);
  });
  return out;
}

// Find a "sibling" entity related to entityId, for paired rows like the
// climate temp+humidity table. Two match modes (mirroring the template):
//   'device'       - another entity on the SAME device (optionally filtered by
//                    device_class); matches the template's device_id pairing.
//   'name_replace' - substitute find->replace in the entity_id (e.g.
//                    _temperature -> _humidity); the template's name fallback.
// Returns the sibling entity_id or null.
function findSiblingEntity(entityId, spec, hass) {
  spec = spec || {};
  if (!hass || !hass.states) return null;

  if (spec.match === 'name_replace' && spec.find) {
    const candidate = entityId.split(spec.find).join(spec.replace || '');
    return (candidate !== entityId && hass.states[candidate]) ? candidate : null;
  }

  // Default: same-device match.
  const reg = hass.entities ? hass.entities[entityId] : null;
  const devId = reg && reg.device_id;
  if (!devId) return null;
  const wantClass = spec.device_class || '';
  let found = null;
  Object.keys(hass.states).forEach(id => {
    if (id === entityId || found) return;
    const r = hass.entities ? hass.entities[id] : null;
    if (!r || r.device_id !== devId) return;
    if (wantClass) {
      const st = hass.states[id];
      if (!st || (st.attributes && st.attributes.device_class) !== wantClass) return;
    }
    found = id;
  });
  return found;
}

// Resolve a ValueRef against one entity into { raw, num, display, seconds,
// badState }. `num` is null when the value isn't numeric; `display` is the
// human string (with the "time ago" form for last_changed_ago).
function resolveValueRef(entityId, ref, hass) {
  ref = ref || {};
  const source = ref.source || 'state';

  // 'related' resolves ref.related.value against a sibling entity (paired
  // rows). If no sibling is found, returns a blank/bad value.
  if (source === 'related') {
    const sib = findSiblingEntity(entityId, ref.related || {}, hass);
    if (!sib) return { raw: null, num: null, display: '—', seconds: null, badState: true };
    return resolveValueRef(sib, (ref.related && ref.related.value) || { source: 'state' }, hass);
  }

  const st = hass && hass.states ? hass.states[entityId] : null;
  const attrs = st && st.attributes ? st.attributes : {};

  let raw = null;
  if (source === 'attribute') raw = attrs[ref.attribute];
  else if (source === 'last_changed_ago') raw = (st && st.last_changed)
    ? Math.max(0, Math.floor((Date.now() - new Date(st.last_changed).getTime()) / 1000)) : null;
  else if (source === 'last_changed_time') {
    // Exact local clock time of the last change, e.g. "12:02 PM" (mirrors the
    // template's second time column). Returned pre-formatted in `display`.
    if (st && st.last_changed) {
      const d = new Date(st.last_changed);
      let h = d.getHours(); const m = d.getMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12; if (h === 0) h = 12;
      raw = `${h}:${m < 10 ? '0' + m : m} ${ampm}`;
    } else raw = null;
  }
  else if (source === 'name') raw = attrs.friendly_name || entityId;
  else if (source === 'entity_id') raw = entityId;
  else if (source === 'domain') raw = domainOf(entityId);
  else if (source === 'area') raw = haEntityArea(entityId, hass);
  else if (source === 'integration') {
    const reg = hass && hass.entities ? hass.entities[entityId] : null;
    raw = reg && reg.platform ? reg.platform : '';
  } else raw = st ? st.state : null;

  const badState = raw === null || raw === undefined || raw === 'unknown' || raw === 'unavailable';

  let num = badState ? null : Number(raw);
  if (Number.isNaN(num)) num = null;

  const t = ref.transform || 'none';
  if (num != null) {
    if (t === 'pct_of_255') num = Math.round((num / 255) * 100);
    else if (t === 'multiply100') num = num * 100;
    else if (t === 'round1') num = Math.round(num * 10) / 10;
    else if (t === 'int') num = Math.trunc(num);
  }

  let display;
  if (source === 'last_changed_ago') {
    display = formatDurationShort(raw);
  } else if (badState) {
    display = '—';
  } else if (num != null && t !== 'none' && t !== 'lower') {
    display = String(num);
  } else {
    display = String(raw);
    if (t === 'lower') display = display.toLowerCase();
  }
  if (ref.unit && display !== '—' && display !== '') display = display + ref.unit;

  return { raw, num, display, seconds: source === 'last_changed_ago' ? raw : null, badState };
}

// Apply a Condition's operator to an already-resolved ValueRef.
function applyOp(resolved, cond) {
  const op = cond.op || 'eq';
  const { raw, num, badState } = resolved;
  const ci = cond.case_insensitive !== false; // default case-insensitive
  const norm = v => (ci ? String(v).trim().toLowerCase() : String(v).trim());
  const vals = () => (Array.isArray(cond.values) && cond.values.length ? cond.values : [cond.value]);

  switch (op) {
    case 'is_on':  return String(raw).toLowerCase() === 'on' || raw === true;
    case 'is_off': return String(raw).toLowerCase() === 'off' || raw === false;
    case 'truthy': return !badState && !['off', '0', '', 'false', 'closed', 'locked'].includes(String(raw).toLowerCase());
    case 'unavailable': return badState;
    case 'eq':  return norm(raw) === norm(cond.value);
    case 'ne':  return norm(raw) !== norm(cond.value);
    case 'contains': {
      const hay = norm(raw);
      const list = vals();
      return cond.op2 === 'all' ? list.every(v => hay.includes(norm(v))) : list.some(v => hay.includes(norm(v)));
    }
    case 'not_contains': { const hay = norm(raw); return !vals().some(v => hay.includes(norm(v))); }
    case 'in':     return vals().map(norm).includes(norm(raw));
    case 'not_in': return !vals().map(norm).includes(norm(raw));
    case 'regex':  { try { return new RegExp(cond.value, ci ? 'i' : '').test(String(raw)); } catch (e) { return false; } }
    case 'lt': return num != null && num <  Number(cond.value);
    case 'le': return num != null && num <= Number(cond.value);
    case 'gt': return num != null && num >  Number(cond.value);
    case 'ge': return num != null && num >= Number(cond.value);
    case 'between': return num != null && num >= Number(cond.value) && num <= Number(cond.value2);
    default: return false;
  }
}

// Evaluate a Condition. When cond.ref is omitted, fall back to the column's
// own ValueRef (fallbackRef) - lets a color/icon rule test "this column".
//
// A condition may also be a COMPOUND of sub-conditions, all of which must hold
// (logical AND) - this is how a rule combines value + time, e.g.
//   { all: [ { op: 'is_off' },
//            { ref: { source: 'last_changed_ago' }, op: 'lt', value: 600 } ] }
// means "off AND changed less than 600s (10 min) ago". `any` is the OR form.
function evalCondition(entityId, cond, hass, fallbackRef) {
  if (!cond) return false;
  if (Array.isArray(cond.all)) return cond.all.every(c => evalCondition(entityId, c, hass, fallbackRef));
  if (Array.isArray(cond.any)) return cond.any.some(c => evalCondition(entityId, c, hass, fallbackRef));
  // is_on / is_off / truthy / unavailable are inherently ENTITY-STATE tests.
  // When a rule doesn't name an explicit ref, evaluate them against the state -
  // NOT the column's own value ref. Otherwise a name column (ref: name) makes
  // `is_on` test the friendly-name string, which never equals "on" (that's why
  // an on light's name/brightness/time cells fell through to the grey decay
  // colors instead of white).
  const STATE_OPS = ['is_on', 'is_off', 'truthy', 'unavailable'];
  const ref = cond.ref || (STATE_OPS.includes(cond.op) ? { source: 'state' } : (fallbackRef || { source: 'state' }));
  return applyOp(resolveValueRef(entityId, ref, hass), cond);
}

// First matching rule's result, else the ruleset default (or undefined).
function evalRuleSet(entityId, ruleset, hass, fallbackRef) {
  if (!ruleset) return undefined;
  const rules = Array.isArray(ruleset.rules) ? ruleset.rules : [];
  for (const r of rules) {
    if (evalCondition(entityId, r.when, hass, fallbackRef)) return r.result;
  }
  // Gradient: interpolate a color from value stops. Discrete rules above take
  // precedence (so you can special-case e.g. "off" before the ramp). The mapped
  // value comes from the gradient's own ref, else the column's value ref.
  if (ruleset.gradient && ruleset.gradient.stops && ruleset.gradient.stops.length) {
    const ref = ruleset.gradient.ref || fallbackRef || { source: 'state' };
    const resolved = resolveValueRef(entityId, ref, hass);
    const col = interpolateGradient(ruleset.gradient, resolved.num);
    if (col) return col;
  }
  return ruleset.default;
}

// Condition eval against one array ELEMENT (attribute-array rows). A condition's
// `when` may carry its own `field` (else it falls back to the column's field via
// fallbackFieldRef). Reuses applyOp so all string/numeric ops behave identically.
function evalFieldCondition(element, cond, fallbackFieldRef, nowSec) {
  if (!cond) return false;
  if (Array.isArray(cond.all)) return cond.all.every(c => evalFieldCondition(element, c, fallbackFieldRef, nowSec));
  if (Array.isArray(cond.any)) return cond.any.some(c => evalFieldCondition(element, c, fallbackFieldRef, nowSec));
  // A condition may name its own field directly (`field:'mode'`), carry a ref
  // ({ field, transform }), or fall back to the column's own field ref.
  const ref = cond.ref || (cond.field ? { field: cond.field } : null) || fallbackFieldRef || { field: '' };
  return applyOp(resolveFieldRef(element, ref, nowSec), cond);
}

function evalFieldRuleSet(element, ruleset, fallbackFieldRef, nowSec) {
  if (!ruleset) return undefined;
  const rules = Array.isArray(ruleset.rules) ? ruleset.rules : [];
  for (const r of rules) {
    if (evalFieldCondition(element, r.when, fallbackFieldRef, nowSec)) return r.result;
  }
  // Gradient: interpolate from the mapped field's numeric value.
  if (ruleset.gradient && ruleset.gradient.stops && ruleset.gradient.stops.length) {
    const ref = ruleset.gradient.ref || fallbackFieldRef || { field: '' };
    const resolved = resolveFieldRef(element, ref, nowSec);
    const col = interpolateGradient(ruleset.gradient, resolved.num);
    if (col) return col;
  }
  return ruleset.default;
}

// Map a filter field name to the ValueRef that reads it.
function filterFieldToRef(field) {
  if (field === 'domain') return { source: 'domain' };
  if (field === 'device_class') return { source: 'attribute', attribute: 'device_class' };
  if (field === 'area') return { source: 'area' };
  if (field === 'integration') return { source: 'integration' };
  if (field === 'name') return { source: 'name' };
  if (field === 'entity_id') return { source: 'entity_id' };
  if (field === 'last_changed_ago') return { source: 'last_changed_ago' };
  if (field && field.indexOf('attribute:') === 0) return { source: 'attribute', attribute: field.slice(10) };
  return { source: 'state' };
}

// Membership test for multi-valued fields (label / group_member).
function matchSetRule(set, rule) {
  const ci = rule.case_insensitive !== false;
  const norm = v => (ci ? String(v).trim().toLowerCase() : String(v).trim());
  const setN = set.map(norm);
  const list = (Array.isArray(rule.values) && rule.values.length ? rule.values : [rule.value]).map(norm);
  const op = rule.op || 'in';
  const anyMatch = list.some(v => setN.includes(v));
  if (['eq', 'in', 'contains'].includes(op)) return anyMatch;
  if (['ne', 'not_in', 'not_contains'].includes(op)) return !anyMatch;
  return false;
}

// One FilterRule (or an any_of / all_of group) against one entity.
function evalFilterRule(entityId, rule, hass) {
  if (!rule) return true;
  if (Array.isArray(rule.any_of)) return rule.any_of.some(r => evalFilterRule(entityId, r, hass));
  if (Array.isArray(rule.all_of)) return rule.all_of.every(r => evalFilterRule(entityId, r, hass));

  const field = rule.field || 'entity_id';
  if (field === 'label')        return matchSetRule(haEntityLabels(entityId, hass), rule);
  if (field === 'group_member') return matchSetRule(haEntityGroups(entityId, hass), rule);

  return applyOp(resolveValueRef(entityId, filterFieldToRef(field), hass), rule);
}

// Evaluate one rule group against an entity. A group has mode (include|exclude)
// and match (all|any) over its flat rule list. Returns whether the group
// "matches" the entity (the mode is applied by the caller).
function evalRuleGroup(entityId, group, hass) {
  const rules = Array.isArray(group.rules) ? group.rules : [];
  if (!rules.length) return true; // empty group matches everything
  return (group.match === 'any')
    ? rules.some(r => evalFilterRule(entityId, r, hass))
    : rules.every(r => evalFilterRule(entityId, r, hass));
}

// A filter is a flat list of rule GROUPS. An entity is shown iff it matches
// EVERY include group AND matches NO exclude group. (Legacy include/exclude
// rule arrays are converted to groups by filterGroups() below, so this handles
// both shapes.)
function evalFilter(entityId, filter, hass) {
  if (!filter) return true;
  const groups = filterGroups(filter);
  for (const g of groups) {
    const matched = evalRuleGroup(entityId, g, hass);
    if (g.mode === 'exclude') { if (matched) return false; }
    else { if (!matched) return false; } // include group must match
  }
  return true;
}

// Coerce any filter into a flat group list. New shape: filter.groups[].
// Legacy shape: filter.include[] (=> include/ALL group) + filter.exclude[]
// (=> exclude/ANY group), preserving the original semantics exactly.
function filterGroups(filter) {
  if (!filter) return [];
  if (Array.isArray(filter.groups)) return filter.groups;
  const out = [];
  const inc = Array.isArray(filter.include) ? filter.include : [];
  const exc = Array.isArray(filter.exclude) ? filter.exclude : [];
  if (inc.length) out.push({ mode: 'include', match: 'all', rules: inc });
  if (exc.length) out.push({ mode: 'exclude', match: 'any', rules: exc });
  return out;
}

// ===========================================================================
// NAMED RULE SETS
// ---------------------------------------------------------------------------
// A Rule Set is a named, reusable membership definition (a filter). Defined
// once at the card level (config.rule_sets) and referenced by sections. A Rule
// Set defines ONLY which entities surface - never sort, columns, or styling
// (those live on the section). "Select specific entities" is just a rule:
//   { field: 'entity_id', op: 'in', values: ['light.a','light.b'] }
// which the existing engine already evaluates.
// ===========================================================================

let _rsSeq = 0;
function _rsId() { _rsSeq += 1; return 'rs_' + _rsSeq.toString(36) + Math.random().toString(36).slice(2, 6); }

function normalizeRuleSetDef(rs) {
  rs = rs || {};
  return {
    id: rs.id || _rsId(),
    name: rs.name != null && String(rs.name).trim() ? String(rs.name) : 'Rule Set',
    filter: normalizeFilterDef(rs.filter)
  };
}

// Normalize a section's rule-set references: [{ ref: <rule_set id>, mode }].
function normalizeSectionRuleSets(list) {
  if (!Array.isArray(list)) return [];
  return list.map(r => ({
    ref: r && r.ref ? String(r.ref) : '',
    mode: r && r.mode === 'static' ? 'static' : 'dynamic'
  })).filter(r => r.ref);
}

// Resolve the full set of entity ids a section should show, unioned across all
// its assigned rule sets:
//   - dynamic refs  -> recompute live from the set's filter every call
//   - static refs   -> use the frozen ids the section stored (section.entities)
//   - legacy: a section with entities[] and NO refs renders that list as-is
// Returns a de-duplicated, filter-order-stable id array (section sort is
// applied later by the caller).
function resolveSectionEntityIds(section, ruleSetsById, hass) {
  const refs = Array.isArray(section.rule_sets) ? section.rule_sets : [];
  if (!refs.length) {
    // No rule-set refs: legacy behavior - the section's own entities[] list.
    return Array.isArray(section.entities) ? section.entities.slice() : [];
  }
  const allIds = hass && hass.states ? Object.keys(hass.states) : [];
  const seen = new Set();
  const out = [];
  const push = id => { if (id && !seen.has(id)) { seen.add(id); out.push(id); } };

  refs.forEach(r => {
    if (r.mode === 'static') {
      // Frozen at populate-time into section.entities (scoped by ref id when
      // available, else the section's flat entities[]).
      const frozen = (section.static_entities && section.static_entities[r.ref])
        || (refs.length === 1 ? section.entities : null) || [];
      frozen.forEach(push);
    } else {
      const rs = ruleSetsById[r.ref];
      if (rs) allIds.filter(id => evalFilter(id, rs.filter, hass)).forEach(push);
    }
  });
  return out;
}

// Run a rule set's filter against all entities -> matched id list (for the
// "populate static" / "update sections" actions).
function evalRuleSetMembers(ruleSet, hass) {
  if (!ruleSet || !hass || !hass.states) return [];
  return Object.keys(hass.states).filter(id => evalFilter(id, ruleSet.filter, hass));
}

// True if a section carries a non-empty inline filter (old activity_table
// format) that hasn't yet been converted to a named rule set.
function _sectionHasInlineFilter(s) {
  const f = s && s.filter;
  if (!f) return false;
  // New groups shape: any group with rules.
  if (Array.isArray(f.groups)) return f.groups.some(g => Array.isArray(g.rules) && g.rules.length);
  // Legacy shape.
  const inc = Array.isArray(f.include) ? f.include : [];
  const exc = Array.isArray(f.exclude) ? f.exclude : [];
  return (inc.length + exc.length) > 0;
}

// Normalize the card-level rule_sets array + one-time migration of legacy
// inline section.filter definitions into named rule sets. Returns
// { rule_sets, sections } with sections rewritten to reference the sets.
// Migration (Option 3): a section with an inline filter and no rule-set refs
// gets a generated global rule set (named after the section) and a DYNAMIC ref;
// its inline filter is dropped. Idempotent - runs cleanly on already-migrated
// configs (no inline filters left => no-op).
function buildRuleSetsAndSections(config) {
  const rawSections = Array.isArray(config.sections) ? config.sections : [];
  const ruleSets = Array.isArray(config.rule_sets) ? config.rule_sets.map(normalizeRuleSetDef) : [];

  const sections = rawSections.map(s => {
    if (s && s.type === 'activity_table' && _sectionHasInlineFilter(s)
        && !(Array.isArray(s.rule_sets) && s.rule_sets.length)) {
      // Generate a named set from the inline filter, ref it dynamically.
      // Deterministic id (derived from the section id) so re-migrating the same
      // config is idempotent - critical for the editor's byte-stable echo.
      const gen = normalizeRuleSetDef({
        id: 'rs_gen_' + (s.id || 'sec'),
        name: (s.name ? String(s.name) : 'Section') + ' — filter',
        filter: s.filter
      });
      ruleSets.push(gen);
      const migrated = Object.assign({}, s, { rule_sets: [{ ref: gen.id, mode: 'dynamic' }] });
      delete migrated.filter; // drop the inline filter - it now lives in the set
      return normalizeSection(migrated);
    }
    return normalizeSection(s);
  });

  return { rule_sets: ruleSets, sections };
}

// ---------------------------------------------------------------------------
// Activity-table section config normalizers
// ---------------------------------------------------------------------------
function normalizeValueRef(ref) {
  ref = ref || {};
  const out = {
    source: ref.source || 'state',
    attribute: ref.attribute || '',
    transform: ref.transform || 'none',
    unit: ref.unit || ''
  };
  // Array-element field (attribute-array table rows). Emitted only when set so
  // entity-sourced value refs stay byte-stable.
  if (ref.source === 'field' || ref.field) { out.source = 'field'; out.field = ref.field || ''; }
  // 'related' pairs the row with a sibling entity (e.g. temp row -> its
  // humidity sensor). Preserve the match spec + the nested value ref.
  if (ref.source === 'related' && ref.related) {
    out.related = {
      match: ref.related.match === 'name_replace' ? 'name_replace' : 'device',
      device_class: ref.related.device_class || '',
      find: ref.related.find || '',
      replace: ref.related.replace || '',
      value: normalizeValueRef(ref.related.value)
    };
  }
  return out;
}

function normalizeCondition(c) {
  c = c || {};
  // Compound condition: all/any of sub-conditions (value + time combos).
  if (Array.isArray(c.all)) return { all: c.all.map(normalizeCondition) };
  if (Array.isArray(c.any)) return { any: c.any.map(normalizeCondition) };
  const out = { op: c.op || 'eq' };
  if (c.ref) out.ref = normalizeValueRef(c.ref);
  // Array-field condition: names the element field to test (attribute-array
  // rows). Preserved only when set, so entity conditions stay byte-stable.
  if (c.field) out.field = c.field;
  if (c.value !== undefined) out.value = c.value;
  if (c.value2 !== undefined) out.value2 = c.value2;
  if (Array.isArray(c.values)) out.values = [...c.values];
  if (c.op2) out.op2 = c.op2;
  if (c.case_insensitive === false) out.case_insensitive = false;
  return out;
}

function normalizeFilterRule(r) {
  r = r || {};
  if (Array.isArray(r.any_of)) return { any_of: r.any_of.map(normalizeFilterRule) };
  if (Array.isArray(r.all_of)) return { all_of: r.all_of.map(normalizeFilterRule) };
  const out = { field: r.field || 'entity_id', op: r.op || 'eq' };
  if (r.value !== undefined) out.value = r.value;
  if (Array.isArray(r.values)) out.values = [...r.values];
  if (r.op2) out.op2 = r.op2;
  if (r.case_insensitive === false) out.case_insensitive = false;
  return out;
}

// Normalize a filter to the flat-group shape { groups: [ {mode, match, rules} ] }.
// Migrates the legacy { include:[], exclude:[] } shape: include -> an
// include/ALL group, exclude -> an exclude/ANY group (identical semantics).
function normalizeFilterDef(f) {
  f = f || {};
  let groups;
  if (Array.isArray(f.groups)) {
    groups = f.groups;
  } else {
    groups = [];
    const inc = Array.isArray(f.include) ? f.include : [];
    const exc = Array.isArray(f.exclude) ? f.exclude : [];
    if (inc.length) groups.push({ mode: 'include', match: 'all', rules: inc });
    if (exc.length) groups.push({ mode: 'exclude', match: 'any', rules: exc });
  }
  return {
    groups: groups.map(g => ({
      mode: (g && g.mode === 'exclude') ? 'exclude' : 'include',
      match: (g && g.match === 'any') ? 'any' : 'all',
      rules: Array.isArray(g && g.rules) ? g.rules.map(normalizeFilterRule) : []
    }))
  };
}

function normalizeRuleSet(rs) {
  rs = rs || {};
  const out = {
    rules: Array.isArray(rs.rules)
      ? rs.rules.map(r => ({ when: normalizeCondition(r.when), result: r.result }))
      : [],
    default: rs.default !== undefined ? rs.default : ''
  };
  // Optional color gradient: interpolate between value stops. Emitted only when
  // present (byte-stable). See interpolateGradient / evalRuleSet.
  if (rs.gradient && Array.isArray(rs.gradient.stops)) {
    out.gradient = normalizeGradient(rs.gradient);
  }
  return out;
}

// A color gradient: ordered value->color stops, interpolated between the two
// surrounding stops (clamped past the ends). `ref` optionally overrides the
// value being mapped (defaults to the column's own value / the fallback ref).
function normalizeGradient(g) {
  g = g || {};
  const stops = (Array.isArray(g.stops) ? g.stops : [])
    .map(s => ({ value: Number(s.value), color: String(s.color || '') }))
    .filter(s => Number.isFinite(s.value) && s.color)
    .sort((a, b) => a.value - b.value);
  const out = { stops };
  if (g.ref) out.ref = normalizeValueRef(g.ref);
  return out;
}

// Parse a hex color ('#rgb' / '#rrggbb') to [r,g,b], or null.
function parseHexColor(c) {
  if (typeof c !== 'string') return null;
  let h = c.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(x => x + x).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
// Interpolate a gradient's stops at numeric value `num` -> '#rrggbb'.
// Clamps below the first / above the last stop. Returns '' if not resolvable.
function interpolateGradient(gradient, num) {
  if (!gradient || !Array.isArray(gradient.stops) || !gradient.stops.length) return '';
  if (num == null || Number.isNaN(Number(num))) return '';
  num = Number(num);
  const stops = gradient.stops;
  if (num <= stops[0].value) return stops[0].color;
  if (num >= stops[stops.length - 1].value) return stops[stops.length - 1].color;
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (num >= stops[i].value && num <= stops[i + 1].value) { lo = stops[i]; hi = stops[i + 1]; break; }
  }
  const a = parseHexColor(lo.color), b = parseHexColor(hi.color);
  if (!a || !b) return lo.color; // non-hex stop: fall back to the low color
  const span = hi.value - lo.value;
  const t = span > 0 ? (num - lo.value) / span : 0;
  const mix = (x, y) => Math.round(x + (y - x) * t);
  const toHex = n => n.toString(16).padStart(2, '0');
  return `#${toHex(mix(a[0], b[0]))}${toHex(mix(a[1], b[1]))}${toHex(mix(a[2], b[2]))}`;
}

// ---------------------------------------------------------------------------
// Effect Presets: named, reusable bundles of border + glow + shadow + edge
// gradient lines, applied to a section or the whole card (see EFFECTS_DESIGN.md).
// ---------------------------------------------------------------------------
let _fxSeq = 0;
function _fxId() { _fxSeq += 1; return 'fx_gen_' + _fxSeq.toString(36) + Math.random().toString(36).slice(2, 6); }

// One edge side: enabled + thickness + gradient stops ({pos 0-100, color}).
// A per-side gradient edge ("Gradient Border"). Each side is independent:
// its own enabled / thickness / stops. A stop color may be the literal string
// 'match', which resolves at render time to the frame's border/icon color
// (ported from the Color card's gradient-border) — so a gradient can follow
// the accent without hardcoding a hex. `pattern` records which quick-preset
// seeded the stops (purely informational; the stops are the source of truth).
// Edge gradient pattern presets. `match` = follow the border/icon color; literal
// hex / `transparent` are used verbatim. MUST stay byte-identical to the Color
// card's copy so a frame round-trips between cards (normalizeEdgeSide only keeps
// a `pattern` field whose key exists here). Mirrors DIVIDER_GRADIENT_PATTERNS.
const EDGE_GRADIENT_PATTERNS = {
  center_fade: [{ pos: 0, color: 'transparent' }, { pos: 50, color: 'match' }, { pos: 100, color: 'transparent' }],
  solid: [{ pos: 0, color: 'match' }, { pos: 100, color: 'match' }],
  fade_in: [{ pos: 0, color: 'transparent' }, { pos: 100, color: 'match' }],
  fade_out: [{ pos: 0, color: 'match' }, { pos: 100, color: 'transparent' }],
  center_gap: [{ pos: 0, color: 'match' }, { pos: 50, color: 'transparent' }, { pos: 100, color: 'match' }],
  mirror_fade: [{ pos: 0, color: 'transparent' }, { pos: 35, color: 'match' }, { pos: 65, color: 'match' }, { pos: 100, color: 'transparent' }],
  mirror_gap: [{ pos: 0, color: 'match' }, { pos: 35, color: 'transparent' }, { pos: 65, color: 'transparent' }, { pos: 100, color: 'match' }],
  two_color: [{ pos: 0, color: '#2196F3' }, { pos: 100, color: '#e91e63' }],
  two_color_mirror: [{ pos: 0, color: '#2196F3' }, { pos: 50, color: '#e91e63' }, { pos: 100, color: '#2196F3' }],
  rainbow: [{ pos: 0, color: '#ff0000' }, { pos: 25, color: '#ffff00' }, { pos: 50, color: '#00ff00' }, { pos: 75, color: '#00ffff' }, { pos: 100, color: '#ff00ff' }],
  rainbow_mirror: [{ pos: 0, color: '#ff0000' }, { pos: 17, color: '#ffff00' }, { pos: 34, color: '#00ff00' }, { pos: 50, color: '#00ffff' }, { pos: 66, color: '#00ff00' }, { pos: 83, color: '#ffff00' }, { pos: 100, color: '#ff0000' }]
};
// Ordered [key,label] list for the edge pattern dropdown (shared by both cards).
const EDGE_GRADIENT_PATTERN_LIST = [
  ['', 'Custom (edit stops below)'],
  ['center_fade', 'Center fade (transparent → color → transparent)'],
  ['solid', 'Solid'],
  ['fade_in', 'Fade in'],
  ['fade_out', 'Fade out'],
  ['center_gap', 'Center gap (color → transparent → color)'],
  ['mirror_fade', 'Mirror fade (transparent → color → color → transparent)'],
  ['mirror_gap', 'Mirror gap (color → transparent → transparent → color)'],
  ['two_color', 'Two-color (left → right)'],
  ['two_color_mirror', 'Two-color (mirror center)'],
  ['rainbow', 'Rainbow'],
  ['rainbow_mirror', 'Rainbow (mirror center)']
];
// One edge side. Two sub-modes via `gradient`:
//   gradient:false → a SOLID line of `color` (like a plain border edge).
//   gradient:true  → a multi-stop linear gradient from `stops` (with optional
//                    `pattern` seed + 'match' stops that follow the frame color).
// Back-compat: an older edge (stops present, no explicit `gradient` flag)
// normalizes to gradient:true so it renders exactly as before.
function normalizeEdgeSide(e) {
  e = e || {};
  const stops = (Array.isArray(e.stops) ? e.stops : [])
    .map(s => ({ pos: Math.max(0, Math.min(100, Number(s.pos) || 0)), color: String(s.color || 'transparent') }))
    .sort((a, b) => a.pos - b.pos);
  // Default: gradient when stops exist and gradient wasn't explicitly false.
  const gradient = e.gradient === false ? false : (e.gradient === true ? true : stops.length > 0);
  const out = {
    enabled: e.enabled === true,
    thickness: Number(e.thickness) > 0 ? Math.floor(Number(e.thickness)) : 1,
    gradient,
    color: e.color || 'match',   // used when gradient:false
    stops
  };
  // Preserve the chosen pattern name only when it's a known preset (byte-stable
  // otherwise-absent so plain custom-stop edges don't gain a spurious key).
  if (e.pattern && EDGE_GRADIENT_PATTERNS[e.pattern]) out.pattern = e.pattern;
  return out;
}
function normalizeEdges(edges) {
  edges = edges || {};
  const out = {
    top: normalizeEdgeSide(edges.top),
    bottom: normalizeEdgeSide(edges.bottom),
    left: normalizeEdgeSide(edges.left),
    right: normalizeEdgeSide(edges.right)
  };
  // Editor convenience: when true, one shared editor (the `top` side) drives
  // all four — the STYLE (gradient/color/thickness/stops/pattern) is mirrored
  // to every side, but each side keeps its own `enabled` so you can still show
  // e.g. only top+bottom. Render treats sides independently.
  if (edges.all_same === true) {
    out.all_same = true;
    const src = out.top;
    ['bottom', 'left', 'right'].forEach(side => {
      const en = out[side].enabled;   // preserve per-side enable
      out[side] = JSON.parse(JSON.stringify(src));
      out[side].enabled = en;
    });
  }
  return out;
}

// Full normalizer for one effect preset. All visual sub-objects are optional
// and emitted only when present, so a preset carries only what it uses.
// A Frame Style (formerly "effect preset"): a SPARSE bundle of frame styling.
// Only the groups the user set are present; an absent group means "don't touch"
// (critical for layering — see _resolveFrame). Groups: glow / shadow / border /
// background / edges, plus an optional `when`/`when_entity` condition.
function normalizeFramePreset(fx) {
  fx = fx || {};
  const out = {
    id: fx.id || _fxId(),
    name: fx.name != null && String(fx.name).trim() ? String(fx.name) : 'Frame Style'
  };
  // Optional freeform note (shown in the library UI). Emitted only when set so
  // note-less styles stay byte-stable.
  if (fx.note != null && String(fx.note).trim()) out.note = String(fx.note).trim();
  if (fx.glow) out.glow = {
    color: fx.glow.color || '#2196F3',
    intensity: Number(fx.glow.intensity) || 1.0,
    borders_only: fx.glow.borders_only === true,
    ...(fx.glow.follow_icon ? { follow_icon: true } : {})
  };
  if (fx.shadow) out.shadow = {
    color: fx.shadow.color || '#000000',
    ...(fx.shadow.follow_icon ? { follow_icon: true } : {}),
    x: Number(fx.shadow.x) || 0, y: fx.shadow.y != null ? Number(fx.shadow.y) : 4,
    blur: fx.shadow.blur != null ? Number(fx.shadow.blur) : 12,
    spread: Number(fx.shadow.spread) || 0,
    opacity: fx.shadow.opacity != null ? Number(fx.shadow.opacity) : 0.35
  };
  if (fx.border) out.border = {
    color: fx.border.color || '#2196F3',
    width: fx.border.width != null ? Number(fx.border.width) : 1,
    radius: fx.border.radius != null ? Number(fx.border.radius) : 12,
    // Per-corner radius toggles [TL, TR, BR, BL]: a corner with false is square
    // (0), true uses `radius`. Defaults to all-rounded. (Ported from the Color
    // card's card_border_corners so the frame model is a superset.)
    corners: Array.isArray(fx.border.corners) && fx.border.corners.length === 4
      ? fx.border.corners.map(c => c !== false) : [true, true, true, true],
    follow_icon: fx.border.follow_icon === true,
    sides: Array.isArray(fx.border.sides) ? fx.border.sides.filter(s => ['top', 'bottom', 'left', 'right'].includes(s)) : ['top', 'bottom', 'left', 'right']
  };
  // Background: 'custom' (a solid color), 'transparent', or 'theme' (inherit
  // the HA card/theme background). Legacy values were a bare string or
  // { color } object (custom only), which migrate to mode:'custom'.
  if (fx.background != null) {
    const bg = (typeof fx.background === 'object') ? fx.background : { color: String(fx.background) };
    const mode = ['transparent', 'theme', 'custom'].includes(bg.mode) ? bg.mode : 'custom';
    out.background = mode === 'custom'
      ? { mode: 'custom', color: String(bg.color != null ? bg.color : '#1c1c1c') }
      : { mode };
  }
  if (fx.edges) out.edges = normalizeEdges(fx.edges);
  // Conditional application. Two kinds:
  //  - entity (default): `when` (condition) + `when_entity` (watched entity id)
  //  - section membership: `when_kind` = 'section_has_entities' | 'section_empty'
  //    + `when_section` (target section id) — the preset applies only when that
  //    section currently has (or lacks) visible entities.
  if (fx.when_kind === 'section_has_entities' || fx.when_kind === 'section_empty') {
    out.when_kind = fx.when_kind;
    out.when_section = String(fx.when_section || '');
  } else {
    if (fx.when) out.when = normalizeCondition(fx.when);
    // The entity a conditional preset watches (paired with `when`).
    if (fx.when_entity) out.when_entity = String(fx.when_entity);
  }
  return out;
}
function normalizeFramePresets(list) {
  return Array.isArray(list) ? list.map(normalizeFramePreset) : [];
}

// ---------------------------------------------------------------------------
// Built-In frame — the card's internal read-only fallback, so a fresh card
// always has a sensible starting frame with nothing configured. It is NEVER
// stored (mirrors the Color card's Built-In Button Style): always rendered
// from this constant, so it can't drift or be deleted. Its id is a reserved
// library id so section/card frame refs can point at it like any other.
// The Frame Library is otherwise System-only (shared HA store) — there is no
// "Local" (card-only) frame concept.
const BUILTIN_FRAME_SLUG = '__builtin__';
const BUILTIN_FRAME_ID = 'lib:' + BUILTIN_FRAME_SLUG;
// A clean, neutral starting frame: a thin border that follows the icon color,
// gently rounded, with a soft matching glow. Sparse — touches only border+glow
// so it layers cleanly under anything the user adds on top.
const BUILTIN_FRAME_GROUPS = {
  border: { follow_icon: true, width: 1, radius: 12, sides: ['top', 'bottom', 'left', 'right'] },
  glow: { follow_icon: true, intensity: 1.0, borders_only: true }
};
// The Built-In as a normalized preset object (fresh each call so callers can't
// mutate the shared constant).
function builtinFramePreset() {
  const p = normalizeFramePreset({ name: 'Built-In', ...JSON.parse(JSON.stringify(BUILTIN_FRAME_GROUPS)) });
  p.id = BUILTIN_FRAME_ID;
  p._builtin = true;   // read-only marker for the editor
  return p;
}

// ---------------------------------------------------------------------------
// Frame Style portability (share/export/import + library store).
//
// One serializer feeds two destinations: (1) a plain-text envelope the user
// copies between systems, and (2) the frontend key-value store used as a live
// shared library. Both consume the same versioned envelope so a preset made in
// either path is valid in the other.
// ---------------------------------------------------------------------------
const SEED_FRAME_EXPORT_VERSION = 1;

// Strip a preset down to its portable core: id + name + the sparse frame
// groups. `keepConditions` decides whether the when/when_entity/when_section
// keys travel — they reference system-local entities/sections, so the default
// is to drop them (portable visuals only). Runs through normalizeFramePreset
// so the output is always schema-clean.
function portableFramePreset(fx, keepConditions) {
  const norm = normalizeFramePreset(fx);
  if (!keepConditions) {
    delete norm.when; delete norm.when_entity;
    delete norm.when_kind; delete norm.when_section;
  }
  return norm;
}

// A stable content key for dedupe: everything that defines the preset's look
// (and, when kept, its condition) but NOT its id or name. Two presets with the
// same key are considered identical for import-dedupe purposes.
function framePresetContentKey(fx) {
  const norm = normalizeFramePreset(fx);
  const copy = {};
  Object.keys(norm).sort().forEach(k => {
    if (k === 'id' || k === 'name') return;
    copy[k] = norm[k];
  });
  return JSON.stringify(copy);
}

// Serialize one or more presets into the versioned text envelope. `exported`
// is an ISO date string supplied by the caller (Date.now() is unavailable in
// some contexts, so it's passed in). Conditions are dropped unless asked for.
function serializeFramePresets(presets, opts) {
  opts = opts || {};
  const list = (Array.isArray(presets) ? presets : [presets])
    .filter(Boolean)
    .map(fx => portableFramePreset(fx, opts.keepConditions === true));
  const env = { seed_frame_presets: SEED_FRAME_EXPORT_VERSION, presets: list };
  if (opts.exported) env.exported = String(opts.exported);
  return JSON.stringify(env, null, 2);
}

// Parse + validate a pasted envelope. Returns { ok, presets, error }. Accepts
// either the full envelope or a bare array/object of presets (lenient inbound,
// strict about producing clean output). Every returned preset is normalized
// and given a FRESH id so imports never collide with existing presets.
function parseFramePresetBlob(text) {
  let raw;
  try { raw = JSON.parse(text); }
  catch (e) { return { ok: false, error: 'Not valid JSON.' }; }

  let list;
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'seed_frame_presets' in raw) {
    if (Number(raw.seed_frame_presets) > SEED_FRAME_EXPORT_VERSION) {
      return { ok: false, error: 'Made by a newer version of the card. Update the card first.' };
    }
    if (!Array.isArray(raw.presets)) return { ok: false, error: 'Envelope has no presets list.' };
    list = raw.presets;
  } else if (Array.isArray(raw)) {
    list = raw;                      // bare array of presets
  } else if (raw && typeof raw === 'object' && (raw.glow || raw.shadow || raw.border || raw.background || raw.edges)) {
    list = [raw];                    // a single bare preset object
  } else {
    return { ok: false, error: 'Unrecognized format — expected exported Frame Style text.' };
  }

  const presets = [];
  list.forEach(p => {
    if (!p || typeof p !== 'object') return;
    // Must carry at least one visual group to be a meaningful preset.
    if (!(p.glow || p.shadow || p.border || p.background || p.edges)) return;
    const norm = normalizeFramePreset(p);
    norm.id = _fxId();               // fresh id — never collide on import
    presets.push(norm);
  });
  if (!presets.length) return { ok: false, error: 'No usable presets found in the text.' };
  return { ok: true, presets };
}

// Merge imported presets into an existing list, skipping any whose content is
// byte-identical to one already present. Returns { list, added, skipped }.
function mergeFramePresets(existing, incoming) {
  const out = Array.isArray(existing) ? existing.slice() : [];
  const seen = new Set(out.map(framePresetContentKey));
  let added = 0, skipped = 0;
  (incoming || []).forEach(p => {
    const key = framePresetContentKey(p);
    if (seen.has(key)) { skipped += 1; return; }
    seen.add(key); out.push(p); added += 1;
  });
  return { list: out, added, skipped };
}

// A url/id-safe slug from a preset name, used as its library key.
function frameLibSlug(name) {
  const s = String(name || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return s || 'preset';
}

// ---------------------------------------------------------------------------
// Frame Style LIBRARY (live, shared, install-free store).
//
// Backed by Home Assistant's built-in frontend key-value store — the same WS
// API HA's own frontend uses (frontend/{get,set,subscribe}_{user,system}_data).
// No custom component required. Two scopes:
//   'user'   -> frontend/*_user_data  (per-user, any user may write)
//   'system' -> frontend/*_system_data (shared across users, admin write)
// We keep the whole library under ONE namespaced key so it never collides with
// core's own keys (core/sidebar/home/energy). The stored value is a versioned
// envelope { seed_frame_presets:1, presets:{ slug: preset } }.
// Mirrors ensureLabelRegistry: fetch once over WS into a module cache, then
// subscribe for live cross-card updates.
// ---------------------------------------------------------------------------
// Shared, brand-neutral 'ltek' family key so every ltek card reads/writes the
// SAME frame library. `seed_frame_library` is the legacy key (pre-rename); it's
// read once for one-time forward-migration so existing frames aren't orphaned.
const SEED_FRAME_LIB_KEY = 'ltek_frame_library';
const SEED_FRAME_LIB_KEY_LEGACY = 'seed_frame_library';
// scope -> { map: {slug:preset}|null, loaded, loading, subscribed, migrated }
const SEED_FRAME_LIBRARY = {
  user: { map: null, loaded: false, loading: false, subscribed: false, migrated: false },
  system: { map: null, loaded: false, loading: false, subscribed: false, migrated: false }
};

function _frameLibWs(scope, verb) {
  // verb: 'get' | 'set' | 'subscribe' ; scope: 'user' | 'system'
  return `frontend/${verb}_${scope === 'system' ? 'system' : 'user'}_data`;
}

// Turn a raw stored value into a clean { slug: preset } map. Tolerates the
// envelope, a bare map, or null/garbage (-> empty map).
function _frameLibParseValue(value) {
  const map = {};
  if (!value || typeof value !== 'object') return map;
  const presets = ('seed_frame_presets' in value && value.presets && typeof value.presets === 'object')
    ? value.presets : value;
  Object.keys(presets).forEach(slug => {
    const p = presets[slug];
    if (p && typeof p === 'object' && (p.glow || p.shadow || p.border || p.background || p.edges)) {
      const norm = normalizeFramePreset(p);
      norm.id = 'lib:' + slug;       // library presets carry a lib: id
      map[slug] = norm;
    }
  });
  return map;
}

// One-time forward-migration: if the new `ltek_frame_library` key is empty,
// pull any frames from the legacy `seed_frame_library` key and write them into
// the new key. Runs at most once per scope per session (st.migrated). Existing
// `lib:<slug>` refs keep working because slugs are unchanged. Best-effort — a
// failure just leaves the new key empty (no data lost; legacy key untouched).
function _migrateLegacyFrameLibrary(hass, scope, st, onChange) {
  if (st.migrated) return;
  st.migrated = true;
  const conn = hass && hass.connection;
  if (!conn || typeof conn.sendMessagePromise !== 'function') return;
  conn.sendMessagePromise({ type: _frameLibWs(scope, 'get'), key: SEED_FRAME_LIB_KEY_LEGACY })
    .then(res => {
      const legacy = _frameLibParseValue(res && res.value);
      if (!legacy || !Object.keys(legacy).length) return;   // nothing to migrate
      // Only adopt if the new key is still empty (don't clobber newer data).
      if (st.map && Object.keys(st.map).length) return;
      st.map = legacy;
      if (typeof onChange === 'function') { try { onChange(); } catch (e) {} }
      // Persist forward into the new key (best-effort).
      saveFrameLibrary(hass, scope, legacy).catch(() => {});
    })
    .catch(() => {});
}

// Fetch (once) + subscribe to a library scope. onChange fires on initial load
// AND on every live update, so callers re-render. Safe to call repeatedly.
function ensureFrameLibrary(hass, scope, onChange) {
  scope = scope === 'system' ? 'system' : 'user';
  const st = SEED_FRAME_LIBRARY[scope];
  if (!hass || !hass.connection) return;
  const conn = hass.connection;
  if (st.subscribed) return;         // subscription drives all future updates
  if (typeof conn.subscribeMessage === 'function') {
    st.subscribed = true; st.loading = true;
    try {
      conn.subscribeMessage(
        (ev) => {
          st.map = _frameLibParseValue(ev && ev.value);
          st.loaded = true; st.loading = false;
          if (typeof onChange === 'function') { try { onChange(); } catch (e) {} }
          // If the new key came back empty, try adopting legacy frames once.
          if (!Object.keys(st.map).length) _migrateLegacyFrameLibrary(hass, scope, st, onChange);
        },
        { type: _frameLibWs(scope, 'subscribe'), key: SEED_FRAME_LIB_KEY }
      );
    } catch (e) { st.subscribed = false; st.loading = false; }
    return;
  }
  // Fallback: one-shot get if subscribe isn't available.
  if (st.loaded || st.loading) return;
  if (typeof conn.sendMessagePromise !== 'function') return;
  st.loading = true;
  conn.sendMessagePromise({ type: _frameLibWs(scope, 'get'), key: SEED_FRAME_LIB_KEY })
    .then(res => {
      st.map = _frameLibParseValue(res && res.value);
      st.loaded = true; st.loading = false;
      if (typeof onChange === 'function') { try { onChange(); } catch (e) {} }
      if (!Object.keys(st.map).length) _migrateLegacyFrameLibrary(hass, scope, st, onChange);
    })
    .catch(() => { st.loading = false; st.loaded = true; st.map = {}; });
}

// Read the current cached library map for a scope (slug -> preset), or {}.
function frameLibraryMap(scope) {
  const st = SEED_FRAME_LIBRARY[scope === 'system' ? 'system' : 'user'];
  return st.map || {};
}

// Persist the full library map back to the store. Returns the WS promise (or a
// rejected promise if we can't reach the connection). `map` is slug -> preset.
function saveFrameLibrary(hass, scope, map) {
  scope = scope === 'system' ? 'system' : 'user';
  if (!hass || !hass.connection || typeof hass.connection.sendMessagePromise !== 'function') {
    return Promise.reject(new Error('No connection'));
  }
  // Strip volatile ids; the slug is the key and the id is re-derived on load.
  const presets = {};
  Object.keys(map || {}).forEach(slug => {
    const clean = normalizeFramePreset(map[slug]);
    delete clean.id;
    presets[slug] = clean;
  });
  const value = { seed_frame_presets: SEED_FRAME_EXPORT_VERSION, presets };
  return hass.connection.sendMessagePromise({
    type: _frameLibWs(scope, 'set'), key: SEED_FRAME_LIB_KEY, value
  });
}

// A section/card frame reference: which presets apply and how they layer.
//   presets - ordered list of Frame Style ids (last writer wins per group)
// Legacy migration: older configs had a `default` preset + `apply_defaults_prior`
// toggle (the Default was a bottom base layer). That's redundant with the
// ordered list, so we fold an active Default into the FRONT of `presets` and
// drop both fields — the resolved look is unchanged.
function normalizeFrameRef(f) {
  f = f || {};
  let presets = Array.isArray(f.presets) ? f.presets.map(String).filter(Boolean) : [];
  if (f.default && f.apply_defaults_prior !== false) {
    const dflt = String(f.default);
    // Prepend the old Default as the base layer (unless already listed).
    if (!presets.includes(dflt)) presets = [dflt, ...presets];
  }
  const out = { presets };
  // Optional: ids the user has temporarily disabled (kept in the list but not
  // applied) — lets them preview the look without/with a preset. Emitted only
  // when non-empty, and pruned to ids actually in the list.
  if (Array.isArray(f.disabled)) {
    const dis = f.disabled.map(String).filter(id => presets.includes(id));
    if (dis.length) out.disabled = dis;
  }
  // Optional: ids whose OWN condition (when/when_entity) is ignored on THIS
  // application — the layer always applies here regardless of its condition.
  // Emitted only when non-empty, pruned to ids in the list.
  if (Array.isArray(f.ignore_conditions)) {
    const ign = f.ignore_conditions.map(String).filter(id => presets.includes(id));
    if (ign.length) out.ignore_conditions = ign;
  }
  return out;
}

// ===========================================================================
// HEADER RULE SETS — a named, ENTITY-FREE set of state-driven header style
// rules. Each rule is a condition (reusing the value/condition engine) that,
// when it matches, sets any/all of: icon color, MDI glyph, text color, icon
// size, text size, and a secondary-info line. Rules carry NO entity — a section
// binds the entity at apply-time (blank = the section's own primary entity).
// Modeled 1:1 on Frame Styles: read-only Built-In + shared System library.
// ---------------------------------------------------------------------------
const HEADER_RULE_OUTPUT_KEYS = [
  'set_icon_color', 'set_icon', 'set_text_color', 'set_icon_size', 'set_text_size', 'set_secondary'
];
// Normalize one rule: a condition (`when`) + a sparse set of outputs. Outputs
// are kept ONLY when set, so byte-stable. set_secondary is a value-ref object.
function normalizeHeaderRule(r) {
  r = r || {};
  const out = { when: normalizeCondition(r.when) };
  // Optional per-rule entity to test (blank = the section's bound/primary entity).
  if (r.when_entity) out.when_entity = String(r.when_entity);
  if (r.set_icon_color !== undefined && r.set_icon_color !== '') out.set_icon_color = r.set_icon_color;
  if (r.set_icon !== undefined && r.set_icon !== '') out.set_icon = r.set_icon;
  if (r.set_text_color !== undefined && r.set_text_color !== '') out.set_text_color = r.set_text_color;
  // Size sliders use 0 as their "Default (don't set)" position — treat 0/blank
  // as unset so nothing is emitted (byte-stable; a real size is always > 0).
  if (Number.isFinite(Number(r.set_icon_size)) && Number(r.set_icon_size) > 0) out.set_icon_size = Number(r.set_icon_size);
  if (Number.isFinite(Number(r.set_text_size)) && Number(r.set_text_size) > 0) out.set_text_size = Number(r.set_text_size);
  if (r.set_secondary && typeof r.set_secondary === 'object' && r.set_secondary.enabled) {
    out.set_secondary = normalizeSecondaryInfo(r.set_secondary);
  }
  return out;
}
// Normalize a whole set: id/name + ordered rules + optional default outputs.
function normalizeHeaderRuleSet(hs) {
  hs = hs || {};
  const set = {
    name: hs.name || 'Header Rules',
    rules: Array.isArray(hs.rules) ? hs.rules.map(normalizeHeaderRule) : [],
  };
  if (hs.id) set.id = String(hs.id);
  // Optional set-level default entity: the entity a card/section binding falls
  // back to when it doesn't pick its own. Emitted ONLY when set (byte-stable).
  if (hs.default_entity) set.default_entity = String(hs.default_entity);
  if (hs.default && typeof hs.default === 'object') {
    // default = same sparse output shape (no `when`); normalize via a wrapper.
    const d = normalizeHeaderRule({ ...hs.default, when: { op: 'eq' } });
    delete d.when;
    if (Object.keys(d).length) set.default = d;
  }
  return set;
}
// A stable content key for dedupe (everything but id + name).
function headerRuleSetContentKey(hs) {
  const norm = normalizeHeaderRuleSet(hs);
  const copy = {}; Object.keys(norm).sort().forEach(k => { if (k === 'id' || k === 'name') return; copy[k] = norm[k]; });
  return JSON.stringify(copy);
}
function headerLibSlug(name) {
  const s = String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return s || 'header_rules';
}
// Read-only Built-In: light on → accent icon+text; off → muted. Never stored.
const BUILTIN_HEADER_SLUG = 'builtin_header';
const BUILTIN_HEADER_ID = 'lib:' + BUILTIN_HEADER_SLUG;
function builtinHeaderRuleSet() {
  const s = normalizeHeaderRuleSet({
    name: 'Built-In',
    rules: [
      { when: { op: 'is_on' }, set_icon_color: 'var(--primary-color)', set_text_color: 'var(--primary-text-color)' },
      { when: { op: 'is_off' }, set_icon_color: 'var(--secondary-text-color)', set_text_color: 'var(--secondary-text-color)' },
    ],
  });
  s.id = BUILTIN_HEADER_ID;
  s._builtin = true;
  return s;
}
// A section's applied Header Rule Sets: ordered refs, each binding an entity.
// { ref:'lib:<slug>'|'builtin_header', entity:'' } — blank entity = section's
// own primary entity. Emitted only when non-empty (byte-stable/back-compat).
function normalizeHeaderRuleRefs(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map(r => (typeof r === 'string' ? { ref: r, entity: '' } : r))
    .filter(r => r && r.ref)
    .map(r => ({ ref: String(r.ref), entity: r.entity ? String(r.entity) : '' }));
}

// ---- Header Rule Set LIBRARY (shared ltek store; mirrors the Frame library) ----
const SEED_HEADER_LIB_KEY = 'ltek_header_library';
const SEED_HEADER_EXPORT_VERSION = 1;
const SEED_HEADER_LIBRARY = {
  user: { map: null, loaded: false, loading: false, subscribed: false },
  system: { map: null, loaded: false, loading: false, subscribed: false }
};
function _headerLibWs(scope, verb) { return `frontend/${verb}_${scope === 'system' ? 'system' : 'user'}_data`; }
function _headerLibParseValue(value) {
  const map = {};
  if (!value || typeof value !== 'object') return map;
  const sets = ('seed_header_rules' in value && value.sets && typeof value.sets === 'object') ? value.sets : value;
  Object.keys(sets).forEach(slug => {
    const s = sets[slug];
    if (s && typeof s === 'object' && Array.isArray(s.rules)) {
      const norm = normalizeHeaderRuleSet(s);
      norm.id = 'lib:' + slug;
      map[slug] = norm;
    }
  });
  return map;
}
function ensureHeaderLibrary(hass, scope, onChange) {
  scope = scope === 'system' ? 'system' : 'user';
  const st = SEED_HEADER_LIBRARY[scope];
  if (!hass || !hass.connection) return;
  const conn = hass.connection;
  if (st.subscribed) return;
  if (typeof conn.subscribeMessage === 'function') {
    st.subscribed = true; st.loading = true;
    try {
      conn.subscribeMessage(
        (ev) => { st.map = _headerLibParseValue(ev && ev.value); st.loaded = true; st.loading = false; if (typeof onChange === 'function') { try { onChange(); } catch (e) {} } },
        { type: _headerLibWs(scope, 'subscribe'), key: SEED_HEADER_LIB_KEY }
      );
    } catch (e) { st.subscribed = false; st.loading = false; }
    return;
  }
  if (st.loaded || st.loading) return;
  if (typeof conn.sendMessagePromise !== 'function') return;
  st.loading = true;
  conn.sendMessagePromise({ type: _headerLibWs(scope, 'get'), key: SEED_HEADER_LIB_KEY })
    .then(res => { st.map = _headerLibParseValue(res && res.value); st.loaded = true; st.loading = false; if (typeof onChange === 'function') { try { onChange(); } catch (e) {} } })
    .catch(() => { st.loading = false; st.loaded = true; st.map = {}; });
}
function headerLibraryMap(scope) {
  const st = SEED_HEADER_LIBRARY[scope === 'system' ? 'system' : 'user'];
  return st.map || {};
}
function saveHeaderLibrary(hass, scope, map) {
  scope = scope === 'system' ? 'system' : 'user';
  if (!hass || !hass.connection || typeof hass.connection.sendMessagePromise !== 'function') return Promise.reject(new Error('No connection'));
  const sets = {};
  Object.keys(map || {}).forEach(slug => { const clean = normalizeHeaderRuleSet(map[slug]); delete clean.id; sets[slug] = clean; });
  const value = { seed_header_rules: SEED_HEADER_EXPORT_VERSION, sets };
  return hass.connection.sendMessagePromise({ type: _headerLibWs(scope, 'set'), key: SEED_HEADER_LIB_KEY, value });
}

// ---- Header Rule Set portability (export / import), mirrors the Frame portal ----
//
// Rules are the shared, hard-to-debug part of a card, so export produces a
// human-readable versioned envelope the user can hand back (with their card
// YAML) to diagnose why a rule isn't applying. `keepBindings` decides whether
// the entity bindings travel — `default_entity` and per-rule `when_entity`
// reference system-local entities, so by DEFAULT they're stripped (portable
// logic + look only). The `when` conditions and all `set_*` outputs always
// travel — they're what defines the rule.
function portableHeaderRuleSet(hs, keepBindings) {
  const norm = normalizeHeaderRuleSet(hs);
  delete norm.id;
  delete norm._builtin;
  if (!keepBindings) {
    delete norm.default_entity;
    if (Array.isArray(norm.rules)) norm.rules.forEach(r => { if (r) delete r.when_entity; });
  }
  return norm;
}

// Serialize one or more Header Rule Sets into the versioned text envelope.
// `exported` is an ISO date string supplied by the caller (Date.now() is
// unavailable in some contexts). Bindings are dropped unless asked for.
function serializeHeaderRuleSets(sets, opts) {
  opts = opts || {};
  const list = (Array.isArray(sets) ? sets : [sets])
    .filter(Boolean)
    .map(hs => portableHeaderRuleSet(hs, opts.keepBindings === true));
  const env = { seed_header_rules: SEED_HEADER_EXPORT_VERSION, sets: list };
  if (opts.exported) env.exported = String(opts.exported);
  return JSON.stringify(env, null, 2);
}

// Parse + validate a pasted envelope. Returns { ok, sets, error }. Accepts the
// full envelope (sets as a LIST for export, or the {slug:set} MAP shape the
// library store uses), a bare array, or a single bare set object. Every
// returned set is normalized; ids are dropped (re-slugged on import).
function parseHeaderRuleSetBlob(text) {
  let raw;
  try { raw = JSON.parse(text); }
  catch (e) { return { ok: false, error: 'Not valid JSON.' }; }

  let list;
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'seed_header_rules' in raw) {
    if (Number(raw.seed_header_rules) > SEED_HEADER_EXPORT_VERSION) {
      return { ok: false, error: 'Made by a newer version of the card. Update the card first.' };
    }
    if (Array.isArray(raw.sets)) list = raw.sets;                 // export envelope
    else if (raw.sets && typeof raw.sets === 'object') list = Object.values(raw.sets); // library map shape
    else return { ok: false, error: 'Envelope has no sets.' };
  } else if (Array.isArray(raw)) {
    list = raw;                       // bare array of sets
  } else if (raw && typeof raw === 'object' && Array.isArray(raw.rules)) {
    list = [raw];                     // a single bare set object
  } else {
    return { ok: false, error: 'Unrecognized format — expected exported Header Rule text.' };
  }

  const sets = [];
  list.forEach(s => {
    if (!s || typeof s !== 'object' || !Array.isArray(s.rules)) return;
    const norm = normalizeHeaderRuleSet(s);
    delete norm.id;
    delete norm._builtin;
    sets.push(norm);
  });
  if (!sets.length) return { ok: false, error: 'No usable Header Rule Sets found in the text.' };
  return { ok: true, sets };
}

// ---------------------------------------------------------------------------
// Legacy frame → Frame Style auto-migration.
//
// Pre-v107 configs styled frames with inline keys (border_mode/glow_mode/
// shadow_mode/bg_mode per section + show_section_border / card_border_enabled /
// card_glow_* / card_shadow_* globals) and had NO frame_presets/card_frame.
// The inline render path for those was removed in v124, so such a config would
// render with no frame at all. This rebuilds the equivalent Frame Style model
// on load (same recipe used to hand-convert the example cards), so old configs
// keep their look on the single (preset) render path. Runs ONLY when a config
// has no frame model yet; converted configs are left untouched.
// ---------------------------------------------------------------------------
function _seedHasFrameModel(config) {
  if (Array.isArray(config.frame_presets) && config.frame_presets.length) return true;
  if (config.card_frame) return true;
  return Array.isArray(config.sections) && config.sections.some(s => s && s.frame);
}
function _seedHasLegacyFrameKeys(config) {
  if (config.show_section_border !== undefined || config.card_border_enabled !== undefined
      || config.card_glow_condition !== undefined || config.card_shadow_enabled !== undefined) return true;
  return Array.isArray(config.sections) && config.sections.some(s => s &&
    (s.border_mode !== undefined || s.glow_mode !== undefined || s.shadow_mode !== undefined
     || s.bg_mode !== undefined || s.disable_border !== undefined || s.disable_glow !== undefined));
}

function migrateLegacyFrames(config) {
  if (!config || typeof config !== 'object') return config;
  if (_seedHasFrameModel(config) || !_seedHasLegacyFrameKeys(config)) return config;

  const colors = config.colors || {};
  const GBORDER = colors.border || '#2196F3';
  const GGLOW = colors.glow || '#2196F3';
  const CBORDER = colors.card_border || '#2196F3';
  const CGLOW = colors.card_glow || '#2196F3';

  // Global section-default groups (only "on" when their global switch is set).
  const secBorderOn = config.show_section_border === true;
  const secGlowOn = (config.glow_condition || 'never') !== 'never' && config.glow_condition !== undefined
    ? config.glow_condition !== 'never' : false;
  const secShadowOn = config.section_shadow_enabled === true;
  const secDefBorder = () => ({ color: GBORDER, width: config.section_border_width ?? 2, radius: config.section_border_radius ?? 8,
    sides: ['top', 'bottom', 'left', 'right'].filter(s => config['section_border_' + s] !== false) });
  const secDefGlow = () => ({ color: GGLOW, intensity: config.glow_intensity ?? 1.0, borders_only: config.glow_borders_only !== false });
  const secDefShadow = () => ({ color: config.section_shadow_color || '#000000', x: config.section_shadow_x ?? 0, y: config.section_shadow_y ?? 4,
    blur: config.section_shadow_blur ?? 12, spread: config.section_shadow_spread ?? 0, opacity: config.section_shadow_opacity ?? 0.35 });

  const presets = [];
  const byHash = {};
  let seq = 0;
  const getPreset = (groups, name) => {
    if (!Object.keys(groups).length) return null;
    const key = JSON.stringify(groups);
    if (byHash[key]) return byHash[key];
    seq += 1;
    const id = 'fx_mig_' + seq.toString(36);
    const p = { id, name, ...groups };
    presets.push(p); byHash[key] = id; return id;
  };

  const sectionGroups = (s) => {
    const g = {};
    const bm = s.border_mode || 'global';
    if (!s.disable_border && bm !== 'none') {
      if (bm === 'global') { if (secBorderOn) g.border = secDefBorder(); }
      else g.border = { color: s.border_color || GBORDER, width: s.border_width ?? 1, radius: s.border_radius ?? 12,
        sides: ['top', 'bottom', 'left', 'right'].filter(x => s['border_' + x] !== false) };
    }
    const gm = s.glow_mode || 'global';
    if (!s.disable_glow && gm !== 'none') {
      if (gm === 'global') { if (secGlowOn) g.glow = secDefGlow(); }
      else g.glow = { color: s.glow_color || GGLOW, intensity: s.glow_intensity ?? 1.0, borders_only: s.glow_borders_only !== false };
    }
    const sm = s.shadow_mode || 'global';
    if (sm !== 'none') {
      if (sm === 'global') { if (secShadowOn) g.shadow = secDefShadow(); }
      else g.shadow = { color: s.shadow_color || '#000000', x: s.shadow_x ?? 0, y: s.shadow_y ?? 4,
        blur: s.shadow_blur ?? 12, spread: s.shadow_spread ?? 0, opacity: s.shadow_opacity ?? 0.35 };
    }
    const bgm = s.bg_mode || 'none';
    if (bgm === 'custom') g.background = { color: s.bg_color || '' };
    else if (bgm === 'global' && config.section_bg_color) g.background = { color: config.section_bg_color };
    return g;
  };

  (config.sections || []).forEach(s => {
    if (!s || s.frame) return;
    const groups = sectionGroups(s);
    const id = getPreset(groups, `${(s.name || 'Section').trim()} Frame`);
    s.frame = id ? { presets: [id] } : { presets: [] };
  });

  // Card frame: unconditional border/shadow/bg in one preset, conditional glow
  // in a separate preset (so the border persists when the glow's `when` fails).
  const cardBase = {};
  if (config.card_border_enabled === true) {
    cardBase.border = { color: CBORDER, width: config.card_border_width ?? 1, radius: config.card_border_radius ?? 12,
      sides: ['top', 'bottom', 'left', 'right'].filter(x => config['card_border_' + x] !== false) };
  }
  if (config.card_shadow_enabled === true) {
    cardBase.shadow = { color: config.card_shadow_color || '#000000', x: config.card_shadow_x ?? 0, y: config.card_shadow_y ?? 4,
      blur: config.card_shadow_blur ?? 16, spread: config.card_shadow_spread ?? 0, opacity: config.card_shadow_opacity ?? 0.35 };
  }
  if (config.card_bg_color) cardBase.background = { color: config.card_bg_color };

  const cardPresetIds = [];
  if (Object.keys(cardBase).length) {
    presets.push({ id: 'fx_mig_card', name: 'Card Frame', ...cardBase });
    cardPresetIds.push('fx_mig_card');
  }
  const cgc = config.card_glow_condition || 'never';
  if (cgc !== 'never') {
    const glowP = { id: 'fx_mig_card_glow', name: 'Card Glow',
      glow: { color: CGLOW, intensity: config.card_glow_intensity ?? 1.0, borders_only: config.card_glow_borders_only !== false } };
    if (cgc === 'when_entity_on' && config.card_glow_entity) { glowP.when = { op: 'is_on' }; glowP.when_entity = config.card_glow_entity; }
    else if ((cgc === 'when_section_has_entities' || cgc === 'when_section_empty') && config.card_glow_section) {
      glowP.when_kind = cgc === 'when_section_has_entities' ? 'section_has_entities' : 'section_empty';
      glowP.when_section = config.card_glow_section;
    }
    presets.push(glowP); cardPresetIds.push('fx_mig_card_glow');
  }

  config.frame_presets = presets;
  config.card_frame = cardPresetIds.length ? { presets: cardPresetIds } : null;
  return config;
}

// Build the CSS background layers for edge gradient lines. Each enabled side
// with >= 1 stop becomes a linear-gradient painted as a thin strip on that
// edge. Returns { image, size, position, repeat } CSS strings (or null).
// `matchColor` resolves any stop whose color is the literal 'match' to the
// frame's border/icon color (ported from the Color card). Falls back to the
// accent when not supplied, so a 'match' stop is never left invalid.
function buildEdgeBackground(edges, matchColor) {
  if (!edges) return null;
  const accent = matchColor || '#2196F3';
  // 'match' → the border/icon accent; 'theme' → the HA theme divider color; else literal.
  const col = c => (c === 'match' ? accent : (c === 'theme' ? 'var(--divider-color, #333)' : c));
  const imgs = [], sizes = [], positions = [];
  const sideDir = { top: 'to right', bottom: 'to right', left: 'to bottom', right: 'to bottom' };
  ['top', 'bottom', 'left', 'right'].forEach(side => {
    const e = edges[side];
    if (!e || !e.enabled) return;
    let stopStr;
    if (e.gradient === false) {
      // Solid line: a single color painted edge-to-edge (implemented as a flat
      // two-stop gradient so all edges use the same background-layer mechanism).
      const c = col(e.color || 'match');
      stopStr = `${c} 0%, ${c} 100%`;
    } else {
      if (!Array.isArray(e.stops) || !e.stops.length) return;   // gradient with no stops → nothing
      stopStr = (e.stops.length === 1)
        ? `${col(e.stops[0].color)} 0%, ${col(e.stops[0].color)} 100%`
        : e.stops.map(s => `${col(s.color)} ${s.pos}%`).join(', ');
    }
    imgs.push(`linear-gradient(${sideDir[side]}, ${stopStr})`);
    const th = e.thickness || 1;
    sizes.push(side === 'top' || side === 'bottom' ? `100% ${th}px` : `${th}px 100%`);
    positions.push(side);
  });
  if (!imgs.length) return null;
  return { image: imgs.join(', '), size: sizes.join(', '), position: positions.join(', '), repeat: imgs.map(() => 'no-repeat').join(', ') };
}

// Column width -> number of px (0 = Auto). Handles number, '60px'/'60' string,
// and the legacy width_mode:'auto' flag.
function normalizeColumnWidth(c) {
  if (c.width_mode === 'auto') return 0;
  const w = c.width;
  if (typeof w === 'number') return w > 0 ? w : 0;
  if (typeof w === 'string') {
    const s = w.trim().toLowerCase();
    // Flexible / responsive widths are preserved as strings so they scale with
    // the card: '20%', '1fr', 'auto', 'max-content', 'min-content'. A bare
    // number or 'Npx' string collapses to a px number (0 = Auto).
    if (s === 'auto' || s === 'max-content' || s === 'min-content') return s;
    if (/^\d*\.?\d+\s*(%|fr)$/.test(s)) return s.replace(/\s+/g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  return 0;
}

function normalizeColumn(c) {
  c = c || {};
  const kind = ['icon', 'name', 'value'].includes(c.kind) ? c.kind : 'value';
  const out = {
    id: c.id || ('col_' + Math.random().toString(36).slice(2, 8)),
    kind,
    header: c.header != null ? String(c.header) : '',
    show_header: c.show_header !== false,
    header_color: c.header_color || '',
    align: ['left', 'center', 'right'].includes(c.align) ? c.align : (kind === 'name' ? 'left' : (kind === 'icon' ? 'center' : 'right')),
    // Header cell alignment; defaults to the column's data alignment when unset.
    header_align: ['left', 'center', 'right'].includes(c.header_align) ? c.header_align : '',
    // Width in px; 0 = Auto. Accepts a number, a legacy '60px'/'60' string, or
    // (legacy) width_mode:'auto' which maps to 0.
    width: normalizeColumnWidth(c),
    // Text shown when the entity's value is missing (off / blank / unavailable).
    // undefined => built-in em-dash; '' => show nothing; any string => literal.
    empty_text: c.empty_text !== undefined ? String(c.empty_text) : undefined,
    value: normalizeValueRef(c.value),
    color: c.color ? normalizeRuleSet(c.color) : null
  };
  if (kind === 'icon') {
    const ic = c.icon || {};
    out.icon = {
      rules: Array.isArray(ic.rules) ? ic.rules.map(r => ({ when: normalizeCondition(r.when), result: r.result })) : [],
      default: ic.default !== undefined ? ic.default : '',
      color: ic.color ? normalizeRuleSet(ic.color) : null,
      size: ic.size ?? 14,
      show: ic.show ? normalizeCondition(ic.show) : null,
      // When true, an unmatched icon falls back to the entity's native HA icon
      // (same as a '__default__' result). Emitted only when set (byte-stable).
      ...(ic.use_native_icon ? { use_native_icon: true } : {})
    };
  }
  // Name column: optional secondary info sub-line stacked under the name (same
  // shape as an Entity Group's secondary_info). Emitted only when enabled, so
  // existing name columns stay byte-stable.
  if (kind === 'name' && c.secondary && c.secondary.enabled) {
    out.secondary = normalizeSecondaryInfo(c.secondary);
  }
  return out;
}

function normalizeSort(sort) {
  sort = sort || {};
  return {
    rules: Array.isArray(sort.rules)
      ? sort.rules.map(r => ({ when: normalizeCondition(r.when), weight: Number(r.weight) || 0 }))
      : [],
    default_weight: sort.default_weight != null ? Number(sort.default_weight) : 100,
    then_by: sort.then_by
      ? { ref: normalizeValueRef(sort.then_by.ref), dir: sort.then_by.dir === 'desc' ? 'desc' : 'asc' }
      : { ref: normalizeValueRef({ source: 'last_changed_ago' }), dir: 'asc' },
    pin_top: Array.isArray(sort.pin_top) ? [...sort.pin_top] : [],
    // Optional separator rows: subheaders / spacers inserted at fixed slots -
    // 'top' (above all rows), 'after_pinned' (between pinned and the rest), and
    // 'bottom' (below all). Emitted only when at least one slot is enabled, so
    // tables without separators stay byte-stable. See normalizeSeparator.
    ...(() => {
      const s = sort.separators ? normalizeSeparators(sort.separators) : {};
      return Object.keys(s).length ? { separators: s } : {};
    })()
  };
}

// One separator row's config: a full-width subheader/spacer.
function normalizeSeparator(sep) {
  sep = sep || {};
  return {
    enabled: sep.enabled === true,
    text: sep.text != null ? String(sep.text) : '',
    height: Number(sep.height) >= 0 ? Math.floor(Number(sep.height)) : 8,
    // Empty space ABOVE / BELOW the separator row (px), so it can breathe apart
    // from the entity rows around it.
    space_above: Number(sep.space_above) >= 0 ? Math.floor(Number(sep.space_above)) : 0,
    space_below: Number(sep.space_below) >= 0 ? Math.floor(Number(sep.space_below)) : 0,
    color: sep.color || '',
    bg: sep.bg || '',
    font_size: sep.font_size ?? 11,
    weight: sep.weight ?? 700,
    align: ['left', 'center', 'right'].includes(sep.align) ? sep.align : 'left',
    italic: sep.italic === true
  };
}
// The three fixed separator slots. Emitted only for slots that are enabled.
function normalizeSeparators(seps) {
  seps = seps || {};
  const out = {};
  ['top', 'after_pinned', 'bottom'].forEach(slot => {
    if (seps[slot] && seps[slot].enabled) out[slot] = normalizeSeparator(seps[slot]);
  });
  return out;
}

// Full normalizer for a type:'activity_table' section. Kept separate from the
// entities-section normalizer; both share the id/name/collapsible + all the
// per-section styling keys via normalizeSection (which delegates here).
function normalizeActivityTable(s) {
  return {
    filter: normalizeFilterDef(s.filter),
    columns: Array.isArray(s.columns) && s.columns.length ? s.columns.map(normalizeColumn) : [],
    sort: normalizeSort(s.sort),
    headers: {
      show: (s.headers && s.headers.show) !== false,
      color: (s.headers && s.headers.color) || '#90EE90',
      font_size: (s.headers && s.headers.font_size) ?? 10
    },
    title_row: normalizeTitleRow(s.title_row),
    row_style: normalizeRowStyle(s.row_style),
    tap_action: normalizeAction(s.tap_action, 'more-info'),
    hold_action: normalizeAction(s.hold_action, 'none'),
    window_minutes: s.window_minutes != null ? Number(s.window_minutes) : 0,
    // What counts as "active" for the window_minutes recency gate (an active
    // row always shows; inactive rows show only if changed within the window).
    active_when: s.active_when ? normalizeCondition(s.active_when) : null,
    hide_when_empty: s.hide_when_empty === true,
    // Cap the number of rows shown (0 = no limit). Applied AFTER sorting /
    // reverse, so it keeps the top N most-relevant rows.
    max_rows: Number(s.max_rows) > 0 ? Math.floor(Number(s.max_rows)) : 0,
    // Row source: where the table's rows come from. Default 'entities' (rule
    // sets / inline filter, one row per entity). 'attribute_array' reads one
    // row per element of an entity attribute that holds a list of objects
    // (e.g. sensor.house_mode_history / history[]). Emitted only when it's the
    // array type, so entity-sourced tables stay byte-stable.
    ...(s.row_source && s.row_source.type === 'attribute_array'
      ? { row_source: normalizeRowSource(s.row_source) } : {})
  };
}

// Attribute-array row source: names the entity + attribute holding the array,
// and whether to reverse it (newest-first). See resolveFieldRef / the renderer.
function normalizeRowSource(rsc) {
  rsc = rsc || {};
  return {
    type: 'attribute_array',
    entity: rsc.entity || '',
    attribute: rsc.attribute || '',
    reverse: rsc.reverse === true
  };
}

// Section-level rule-set membership fields, applied to BOTH section types.
// Emitted ONLY when present, so legacy entities-sections stay byte-stable
// (no rule_sets/static_entities keys appear until the section actually uses
// them). (Kept separate from normalizeActivityTable since Entity Groups use
// these too.)
function normalizeSectionMembership(s) {
  const out = {};
  const refs = normalizeSectionRuleSets(s.rule_sets);
  if (refs.length) out.rule_sets = refs;
  if (s.static_entities && typeof s.static_entities === 'object' && Object.keys(s.static_entities).length) {
    out.static_entities = Object.fromEntries(
      Object.entries(s.static_entities).map(([k, v]) => [k, Array.isArray(v) ? v.slice() : []]));
  }
  // Per-section "Remove Text From Entity Names" - ADDITIVE to the card-global
  // strip_entity_strings. Emitted only when non-empty (byte-stability).
  if (Array.isArray(s.strip_strings) && s.strip_strings.length) {
    out.strip_strings = s.strip_strings.slice();
  }
  return out;
}

function normalizeTitleRow(tr) {
  tr = tr || {};
  const txt = tr.text || {};
  const oldLayout = tr.layout || {};
  // The title row is ALWAYS three independently-placed + styled parts: icon,
  // title, count. Each part has a text `template` (icon's template is unused -
  // it renders the section icon glyph), an align (left/center/right zone),
  // color, size, weight, italic, and a show toggle. Defaults derive from the
  // older flat fields (text.template, icon_size) so existing configs upgrade.
  const part = (p, defAlign, defSize, defWeight, defTemplate) => ({
    show: p.show !== false,
    template: p.template !== undefined ? p.template : defTemplate,
    align: ['left', 'center', 'right'].includes(p.align) ? p.align : defAlign,
    color: p.color || '',
    size: p.size ?? defSize,
    weight: p.weight ?? defWeight,
    italic: p.italic === true,
    // Alternate text shown when the count is 0 (e.g. "All Secure"). Emitted
    // only when set, so existing configs stay byte-stable.
    ...(p.zero_text !== undefined && p.zero_text !== '' ? { zero_text: String(p.zero_text) } : {})
  });
  // Source for the parts: explicit `tr.parts` (new format), else the older
  // `tr.layout` (interim format), else legacy migration below.
  const src = tr.parts || tr.layout || null;
  // Legacy migration: a config with no parts/layout used a single text.template
  // (which may already embed {count}). Render that whole template as the title
  // part and HIDE the separate count part so the count isn't shown twice.
  const legacy = !src;
  const P = src || {};
  const titleDefaultTpl = legacy ? (txt.template || '{name} - {count}') : (txt.template || '{name}');
  const countPartInput = legacy ? { show: false } : (P.count || {});

  return {
    show: tr.show !== false,
    icon: tr.icon || '',
    icon_color: tr.icon_color ? normalizeRuleSet(tr.icon_color) : null,
    icon_size: tr.icon_size ?? 30,
    // State-driven header icon: pick the glyph AND/OR color by evaluating rules
    // against either the live count, or a specific entity's value. Emitted only
    // when configured (byte-stable). See _resolveHeaderIcon in the renderer.
    ...(tr.header_icon && (tr.header_icon.enabled || (tr.header_icon.rules && tr.header_icon.rules.length) || (tr.header_icon.color_rules && tr.header_icon.color_rules.rules))
      ? { header_icon: normalizeHeaderIcon(tr.header_icon) } : {}),
    // Kept for backward-compat + the count condition.
    text: {
      template: txt.template || '{name} - {count}',
      font_size: txt.font_size ?? 16,
      weight: txt.weight ?? 700,
      color: txt.color || '',
      align: txt.align || 'start'
    },
    count: {
      mode: (tr.count && tr.count.mode) === 'rows' ? 'rows' : 'condition',
      when: tr.count && tr.count.when ? normalizeCondition(tr.count.when) : normalizeCondition({ op: 'is_on' })
    },
    parts: {
      // Icon part also carries its own color-rule set (migrated from the older
      // top-level title_row.icon_color). Rules test the count value.
      icon:  Object.assign(part(P.icon || {}, 'left', tr.icon_size ?? 30, 400, ''), {
        color_rules: (P.icon && P.icon.color_rules) ? normalizeRuleSet(P.icon.color_rules)
                    : (tr.icon_color ? normalizeRuleSet(tr.icon_color) : null)
      }),
      title: part(P.title || {}, 'left',  txt.font_size ?? 16, txt.weight ?? 700, titleDefaultTpl),
      count: part(countPartInput,  'right', txt.font_size ?? 16, 700, (P.count_template || (P.count && P.count.template)) || '{count}'),
      // User-added custom parts: each has a `kind` (text|icon), a template
      // (text parts) or icon glyph, plus the standard placement/style fields.
      extra: Array.isArray(P.extra) ? P.extra.map((e, i) => {
        const base = part(e, 'right', 14, 400, '{name}');
        return Object.assign(base, {
          id: e.id || ('tp_' + i + '_' + Math.random().toString(36).slice(2, 6)),
          kind: e.kind === 'icon' ? 'icon' : 'text',
          icon: e.icon || 'mdi:information-outline'
        });
      }) : []
    },
    glow: tr.glow ? { when: normalizeCondition(tr.glow.when), color: tr.glow.color || '#ff0000' } : null
  };
}

// State-driven header icon. Chooses the header glyph and/or its color by
// evaluating rules against a value:
//   source: 'count'  - test the live count (uses count-ops: gt/eq/lt/... like
//                       the existing count-driven icon_color); OR
//   source: 'entity' - test a specific entity's state/attribute (full Condition
//                       shape, incl. compound all/any). `entity` names it.
// `rules` -> glyph (mdi:...), `color_rules` -> color; each with a default.
function normalizeHeaderIcon(hi) {
  hi = hi || {};
  const source = hi.source === 'entity' ? 'entity' : 'count';
  const mapRules = arr => Array.isArray(arr)
    ? arr.map(r => ({ when: normalizeCondition(r.when), result: r.result })) : [];
  return {
    enabled: hi.enabled !== false,
    source,
    entity: hi.entity || '',
    rules: mapRules(hi.rules),
    default: hi.default !== undefined ? hi.default : '',
    color_rules: {
      rules: mapRules(hi.color_rules && hi.color_rules.rules),
      default: (hi.color_rules && hi.color_rules.default !== undefined) ? hi.color_rules.default : ''
    }
  };
}

function normalizeRowStyle(rs) {
  rs = rs || {};
  return {
    font_size: rs.font_size ?? 14,
    padding_v: rs.padding_v ?? 6,
    padding_h: rs.padding_h ?? 6,
    // Left indent (px) of the whole table inside the card.
    indent: Number(rs.indent) || 0,
    text_color: rs.text_color || '',
    divider: {
      show: !!(rs.divider && rs.divider.show),
      color: (rs.divider && rs.divider.color) || '#333333',
      width: (rs.divider && rs.divider.width) ?? 1
    },
    zebra: rs.zebra === true,
    hover_highlight: rs.hover_highlight !== false,
    name_link: rs.name_link !== false,
    strip_strings: Array.isArray(rs.strip_strings) ? [...rs.strip_strings] : []
  };
}

// Secondary info line for Entity Group rows: a small string rendered directly
// under the friendly name (e.g. "Zone 1" from an attribute). `source` reuses
// the same value refs as tables (attribute / state / area / etc.), with an
// optional label prefix and full styling (color, size, indent, weight, italic).
function normalizeSecondaryInfo(si) {
  si = si || {};
  const SOURCES = ['attribute', 'state', 'last_changed_ago', 'last_changed_time', 'area', 'entity_id', 'integration'];
  return {
    enabled: si.enabled === true,
    source: SOURCES.includes(si.source) ? si.source : 'attribute',
    attribute: si.attribute || '',
    transform: si.transform || 'none',
    unit: si.unit || '',
    // Optional label shown before the value, e.g. "Zone: ". Blank = value only.
    prefix: si.prefix || '',
    color: si.color || '',
    font_size: si.font_size ?? 12,
    // Extra left indent (px) relative to the name, so it can align under the
    // name text rather than the icon.
    indent: Number(si.indent) || 0,
    font_weight: si.font_weight || 400,
    italic: si.italic === true
  };
}

// Global "Entity Table Defaults" - the PRESENTATION bucket (headers + row
// style) that seeds every NEW table section. Content (columns, sort, title,
// filter) is never defaulted here. Defaults are seeded from the Lights table's
// look. Existing sections are unaffected unless the user hits Reset.
function normalizeTableDefaults(td) {
  td = td || {};
  const h = td.headers || {};
  return {
    headers: {
      show: h.show !== false,
      color: h.color || '#90EE90',
      font_size: h.font_size ?? 11
    },
    row_style: normalizeRowStyle(td.row_style)
  };
}

// Seed a NEW table section's presentation from the card's table_defaults, but
// only for keys the section didn't already specify (so named presets keep
// their own baked-in look while a blank table inherits the house style).
function applyTableDefaults(sectionCfg, config) {
  if (!sectionCfg || sectionCfg.type !== 'activity_table') return sectionCfg;
  const td = normalizeTableDefaults(config && config.table_defaults);
  if (sectionCfg.headers === undefined) sectionCfg.headers = JSON.parse(JSON.stringify(td.headers));
  if (sectionCfg.row_style === undefined) sectionCfg.row_style = JSON.parse(JSON.stringify(td.row_style));
  return sectionCfg;
}

// Shared by EasyEntityStylerCard.setConfig and the editor's _normalizeConfig
// so the two never drift apart on defaults.
// A standalone Divider section (ported from the Color card). Sparse — carries
// only divider styling. Rendered by dividerLineHtml. Replaces EESC's old
// inline per-section dividers and the global section-divider feature.
function normalizeDividerSection(s) {
  s = s || {};
  const out = {
    id: s.id || uid(),
    type: 'divider',
    // 'label'/'icon' optional content shown on/above/below the line.
    label: s.label != null ? String(s.label) : '',
    icon: s.icon ? String(s.icon) : '',
    // Line: color/thickness/length(%)/style/justify.
    color: s.color || '',
    thickness: Number(s.thickness) > 0 ? Number(s.thickness) : 1,
    length: Math.max(5, Math.min(100, Number(s.length) || 100)),
    line_style: ['solid', 'dashed', 'dotted'].includes(s.line_style) ? s.line_style : 'solid',
    justify: ['left', 'center', 'right'].includes(s.justify) ? s.justify : 'center',
    // Content placement + styling.
    text_position: ['above', 'on', 'below'].includes(s.text_position) ? s.text_position : 'on',
    content_justify: ['left', 'center', 'right'].includes(s.content_justify) ? s.content_justify : (s.justify || 'center'),
    indent: Math.max(0, Math.min(200, Number(s.indent) || 0)),
    text_size: Number(s.text_size) > 0 ? Number(s.text_size) : 13,
    text_weight: s.text_weight || '600',
    text_color_mode: ['line', 'theme', 'fixed'].includes(s.text_color_mode) ? s.text_color_mode : (s.text_color ? 'fixed' : 'line'),
    text_color: s.text_color || '',
    icon_size: Number(s.icon_size) > 0 ? Number(s.icon_size) : 0,
    icon_color_mode: ['text', 'theme', 'fixed'].includes(s.icon_color_mode) ? s.icon_color_mode : (s.icon_color ? 'fixed' : 'text'),
    icon_color: s.icon_color || '',
    // Visibility toggles + gradient.
    hide_line: s.hide_line === true,
    hide_text: s.hide_text === true,
    hide_icon: s.hide_icon === true,
    mirror_center: s.mirror_center === true,
    gradient: s.gradient === true
  };
  if (Array.isArray(s.stops)) {
    out.stops = s.stops.map(st => ({ pos: Math.max(0, Math.min(100, Number(st.pos) || 0)), color: String(st.color || 'transparent') }));
  }
  // Which gradient pattern preset produced the current stops (so the editor's
  // Pattern dropdown reflects the saved choice). Emitted only when a valid index.
  if (s.gradient_pattern != null && Number.isInteger(Number(s.gradient_pattern)) &&
      Number(s.gradient_pattern) >= 0 && Number(s.gradient_pattern) < DIVIDER_GRADIENT_PATTERNS.length) {
    out.gradient_pattern = Number(s.gradient_pattern);
  }
  // Hidden dividers stay in config + the editor list but don't render (byte-stable: only when true).
  if (s.hidden === true) out.hidden = true;
  return out;
}

function normalizeSection(s) {
  if (s && s.type === 'divider') return normalizeDividerSection(s);
  return {
    id: s.id || uid(),
    name: s.name || 'Section',
    collapsible: s.collapsible !== false,
    show_title: s.show_title !== false,
    entities: Array.isArray(s.entities) ? [...s.entities] : [],
    // Section type: 'entities' (default, unchanged behavior) or
    // 'activity_table' (declarative filtered table - see normalizeActivityTable).
    type: s.type === 'activity_table' ? 'activity_table' : 'entities',
    // Section header style (blank string = inherit the card's global colors)
    icon: s.icon || '',
    icon_color: s.icon_color || '',
    icon_size: s.icon_size || 20,
    title_color: s.title_color || '',
    title_font_size: s.title_font_size || 14,
    title_font_weight: s.title_font_weight || 600,
    title_font_style: s.title_font_style || 'normal',
    // Left indent of the section header row (px).
    title_indent: s.title_indent ?? 0,
    // Force the section open whenever it has visible entities (only meaningful
    // for a collapsible section). Overrides auto-close while entities show.
    keep_expanded_when_entities: s.keep_expanded_when_entities === true,
    // Initial expand/collapse state a collapsible section renders in.
    // 'collapsed' (default) or 'expanded'.
    default_state: s.default_state === 'expanded' ? 'expanded' : 'collapsed',
    // Entity row style, applied to every entity rendered in this section
    entity_icon_color: s.entity_icon_color || '',
    entity_icon_size: s.entity_icon_size || 20,
    entity_text_color: s.entity_text_color || '',
    entity_font_size: s.entity_font_size || 13,
    entity_font_weight: s.entity_font_weight || 400,
    entity_font_style: s.entity_font_style || 'normal',
    // Secondary info line under the entity name (Entity Group rows), à la the
    // native multiple-entity-row's secondary_info. Emitted only when enabled so
    // legacy sections stay byte-stable.
    ...(s.secondary_info && s.secondary_info.enabled
      ? { secondary_info: normalizeSecondaryInfo(s.secondary_info) } : {}),
    // Applied Header Rule Sets (ordered, layered last-wins). Each ref binds an
    // entity (blank = section's primary entity). Emitted only when non-empty so
    // legacy sections stay byte-stable.
    ...((Array.isArray(s.header_rule_refs) && s.header_rule_refs.length)
      ? { header_rule_refs: normalizeHeaderRuleRefs(s.header_rule_refs) } : {}),
    // Format-chip style, per section (blank color = inherit the card's global chip colors)
    chip_bg: s.chip_bg || '',
    chip_border_color: s.chip_border_color || '',
    chip_text_color: s.chip_text_color || '',
    chip_scale: s.chip_scale || 1.0,
    chip_show_icon: s.chip_show_icon !== false,
    // 'entity' = the entity's own icon (default), 'section' = this section's
    // icon, 'none' = no icon on the chip. (Legacy 'auto' migrates to 'entity'.)
    chip_icon_source: (s.chip_icon_source && s.chip_icon_source !== 'auto') ? s.chip_icon_source : 'entity',
    chip_show_name: s.chip_show_name === true,
    // Hide the chip entirely when the entity is in a given state. Three
    // independent flags. The old single chip_hide_when_off boolean migrates
    // to all three (its original behavior was off + unknown + unavailable).
    chip_hide_off: s.chip_hide_off === true || s.chip_hide_when_off === true,
    chip_hide_unknown: s.chip_hide_unknown === true || s.chip_hide_when_off === true,
    chip_hide_unavailable: s.chip_hide_unavailable === true || s.chip_hide_when_off === true,
    // Hide the entity's state/value text on the chip (show only the icon
    // and, if enabled, the name).
    chip_hide_state: s.chip_hide_state === true,
    // Chip tap / hold actions (per section, applied to every chip). Default
    // tap = more-info, hold = none. See normalizeAction for the shape.
    chip_tap_action: normalizeAction(s.chip_tap_action, 'more-info'),
    chip_hold_action: normalizeAction(s.chip_hold_action, 'none'),
    // Layout of chips within a "Chips Only" section: wrap (flex row, wraps),
    // column (one per line), or grid (fixed-width grid columns)
    chip_layout: s.chip_layout || 'wrap',
    // Shape: pill (fully rounded), rounded (uses chip_radius), square (0 radius)
    chip_shape: s.chip_shape || 'pill',
    chip_radius: s.chip_radius ?? 8,
    // When true, every entity in this section renders as a chip only - no
    // row icon, no row name, chips laid out per chip_layout
    chips_only: s.chips_only === true,

    // Frame preset stack applied to this section — the SINGLE source of frame
    // styling (border / glow / shadow / background / edges). Always present so a
    // section is fully driven by its presets; an empty stack = no frame.
    // Shape: { presets: [] } (ordered, last writer wins). See STYLES_DESIGN.
    frame: normalizeFrameRef(s.frame),

    // Hidden sections stay in config + the editor list but don't render on the
    // card. Emitted only when true so existing configs stay byte-stable.
    ...(s.hidden === true ? { hidden: true } : {}),

    // (Inline per-section dividers removed — dividers are now standalone
    // Divider sections; see normalizeDividerSection.)

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
    row_border_color: s.row_border_color || '',

    // Entity Display Rules: ordered list of conditions evaluated per entity.
    // An entity is shown only if it passes the rules (empty = show all).
    entity_rules: Array.isArray(s.entity_rules) ? s.entity_rules.map(normalizeRule) : [],

    // Section Display Condition: when 'hide_when_empty', the whole section
    // (header included) is hidden if the rules leave zero entities visible.
    // 'always' (default) always renders the section.
    section_display: s.section_display === 'hide_when_empty' ? 'hide_when_empty' : 'always',

    // Per-section entity count in the header.
    //   count_mode: 'off' (default) | 'title' (next to the title, e.g.
    //     "Alert Bypasses - 2") | 'right' (far right, replacing the time value)
    //   count_prefix: text placed before the number in 'title' mode
    //     (default " - ", giving "Name - 2")
    count_mode: ['title', 'right'].includes(s.count_mode) ? s.count_mode : 'off',
    count_prefix: s.count_prefix != null ? String(s.count_prefix) : ' - ',
    count_color: s.count_color || '',
    count_font_size: s.count_font_size ?? 13,
    count_font_weight: s.count_font_weight || 400,
    count_font_style: s.count_font_style || 'normal',

    // Rule-set membership refs (emitted only when the section uses them).
    ...normalizeSectionMembership(s),

    // Activity-table config is merged ONLY for activity_table sections, so
    // plain 'entities' sections keep their exact original key set (no config
    // bloat / no diff when an existing config is re-saved).
    ...(s.type === 'activity_table' ? normalizeActivityTable(s) : {})
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

// ===========================================================================
// ACTIVITY TABLE PRESETS
// ---------------------------------------------------------------------------
// Each preset is a full section config (pre-normalization) reproducing one of
// the templates.yaml *_recent_table sensors, entirely client-side. Selectable
// from the editor's "Add section" menu. Users get the six views without
// hand-building filters/columns/rules.
// ===========================================================================

// The template row-color decay ladder as a reusable color RuleSet over the
// entity's last_changed_ago (seconds): active => white, then fading grays.
function _decayColorRuleSet(activeCond) {
  return {
    rules: [
      { when: activeCond, result: 'white' },
      { when: { ref: { source: 'last_changed_ago' }, op: 'le', value: 300 },  result: '#D3D3D3' },
      { when: { ref: { source: 'last_changed_ago' }, op: 'le', value: 900 },  result: '#B0B0B0' },
      { when: { ref: { source: 'last_changed_ago' }, op: 'le', value: 1800 }, result: '#909090' },
      { when: { ref: { source: 'last_changed_ago' }, op: 'le', value: 3600 }, result: '#707070' }
    ],
    default: '#505050'
  };
}

// Standard trailing "Last Change" (relative) + "Time" columns are represented
// by a single relative-time column here (clock-time is derivable but omitted
// to keep presets compact; users can add a column). Sorting: active first,
// then most-recent.
function _standardSort(activeCond) {
  return {
    rules: [{ when: activeCond, weight: 0 }],
    default_weight: 100,
    then_by: { ref: { source: 'last_changed_ago' }, dir: 'asc' }
  };
}

function getActivityPresets() {
  const onCond   = { op: 'is_on' };
  const openCond = { op: 'in', values: ['open', 'opening', 'closing'] };

  return [
    {
      key: 'lights',
      label: 'Lights On (entity table)',
      section: {
        name: 'Lights On', type: 'activity_table', collapsible: false,
        icon_size: 24, title_indent: 4, keep_expanded_when_entities: true,
        window_minutes: 120, hide_when_empty: false,
        filter: {
          include: [{ field: 'domain', op: 'eq', value: 'light' }],
          exclude: [
            { field: 'entity_id', op: 'contains', value: 'group' },
            { field: 'entity_id', op: 'contains', value: 'browser_mod' },
            { field: 'name', op: 'contains', values: ['screen', 'fan', 'super', 'lv', 'group'] },
            { field: 'area', op: 'contains', value: 'RGB' },
            { all_of: [
                { any_of: [
                    { field: 'label', op: 'eq', value: 'RGB Light' },
                    { field: 'label', op: 'eq', value: 'RGB Group' } ] },
                { field: 'label', op: 'ne', value: 'RGB Control Group' } ] }
          ]
        },
        columns: [
          { kind: 'icon', show_header: false, width: 44,
            icon: { rules: [
                { when: onCond, result: 'mdi:lightbulb-on' },
                { when: { all: [{ op: 'is_off' }, { ref: { source: 'last_changed_ago' }, op: 'lt', value: 600 }] }, result: 'mdi:lightbulb-off' }
              ], default: '', size: 26,
                    color: { rules: [{ when: onCond, result: '#eab308' }], default: '#505050' } } },
          { kind: 'name', header: '', width: 174, value: { source: 'name' }, color: _decayColorRuleSet(onCond) },
          { kind: 'value', header: '', align: 'right', width: 60,
            value: { source: 'attribute', attribute: 'brightness', transform: 'pct_of_255', unit: '%' },
            color: _decayColorRuleSet(onCond) },
          { kind: 'value', header: 'Last Change', align: 'right', width: 90,
            value: { source: 'last_changed_ago' }, color: _decayColorRuleSet(onCond) },
          { kind: 'value', header: 'Time', align: 'right', width: 90,
            value: { source: 'last_changed_time' }, color: _decayColorRuleSet(onCond) }
        ],
        sort: {
          rules: [{ when: onCond, weight: 30 }],
          default_weight: 100,
          then_by: { ref: { source: 'last_changed_ago' }, dir: 'asc' }
        },
        headers: { show: true, color: '#90EE90', font_size: 15 },
        title_row: { icon: 'mdi:lightbulb-on', icon_size: 30,
          count: { mode: 'condition', when: onCond },
          parts: {
            icon:  { show: true, align: 'left', size: 30 },
            title: { show: true, align: 'left', template: '{name} -', size: 16, weight: 700 },
            count: { show: true, align: 'left', template: '{count}', size: 16, weight: 700 }
          },
          icon_color: { rules: [{ when: { op: 'gt', value: 0 }, result: '#2196F3' }], default: 'gray' } },
        row_style: { font_size: 15, name_link: true, strip_strings: [' Lights', ' Light', 'Lights ', 'Light '] }
      }
    },
    {
      key: 'windows',
      label: 'Open Windows (entity table)',
      section: {
        name: 'Windows', type: 'activity_table', collapsible: true, window_minutes: 60,
        filter: {
          include: [{ field: 'device_class', op: 'eq', value: 'window' }],
          exclude: [
            { field: 'entity_id', op: 'contains', value: 'group' },
            { field: 'name', op: 'contains', value: 'group' }
          ]
        },
        columns: [
          { kind: 'icon', show_header: false, width_mode: 'fixed', width: '28px',
            icon: { rules: [{ when: onCond, result: 'mdi:window-open-variant' }], default: '', size: 12,
                    color: { rules: [{ when: onCond, result: '#2196F3' }], default: '#505050' } } },
          { kind: 'name', value: { source: 'name' }, color: _decayColorRuleSet(onCond) },
          { kind: 'value', header: 'Time', align: 'right', width_mode: 'fixed', width: '80px',
            value: { source: 'last_changed_ago' }, color: _decayColorRuleSet(onCond) }
        ],
        sort: _standardSort(onCond),
        title_row: { icon: 'mdi:window-open-variant', text: { template: 'Open Windows - {count}' },
          count: { mode: 'condition', when: onCond },
          icon_color: { rules: [{ when: { op: 'gt', value: 0 }, result: '#2196F3' }], default: 'gray' } },
        strip_strings: [' Window', ' Sensor', 'Window ', 'Sensor ']
      }
    },
    {
      key: 'doors',
      label: 'Open Doors (entity table)',
      section: {
        name: 'Doors', type: 'activity_table', collapsible: true, window_minutes: 60,
        filter: {
          include: [{ field: 'device_class', op: 'in', values: ['door', 'garage_door'] }],
          exclude: [
            { field: 'entity_id', op: 'contains', values: ['lock', 'group', 'motion'] },
            { field: 'name', op: 'contains', values: ['group', 'lock', 'motion'] }
          ]
        },
        columns: [
          { kind: 'icon', show_header: false, width_mode: 'fixed', width: '28px',
            icon: { rules: [{ when: onCond, result: 'mdi:door-open' }], default: '', size: 12,
                    color: { rules: [{ when: onCond, result: 'white' }], default: '#505050' } } },
          { kind: 'name', value: { source: 'name' }, color: _decayColorRuleSet(onCond) },
          { kind: 'value', header: 'Time', align: 'right', width_mode: 'fixed', width: '80px',
            value: { source: 'last_changed_ago' }, color: _decayColorRuleSet(onCond) }
        ],
        sort: _standardSort(onCond),
        title_row: { icon: 'mdi:door-open', text: { template: 'Open Doors - {count}' },
          count: { mode: 'condition', when: onCond },
          icon_color: { rules: [{ when: { op: 'gt', value: 0 }, result: '#2196F3' }], default: 'gray' } },
        strip_strings: [' Door', ' Sensor', 'Door ', 'Sensor ']
      }
    },
    {
      key: 'shades',
      label: 'Open Shades (entity table)',
      section: {
        name: 'Shades', type: 'activity_table', collapsible: true, window_minutes: 1440,
        filter: {
          include: [{ field: 'domain', op: 'eq', value: 'cover' }],
          exclude: [
            { field: 'entity_id', op: 'contains', values: ['group', 'garage'] },
            { field: 'name', op: 'contains', values: ['group', 'garage'] },
            { field: 'device_class', op: 'eq', value: 'garage' }
          ]
        },
        columns: [
          { kind: 'icon', show_header: false, width_mode: 'fixed', width: '28px',
            icon: { rules: [{ when: { ref: { source: 'attribute', attribute: 'current_position' }, op: 'gt', value: 0 }, result: 'mdi:window-shutter-open' }],
                    default: '', size: 12, color: { default: 'gray' } } },
          { kind: 'name', value: { source: 'name' },
            color: { rules: [{ when: { ref: { source: 'attribute', attribute: 'current_position' }, op: 'gt', value: 0 }, result: 'white' }], default: '#707070' } },
          { kind: 'value', header: '', align: 'right', width_mode: 'fixed', width: '50px',
            value: { source: 'attribute', attribute: 'current_position', unit: '%' },
            color: { rules: [{ when: { ref: { source: 'attribute', attribute: 'current_position' }, op: 'gt', value: 0 }, result: 'white' }], default: '#707070' } },
          { kind: 'value', header: 'Time', align: 'right', width_mode: 'fixed', width: '80px',
            value: { source: 'last_changed_ago' },
            color: { rules: [{ when: { ref: { source: 'attribute', attribute: 'current_position' }, op: 'gt', value: 0 }, result: 'white' }], default: '#707070' } }
        ],
        sort: {
          rules: [{ when: { ref: { source: 'attribute', attribute: 'current_position' }, op: 'gt', value: 0 }, weight: 0 }],
          default_weight: 100, then_by: { ref: { source: 'last_changed_ago' }, dir: 'asc' }
        },
        title_row: { icon: 'mdi:window-shutter-open', text: { template: 'Open Shades - {count}' },
          count: { mode: 'condition', when: { ref: { source: 'attribute', attribute: 'current_position' }, op: 'gt', value: 0 } },
          icon_color: { rules: [{ when: { op: 'gt', value: 0 }, result: '#2196F3' }], default: 'gray' } },
        strip_strings: [' Shades', ' Shade', 'Shades ', 'Shade ', ' Cover', 'Cover ']
      }
    },
    {
      key: 'leak',
      label: 'Leak Sensors (entity table)',
      section: {
        name: 'Leak Sensors', type: 'activity_table', collapsible: true, window_minutes: 0,
        filter: { include: [{ field: 'device_class', op: 'eq', value: 'moisture' }] },
        columns: [
          { kind: 'icon', show_header: false, width_mode: 'fixed', width: '28px',
            icon: { rules: [{ when: onCond, result: 'mdi:water-alert' }], default: '', size: 14,
                    color: { rules: [{ when: onCond, result: 'red' }], default: '#505050' } } },
          { kind: 'name', value: { source: 'name' },
            color: { rules: [{ when: onCond, result: 'red' }], default: '#D3D3D3' } },
          { kind: 'value', header: 'Battery', align: 'center', width_mode: 'fixed', width: '70px',
            value: { source: 'attribute', attribute: 'battery', unit: '%' },
            color: { rules: [
              { when: onCond, result: 'red' },
              { when: { ref: { source: 'attribute', attribute: 'battery' }, op: 'le', value: 20 }, result: 'yellow' },
              { when: { ref: { source: 'attribute', attribute: 'battery' }, op: 'le', value: 50 }, result: 'orange' }
            ], default: '#D3D3D3' } },
          { kind: 'value', header: 'Time', align: 'right', width_mode: 'fixed', width: '80px',
            value: { source: 'last_changed_ago' },
            color: { rules: [{ when: onCond, result: 'red' }], default: '#D3D3D3' } }
        ],
        sort: _standardSort(onCond),
        title_row: { icon: 'mdi:water', text: { template: 'Leak Sensors - {count}' },
          count: { mode: 'condition', when: onCond },
          icon_color: { rules: [{ when: { op: 'gt', value: 0 }, result: '#ff4444' }], default: '#2196F3' } }
      }
    },
    {
      key: 'illuminance',
      label: 'Illuminance (entity table)',
      section: {
        name: 'Illuminance', type: 'activity_table', collapsible: true, window_minutes: 120,
        filter: { include: [{ field: 'device_class', op: 'eq', value: 'illuminance' }],
                  exclude: [{ field: 'name', op: 'contains', values: ['screen', 'fan', 'super', 'lv', 'group'] }] },
        columns: [
          { kind: 'icon', show_header: false, width_mode: 'fixed', width: '28px',
            icon: { rules: [
              { when: { op: 'gt', value: 1000 }, result: 'mdi:brightness-7' },
              { when: { op: 'gt', value: 500 },  result: 'mdi:brightness-6' },
              { when: { op: 'gt', value: 100 },  result: 'mdi:brightness-5' },
              { when: { op: 'gt', value: 10 },   result: 'mdi:brightness-4' },
              { when: { op: 'gt', value: 1 },    result: 'mdi:brightness-3' }
            ], default: 'mdi:brightness-1', size: 12,
               color: { rules: [
                 { when: { op: 'gt', value: 1000 }, result: '#ffee00' },
                 { when: { op: 'gt', value: 100 },  result: '#d4900a' }
               ], default: '#6b3a06' } } },
          { kind: 'name', value: { source: 'name' }, color: { default: 'white' } },
          { kind: 'value', header: 'Lux', align: 'right', width_mode: 'fixed', width: '80px',
            value: { source: 'state', transform: 'round1', unit: ' lx' }, color: { default: 'white' } }
        ],
        sort: { rules: [], default_weight: 0, then_by: { ref: { source: 'state' }, dir: 'desc' } },
        title_row: { icon: 'mdi:brightness-5', text: { template: 'Illuminance - {count}' },
          count: { mode: 'rows' }, icon_color: { rules: [], default: '#2196F3' } },
        strip_strings: [' Illuminance', ' Sensor', ' Light']
      }
    },
    {
      key: 'climate',
      label: 'Temp & Humidity (entity table)',
      section: {
        name: 'Climate', type: 'activity_table', collapsible: true, window_minutes: 0,
        // Temperature sensors from the "Home Climate" label, excluding "Outside".
        // Each row pairs with its humidity sibling on the same device.
        filter: {
          include: [
            { field: 'label', op: 'eq', value: 'Home Climate' },
            { field: 'device_class', op: 'eq', value: 'temperature' }
          ],
          exclude: [
            { field: 'label', op: 'eq', value: 'Outside' }
          ]
        },
        columns: [
          { kind: 'name', header: '', value: { source: 'name' }, color: { default: 'white' } },
          // TEMP column: colored by the temperature value ladder.
          { kind: 'value', header: 'TEMP', align: 'center', width_mode: 'fixed', width: '80px',
            value: { source: 'state', transform: 'round1', unit: '°F' },
            color: { rules: [
              { when: { op: 'lt', value: 40 }, result: '#3B82F6' },
              { when: { op: 'lt', value: 60 }, result: '#60A5FA' },
              { when: { op: 'lt', value: 70 }, result: '#34D399' },
              { when: { op: 'lt', value: 80 }, result: '#FBBF24' }
            ], default: '#F87171' } },
          // HUMIDITY column: value pulled from the sibling humidity sensor,
          // colored by the humidity ladder (against the sibling's value).
          { kind: 'value', header: 'HUMIDITY', align: 'center', width_mode: 'fixed', width: '90px',
            value: { source: 'related', related: {
              match: 'device', device_class: 'humidity',
              value: { source: 'state', transform: 'round1', unit: '%' } } },
            color: { rules: [
              { when: { ref: { source: 'related', related: { match: 'device', device_class: 'humidity', value: { source: 'state' } } }, op: 'lt', value: 20 }, result: '#D0021B' },
              { when: { ref: { source: 'related', related: { match: 'device', device_class: 'humidity', value: { source: 'state' } } }, op: 'lt', value: 30 }, result: '#F9665E' },
              { when: { ref: { source: 'related', related: { match: 'device', device_class: 'humidity', value: { source: 'state' } } }, op: 'lt', value: 40 }, result: '#FCB2AE' },
              { when: { ref: { source: 'related', related: { match: 'device', device_class: 'humidity', value: { source: 'state' } } }, op: 'lt', value: 50 }, result: '#799FCB' },
              { when: { ref: { source: 'related', related: { match: 'device', device_class: 'humidity', value: { source: 'state' } } }, op: 'lt', value: 60 }, result: '#4A90E2' },
              { when: { ref: { source: 'related', related: { match: 'device', device_class: 'humidity', value: { source: 'state' } } }, op: 'lt', value: 70 }, result: '#87CEFA' }
            ], default: '#1E90FF' } }
        ],
        // Sort by temperature, hottest first (matching the template).
        sort: { rules: [], default_weight: 0, then_by: { ref: { source: 'state' }, dir: 'desc' } },
        headers: { show: true, color: '#90EE90' },
        title_row: { icon: 'mdi:thermometer', text: { template: 'Climate - {count}' },
          count: { mode: 'rows' }, icon_color: { rules: [], default: '#2196F3' } },
        strip_strings: [' Temperature', ' Humidity', ' Sensor', ' Motion', ' Bosch']
      }
    }
  ];
}

// ===================================================================
// DIVIDER ENGINE (ported from Color card v134 — divider-as-its-own-section)
// ===================================================================
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function normalizeIcon(icon) {
  const s = String(icon || '').trim();
  if (!s) return '';
  return s.includes(':') ? s : `mdi:${s}`;
}

const DIVIDER_GRADIENT_PATTERNS = [
  { name: 'Solid → Transparent (fade out right)', stops: [{ pos: 0, color: null }, { pos: 100, color: 'transparent' }] },
  { name: 'Transparent → Solid (fade in right)', stops: [{ pos: 0, color: 'transparent' }, { pos: 100, color: null }] },
  { name: 'Transparent → Solid → Transparent (center glow)', stops: [{ pos: 0, color: 'transparent' }, { pos: 50, color: null }, { pos: 100, color: 'transparent' }] },
  { name: 'Solid → Transparent → Solid (center gap)', stops: [{ pos: 0, color: null }, { pos: 50, color: 'transparent' }, { pos: 100, color: null }] },
  { name: 'Solid → Transparent → Solid (mirror center)', stops: [{ pos: 0, color: null }, { pos: 35, color: 'transparent' }, { pos: 65, color: 'transparent' }, { pos: 100, color: null }] },
  { name: 'Transparent → Solid → Transparent (mirror center)', stops: [{ pos: 0, color: 'transparent' }, { pos: 35, color: null }, { pos: 65, color: null }, { pos: 100, color: 'transparent' }] },
  { name: 'Two-color (left → right)', stops: [{ pos: 0, color: '#2196F3' }, { pos: 100, color: '#e91e63' }] },
  { name: 'Two-color (mirror center)', stops: [{ pos: 0, color: '#2196F3' }, { pos: 50, color: '#e91e63' }, { pos: 100, color: '#2196F3' }] },
  { name: 'Rainbow', stops: [{ pos: 0, color: '#ff0000' }, { pos: 25, color: '#ffff00' }, { pos: 50, color: '#00ff00' }, { pos: 75, color: '#00ffff' }, { pos: 100, color: '#ff00ff' }] },
  { name: 'Rainbow (mirror center)', stops: [{ pos: 0, color: '#ff0000' }, { pos: 17, color: '#ffff00' }, { pos: 34, color: '#00ff00' }, { pos: 50, color: '#00ffff' }, { pos: 66, color: '#00ff00' }, { pos: 83, color: '#ffff00' }, { pos: 100, color: '#ff0000' }] },
];

// Builds a gradient-border as background-image LAYERS (the card_mod technique) so it respects
// border-radius and composes with box-shadow glow + the element's own background. Given a
// gradient-border spec { enabled, width, sides:{top,bottom,left,right}, stops:[{pos,color}] },
// returns { image, size, position, repeat } CSS strings for one background shorthand, or null.
// Top/bottom lines run left→right; left/right lines run top→bottom.
function gradientBorderBackground(g, matchColor) {
  if (!g || !g.enabled) return null;
  // A stop color of 'match' resolves to the border's own color (matchColor) — usually what you
  // want, so it's the default for new stops. Falls back to the accent if no matchColor given.
  const resolveMatch = matchColor || '#2196F3';
  const stops = (Array.isArray(g.stops) ? g.stops : [])
    .map(s => ({ pos: clamp(Number(s.pos) || 0, 0, 100), color: s.color === 'match' ? resolveMatch : String(s.color || 'transparent') }))
    .sort((a, b) => a.pos - b.pos);
  if (stops.length < 2) return null;
  const w = Number(g.width) || 2;
  const sides = g.sides || {};
  const horiz = `linear-gradient(to right, ${stops.map(s => `${s.color} ${s.pos}%`).join(', ')})`;
  const vert = `linear-gradient(to bottom, ${stops.map(s => `${s.color} ${s.pos}%`).join(', ')})`;
  const imgs = [], sizes = [], positions = [];
  const add = (on, img, size, pos) => { if (on) { imgs.push(img); sizes.push(size); positions.push(pos); } };
  add(sides.top, horiz, `100% ${w}px`, 'top');
  add(sides.bottom, horiz, `100% ${w}px`, 'bottom');
  add(sides.left, vert, `${w}px 100%`, 'left');
  add(sides.right, vert, `${w}px 100%`, 'right');
  if (!imgs.length) return null;
  return { image: imgs.join(', '), size: sizes.join(', '), position: positions.join(', '), repeat: imgs.map(() => 'no-repeat').join(', ') };
}

// A divider's gradient stops → a `linear-gradient(to right, …)` CSS string. Stops are
// {pos 0-100, color}; sorted by position. Falls back to the single divider color when there
// are fewer than 2 stops (a gradient needs at least two). Returns null if not gradient-usable.
function dividerGradientCss(section, fallbackColor, reverse) {
  // A stop color of 'theme' resolves to the theme divider color; 'transparent' stays transparent;
  // anything else is used verbatim (hex).
  const stops = (Array.isArray(section && section.stops) ? section.stops : [])
    .map(s => ({ pos: clamp(Number(s.pos) || 0, 0, 100), color: s.color === 'theme' ? 'var(--divider-color)' : String(s.color || 'transparent') }))
    .sort((a, b) => a.pos - b.pos);
  if (stops.length < 2) return null;
  // `reverse` mirrors the gradient horizontally (used for the right segment of a centered divider
  // so the two halves are symmetric around the text/icon instead of both fading the same way).
  const dir = reverse ? 'to left' : 'to right';
  return `linear-gradient(${dir}, ${stops.map(s => `${s.color} ${s.pos}%`).join(', ')})`;
}
// Shared divider renderer (used by both the card and the editor preview). Draws the line and,
// when a label and/or icon is set, places that content over the line at the chosen position:
//   - center: content centered with line segments on both sides
//   - left / right: content at that end, line filling the rest
// Text/icon size, color, and weight are configurable per-divider (fall back to sensible defaults).
function dividerLineHtml(section, cfg) {
  cfg = cfg || {};
  const color = section.color || cfg.divider_color || 'var(--divider-color)';
  const thickness = Number(section.thickness) || Number(cfg.divider_thickness) || 1;
  const length = clamp(Number(section.length) || Number(cfg.divider_length) || 100, 5, 100);
  const style = section.line_style || 'solid';
  const justify = section.justify || 'center';            // where the LINE sits
  const scale = Number(cfg.scale) || 1.0;
  const flexJustify = justify === 'left' ? 'flex-start' : justify === 'right' ? 'flex-end' : 'center';
  const grad = section.gradient ? dividerGradientCss(section, color) : null;
  let lineStyle;
  if (grad) {
    lineStyle = `height:${thickness}px;background:${grad};border-radius:${thickness}px;`;
  } else if (style === 'dashed' || style === 'dotted') {
    lineStyle = `height:0;border-top:${thickness}px ${style} ${color};`;
  } else {
    lineStyle = `height:${thickness}px;background:${color};border-radius:${thickness}px;`;
  }
  // Visibility toggles.
  const hideLine = section.hide_line === true;
  const hideText = section.hide_text === true;
  const hideIcon = section.hide_icon === true;
  const label = (!hideText && section.label != null) ? String(section.label) : '';
  const icon = (!hideIcon && section.icon) ? normalizeIcon(section.icon) : '';
  const pad = `padding:calc(8px * ${scale}) 0;`;
  const position = section.text_position || 'on';         // above | on | below
  const contentJustify = section.content_justify || justify;   // where text/icon sits
  const cFlex = contentJustify === 'left' ? 'flex-start' : contentJustify === 'right' ? 'flex-end' : 'center';
  const indent = clamp(Number(section.indent) || 0, 0, 200);
  const lineRow = hideLine ? '' : `<div style="display:flex;justify-content:${flexJustify};"><div style="width:${length}%;${lineStyle}"></div></div>`;
  // No content → just the (maybe hidden) line, original behavior.
  if (!label && !icon) {
    return `<div style="${pad}">${lineRow || '<div style="height:0;"></div>'}</div>`;
  }
  // Content styling. Color modes:
  //   text_color_mode: 'line' (the divider's line color) | 'theme' (theme text color) | 'fixed'
  //   icon_color_mode: 'text' (match resolved text color) | 'theme' | 'fixed'
  // Back-compat: no mode + a stored *_color hex → 'fixed'; else the sensible default.
  const tSize = Number(section.text_size) || 13;
  const tWeight = section.text_weight || '600';
  const tMode = section.text_color_mode || (section.text_color ? 'fixed' : 'line');
  // 'line' = match the line color. For a GRADIENT line there's no single color, so
  // pick the first real gradient stop (skip transparent/theme); if none, fall back
  // to the base line color. (Fixes "match line color" doing nothing on gradients.)
  let lineColor = color;
  if (tMode === 'line' && section.gradient && Array.isArray(section.stops)) {
    const realStop = section.stops.find(s => s && s.color && s.color !== 'transparent' && s.color !== 'theme');
    if (realStop) lineColor = realStop.color;
    else { const themeStop = section.stops.find(s => s && s.color === 'theme'); if (themeStop) lineColor = 'var(--divider-color)'; }
  }
  const tColor = tMode === 'fixed' ? (section.text_color || '#ffffff')
    : tMode === 'theme' ? 'var(--primary-text-color)'
    : lineColor;   // 'line'
  const iSize = Number(section.icon_size) || (tSize + 4);
  const iMode = section.icon_color_mode || (section.icon_color ? 'fixed' : 'text');
  const iColor = iMode === 'fixed' ? (section.icon_color || '#ffffff')
    : iMode === 'theme' ? 'var(--primary-text-color)'
    : tColor;   // 'text'
  const gap = 8;
  const contentHtml = `<span style="display:inline-flex;align-items:center;gap:calc(${gap}px * ${scale});flex-shrink:0;white-space:nowrap;">
    ${icon ? `<ha-icon icon="${escapeHtml(icon)}" style="--mdc-icon-size:calc(${iSize}px * ${scale});color:${iColor};"></ha-icon>` : ''}
    ${label ? `<span style="font-size:calc(${tSize}px * ${scale});font-weight:${tWeight};color:${tColor};">${escapeHtml(label)}</span>` : ''}
  </span>`;
  // Indent shifts the content away from its justified edge.
  const indentStyle = indent ? (contentJustify === 'right' ? `padding-right:${indent}px;` : contentJustify === 'center' ? '' : `padding-left:${indent}px;`) : '';
  const contentRow = `<div style="display:flex;justify-content:${cFlex};${indentStyle}">${contentHtml}</div>`;
  // "On the line": overlay content into the line (center = segments both sides; else at an end).
  if (position === 'on' && !hideLine) {
    const seg = `<div style="flex:1;${lineStyle}"></div>`;
    // For a centered gradient line, the RIGHT segment uses a horizontally-mirrored gradient so the
    // two halves fade symmetrically around the content (e.g. both ends solid, both inner ends
    // faded) instead of both running the same direction.
    let segRight = seg;
    if (grad && contentJustify === 'center' && section.mirror_center) {
      const gradR = dividerGradientCss(section, color, true);
      segRight = `<div style="flex:1;height:${thickness}px;background:${gradR};border-radius:${thickness}px;"></div>`;
    }
    const inner = contentJustify === 'left' ? `${contentHtml}${seg}`
      : contentJustify === 'right' ? `${seg}${contentHtml}`
      : `${seg}${contentHtml}${segRight}`;
    return `<div style="display:flex;justify-content:${flexJustify};${pad}">
      <div style="width:${length}%;display:flex;align-items:center;gap:calc(${gap}px * ${scale});${indent ? `padding:0 ${indent}px;` : ''}">${inner}</div>
    </div>`;
  }
  // Above / below (or "on" with the line hidden) → stack the content and the line.
  const stack = (position === 'above') ? `${contentRow}${lineRow}` : `${lineRow}${contentRow}`;
  return `<div style="display:flex;flex-direction:column;gap:calc(4px * ${scale});${pad}">${stack}</div>`;
}


// ============================================================================
// Main Card
// ============================================================================

class SEEDCard extends HTMLElement {
  static getStubConfig() {
    return {
      title: 'Entities',
      entity_filter_texts: [],
      entity_filter_types: ['text'],
      entity_filter_labels: [],
      entity_filter_groups: [],
      sections: [
        { id: uid(), name: 'Status', collapsible: true, entities: [], type: 'entities' },
        { id: uid(), name: 'Details', collapsible: true, entities: [], type: 'entities' },
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
      // Main card wrapper base background (blank = transparent). The card's
      // border / glow / shadow / edges come from its Card Frame preset stack.
      card_bg_color: '',
      // Card-level title bar styling (independent of per-section title styling)
      // Title text and icon can be independently shown/hidden.
      show_title: true,
      show_title_icon: true,
      title_icon: 'mdi:view-list',
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
      slider_max_width: 240,
      // (Global section dividers removed — use standalone Divider sections.)
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
      // Initial state the collapsible card renders in: 'expanded' (default) or
      // 'collapsed' (shows just the title bar until the user expands it).
      card_default_state: 'expanded',
      // Show relative "last changed" time next to the title
      show_last_changed: false,
      // Gray out icons for entities that are off/unavailable
      gray_icons_when_off: false,
      // Minimum time (seconds) between live in-place refreshes. HA pushes hass
      // very frequently; this throttles updateStates so a chatty sensor (e.g. a
      // lux value updating every second, resetting "last changed") can't force
      // the card to rebuild constantly. 0 = the default 250ms debounce.
      min_refresh_seconds: 0,
      // Named Frame Styles (sparse border+glow+shadow+background+edge bundles),
      // layered onto sections or the card. Empty by default. See STYLES_DESIGN.
      frame_presets: [],
      // Card wrapper frame: { presets: [] } | null.
      card_frame: null,
      // Which shared-library scope this card's `lib:` refs resolve against:
      // 'user' (per-user store, any user may write) or 'system' (shared across
      // all users, admin write). Backed by HA's built-in frontend key-value
      // store — no custom component needed. See SEED_FRAME_LIBRARY.
      // Shared Library store scope. Card editing in HA is admin-only, so we
      // always use the SHARED (system) store — visible to every user, one
      // library for the whole instance. (The per-user store exists in HA but
      // isn't exposed here; there's no non-admin author to need it.)
      frame_library_scope: 'system',
      // Entity Table Defaults - the presentation "house style" seeded into every
      // NEW Entity Table section (headers + row style). Content (columns, sort,
      // title, filter) is never defaulted. Existing sections are untouched
      // unless the user hits Reset. Seeded to match the Lights table look.
      table_defaults: {
        headers: { show: true, color: '#90EE90', font_size: 11 },
        row_style: {
          font_size: 14, padding_v: 4, padding_h: 6, indent: 16,
          text_color: '',
          divider: { show: false, color: '#333333', width: 1 },
          zebra: false, hover_highlight: true, name_link: true, strip_strings: []
        }
      }
    };
  }

  constructor() {
    super();
    this._config = null;
    this._hass = null;
    this._rendered = false;
    this._updateTimer = null;
    this._lastRefreshAt = 0;
  }

  disconnectedCallback() {
    if (this._updateTimer) { clearTimeout(this._updateTimer); this._updateTimer = null; }
  }

  setConfig(config) {
    if (!config) throw new Error('Invalid configuration');
    // Auto-migrate pre-v107 inline frame styling to the Frame Style model
    // (mutates a shallow copy so we don't touch the caller's object).
    config = migrateLegacyFrames({ ...config, sections: (config.sections || []).map(s => ({ ...s })) });
    const stub = SEEDCard.getStubConfig();
    const { rule_sets, sections } = Array.isArray(config.sections)
      ? buildRuleSetsAndSections(config)
      : { rule_sets: (config.rule_sets || []).map(normalizeRuleSetDef), sections: stub.sections };
    const merged = {
      ...stub,
      ...config,
      colors: { ...stub.colors, ...(config.colors || {}) },
      entity_filter_texts: normalizeEntityFilterTexts(config),
      entity_filter_labels: normalizeEntityFilterLabels(config),
      entity_filter_groups: normalizeEntityFilterGroups(config),
      table_defaults: normalizeTableDefaults(config.table_defaults),
      frame_presets: normalizeFramePresets(config.frame_presets),
      card_frame: config.card_frame ? normalizeFrameRef(config.card_frame) : null,
      frame_library_scope: 'system',
      header_library_scope: 'system',
      // Header Rule Sets applied to the CARD TITLE (blank entity = card's own
      // entity). Emitted only when non-empty (byte-stable).
      ...((Array.isArray(config.header_rule_refs) && config.header_rule_refs.length)
        ? { header_rule_refs: normalizeHeaderRuleRefs(config.header_rule_refs) } : {}),
      rule_sets,
      sections
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

    // Ensure the label registry is loaded (see ensureLabelRegistry). Without
    // this, label-based filter rules (e.g. exclude label "RGB Group") can't
    // resolve names on HA builds that don't expose hass.labels, so entities
    // that should be filtered out leak into the table. When the fetch lands,
    // re-render so the now-correct filter applies.
    ensureLabelRegistry(hass, () => {
      if (this._rendered) { try { this.renderCard(); } catch (e) {} }
    });

    // Load + live-subscribe the shared Frame Style library (see
    // SEED_FRAME_LIBRARY). Only needed when this card actually references a
    // library preset (lib:… ref); otherwise we skip the WS traffic entirely.
    if (this._usesLibraryRef && this._usesLibraryRef()) {
      ensureFrameLibrary(hass, this._config.frame_library_scope, () => {
        if (this._rendered) { try { this.renderCard(); } catch (e) {} }
      });
    }
    // Header Rule Sets: load the shared library when a lib: ref is applied
    // anywhere — the CARD TITLE (config.header_rule_refs) or any section
    // (section.header_rule_refs). Built-In needs no fetch (it's a constant).
    // Missing the card-title case here left title header rules unresolved (the
    // library was never fetched), so the title's on/off colors never applied.
    const _usesHdrLibRef = (refs) => Array.isArray(refs)
      && refs.some(r => r && typeof r.ref === 'string' && r.ref.startsWith('lib:'));
    if (_usesHdrLibRef(this._config.header_rule_refs)
        || (this._config.sections || []).some(s => _usesHdrLibRef(s.header_rule_refs))) {
      ensureHeaderLibrary(hass, this._config.header_library_scope, () => {
        if (this._rendered) { try { this.renderCard(); } catch (e) {} }
      });
    }

    // Only do a full DOM rebuild once. Every hass update after that just
    // patches values in place via updateStates() - a full rebuild here was
    // the cause of open sections collapsing / scroll resetting on every
    // state change (e.g. right after toggling a switch).
    if (!this._rendered) {
      this.renderCard();
      this._rendered = true;
      return;
    }

    // Throttle updates: HA pushes `hass` very frequently (any entity's state or
    // attribute change anywhere fires this). Coalesce bursts into one
    // updateStates() so tables don't rebuild/re-sort many times a second.
    // Default is a 250ms trailing debounce; a configured min_refresh_seconds
    // raises the floor (e.g. a chatty lux sensor whose "last changed" keeps
    // resetting can be capped to refresh at most once per N seconds).
    if (this._updateTimer) return; // an update is already scheduled
    const minMs = Math.max(0, Number(this._config.min_refresh_seconds) || 0) * 1000;
    const now = Date.now();
    const sinceLast = now - (this._lastRefreshAt || 0);
    // Wait the remaining throttle window if we refreshed recently; else the
    // usual 250ms debounce.
    const delay = minMs > 0 ? Math.max(250, minMs - sinceLast) : 250;
    this._updateTimer = setTimeout(() => {
      this._updateTimer = null;
      this._lastRefreshAt = Date.now();
      try { this.updateStates(); } catch (e) { debugLog('updateStates error', e); }
    }, delay);
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

  // The effective icon color for a section, used by the "follow section icon
  // color" border/glow/shadow options. Prefers the LIVE state-driven header
  // icon color (so the border tracks e.g. the elevation amber/yellow), else the
  // section's static icon_color, else the global icon color.
  _sectionIconColor(section) {
    if (section && section.type === 'activity_table' && section.title_row
        && section.title_row.header_icon && section.title_row.header_icon.enabled) {
      try {
        const count = this._activityCount(section, this._getActivityEntities(section));
        const hi = this._resolveHeaderIcon(section, section.title_row.header_icon, count);
        if (hi && hi.color) return hi.color;
      } catch (e) { /* fall through */ }
    }
    return (section && section.icon_color) || this.getColors().icon || '#2196F3';
  }

  _framePresetsById() {
    const map = {};
    // Legacy local presets (pre-System-only configs) still resolve so old
    // cards keep rendering; authoring is library-only going forward.
    (this._config.frame_presets || []).forEach(fx => { if (fx && fx.id) map[fx.id] = fx; });
    // Overlay the shared System library so `lib:<slug>` refs resolve.
    const lib = frameLibraryMap(this._config.frame_library_scope);
    Object.keys(lib).forEach(slug => { const id = 'lib:' + slug; if (!map[id]) map[id] = lib[slug]; });
    // The read-only Built-In is always available as a fallback frame.
    if (!map[BUILTIN_FRAME_ID]) map[BUILTIN_FRAME_ID] = builtinFramePreset();
    return map;
  }

  // True if any section/card frame ref points at a library preset (lib:…), so
  // the renderer knows whether it needs to fetch/subscribe the library at all.
  _usesLibraryRef() {
    const refUsesLib = fr => {
      if (!fr) return false;
      return Array.isArray(fr.presets) && fr.presets.some(id => typeof id === 'string' && id.startsWith('lib:'));
    };
    if (refUsesLib(this._config.card_frame)) return true;
    return (this._config.sections || []).some(s => refUsesLib(s.frame));
  }

  // True if a preset's `when` condition is satisfied (or it has none). A
  // conditional preset whose entity/state doesn't match is skipped in layering.
  _framePresetActive(fx) {
    if (!fx) return false;
    // Section-membership condition: active when the target section has (or
    // lacks) visible entities. No entity state involved.
    if (fx.when_kind === 'section_has_entities' || fx.when_kind === 'section_empty') {
      const section = (this._config.sections || []).find(s => s.id === fx.when_section);
      if (!section) return false;
      const hasVisible = this._visibleCount(section) > 0;
      return fx.when_kind === 'section_has_entities' ? hasVisible : !hasVisible;
    }
    if (!fx.when) return true;
    const ctxId = fx.when_entity || '';
    if (!ctxId || !this._hass || !this._hass.states[ctxId]) return false;
    return evalCondition(ctxId, fx.when, this._hass);
  }

  // Resolve a section/card FRAME reference (ordered presets) into composed
  // CSS. Layers sparse presets in order
  // (last-writer-wins per group), skipping conditional presets that aren't
  // active. Returns null when nothing applies (caller renders no frame), else:
  //   { boxShadow, borderVars|null, edge|null, background|null }
  // `section` provides the icon color for border.follow_icon.
  // Flatten a frame ref's ACTIVE layer stack into a single sparse bundle of
  // frame groups (glow/shadow/border/background/edges) using the same
  // last-writer-wins layering as _resolveFrame. Returns { <group>: {...} } or
  // null when nothing applies. This is the "current live look" — used both by
  // _resolveFrame (to render) and by "Capture as Preset" (to freeze it).
  _flattenFrameToBundle(frameRef) {
    frameRef = frameRef || {};
    const byId = this._framePresetsById();
    const disabled = new Set(frameRef.disabled || []);
    // Layers whose own condition is ignored HERE — they always apply on this
    // section/card regardless of their when/when_entity.
    const ignoreCond = new Set(frameRef.ignore_conditions || []);
    const layerIds = (frameRef.presets || []).filter(id => !disabled.has(id));
    if (!layerIds.length) return null;
    const acc = {};
    let any = false;
    layerIds.forEach(id => {
      const fx = byId[id];
      if (!fx) return;
      // Skip conditional presets that aren't active — UNLESS this application
      // opted to ignore the condition (then the layer always applies).
      if (!ignoreCond.has(id) && !this._framePresetActive(fx)) return;
      ['glow', 'shadow', 'border', 'background', 'edges'].forEach(g => {
        if (fx[g]) { acc[g] = JSON.parse(JSON.stringify(fx[g])); any = true; }
      });
    });
    return any ? acc : null;
  }

  _resolveFrame(frameRef, section) {
    frameRef = frameRef || {};
    // Accumulate sparse groups (last writer wins) across the active layers.
    const acc = this._flattenFrameToBundle(frameRef);
    if (!acc) return null;

    const out = { boxShadow: 'none', borderVars: null, edge: null, background: null };
    const iconCol = this._sectionIconColor(section);
    const parts = [];
    if (acc.glow) {
      // For borders_only glow, glow only on the sides the border group enables
      // (so a bottom-only border yields a bottom-only glow, not a full halo).
      const bsides = (acc.border && Array.isArray(acc.border.sides)) ? acc.border.sides : ['top', 'bottom', 'left', 'right'];
      const sides = acc.glow.borders_only
        ? { top: bsides.includes('top'), bottom: bsides.includes('bottom'), left: bsides.includes('left'), right: bsides.includes('right') }
        : { top: true, bottom: true, left: true, right: true };
      const gcolor = acc.glow.follow_icon ? iconCol : acc.glow.color;
      parts.push(this._buildGlowShadow(gcolor, sides, acc.glow.borders_only, acc.glow.intensity));
    }
    if (acc.shadow) {
      const scolor = acc.shadow.follow_icon ? iconCol : acc.shadow.color;
      parts.push(this._buildDropShadow(scolor, acc.shadow.x, acc.shadow.y, acc.shadow.blur, acc.shadow.spread, acc.shadow.opacity));
    }
    out.boxShadow = parts.filter(s => s && s !== 'none').join(', ') || 'none';
    if (acc.border) {
      const bc = acc.border.follow_icon ? this._sectionIconColor(section) : acc.border.color;
      const bw = acc.border.width, br = acc.border.radius;
      const on = side => acc.border.sides.includes(side);
      // Per-corner radius [TL, TR, BR, BL]: a false corner is square (0).
      const cn = Array.isArray(acc.border.corners) && acc.border.corners.length === 4 ? acc.border.corners : [true, true, true, true];
      const rad = `${cn[0] ? br : 0}px ${cn[1] ? br : 0}px ${cn[2] ? br : 0}px ${cn[3] ? br : 0}px`;
      out.borderVars = {
        top: on('top') ? `${bw}px solid ${bc}` : 'none',
        bottom: on('bottom') ? `${bw}px solid ${bc}` : 'none',
        left: on('left') ? `${bw}px solid ${bc}` : 'none',
        right: on('right') ? `${bw}px solid ${bc}` : 'none',
        radius: rad
      };
    }
    if (acc.background) {
      const mode = acc.background.mode || 'custom';
      // 'theme' => the sentinel 'theme' so consumers UNSET the background (the
      // HA card / theme shows through). 'transparent' => explicit transparent.
      // 'custom' => the chosen color. (out.background stays null when no
      // background group is present at all — a different case from 'theme'.)
      out.background = mode === 'theme' ? 'theme'
        : mode === 'transparent' ? 'transparent'
        : (acc.background.color || 'transparent');
    }
<<<<<<< HEAD
    // 'match' edge stops resolve to the frame's border color if it has one,
    // else the section/icon color — so a gradient border follows the accent.
    const edgeMatch = (acc.border && !acc.border.follow_icon && acc.border.color) ? acc.border.color : iconCol;
    if (acc.edges) out.edge = buildEdgeBackground(acc.edges, edgeMatch);
=======
    if (acc.edges) out.edge = buildEdgeBackground(acc.edges);
>>>>>>> d65989548fdbf203a804606d75440bca7a95012c
    return out;
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

  // Recompute each section's frame (glow / shadow / border / bg / edges) from
  // its Frame Style stack. Called after render, on section toggle, and on
  // state changes (so conditional presets update live).
  updateGlow() {
    if (!this._config) return;

    (this._config.sections || []).forEach(section => {
      const el = this.querySelector(`.seed-section[data-section-id="${section.id}"]`);
      if (!el) return;

      // A section's frame is a layered stack of Frame Styles — the ONLY source
      // of its glow/shadow/border/edges/background. When it resolves it drives
      // all of them (Replace). A stack that resolves to nothing (empty, or all
      // conditional presets inactive) leaves the section with no frame at all.
      const fx = this._resolveFrame(section.frame, section);
      if (fx) {
        el.style.overflow = 'visible';
        el.style.boxShadow = fx.boxShadow;
        const bv = fx.borderVars;
        el.style.setProperty('--sec-border-top', bv ? bv.top : 'none');
        el.style.setProperty('--sec-border-bottom', bv ? bv.bottom : 'none');
        el.style.setProperty('--sec-border-left', bv ? bv.left : 'none');
        el.style.setProperty('--sec-border-right', bv ? bv.right : 'none');
        el.style.setProperty('--sec-border-radius', bv ? bv.radius : '0');
        el.style.backgroundColor = fx.background === 'theme' ? '' : (fx.background != null ? fx.background : 'transparent');
        if (fx.edge) {
          el.style.backgroundImage = fx.edge.image;
          el.style.backgroundSize = fx.edge.size;
          el.style.backgroundPosition = fx.edge.position;
          el.style.backgroundRepeat = fx.edge.repeat;
        } else {
          el.style.backgroundImage = '';
        }
      } else {
        el.style.boxShadow = 'none';
        el.style.backgroundImage = '';
        el.style.setProperty('--sec-border-top', 'none');
        el.style.setProperty('--sec-border-bottom', 'none');
        el.style.setProperty('--sec-border-left', 'none');
        el.style.setProperty('--sec-border-right', 'none');
        el.style.setProperty('--sec-border-radius', '0');
      }
    });
  }

  // Glow for the whole-card collapsible wrapper. Mirrors updateGlow() but
  // supports an entity-driven condition since there's only one wrapper.
  updateCardGlow() {
    if (!this._config) return;
    const wrapper = this.querySelector('.easy-entity-styler-card-wrapper');
    if (!wrapper) return;

    // The card wrapper's frame comes ENTIRELY from its Card Frame preset stack
    // (border / glow / shadow / edges / background). When it resolves, it drives
    // them absolutely; when it resolves to nothing (no card_frame, or all
    // conditional presets inactive), the wrapper has no frame at all.
    const fx = this._config.card_frame ? this._resolveFrame(this._config.card_frame, null) : null;
    if (fx) {
      wrapper.style.boxShadow = fx.boxShadow;
      const bv = fx.borderVars;
      wrapper.style.borderTop = bv ? bv.top : 'none';
      wrapper.style.borderBottom = bv ? bv.bottom : 'none';
      wrapper.style.borderLeft = bv ? bv.left : 'none';
      wrapper.style.borderRight = bv ? bv.right : 'none';
      wrapper.style.borderRadius = bv ? bv.radius : '';
      wrapper.style.backgroundColor = (fx.background != null && fx.background !== 'theme') ? fx.background : '';
      if (fx.edge) {
        wrapper.style.backgroundImage = fx.edge.image;
        wrapper.style.backgroundSize = fx.edge.size;
        wrapper.style.backgroundPosition = fx.edge.position;
        wrapper.style.backgroundRepeat = fx.edge.repeat;
      } else { wrapper.style.backgroundImage = ''; }
    } else {
      wrapper.style.boxShadow = 'none';
      wrapper.style.backgroundImage = '';
      wrapper.style.borderTop = 'none';
      wrapper.style.borderBottom = 'none';
      wrapper.style.borderLeft = 'none';
      wrapper.style.borderRight = 'none';
    }
  }

  // Whether an entity should currently be visible within a section, applying
  // (in order) the per-state chip-hide flags and the section's Entity Display
  // Rules. Used both at render time and live in updateStates(), so entities
  // can appear/disappear as their state changes without a rebuild.
  _isEntityVisible(entityId, section) {
    const st = this._hass && this._hass.states ? this._hass.states[entityId] : null;
    if (!st) return false;
    const isChipRendered = !!section.chips_only;
    if (isChipRendered) {
      if (section.chip_hide_off && st.state === 'off') return false;
      if (section.chip_hide_unknown && st.state === 'unknown') return false;
      if (section.chip_hide_unavailable && st.state === 'unavailable') return false;
    }
    if (!entityPassesRules(entityId, section.entity_rules, this._hass)) return false;
    return true;
  }

  // Count of currently-visible entities in a section (respects rules).
  _visibleCount(section) {
    return (section.entities || []).filter(id => this._isEntityVisible(id, section)).length;
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


    // Whole-card wrapper. The card's border/glow/shadow come entirely from its
    // Card Frame preset stack (applied inline in updateCardGlow); the CSS here
    // just sets a neutral base — no border, a default corner radius for shape.
    const cardCollapsible = this._config.card_collapsible === true;
    const cardBorderCss = 'border: none;';
    const cardRadiusCss = 'border-radius: 12px;';

    // Divider line drawn between consecutive sections (independent of the
    // section's own border box - this sits between two sections, not
    // around one). Top and bottom are independent so you can enable either,
    // both (giving a double-line gap), or neither.
    // (Global section-divider CSS removed — dividers are standalone sections.)
    const sectionDividerCss = '';

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
          /* Border/bg come entirely from the section's Frame Styles, applied
             inline per section in renderCard (var fallbacks are just 'off'). */
          border-top: var(--sec-border-top, none);
          border-bottom: var(--sec-border-bottom, none);
          border-left: var(--sec-border-left, none);
          border-right: var(--sec-border-right, none);
          border-radius: var(--sec-border-radius, 0);
          box-shadow: none;
          background-color: var(--sec-bg, transparent);
          overflow: hidden;
        }
        details.seed-section { background-color: var(--sec-bg, transparent) !important; }
        /* Divider sections carry no frame box — just the divider line. */
        .seed-divider-section { border: none !important; box-shadow: none !important; background: transparent !important; overflow: visible; padding: 0; }
        .seed-summary {
          list-style: none;
          cursor: pointer;
          user-select: none;
          display: flex;
          align-items: center;
          gap: var(--seed-gap);
          padding: var(--seed-pad) calc(var(--seed-pad) * 1.5);
          padding-left: calc(var(--seed-pad) * 1.5 + var(--sec-title-indent, 0px));
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
        /* Activity-table title icon: fixed on the left, never rotates. */
        .seed-at-title-icon {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          color: var(--sec-icon-color, ${colors.icon});
          --mdc-icon-size: var(--sec-icon-size, var(--seed-icon-size));
        }
        /* Per-part title layout: 3 zones (left / center / right) filling the
           header width. Each part sits in the zone matching its align. */
        .seed-at-title-grid {
          flex: 1;
          min-width: 0;
          display: grid;
          /* Left/right zones size to their content; the empty middle absorbs
             the slack. This keeps left-aligned parts (icon+title+count) on one
             line instead of being squeezed into a fixed 1/3 column (which
             truncated the title and wrapped a multi-word count like
             "All Secure"). Center-aligned parts justify within the middle. */
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 8px;
        }
        .seed-at-title-zone { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .seed-at-tp { display: inline-flex; align-items: center; white-space: nowrap; }
        .seed-at-tp-icon { color: var(--sec-icon-color, ${colors.icon}); --mdc-icon-size: var(--sec-icon-size, var(--seed-icon-size)); }
        .seed-at-tp-title { color: var(--sec-title-color, ${colors.text}); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .seed-at-tp-count { color: var(--sec-title-color, ${colors.text}); white-space: nowrap; }
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
        /* Styled per-section count (count_mode 'right' or 'title') honors the
           section's own color / size / weight / style vars. */
        .seed-section-count-styled {
          font-size: var(--sec-count-size, calc(13px * var(--seed-scale)));
          color: var(--sec-count-color, ${colors.secondary_text});
          font-weight: var(--sec-count-weight, 400);
          font-style: var(--sec-count-style, normal);
        }
        .seed-section-count-inline {
          font-size: var(--sec-count-size, calc(13px * var(--seed-scale)));
          color: var(--sec-count-color, ${colors.secondary_text});
          font-weight: var(--sec-count-weight, 400);
          font-style: var(--sec-count-style, normal);
          white-space: pre;
        }
        .seed-children {
          display: flex;
          flex-direction: column;
          padding: 0 calc(var(--seed-pad) * 1.5) var(--seed-pad) calc(var(--seed-pad) * 1.5 + var(--sec-row-indent, ${rowIndent}px));
          gap: 2px;
        }
        /* Activity tables control their own left offset (row_style.indent), so
           remove the base left padding to allow a true flush-left table. */
        .seed-children-at { padding-left: 0; padding-right: 0; }
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
        /* Name + secondary-info stacked column. When present it takes the name's
           flex role so the value stays right-aligned. */
        .seed-row-namecol {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .seed-row-namecol .seed-row-name { flex: none; }
        .seed-row-secondary {
          font-size: 12px;
          color: ${colors.secondary_text};
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          line-height: 1.2;
        }
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
        /* ---- Activity table ---- */
        .seed-at-table {
          width: 100%;
          box-sizing: border-box;
          min-width: 0;
          padding: 0;
        }
        .seed-at-row {
          display: grid;
          grid-template-columns: var(--seed-at-grid, 1fr);
          align-items: center;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }
        .seed-at-header { opacity: 0.9; }
        .seed-at-cell {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        /* Name column with a secondary sub-line: stack them vertically. */
        .seed-at-namecol { display: flex; flex-direction: column; min-width: 0; }
        .seed-at-secondary {
          color: ${colors.secondary_text};
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          line-height: 1.2;
        }
        .seed-at-zebra:nth-child(even) { background: rgba(255,255,255,0.03); }
        .seed-at-hover:hover { background: rgba(255,255,255,0.06); }
        .seed-at-link { cursor: pointer; }
        .seed-at-cell ha-icon { vertical-align: middle; }
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
      // Header Rule Sets applied to the card title override icon/glyph/text
      // color+size and can add a secondary line.
      const cts = this._resolveCardTitleStyle();
      const titleIconGlyph = cts.glyph || this._config.title_icon || 'mdi:view-list';
      const titleIconStyle = [
        cts.iconColor ? `color:${cts.iconColor};` : '',
        cts.iconSize ? `--mdc-icon-size:${Number(cts.iconSize)}px;` : '',
      ].join('');
      const titleTextStyle = [
        cts.textColor ? `color:${cts.textColor};` : '',
        cts.textSize ? `font-size:${Number(cts.textSize)}px;` : '',
      ].join('');
      titleHtml = `
        <div class="seed-title">
          ${showTitleIcon ? `<ha-icon icon="${titleIconGlyph}"${titleIconStyle ? ` style="${titleIconStyle}"` : ''}></ha-icon>` : ''}
          ${showTitleText ? `<span class="seed-title-text"${titleTextStyle ? ` style="${titleTextStyle}"` : ''}>${this._config.title}</span>` : ''}
          ${lastChangedText ? `<span class="seed-title-last-changed">${lastChangedText}</span>` : ''}
          ${cts.secondaryText ? `<span class="seed-title-secondary">${escapeHtml(String(cts.secondaryText))}</span>` : ''}
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
      // Hidden sections are kept in config (and in the editor list) but not rendered.
      if (section.hidden === true) continue;
      // Standalone Divider section: just the divider line, no frame/title/body.
      if (section.type === 'divider') {
        sectionsHtml += `<div class="seed-section seed-divider-section" data-section-id="${section.id}">${dividerLineHtml(section, { scale: this._config.scale || 1.0, divider_color: (this.getColors().section_divider) })}</div>`;
        continue;
      }

      let contentHtml = '';
      let count = 0;

      if (section.type === 'activity_table') {
        const at = this._renderActivityTable(section);
        contentHtml = at.contentHtml;
        count = at.count;
      } else {
        // Render every configured entity that has a state, then hide the ones
        // that currently fail visibility (per-state chip-hide flags + Entity
        // Display Rules). Keeping hidden rows in the DOM lets updateStates() reveal
        // them again when their state changes, without a full rebuild.
        const presentEntities = (section.entities || []).filter(id => !!this._hass.states[id]);
        const visibleEntities = presentEntities.filter(id => this._isEntityVisible(id, section));
        count = visibleEntities.length;
        contentHtml = presentEntities.length
          ? presentEntities.map(id => {
              const hidden = !this._isEntityVisible(id, section);
              return this.createRowHTML(id, section, hidden);
            }).join('') + `<div class="seed-empty seed-empty-none"${visibleEntities.length ? ' style="display:none;"' : ''}>No entities available</div>`
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

      // (Inline per-section divider overrides removed — use Divider sections.)

      let sectionBorderOverride = overrideVars.length ? overrideVars.join('; ') + ';' : '';

      // Frame preset stack — the ONLY source of this section's border / edge
      // lines / background (glow + shadow are applied live in updateGlow). When
      // it resolves, those groups are set absolutely; when it resolves to
      // nothing, everything is forced off (no inheriting a global default).
      const fx = this._resolveFrame(section.frame, section);
      if (fx) {
        sectionBorderOverride += 'overflow:visible;';
        const bv = fx.borderVars;
        sectionBorderOverride += `--sec-border-top:${bv ? bv.top : 'none'};--sec-border-bottom:${bv ? bv.bottom : 'none'};--sec-border-left:${bv ? bv.left : 'none'};--sec-border-right:${bv ? bv.right : 'none'};--sec-border-radius:${bv ? bv.radius : '0'};`;
        sectionBorderOverride += `--sec-bg:${fx.background === 'theme' ? 'inherit' : (fx.background != null ? fx.background : 'transparent')};`;
        if (fx.edge) {
          sectionBorderOverride += `background-image:${fx.edge.image};background-size:${fx.edge.size};background-position:${fx.edge.position};background-repeat:${fx.edge.repeat};`;
        }
      } else {
        sectionBorderOverride += '--sec-border-top:none;--sec-border-bottom:none;--sec-border-left:none;--sec-border-right:none;--sec-border-radius:0;--sec-bg:transparent;';
      }

      const sectionVars = [
        `--sec-icon-color: ${section.icon_color || colors.icon}`,
        `--sec-icon-size: calc(${section.icon_size}px * var(--seed-scale) * var(--seed-title-icon-scale))`,
        `--sec-title-color: ${section.title_color || colors.text}`,
        `--sec-title-size: calc(${section.title_font_size}px * var(--seed-scale) * var(--seed-title-text-scale))`,
        `--sec-title-weight: ${section.title_font_weight || 600}`,
        `--sec-title-style: ${section.title_font_style || 'normal'}`,
        `--sec-title-indent: ${section.title_indent ?? 0}px`,
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
      // Activity tables manage their own left offset via row_style.indent, so
      // drop the .seed-children base row-indent padding (which otherwise sets a
      // floor you can't go below - i.e. can't sit flush-left).
      const atBodyClass = section.type === 'activity_table' ? ' seed-children-at' : '';
      const bodyHtml = `<div class="seed-children${chipLayoutClass}${atBodyClass}">${contentHtml}</div>`;

      // Per-section entity count. The old global "show entity count" toggle
      // (showSectionCount) still drives the plain right-side count; the new
      // per-section count_mode, when set, overrides it: 'title' places the
      // count right after the name ("Alert Bypasses - 2"), 'right' places a
      // styled count on the far right in place of the plain one.
      const countMode = section.count_mode || 'off';
      const countStyleVars =
        `--sec-count-color: ${section.count_color || colors.secondary_text}; ` +
        `--sec-count-size: calc(${section.count_font_size ?? 13}px * var(--seed-scale)); ` +
        `--sec-count-weight: ${section.count_font_weight || 400}; ` +
        `--sec-count-style: ${section.count_font_style || 'normal'};`;
      const titleCountHtml = countMode === 'title'
        ? `<span class="seed-section-count-inline" data-section-id="${section.id}" style="${countStyleVars}">${section.count_prefix ?? ' - '}${count}</span>`
        : '';
      let rightCountHtml = '';
      if (countMode === 'right') {
        rightCountHtml = `<div class="seed-section-count seed-section-count-styled" data-section-id="${section.id}" style="${countStyleVars}">${count}</div>`;
      } else if (countMode === 'off' && showSectionCount) {
        rightCountHtml = `<div class="seed-section-count" data-section-id="${section.id}">${count}</div>`;
      }

      let headerHtml;
      if (section.type === 'activity_table') {
        // Activity-table header. STYLING (icon glyph, icon color/size, title
        // font/color/weight/italic, indent) all come from the section header
        // fields - i.e. the "Section header style" editor block - so those
        // controls actually drive the table header. `title_row` supplies only
        // the behavioral bits: the {count} text template, the count condition,
        // and an OPTIONAL count-driven icon-color rule (advanced override).
        const tr = section.title_row || {};
        let tIcon = section.icon || tr.icon || sectionIcon;
        // Icon color: the icon part's own color-rule set wins (migrated from the
        // legacy top-level icon_color); else the icon part's static color; else
        // the section icon color. Count-driven rules test the count value.
        const iconRule = (tr.parts && tr.parts.icon && tr.parts.icon.color_rules) || tr.icon_color;
        const ruleColor = iconRule ? this._evalCountRuleSet(iconRule, count) : '';
        let iconColor = ruleColor || (tr.parts && tr.parts.icon && tr.parts.icon.color) || section.icon_color || '';
        // State-driven header icon overrides glyph and/or color when configured.
        if (tr.header_icon && tr.header_icon.enabled) {
          const hi = this._resolveHeaderIcon(section, tr.header_icon, count);
          if (hi.glyph) tIcon = hi.glyph;
          if (hi.color) iconColor = hi.color;
        }
        // Header Rule Sets (library) override glyph/icon-color last.
        const hrs = this._resolveHeaderStyle(section);
        if (hrs.glyph) tIcon = hrs.glyph;
        if (hrs.iconColor) iconColor = hrs.iconColor;
        headerHtml = this._activityTitleHeaderHtml(section, count, tIcon, iconColor, hrs);
      } else {
        // Header Rule Sets can override the entities-section header's icon,
        // icon color, title color/size, and add a secondary line.
        const hrs = this._resolveHeaderStyle(section);
        const nameStyle = [
          hrs.textColor ? `color:${hrs.textColor};` : '',
          hrs.textSize ? `font-size:calc(${Number(hrs.textSize)}px * var(--seed-scale,1));` : '',
        ].join('');
        const iconGlyph = hrs.glyph || sectionIcon;
        const iconStyle = [
          hrs.iconColor ? `color:${hrs.iconColor};` : '',
          hrs.iconSize ? `--mdc-icon-size:calc(${Number(hrs.iconSize)}px * var(--seed-scale,1));` : '',
        ].join('');
        const secondaryHtml = hrs.secondaryText
          ? `<div class="seed-section-secondary">${escapeHtml(String(hrs.secondaryText))}</div>` : '';
        headerHtml = `
          <div class="seed-section-name"${nameStyle ? ` style="${nameStyle}"` : ''}>${section.name}${titleCountHtml}${secondaryHtml}</div>
          ${rightCountHtml}
          <div class="seed-section-icon"${iconStyle ? ` style="${iconStyle}"` : ''}><ha-icon icon="${iconGlyph}"></ha-icon></div>
        `;
      }

      // Section Display Condition: hide the whole section (header included)
      // when the rules leave it empty. Rendered hidden (not omitted) so
      // updateStates() can reveal it again when an entity's state changes.
      const hideEmpty = section.section_display === 'hide_when_empty' ||
        (section.type === 'activity_table' && section.hide_when_empty === true);
      const sectionHidden = hideEmpty && count === 0;
      const sectionHiddenStyle = sectionHidden ? ' display:none;' : '';

      if (!sectionShowTitle) {
        // Title row removed entirely - just render the section body, always expanded.
        sectionsHtml += `
          <div class="seed-section non-collapsible" data-section-id="${section.id}" style="${sectionStyle}${sectionHiddenStyle}">
            ${bodyHtml}
          </div>
        `;
      } else if (collapsible) {
        // Initial state: 'expanded' renders open; 'collapsed' (default) closed.
        // Keep-expanded still forces open at render when it has visible entities
        // (re-asserted live in updateStates).
        const forceOpen = section.default_state === 'expanded' ||
          (section.keep_expanded_when_entities && count > 0);
        sectionsHtml += `
          <details class="seed-section ${autoClose ? 'seed-autoclose' : ''}" data-section-id="${section.id}" style="${sectionStyle}${sectionHiddenStyle}"${forceOpen ? ' open' : ''}>
            <summary class="seed-summary">${headerHtml}</summary>
            ${bodyHtml}
          </details>
        `;
      } else {
        sectionsHtml += `
          <div class="seed-section non-collapsible" data-section-id="${section.id}" style="${sectionStyle}${sectionHiddenStyle}">
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
      // Initial state: 'collapsed' renders the card as just its title bar until
      // the user expands it; anything else (default 'expanded') starts open.
      const cardStartOpen = this._config.card_default_state !== 'collapsed';
      // When both the title text and icon are hidden there's no title bar, so
      // fall back to an empty spacer that keeps the summary clickable and
      // pushes the chevron to the right.
      const summaryTitleHtml = titleHtml || '<div class="seed-title"><span class="seed-title-text"></span></div>';
      html += `
        <details class="easy-entity-styler-card-wrapper"${cardStartOpen ? ' open' : ''}>
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
    const cleanName = stripEntityName(rawName, this._stripFor(section));
    const value = state.state && state.state !== 'unknown' && state.state !== 'unavailable' ? state.state : '—';
    // chip_hide_state drops the state/value, leaving just the name (if shown)
    // and icon. The data-hide-state flag lets updateStates() skip refreshing.
    const hideState = section.chip_hide_state === true;
    let text;
    if (hideState) {
      text = section.chip_show_name ? cleanName : '';
    } else {
      text = section.chip_show_name ? `${cleanName}: ${value}` : value;
    }

    let iconHtml = '';
    if (section.chip_show_icon !== false) {
      const source = section.chip_icon_source || 'entity';
      let chipIcon = '';
      if (source === 'section') {
        chipIcon = section.icon || 'mdi:folder-outline';
      } else if (source === 'none') {
        chipIcon = '';
      } else {
        // 'entity' (default) - use the entity's own icon, then a domain fallback
        chipIcon = state.attributes.icon || DOMAIN_ICONS[domain] || 'mdi:help-circle-outline';
      }
      if (chipIcon) iconHtml = `<ha-icon icon="${chipIcon}"></ha-icon>`;
    }

    const sidAttr = section && section.id ? ` data-section-id="${section.id}"` : '';
    return `<span class="seed-chip" data-entity-id="${entityId}"${sidAttr}${hideState ? ' data-hide-state="1"' : ''}>${iconHtml}<span class="seed-chip-text">${text}</span></span>`;
  }

  // ==========================================================================
  // ACTIVITY TABLE rendering
  // ==========================================================================

  // Resolve a section's declarative filter (+ window_minutes gate) to the
  // sorted list of entity ids to display. No hard-coded entity list.
  // Effective strip list for a section: card-global list PLUS the section's own
  // (additive). Used everywhere a friendly name is displayed.
  _stripFor(section) {
    const g = (this._config && this._config.strip_entity_strings) || [];
    const s = (section && section.strip_strings) || [];
    return g.concat(s);
  }

  // Map of card rule sets by id, for section membership resolution.
  _ruleSetsById() {
    const out = {};
    (this._config && this._config.rule_sets || []).forEach(rs => { if (rs && rs.id) out[rs.id] = rs; });
    return out;
  }

  _getActivityEntities(section) {
    if (!this._hass) return [];
    // Attribute-array tables have no entity rows; return [] so title tokens
    // that count entities fall back to the passed-in count.
    if (section.row_source && section.row_source.type === 'attribute_array') return [];
    const hass = this._hass;
    const windowSec = (Number(section.window_minutes) || 0) * 60;

    // Membership: rule-set refs (union of static + dynamic) when present, else
    // the legacy inline filter (kept working until migration rewrites it).
    let ids;
    if (Array.isArray(section.rule_sets) && section.rule_sets.length) {
      ids = resolveSectionEntityIds(section, this._ruleSetsById(), hass);
    } else {
      ids = Object.keys(hass.states).filter(id => evalFilter(id, section.filter, hass));
    }

    // window_minutes + active_when (mirrors the template "recent" tables):
    // a row shows if it is ACTIVE now, OR it changed within the window. When
    // window_minutes is 0, show every filter-matched entity (no recency gate).
    // active_when is the section's definition of "active" (e.g. state is_on,
    // or current_position > 0); when absent it falls back to is_on/open-ish.
    if (windowSec > 0) {
      const activeCond = section.active_when || { op: 'truthy' };
      ids = ids.filter(id => {
        const st = hass.states[id];
        if (!st) return false;
        if (evalCondition(id, activeCond, hass)) return true;
        const agoSec = st.last_changed
          ? Math.max(0, Math.floor((Date.now() - new Date(st.last_changed).getTime()) / 1000))
          : Infinity;
        return agoSec <= windowSec;
      });
    }

    const sort = section.sort || {};
    const pin = sort.pin_top || [];
    const weightOf = id => {
      const idx = pin.indexOf(id);
      if (idx !== -1) return -1000000 + idx; // pinned entities first, in listed order
      const w = evalRuleSet(id, { rules: (sort.rules || []).map(r => ({ when: r.when, result: r.weight })), default: sort.default_weight }, hass);
      return typeof w === 'number' ? w : (sort.default_weight ?? 100);
    };
    const tieRef = (sort.then_by && sort.then_by.ref) || { source: 'last_changed_ago' };
    const tieDir = (sort.then_by && sort.then_by.dir) === 'desc' ? -1 : 1;
    // STABLE tiebreak: for time-since-change, sort on the FIXED last_changed
    // timestamp rather than the recomputed "seconds ago" (which ticks every
    // second and made rows swap order continuously). Using -timestamp keeps the
    // same visual ordering as ago-seconds (larger timestamp = smaller ago =
    // more recent) while being invariant to the current clock.
    const isAgo = tieRef.source === 'last_changed_ago';
    const tieOf = id => {
      if (isAgo) {
        const st = hass.states[id];
        return st && st.last_changed ? -new Date(st.last_changed).getTime() : 0;
      }
      const r = resolveValueRef(id, tieRef, hass);
      return r.num != null ? r.num : (r.seconds != null ? r.seconds : 0);
    };

    return ids.sort((a, b) => {
      const wa = weightOf(a), wb = weightOf(b);
      if (wa !== wb) return wa - wb;
      const ta = tieOf(a), tb = tieOf(b);
      if (ta !== tb) return (ta - tb) * tieDir;
      return a.localeCompare(b);
    });
  }

  // Count for the title row: rows (all shown) or entities matching a Condition.
  _activityCount(section, ids) {
    const tr = section.title_row || {};
    const cnt = tr.count || {};
    if (cnt.mode === 'rows') return ids.length;
    return ids.filter(id => evalCondition(id, cnt.when, this._hass)).length;
  }

  // Build one activity-table row (a CSS-grid <div> of cells).
  _activityRowHTML(entityId, section) {
    const hass = this._hass;
    const st = hass.states[entityId];
    if (!st) return '';
    const rs = section.row_style || {};
    const cols = section.columns || [];
    const rawName = st.attributes.friendly_name || entityId;
    // Strip list is additive: card-global + section + row_style (table-specific).
    const dispName = stripEntityName(rawName, this._stripFor(section).concat(rs.strip_strings || []));

    const cells = cols.map(col => {
      const align = col.align || (col.kind === 'name' ? 'left' : col.kind === 'icon' ? 'center' : 'right');
      const colorResult = col.color ? evalRuleSet(entityId, col.color, hass, col.value) : null;
      const color = colorResult || rs.text_color || '';
      let inner = '';

      if (col.kind === 'icon') {
        const ic = col.icon || {};
        const show = ic.show ? evalCondition(entityId, ic.show, hass, col.value) : true;
        let glyph = '';
        let native = false; // render HA's computed state icon
        if (show) {
          // Default: when use_native_icon is set, an unmatched icon ALWAYS
          // falls back to the entity's own native icon (the configured default
          // is ignored in that mode). Otherwise use the configured default.
          const dflt = ic.use_native_icon ? '__default__' : ic.default;
          const ruled = evalRuleSet(entityId, { rules: ic.rules || [], default: dflt }, hass, col.value);
          glyph = ruled !== undefined && ruled !== null ? ruled : '';
          if (glyph === '__default__') {
            // Prefer an explicit stored icon; else let HA compute the native
            // state icon (covers, device-class variants, etc. aren't stored on
            // the state object - HA derives them in the frontend).
            if (st.attributes.icon) { glyph = st.attributes.icon; }
            else if (DOMAIN_ICONS[domainOf(entityId)]) { glyph = DOMAIN_ICONS[domainOf(entityId)]; }
            else { native = true; glyph = ''; }
          }
        }
        const iconColor = ic.color ? (evalRuleSet(entityId, ic.color, hass, col.value) || color) : color;
        const iconStyle = `--mdc-icon-size:${ic.size || 14}px; width:${ic.size || 14}px; height:${ic.size || 14}px; ${iconColor ? `color:${escapeHtml(iconColor)};` : ''}`;
        if (native) {
          // ha-state-icon computes the icon from the entity; hydrated with
          // hass + stateObj in _bindActivityRows (setting attributes alone
          // isn't enough for a custom element).
          inner = `<ha-state-icon class="seed-at-state-icon" data-entity-id="${escapeHtml(entityId)}" style="${iconStyle}"></ha-state-icon>`;
        } else if (glyph) {
          inner = `<ha-icon icon="${escapeHtml(glyph)}" style="${iconStyle}"></ha-icon>`;
        }
      } else if (col.kind === 'name') {
        const nameEl = rs.name_link !== false
          ? `<a href="#" class="seed-at-link" data-entity-id="${escapeHtml(entityId)}" style="color:${escapeHtml(color) || 'inherit'}; text-decoration:none;">${escapeHtml(dispName)}</a>`
          : `<span style="color:${escapeHtml(color) || 'inherit'};">${escapeHtml(dispName)}</span>`;
        // Optional secondary info sub-line under the name.
        const si = col.secondary;
        let siEl = '';
        if (si && si.enabled) {
          const r = resolveValueRef(entityId, { source: si.source, attribute: si.attribute, transform: si.transform, unit: si.unit }, hass);
          const sv = (r && !r.badState && r.display != null) ? String(r.display) : '';
          if (sv !== '' && sv !== '—') {
            const text = si.prefix ? `${si.prefix}${sv}` : sv;
            const s = [];
            if (si.color) s.push(`color:${si.color}`);
            s.push(`font-size:${si.font_size ?? 12}px`);
            if (si.indent) s.push(`padding-left:${si.indent}px`);
            if (si.font_weight && si.font_weight != 400) s.push(`font-weight:${si.font_weight}`);
            if (si.italic) s.push('font-style:italic');
            siEl = `<div class="seed-at-secondary" style="${s.join(';')}">${escapeHtml(text)}</div>`;
          }
        }
        inner = siEl ? `<div class="seed-at-namecol">${nameEl}${siEl}</div>` : nameEl;
      } else {
        const resolved = resolveValueRef(entityId, col.value, hass);
        // When the value is missing (off / blank / unavailable), show the
        // column's configurable empty_text ('' = show nothing) instead of the
        // built-in em-dash. A value that resolves to '—' from the source is
        // treated as empty too.
        let display = resolved.display;
        if (resolved.badState || display === '—' || display === '') {
          display = (col.empty_text !== undefined && col.empty_text !== null) ? col.empty_text : '—';
        }
        inner = `<span style="color:${escapeHtml(color) || 'inherit'};">${escapeHtml(display)}</span>`;
      }

      return `<div class="seed-at-cell" style="text-align:${align}; padding:${rs.padding_v ?? 6}px ${rs.padding_h ?? 6}px; font-size:${rs.font_size ?? 14}px;">${inner}</div>`;
    }).join('');

    const dividerCss = rs.divider && rs.divider.show ? `border-bottom:${rs.divider.width ?? 1}px solid ${escapeHtml(rs.divider.color || '#333')};` : '';
    return `<div class="seed-at-row${rs.zebra ? ' seed-at-zebra' : ''}${rs.hover_highlight !== false ? ' seed-at-hover' : ''}" data-entity-id="${escapeHtml(entityId)}" style="${dividerCss}">${cells}</div>`;
  }

  // A separator row: a full-width subheader / spacer spanning all columns.
  // Not an entity - no tap actions, no data-entity-id.
  _activitySepRowHTML(sep) {
    if (!sep) return '';
    const mt = Number(sep.space_above) || 0;
    const mb = Number(sep.space_below) || 0;
    const styles = [
      'grid-column:1 / -1',
      `min-height:${sep.height ?? 8}px`,
      (mt || mb) ? `margin:${mt}px 0 ${mb}px` : '',
      sep.bg ? `background:${escapeHtml(sep.bg)}` : '',
      sep.color ? `color:${escapeHtml(sep.color)}` : 'color:#888',
      `font-size:${sep.font_size ?? 11}px`,
      `font-weight:${sep.weight ?? 700}`,
      sep.italic ? 'font-style:italic' : '',
      `text-align:${sep.align || 'left'}`,
      'display:flex', 'align-items:center',
      `justify-content:${sep.align === 'right' ? 'flex-end' : sep.align === 'center' ? 'center' : 'flex-start'}`,
      'padding:2px 6px'
    ].filter(Boolean).join(';');
    return `<div class="seed-at-row seed-at-sep" style="${styles}">${sep.text ? escapeHtml(sep.text) : ''}</div>`;
  }

  // Read the raw array for an attribute-array table source (already reversed if
  // requested). Returns [] when the entity/attribute is missing or not a list.
  _getArrayRows(section) {
    const src = section.row_source || {};
    if (!this._hass || src.type !== 'attribute_array') return [];
    const st = this._hass.states[src.entity];
    const arr = st && st.attributes ? st.attributes[src.attribute] : null;
    if (!Array.isArray(arr)) return [];
    const out = arr.slice();
    if (src.reverse) out.reverse();
    return out;
  }

  // Build one row from an attribute-array ELEMENT (a plain object). Mirrors
  // _activityRowHTML but resolves columns/rules against element fields via
  // resolveFieldRef / evalFieldRuleSet. `idx` gives each row a stable id.
  _activityArrayRowHTML(element, section, idx) {
    const rs = section.row_style || {};
    const cols = section.columns || [];
    const nowSec = Math.floor(Date.now() / 1000);
    const open = element && (element.end === null || element.end === undefined);

    const cells = cols.map(col => {
      const align = col.align || (col.kind === 'name' ? 'left' : col.kind === 'icon' ? 'center' : 'right');
      const fieldRef = col.value && col.value.source === 'field' ? col.value : { field: '' };
      const colorResult = col.color ? evalFieldRuleSet(element, col.color, fieldRef, nowSec) : null;
      const color = colorResult || rs.text_color || '';
      let inner = '';

      if (col.kind === 'icon') {
        const ic = col.icon || {};
        const show = ic.show ? evalFieldCondition(element, ic.show, fieldRef, nowSec) : true;
        let glyph = '';
        if (show) {
          const ruled = evalFieldRuleSet(element, { rules: ic.rules || [], default: ic.default }, fieldRef, nowSec);
          glyph = ruled !== undefined && ruled !== null ? ruled : '';
        }
        if (glyph) {
          const iconColor = ic.color ? (evalFieldRuleSet(element, ic.color, fieldRef, nowSec) || color) : color;
          inner = `<ha-icon icon="${escapeHtml(glyph)}" style="--mdc-icon-size:${ic.size || 14}px; width:${ic.size || 14}px; height:${ic.size || 14}px; ${iconColor ? `color:${escapeHtml(iconColor)};` : ''}"></ha-icon>`;
        }
      } else {
        // name + value columns both just render the resolved field text (array
        // rows have no entity to link to, so name is plain text).
        const resolved = resolveFieldRef(element, col.value || {}, nowSec);
        let display = resolved.display;
        if ((resolved.badState || display === '' ) && col.kind !== 'name') {
          display = (col.empty_text !== undefined && col.empty_text !== null) ? col.empty_text : '';
        }
        const weightCss = open ? 'font-weight:700;' : '';
        inner = `<span style="color:${escapeHtml(color) || 'inherit'};${weightCss}">${escapeHtml(display)}</span>`;
      }

      return `<div class="seed-at-cell" style="text-align:${align}; padding:${rs.padding_v ?? 6}px ${rs.padding_h ?? 6}px; font-size:${rs.font_size ?? 14}px;">${inner}</div>`;
    }).join('');

    const dividerCss = rs.divider && rs.divider.show ? `border-bottom:${rs.divider.width ?? 1}px solid ${escapeHtml(rs.divider.color || '#333')};` : '';
    return `<div class="seed-at-row${rs.zebra ? ' seed-at-zebra' : ''}${rs.hover_highlight !== false ? ' seed-at-hover' : ''}${open ? ' seed-at-open' : ''}" data-row-idx="${idx}" style="${dividerCss}">${cells}</div>`;
  }

  // Header row (Req 7/8): per-column show + color, global header color/size.
  _activityHeaderHTML(section) {
    const headers = section.headers || {};
    if (headers.show === false) return '';
    const cols = section.columns || [];
    const anyHeader = cols.some(c => c.show_header !== false && (c.header || '').length);
    if (!anyHeader) return '';
    const cells = cols.map(col => {
      const dataAlign = col.align || (col.kind === 'name' ? 'left' : col.kind === 'icon' ? 'center' : 'right');
      const align = col.header_align || dataAlign;
      const show = col.show_header !== false;
      const text = show ? (col.header || '') : '';
      const color = col.header_color || headers.color || '#90EE90';
      return `<div class="seed-at-cell" style="text-align:${align}; padding:2px ${(section.row_style && section.row_style.padding_h) ?? 6}px; font-size:${headers.font_size ?? 10}px; color:${escapeHtml(color)};">${escapeHtml(text)}</div>`;
    }).join('');
    return `<div class="seed-at-row seed-at-header">${cells}</div>`;
  }

  // grid-template-columns from per-column width_mode: fixed value, else 1fr
  // for the name column and auto/min-content for the rest.
  _activityGridTemplate(section) {
    const cols = section.columns || [];
    return cols.map(col => {
      // Numeric width in px (0 / absent = Auto). Fixed widths use minmax(0, Npx)
      // so a column can SHRINK below its target when the card is narrow (e.g.
      // dashboard edit mode) instead of overflowing and clipping the last
      // column. Flexible widths ('20%', '1fr', 'auto', 'max/min-content') scale
      // with the card - '%' is wrapped in minmax(0, …) so it can still shrink.
      const w = col.width;
      if (typeof w === 'number' && w > 0) return `minmax(0, ${w}px)`;
      if (typeof w === 'string' && w) {
        if (/%$/.test(w)) return `minmax(0, ${w})`;   // percentage, allow shrink
        return w;                                      // fr / auto / *-content / legacy 'Npx'
      }
      if (col.kind === 'name') return 'minmax(0, 1fr)';
      return 'minmax(0, max-content)';
    }).join(' ');
  }

  // Assemble a whole activity_table section body + return its count.
  _renderActivityTable(section) {
    const rs = section.row_style || {};
    const indent = Number(rs.indent) || 0;
    const indentCss = indent > 0 ? ` padding-left:${indent}px;` : '';
    const grid = this._activityGridTemplate(section);
    const header = this._activityHeaderHTML(section);

    // Row cap (0 = no limit). Applied after ordering so it keeps the top N.
    const cap = Number(section.max_rows) > 0 ? Math.floor(Number(section.max_rows)) : 0;

    // Attribute-array source: one row per element of the entity attribute.
    if (section.row_source && section.row_source.type === 'attribute_array') {
      let elements = this._getArrayRows(section);
      if (cap && elements.length > cap) elements = elements.slice(0, cap);
      const rows = elements.map((el, i) => this._activityArrayRowHTML(el, section, i)).join('');
      const body = elements.length
        ? `<div class="seed-at-table" data-section-id="${section.id}" style="--seed-at-grid:${grid};${indentCss}">${header}${rows}</div>`
        : `<div class="seed-empty">No history yet</div>`;
      return { contentHtml: body, count: elements.length };
    }

    const ids = this._getActivityEntities(section);
    const count = this._activityCount(section, ids);
    const shownIds = (cap && ids.length > cap) ? ids.slice(0, cap) : ids;

    // Separator rows (subheaders / spacers) at fixed slots: top, after_pinned,
    // bottom. after_pinned drops in only when the section has pinned entities
    // that are actually shown (and there are unpinned rows after them).
    const seps = (section.sort && section.sort.separators) || {};
    const pin = (section.sort && section.sort.pin_top) || [];
    const shownPinned = shownIds.filter(id => pin.indexOf(id) !== -1).length;

    let rows = '';
    if (seps.top) rows += this._activitySepRowHTML(seps.top);
    shownIds.forEach((id, i) => {
      // Insert the after-pinned separator once, right after the last pinned row,
      // only if there are unpinned rows following it.
      if (seps.after_pinned && shownPinned > 0 && i === shownPinned && shownIds.length > shownPinned) {
        rows += this._activitySepRowHTML(seps.after_pinned);
      }
      rows += this._activityRowHTML(id, section);
    });
    if (seps.bottom) rows += this._activitySepRowHTML(seps.bottom);

    const body = ids.length
      ? `<div class="seed-at-table" data-section-id="${section.id}" style="--seed-at-grid:${grid};${indentCss}">${header}${rows}</div>`
      : `<div class="seed-empty">No matching entities</div>`;
    return { contentHtml: body, count };
  }

  // Evaluate a RuleSet whose conditions test a scalar count (title-row icon
  // color). The count is treated as the numeric value; ops lt/le/gt/ge/eq/
  // between apply. Returns the first matching result, else the default.
  _evalCountRuleSet(ruleset, count) {
    if (!ruleset) return '';
    const num = Number(count);
    const test = c => {
      const op = c.op || 'gt';
      const v = Number(c.value);
      switch (op) {
        case 'eq': return num === v;
        case 'ne': return num !== v;
        case 'lt': return num < v;
        case 'le': return num <= v;
        case 'gt': return num > v;
        case 'ge': return num >= v;
        case 'between': return num >= Number(c.value) && num <= Number(c.value2);
        default: return false;
      }
    };
    for (const r of (ruleset.rules || [])) {
      if (test(r.when || {})) return r.result;
    }
    return ruleset.default !== undefined ? ruleset.default : '';
  }

  // Resolve a state-driven header icon to { glyph, color }. For source:'count'
  // rules test the live count (count-ops); for source:'entity' they test a
  // specific entity's state/attribute via the full Condition engine. Returns
  // blank glyph/color when no rule matches and no default is set (caller keeps
  // its existing icon/color).
  _resolveHeaderIcon(section, hi, count) {
    const out = { glyph: '', color: '' };
    if (!hi) return out;
    if (hi.source === 'entity') {
      const id = hi.entity;
      const hasEntity = id && this._hass && this._hass.states[id];
      const pick = rs => {
        if (!rs) return '';
        if (hasEntity) {
          const r = evalRuleSet(id, rs, this._hass);
          if (r !== undefined && r !== null && r !== '') return r;
        }
        return rs.default !== undefined ? rs.default : '';
      };
      out.glyph = pick({ rules: hi.rules || [], default: hi.default });
      out.color = pick(hi.color_rules);
    } else {
      // count source: reuse the numeric count rule evaluator.
      out.glyph = this._evalCountRuleSet({ rules: hi.rules || [], default: hi.default }, count);
      out.color = this._evalCountRuleSet(hi.color_rules, count);
    }
    return out;
  }

  // Map a section id to its overlay of Header Rule Sets (Built-In + library).
  _headerSetsById() {
    const map = {};
    const lib = headerLibraryMap((this._config && this._config.header_library_scope) || 'system');
    Object.keys(lib).forEach(slug => { map['lib:' + slug] = lib[slug]; });
    if (!map[BUILTIN_HEADER_ID]) map[BUILTIN_HEADER_ID] = builtinHeaderRuleSet();
    return map;
  }
  // The entity a section's header rules evaluate against when a ref doesn't
  // name its own: the section's first resolved entity (its "primary").
  _sectionHeaderEntityId(section) {
    if (!section || !section.id) return this._cardHeaderEntityId();
    const ids = this._getActivityEntities(section);
    return (Array.isArray(ids) && ids.length) ? ids[0] : '';
  }
  // The card-title's fallback entity: the first entity of the first section
  // that has one (EES has no single card-level entity).
  _cardHeaderEntityId() {
    for (const s of (this._config.sections || [])) {
      const ids = this._getActivityEntities(s);
      if (Array.isArray(ids) && ids.length) return ids[0];
    }
    return '';
  }
  // Resolve the card TITLE's Header Rule Sets (config.header_rule_refs), reusing
  // the section resolver with a synthetic section (no id → card entity fallback).
  _resolveCardTitleStyle() {
    const refs = this._config.header_rule_refs;
    if (!Array.isArray(refs) || !refs.length) return {};
    return this._resolveHeaderStyle({ header_rule_refs: refs });
  }
  // Resolve a section's applied Header Rule Sets into concrete style outputs.
  // Layered last-match-wins per field across all refs' rules; each set's
  // `default` seeds a field only if no rule set it. Returns a sparse object
  // (only fields that were set) so the caller keeps its existing values for
  // anything unset. `set_secondary` resolves to a display string.
  _resolveHeaderStyle(section) {
    const refs = (section && Array.isArray(section.header_rule_refs)) ? section.header_rule_refs : [];
    if (!refs.length) return {};
    const byId = this._headerSetsById();
    const out = {};      // set_* field -> resolved value (last wins)
    const applyOutputs = (src, entId) => {
      HEADER_RULE_OUTPUT_KEYS.forEach(k => {
        if (src[k] === undefined) return;
        if (k === 'set_secondary') {
          const si = src[k];
          const txt = this._resolveSecondaryText(entId, si);
          if (txt !== '' && txt != null) out.secondaryText = txt;
        } else if (k === 'set_icon_color') { out.iconColor = src[k]; }
        else if (k === 'set_icon') { out.glyph = src[k]; }
        else if (k === 'set_text_color') { out.textColor = src[k]; }
        else if (k === 'set_icon_size') { out.iconSize = src[k]; }
        else if (k === 'set_text_size') { out.textSize = src[k]; }
      });
    };
    refs.forEach(ref => {
      const set = byId[ref.ref];
      if (!set) return;
      // Entity precedence (top wins): the card/section binding (ref.entity)
      // OVERRIDES the set's Library default_entity, which overrides the section's
      // primary entity. A per-rule when_entity (legacy, still honored) only wins
      // when the card/section didn't bind one. Evaluated per-rule so a set can mix.
      const bound = ref.entity || set.default_entity || this._sectionHeaderEntityId(section);
      let matched = false;
      (set.rules || []).forEach(rule => {
        const entId = ref.entity || rule.when_entity || set.default_entity || this._sectionHeaderEntityId(section);
        const hasEnt = entId && this._hass && this._hass.states[entId];
        if (hasEnt && evalCondition(entId, rule.when, this._hass)) { applyOutputs(rule, entId); matched = true; }
      });
      // Fall back to the set's default outputs when no rule in it matched.
      if (!matched && set.default) applyOutputs(set.default, bound);
    });
    return out;
  }
  // Resolve a secondary-info value-ref to a display string (prefix + value+unit).
  _resolveSecondaryText(entId, si) {
    if (!si || !entId || !this._hass) return '';
    const res = resolveValueRef(entId, { source: si.source, attribute: si.attribute, transform: si.transform, unit: si.unit }, this._hass);
    if (!res || res.badState) return '';
    const val = res.display != null ? res.display : (res.raw != null ? String(res.raw) : '');
    if (val === '' || val === '—') return '';
    return (si.prefix || '') + val;
  }

  // Build the activity-table title header: three independently-placed + styled
  // parts (icon, title, count), each rendering its own template and dropping
  // into the left / center / right zone by its `align`.
  _activityTitleHeaderHtml(section, count, tIcon, iconColor, hrs) {
    const tr = section.title_row || {};
    const parts = tr.parts || {};
    hrs = hrs || {};

    const ids = this._getActivityEntities(section);
    const titleP = parts.title || {};
    const countP = parts.count || {};
    const titleStr = this._activityTitleText(section, count, ids, titleP.template, titleP.zero_text);
    const countStr = this._activityTitleText(section, count, ids, countP.template || '{count}', countP.zero_text);

    const partStyle = (p) => [
      p.color ? `color:${escapeHtml(p.color)}` : '',
      p.size ? `font-size:${p.size}px` : '',
      p.weight ? `font-weight:${p.weight}` : '',
      p.italic ? 'font-style:italic' : ''
    ].filter(Boolean).join(';');
    // Header Rule Sets override the TITLE part's color/size when set.
    const titleStyle = [
      partStyle(titleP),
      hrs.textColor ? `color:${escapeHtml(String(hrs.textColor))}` : '',
      hrs.textSize ? `font-size:${Number(hrs.textSize)}px` : '',
    ].filter(Boolean).join(';');

    // Build the three zones; each part is appended to the zone matching its
    // align. Icon color still honors the count rule / section color override.
    const zones = { left: [], center: [], right: [] };
    const push = (part, html) => { if (part && part.show !== false) zones[part.align || 'left'].push(html); };

    const iconP = parts.icon || {};
    const iconColorCss = iconP.color || iconColor;
    push(iconP, `<span class="seed-at-tp seed-at-tp-icon" style="${iconColorCss ? `color:${escapeHtml(iconColorCss)};` : ''}${iconP.size ? `--mdc-icon-size:${iconP.size}px;width:${iconP.size}px;height:${iconP.size}px;` : ''}"><ha-icon icon="${escapeHtml(tIcon)}"></ha-icon></span>`);
    push(titleP, `<span class="seed-at-tp seed-at-tp-title" data-at-title="${section.id}" style="${titleStyle}">${escapeHtml(titleStr)}${hrs.secondaryText ? `<span class="seed-at-tp-secondary">${escapeHtml(String(hrs.secondaryText))}</span>` : ''}</span>`);
    push(countP, `<span class="seed-at-tp seed-at-tp-count" data-at-count="${section.id}" style="${partStyle(countP)}">${escapeHtml(countStr)}</span>`);

    // Custom user-added parts (text template or icon).
    (parts.extra || []).forEach((ep, i) => {
      if (ep.kind === 'icon') {
        push(ep, `<span class="seed-at-tp seed-at-tp-extra" style="${ep.color ? `color:${escapeHtml(ep.color)};` : ''}${ep.size ? `--mdc-icon-size:${ep.size}px;width:${ep.size}px;height:${ep.size}px;` : ''}"><ha-icon icon="${escapeHtml(ep.icon || 'mdi:information-outline')}"></ha-icon></span>`);
      } else {
        const str = this._activityTitleText(section, count, ids, ep.template || '');
        push(ep, `<span class="seed-at-tp seed-at-tp-extra" data-at-extra="${section.id}:${i}" style="${partStyle(ep)}">${escapeHtml(str)}</span>`);
      }
    });

    const zoneHtml = (name, justify) =>
      `<div class="seed-at-title-zone" style="justify-content:${justify};">${zones[name].join('')}</div>`;

    return `
      <div class="seed-at-title-grid">
        ${zoneHtml('left', 'flex-start')}
        ${zoneHtml('center', 'center')}
        ${zoneHtml('right', 'flex-end')}
      </div>
    `;
  }

  // Refresh the live title parts (title / count / custom text) + the header
  // icon in place, without rebuilding the table body. Shared by both the
  // body-changed and body-unchanged paths in updateStates.
  _refreshActivityTitle(sectionEl, section, count) {
    const tr = section.title_row || {};
    const parts = tr.parts || {};
    const titleEl = sectionEl.querySelector(`[data-at-title="${section.id}"]`);
    if (titleEl) titleEl.textContent = this._activityTitleText(section, count, undefined, (parts.title || {}).template, (parts.title || {}).zero_text);
    const countEl = sectionEl.querySelector(`[data-at-count="${section.id}"]`);
    if (countEl) countEl.textContent = this._activityTitleText(section, count, undefined, (parts.count || {}).template || '{count}', (parts.count || {}).zero_text);
    (parts.extra || []).forEach((ep, i) => {
      if (ep.kind === 'icon') return;
      const el = sectionEl.querySelector(`[data-at-extra="${section.id}:${i}"]`);
      if (el) el.textContent = this._activityTitleText(section, count, undefined, ep.template || '', ep.zero_text);
    });
    const iconWrapEl = sectionEl.querySelector('.seed-at-tp-icon, .seed-at-title-icon');
    if (tr.header_icon && tr.header_icon.enabled) {
      const hi = this._resolveHeaderIcon(section, tr.header_icon, count);
      if (iconWrapEl) {
        if (hi.color) iconWrapEl.style.color = hi.color;
        if (hi.glyph) {
          const iconEl = iconWrapEl.querySelector('ha-icon');
          if (iconEl) iconEl.setAttribute('icon', hi.glyph);
        }
      }
    } else {
      const iconRule = (parts.icon && parts.icon.color_rules) || tr.icon_color;
      if (iconRule && iconWrapEl) {
        iconWrapEl.style.color = this._evalCountRuleSet(iconRule, count) || (parts.icon && parts.icon.color) || section.icon_color || '';
      }
    }

    // Header Rule Sets (library) override the table title's text color/size,
    // icon glyph/color, and can add a secondary line — LAST, mirroring render's
    // _activityTitleHeaderHtml. Re-applied live so on/off state changes take
    // effect without a page reload. Sparse: an unset field reverts to the base
    // (empty inline style falls back to the CSS/part value).
    const hrs = this._resolveHeaderStyle(section);
    const titleEl2 = sectionEl.querySelector(`[data-at-title="${section.id}"]`);
    if (titleEl2) {
      titleEl2.style.color = hrs.textColor ? String(hrs.textColor) : '';
      titleEl2.style.fontSize = hrs.textSize ? (Number(hrs.textSize) + 'px') : '';
      // The textContent set above wiped any secondary span — re-add / update it.
      let secEl = titleEl2.querySelector('.seed-at-tp-secondary');
      const secText = hrs.secondaryText ? String(hrs.secondaryText) : '';
      if (secText) {
        if (!secEl) { secEl = document.createElement('span'); secEl.className = 'seed-at-tp-secondary'; titleEl2.appendChild(secEl); }
        secEl.textContent = secText;
      } else if (secEl && secEl.remove) { secEl.remove(); }
    }
    if (iconWrapEl) {
      if (hrs.iconColor) iconWrapEl.style.color = String(hrs.iconColor);
      if (hrs.glyph) {
        const iconEl = iconWrapEl.querySelector('ha-icon');
        if (iconEl) iconEl.setAttribute('icon', hrs.glyph);
      }
    }
  }

  // Live re-apply the card TITLE's Header Rule Set style (icon glyph/color/size,
  // text color/size, secondary line) in place, without a full render. Called
  // from updateStates so on/off transitions recolor the title immediately.
  // Sparse: a field the rules didn't set reverts to its base (clearing the
  // inline style falls back to the render-time CSS built from the config).
  _applyCardTitleStyleLive() {
    const titleEl = this.querySelector('.seed-title');
    if (!titleEl) return;
    const cts = this._resolveCardTitleStyle();
    const iconEl = titleEl.querySelector('ha-icon');
    if (iconEl) {
      iconEl.setAttribute('icon', cts.glyph || this._config.title_icon || 'mdi:view-list');
      iconEl.style.color = cts.iconColor ? String(cts.iconColor) : '';
      if (cts.iconSize) iconEl.style.setProperty('--mdc-icon-size', Number(cts.iconSize) + 'px');
      else iconEl.style.removeProperty && iconEl.style.removeProperty('--mdc-icon-size');
    }
    const textEl = titleEl.querySelector('.seed-title-text');
    if (textEl) {
      textEl.style.color = cts.textColor ? String(cts.textColor) : '';
      textEl.style.fontSize = cts.textSize ? (Number(cts.textSize) + 'px') : '';
    }
    let secEl = titleEl.querySelector('.seed-title-secondary');
    const secText = cts.secondaryText ? String(cts.secondaryText) : '';
    if (secText) {
      if (!secEl) { secEl = document.createElement('span'); secEl.className = 'seed-title-secondary'; titleEl.appendChild(secEl); }
      secEl.textContent = secText;
    } else if (secEl && secEl.remove) { secEl.remove(); }
  }

  // Live re-apply an entities-section header's Header Rule Set style (name
  // color/size, icon glyph/color/size, secondary line) in place. Mirrors the
  // render-time block in renderCard. Sparse revert as above.
  _applyHeaderStyleLive(sectionEl, section) {
    const hrs = this._resolveHeaderStyle(section);
    const nameEl = sectionEl.querySelector('.seed-section-name');
    if (nameEl) {
      nameEl.style.color = hrs.textColor ? String(hrs.textColor) : '';
      nameEl.style.fontSize = hrs.textSize ? `calc(${Number(hrs.textSize)}px * var(--seed-scale,1))` : '';
      let secEl = nameEl.querySelector('.seed-section-secondary');
      const secText = hrs.secondaryText ? String(hrs.secondaryText) : '';
      if (secText) {
        if (!secEl) { secEl = document.createElement('div'); secEl.className = 'seed-section-secondary'; nameEl.appendChild(secEl); }
        secEl.textContent = secText;
      } else if (secEl && secEl.remove) { secEl.remove(); }
    }
    const iconWrap = sectionEl.querySelector('.seed-section-icon');
    if (iconWrap) {
      iconWrap.style.color = hrs.iconColor ? String(hrs.iconColor) : '';
      if (hrs.iconSize) iconWrap.style.setProperty('--mdc-icon-size', `calc(${Number(hrs.iconSize)}px * var(--seed-scale,1))`);
      else iconWrap.style.removeProperty && iconWrap.style.removeProperty('--mdc-icon-size');
      const iconEl = iconWrap.querySelector('ha-icon');
      if (iconEl) iconEl.setAttribute('icon', hrs.glyph || section.icon || 'mdi:folder-outline');
    }
  }

  // Render a title template string against the section's live data. Supported
  // tokens (shown in the editor's token list too):
  //   {name}   - the section name
  //   {count}  - entities matching the count condition (or total, if mode:rows)
  //   {total}  - total rows currently shown in the table
  //   {off}    - {total} - {count} (rows NOT matching the count condition)
  //   {newest} - relative "time ago" of the most-recently-changed shown row
  //   {oldest} - relative "time ago" of the least-recently-changed shown row
  //   {last_changed}      - NAME of the most-recently-changed shown row
  //   {last_changed_ago}  - that row's "time ago" (e.g. "5 m")
  //   {last_changed_time} - that row's clock time (e.g. "1:40 PM")
  //   {entity:ID}            - an arbitrary entity's state (e.g.
  //                            {entity:sensor.sun_solar_elevation})
  //   {entity:ID:attribute}  - that entity's attribute value
  //   {entity:ID:friendly_name} - its display name
  // An explicit `tpl` overrides the section's own text template (used by the
  // per-part templates). `ids` (optional) are the already-resolved shown entity
  // ids so time tokens don't recompute the filter.
  _activityTitleText(section, count, ids, tpl, zeroText) {
    const tr = section.title_row || {};
    if (tpl === undefined) tpl = (tr.text && tr.text.template) || '{name} - {count}';
    // Zero-count override: when nothing matches the count, show the part's
    // alternate string (e.g. "All Secure") verbatim instead of the template.
    if (zeroText != null && zeroText !== '' && Number(count || 0) === 0) return zeroText;
    const rows = Array.isArray(ids) ? ids : this._getActivityEntities(section);
    const total = rows.length;
    const off = Math.max(0, total - Number(count || 0));

    const needsTime = /\{(newest|oldest|last_changed|last_changed_ago|last_changed_time)\}/.test(tpl);
    let newest = '', oldest = '', lcName = '', lcAgo = '', lcTime = '';
    if (needsTime && this._hass) {
      let best = Infinity, worst = -Infinity, bestId = null;
      rows.forEach(id => {
        const st = this._hass.states[id];
        if (st && st.last_changed) {
          const s = Math.max(0, Math.floor((Date.now() - new Date(st.last_changed).getTime()) / 1000));
          if (s < best) { best = s; bestId = id; }
          if (s > worst) worst = s;
        }
      });
      newest = best === Infinity ? '' : formatDurationShort(best) + ' ago';
      oldest = worst === -Infinity ? '' : formatDurationShort(worst) + ' ago';
      if (bestId) {
        const st = this._hass.states[bestId];
        lcName = stripEntityName(st.attributes.friendly_name || bestId, (this._config && this._config.strip_entity_strings) || []);
        lcAgo = formatDurationShort(best);
        lcTime = resolveValueRef(bestId, { source: 'last_changed_time' }, this._hass).display;
      }
    }

    let out = tpl
      .replace(/\{name\}/g, section.name || '')
      .replace(/\{count\}/g, String(count))
      .replace(/\{total\}/g, String(total))
      .replace(/\{off\}/g, String(off))
      .replace(/\{last_changed_time\}/g, lcTime)
      .replace(/\{last_changed_ago\}/g, lcAgo)
      .replace(/\{last_changed\}/g, lcName)
      .replace(/\{newest\}/g, newest)
      .replace(/\{oldest\}/g, oldest);

    // Arbitrary-entity tokens: {entity:ID}, {entity:ID:attribute},
    // {entity:ID:friendly_name}. Reads the live state; blank when unavailable.
    if (out.indexOf('{entity:') !== -1 && this._hass) {
      out = out.replace(/\{entity:([^:}]+)(?::([^}]+))?\}/g, (m, id, attr) => {
        const st = this._hass.states[id];
        if (!st) return '';
        if (!attr) return st.state != null ? String(st.state) : '';
        const v = st.attributes ? st.attributes[attr] : undefined;
        return v != null ? String(v) : '';
      });
    }
    return out;
  }

  createRowHTML(entityId, section, hidden = false) {
    const state = this._hass.states[entityId];
    const domain = domainOf(entityId);
    const name = stripEntityName(state.attributes.friendly_name || entityId, this._stripFor(section));
    const sec = section || {};
    const hiddenStyle = hidden ? ' style="display:none;"' : '';

    // Chips-only sections: every entity renders as just its chip, no
    // row icon or name, laid out in a wrapping flex row (see
    // .seed-children.chips-only).
    if (sec.chips_only) {
      return `<div class="seed-chip-only-item" data-entity-id="${entityId}"${hiddenStyle}>${this._buildChipHtml(entityId, state, sec)}</div>`;
    }

    const icon = state.attributes.icon || DOMAIN_ICONS[domain] || 'mdi:help-circle-outline';

    const isOffState = state.state === 'off' || state.state === 'unavailable' || state.state === 'unknown';
    const iconColorStyle = (this._config.gray_icons_when_off && isOffState)
      ? ` style="color: ${this.getColors().secondary_text};"`
      : '';

    let valueHtml;

    if (domain === 'switch' || domain === 'input_boolean') {
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

    // Optional secondary info line directly under the name.
    const si = sec.secondary_info;
    let nameBlock = `<div class="seed-row-name" data-entity-id="${entityId}">${name}</div>`;
    if (si && si.enabled) {
      const resolved = resolveValueRef(entityId, {
        source: si.source, attribute: si.attribute, transform: si.transform, unit: si.unit
      }, this._hass);
      // Skip the line when the value is missing/unavailable (no attr = no line,
      // matching the native multiple-entity-row).
      let sv = (resolved && !resolved.badState && resolved.display != null) ? String(resolved.display) : '';
      if (sv !== '' && sv !== '—') {
        const text = si.prefix ? `${si.prefix}${sv}` : sv;
        const styles = [];
        if (si.color) styles.push(`color:${si.color}`);
        if (si.font_size) styles.push(`font-size:${si.font_size}px`);
        if (si.indent) styles.push(`padding-left:${si.indent}px`);
        if (si.font_weight && si.font_weight != 400) styles.push(`font-weight:${si.font_weight}`);
        if (si.italic) styles.push('font-style:italic');
        const st = styles.length ? ` style="${styles.join(';')}"` : '';
        nameBlock = `
          <div class="seed-row-namecol">
            <div class="seed-row-name" data-entity-id="${entityId}">${name}</div>
            <div class="seed-row-secondary"${st}>${escapeHtml(text)}</div>
          </div>`;
      }
    }

    return `
      <div class="seed-row" data-entity-id="${entityId}"${hiddenStyle}>
        <div class="seed-row-icon"><ha-icon icon="${icon}"${iconColorStyle}></ha-icon></div>
        ${nameBlock}
        ${valueHtml}
      </div>
    `;
  }

  // Fire the more-info dialog for an entity.
  _fireMoreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent('hass-more-info', {
      detail: { entityId }, bubbles: true, composed: true
    }));
  }

  // Execute a normalized chip action (see normalizeAction). `entityId` is the
  // chip's own entity, used as the default target for more-info / toggle.
  _performAction(actionCfg, entityId) {
    const cfg = normalizeAction(actionCfg, 'none');
    const target = cfg.action_entity || entityId;
    switch (cfg.action) {
      case 'none':
        return;
      case 'toggle':
        if (target) this._hass.callService('homeassistant', 'toggle', {}, { entity_id: target });
        return;
      case 'navigate':
        if (cfg.navigation_path) {
          history.pushState(null, '', cfg.navigation_path);
          this.dispatchEvent(new CustomEvent('location-changed', { bubbles: true, composed: true, detail: { replace: false } }));
        }
        return;
      case 'url':
        if (cfg.url_path) window.open(cfg.url_path, '_blank');
        return;
      case 'call-service': {
        if (!cfg.service || cfg.service.indexOf('.') === -1) return;
        const [dom, svc] = cfg.service.split('.');
        const data = (cfg.service_data && typeof cfg.service_data === 'object') ? cfg.service_data : {};
        this._hass.callService(dom, svc, data);
        return;
      }
      case 'more-info':
      default:
        this._fireMoreInfo(target);
    }
  }

  // Bind tap/hold actions to every activity-table row in a section element.
  // Idempotent per row (guarded by a data flag) so it's safe to call again
  // after updateStates() replaces the table body.
  _bindActivityRows(sectionEl, section) {
    const tapCfg = section.tap_action || { action: 'more-info' };
    const holdCfg = section.hold_action || { action: 'none' };
    // Hydrate any native state-icons: ha-state-icon needs hass + stateObj set as
    // PROPERTIES (not attributes) to compute + render the entity's icon.
    sectionEl.querySelectorAll('ha-state-icon.seed-at-state-icon').forEach(el => {
      const id = el.dataset.entityId;
      const st = id && this._hass ? this._hass.states[id] : null;
      if (st) { el.hass = this._hass; el.stateObj = st; }
    });
    sectionEl.querySelectorAll('.seed-at-row[data-entity-id]').forEach(row => {
      if (row._seedBound) return;
      row._seedBound = true;
      const entityId = row.dataset.entityId;
      let holdTimer = null, held = false;
      const startHold = () => {
        held = false;
        holdTimer = setTimeout(() => {
          held = true;
          if (holdCfg.action && holdCfg.action !== 'none') this._performAction(holdCfg, entityId);
        }, 500);
      };
      const cancelHold = () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } };
      row.addEventListener('pointerdown', () => startHold());
      row.addEventListener('pointerup', () => cancelHold());
      row.addEventListener('pointerleave', () => cancelHold());
      row.addEventListener('pointercancel', () => cancelHold());
      row.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        if (held) { held = false; return; }
        this._performAction(tapCfg, entityId);
      });
    });
  }

  // Attach tap/hold gesture handling to a chip element, dispatching to the
  // owning section's chip_tap_action / chip_hold_action. Hold fires at 500ms;
  // if a hold fires, the following tap/click is suppressed.
  _attachChipGestures(el) {
    const entityId = el.dataset.entityId;
    const sectionId = el.dataset.sectionId;
    const section = sectionId ? (this._config.sections || []).find(s => s.id === sectionId) : null;
    const tapCfg = section ? section.chip_tap_action : { action: 'more-info' };
    const holdCfg = section ? section.chip_hold_action : { action: 'none' };

    let holdTimer = null;
    let held = false;

    const startHold = () => {
      held = false;
      holdTimer = setTimeout(() => {
        held = true;
        this._performAction(holdCfg, entityId);
      }, 500);
    };
    const cancelHold = () => {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    };

    // Pointer events cover mouse + touch. Fall back to click for the tap.
    el.addEventListener('pointerdown', e => { e.stopPropagation(); startHold(); });
    el.addEventListener('pointerup', () => cancelHold());
    el.addEventListener('pointerleave', () => cancelHold());
    el.addEventListener('pointercancel', () => cancelHold());

    el.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      cancelHold();
      if (held) { held = false; return; } // a hold already handled this press
      this._performAction(tapCfg, entityId);
    });
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
      this._attachChipGestures(el);
    });

    // Activity-table rows: tap/hold on the row runs the section's configured
    // action; a name link fires the tap action too (default more-info).
    this.querySelectorAll('.seed-section[data-section-id]').forEach(sectionEl => {
      const section = (this._config.sections || []).find(s => s.id === sectionEl.dataset.sectionId);
      if (section && section.type === 'activity_table') this._bindActivityRows(sectionEl, section);
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
    // Frame presets can be conditional (light up when an entity matches, or a
    // section gains/loses entities), so re-apply section + card frames live on
    // every state change.
    this.updateGlow();
    if (this._config.card_frame) this.updateCardGlow();

    // Card-title Header Rule Sets are state-driven (icon/text color/size, glyph,
    // secondary line) — re-apply live so on/off transitions recolor the title
    // without a page reload. (Only when the card actually applies one.)
    if (Array.isArray(this._config.header_rule_refs) && this._config.header_rule_refs.length) {
      this._applyCardTitleStyleLive();
    }

    this.querySelectorAll('.seed-row').forEach(row => {
      const entityId = row.dataset.entityId;
      const state = this._hass.states[entityId];
      if (!state) return;

      const domain = domainOf(entityId);

      // Live-refresh the secondary-info line (its value may be an attribute
      // that changes independently of state).
      const secEl = row.querySelector('.seed-row-secondary');
      if (secEl) {
        const secWrapEl = row.closest('.seed-section');
        const sec = secWrapEl ? (this._config.sections || []).find(s => s.id === secWrapEl.dataset.sectionId) : null;
        const si = sec && sec.secondary_info;
        if (si && si.enabled) {
          const r = resolveValueRef(entityId, { source: si.source, attribute: si.attribute, transform: si.transform, unit: si.unit }, this._hass);
          const sv = r && r.display != null ? String(r.display) : '';
          secEl.textContent = si.prefix ? `${si.prefix}${sv}` : sv;
        }
      }

      if (this._config.gray_icons_when_off) {
        const iconEl = row.querySelector('.seed-row-icon ha-icon');
        if (iconEl) {
          const isOffState = state.state === 'off' || state.state === 'unavailable' || state.state === 'unknown';
          iconEl.style.color = isOffState ? this.getColors().secondary_text : '';
        }
      }

      if (domain === 'switch' || domain === 'input_boolean') {
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

    // Live visibility pass: re-apply each section's per-state chip-hide flags
    // AND its Entity Display Rules as states change, showing/hiding rows
    // without a full rebuild. Then refresh the header count and, if the
    // section is set to hide-when-empty, show/hide the whole section.
    (this._config.sections || []).forEach(section => {
      const sectionEl = this.querySelector(`.seed-section[data-section-id="${section.id}"]`);
      if (!sectionEl) return;

      // Section-header Header Rule Sets are state-driven — re-apply live so the
      // header icon/name recolor without a reload. Tables apply theirs inside
      // _refreshActivityTitle (their header markup differs), so only entities
      // sections need it here.
      if (section.type !== 'activity_table'
          && Array.isArray(section.header_rule_refs) && section.header_rule_refs.length) {
        this._applyHeaderStyleLive(sectionEl, section);
      }

      // Activity tables: rows depend on live filters/sort/values, so re-render
      // the whole table body in place (cheap - a few grid divs) and refresh the
      // title-row text/icon/glow. Then bail out of the entities-section logic.
      if (section.type === 'activity_table') {
        const at = this._renderActivityTable(section);
        // Content-diff guard: HA pushes `hass` very frequently (any entity in
        // the system changing fires it). Only touch the DOM when the rendered
        // table HTML actually changed since last time - otherwise we'd rebuild
        // + re-bind the whole grid on every push (e.g. once/second if some
        // other sensor ticks), which is the CPU cost. Since long durations no
        // longer render seconds, an idle table produces identical HTML and is
        // skipped entirely.
        this._atLastHtml = this._atLastHtml || {};
        if (this._atLastHtml[section.id] === at.contentHtml) {
          // Body unchanged: skip the expensive DOM rebuild. But the header may
          // still reference an OUTSIDE entity via a {entity:...} token or an
          // entity-driven header icon, whose value can change without changing
          // the table body - so refresh the title parts anyway (cheap text set).
          this._refreshActivityTitle(sectionEl, section, at.count);
          if (section.hide_when_empty) sectionEl.style.display = at.count === 0 ? 'none' : '';
          return;
        }
        this._atLastHtml[section.id] = at.contentHtml;
        const tableWrap = sectionEl.querySelector('.seed-at-table');
        const bodyEl = sectionEl.querySelector('.seed-children');
        if (tableWrap && at.contentHtml.indexOf('seed-at-table') !== -1) {
          // Replace just the table contents to preserve the .seed-children wrapper.
          const tmp = document.createElement('div');
          tmp.innerHTML = at.contentHtml;
          const fresh = tmp.querySelector('.seed-at-table');
          if (fresh) tableWrap.replaceWith(fresh);
        } else if (bodyEl) {
          bodyEl.innerHTML = at.contentHtml;
        }
        // Re-bind row actions on the fresh rows.
        this._bindActivityRows(sectionEl, section);
        this._refreshActivityTitle(sectionEl, section, at.count);
        if (section.hide_when_empty) sectionEl.style.display = at.count === 0 ? 'none' : '';
        return;
      }

      sectionEl.querySelectorAll('.seed-row[data-entity-id], .seed-chip-only-item[data-entity-id]').forEach(el => {
        const entityId = el.dataset.entityId;
        if (!this._hass.states[entityId]) return;
        el.style.display = this._isEntityVisible(entityId, section) ? '' : 'none';
      });

      const count = this._visibleCount(section);

      // "No entities available" placeholder toggles with the visible count.
      const emptyEl = sectionEl.querySelector('.seed-empty-none');
      if (emptyEl) emptyEl.style.display = count === 0 ? '' : 'none';

      // Refresh whichever count element this section rendered.
      const inlineCount = sectionEl.querySelector('.seed-section-count-inline');
      if (inlineCount) inlineCount.textContent = `${section.count_prefix ?? ' - '}${count}`;
      const rightCount = sectionEl.querySelector('.seed-section-count');
      if (rightCount) rightCount.textContent = String(count);

      // Section Display Condition: hide-when-empty.
      if (section.section_display === 'hide_when_empty') {
        sectionEl.style.display = count === 0 ? 'none' : '';
      }

      // Keep-expanded: force the section open while it has visible entities.
      if (section.keep_expanded_when_entities && sectionEl.tagName === 'DETAILS' && count > 0 && !sectionEl.open) {
        sectionEl.open = true;
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
      // Skip chips whose state is hidden (chip_hide_state).
      if (textEl && chip.dataset.hideState !== '1') {
        const secEl = item.closest ? item.closest('.seed-section') : null;
        const sec = secEl ? (this._config.sections || []).find(s => s.id === secEl.dataset.sectionId) : null;
        const rawName = state.attributes.friendly_name || entityId;
        const cleanName = stripEntityName(rawName, this._stripFor(sec));
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
    this._openSubPanels = new Set();
    this._scrollPositions = {};
    this._panelScroll = 0;
    // Editor-only UI preference - not part of the saved card config, since
    // it doesn't affect how the live card renders.
    this._editorAutoClose = true;
    // Debounced Frame-Library save state (in-place editing of lib: presets).
    // _libEditTimer coalesces rapid edits; _libEchoJSON lets the subscription
    // ignore its own just-saved value so it doesn't re-render mid-typing.
    this._libEditTimer = null;
    this._libEchoJSON = null;
<<<<<<< HEAD
    // Frame Style DIRTY DRAFTS — keyed by slug. Editing a lib: preset mutates
    // its draft (a deep copy); nothing is written to the shared library until
    // the user clicks Save. The panel shows all presets at once, so drafts are
    // a map rather than a single object. { <slug>: { fx, dirty } }.
    this._frameDrafts = {};
    // Header Rule Set DIRTY DRAFTS — same pattern/shape as _frameDrafts. Header
    // sets are shared system-wide, so edits stage in a draft and only write to
    // the library on an explicit Save. { <slug>: { set, dirty } }.
    this._headerDrafts = {};
    // Transient per-rule Header-Rule preview toggles (Set of "<slug>||<idx>").
    // Not persisted to config — just controls the in-editor preview box.
    this._hdrRulePreview = new Set();
    // Transient "entity picker is open" toggles for Header Rule bindings
    // (Set of "<sid>||<path>"). The picker is hidden by default; a "Choose an
    // Entity" / "Bind a Default Entity" checkbox reveals it. Not persisted.
    this._hdrEntPickerOpen = new Set();
  }

  // Editor-side color resolver — mirrors SEEDCard.getColors() (stub defaults
  // overlaid with the config's colors) without depending on the card class.
  // Used by the divider preview so it matches the live card's divider color.
  _edColors() {
    const defaults = SEEDCard.getStubConfig().colors;
    return { ...defaults, ...((this._config && this._config.colors) || {}) };
=======
>>>>>>> d65989548fdbf203a804606d75440bca7a95012c
  }

  _normalizeConfig(config) {
    const stub = SEEDCard.getStubConfig();
    // Auto-migrate pre-v107 inline frame styling (shallow-copied so we don't
    // mutate the caller's object) — mirrors SEEDCard.setConfig.
    const cfg = migrateLegacyFrames({ ...(config || {}), sections: ((config && config.sections) || []).map(s => ({ ...s })) });
    const { rule_sets, sections } = Array.isArray(cfg.sections)
      ? buildRuleSetsAndSections(cfg)
      : { rule_sets: (cfg.rule_sets || []).map(normalizeRuleSetDef), sections: stub.sections };
    const merged = {
      ...stub,
      ...cfg,
      colors: { ...stub.colors, ...(cfg.colors || {}) },
      entity_filter_texts: normalizeEntityFilterTexts(cfg),
      entity_filter_labels: normalizeEntityFilterLabels(cfg),
      entity_filter_groups: normalizeEntityFilterGroups(cfg),
      table_defaults: normalizeTableDefaults(cfg.table_defaults),
      frame_presets: normalizeFramePresets(cfg.frame_presets),
      card_frame: cfg.card_frame ? normalizeFrameRef(cfg.card_frame) : null,
      header_library_scope: 'system',
      ...((Array.isArray(cfg.header_rule_refs) && cfg.header_rule_refs.length)
        ? { header_rule_refs: normalizeHeaderRuleRefs(cfg.header_rule_refs) } : {}),
      rule_sets,
      sections
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
    // Load the label registry (shared module-level cache) so label dropdowns
    // show friendly names, not raw ULID ids, on HA builds without hass.labels.
    // Re-render when it lands so the freshly-loaded names populate.
    ensureLabelRegistry(hass, () => {
      if (this._config) { this._rendered = false; this.renderEditor(); }
    });
    // The editor always loads the shared library (so the picker + Save-to-
    // Library reflect it live), regardless of whether a lib: ref exists yet.
    ensureFrameLibrary(hass, (this._config && this._config.frame_library_scope) || 'system', () => {
      if (!this._config) return;
      // Ignore the echo of our own just-saved edit (the subscription fires with
      // the value we wrote) so it doesn't rebuild the DOM mid-typing.
      const scope = this._config.frame_library_scope || 'system';
      const cur = JSON.stringify(frameLibraryMap(scope));
      if (this._libEchoJSON !== null && cur === this._libEchoJSON) { this._libEchoJSON = null; return; }
      this._libEchoJSON = null;
      this._rendered = false; this.renderEditor();
<<<<<<< HEAD
    });
    // Header Rule Set library — load live so the panel + section pickers reflect it.
    ensureHeaderLibrary(hass, (this._config && this._config.header_library_scope) || 'system', () => {
      if (!this._config) return;
      this._rendered = false; this.renderEditor();
=======
>>>>>>> d65989548fdbf203a804606d75440bca7a95012c
    });
    // Only render if we haven't rendered yet or if config changed
    if (this._config && !this._rendered) {
      this.renderEditor();
    }
  }

  // Resolve a label id to its display name (shared module-level resolver).
  _labelName(id) { return haLabelName(id, this._hass); }

  _fireConfigChanged() {
    // Store the NORMALIZED form as the echo key: when HA calls setConfig back
    // with our emitted config, setConfig normalizes it before comparing, so the
    // key must be normalized too - otherwise the compare misses and the editor
    // does a full re-render (the "everything refreshes" bug). Live edits skip
    // per-section normalization, so this is where the two forms are reconciled.
    let normalized;
    try { normalized = this._normalizeConfig(this._config); }
    catch (e) { normalized = this._config; }
    this._lastKnownJSON = JSON.stringify(normalized);
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: { config: JSON.parse(JSON.stringify(normalized)) },
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

  // -------------------------------------------------------------------------
  // Activity-table editor: path-based state helpers
  // -------------------------------------------------------------------------
  // Every activity-table control carries data-at-sid + data-at-path (a dotted
  // path like "columns.0.color.rules.1.result"). One delegated handler reads
  // the path, mutates the section, re-normalizes, fires + re-renders. This is
  // the point-and-click rule-builder engine - no per-control listeners.
  _atGet(obj, path) {
    if (!path) return obj;
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }

  _atSet(obj, path, value) {
    const keys = path.split('.');
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      const nextIsIndex = /^\d+$/.test(keys[i + 1]);
      if (o[k] == null) o[k] = nextIsIndex ? [] : {};
      o = o[k];
    }
    o[keys[keys.length - 1]] = value;
  }

  _atSection(sid) {
    return (this._config.sections || []).find(s => s.id === sid);
  }

  // Resolve an at-* target by id: a section OR a rule set. Rule-set ids start
  // with 'rs_', so the same delegated listeners drive both the section editors
  // and the global rule-set editors. Returns { list, idx, kind } or null.
  // Special sid for the global Entity Table Defaults editor. Reuses the same
  // at-input/at-path plumbing as sections and rule sets.
  static get TABLE_DEFAULTS_SID() { return '__table_defaults__'; }

  _atTarget(sid) {
    if (sid === SEEDCardEditor.TABLE_DEFAULTS_SID) {
      this._config.table_defaults = this._config.table_defaults || {};
      // Wrap the object in a single-element array so list[idx] mutates it by
      // reference, matching the section/rule-set target shape.
      return { list: [this._config.table_defaults], idx: 0, kind: 'table_defaults' };
    }
    // Card root — used by the card-title Header Rule Sets editor.
    if (sid === '__card__') return { list: [this._config], idx: 0, kind: 'card' };
    let idx = (this._config.sections || []).findIndex(s => s.id === sid);
    if (idx !== -1) return { list: this._config.sections, idx, kind: 'section' };
    idx = (this._config.rule_sets || []).findIndex(r => r.id === sid);
    if (idx !== -1) return { list: this._config.rule_sets, idx, kind: 'rule_set' };
    idx = (this._config.frame_presets || []).findIndex(f => f.id === sid);
    if (idx !== -1) return { list: this._config.frame_presets, idx, kind: 'frame_preset' };
<<<<<<< HEAD
    // Header Rule Set library entry (hdr:<slug>): edits target a DRAFT (deep
    // copy), seeded lazily from the shared-library entry. Nothing is written to
    // the store until the user clicks Save (mirrors the Frame Style drafts).
    if (typeof sid === 'string' && sid.startsWith('hdr:')) {
      const slug = sid.slice(4);
      const d = this._headerDraftFor(slug);
      if (d) return { list: [d.set], idx: 0, kind: 'header_lib', slug };
    }
    // Library preset (lib:<slug>): edits target a DRAFT (deep copy), seeded
    // lazily from the shared-library entry. Nothing is written to the store until
    // the user clicks Save. Wrapped in a single-element list to match the shape.
    if (typeof sid === 'string' && sid.startsWith('lib:')) {
      const slug = sid.slice(4);
      const d = this._frameDraftFor(slug);
      if (d) return { list: [d.fx], idx: 0, kind: 'frame_lib', slug };
=======
    // Library preset (lib:<slug>): edit the shared-library entry in place. The
    // module cache object is mutated by reference; _atApply* debounce-saves it
    // back to the store. Wrapped in a single-element list to match the shape.
    if (typeof sid === 'string' && sid.startsWith('lib:')) {
      const slug = sid.slice(4);
      const map = frameLibraryMap(this._config.frame_library_scope);
      if (map && map[slug]) return { list: [map[slug]], idx: 0, kind: 'frame_lib', slug };
>>>>>>> d65989548fdbf203a804606d75440bca7a95012c
    }
    return null;
  }

  // ---- Frame Style dirty-draft helpers (keyed by slug) ----
  // Return the draft for a slug, seeding it from the stored preset on first use.
  _frameDraftFor(slug) {
    if (this._frameDrafts[slug]) return this._frameDrafts[slug];
    const map = frameLibraryMap(this._config.frame_library_scope);
    if (!map || !map[slug]) return null;
    this._frameDrafts[slug] = { fx: JSON.parse(JSON.stringify(map[slug])), dirty: false };
    return this._frameDrafts[slug];
  }
  // The preset to DISPLAY for a lib:<slug> id — the draft if one exists (so
  // unsaved edits show), else the stored entry.
  _frameDisplayPreset(slug) {
    const d = this._frameDrafts[slug];
    if (d) return d.fx;
    const map = frameLibraryMap(this._config.frame_library_scope);
    return (map && map[slug]) || null;
  }
  // Commit a draft → shared library (system-wide confirm). Clears dirty.
  _saveFrameDraft(slug) {
    const d = this._frameDrafts[slug]; if (!d || !d.dirty) return;
    const scope = this._config.frame_library_scope || 'system';
    const nm = d.fx.name || slug;
    if (!window.confirm(`Save "${nm}"?\n\nThis is a shared Frame Style — the change applies to EVERY card using it across your Home Assistant, not just this one.`)) return;
    const map = { ...frameLibraryMap(scope) };
    const norm = normalizeFramePreset(d.fx); norm.id = 'lib:' + slug;
    map[slug] = norm;
    // Reflect immediately in the module cache so the UI shows the saved state.
    SEED_FRAME_LIBRARY[scope === 'system' ? 'system' : 'user'].map = map;
    this._libEchoJSON = JSON.stringify(map);
    saveFrameLibrary(this._hass, scope, map)
      .then(() => { d.dirty = false; this.renderEditor(); })
      .catch(err => { console.error('[easy-entity-styler-card] save frame failed', err); window.alert('Could not save the Frame Style.'); });
  }
  // Discard a draft → reseed from the stored preset.
  _discardFrameDraft(slug) {
    const map = frameLibraryMap(this._config.frame_library_scope);
    if (map && map[slug]) this._frameDrafts[slug] = { fx: JSON.parse(JSON.stringify(map[slug])), dirty: false };
    else delete this._frameDrafts[slug];
    this.renderEditor();
  }

  // ---- Header Rule Set dirty-draft helpers (keyed by slug; mirrors frame) ----
  _headerScope() { return (this._config && this._config.header_library_scope) || 'system'; }
  // Return the draft for a slug, seeding from the stored set on first use.
  _headerDraftFor(slug) {
    if (this._headerDrafts[slug]) return this._headerDrafts[slug];
    const map = headerLibraryMap(this._headerScope());
    if (!map || !map[slug]) return null;
    this._headerDrafts[slug] = { set: JSON.parse(JSON.stringify(map[slug])), dirty: false };
    return this._headerDrafts[slug];
  }
  // The set to DISPLAY for a slug — the draft if one exists (unsaved edits
  // show), else the stored entry.
  _headerDisplaySet(slug) {
    const d = this._headerDrafts[slug];
    if (d) return d.set;
    const map = headerLibraryMap(this._headerScope());
    return (map && map[slug]) || null;
  }
  // Commit a draft → shared library (system-wide confirm). Clears dirty.
  _saveHeaderDraft(slug) {
    const d = this._headerDrafts[slug]; if (!d || !d.dirty) return;
    const scope = this._headerScope();
    const nm = (d.set && d.set.name) || slug;
    if (!window.confirm(`Save "${nm}"?\n\nThis is a shared Header Rule — the change applies to EVERY card using it across your Home Assistant, not just this one.`)) return;
    const map = { ...headerLibraryMap(scope) };
    const norm = normalizeHeaderRuleSet(d.set); norm.id = 'lib:' + slug;
    map[slug] = norm;
    // Reflect immediately in the module cache so the UI shows the saved state.
    SEED_HEADER_LIBRARY[scope === 'system' ? 'system' : 'user'].map = map;
    saveHeaderLibrary(this._hass, scope, map)
      .then(() => { d.dirty = false; this.renderEditor(); })
      .catch(err => { console.error('[easy-entity-styler-card] save header failed', err); window.alert('Could not save the Header Rule.'); });
  }
  // Discard a draft → reseed from the stored set.
  _discardHeaderDraft(slug) {
    const map = headerLibraryMap(this._headerScope());
    if (map && map[slug]) this._headerDrafts[slug] = { set: JSON.parse(JSON.stringify(map[slug])), dirty: false };
    else delete this._headerDrafts[slug];
    this.renderEditor();
  }

  // Apply a STRUCTURAL edit (add/delete/move/kind-change) - re-normalize the
  // target, persist, AND rebuild the editor DOM (needed because the set of
  // visible controls changed).
  _atApply(sid, mutate) {
    const t = this._atTarget(sid);
    if (!t) return;
    mutate(t.list[t.idx]);
    if (t.kind === 'table_defaults') {
      this._config.table_defaults = normalizeTableDefaults(t.list[t.idx]);
      this._fireConfigChanged();
    } else if (t.kind === 'frame_lib') {
<<<<<<< HEAD
      // Library preset: normalize the DRAFT in place (preserve the lib: id) and
      // mark it dirty. NOTHING is written to the shared store until Save.
      const norm = normalizeFramePreset(t.list[t.idx]);
      norm.id = 'lib:' + t.slug;
      const d = this._frameDrafts[t.slug];
      if (d) { d.fx = norm; d.dirty = true; }
      this.renderEditor();
      return;
    } else if (t.kind === 'header_lib') {
      // Header Rule Set: normalize the DRAFT in place (preserve the lib: id) and
      // mark it dirty. NOTHING is written to the shared store until Save.
      const norm = normalizeHeaderRuleSet(t.list[t.idx]);
      norm.id = 'lib:' + t.slug;
      const d = this._headerDrafts[t.slug];
      if (d) { d.set = norm; d.dirty = true; }
      this.renderEditor();
      return;
    } else if (t.kind === 'card') {
      // Card-root edit (e.g. card-title header_rule_refs). Normalize just the
      // refs list; don't re-run section normalize on the whole config.
      if (Array.isArray(this._config.header_rule_refs)) {
        this._config.header_rule_refs = normalizeHeaderRuleRefs(this._config.header_rule_refs);
        if (!this._config.header_rule_refs.length) delete this._config.header_rule_refs;
      }
      this._fireConfigChanged();
=======
      // Library preset: normalize in place (preserve the lib: id) and persist
      // to the shared store; card config is untouched.
      const norm = normalizeFramePreset(t.list[t.idx]);
      norm.id = 'lib:' + t.slug;
      const map = frameLibraryMap(this._config.frame_library_scope);
      map[t.slug] = norm;
      this._saveLibraryDebounced();
      this.renderEditor();
      return;
>>>>>>> d65989548fdbf203a804606d75440bca7a95012c
    } else if (t.kind === 'frame_preset') {
      t.list[t.idx] = normalizeFramePreset(t.list[t.idx]);
      this._fireConfigChanged();
    } else {
      t.list[t.idx] = t.kind === 'rule_set'
        ? normalizeRuleSetDef(t.list[t.idx])
        : normalizeSection(t.list[t.idx]);
      this._fireConfigChanged();
    }
    this.renderEditor();
  }

  // Debounced persist of the in-memory Frame Library to the shared store, with
  // an echo guard so the subscription's own callback doesn't re-render (and
  // clobber focus) when it receives the value we just wrote.
  _saveLibraryDebounced() {
    const scope = this._config.frame_library_scope || 'system';
    const map = { ...frameLibraryMap(scope) };
    this._libEchoJSON = JSON.stringify(map);
    if (this._libEditTimer) clearTimeout(this._libEditTimer);
    this._libEditTimer = setTimeout(() => {
      this._libEditTimer = null;
      saveFrameLibrary(this._hass, scope, map).catch(() => {});
    }, 400);
  }

<<<<<<< HEAD
  // Debounced persist of the in-memory Header Rule Set library to the store.
  _saveHeaderLib() {
    const scope = (this._config && this._config.header_library_scope) || 'system';
    const map = { ...headerLibraryMap(scope) };
    if (this._hdrLibTimer) clearTimeout(this._hdrLibTimer);
    this._hdrLibTimer = setTimeout(() => {
      this._hdrLibTimer = null;
      saveHeaderLibrary(this._hass, scope, map).catch(() => {});
    }, 400);
  }

=======
>>>>>>> d65989548fdbf203a804606d75440bca7a95012c
  // Apply a LIVE VALUE edit (typing in a text/number field, dragging a slider)
  // - update config + push to the card, but do NOT rebuild the editor DOM, so
  // the input keeps focus and the caret doesn't jump. Re-normalization is
  // skipped here (it reorders keys / rebuilds objects, which is unnecessary for
  // a scalar value change and would also disturb nothing visible). The target
  // is normalized on the next structural change or reload.
  _atApplyLive(sid, mutate) {
    const t = this._atTarget(sid);
    if (!t) return;
    mutate(t.list[t.idx]);
    if (t.kind === 'frame_lib') {
<<<<<<< HEAD
      // Live value edit on a library preset: the draft object was mutated in
      // place (already done). Mark dirty; no store write, no re-render (keeps
      // focus). Enable the Save/Discard buttons without rebuilding the DOM.
      const d = this._frameDrafts[t.slug];
      if (d && !d.dirty) {
        d.dirty = true;
        // Flip the whole Save/Discard row to its dirty look via the container
        // class — enables BOTH buttons + reveals the unsaved banner (see CSS).
        const root = this.shadowRoot || this;
        const row = root.querySelector(`.seed-ed-fx-saverow[data-fx-saverow="${t.slug}"]`);
        if (row) row.classList.add('seed-ed-fx-saverow-dirty');
      } else if (d) { d.dirty = true; }
      return;
    }
    if (t.kind === 'header_lib') {
      // Same as frame_lib: mutate the draft in place, mark dirty, enable the
      // Save/Discard buttons without a re-render (keeps focus/caret).
      const d = this._headerDrafts[t.slug];
      if (d && !d.dirty) {
        d.dirty = true;
        // Flip the whole Save/Discard row to its dirty look via the container
        // class — enables BOTH buttons + reveals the unsaved banner (see CSS).
        const root = this.shadowRoot || this;
        const row = root.querySelector(`.seed-ed-fx-saverow[data-hdr-saverow="${t.slug}"]`);
        if (row) row.classList.add('seed-ed-fx-saverow-dirty');
      } else if (d) { d.dirty = true; }
=======
      // Live value edit on a library preset: mutate the cache object in place
      // (already done) and debounce-save; no card config change, no re-render.
      this._saveLibraryDebounced();
>>>>>>> d65989548fdbf203a804606d75440bca7a95012c
      return;
    }
    this._fireConfigChanged();
  }

  // -------------------------------------------------------------------------
  // Activity-table editor: markup builders (point-and-click, no raw YAML)
  // -------------------------------------------------------------------------
  _atOpts(list, val) {
    return list.map(([v, lbl]) => `<option value="${v}" ${String(v) === String(val ?? '') ? 'selected' : ''}>${lbl}</option>`).join('');
  }

  // A labeled slider for a numeric activity-table value. `zeroLabel` (optional)
  // is shown when the value is 0 - use it for "Auto" / "Off" so 0 means
  // disabled/blank. `cur` is the current numeric value (may be undefined).
  _atSlider(sid, path, label, cur, min, max, step, zeroLabel) {
    const v = Number.isFinite(Number(cur)) ? Number(cur) : (zeroLabel ? 0 : min);
    const shown = (v === 0 && zeroLabel) ? zeroLabel : String(v);
    const zeroAttr = zeroLabel ? ` data-at-zero="${escapeHtml(zeroLabel)}"` : '';
    return `
      <div class="seed-ed-slider-row">
        <label>${label}</label>
        <input type="range" class="at-input at-slider" data-at-sid="${sid}" data-at-path="${path}"${zeroAttr}
               min="${min}" max="${max}" step="${step}" value="${v}" />
        <span class="at-slider-val">${escapeHtml(shown)}</span>
      </div>`;
  }

  // Theme CSS-variable colour options offered by the colour-mode dropdown. The
  // stored value is the exact `var(--…)` string (what the renderer applies).
  _AT_THEME_COLORS = [
    ['var(--primary-color)', 'Primary'],
    ['var(--accent-color)', 'Accent'],
    ['var(--primary-text-color)', 'Primary text'],
    ['var(--secondary-text-color)', 'Secondary text'],
    ['var(--disabled-text-color)', 'Disabled text'],
    ['var(--state-active-color)', 'State active'],
    ['var(--error-color)', 'Error'],
    ['var(--warning-color)', 'Warning'],
    ['var(--success-color)', 'Success'],
    ['var(--info-color)', 'Info'],
  ];

  // A colour picker with a mode dropdown: Custom (a real <input type=color>) /
  // Theme (a var(--…) dropdown). Mirrors the divider text/icon-colour pattern
  // and the frame edge-colour selector, so the whole card offers one colour UX.
  // `cur` is the stored value (a #hex, a var(--…) string, or ''). Empty stays
  // empty (byte-stable "don't set"). All controls carry at-input/at-path so the
  // generic scalar-set bind persists them; the mode select is at-structural so
  // switching Custom↔Theme re-renders to swap the value control.
  _atColorField(sid, path, label, cur) {
    cur = cur || '';
    const isTheme = /^var\(/.test(cur);
    const mode = isTheme ? 'theme' : (cur ? 'fixed' : 'unset');
    const hex = /^#[0-9a-f]{6}$/i.test(cur) ? cur : '#2196F3';
    const themeVal = isTheme ? cur : 'var(--primary-color)';
    return `
      <div class="seed-ed-color-field">
        <label>${label}
          <select class="at-input at-structural at-color-mode" data-at-sid="${sid}" data-at-path="${path}" data-at-color-hex="${hex}" data-at-color-theme="${escapeHtml(themeVal)}">
            <option value="unset" ${mode === 'unset' ? 'selected' : ''}>Default</option>
            <option value="fixed" ${mode === 'fixed' ? 'selected' : ''}>Custom</option>
            <option value="theme" ${mode === 'theme' ? 'selected' : ''}>Theme</option>
          </select>
        </label>
        ${mode === 'fixed' ? `<input type="color" class="at-input" data-at-sid="${sid}" data-at-path="${path}" value="${hex}" title="Pick a colour" />` : ''}
        ${mode === 'theme' ? `<select class="at-input" data-at-sid="${sid}" data-at-path="${path}">${this._atOpts(this._AT_THEME_COLORS, themeVal)}</select>` : ''}
      </div>`;
  }

  // A searchable single-entity picker (the image-1 style: search box + a
  // scrollable candidate list of friendly names, client-filtered). Writes the
  // chosen entity id to `path` on `sid` via the generic at-* value path. Shows
  // the current binding as a chip with a clear button. `blankLabel` describes
  // what an empty value means. Candidate rows carry .at-ent-pick so a delegated
  // handler sets the value; the search box filters in place (no re-render).
  _atEntityPicker(sid, path, label, cur, blankLabel) {
    cur = cur || '';
    const opts = this._getEntityOptions();
    const nameOf = id => {
      const st = this._hass && this._hass.states[id];
      return st ? (st.attributes.friendly_name || id) : id;
    };
    const rows = opts.map(opt => {
      const nm = (opt.label || opt.value).replace(/\s*\([^)]*\)\s*$/, '') || opt.value;
      const sel = opt.value === cur;
      return `<div class="seed-ed-ent-row at-ent-pick${sel ? ' at-ent-pick-sel' : ''}" data-at-sid="${sid}" data-at-path="${path}" data-entity-id="${opt.value}" data-search="${escapeHtml((opt.value + ' ' + nm).toLowerCase())}">
        <span class="seed-ed-ent-name">${escapeHtml(nm)}</span>
        <span class="seed-ed-ent-id">${escapeHtml(opt.value)}</span>
        ${sel ? '<ha-icon class="seed-ed-ent-selicon" icon="mdi:check"></ha-icon>' : '<button class="seed-ed-ent-add" title="Choose">+</button>'}
      </div>`;
    }).join('') || '<span class="seed-ed-hint">No entities match the card filter.</span>';
    const pid = (sid + '_' + path).replace(/[^a-z0-9]+/gi, '_');
    const chip = cur
      ? `<span class="seed-ed-strip-tag" title="${escapeHtml(cur)}">${escapeHtml(nameOf(cur))}<ha-icon class="strip-remove at-ent-clear" data-at-sid="${sid}" data-at-path="${path}" icon="mdi:close"></ha-icon></span>`
      : `<span class="seed-ed-hint">${escapeHtml(blankLabel || 'None selected.')}</span>`;
    return `
      <div class="seed-ed-ent-picker" data-ent-pid="${pid}">
        <div class="seed-ed-font-row" style="align-items:flex-start;"><label style="flex:0 0 auto;">${label}</label>
          <div style="flex:1; min-width:0;">
            <div class="seed-ed-strip-tags" style="padding:0 0 4px;">${chip}</div>
            <input type="text" class="seed-ed-search at-ent-search" data-ent-pid="${pid}" placeholder="Search entities…" />
            <div class="seed-ed-entity-list at-ent-list" data-ent-pid="${pid}">${rows}</div>
          </div>
        </div>
      </div>`;
  }

  // Header-Rule entity binding: a collapsible wrapper around _atEntityPicker.
  // The picker is HIDDEN by default; a checkbox ("Choose an Entity" for a
  // card/section binding, "Bind a Default Entity (optional)" in the Library)
  // reveals it. When an entity is already bound, the picker shows directly
  // (with its clear chip) and the checkbox is dropped. `opts.warn` shows a
  // yellow "must bind an entity" notice (used on card/section bindings that
  // have neither their own entity nor a Library default). Open-state is the
  // transient _hdrEntPickerOpen set, keyed by "<sid>||<path>".
  _atHeaderEntBinding(sid, path, cur, opts) {
    opts = opts || {};
    cur = cur || '';
    const key = sid + '||' + path;
    if (cur) {
      return `<div class="seed-ed-hdr-ent">${this._atEntityPicker(sid, path, opts.label || 'Entity', cur, opts.blankLabel)}</div>`;
    }
    const open = this._hdrEntPickerOpen && this._hdrEntPickerOpen.has(key);
    const warn = opts.warn
      ? `<div class="seed-ed-hdr-ent-warn"><ha-icon icon="mdi:alert-outline"></ha-icon><span>${escapeHtml(opts.warnText || '')}</span></div>`
      : '';
    const cb = `<label class="seed-ed-hdr-ent-cb"><input type="checkbox" class="hdr-ent-toggle" data-hdr-ent-key="${escapeHtml(key)}" ${open ? 'checked' : ''}/> ${escapeHtml(opts.checkboxLabel || 'Choose an Entity')}</label>`;
    const picker = open ? this._atEntityPicker(sid, path, opts.label || 'Entity', '', opts.blankLabel) : '';
    return `<div class="seed-ed-hdr-ent">${warn}${cb}${picker}</div>`;
  }

  // Field dropdown for filter rules (addressable entity metadata + state).
  _AT_FILTER_FIELDS = [
    ['domain', 'Domain'], ['device_class', 'Device class'], ['state', 'State'],
    ['name', 'Name'], ['entity_id', 'Entity ID'], ['area', 'Area'],
    ['label', 'Label'], ['integration', 'Integration'], ['group_member', 'Group'],
    ['last_changed_ago', 'Changed (sec ago)']
  ];
  _AT_OPS = [
    ['eq', '='], ['ne', '≠'], ['in', 'in list'], ['not_in', 'not in list'],
    ['contains', 'contains'], ['not_contains', 'not contains'], ['regex', 'regex'],
    ['gt', '>'], ['ge', '≥'], ['lt', '<'], ['le', '≤'], ['between', 'between'],
    ['is_on', 'is on'], ['is_off', 'is off'], ['truthy', 'is active'], ['unavailable', 'unavailable']
  ];
  _AT_VALUE_SOURCES = [
    ['state', 'State'], ['attribute', 'Attribute'], ['last_changed_ago', 'Time since change'],
    ['last_changed_time', 'Change clock time'],
    ['name', 'Name'], ['entity_id', 'Entity ID'], ['area', 'Area'], ['related', 'Paired entity'],
    ['field', 'Array field']
  ];
  _AT_RELATED_MATCH = [['device', 'Same device'], ['name_replace', 'Entity-id replace']];
  _AT_TRANSFORMS = [
    ['none', 'None'], ['pct_of_255', '÷255 → %'], ['multiply100', '×100'],
    ['round1', 'Round 1dp'], ['int', 'Integer'], ['lower', 'lowercase'],
    ['ts_time', 'Timestamp → time'], ['ts_date', 'Timestamp → date'], ['duration', 'Seconds → duration']
  ];

  // ---- Live option enumerators (from the connected hass) ----
  // Each returns [{value,label}] where `value` is exactly what the engine
  // compares against and `label` is the human display name. Backs the real
  // <select> value inputs so users pick by display name and the stored value is
  // always correct (fixes label/group/area rules that failed on typed values).
  _optLabels() {
    // Labels match by NAME (the resolver emits both id and name). Value = name.
    // Names come from hass.labels or the WS-loaded registry cache (_labelName),
    // so we never surface raw ULID ids as the display label.
    const h = this._hass; if (!h) return [];
    const names = new Set();
    if (h.labels) Object.values(h.labels).forEach(l => l && l.name && names.add(l.name));
    Object.values(HA_LABEL_REGISTRY).forEach(nm => nm && names.add(nm));
    const addIds = arr => Array.isArray(arr) && arr.forEach(id => {
      const nm = this._labelName(id); if (nm) names.add(nm);
    });
    if (h.entities) Object.values(h.entities).forEach(e => addIds(e.labels));
    if (h.devices) Object.values(h.devices).forEach(d => addIds(d.labels));
    if (h.areas) Object.values(h.areas).forEach(a => addIds(a.labels));
    return [...names].filter(Boolean).sort((a, b) => a.localeCompare(b)).map(n => ({ value: n, label: n }));
  }
  _optIntegrations() {
    const h = this._hass; if (!h || !h.entities) return [];
    const s = new Set();
    Object.values(h.entities).forEach(e => e && e.platform && s.add(e.platform));
    return [...s].sort().map(v => ({ value: v, label: v }));
  }
  _optGroups() {
    // group_member matches by the group ENTITY ID; label = its friendly name.
    // Includes legacy group.* AND modern Group helpers (platform 'group').
    const h = this._hass; if (!h) return [];
    return haGroupEntityIds(h)
      .map(id => ({ value: id, label: (h.states[id] && h.states[id].attributes && h.states[id].attributes.friendly_name) || id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }
  _optDeviceClasses() {
    const h = this._hass; if (!h || !h.states) return [];
    const s = new Set();
    Object.values(h.states).forEach(st => { const dc = st.attributes && st.attributes.device_class; if (dc) s.add(dc); });
    return [...s].sort().map(v => ({ value: v, label: v }));
  }
  _optDomains() {
    const h = this._hass; if (!h || !h.states) return [];
    const s = new Set(); Object.keys(h.states).forEach(id => s.add(id.split('.')[0]));
    return [...s].sort().map(v => ({ value: v, label: v }));
  }
  _optAreas() {
    // area matches by area NAME (see haEntityArea). value = name.
    const h = this._hass; if (!h || !h.areas) return [];
    return Object.values(h.areas).map(a => a && a.name).filter(Boolean)
      .sort((a, b) => a.localeCompare(b)).map(n => ({ value: n, label: n }));
  }
  _optEntities() {
    const h = this._hass; if (!h || !h.states) return [];
    return Object.keys(h.states).sort()
      .map(id => ({ value: id, label: `${(h.states[id].attributes && h.states[id].attributes.friendly_name) || id}` }));
  }

  // Options for a filter field's value, or null if the field should stay free
  // text. Entity ID is intentionally free-text (too many entities, and it's
  // usually used with `contains`). Returns null on empty enumerations so we
  // fall back to a text input rather than an empty dropdown.
  _filterFieldOptions(field) {
    let opts = null;
    switch (field) {
      case 'label': opts = this._optLabels(); break;
      case 'integration': opts = this._optIntegrations(); break;
      case 'group_member': opts = this._optGroups(); break;
      case 'device_class': opts = this._optDeviceClasses(); break;
      case 'domain': opts = this._optDomains(); break;
      case 'area': opts = this._optAreas(); break;
      default: return null;
    }
    return (opts && opts.length) ? opts : null;
  }

  // One filter rule row. `basePath` is the array this rule lives in (e.g.
  // "filter.include" or a group's "filter.include.0.any_of"); `i` its index.
  // Nested any_of/all_of groups render fully editable and recurse (schema
  // allows one level, but this handles arbitrary depth safely).
  _atFilterRuleRow(sid, basePath, i, rule) {
    const p = `${basePath}.${i}`;

    // Group rule: ANY-of / ALL-of with editable children.
    if (rule.any_of || rule.all_of) {
      const kind = rule.any_of ? 'any_of' : 'all_of';
      const children = rule[kind] || [];
      const childPath = `${p}.${kind}`;
      const childRows = children.map((c, j) => this._atFilterRuleRow(sid, childPath, j, c)).join('')
        || '<span class="seed-ed-hint">Empty group.</span>';
      return `
        <div class="seed-ed-rule-group">
          <div class="seed-ed-rule">
            <span class="seed-ed-hint">match</span>
            <select class="at-input at-group-kind" data-at-sid="${sid}" data-at-path="${p}" data-at-kind="${kind}">
              <option value="any_of" ${kind === 'any_of' ? 'selected' : ''}>ANY of</option>
              <option value="all_of" ${kind === 'all_of' ? 'selected' : ''}>ALL of</option>
            </select>
            <span class="seed-ed-hint" style="flex:1;">these rules</span>
            <ha-icon class="seed-ed-icon-btn at-del" icon="mdi:close" data-at-sid="${sid}" data-at-list="${basePath}" data-at-idx="${i}" title="Remove group"></ha-icon>
          </div>
          <div class="seed-ed-rule-group-body">
            ${childRows}
            <div class="seed-ed-add-btn seed-ed-add-btn-sm at-add" data-at-sid="${sid}" data-at-list="${childPath}" data-at-new="filterrule"><ha-icon icon="mdi:plus"></ha-icon>Add rule to group</div>
          </div>
        </div>`;
    }

    // Flat rule. Back the value input with a live datalist for enumerable
    // fields (label / integration / group / device_class / domain / entity_id)
    // so values are picked from what actually exists in HA. `list=` still allows
    // free text and comma-separated multi-values, so nothing is lost.
    const field = rule.field || 'entity_id';
    const isSet = rule.op === 'in' || rule.op === 'not_in' || (Array.isArray(rule.values) && rule.values.length > 1);
    const valStr = Array.isArray(rule.values) ? rule.values.join(', ') : (rule.value ?? '');
    const opts = this._filterFieldOptions(field);
    let valueControl;
    if (opts && !isSet) {
      // Real <select> for enumerable single-value fields - shows DISPLAY NAME,
      // stores the match value. If the current value isn't in the live list
      // (e.g. an entity currently offline), keep it as a fallback option so it
      // isn't lost.
      const cur = rule.value ?? '';
      const hasCur = cur === '' || opts.some(o => String(o.value) === String(cur));
      const optionHtml = `<option value="" ${cur === '' ? 'selected' : ''}>— select —</option>`
        + opts.map(o => `<option value="${escapeHtml(o.value)}" ${String(o.value) === String(cur) ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')
        + (hasCur ? '' : `<option value="${escapeHtml(cur)}" selected>${escapeHtml(cur)} (not found)</option>`);
      valueControl = `<select class="at-input" data-at-sid="${sid}" data-at-path="${p}.value" style="flex:1;">${optionHtml}</select>`;
    } else {
      valueControl = `<input type="text" class="at-input at-input-multi" data-at-sid="${sid}" data-at-path="${p}.${isSet ? 'values' : 'value'}" value="${escapeHtml(valStr)}" placeholder="${isSet ? 'a, b, c' : 'value'}" style="flex:1;" />`;
    }
    return `
      <div class="seed-ed-rule">
        <select class="at-input at-structural" data-at-sid="${sid}" data-at-path="${p}.field">${this._atOpts(this._AT_FILTER_FIELDS, rule.field)}</select>
        <select class="at-input at-structural" data-at-sid="${sid}" data-at-path="${p}.op">${this._atOpts(this._AT_OPS, rule.op)}</select>
        ${valueControl}
        <ha-icon class="seed-ed-icon-btn at-del" icon="mdi:close" data-at-sid="${sid}" data-at-list="${basePath}" data-at-idx="${i}" title="Remove rule"></ha-icon>
      </div>`;
  }

  // Flat rule-group builder (shared by the section filter panel and each rule
  // set). Renders filter.groups[]: each group has Include/Exclude + ALL/ANY
  // dropdowns, its rules, an add-rule button, and a remove-group button; plus a
  // top-level "Add group" button. An entity shows iff it passes every Include
  // group AND matches no Exclude group.
  _atFilterGroups(sid, filter) {
    const groups = (filter && Array.isArray(filter.groups)) ? filter.groups : filterGroups(filter || {});
    const blocks = groups.map((g, gi) => {
      const gp = `filter.groups.${gi}`;
      const rules = Array.isArray(g.rules) ? g.rules : [];
      const ruleRows = rules.map((r, ri) => this._atFilterRuleRow(sid, `${gp}.rules`, ri, r)).join('')
        || '<span class="seed-ed-hint">No rules — this group matches everything.</span>';
      const modeCls = g.mode === 'exclude' ? 'seed-rs-exclude' : 'seed-rs-include';
      const matchCls = g.match === 'any' ? 'seed-rs-any' : 'seed-rs-all';
      return `
        <div class="seed-ed-rule-group ${modeCls}">
          <div class="seed-ed-rule">
            <select class="at-input at-structural seed-rs-mode ${modeCls}" data-at-sid="${sid}" data-at-path="${gp}.mode">
              <option value="include" ${g.mode !== 'exclude' ? 'selected' : ''}>Include</option>
              <option value="exclude" ${g.mode === 'exclude' ? 'selected' : ''}>Exclude</option>
            </select>
            <span class="seed-ed-hint">— match</span>
            <select class="at-input at-structural seed-rs-match ${matchCls}" data-at-sid="${sid}" data-at-path="${gp}.match">
              <option value="all" ${g.match !== 'any' ? 'selected' : ''}>ALL</option>
              <option value="any" ${g.match === 'any' ? 'selected' : ''}>ANY</option>
            </select>
            <span class="seed-ed-hint" style="flex:1;">of these rules</span>
            <ha-icon class="seed-ed-icon-btn at-del" icon="mdi:trash-can-outline" data-at-sid="${sid}" data-at-list="filter.groups" data-at-idx="${gi}" title="Remove group"></ha-icon>
          </div>
          <div class="seed-ed-rule-group-body">
            ${ruleRows}
            <div class="seed-ed-add-btn seed-ed-add-btn-sm at-add" data-at-sid="${sid}" data-at-list="${gp}.rules" data-at-new="filterrule"><ha-icon icon="mdi:plus"></ha-icon>Add rule</div>
          </div>
        </div>`;
    }).join('') || '<span class="seed-ed-hint">No groups yet — add one to filter entities.</span>';
    return `
      ${blocks}
      <div class="seed-ed-font-row">
        <div class="seed-ed-add-btn seed-ed-add-btn-sm at-add" data-at-sid="${sid}" data-at-list="filter.groups" data-at-new="filtergroup"><ha-icon icon="mdi:plus-box-multiple"></ha-icon>Add rule group</div>
      </div>`;
  }

  _atFilterPanel(sid, section) {
    return `
      <details class="seed-ed-substyle">
        <summary>Filter (auto-detect entities)</summary>
        <div class="seed-ed-substyle-body">
          ${this._atFilterGroups(sid, section.filter)}
        </div>
      </details>`;
  }

  // ------- Global "Entity Rule Sets" panel (reusable named filters) -------
  // Reuses the exact filter rule-builder; each set's include/exclude rules edit
  // at paths relative to the rule-set object (resolved by _atTarget via its id).
  _atRuleSetsPanel() {
    const sets = this._config.rule_sets || [];
    const setBlocks = sets.map((rs, i) => {
      const rid = rs.id;
      const usedBy = (this._config.sections || []).filter(s =>
        Array.isArray(s.rule_sets) && s.rule_sets.some(r => r.ref === rid)).length;
      return `
        <details class="seed-ed-substyle" data-panel="ruleset-${rid}">
          <summary class="seed-ed-substyle-sum">
            <ha-icon icon="mdi:filter-variant" class="seed-ed-rs-sum-icon"></ha-icon>
            <input type="text" class="rs-name at-input" data-at-sid="${rid}" data-at-path="name" value="${escapeHtml(rs.name || '')}" placeholder="Rule set name" style="flex:1;" />
            <span class="seed-ed-hint">${usedBy} section${usedBy === 1 ? '' : 's'}</span>
            <ha-icon class="seed-ed-icon-btn rs-duplicate" icon="mdi:content-copy" data-rs-id="${rid}" title="Duplicate rule set"></ha-icon>
            <ha-icon class="seed-ed-icon-btn rs-delete" icon="mdi:trash-can-outline" data-rs-id="${rid}" title="Delete rule set"></ha-icon>
          </summary>
          <div class="seed-ed-substyle-body">
            ${this._atFilterGroups(rid, rs.filter)}
            ${this._atRuleSetPreviewHtml(rs)}
            <div class="seed-ed-reset-row">
              <span class="seed-ed-reset-btn rs-update-sections" data-rs-id="${rid}" title="Repopulate every section that uses this set (Static refs)"><ha-icon icon="mdi:refresh"></ha-icon>Update Sections using this Rule Set</span>
            </div>
          </div>
        </details>`;
    }).join('');

    return `
      <details class="seed-ed-sections-panel seed-ed-collapsible-panel" open>
        <summary class="seed-ed-panel-summary">
          <div class="seed-ed-sections-panel-title"><ha-icon icon="mdi:filter-variant" class="seed-ed-panel-title-icon"></ha-icon>Entity Filter Rules</div>
        </summary>
        <span class="seed-ed-hint">Named, reusable entity filters. Sections assign one or more (Static or Dynamic) to choose which entities they show.</span>
        <details class="seed-ed-rs-info">
          <summary><ha-icon icon="mdi:information-outline"></ha-icon>Click Here For More Info</summary>
          <div class="seed-ed-rs-info-body">
            <p><strong>Static vs. Dynamic Rule Sets</strong></p>
            <p>When you assign a Rule Set to a section, you choose <em>how</em> its matching entities feed into that section:</p>
            <p><strong>Dynamic</strong> — The Rule Set is re-evaluated live on every render. The section always shows whatever currently matches the rules. Add a new entity that fits the rules (or apply the matching Label to an existing one) and it appears automatically; remove the match and it drops out. Nothing is stored on the section itself — it just holds a reference to the set. Best when you want the section to stay in sync with your system as it changes.</p>
            <p><strong>Static</strong> — The Rule Set is evaluated <em>once, at the moment you assign it</em>, and the resulting entities are snapshotted into the section. From then on the section shows that fixed list, even if the rules would later match differently. Changing the Rule Set's rules does <em>not</em> update the section until you press <strong>"Update Sections using this Rule Set"</strong>, which re-runs the set and refreshes every section that uses it statically. Best when you want a stable, hand-verified list that won't shift on its own.</p>
            <p>Both modes use the same Rule Sets, and a section can mix them — e.g. a Dynamic set for "all lights" plus a Static set pinning a few specific entities. Each entity in a section is tagged with the set it came from, so you can unassign a set and cleanly remove just those entities.</p>
          </div>
        </details>
        <div class="seed-ed-add-row">
          <div class="seed-ed-add-btn seed-ed-add-btn-sm" id="rs-add"><ha-icon icon="mdi:plus"></ha-icon>Add Filter Rule</div>
        </div>
        ${setBlocks || '<span class="seed-ed-hint">No rule sets yet. Add one, then assign it to a section.</span>'}
      </details>`;
  }

  // Live preview of the entities a Filter Rule set currently matches — shown in
  // the Builder so you're not guessing. Mirrors the per-section membership
  // Preview (evalRuleSetMembers + ms-preview-list). Collapsed by default.
  _atRuleSetPreviewHtml(rs) {
    const ids = (rs && this._hass) ? evalRuleSetMembers(rs, this._hass) : [];
    const rows = ids.slice(0, 60).map(id =>
      `<div class="ms-prev-row">${escapeHtml(this._friendly(id))} <span class="seed-ed-hint">${escapeHtml(id)}</span></div>`
    ).join('') || '<span class="seed-ed-hint">No entities match this rule set.</span>';
    return `
      <details class="seed-ed-substyle ms-preview" data-panel="rspreview-${rs.id}">
        <summary class="seed-ed-substyle-sum">
          <ha-icon icon="mdi:eye-outline" class="seed-ed-rs-sum-icon"></ha-icon>
          <span class="seed-ed-substyle-name">Preview</span>
          <span class="seed-ed-hint" style="flex:1;">${ids.length} entit${ids.length === 1 ? 'y' : 'ies'}${ids.length > 60 ? ' (first 60)' : ''}</span>
        </summary>
        <div class="seed-ed-substyle-body">
          <div class="ms-preview-list">${rows}</div>
        </div>
      </details>`;
  }

  // ------- Global "Effect Presets" panel (border+glow+shadow+edge bundles) ---
  _AT_EDGE_SIDES = [['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right']];

  // Per-edge editor. `labelSide` overrides the shown label (used by the
  // "all edges the same" mode, where one editor edits the `top` side but is
  // labelled "All edges").
  _atEdgeSideEditor(fid, fx, side, labelSide) {
    const e = (fx.edges && fx.edges[side]) || { enabled: false, thickness: 1, gradient: true, color: 'match', stops: [] };
    const b = `edges.${side}`;
    const on = e.enabled === true;
    const isGrad = e.gradient !== false;
    const label = labelSide || (side[0].toUpperCase() + side.slice(1) + ' edge');
    let body = `
      <div class="seed-ed-font-row">
        <label><input type="checkbox" class="at-check at-structural" data-at-sid="${fid}" data-at-path="${b}.enabled" ${on ? 'checked' : ''}/> ${label}</label>
      </div>`;
    if (on) {
      // Solid ↔ Gradient sub-mode.
      body += `
        <div class="seed-ed-font-row">
          <label>Type
            <select class="fx-edge-mode at-structural" data-fx-id="${fid}" data-fx-side="${side}">
              <option value="solid" ${!isGrad ? 'selected' : ''}>Solid line</option>
              <option value="gradient" ${isGrad ? 'selected' : ''}>Gradient</option>
            </select>
          </label>
        </div>
        ${this._atSlider(fid, `${b}.thickness`, 'Thickness (px)', e.thickness ?? 1, 1, 12, 1)}`;
      if (!isGrad) {
        // Solid: color SOURCE dropdown — Match (border/icon color) / Theme
        // (theme divider color) / Custom (a hex picker shown only for Custom).
        const col = e.color || 'match';
        const mode = col === 'match' ? 'match' : (col === 'theme' ? 'theme' : 'fixed');
        body += `
          <div class="seed-ed-font-row">
            <label>Color<select class="fx-edge-solid-mode at-structural" data-fx-id="${fid}" data-fx-side="${side}">
              <option value="match" ${mode === 'match' ? 'selected' : ''}>Match (border/icon color)</option>
              <option value="theme" ${mode === 'theme' ? 'selected' : ''}>Theme</option>
              <option value="fixed" ${mode === 'fixed' ? 'selected' : ''}>Custom color</option>
            </select></label>
            ${mode === 'fixed' ? `<label>&nbsp;<input type="color" class="at-input" data-at-sid="${fid}" data-at-path="${b}.color" value="${/^#[0-9a-f]{6}$/i.test(col) ? col : '#2196F3'}" /></label>` : ''}
          </div>
          <span class="seed-ed-hint"><b>Match</b> follows the border/icon color; <b>Theme</b> uses the theme divider color.</span>`;
      } else {
        const curPattern = e.pattern || '';
        const patternOpts = EDGE_GRADIENT_PATTERN_LIST
          .map(([v, l]) => `<option value="${v}" ${curPattern === v ? 'selected' : ''}>${l}</option>`).join('');
        // Per-stop editor mirrors the Divider stop editor: a position SLIDER (live %),
        // a color picker, and a source-mode dropdown (Color / Match / Transparent).
        const stops = (e.stops || []).map((s, i) => {
          const isMatch = s.color === 'match', isT = s.color === 'transparent';
          const posV = clamp(Number(s.pos) || 0, 0, 100);
          return `
          <div class="seed-ed-rule">
            <input type="range" class="at-input at-slider" data-at-sid="${fid}" data-at-path="${b}.stops.${i}.pos" min="0" max="100" step="1" value="${posV}" style="flex:1;" /><span class="at-slider-val">${posV}</span>
            <input type="color" class="at-input" data-at-sid="${fid}" data-at-path="${b}.stops.${i}.color" value="${/^#[0-9a-f]{6}$/i.test(s.color || '') ? s.color : '#2196F3'}" ${(isMatch || isT) ? 'disabled' : ''} style="width:44px;" />
            <select class="fx-edge-stop-mode" data-fx-id="${fid}" data-fx-side="${side}" data-fx-idx="${i}" title="Stop color source">
              <option value="color" ${(!isMatch && !isT) ? 'selected' : ''}>Color</option>
              <option value="match" ${isMatch ? 'selected' : ''}>Match</option>
              <option value="transparent" ${isT ? 'selected' : ''}>Transp.</option>
            </select>
            <ha-icon class="seed-ed-icon-btn at-del" icon="mdi:close" data-at-sid="${fid}" data-at-list="${b}.stops" data-at-idx="${i}" title="Remove stop"></ha-icon>
          </div>`;
        }).join('');
        body += `
          <div class="seed-ed-font-row">
            <label>Pattern
              <select class="fx-edge-pattern at-structural" data-fx-id="${fid}" data-fx-side="${side}">${patternOpts}</select>
            </label>
          </div>
          <div class="seed-ed-rules">${stops || '<span class="seed-ed-hint">No stops. Pick a Pattern above, or Add stops. Use <code>match</code> as a color to follow the border/icon color.</span>'}</div>
          <div class="seed-ed-add-btn seed-ed-add-btn-sm at-add" data-at-sid="${fid}" data-at-list="${b}.stops" data-at-new="edgestop"><ha-icon icon="mdi:plus"></ha-icon>Add stop</div>`;
      }
    }
    return `<div class="seed-ed-ruleblock">${body}</div>`;
  }

  // A small storage-location badge for a preset. A local preset lives in THIS
  // card's config; if an identical (by content) preset also exists in the
<<<<<<< HEAD
  // Style Library, we mark it "In Library" so the user knows it's published.
=======
  // Preset Library, we mark it "In Library" so the user knows it's published.
>>>>>>> d65989548fdbf203a804606d75440bca7a95012c
  // Location badge distinguishing where a preset lives:
  //  - a lib: preset is System-wide (shared library, every card can use it)
  //  - otherwise it's Local (this card only)
  _fxLocationBadge(fx) {
<<<<<<< HEAD
    if (fx && fx._builtin) {
      return `<span class="seed-ed-loc-badge seed-ed-loc-builtin" title="Built-in fallback frame — read-only. Duplicate it to make an editable System preset."><ha-icon icon="mdi:lock-outline"></ha-icon>Built-In</span>`;
    }
    const isLib = typeof fx.id === 'string' && fx.id.startsWith('lib:');
    if (isLib) {
      return `<span class="seed-ed-loc-badge seed-ed-loc-lib" title="Shared System preset — available to every card. Edits here update every card that uses it."><ha-icon icon="mdi:earth"></ha-icon>System</span>`;
    }
    // Legacy local preset from a pre-System-only config (read-compat only).
    return `<span class="seed-ed-loc-badge seed-ed-loc-card" title="Legacy card-local preset. Use Move to System to publish it to the shared library."><ha-icon icon="mdi:card-outline"></ha-icon>Local (legacy)</span>`;
=======
    const isLib = typeof fx.id === 'string' && fx.id.startsWith('lib:');
    if (isLib) {
      return `<span class="seed-ed-loc-badge seed-ed-loc-lib" title="Shared library preset — available to every card. Edits here update every card that uses it."><ha-icon icon="mdi:earth"></ha-icon>System</span>`;
    }
    return `<span class="seed-ed-loc-badge seed-ed-loc-card" title="Lives in this card only. Use Save to Library to make it available to every card."><ha-icon icon="mdi:card-outline"></ha-icon>Local</span>`;
>>>>>>> d65989548fdbf203a804606d75440bca7a95012c
  }

  _atFramePresetEditor(fx) {
    const fid = fx.id;
<<<<<<< HEAD
    const isBuiltin = !!fx._builtin;
    const isLib = typeof fid === 'string' && fid.startsWith('lib:') && !isBuiltin;
=======
    const isLib = typeof fid === 'string' && fid.startsWith('lib:');
>>>>>>> d65989548fdbf203a804606d75440bca7a95012c
    const usesFid = fr => fr && Array.isArray(fr.presets) && fr.presets.includes(fid);
    const usedBy = (this._config.sections || []).filter(s => usesFid(s.frame)).length
      + (usesFid(this._config.card_frame) ? 1 : 0);
    const hasGlow = !!fx.glow, hasShadow = !!fx.shadow, hasBorder = !!fx.border;
    const isSectionCond = fx.when_kind === 'section_has_entities' || fx.when_kind === 'section_empty';
    const condActive = !!fx.when || isSectionCond;
    const condKind = isSectionCond ? fx.when_kind : 'entity';
    const g = fx.glow || {}, sh = fx.shadow || {}, bd = fx.border || {}, wh = fx.when || {};
    const bgMode = fx.background ? (fx.background.mode || 'custom') : 'custom';
    const sideOn = s => bd.sides ? bd.sides.includes(s) : true;
    const badge = this._fxLocationBadge(fx);
    return `
      <details class="seed-ed-substyle" data-panel="effect-${fid}">
        <summary class="seed-ed-substyle-sum">
          <ha-icon icon="mdi:auto-fix" class="seed-ed-rs-sum-icon"></ha-icon>
          ${badge}
          <span class="seed-ed-substyle-name" style="flex:1;">${escapeHtml(fx.name || 'Frame Style')}${fx.note ? ` <span class="seed-ed-hint" title="${escapeHtml(fx.note)}">📝</span>` : ''}</span>
          <span class="seed-ed-hint">${usedBy} use${usedBy === 1 ? '' : 's'}</span>
        </summary>
        <div class="seed-ed-substyle-body">
          <div class="seed-ed-fx-actions">
            ${isBuiltin
              ? `<span class="at-input" style="flex:1; opacity:0.7;">${escapeHtml(fx.name || 'Built-In')}</span>`
              : `<input type="text" class="at-input" data-at-sid="${fid}" data-at-path="name" value="${escapeHtml(fx.name || '')}" placeholder="Style name" style="flex:1;" />`}
            <ha-icon class="seed-ed-icon-btn fx-export" icon="mdi:export-variant" data-fx-id="${fid}" title="Export preset to text"></ha-icon>
<<<<<<< HEAD
            ${isBuiltin
              ? `<ha-icon class="seed-ed-icon-btn fx-lib-duplicate" icon="mdi:content-copy" data-fx-id="${fid}" title="Duplicate into an editable System preset"></ha-icon>`
              : isLib
              ? `<ha-icon class="seed-ed-icon-btn fx-lib-duplicate" icon="mdi:content-copy" data-fx-id="${fid}" title="Duplicate in the shared System library"></ha-icon>
                 <ha-icon class="seed-ed-icon-btn fx-lib-delete" icon="mdi:trash-can-outline" data-fx-id="${fid}" title="Delete from the shared System library"></ha-icon>`
              : `<ha-icon class="seed-ed-icon-btn fx-save-lib" icon="mdi:cloud-upload-outline" data-fx-id="${fid}" title="Move to System: publish to the shared library and link this card to it"></ha-icon>
=======
            ${isLib
              ? `<ha-icon class="seed-ed-icon-btn fx-lib-tolocal" icon="mdi:card-plus-outline" data-fx-id="${fid}" title="Copy to this card as a Local preset"></ha-icon>
                 <ha-icon class="seed-ed-icon-btn fx-lib-duplicate" icon="mdi:content-copy" data-fx-id="${fid}" title="Duplicate in the shared library"></ha-icon>
                 <ha-icon class="seed-ed-icon-btn fx-lib-delete" icon="mdi:trash-can-outline" data-fx-id="${fid}" title="Delete from the shared library"></ha-icon>`
              : `<ha-icon class="seed-ed-icon-btn fx-save-lib" icon="mdi:cloud-upload-outline" data-fx-id="${fid}" title="Make System-wide: publish to the shared library and link this card to it"></ha-icon>
>>>>>>> d65989548fdbf203a804606d75440bca7a95012c
                 <ha-icon class="seed-ed-icon-btn fx-duplicate" icon="mdi:content-copy" data-fx-id="${fid}" title="Duplicate preset"></ha-icon>
                 <ha-icon class="seed-ed-icon-btn fx-delete" icon="mdi:trash-can-outline" data-fx-id="${fid}" title="Delete preset"></ha-icon>`}
          </div>
          ${isBuiltin ? '<span class="seed-ed-hint">Built-in fallback frame (read-only). Duplicate it to create an editable System preset.</span>'
            : `<div class="seed-ed-font-row"><label style="flex:1;">Note<input type="text" class="at-input" data-at-sid="${fid}" data-at-path="note" value="${escapeHtml(fx.note || '')}" placeholder="optional note (e.g. where you use this)" style="width:100%;" /></label></div>`}
          <div class="seed-ed-preview-swatch" data-fx-preview="${fid}"><span>Preview</span></div>
          ${isBuiltin ? '' : `
          <div class="seed-ed-group-title">Glow</div>
          <div class="seed-ed-font-row">
            <label><input type="checkbox" class="at-fx-obj-toggle" data-at-sid="${fid}" data-fx-key="glow" ${hasGlow ? 'checked' : ''}/> Enable glow</label>
          </div>
          ${hasGlow ? `<div class="seed-ed-font-row">
            <label>Color<input type="color" class="at-input" data-at-sid="${fid}" data-at-path="glow.color" value="${/^#/.test(g.color || '') ? g.color : '#2196F3'}" ${g.follow_icon ? 'disabled' : ''} /></label>
            <label><input type="checkbox" class="at-check at-structural" data-at-sid="${fid}" data-at-path="glow.follow_icon" ${g.follow_icon ? 'checked' : ''}/> Follow icon color</label>
            <label><input type="checkbox" class="at-check" data-at-sid="${fid}" data-at-path="glow.borders_only" ${g.borders_only ? 'checked' : ''}/> Borders only</label>
          </div>
          ${this._atSlider(fid, 'glow.intensity', 'Intensity', g.intensity ?? 1.0, 0.25, 3, 0.05)}` : ''}

          <div class="seed-ed-group-title">Shadow</div>
          <div class="seed-ed-font-row">
            <label><input type="checkbox" class="at-fx-obj-toggle" data-at-sid="${fid}" data-fx-key="shadow" ${hasShadow ? 'checked' : ''}/> Enable drop-shadow</label>
          </div>
          ${hasShadow ? `<div class="seed-ed-font-row">
            <label>Color<input type="color" class="at-input" data-at-sid="${fid}" data-at-path="shadow.color" value="${/^#/.test(sh.color || '') ? sh.color : '#000000'}" ${sh.follow_icon ? 'disabled' : ''} /></label>
            <label><input type="checkbox" class="at-check at-structural" data-at-sid="${fid}" data-at-path="shadow.follow_icon" ${sh.follow_icon ? 'checked' : ''}/> Follow icon color</label>
          </div>
          ${this._atSlider(fid, 'shadow.x', 'X offset (px)', sh.x ?? 0, -40, 40, 1)}
          ${this._atSlider(fid, 'shadow.y', 'Y offset (px)', sh.y ?? 4, -40, 40, 1)}
          ${this._atSlider(fid, 'shadow.blur', 'Blur (px)', sh.blur ?? 12, 0, 60, 1)}
          ${this._atSlider(fid, 'shadow.spread', 'Spread (px)', sh.spread ?? 0, -20, 40, 1)}
          ${this._atSlider(fid, 'shadow.opacity', 'Opacity', sh.opacity ?? 0.35, 0, 1, 0.05)}` : ''}

          <div class="seed-ed-group-title">Border</div>
          <div class="seed-ed-font-row">
            <label><input type="checkbox" class="at-fx-obj-toggle" data-at-sid="${fid}" data-fx-key="border" ${hasBorder ? 'checked' : ''}/> Enable border</label>
          </div>
          ${hasBorder ? `<div class="seed-ed-font-row">
            <label>Color<input type="color" class="at-input" data-at-sid="${fid}" data-at-path="border.color" value="${/^#/.test(bd.color || '') ? bd.color : '#2196F3'}" ${bd.follow_icon ? 'disabled' : ''} /></label>
            <label><input type="checkbox" class="at-check at-structural" data-at-sid="${fid}" data-at-path="border.follow_icon" ${bd.follow_icon ? 'checked' : ''}/> Follow icon color</label>
          </div>
          ${this._atSlider(fid, 'border.width', 'Width (px)', bd.width ?? 1, 1, 8, 1)}
          ${this._atSlider(fid, 'border.radius', 'Radius (px)', bd.radius ?? 12, 0, 24, 1)}
          <div class="seed-ed-side-toggles">
            ${this._AT_EDGE_SIDES.map(([s, l]) => `<label><input type="checkbox" class="at-check fx-border-side" data-at-sid="${fid}" data-fx-side="${s}" ${sideOn(s) ? 'checked' : ''}/> ${l}</label>`).join('')}
          </div>
          <span class="seed-ed-hint">Rounded corners (TL, TR, BR, BL) — untick to square a corner:</span>
          <div class="seed-ed-side-toggles">
            ${[['0', 'TL'], ['1', 'TR'], ['2', 'BR'], ['3', 'BL']].map(([i, l]) => {
              const cn = Array.isArray(bd.corners) ? bd.corners : [true, true, true, true];
              return `<label><input type="checkbox" class="at-check" data-at-sid="${fid}" data-at-path="border.corners.${i}" ${cn[Number(i)] !== false ? 'checked' : ''}/> ${l}</label>`;
            }).join('')}
          </div>` : ''}

          <div class="seed-ed-group-title">Background</div>
          <div class="seed-ed-font-row">
            <label><input type="checkbox" class="at-fx-obj-toggle" data-at-sid="${fid}" data-fx-key="background" ${fx.background ? 'checked' : ''}/> Set background</label>
          </div>
          ${fx.background ? `<div class="seed-ed-font-row">
            <label>Mode
              <select class="fx-bg-mode at-structural" data-fx-id="${fid}">
                <option value="custom" ${bgMode === 'custom' ? 'selected' : ''}>Custom color</option>
                <option value="transparent" ${bgMode === 'transparent' ? 'selected' : ''}>Transparent</option>
                <option value="theme" ${bgMode === 'theme' ? 'selected' : ''}>Theme (inherit)</option>
              </select>
            </label>
            ${bgMode === 'custom' ? `<label>Color<input type="color" class="at-input" data-at-sid="${fid}" data-at-path="background.color" value="${/^#/.test((fx.background && fx.background.color) || '') ? fx.background.color : '#1c1c1c'}" /></label>` : ''}
          </div>` : ''}

          <div class="seed-ed-group-title">Edges (Border / Gradient)</div>
          <span class="seed-ed-hint">Each edge is a <b>Solid line</b> or a <b>Gradient</b> (stops + patterns; a <code>match</code> color follows the border/icon color). Turn on "All edges the same" for one editor applied to every side, or leave off for independent per-side control.</span>
          <div class="seed-ed-font-row">
            <label><input type="checkbox" class="fx-edges-allsame at-structural" data-fx-id="${fid}" ${fx.edges && fx.edges.all_same ? 'checked' : ''}/> All edges the same</label>
          </div>
          ${(fx.edges && fx.edges.all_same)
            ? this._atEdgeSideEditor(fid, fx, 'top', 'All edges')
            : this._AT_EDGE_SIDES.map(([s]) => this._atEdgeSideEditor(fid, fx, s)).join('')}

          <div class="seed-ed-group-title">Condition (optional)</div>
          <div class="seed-ed-font-row">
            <label><input type="checkbox" class="fx-when-toggle" data-fx-id="${fid}" ${condActive ? 'checked' : ''}/> Only apply when…</label>
          </div>
          ${condActive ? `<div class="seed-ed-font-row">
            <label>Based on
              <select class="fx-when-kind at-structural" data-fx-id="${fid}">
                <option value="entity" ${condKind === 'entity' ? 'selected' : ''}>An entity's state</option>
                <option value="section_has_entities" ${condKind === 'section_has_entities' ? 'selected' : ''}>A section HAS visible entities</option>
                <option value="section_empty" ${condKind === 'section_empty' ? 'selected' : ''}>A section has NO visible entities</option>
              </select>
            </label>
          </div>
          ${condKind === 'entity' ? `<div class="seed-ed-font-row">
            <input type="text" class="at-input" list="ees-all-entities" data-at-sid="${fid}" data-at-path="when_entity" value="${escapeHtml(fx.when_entity || '')}" placeholder="entity id" style="flex:1;" />
            <select class="at-input" data-at-sid="${fid}" data-at-path="when.op">${this._atOpts(this._AT_OPS, wh.op)}</select>
            <input type="text" class="at-input" data-at-sid="${fid}" data-at-path="when.value" value="${escapeHtml(wh.value ?? '')}" placeholder="value" style="width:90px;" />
          </div>` : `<div class="seed-ed-font-row">
            <label>Section
              <select class="at-input" data-at-sid="${fid}" data-at-path="when_section">
                <option value="">-- Select a section --</option>
                ${(this._config.sections || []).map(s => `<option value="${s.id}" ${fx.when_section === s.id ? 'selected' : ''}>${escapeHtml(s.name || 'Section')}</option>`).join('')}
              </select>
            </label>
          </div>`}` : ''}
          `}
          ${isLib ? this._atFrameSaveRow(fid.slice(4)) : ''}
        </div>
      </details>`;
  }

  // Save/Discard row for a lib: Frame Style. Edits live in this._frameDrafts[slug]
  // until Save commits them to the shared library. Dirty state is driven entirely
  // by the `seed-ed-fx-saverow-dirty` container class (see _atHeaderSaveRow) so a
  // live scalar edit can enable BOTH buttons by toggling one class.
  _atFrameSaveRow(slug) {
    const d = this._frameDrafts[slug];
    const dirty = !!(d && d.dirty);
    return `<div class="seed-ed-fx-saverow${dirty ? ' seed-ed-fx-saverow-dirty' : ''}" data-fx-saverow="${escapeHtml(slug)}">
      <span class="seed-ed-hint seed-ed-fx-unsaved"><ha-icon icon="mdi:content-save-alert"></ha-icon> Unsaved — shared Frame Style; Save applies it to every card that uses it.</span>
      <div class="seed-ed-font-row" style="gap:8px;">
        <div class="seed-ed-add-btn seed-ed-add-btn-sm fx-save-draft" data-fx-slug="${escapeHtml(slug)}"><ha-icon icon="mdi:content-save"></ha-icon>Save</div>
        <div class="seed-ed-add-btn seed-ed-add-btn-sm fx-discard-draft" data-fx-slug="${escapeHtml(slug)}"><ha-icon icon="mdi:undo"></ha-icon>Discard</div>
      </div>
    </div>`;
  }

  // Paint each effect's live preview swatch (always shows it as active, i.e.
  // ignoring the `when` condition, so you can see the styling while editing).
  // Self-contained: builds the glow/shadow inline (the renderer's _build*
  // helpers live on SEEDCard, not this editor class) and reads the icon color
  // from config - calling SEEDCard methods here previously threw and broke the
  // whole editor whenever a config had an effect preset.
  _paintFramePreviews() {
    const iconColor = (this._config.colors && this._config.colors.icon) || '#2196F3';
<<<<<<< HEAD
    // Built-In + System library presets + any legacy local presets all render
    // editor blocks, so paint swatches for all of them.
    const lib = frameLibraryMap(this._config.frame_library_scope);
    const allPresets = [builtinFramePreset()]
      // Draft-aware: paint the unsaved draft look for any lib preset being edited.
      .concat(Object.keys(lib).map(s => this._frameDisplayPreset(s) || lib[s]))
      .concat(this._config.frame_presets || []);
=======
    // Local presets + shared-library presets both render editor blocks now, so
    // paint swatches for both.
    const lib = frameLibraryMap(this._config.frame_library_scope);
    const allPresets = (this._config.frame_presets || []).concat(Object.keys(lib).map(s => lib[s]));
>>>>>>> d65989548fdbf203a804606d75440bca7a95012c
    allPresets.forEach(fx => {
      const el = this.querySelector(`[data-fx-preview="${fx.id}"]`);
      if (!el) return;
      const parts = [];
      if (fx.glow) {
        const g = fx.glow, blur = 12 * (g.intensity || 1), spread = -4 * (g.intensity || 1);
        parts.push(`0 0 ${blur}px ${spread}px ${g.color}`);
      }
      if (fx.shadow) {
        const s = fx.shadow;
        parts.push(`${s.x || 0}px ${s.y ?? 4}px ${s.blur ?? 12}px ${s.spread || 0}px ${s.color}`);
      }
      el.style.boxShadow = parts.join(', ') || 'none';
      if (fx.border) {
        const bc = fx.border.follow_icon ? iconColor : fx.border.color;
        const on = s => (fx.border.sides || ['top', 'bottom', 'left', 'right']).includes(s);
        el.style.borderTop = on('top') ? `${fx.border.width}px solid ${bc}` : 'none';
        el.style.borderBottom = on('bottom') ? `${fx.border.width}px solid ${bc}` : 'none';
        el.style.borderLeft = on('left') ? `${fx.border.width}px solid ${bc}` : 'none';
        el.style.borderRight = on('right') ? `${fx.border.width}px solid ${bc}` : 'none';
        const cn = Array.isArray(fx.border.corners) && fx.border.corners.length === 4 ? fx.border.corners : [true, true, true, true];
        const r = fx.border.radius;
        el.style.borderRadius = `${cn[0] ? r : 0}px ${cn[1] ? r : 0}px ${cn[2] ? r : 0}px ${cn[3] ? r : 0}px`;
      } else { el.style.border = 'none'; }
      // Background preview: custom color, explicit transparent, or theme
      // (fall back to the editor's own surface so the swatch stays legible).
      if (fx.background) {
        const bm = fx.background.mode || 'custom';
        el.style.backgroundColor = bm === 'transparent' ? 'transparent'
          : bm === 'theme' ? 'var(--secondary-background-color, #1c1c1c)'
          : (fx.background.color || '#1a1a1a');
      } else {
        el.style.backgroundColor = '#1a1a1a';
      }
<<<<<<< HEAD
      const edgeMatch = (fx.border && !fx.border.follow_icon && fx.border.color) ? fx.border.color : iconColor;
      const edge = fx.edges ? buildEdgeBackground(fx.edges, edgeMatch) : null;
=======
      const edge = fx.edges ? buildEdgeBackground(fx.edges) : null;
>>>>>>> d65989548fdbf203a804606d75440bca7a95012c
      if (edge) {
        el.style.backgroundImage = edge.image; el.style.backgroundSize = edge.size;
        el.style.backgroundPosition = edge.position; el.style.backgroundRepeat = edge.repeat;
      } else { el.style.backgroundImage = ''; }
    });
  }

  // Editor card for one standalone Divider section. Compact: line style, size,
  // justify, gradient toggle, and optional label/icon with placement. Uses
  // data-div-sid on inputs; wired by _wireDividerSections().
  _edDividerSection(section, idx, total) {
    const sid = section.id;
    const g = section.gradient === true;
    const sel = (v, opts) => opts.map(([val, lbl]) => `<option value="${val}" ${v === val ? 'selected' : ''}>${lbl}</option>`).join('');
    return `
      <details class="seed-ed-section seed-ed-divider-editor${section.hidden ? ' seed-ed-section-hidden' : ''}" data-section-id="${sid}">
        <summary>
          <span class="seed-ed-section-head">
            <ha-icon icon="mdi:minus"></ha-icon>
            <span style="flex:1;">${section.label ? escapeHtml(section.label) : 'Divider'}</span>
            <span class="seed-ed-section-type-badge">Divider</span>
            <ha-icon class="seed-ed-icon-btn ed-move-up ${idx === 0 ? 'disabled' : ''}" icon="mdi:arrow-up-bold" data-section-id="${sid}"></ha-icon>
            <ha-icon class="seed-ed-icon-btn ed-move-down ${idx === total - 1 ? 'disabled' : ''}" icon="mdi:arrow-down-bold" data-section-id="${sid}"></ha-icon>
            <ha-icon class="seed-ed-icon-btn ed-duplicate-section" icon="mdi:content-copy" data-section-id="${sid}" title="Duplicate this divider"></ha-icon>
            <ha-icon class="seed-ed-icon-btn ed-hide-section" icon="${section.hidden ? 'mdi:eye-off' : 'mdi:eye'}" data-section-id="${sid}" title="${section.hidden ? 'Hidden — click to show on card' : 'Shown — click to hide from card'}"></ha-icon>
            <ha-icon class="seed-ed-icon-btn ed-remove-section" icon="mdi:trash-can-outline" data-section-id="${sid}"></ha-icon>
          </span>
        </summary>
        <div class="seed-ed-section-body">
          <div class="seed-ed-hint">Live preview:</div>
          <div class="ed-div-preview" data-div-sid="${sid}" style="border:1px dashed #444; border-radius:4px; margin-bottom:8px;">${dividerLineHtml(section, { scale: this._config.scale || 1.0, divider_color: this._edColors().section_divider })}</div>

          <div class="seed-ed-font-row" style="gap:16px;flex-wrap:wrap;">
            <label><input type="checkbox" class="ed-div-check" data-div-sid="${sid}" data-div-key="hide_line" ${section.hide_line ? '' : 'checked'} data-invert="1"/> Show Line</label>
            <label><input type="checkbox" class="ed-div-check" data-div-sid="${sid}" data-div-key="hide_text" ${section.hide_text ? '' : 'checked'} data-invert="1"/> Show Text</label>
            <label><input type="checkbox" class="ed-div-check" data-div-sid="${sid}" data-div-key="hide_icon" ${section.hide_icon ? '' : 'checked'} data-invert="1"/> Show Icon</label>
          </div>

          ${this._edDivSub(sid, 'Line', `
            <div class="seed-ed-font-row">
              <label>Line style<select class="ed-div-input" data-div-sid="${sid}" data-div-key="line_style" ${g ? 'disabled' : ''}>${sel(section.line_style || 'solid', [['solid','Solid'],['dashed','Dashed'],['dotted','Dotted']])}</select></label>
              <label>Line position<select class="ed-div-input" data-div-sid="${sid}" data-div-key="justify">${sel(section.justify || 'center', [['left','Left'],['center','Center'],['right','Right']])}</select></label>
            </div>
            ${this._edDivSlider(sid, 'thickness', 'Thickness (px)', section.thickness ?? 1, 1, 12, 1)}
            ${this._edDivSlider(sid, 'length', 'Length (%)', section.length ?? 100, 5, 100, 5)}
            <div class="seed-ed-checkbox-row">
              <input type="checkbox" class="ed-div-check" data-div-sid="${sid}" data-div-key="gradient" ${g ? 'checked' : ''} />
              <label>Gradient line</label>
            </div>
            ${g ? `<span class="seed-ed-hint">Color stops left → right — position (0–100%) + color, <b>Transparent</b> (fade), or <b>Theme</b> (theme divider color). Gradient uses a solid line (dashed/dotted disabled). Needs ≥ 2 stops.</span>
            <div class="seed-ed-font-row">
              <label>Pattern<select class="ed-div-gpattern" data-div-sid="${sid}">
                <option value="" ${section.gradient_pattern == null ? 'selected' : ''}>Custom…</option>
                ${DIVIDER_GRADIENT_PATTERNS.map((p, pi) => `<option value="${pi}" ${String(section.gradient_pattern) === String(pi) ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
              </select></label>
            </div>
            <div class="ed-div-stops">${(Array.isArray(section.stops) ? section.stops : []).map((st, i) => {
              const isT = st.color === 'transparent', isTheme = st.color === 'theme';
              const posV = clamp(Number(st.pos) || 0, 0, 100);
              return `<div class="seed-ed-rule ed-div-stop-row">
                <input type="range" class="ed-div-stop-pos" data-div-sid="${sid}" data-idx="${i}" min="0" max="100" step="1" value="${posV}" style="flex:1;" /><span class="seed-ed-hint ed-div-stop-pos-val">${posV}%</span>
                <input type="color" class="ed-div-stop-color" data-div-sid="${sid}" data-idx="${i}" value="${/^#[0-9a-f]{6}$/i.test(st.color || '') ? st.color : '#2196F3'}" ${(isT || isTheme) ? 'disabled' : ''} style="width:44px;" />
                <select class="ed-div-stop-mode" data-div-sid="${sid}" data-idx="${i}" title="Stop color source">
                  <option value="color" ${(!isT && !isTheme) ? 'selected' : ''}>Color</option>
                  <option value="theme" ${isTheme ? 'selected' : ''}>Theme</option>
                  <option value="transparent" ${isT ? 'selected' : ''}>Transp.</option>
                </select>
                <ha-icon class="seed-ed-icon-btn ed-div-stop-remove" icon="mdi:close" data-div-sid="${sid}" data-idx="${i}" title="Remove stop"></ha-icon>
              </div>`;
            }).join('') || '<span class="seed-ed-hint">No stops yet. Pick a Pattern above, or Add a stop.</span>'}</div>
            <div class="seed-ed-add-btn seed-ed-add-btn-sm ed-div-stop-add" data-div-sid="${sid}"><ha-icon icon="mdi:plus"></ha-icon>Add color stop</div>
            ${((section.content_justify || section.justify || 'center') === 'center' && (section.text_position || 'on') === 'on' && !section.hide_line && (section.label || section.icon)) ? `<div class="seed-ed-checkbox-row"><label><input type="checkbox" class="ed-div-check" data-div-sid="${sid}" data-div-key="mirror_center" ${section.mirror_center ? 'checked' : ''}/> Mirror gradient around center</label></div>` : ''}
            `
            : `<div class="seed-ed-colors"><div class="seed-ed-color"><label>Color:</label>
              <input type="color" class="ed-div-input" data-div-sid="${sid}" data-div-key="color" value="${/^#/.test(section.color || '') ? section.color : '#333333'}" /></div></div>`}
          `)}

          ${this._edDivSub(sid, 'Text', `
            <div class="seed-ed-slider-row"><label><span>Label:</span></label>
              <input type="text" class="ed-div-input" data-div-sid="${sid}" data-div-key="label" value="${escapeHtml(section.label || '')}" placeholder="e.g. Active" style="flex:1;" /></div>
            <div class="seed-ed-font-row">
              <label>Text position<select class="ed-div-input" data-div-sid="${sid}" data-div-key="text_position">${sel(section.text_position || 'on', [['above','Above line'],['on','On line'],['below','Below line']])}</select></label>
              <label>Content align<select class="ed-div-input" data-div-sid="${sid}" data-div-key="content_justify">${sel(section.content_justify || section.justify || 'center', [['left','Left'],['center','Center'],['right','Right']])}</select></label>
            </div>
            ${this._edDivSlider(sid, 'indent', 'Indent (px)', section.indent ?? 0, 0, 200, 4)}
            ${this._edDivSlider(sid, 'text_size', 'Text size (px)', section.text_size ?? 13, 8, 40, 1)}
            <div class="seed-ed-font-row">
              <label>Text weight<select class="ed-div-input" data-div-sid="${sid}" data-div-key="text_weight">${sel(String(section.text_weight || '600'), [['300','300'],['400','400'],['500','500'],['600','600'],['700','700']])}</select></label>
              ${(() => { const tm = section.text_color_mode || (section.text_color ? 'fixed' : 'line'); return `<label>Text color<select class="ed-div-input at-structural" data-div-sid="${sid}" data-div-key="text_color_mode">${sel(tm, [['line','Line color'],['theme','Theme'],['fixed','Custom']])}</select></label>`; })()}
            </div>
            ${(section.text_color_mode || (section.text_color ? 'fixed' : 'line')) === 'fixed' ? `<div class="seed-ed-colors"><div class="seed-ed-color"><label>Text color:</label><input type="color" class="ed-div-input" data-div-sid="${sid}" data-div-key="text_color" value="${/^#[0-9a-f]{6}$/i.test(section.text_color || '') ? section.text_color : '#ffffff'}" /></div></div>` : ''}
            ${(section.text_color_mode || (section.text_color ? 'fixed' : 'line')) === 'line' && section.gradient ? `<span class="seed-ed-hint">A gradient line has no single color — "Line color" uses the first solid gradient stop. For an exact color, choose <b>Custom</b>.</span>` : ''}
          `)}

          ${this._edDivSub(sid, 'Icon', `
            <div class="seed-ed-slider-row"><label><span>Icon:</span></label>
              <input type="text" class="ed-div-input" data-div-sid="${sid}" data-div-key="icon" value="${escapeHtml(section.icon || '')}" placeholder="mdi:...  " style="flex:1;" />${section.icon ? `<ha-icon icon="${escapeHtml(normalizeIcon(section.icon))}" style="margin-left:6px;"></ha-icon>` : ''}</div>
            ${this._edDivSlider(sid, 'icon_size', 'Icon size (px)', section.icon_size ?? 0, 0, 48, 1, 'auto')}
            ${(() => { const im = section.icon_color_mode || (section.icon_color ? 'fixed' : 'text'); return `
            <div class="seed-ed-font-row">
              <label>Icon color<select class="ed-div-input at-structural" data-div-sid="${sid}" data-div-key="icon_color_mode">${sel(im, [['text','Match text'],['theme','Theme'],['fixed','Custom']])}</select></label>
            </div>
            ${im === 'fixed' ? `<div class="seed-ed-colors"><div class="seed-ed-color"><label>Icon color:</label><input type="color" class="ed-div-input" data-div-sid="${sid}" data-div-key="icon_color" value="${/^#[0-9a-f]{6}$/i.test(section.icon_color || '') ? section.icon_color : '#ffffff'}" /></div></div>` : ''}`; })()}
          `)}
        </div>
      </details>`;
  }

  // A collapsible Line/Text/Icon sub-panel inside a divider editor — mirrors the
  // Color card's _subpanel: an accent header + chevron, body renders only when
  // open. Uses the existing seed-ed-substyle details (open state auto-preserved
  // via _openSubPanels), so no new state is needed.
  _edDivSub(sid, label, bodyHtml) {
    // Flat 'flush' subpanel (top-divider separator, no bordered box) — matches
    // the subpanel style used everywhere else in the editor (_edCardSub, section
    // panels). Open state still persists via _openSubPanels (keyed by data-panel).
    return `
      <details class="seed-ed-substyle seed-ed-substyle-flush" data-panel="div-${label}">
        <summary class="seed-ed-substyle-sum">
          <span class="seed-ed-substyle-name" style="flex:1;">${label}</span>
        </summary>
        <div class="seed-ed-substyle-body">${bodyHtml}</div>
      </details>`;
  }
  // Collapsible sub-panel for the Card Appearance groups (Title, Section
  // Headers, Scaling, …) — same seed-ed-substyle pattern as the divider subs,
  // so open-state persists automatically via _openSubPanels (keyed by
  // data-panel). `key` must be stable/unique within the panel.
  _edCardSub(key, label, bodyHtml, opts) {
    const o = opts || {};
    const cls = o.frame ? ' seed-ed-substyle-frame' : '';
    // seed-ed-substyle-flush: borderless subpanel separated by a top divider
    // line (matches the Color card's Card Appearance subpanels — image 4),
    // instead of an individually-bordered box.
    return `
      <details class="seed-ed-substyle seed-ed-substyle-flush${cls}" data-panel="card-${key}">
        <summary class="seed-ed-substyle-sum">
          <span class="seed-ed-substyle-name" style="flex:1;">${label}</span>
        </summary>
        <div class="seed-ed-substyle-body">${bodyHtml}</div>
      </details>`;
  }
  _edDivSlider(sid, key, label, cur, min, max, step, zeroLabel) {
    const v = Number.isFinite(Number(cur)) ? Number(cur) : min;
    const unit = key === 'length' ? '%' : (/size|thickness|indent/.test(key) ? 'px' : '');
    const shown = (v === 0 && zeroLabel) ? zeroLabel : `${v}${unit}`;
    const zeroAttr = zeroLabel ? ` data-div-zero="${escapeHtml(zeroLabel)}"` : '';
    return `<div class="seed-ed-slider-row"><label><span>${label}:</span></label>
      <input type="range" class="ed-div-input" data-div-sid="${sid}" data-div-key="${key}"${zeroAttr} min="${min}" max="${max}" step="${step}" value="${v}" />
      <span class="seed-ed-slider-value ed-div-val" data-div-sid="${sid}" data-div-key="${key}">${shown}</span></div>`;
  }

  _atFramePresetsPanel() {
<<<<<<< HEAD
    // One unified list: the read-only Built-In fallback first, then the
    // System-wide (shared library) presets. There is no card-local frame
    // concept — every editable preset lives in the shared System library.
    // (Any legacy card-local presets from an older config still render for
    // read-compat, tagged "Local (legacy)", so old cards keep working.)
    const fxs = this._config.frame_presets || [];
    const lib = frameLibraryMap(this._config.frame_library_scope);
    const libSlugs = Object.keys(lib).sort();
    const builtinBlock = this._atFramePresetEditor(builtinFramePreset());
    // Show the DRAFT for any lib preset with unsaved edits so the editor reflects them.
    const libBlocks = libSlugs.map(slug => this._atFramePresetEditor(this._frameDisplayPreset(slug) || lib[slug])).join('');
    const legacyBlocks = fxs.map(fx => this._atFramePresetEditor(fx)).join('');
    const blocks = builtinBlock + libBlocks + legacyBlocks;
    return `
      <details class="seed-ed-sections-panel seed-ed-collapsible-panel" open>
        <summary class="seed-ed-panel-summary">
          <div class="seed-ed-sections-panel-title"><ha-icon icon="mdi:auto-fix" class="seed-ed-panel-title-icon"></ha-icon>Frame Styles</div>
=======
    // One unified list: this card's Local presets first, then the System-wide
    // (shared library) presets. Both render full editor blocks; the Local vs
    // System badge + icon show where each lives.
    const fxs = this._config.frame_presets || [];
    const lib = frameLibraryMap(this._config.frame_library_scope);
    const libSlugs = Object.keys(lib).sort();
    const localBlocks = fxs.map(fx => this._atFramePresetEditor(fx)).join('');
    const libBlocks = libSlugs.map(slug => this._atFramePresetEditor(lib[slug])).join('');
    const blocks = localBlocks + libBlocks;
    return `
      <details class="seed-ed-sections-panel seed-ed-collapsible-panel" open>
        <summary class="seed-ed-panel-summary">
          <div class="seed-ed-sections-panel-title"><ha-icon icon="mdi:auto-fix" class="seed-ed-panel-title-icon"></ha-icon>Frame Presets</div>
          <div class="seed-ed-hint">Named, reusable frame styles (border + glow + shadow + background + edge lines), optionally conditional. Each preset stores only what you set; presets layer onto a section or the card in order (last wins). <b>Local</b> presets live in this card; <b>System</b> presets live in a shared library and are editable from any card. This is the single place all frame styling is defined.</div>
>>>>>>> d65989548fdbf203a804606d75440bca7a95012c
        </summary>
        <span class="seed-ed-hint">Build, edit and store styles. To apply a Frame, use Card Appearance → Card Frame or per section in the section under Section Order.<br>Library items are shared system-wide. Built-In is read-only; duplicate to customize.</span>
        <div class="seed-ed-add-row">
          <div class="seed-ed-add-btn seed-ed-add-btn-sm" id="fx-add"><ha-icon icon="mdi:plus"></ha-icon>Add Frame Style</div>
          <div class="seed-ed-add-btn seed-ed-add-btn-sm" id="fx-import"><ha-icon icon="mdi:import"></ha-icon>Import from text</div>
        </div>
<<<<<<< HEAD
        ${blocks}
=======
        ${blocks || '<span class="seed-ed-hint">No frame presets yet. Add one, then apply it to a section or the card.</span>'}
>>>>>>> d65989548fdbf203a804606d75440bca7a95012c

        <div id="fx-portal" class="seed-ed-portal" style="display:none; margin-top:10px;">
          <div class="seed-ed-hint" id="fx-portal-label"></div>
          <textarea id="fx-portal-text" class="at-input" rows="7" style="width:100%; font-family:monospace; font-size:11px;" spellcheck="false"></textarea>
          <div class="seed-ed-add-row">
            <div class="seed-ed-add-btn seed-ed-add-btn-sm" id="fx-portal-primary"></div>
            <div class="seed-ed-add-btn seed-ed-add-btn-sm" id="fx-portal-close"><ha-icon icon="mdi:close"></ha-icon>Close</div>
          </div>
          <div class="seed-ed-hint" id="fx-portal-status"></div>
        </div>
      </details>`;
  }

  // Show the shared import/export textarea "portal" in one of two modes:
  //   'export' — read-only text + a Copy button
  //   'import' — editable text + an Import button
  // Kept self-contained so it can be driven by several buttons.
  _fxPortal(mode, text, label) {
    const portal = this.querySelector('#fx-portal');
    if (!portal) return;
    const ta = this.querySelector('#fx-portal-text');
    const primary = this.querySelector('#fx-portal-primary');
    const lbl = this.querySelector('#fx-portal-label');
    const status = this.querySelector('#fx-portal-status');
    if (status) status.textContent = '';
    if (lbl) lbl.textContent = label || '';
    if (ta) { ta.value = text || ''; ta.readOnly = (mode === 'export'); ta.style.display = ''; }
    if (primary) {
      primary.style.display = '';
      primary.dataset.mode = mode;
      primary.innerHTML = mode === 'export'
        ? '<ha-icon icon="mdi:content-copy"></ha-icon>Copy'
        : '<ha-icon icon="mdi:import"></ha-icon>Import';
    }
    portal.style.display = '';
    if (mode === 'import' && ta) { try { ta.focus(); } catch (e) {} }
  }

  // Row-visuals controls (indent + row borders). Shared by the group-section
  // "Entity Rows" panel and the table-section "Row Layout" panel — both edit
  // the same section.row_* keys via the same handler classes.
  _rowVisualsControls(section, colors) {
    return `
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
      </div>`;
  }

  // Frame reference editor: the "apply frame presets here" control used by both
  // a section and the card wrapper. sid identifies the scope for listeners
  // ('__card_frame__' for the card, else the section id). `fr` is the current
  // frame ref (may be null). Shows: Default preset dropdown, Apply-Defaults-
  // prior toggle, and an ordered add/remove list of applied presets.
  _atFrameRefEditor(sid, fr) {
    fr = fr || { presets: [] };
    const lib = frameLibraryMap(this._config.frame_library_scope);
    const libSlugs = Object.keys(lib).sort();
    const legacyLocal = this._config.frame_presets || [];
    const opts = (sel, placeholder) => {
      let html = `<option value="" ${!sel ? 'selected' : ''}>${escapeHtml(placeholder || '— none —')}</option>`;
      // Built-In fallback always available.
      html += `<option value="${BUILTIN_FRAME_ID}" ${sel === BUILTIN_FRAME_ID ? 'selected' : ''}>Built-In</option>`;
      if (libSlugs.length) {
        html += `<optgroup label="System Presets">` +
          libSlugs.map(slug => `<option value="lib:${escapeHtml(slug)}" ${sel === 'lib:' + slug ? 'selected' : ''}>${escapeHtml(lib[slug].name || slug)}</option>`).join('') +
          `</optgroup>`;
      }
      if (legacyLocal.length) {
        html += `<optgroup label="Local (legacy)">` +
          legacyLocal.map(fx => `<option value="${fx.id}" ${sel === fx.id ? 'selected' : ''}>${escapeHtml(fx.name)}</option>`).join('') +
          `</optgroup>`;
      }
      return html;
    };
    const nameOf = id => {
      if (id === BUILTIN_FRAME_ID) return 'Built-In';
      if (typeof id === 'string' && id.startsWith('lib:')) {
        const slug = id.slice(4); const p = lib[slug];
        return (p ? (p.name || slug) : slug) + ' (System)';
      }
      const p = legacyLocal.find(f => f.id === id);
      return p ? p.name + ' (legacy)' : id;
    };
    const disabledSet = new Set(fr.disabled || []);
    const ignoreSet = new Set(fr.ignore_conditions || []);
    const byId = this._framePresetsById ? this._framePresetsById() : {};
    // Does this preset carry a condition? (when/when_entity or a section-membership kind)
    const hasCond = id => { const p = byId[id]; return !!(p && (p.when_kind || (p.when && p.when_entity))); };
    const applied = (fr.presets || []).map((id, i) => {
      const off = disabledSet.has(id);
      const cond = hasCond(id);
      return `
      <div class="seed-ed-rule" style="${off ? 'opacity:0.5;' : ''}">
        <ha-icon class="seed-ed-icon-btn fr-move" data-fr-sid="${sid}" data-fr-idx="${i}" data-fr-dir="-1" icon="mdi:arrow-up-bold" title="Move up"></ha-icon>
        <ha-icon class="seed-ed-icon-btn fr-move" data-fr-sid="${sid}" data-fr-idx="${i}" data-fr-dir="1" icon="mdi:arrow-down-bold" title="Move down"></ha-icon>
        <span style="flex:1;">${escapeHtml(nameOf(id))}${off ? ' <span class="seed-ed-hint">(disabled)</span>' : ''}${cond ? ' <span class="seed-ed-hint" title="Conditional style">◈</span>' : ''}</span>
        ${cond ? `<label class="seed-ed-hint" style="display:inline-flex;align-items:center;gap:3px;cursor:pointer;" title="Apply this layer even when its condition is false"><input type="checkbox" class="fr-ignore" data-fr-sid="${sid}" data-fr-id="${escapeHtml(id)}" ${ignoreSet.has(id) ? 'checked' : ''} />ignore cond.</label>` : ''}
        <ha-icon class="seed-ed-icon-btn fr-toggle" data-fr-sid="${sid}" data-fr-id="${escapeHtml(id)}" icon="${off ? 'mdi:eye-off-outline' : 'mdi:eye-outline'}" title="${off ? 'Disabled — click to enable' : 'Enabled — click to disable (preview without it)'}"></ha-icon>
        <ha-icon class="seed-ed-icon-btn fr-remove" data-fr-sid="${sid}" data-fr-idx="${i}" icon="mdi:close" title="Remove"></ha-icon>
      </div>`;
    }).join('');
    return `
      <div class="seed-ed-group-div" style="margin:4px 0 4px;">Applied presets (layered in order — last wins)</div>
      <div class="seed-ed-rules">${applied || '<span class="seed-ed-hint">None yet. Choose a preset below and Add it.</span>'}</div>
      <div class="seed-ed-group-div" style="margin:8px 0 4px; font-weight:400; color:#999;">Add a preset to this ${sid === '__card_frame__' ? 'card' : 'section'}</div>
      <div class="seed-ed-font-row">
        <div class="seed-ed-add-btn seed-ed-add-btn-sm fr-add" data-fr-sid="${sid}"><ha-icon icon="mdi:plus"></ha-icon>Add</div>
        <select class="fr-add-pick" data-fr-sid="${sid}" style="flex:1;">${opts('', 'Choose Preset to Apply')}</select>
      </div>`;
  }

  // ------- Per-section membership: assign rule sets (Static/Dynamic) -------
  // Replaces the old manual entity picker. Shows each assigned set (with its
  // mode + live resolved count), an unassign button, and an "add" row with a
  // set dropdown, a Preview box, and Assign Static / Assign Dynamic buttons.
  _friendly(id) {
    const st = this._hass ? this._hass.states[id] : null;
    return st ? (st.attributes.friendly_name || id) : id;
  }

  // Confirmation gate for destructive editor actions. Returns true to proceed.
  // Wrapped in try/catch so a headless/blocked confirm() never hard-blocks.
  _confirmDelete(message) {
    try { return window.confirm(message); } catch (e) { return true; }
  }

  // Direct entity picker for an entity-group section: a search box + a
  // scrollable candidate list (client-filtered, no re-render → keeps focus) with
  // add buttons, plus the assigned-entity chips. Writes section.entities via the
  // existing ed-section-entity-* handlers. This is the primary way to pick a
  // section's entities; rule-set membership (below) is the filter-based option.
  // "Currently Selected" — just the section's assigned-entity chips (what it
  // shows right now). assignedChipsHtml is built by the caller.
  _sectionSelectedChipsHtml(section, assignedChipsHtml) {
    return `<div class="seed-ed-strip-tags">${assignedChipsHtml}</div>`;
  }

  // The searchable individual-entity picker (search box + candidate list + add
  // buttons + add-all/clear). Writes section.entities via ed-sec-* handlers.
  _sectionEntitySearchHtml(section, pickerOptions) {
    const sid = section.id;
    const nameOnly = (opt) => {
      const l = opt.label || opt.value;
      return l.replace(/\s*\([^)]*\)\s*$/, '') || opt.value;
    };
    const rows = (pickerOptions || []).map(opt => {
      const nm = nameOnly(opt);
      return `<div class="seed-ed-ent-row ed-sec-cand" data-section-id="${sid}" data-entity-id="${opt.value}" data-search="${escapeHtml((opt.value + ' ' + nm).toLowerCase())}">
        <span class="seed-ed-ent-name">${escapeHtml(nm)}</span>
        <span class="seed-ed-ent-id">${escapeHtml(opt.value)}</span>
        <button class="seed-ed-ent-add ed-sec-cand-add" data-section-id="${sid}" data-entity-id="${opt.value}" title="Add">+</button>
      </div>`;
    }).join('') || '<span class="seed-ed-hint">No more entities match the card filter.</span>';
    return `
      <div class="seed-ed-group-div" style="margin:2px 0 6px;">Add individual entities</div>
      <input type="text" class="seed-ed-search ed-sec-entity-search" data-section-id="${sid}" placeholder="Search entities to add…" />
      <div class="seed-ed-entity-list ed-sec-cand-list" data-section-id="${sid}">${rows}</div>
      <div class="seed-ed-select-allnone">
        <span class="ed-section-select-all" data-section-id="${sid}">Add all shown</span>
        <span class="seed-ed-allnone-sep">·</span>
        <span class="ed-section-select-none" data-section-id="${sid}">Clear all</span>
      </div>`;
  }

  _atMembershipPanel(section) {
    const sid = section.id;
    const sets = this._config.rule_sets || [];
    const setsById = {}; sets.forEach(s => setsById[s.id] = s);
    const refs = Array.isArray(section.rule_sets) ? section.rule_sets : [];

    // Assigned rule sets: name, mode toggle, live count, unassign.
    const assigned = refs.map((r, i) => {
      const rs = setsById[r.ref];
      const name = rs ? rs.name : `(missing: ${r.ref})`;
      let count = 0;
      if (rs && this._hass) {
        count = r.mode === 'static'
          ? ((section.static_entities && section.static_entities[r.ref]) || []).length
          : evalRuleSetMembers(rs, this._hass).length;
      }
      return `
        <div class="seed-ed-rule">
          <span class="seed-ed-substyle-name" style="flex:1;">${escapeHtml(name)}</span>
          <select class="ms-mode at-input" data-at-sid="${sid}" data-ms-idx="${i}">
            <option value="dynamic" ${r.mode !== 'static' ? 'selected' : ''}>Dynamic (live)</option>
            <option value="static" ${r.mode === 'static' ? 'selected' : ''}>Static (frozen)</option>
          </select>
          <span class="seed-ed-hint">${count} entities</span>
          <ha-icon class="seed-ed-icon-btn ms-unassign" icon="mdi:close" data-at-sid="${sid}" data-ms-ref="${r.ref}" title="Unassign (removes its entities)"></ha-icon>
        </div>`;
    }).join('') || '<span class="seed-ed-hint">No rule sets assigned. Add one below to choose which entities this section shows.</span>';

    // Add-a-set row: dropdown + live preview + Assign buttons. The selected set
    // for preview is held in transient editor state (not saved to config).
    const previewId = (this._msPreview && this._msPreview[sid]) || (sets[0] && sets[0].id) || '';
    const previewSet = setsById[previewId];
    const previewIds = (previewSet && this._hass) ? evalRuleSetMembers(previewSet, this._hass) : [];
    const previewRows = previewIds.slice(0, 60).map(id => `<div class="ms-prev-row">${escapeHtml(this._friendly(id))} <span class="seed-ed-hint">${escapeHtml(id)}</span></div>`).join('')
      || '<span class="seed-ed-hint">No entities match this set.</span>';
    const options = sets.length
      ? sets.map(s => `<option value="${s.id}" ${s.id === previewId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')
      : '<option value="">(no rule sets — create one above)</option>';

    // Filter-rules membership only (assigned sets + assign row + preview). The
    // Name Cleaner is now a separate group (_atNameCleanerHtml).
    return `
        <div class="seed-ed-group-div" style="margin:2px 0 6px;">Assigned filter rules</div>
        <div class="seed-ed-rules">${assigned}</div>
        <div class="seed-ed-group-div" style="margin:10px 0 6px; font-weight:400; color:#999;">Assign a rule set</div>
        <div class="seed-ed-font-row">
          <select class="ms-preview-pick at-input" data-at-sid="${sid}" style="flex:1;">${options}</select>
        </div>
        <details class="seed-ed-substyle ms-preview" data-panel="mspreview-${sid}">
          <summary class="seed-ed-substyle-sum">
            <ha-icon icon="mdi:eye-outline" class="seed-ed-rs-sum-icon"></ha-icon>
            <span class="seed-ed-substyle-name">Preview</span>
            <span class="seed-ed-hint" style="flex:1;">${previewIds.length} entit${previewIds.length === 1 ? 'y' : 'ies'}${previewIds.length > 60 ? ' (first 60)' : ''}</span>
          </summary>
          <div class="seed-ed-substyle-body">
            <div class="ms-preview-list">${previewRows}</div>
          </div>
        </details>
        <div class="seed-ed-add-row">
          <div class="seed-ed-add-btn seed-ed-add-btn-sm ms-assign" data-at-sid="${sid}" data-ms-mode="dynamic"><ha-icon icon="mdi:plus"></ha-icon>Assign Dynamic</div>
          <div class="seed-ed-add-btn seed-ed-add-btn-sm ms-assign" data-at-sid="${sid}" data-ms-mode="static"><ha-icon icon="mdi:plus"></ha-icon>Assign Static</div>
        </div>`;
  }

  // Entity Name Cleaner (per-section strip strings). Its own group now.
  _atNameCleanerHtml(section) {
    const sid = section.id;
    return `
        <div class="seed-ed-group-div" style="margin:2px 0 6px;">Entity Name Cleaner</div>
        <span class="seed-ed-hint">Strip these substrings from this section's names (added on top of the card-global list).</span>
        <input type="text" class="at-input at-input-multi" data-at-sid="${sid}" data-at-path="strip_strings" value="${escapeHtml((section.strip_strings || []).join(', '))}" placeholder=" Light,  Sensor,  Shade" style="width:100%;" />`;
  }

  // A ValueRef editor (source + attribute + transform + unit). When source is
  // 'related', shows the paired-entity match spec and recurses for the value
  // read from the sibling.
  _atValueRefEditor(sid, path, ref) {
    ref = ref || {};
    let extra = '';
    if (ref.source === 'attribute') {
      extra = `<input type="text" class="at-input" data-at-sid="${sid}" data-at-path="${path}.attribute" value="${escapeHtml(ref.attribute || '')}" placeholder="attribute name" />`;
    } else if (ref.source === 'field') {
      extra = `<input type="text" class="at-input" data-at-sid="${sid}" data-at-path="${path}.field" value="${escapeHtml(ref.field || '')}" placeholder="array field (e.g. mode)" />`;
    } else if (ref.source === 'related') {
      const rel = ref.related || {};
      extra = `
        <label>Pair by:
          <select class="at-input at-structural" data-at-sid="${sid}" data-at-path="${path}.related.match">${this._atOpts(this._AT_RELATED_MATCH, rel.match || 'device')}</select>
        </label>
        ${rel.match === 'name_replace'
          ? `<input type="text" class="at-input" data-at-sid="${sid}" data-at-path="${path}.related.find" value="${escapeHtml(rel.find || '')}" placeholder="find (e.g. _temperature)" style="width:120px;" />
             <input type="text" class="at-input" data-at-sid="${sid}" data-at-path="${path}.related.replace" value="${escapeHtml(rel.replace || '')}" placeholder="replace (e.g. _humidity)" style="width:120px;" />`
          : `<input type="text" class="at-input" data-at-sid="${sid}" data-at-path="${path}.related.device_class" value="${escapeHtml(rel.device_class || '')}" placeholder="sibling device_class" style="width:150px;" />`}`;
    }
    const relatedValue = ref.source === 'related'
      ? `<div style="margin-left:16px; border-left:2px solid rgba(255,255,255,0.1); padding-left:8px;">
           <span class="seed-ed-hint">Read from the paired entity:</span>
           ${this._atValueRefEditor(sid, `${path}.related.value`, (ref.related || {}).value)}
         </div>`
      : '';
    return `
      <div class="seed-ed-font-row">
        <label>Value:
          <select class="at-input at-structural" data-at-sid="${sid}" data-at-path="${path}.source">${this._atOpts(this._AT_VALUE_SOURCES, ref.source || 'state')}</select>
        </label>
        ${extra}
        <label>Transform:
          <select class="at-input" data-at-sid="${sid}" data-at-path="${path}.transform">${this._atOpts(this._AT_TRANSFORMS, ref.transform || 'none')}</select>
        </label>
        <input type="text" class="at-input" data-at-sid="${sid}" data-at-path="${path}.unit" value="${escapeHtml(ref.unit || '')}" placeholder="unit" style="width:60px;" />
      </div>
      ${relatedValue}`;
  }

  // What a rule condition tests: the column/state value, or time-since-change.
  // (Value refs are stored inline; these two cover the common cases and keep
  // the picker simple. Time is in seconds; a helper below offers min presets.)
  _AT_COND_WHAT = [
    ['state', 'State / value'],
    ['last_changed_ago', 'Time since change (sec)']
  ];

  // One condition row inside a rule. `cpath` points at the condition object
  // (e.g. "...rules.0.when.all.1"). `listPath`/`idx` let it be removed when the
  // rule has more than one condition.
  _atCondRow(sid, cpath, cond, listPath, idx, removable) {
    cond = cond || {};
    const what = (cond.ref && cond.ref.source === 'last_changed_ago') ? 'last_changed_ago' : 'state';
    const del = removable
      ? `<ha-icon class="seed-ed-icon-btn at-del" icon="mdi:close" data-at-sid="${sid}" data-at-list="${listPath}" data-at-idx="${idx}" title="Remove condition"></ha-icon>`
      : '';
    return `
      <div class="seed-ed-rule seed-ed-cond-row">
        <select class="at-input at-structural at-cond-what" data-at-sid="${sid}" data-at-path="${cpath}" data-at-what="${what}">${this._atOpts(this._AT_COND_WHAT, what)}</select>
        <select class="at-input" data-at-sid="${sid}" data-at-path="${cpath}.op">${this._atOpts(this._AT_OPS, cond.op)}</select>
        <input type="text" class="at-input" data-at-sid="${sid}" data-at-path="${cpath}.value" value="${escapeHtml(cond.value ?? '')}" placeholder="${what === 'last_changed_ago' ? 'sec (e.g. 600)' : 'value'}" style="width:90px;" />
        ${del}
      </div>`;
  }

  // Render a rule's `when` as one or more AND/OR-ed condition rows. A plain
  // single condition is shown as one row; compound (all/any) shows each
  // sub-condition plus an AND/OR toggle. Always allows adding a condition.
  _atRuleWhenEditor(sid, whenPath, when) {
    when = when || { op: 'is_on' };
    // Determine the compound kind + the array of sub-conditions.
    let kind = null, conds;
    if (Array.isArray(when.all)) { kind = 'all'; conds = when.all; }
    else if (Array.isArray(when.any)) { kind = 'any'; conds = when.any; }
    else { conds = [when]; }

    const multi = conds.length > 1 || kind;
    // Path to each condition: single -> the when itself; compound -> when.<kind>.<i>
    const condPath = i => kind ? `${whenPath}.${kind}.${i}` : whenPath;
    const listPath = kind ? `${whenPath}.${kind}` : null;

    const rows = conds.map((c, i) => this._atCondRow(sid, condPath(i), c, listPath, i, multi)).join('');

    const kindToggle = multi
      ? `<select class="at-input at-cond-kind" data-at-sid="${sid}" data-at-path="${whenPath}" data-at-kind="${kind || 'all'}" title="How the conditions combine">
           <option value="all" ${(kind || 'all') === 'all' ? 'selected' : ''}>match ALL (and)</option>
           <option value="any" ${kind === 'any' ? 'selected' : ''}>match ANY (or)</option>
         </select>`
      : '';

    return `
      <div class="seed-ed-when">
        <div class="seed-ed-when-head">
          <span class="seed-ed-hint">if</span>
          ${kindToggle}
          <span class="seed-ed-add-btn seed-ed-add-btn-xs at-cond-add" data-at-sid="${sid}" data-at-when="${whenPath}" title="Add a condition (AND)"><ha-icon icon="mdi:plus"></ha-icon>condition</span>
        </div>
        ${rows}
      </div>`;
  }

  // A RuleSet editor: ordered rule rows (each: when-editor -> result) + default.
  // resultType is 'color' (color input) or 'text' (icon/other string).
  _atRuleSetEditor(sid, path, ruleset, resultType, label) {
    ruleset = ruleset || { rules: [], default: '' };
    const resultInput = (p, val) => resultType === 'color'
      ? `<input type="color" class="at-input" data-at-sid="${sid}" data-at-path="${p}" value="${/^#/.test(val) ? val : '#888888'}" />`
      : `<input type="text" class="at-input" data-at-sid="${sid}" data-at-path="${p}" value="${escapeHtml(val ?? '')}" placeholder="result" style="width:120px;" />`;
    const rows = (ruleset.rules || []).map((r, i) => {
      return `<div class="seed-ed-ruleblock">
        ${this._atRuleWhenEditor(sid, `${path}.rules.${i}.when`, r.when)}
        <div class="seed-ed-rule seed-ed-rule-result">
          <span class="seed-ed-hint">→ show</span>
          ${resultInput(`${path}.rules.${i}.result`, r.result)}
          <ha-icon class="seed-ed-icon-btn at-del" icon="mdi:close" data-at-sid="${sid}" data-at-list="${path}.rules" data-at-idx="${i}" title="Remove rule"></ha-icon>
        </div>
      </div>`;
    }).join('');
    return `
      <div class="seed-ed-style-field-title">${label}</div>
      <div class="seed-ed-rules">${rows || '<span class="seed-ed-hint">No rules.</span>'}</div>
      <div class="seed-ed-font-row">
        <span class="seed-ed-hint">default →</span>
        ${resultInput(`${path}.default`, ruleset.default)}
        <div class="seed-ed-add-btn seed-ed-add-btn-sm at-add" data-at-sid="${sid}" data-at-list="${path}.rules" data-at-new="rule"><ha-icon icon="mdi:plus"></ha-icon>Add rule</div>
      </div>
      ${resultType === 'color' ? this._atGradientEditor(sid, path, ruleset.gradient) : ''}`;
  }

  // Color-gradient sub-editor: enable, then add value->color stops. The card
  // interpolates the color between the surrounding stops (clamped past the
  // ends). Discrete rules above still take precedence over the gradient.
  _atGradientEditor(sid, path, gradient) {
    const on = !!(gradient && Array.isArray(gradient.stops) && gradient.stops.length);
    const b = `${path}.gradient`;
    let body = `
      <div class="seed-ed-font-row">
        <label><input type="checkbox" class="at-check at-structural at-gradient-toggle" data-at-sid="${sid}" data-at-path="${b}" ${on ? 'checked' : ''}/> Color blend (gradient by value)</label>
      </div>`;
    if (on) {
      const stops = gradient.stops || [];
      const rows = stops.map((s, i) => `
        <div class="seed-ed-rule">
          <span class="seed-ed-hint">at</span>
          <input type="number" class="at-input" data-at-sid="${sid}" data-at-path="${b}.stops.${i}.value" value="${escapeHtml(String(s.value ?? ''))}" placeholder="value" style="width:80px;" />
          <span class="seed-ed-hint">→</span>
          <input type="color" class="at-input" data-at-sid="${sid}" data-at-path="${b}.stops.${i}.color" value="${/^#/.test(s.color || '') ? s.color : '#888888'}" />
          <ha-icon class="seed-ed-icon-btn at-del" icon="mdi:close" data-at-sid="${sid}" data-at-list="${b}.stops" data-at-idx="${i}" title="Remove stop"></ha-icon>
        </div>`).join('');
      body += `
        <span class="seed-ed-hint">Colors blend smoothly between stops (e.g. 10 → dark grey, 900 → yellow). Values below/above the ends clamp to the nearest stop.</span>
        <div class="seed-ed-rules">${rows || '<span class="seed-ed-hint">No stops yet.</span>'}</div>
        <div class="seed-ed-add-btn seed-ed-add-btn-sm at-add" data-at-sid="${sid}" data-at-list="${b}.stops" data-at-new="gradientstop"><ha-icon icon="mdi:plus"></ha-icon>Add color stop</div>`;
    }
    return body;
  }

  _AT_COL_KINDS = [['value', 'Value'], ['name', 'Name'], ['icon', 'Icon']];
  _AT_ALIGN = [['left', 'Left'], ['center', 'Center'], ['right', 'Right']];
  _AT_SI_SOURCES = [
    ['attribute', 'Attribute'], ['state', 'State'], ['area', 'Area'],
    ['last_changed_ago', 'Time since change'], ['last_changed_time', 'Change clock time'],
    ['entity_id', 'Entity ID'], ['integration', 'Integration']
  ];

  // Secondary-info sub-line editor for a name column (path base `columns.N`).
  // A descriptor line stacked under the name, e.g. "Zone 1" from an attribute.
  _atSecondaryEditor(sid, p, si) {
    const on = si.enabled === true;
    const src = si.source || 'attribute';
    const b = `${p}.secondary`;
    let body = `
      <div class="seed-ed-font-row">
        <label><input type="checkbox" class="at-check at-structural" data-at-sid="${sid}" data-at-path="${b}.enabled" ${on ? 'checked' : ''}/> Secondary info under name</label>
      </div>`;
    if (on) {
      body += `
        <div class="seed-ed-font-row">
          <label>Source:<select class="at-input at-structural" data-at-sid="${sid}" data-at-path="${b}.source">${this._atOpts(this._AT_SI_SOURCES, src)}</select></label>
          ${src === 'attribute' ? `<label>Attribute:<input type="text" class="at-input" data-at-sid="${sid}" data-at-path="${b}.attribute" value="${escapeHtml(si.attribute || '')}" placeholder="zone" style="width:110px;" /></label>` : ''}
        </div>
        <div class="seed-ed-font-row">
          <label>Prefix:<input type="text" class="at-input" data-at-sid="${sid}" data-at-path="${b}.prefix" value="${escapeHtml(si.prefix || '')}" placeholder="Zone " style="width:110px;" /></label>
          <label>Color<input type="color" class="at-input" data-at-sid="${sid}" data-at-path="${b}.color" value="${/^#/.test(si.color || '') ? si.color : '#808080'}" /></label>
        </div>
        ${this._atSlider(sid, `${b}.font_size`, 'Font size (px)', si.font_size ?? 12, 8, 28, 1)}
        ${this._atSlider(sid, `${b}.indent`, 'Indent (px)', si.indent ?? 0, 0, 64, 2, 'None')}
        <div class="seed-ed-font-row">
          <label>Weight<select class="at-input" data-at-sid="${sid}" data-at-path="${b}.font_weight">${this._atOpts([['400', 'Normal'], ['600', 'Semibold'], ['700', 'Bold']], si.font_weight || 400)}</select></label>
          <label><input type="checkbox" class="at-check" data-at-sid="${sid}" data-at-path="${b}.italic" ${si.italic ? 'checked' : ''}/> Italic</label>
        </div>`;
    }
    return `<div class="seed-ed-style-field-title">Secondary info</div>${body}`;
  }

  // Column width control: a mode picker (Auto / px / % / fr) plus a value input
  // for the chosen unit. Auto = 0 (the card's per-kind default). px shows a
  // slider; % / fr show a small number field. Flexible units scale with the
  // card for responsive layouts; px stays fixed.
  _atWidthControl(sid, p, w) {
    // Classify the current stored width.
    let mode = 'auto', numVal = 0;
    if (typeof w === 'number' && w > 0) { mode = 'px'; numVal = w; }
    else if (typeof w === 'string') {
      const s = w.trim().toLowerCase();
      if (/%$/.test(s)) { mode = 'pct'; numVal = parseFloat(s) || 20; }
      else if (/fr$/.test(s)) { mode = 'fr'; numVal = parseFloat(s) || 1; }
      else if (s && s !== 'auto') { mode = 'px'; numVal = parseFloat(s) || 0; }
    }
    const modeSel = `<label>Width<select class="at-input at-structural at-width-mode" data-at-sid="${sid}" data-at-path="${p}.width" data-at-width-mode="1">${this._atOpts([['auto', 'Auto'], ['px', 'Pixels'], ['pct', 'Percent %'], ['fr', 'Fraction fr']], mode)}</select></label>`;
    let valField = '';
    if (mode === 'px') {
      valField = this._atSlider(sid, `${p}.width`, 'px', numVal || 42, 0, 320, 2, 'Auto');
    } else if (mode === 'pct') {
      valField = `<label>% <input type="number" class="at-input at-width-val" data-at-sid="${sid}" data-at-path="${p}.width" data-at-width-unit="%" min="1" max="100" step="1" value="${numVal || 20}" style="width:70px;" /></label>`;
    } else if (mode === 'fr') {
      valField = `<label>fr <input type="number" class="at-input at-width-val" data-at-sid="${sid}" data-at-path="${p}.width" data-at-width-unit="fr" min="1" max="12" step="1" value="${numVal || 1}" style="width:70px;" /></label>`;
    }
    return `<div class="seed-ed-font-row">${modeSel}${valField}</div>`;
  }

  _atColumnEditor(sid, i, col) {
    const p = `columns.${i}`;
    const kind = col.kind || 'value';
    let body = `
      <div class="seed-ed-font-row">
        <label>Type:<select class="at-input at-structural" data-at-sid="${sid}" data-at-path="${p}.kind">${this._atOpts(this._AT_COL_KINDS, kind)}</select></label>
        <label>Cell align:<select class="at-input" data-at-sid="${sid}" data-at-path="${p}.align">${this._atOpts(this._AT_ALIGN, col.align)}</select></label>
      </div>
      <div class="seed-ed-font-row">
        <label><input type="checkbox" class="at-check" data-at-sid="${sid}" data-at-path="${p}.show_header" ${col.show_header !== false ? 'checked' : ''}/> Header</label>
        <input type="text" class="at-input" data-at-sid="${sid}" data-at-path="${p}.header" value="${escapeHtml(col.header || '')}" placeholder="header text" style="width:110px;" />
        <label>Align:<select class="at-input" data-at-sid="${sid}" data-at-path="${p}.header_align">${this._atOpts([['', 'Match cell'], ...this._AT_ALIGN], col.header_align || '')}</select></label>
        <input type="color" class="at-input" data-at-sid="${sid}" data-at-path="${p}.header_color" value="${/^#/.test(col.header_color || '') ? col.header_color : '#90ee90'}" title="Header color" />
      </div>
      ${this._atWidthControl(sid, p, col.width)}`;
    if (kind === 'value') {
      body += this._atValueRefEditor(sid, `${p}.value`, col.value);
      // When off / blank / unavailable, show this text (leave blank for nothing;
      // default em-dash if never set).
      const emptyVal = col.empty_text !== undefined ? col.empty_text : '—';
      body += `<div class="seed-ed-font-row">
        <label>When off / empty, show:</label>
        <input type="text" class="at-input" data-at-sid="${sid}" data-at-path="${p}.empty_text" value="${escapeHtml(emptyVal)}" placeholder="(blank = nothing)" style="width:120px;" />
      </div>`;
      body += this._atRuleSetEditor(sid, `${p}.color`, col.color, 'color', 'Color rules (by value)');
    } else if (kind === 'name') {
      body += this._atRuleSetEditor(sid, `${p}.color`, col.color, 'color', 'Name color rules');
      body += this._atSecondaryEditor(sid, p, col.secondary || {});
    } else if (kind === 'icon') {
      const ic = col.icon || {};
      body += `<div class="seed-ed-font-row">
        <label><input type="checkbox" class="at-check" data-at-sid="${sid}" data-at-path="${p}.icon.use_native_icon" ${ic.use_native_icon ? 'checked' : ''}/> Use entity's own icon</label>
      </div>
      <span class="seed-ed-hint">When on, the row shows each entity's native HA icon (rules below still override per state). You can also use the token <code>__default__</code> as any rule result or the default for the native icon.</span>`;
      body += this._atRuleSetEditor(sid, `${p}.icon`, { rules: ic.rules, default: ic.default }, 'text', 'Icon rules (mdi:… , __default__ = native, blank = hidden)');
      body += this._atRuleSetEditor(sid, `${p}.icon.color`, ic.color, 'color', 'Icon color rules');
      body += this._atSlider(sid, `${p}.icon.size`, 'Icon size (px)', ic.size ?? 14, 8, 40, 1);
    }
    return `
      <details class="seed-ed-substyle">
        <summary>Column ${i + 1}: ${escapeHtml(col.header || kind)} <span style="flex:1;"></span>
          <ha-icon class="seed-ed-icon-btn at-move" icon="mdi:arrow-up-bold" data-at-sid="${sid}" data-at-list="columns" data-at-idx="${i}" data-at-dir="-1"></ha-icon>
          <ha-icon class="seed-ed-icon-btn at-move" icon="mdi:arrow-down-bold" data-at-sid="${sid}" data-at-list="columns" data-at-idx="${i}" data-at-dir="1"></ha-icon>
          <ha-icon class="seed-ed-icon-btn at-del" icon="mdi:trash-can-outline" data-at-sid="${sid}" data-at-list="columns" data-at-idx="${i}"></ha-icon>
        </summary>
        <div class="seed-ed-substyle-body">${body}</div>
      </details>`;
  }

  _atColumnsPanel(sid, section) {
    const cols = section.columns || [];
    return `
      <details class="seed-ed-substyle" open>
        <summary>Columns (${cols.length})</summary>
        <div class="seed-ed-substyle-body">
          ${cols.map((c, i) => this._atColumnEditor(sid, i, c)).join('')}
          <div class="seed-ed-add-btn seed-ed-add-btn-sm at-add" data-at-sid="${sid}" data-at-list="columns" data-at-new="column"><ha-icon icon="mdi:plus"></ha-icon>Add column</div>
        </div>
      </details>`;
  }

  _atSortPanel(sid, section) {
    const sort = section.sort || {};
    const rows = (sort.rules || []).map((r, i) => {
      const cw = r.when || {};
      return `<div class="seed-ed-rule">
        <span class="seed-ed-hint">if</span>
        <select class="at-input" data-at-sid="${sid}" data-at-path="sort.rules.${i}.when.op">${this._atOpts(this._AT_OPS, cw.op)}</select>
        <input type="text" class="at-input" data-at-sid="${sid}" data-at-path="sort.rules.${i}.when.value" value="${escapeHtml(cw.value ?? '')}" placeholder="value" style="width:70px;" />
        ${this._atSlider(sid, `sort.rules.${i}.weight`, 'weight', r.weight ?? 0, 0, 200, 5)}
        <ha-icon class="seed-ed-icon-btn at-del" icon="mdi:close" data-at-sid="${sid}" data-at-list="sort.rules" data-at-idx="${i}"></ha-icon>
      </div>`;
    }).join('');
    return `
      <details class="seed-ed-substyle">
        <summary>Sort Order</summary>
        <div class="seed-ed-substyle-body">
          <span class="seed-ed-hint">Lower weight = higher in the list. Active-first is weight 0, default ${sort.default_weight ?? 100}.</span>
          <div class="seed-ed-rules">${rows || '<span class="seed-ed-hint">No sort rules.</span>'}</div>
          ${this._atSlider(sid, 'sort.default_weight', 'Default weight', sort.default_weight ?? 100, 0, 200, 5)}
          <div class="seed-ed-font-row">
            <label>Tiebreak dir
              <select class="at-input" data-at-sid="${sid}" data-at-path="sort.then_by.dir">${this._atOpts([['asc', 'Oldest first'], ['desc', 'Newest first']], (sort.then_by || {}).dir)}</select>
            </label>
            <div class="seed-ed-add-btn seed-ed-add-btn-sm at-add" data-at-sid="${sid}" data-at-list="sort.rules" data-at-new="sortrule"><ha-icon icon="mdi:plus"></ha-icon>Add rule</div>
          </div>
          <label style="display:block;margin-top:6px;">Pin to top (entity ids, comma-separated)
            <input type="text" class="at-input at-input-multi" data-at-sid="${sid}" data-at-path="sort.pin_top" value="${escapeHtml((sort.pin_top || []).join(', '))}" placeholder="sensor.a, sensor.b" style="width:100%;" />
          </label>
          <div class="seed-ed-style-field-title" style="margin-top:8px;">Separator rows (subheaders / spacers)</div>
          <span class="seed-ed-hint">Insert a labeled row above all rows, between the pinned block and the rest, or below all.</span>
          ${this._atSeparatorEditor(sid, 'top', 'Above all', (sort.separators || {}).top)}
          ${this._atSeparatorEditor(sid, 'after_pinned', 'After pinned', (sort.separators || {}).after_pinned)}
          ${this._atSeparatorEditor(sid, 'bottom', 'Below all', (sort.separators || {}).bottom)}
        </div>
      </details>`;
  }

  // Editor for one separator slot (top / after_pinned / bottom).
  _atSeparatorEditor(sid, slot, label, sep) {
    sep = sep || {};
    const on = sep.enabled === true;
    const b = `sort.separators.${slot}`;
    let body = `
      <div class="seed-ed-font-row">
        <label><input type="checkbox" class="at-check at-structural" data-at-sid="${sid}" data-at-path="${b}.enabled" ${on ? 'checked' : ''}/> ${label}</label>
      </div>`;
    if (on) {
      body += `
        <div class="seed-ed-font-row">
          <input type="text" class="at-input" data-at-sid="${sid}" data-at-path="${b}.text" value="${escapeHtml(sep.text || '')}" placeholder="subheader text (blank = spacer)" style="flex:1;" />
          <label>Align<select class="at-input" data-at-sid="${sid}" data-at-path="${b}.align">${this._atOpts(this._AT_ALIGN, sep.align || 'left')}</select></label>
        </div>
        <div class="seed-ed-font-row">
          <label>Text<input type="color" class="at-input" data-at-sid="${sid}" data-at-path="${b}.color" value="${/^#/.test(sep.color || '') ? sep.color : '#888888'}" /></label>
          <label>Bg<input type="color" class="at-input" data-at-sid="${sid}" data-at-path="${b}.bg" value="${/^#/.test(sep.bg || '') ? sep.bg : '#1c1c1c'}" /></label>
          <label>Weight<select class="at-input" data-at-sid="${sid}" data-at-path="${b}.weight">${this._atOpts([['400', 'Normal'], ['600', 'Semibold'], ['700', 'Bold']], sep.weight || 700)}</select></label>
          <label><input type="checkbox" class="at-check" data-at-sid="${sid}" data-at-path="${b}.italic" ${sep.italic ? 'checked' : ''}/> Italic</label>
        </div>
        ${this._atSlider(sid, `${b}.font_size`, 'Font size (px)', sep.font_size ?? 11, 8, 24, 1)}
        ${this._atSlider(sid, `${b}.height`, 'Min height (px)', sep.height ?? 8, 0, 48, 2)}
        ${this._atSlider(sid, `${b}.space_above`, 'Space above (px)', sep.space_above ?? 0, 0, 48, 2, 'None')}
        ${this._atSlider(sid, `${b}.space_below`, 'Space below (px)', sep.space_below ?? 0, 0, 48, 2, 'None')}`;
    }
    return `<div class="seed-ed-ruleblock">${body}</div>`;
  }

  // All template tokens, shown as a reference under every template field.
  _AT_TITLE_TOKENS = '{name} {count} {total} {off} {newest} {oldest} {last_changed} {last_changed_ago} {last_changed_time} {entity:sensor.x} {entity:sensor.x:attribute}';

  // State-driven header-icon editor: choose the header glyph and/or color by
  // rules evaluated against the live count OR a specific entity's value.
  _atHeaderIconEditor(sid, hi) {
    const on = hi.enabled === true;
    const src = hi.source === 'entity' ? 'entity' : 'count';
    const b = 'title_row.header_icon';
    let body = `
      <div class="seed-ed-font-row">
        <label><input type="checkbox" class="at-check at-structural" data-at-sid="${sid}" data-at-path="${b}.enabled" ${on ? 'checked' : ''}/> State-driven header icon</label>
      </div>`;
    if (on) {
      body += `
        <span class="seed-ed-hint">Overrides the header glyph and/or color by rule. Rules test either the section's live count, or one entity's value.</span>
        <div class="seed-ed-font-row">
          <label>Test:<select class="at-input at-structural" data-at-sid="${sid}" data-at-path="${b}.source">${this._atOpts([['count', 'The count value'], ['entity', "A specific entity's value"]], src)}</select></label>
          ${src === 'entity' ? `<label>Entity:<input type="text" class="at-input" list="ees-all-entities" data-at-sid="${sid}" data-at-path="${b}.entity" value="${escapeHtml(hi.entity || '')}" placeholder="binary_sensor.…" style="width:180px;" /></label>` : ''}
        </div>
        ${this._atRuleSetEditor(sid, `${b}`, { rules: hi.rules, default: hi.default }, 'text', 'Icon glyph rules (mdi:… , __default__ = native)')}
        ${this._atRuleSetEditor(sid, `${b}.color_rules`, hi.color_rules, 'color', 'Icon color rules')}`;
    }
    return `<div class="seed-ed-style-field-title">State icon (advanced)</div>${body}`;
  }

  // Section editor: the applied Header Rule Sets list (ordered) + an add row.
  // Each applied ref = a set (Built-In or library) + an entity binding (blank =
  // the section's own primary entity). Mirrors _atFrameRefEditor structurally.
  _atHeaderRuleRefEditor(sid, section, opts) {
    const flush = !!(opts && opts.flush);
    const refs = Array.isArray(section.header_rule_refs) ? section.header_rule_refs : [];
    const lib = headerLibraryMap((this._config && this._config.header_library_scope) || 'system');
    const libSlugs = Object.keys(lib).sort();
    const nameOf = id => {
      if (id === BUILTIN_HEADER_ID) return 'Built-In';
      if (typeof id === 'string' && id.startsWith('lib:')) { const slug = id.slice(4); const s = lib[slug]; return (s ? (s.name || slug) : slug) + ' (System)'; }
      return id;
    };
    // The Library default entity for a ref's set (if any), so we can show the
    // effective binding state and only warn when NOTHING is bound.
    const libDefaultOf = id => {
      if (typeof id !== 'string' || !id.startsWith('lib:')) return '';
      const s = lib[id.slice(4)];
      return (s && s.default_entity) ? String(s.default_entity) : '';
    };
    const applied = refs.map((r, i) => {
      const libDef = libDefaultOf(r.ref);
      const boundHere = !!r.entity;
      const bound = boundHere || !!libDef;   // effective: overridden here, or Library default
      const src = boundHere ? 'bound here' : (libDef ? 'from Library default' : '');
      const boundIcon = bound ? 'mdi:link-variant' : 'mdi:link-variant-off';
      const boundTitle = bound ? ('Entity bound (' + escapeHtml(src) + ')') : 'No entity bound';
      return `
      <details class="seed-ed-substyle seed-ed-substyle-flush seed-ed-hdr-ref" data-panel="hdrref-${escapeHtml(String(sid))}-${i}">
        <summary class="seed-ed-substyle-sum">
          <ha-icon class="seed-ed-hdr-bound ${bound ? 'seed-ed-hdr-bound-on' : 'seed-ed-hdr-bound-off'}" icon="${boundIcon}" title="${boundTitle}"></ha-icon>
          <span class="seed-ed-substyle-name" style="flex:1;">${escapeHtml(nameOf(r.ref))}</span>
          ${boundHere ? `<span class="seed-ed-hdr-ref-ent" title="Bound entity">${escapeHtml(r.entity)}</span>` : ''}
          <ha-icon class="seed-ed-icon-btn at-del" data-at-sid="${sid}" data-at-list="header_rule_refs" data-at-idx="${i}" icon="mdi:trash-can-outline" title="Remove"></ha-icon>
        </summary>
        <div class="seed-ed-substyle-body">
        ${this._atHeaderEntBinding(sid, `header_rule_refs.${i}.entity`, r.entity || '', {
          checkboxLabel: 'Choose an Entity',
          blankLabel: libDef ? ('Blank = Library default (' + escapeHtml(libDef) + ')') : "Blank = the section's own entity",
          warn: !bound,
          warnText: 'You must bind an entity to this rule for it to be enforced. No entity is bound for this rule in the Rule Library.'
        })}
        </div>
      </details>`;
    }).join('');
    const addOpts = `<option value="">— add a Header Rule Set —</option>`
      + `<option value="${BUILTIN_HEADER_ID}">Built-In</option>`
      + (libSlugs.length ? `<optgroup label="System">${libSlugs.map(slug => `<option value="lib:${escapeHtml(slug)}">${escapeHtml(lib[slug].name || slug)}</option>`).join('')}</optgroup>` : '');
    return `
      <details class="seed-ed-substyle${flush ? ' seed-ed-substyle-flush' : ''}">
        <summary>HEADER RULES</summary>
        <div class="seed-ed-substyle-body">
          <span class="seed-ed-hint">Apply one or more <b>Header Rules</b> (built in the Header Rules panel). Rules set the header icon/glyph/text color/size + a secondary line by an entity's state. Layered top→bottom, last match wins. An entity chosen here <b>overrides</b> the set's Library default entity; leave it blank to use the Library default, else the section's own first entity.</span>
          ${applied || '<span class="seed-ed-hint">No rule sets applied.</span>'}
          <div class="seed-ed-font-row">
            <label>Add<select class="at-hdr-ref-add" data-at-sid="${sid}">${addOpts}</select></label>
          </div>
        </div>
      </details>`;
  }

  // One rule row inside a Header Rule Set editor: a when-editor + the six
  // optional outputs (icon color / glyph / text color / icon size / text size /
  // secondary). Each output is only stored when set (blank = "don't set").
  // `sid` is the hdr:<slug> target; `path` is the rule's dotted path in the set.
  _atHeaderRuleRow(sid, path, rule, idx) {
    rule = rule || {};
    const sec = rule.set_secondary || {};
    const slug = sid.startsWith('hdr:') ? sid.slice(4) : sid;
    const previewing = this._hdrRulePreview && this._hdrRulePreview.has(slug + '||' + idx);
    // A one-line summary of what this rule OUTPUTS, so a collapsed row is still
    // legible. Chips for each set output (icon color swatch, mdi glyph, text
    // color swatch, sizes, secondary line).
    const chips = [];
    if (rule.set_icon_color) chips.push(`<span class="seed-ed-hdr-rule-chip"><span class="seed-ed-hdr-rule-swatch" style="background:${escapeHtml(rule.set_icon_color)};"></span>icon</span>`);
    if (rule.set_icon) chips.push(`<span class="seed-ed-hdr-rule-chip"><ha-icon icon="${escapeHtml(normalizeIcon(rule.set_icon))}"></ha-icon></span>`);
    if (rule.set_text_color) chips.push(`<span class="seed-ed-hdr-rule-chip"><span class="seed-ed-hdr-rule-swatch" style="background:${escapeHtml(rule.set_text_color)};"></span>text</span>`);
    if (Number(rule.set_icon_size) > 0) chips.push(`<span class="seed-ed-hdr-rule-chip">${Number(rule.set_icon_size)}px icon</span>`);
    if (Number(rule.set_text_size) > 0) chips.push(`<span class="seed-ed-hdr-rule-chip">${Number(rule.set_text_size)}px text</span>`);
    if (sec.enabled) chips.push(`<span class="seed-ed-hdr-rule-chip"><ha-icon icon="mdi:subtitles-outline"></ha-icon>2nd</span>`);
    const summaryChips = chips.length ? `<span class="seed-ed-hdr-rule-chips">${chips.join('')}</span>` : '<span class="seed-ed-hint" style="opacity:0.6;">no outputs set</span>';
    return `
      <details class="seed-ed-substyle seed-ed-substyle-flush seed-ed-hdr-rule" data-panel="hdrrule-${slug}-${idx}">
        <summary class="seed-ed-substyle-sum">
          <span class="seed-ed-rule-when">Rule ${idx + 1}</span>
          ${summaryChips}
          <span style="flex:1;"></span>
          <ha-icon class="seed-ed-icon-btn hdr-rule-preview${previewing ? ' hdr-rule-preview-on' : ''}" data-hdr-slug="${slug}" data-hdr-idx="${idx}" icon="mdi:eye-outline" title="Preview this rule's look"></ha-icon>
          <ha-icon class="seed-ed-icon-btn at-del" data-at-sid="${sid}" data-at-list="rules" data-at-idx="${idx}" icon="mdi:trash-can-outline" title="Remove rule"></ha-icon>
        </summary>
        <div class="seed-ed-substyle-body">
          ${previewing ? this._hdrRulePreviewHtml(rule) : ''}
          ${rule.when_entity ? `<div class="seed-ed-hdr-ent-legacy"><span class="seed-ed-hint"><ha-icon icon="mdi:information-outline"></ha-icon> This rule has a per-rule entity (legacy). It's honored unless the card/section binds its own. Clear it to use the set's default entity instead.</span>${this._atEntityPicker(sid, `${path}.when_entity`, 'Entity', rule.when_entity, 'Blank = use the set default')}</div>` : ''}
          ${this._atRuleWhenEditor(sid, `${path}.when`, rule.when)}
          <div class="seed-ed-font-row">
            ${this._atColorField(sid, `${path}.set_icon_color`, 'Icon color', rule.set_icon_color || '')}
            <label>Icon (mdi)<input type="text" class="at-input" data-at-sid="${sid}" data-at-path="${path}.set_icon" value="${escapeHtml(rule.set_icon || '')}" placeholder="mdi:…" style="width:130px;" /></label>
          </div>
          <div class="seed-ed-font-row">
            ${this._atColorField(sid, `${path}.set_text_color`, 'Text color', rule.set_text_color || '')}
          </div>
          ${this._atSlider(sid, `${path}.set_icon_size`, 'Icon size (px)', rule.set_icon_size ?? 0, 0, 48, 1, 'Default')}
          ${this._atSlider(sid, `${path}.set_text_size`, 'Text size (px)', rule.set_text_size ?? 0, 0, 48, 1, 'Default')}
          <div class="seed-ed-font-row">
            <label><input type="checkbox" class="at-check at-structural" data-at-sid="${sid}" data-at-path="${path}.set_secondary.enabled" ${sec.enabled ? 'checked' : ''}/> Show secondary info</label>
          </div>
          ${sec.enabled ? `<div class="seed-ed-font-row">
            <label>Source<select class="at-input at-structural" data-at-sid="${sid}" data-at-path="${path}.set_secondary.source">${this._atOpts([['state', 'State'], ['attribute', 'Attribute'], ['last_changed_ago', 'Time since change']], sec.source || 'state')}</select></label>
            ${(sec.source || 'state') === 'attribute' ? `<label>Attribute<input type="text" class="at-input" data-at-sid="${sid}" data-at-path="${path}.set_secondary.attribute" value="${escapeHtml(sec.attribute || '')}" placeholder="brightness" style="width:120px;" /></label>` : ''}
            <label>Prefix<input type="text" class="at-input" data-at-sid="${sid}" data-at-path="${path}.set_secondary.prefix" value="${escapeHtml(sec.prefix || '')}" placeholder="e.g. 'Bri: '" style="width:90px;" /></label>
          </div>` : ''}
        </div>
      </details>`;
  }

  // A static preview of ONE header rule's look — the rule's outputs force-applied
  // (its condition ignored) so you can see the styled header without hunting for
  // a matching entity state. Icon + text (+ a stand-in secondary line).
  _hdrRulePreviewHtml(rule) {
    const iconColor = rule.set_icon_color || 'var(--secondary-text-color)';
    const textColor = rule.set_text_color || 'var(--primary-text-color)';
    const iconSize = Number(rule.set_icon_size) > 0 ? Number(rule.set_icon_size) : 24;
    const textSize = Number(rule.set_text_size) > 0 ? Number(rule.set_text_size) : 16;
    const icon = rule.set_icon ? normalizeIcon(rule.set_icon) : 'mdi:tune-variant';
    const sec = rule.set_secondary || {};
    const secLine = sec.enabled
      ? `<div class="seed-ed-hdr-prev-sec">${escapeHtml(sec.prefix || '')}${sec.source === 'attribute' ? (escapeHtml(sec.attribute || 'attribute')) : (sec.source === 'last_changed_ago' ? '2m ago' : 'sample value')}</div>`
      : '';
    return `
      <div class="seed-ed-hdr-prev">
        <ha-icon icon="${icon}" style="--mdc-icon-size:${iconSize}px; color:${iconColor};"></ha-icon>
        <div class="seed-ed-hdr-prev-txt">
          <div style="font-size:${textSize}px; color:${textColor}; font-weight:600;">Section Title</div>
          ${secLine}
        </div>
      </div>`;
  }

  // Editor for ONE Header Rule Set (a lib entry). Built-In renders read-only.
  _atHeaderSetEditor(set) {
    const builtin = set._builtin === true;
    const slug = (set.id && set.id.startsWith('lib:')) ? set.id.slice(4) : (set._builtin ? BUILTIN_HEADER_SLUG : headerLibSlug(set.name));
    const sid = 'hdr:' + slug;
    const rules = set.rules || [];
    const body = builtin
      ? `<span class="seed-ed-hint">Built-in fallback (light on → accent icon+text; off → muted). Read-only — duplicate it to customize.</span>`
      : `
        <div class="seed-ed-font-row">
          <label style="flex:1;">Name<input type="text" class="at-input" data-at-sid="${sid}" data-at-path="name" value="${escapeHtml(set.name || '')}" placeholder="Set name" style="width:100%;" /></label>
        </div>
        ${this._atHeaderEntBinding(sid, 'default_entity', set.default_entity || '', {
          label: 'Default entity',
          checkboxLabel: 'Bind a Default Entity (optional)',
          blankLabel: 'No default — the card/section must bind one when applied.'
        })}
        ${rules.map((r, i) => this._atHeaderRuleRow(sid, `rules.${i}`, r, i)).join('')}
        <div class="seed-ed-add-btn seed-ed-add-btn-sm at-add" data-at-sid="${sid}" data-at-list="rules" data-at-new="hdrrule"><ha-icon icon="mdi:plus"></ha-icon>Add rule</div>`;
    const actions = builtin
      ? `<ha-icon class="seed-ed-icon-btn hdr-export" data-hdr-slug="${slug}" icon="mdi:export-variant" title="Export this rule set to text"></ha-icon>
         <ha-icon class="seed-ed-icon-btn hdr-duplicate" data-hdr-slug="${slug}" icon="mdi:content-copy" title="Duplicate into an editable System set"></ha-icon>`
      : `<ha-icon class="seed-ed-icon-btn hdr-export" data-hdr-slug="${slug}" icon="mdi:export-variant" title="Export this rule set to text"></ha-icon>
         <ha-icon class="seed-ed-icon-btn hdr-duplicate" data-hdr-slug="${slug}" icon="mdi:content-copy" title="Duplicate"></ha-icon>
         <ha-icon class="seed-ed-icon-btn hdr-delete" data-hdr-slug="${slug}" icon="mdi:trash-can-outline" title="Delete from the shared library"></ha-icon>`;
    const dirty = !builtin && !!(this._headerDrafts[slug] && this._headerDrafts[slug].dirty);
    return `
      <details class="seed-ed-substyle" data-panel="hdrset-${slug}">
        <summary class="seed-ed-substyle-sum">
          ${builtin ? '<span class="seed-ed-loc-badge seed-ed-loc-card"><ha-icon icon="mdi:lock"></ha-icon>Built-In</span>' : '<span class="seed-ed-loc-badge seed-ed-loc-lib"><ha-icon icon="mdi:cloud-check-outline"></ha-icon>System</span>'}
          ${builtin ? '' : `<ha-icon class="seed-ed-hdr-bound ${set.default_entity ? 'seed-ed-hdr-bound-on' : 'seed-ed-hdr-bound-off'}" icon="${set.default_entity ? 'mdi:link-variant' : 'mdi:link-variant-off'}" title="${set.default_entity ? 'Default entity: ' + escapeHtml(set.default_entity) : 'No default entity bound'}"></ha-icon>`}
          <span class="seed-ed-substyle-name" style="flex:1;">${escapeHtml(set.name || slug)}${dirty ? ' <span class="seed-ed-hint" title="Unsaved changes">•</span>' : ''}</span>
        </summary>
        <div class="seed-ed-substyle-body">
          <div class="seed-ed-fx-actions">${actions}</div>
          ${body}
          ${builtin ? '' : this._atHeaderSaveRow(slug)}
        </div>
      </details>`;
  }

  // Save/Discard row for a Header Rule Set. Edits live in this._headerDrafts[slug]
  // until Save commits them to the shared library.
  //
  // Dirty state is driven ENTIRELY by the `seed-ed-fx-saverow-dirty` class on the
  // container: the unsaved notice, the accent border, and both buttons' enabled
  // look are all CSS-gated on it. This lets a live scalar edit flip the whole row
  // to dirty by toggling ONE class (no re-render, keeps focus) — and, critically,
  // enables BOTH Save and Discard together (the old markup only class-enabled
  // Save, so Discard could never light up on a live edit). `data-hdr-saverow`
  // lets the live path find this row by slug.
  _atHeaderSaveRow(slug) {
    const d = this._headerDrafts[slug];
    const dirty = !!(d && d.dirty);
    return `<div class="seed-ed-fx-saverow${dirty ? ' seed-ed-fx-saverow-dirty' : ''}" data-hdr-saverow="${escapeHtml(slug)}">
      <span class="seed-ed-hint seed-ed-fx-unsaved"><ha-icon icon="mdi:content-save-alert"></ha-icon> Unsaved — shared Header Rule; Save applies it to every card that uses it.</span>
      <div class="seed-ed-font-row" style="gap:8px;">
        <div class="seed-ed-add-btn seed-ed-add-btn-sm hdr-save-draft" data-hdr-slug="${escapeHtml(slug)}"><ha-icon icon="mdi:content-save"></ha-icon>Save</div>
        <div class="seed-ed-add-btn seed-ed-add-btn-sm hdr-discard-draft" data-hdr-slug="${escapeHtml(slug)}"><ha-icon icon="mdi:undo"></ha-icon>Discard</div>
      </div>
    </div>`;
  }

  // Top-level "Header Rule Sets" library panel (mirrors Frame Styles).
  _atHeaderRuleSetsPanel() {
    const lib = headerLibraryMap((this._config && this._config.header_library_scope) || 'system');
    const slugs = Object.keys(lib).sort();
    // Show the DRAFT for any set with unsaved edits so the editor reflects them.
    const blocks = this._atHeaderSetEditor(builtinHeaderRuleSet())
      + slugs.map(s => this._atHeaderSetEditor(this._headerDisplaySet(s) || lib[s])).join('');
    return `
      <details class="seed-ed-sections-panel seed-ed-collapsible-panel">
        <summary class="seed-ed-panel-summary">
          <div class="seed-ed-sections-panel-title"><ha-icon icon="mdi:format-list-checks" class="seed-ed-panel-title-icon"></ha-icon>Header Rules</div>
        </summary>
        <span class="seed-ed-hint">Named sets of state-driven header rules. Each rule sets any/all of: icon color, MDI icon, text color, icon/text size, and a secondary line. Optionally <b>bind a default entity</b> here so the set works as soon as it's applied. Apply a set to the <b>Card Header</b> (Card Appearance) or any <b>Section Header</b> under its <b>Header Rules</b>. <b>Entity precedence:</b> an entity chosen on the card/section <b>overrides</b> the default entity bound here; if neither is set, the section's own first entity is used. Shared system-wide; Built-In is read-only — duplicate to customize.</span>
        <div class="seed-ed-add-row">
          <div class="seed-ed-add-btn seed-ed-add-btn-sm" id="hdr-add"><ha-icon icon="mdi:plus"></ha-icon>Add Header Rule</div>
          <div class="seed-ed-add-btn seed-ed-add-btn-sm" id="hdr-import"><ha-icon icon="mdi:import"></ha-icon>Import from text</div>
        </div>
        ${blocks}

        <div id="hdr-portal" class="seed-ed-portal" style="display:none; margin-top:10px;">
          <div class="seed-ed-hint" id="hdr-portal-label"></div>
          <textarea id="hdr-portal-text" class="at-input" rows="8" style="width:100%; font-family:monospace; font-size:11px;" spellcheck="false"></textarea>
          <div class="seed-ed-add-row">
            <div class="seed-ed-add-btn seed-ed-add-btn-sm" id="hdr-portal-primary"></div>
            <div class="seed-ed-add-btn seed-ed-add-btn-sm" id="hdr-portal-close"><ha-icon icon="mdi:close"></ha-icon>Close</div>
          </div>
          <div class="seed-ed-hint" id="hdr-portal-status"></div>
        </div>
      </details>`;
  }

  // Show the shared Header import/export textarea "portal" (mirrors _fxPortal):
  //   'export' — read-only text + a Copy button
  //   'import' — editable text + an Import button
  _hdrPortal(mode, text, label) {
    const portal = this.querySelector('#hdr-portal');
    if (!portal) return;
    const ta = this.querySelector('#hdr-portal-text');
    const primary = this.querySelector('#hdr-portal-primary');
    const lbl = this.querySelector('#hdr-portal-label');
    const status = this.querySelector('#hdr-portal-status');
    if (status) status.textContent = '';
    if (lbl) lbl.textContent = label || '';
    if (ta) { ta.value = text || ''; ta.readOnly = (mode === 'export'); ta.style.display = ''; }
    if (primary) {
      primary.style.display = '';
      primary.dataset.mode = mode;
      primary.innerHTML = mode === 'export'
        ? '<ha-icon icon="mdi:content-copy"></ha-icon>Copy'
        : '<ha-icon icon="mdi:import"></ha-icon>Import';
    }
    portal.style.display = '';
    if (mode === 'import' && ta) { try { ta.focus(); } catch (e) {} }
  }

  _atTitleRowPanel(sid, section) {
    const tr = section.title_row || {};
    const cnt = tr.count || {};
    const parts = tr.parts || {};
    const extra = parts.extra || [];
    return `
      <details class="seed-ed-substyle">
        <summary>Section Header</summary>
        <div class="seed-ed-substyle-body">
          <div class="seed-ed-font-row">
            <label>Icon<input type="text" class="at-input" data-at-sid="${sid}" data-at-path="title_row.icon" value="${escapeHtml(tr.icon || '')}" placeholder="mdi:..." style="width:130px;" /></label>
          </div>
          ${this._atSlider(sid, 'title_indent', 'Header indent (px)', section.title_indent ?? 0, 0, 48, 2, 'None')}
          <span class="seed-ed-hint">Tokens for any template: ${this._AT_TITLE_TOKENS}. Type freely and mix with text.</span>

          <details class="seed-ed-substyle" open><summary>Icon part</summary><div class="seed-ed-substyle-body">
            ${this._atTitlePartEditor(sid, 'icon', 'Show icon', parts.icon, false)}
            ${this._atRuleSetEditor(sid, 'title_row.parts.icon.color_rules', (parts.icon || {}).color_rules, 'color', 'Icon Color Rules (by count value)')}
            ${this._atHeaderIconEditor(sid, tr.header_icon || {})}
          </div></details>

          <details class="seed-ed-substyle" open><summary>Title part</summary><div class="seed-ed-substyle-body">${this._atTitlePartEditor(sid, 'title', 'Show title', parts.title, true)}</div></details>

          <details class="seed-ed-substyle" open><summary>Count part</summary><div class="seed-ed-substyle-body">
            ${this._atTitlePartEditor(sid, 'count', 'Show count', parts.count, true)}
            <div class="seed-ed-style-field-title">Count value</div>
            <div class="seed-ed-font-row">
              <label>Count
                <select class="at-input at-structural" data-at-sid="${sid}" data-at-path="title_row.count.mode">${this._atOpts([['condition', 'Entities matching…'], ['rows', 'All rows']], cnt.mode)}</select>
              </label>
              ${cnt.mode !== 'rows' ? `
              <select class="at-input" data-at-sid="${sid}" data-at-path="title_row.count.when.op">${this._atOpts(this._AT_OPS, (cnt.when || {}).op)}</select>
              <input type="text" class="at-input" data-at-sid="${sid}" data-at-path="title_row.count.when.value" value="${escapeHtml((cnt.when || {}).value ?? '')}" placeholder="value" style="width:80px;" />` : ''}
            </div>
          </div></details>

          ${extra.map((ep, i) => `
          <details class="seed-ed-substyle"><summary>Custom part ${i + 1}
            <span style="flex:1;"></span>
            <ha-icon class="seed-ed-icon-btn at-del" icon="mdi:trash-can-outline" data-at-sid="${sid}" data-at-list="title_row.parts.extra" data-at-idx="${i}"></ha-icon>
          </summary><div class="seed-ed-substyle-body">${this._atCustomPartEditor(sid, i, ep)}</div></details>`).join('')}

          <div class="seed-ed-add-row">
            <div class="seed-ed-add-btn seed-ed-add-btn-sm at-add" data-at-sid="${sid}" data-at-list="title_row.parts.extra" data-at-new="textpart"><ha-icon icon="mdi:plus"></ha-icon>Add new Section Header Part</div>
          </div>
          ${this._atHeaderRuleRefEditor(sid, section)}
        </div>
      </details>`;
  }

  // One built-in title part editor: show toggle, a text template (icon part has
  // no template - it renders the section icon glyph), align, color, italic,
  // size, weight.
  _atTitlePartEditor(sid, key, label, p, withTemplate) {
    p = p || {};
    const base = `title_row.parts.${key}`;
    const tplField = withTemplate ? `
        <label style="display:block;">Template
          <input type="text" class="at-input" data-at-sid="${sid}" data-at-path="${base}.template" value="${escapeHtml(p.template != null ? p.template : (key === 'count' ? '{count}' : '{name}'))}" placeholder="${key === 'count' ? '{count}' : '{name}'}" style="width:100%;" />
        </label>
        <label style="display:block;">When count is 0, show (optional)
          <input type="text" class="at-input" data-at-sid="${sid}" data-at-path="${base}.zero_text" value="${escapeHtml(p.zero_text || '')}" placeholder="e.g. All Secure (blank = use template)" style="width:100%;" />
        </label>` : '';
    return `
      <div class="seed-ed-title-part">
        <div class="seed-ed-font-row">
          <label><input type="checkbox" class="at-check" data-at-sid="${sid}" data-at-path="${base}.show" ${p.show !== false ? 'checked' : ''}/> ${label}</label>
          <label>Align<select class="at-input" data-at-sid="${sid}" data-at-path="${base}.align">${this._atOpts(this._AT_ALIGN, p.align || (key === 'count' ? 'right' : 'left'))}</select></label>
          <label>Color<input type="color" class="at-input" data-at-sid="${sid}" data-at-path="${base}.color" value="${/^#/.test(p.color || '') ? p.color : '#e1e1e1'}" /></label>
          <label><input type="checkbox" class="at-check" data-at-sid="${sid}" data-at-path="${base}.italic" ${p.italic ? 'checked' : ''}/> Italic</label>
        </div>
        ${tplField}
        ${this._atSlider(sid, `${base}.size`, 'Size (px)', p.size ?? (key === 'icon' ? 30 : 16), 8, 48, 1)}
        ${key === 'icon' ? '' : `<div class="seed-ed-font-row">
          <label>Weight<select class="at-input" data-at-sid="${sid}" data-at-path="${base}.weight">${this._atOpts([['400','Normal'],['600','Semibold'],['700','Bold'],['900','Black']], p.weight || 400)}</select></label>
        </div>`}
      </div>`;
  }

  // A custom (user-added) title part: text (with template) or icon (glyph).
  _atCustomPartEditor(sid, i, ep) {
    ep = ep || {};
    const base = `title_row.parts.extra.${i}`;
    const isIcon = ep.kind === 'icon';
    return `
      <div class="seed-ed-title-part">
        <div class="seed-ed-font-row">
          <label>Type<select class="at-input at-structural" data-at-sid="${sid}" data-at-path="${base}.kind">${this._atOpts([['text', 'Text'], ['icon', 'Icon']], ep.kind || 'text')}</select></label>
          <label>Align<select class="at-input" data-at-sid="${sid}" data-at-path="${base}.align">${this._atOpts(this._AT_ALIGN, ep.align || 'right')}</select></label>
          <label>Color<input type="color" class="at-input" data-at-sid="${sid}" data-at-path="${base}.color" value="${/^#/.test(ep.color || '') ? ep.color : '#e1e1e1'}" /></label>
          <label><input type="checkbox" class="at-check" data-at-sid="${sid}" data-at-path="${base}.show" ${ep.show !== false ? 'checked' : ''}/> Show</label>
        </div>
        ${isIcon
          ? `<label style="display:block;">Icon<input type="text" class="at-input" data-at-sid="${sid}" data-at-path="${base}.icon" value="${escapeHtml(ep.icon || '')}" placeholder="mdi:..." style="width:100%;" /></label>`
          : `<label style="display:block;">Template<input type="text" class="at-input" data-at-sid="${sid}" data-at-path="${base}.template" value="${escapeHtml(ep.template || '')}" placeholder="e.g. {last_changed}" style="width:100%;" /></label>`}
        ${this._atSlider(sid, `${base}.size`, 'Size (px)', ep.size ?? (isIcon ? 20 : 14), 8, 48, 1)}
        ${isIcon ? '' : `<div class="seed-ed-font-row">
          <label>Weight<select class="at-input" data-at-sid="${sid}" data-at-path="${base}.weight">${this._atOpts([['400','Normal'],['600','Semibold'],['700','Bold'],['900','Black']], ep.weight || 400)}</select></label>
          <label><input type="checkbox" class="at-check" data-at-sid="${sid}" data-at-path="${base}.italic" ${ep.italic ? 'checked' : ''}/> Italic</label>
        </div>`}
      </div>`;
  }

  // Shared presentation controls (headers + row style) for BOTH the per-section
  // Table Styles panel and the global Entity Table Defaults panel. `opts.strip`
  // adds the per-section "Strip from names" field (not a global default).
  _tableStyleControls(sid, obj, opts) {
    opts = opts || {};
    const rs = obj.row_style || {};
    const h = obj.headers || {};
    return `
      <div class="seed-ed-font-row">
        <label><input type="checkbox" class="at-check" data-at-sid="${sid}" data-at-path="headers.show" ${h.show !== false ? 'checked' : ''}/> Show headers</label>
        <label>Header color<input type="color" class="at-input" data-at-sid="${sid}" data-at-path="headers.color" value="${/^#/.test(h.color || '') ? h.color : '#90ee90'}" /></label>
      </div>
      ${this._atSlider(sid, 'headers.font_size', 'Header size (px)', h.font_size ?? 10, 6, 24, 1)}
      ${this._atSlider(sid, 'row_style.font_size', 'Row font size (px)', rs.font_size ?? 14, 8, 28, 1)}
      ${this._atSlider(sid, 'row_style.indent', 'Left indent (px)', rs.indent ?? 0, 0, 64, 2, 'None')}
      ${this._atSlider(sid, 'row_style.padding_v', 'Row spacing (px)', rs.padding_v ?? 6, 0, 20, 1)}
      <div class="seed-ed-font-row">
        <label><input type="checkbox" class="at-check" data-at-sid="${sid}" data-at-path="row_style.name_link" ${rs.name_link !== false ? 'checked' : ''}/> Name links</label>
        <label><input type="checkbox" class="at-check" data-at-sid="${sid}" data-at-path="row_style.zebra" ${rs.zebra ? 'checked' : ''}/> Zebra</label>
        <label><input type="checkbox" class="at-check" data-at-sid="${sid}" data-at-path="row_style.divider.show" ${(rs.divider || {}).show ? 'checked' : ''}/> Row divider</label>
      </div>
      ${opts.strip ? `<label style="display:block;">Strip from names (comma-separated)
        <input type="text" class="at-input at-input-multi" data-at-sid="${sid}" data-at-path="row_style.strip_strings" value="${escapeHtml((rs.strip_strings || []).join(', '))}" placeholder=" Light,  Sensor" style="width:100%;" />
      </label>` : ''}`;
  }

  _atRowStylePanel(sid, section) {
    return `
      <details class="seed-ed-substyle">
        <summary>Table Styles</summary>
        <div class="seed-ed-substyle-body">
          ${this._tableStyleControls(sid, section, { strip: true })}
          <div class="seed-ed-reset-row">
            <span class="seed-ed-reset-btn at-reset-table-defaults" data-at-sid="${sid}" title="Overwrite this table's headers + row style with the global Entity Table Defaults"><ha-icon icon="mdi:backup-restore"></ha-icon>Reset to Table Defaults</span>
          </div>
        </div>
      </details>`;
  }

  // Global "Entity Table Defaults" panel - the presentation house style seeded
  // into every NEW Entity Table. Uses the same at-input plumbing via a special
  // target sid; a Reset button (below the panel, per-section) applies these
  // defaults to an existing table on demand.
  _tableDefaultsPanel() {
    const sid = SEEDCardEditor.TABLE_DEFAULTS_SID;
    const td = normalizeTableDefaults(this._config.table_defaults);
    return `
      <details class="seed-ed-substyle seed-ed-substyle-flush" data-panel="table_defaults">
        <summary class="seed-ed-substyle-sum"><ha-icon class="seed-ed-rs-sum-icon" icon="mdi:table-cog"></ha-icon><span class="seed-ed-substyle-name" style="flex:1;">Entity Table Defaults</span></summary>
        <div class="seed-ed-substyle-body">
          <span class="seed-ed-hint">Presentation defaults (headers + row style) applied to every <strong>new</strong> Entity Table. Existing tables are unaffected unless you press <em>Reset to Table Defaults</em> inside that table's Table Styles panel.</span>
          <div class="seed-ed-at-body" style="margin-top:8px;">
            ${this._tableStyleControls(sid, td, { strip: false })}
          </div>
        </div>
      </details>`;
  }

  _AT_ACTIONS = [['none', 'None'], ['more-info', 'More info'], ['toggle', 'Toggle'], ['navigate', 'Navigate'], ['url', 'URL'], ['call-service', 'Call service']];
  _atActionsPanel(sid, section) {
    const tap = section.tap_action || {};
    const hold = section.hold_action || {};
    return `
      <details class="seed-ed-substyle">
        <summary>Row actions</summary>
        <div class="seed-ed-substyle-body">
          <div class="seed-ed-font-row">
            <label>Tap<select class="at-input" data-at-sid="${sid}" data-at-path="tap_action.action">${this._atOpts(this._AT_ACTIONS, tap.action)}</select></label>
            <label>Hold<select class="at-input" data-at-sid="${sid}" data-at-path="hold_action.action">${this._atOpts(this._AT_ACTIONS, hold.action)}</select></label>
          </div>
          <div class="seed-ed-font-row">
            <label><input type="checkbox" class="at-check" data-at-sid="${sid}" data-at-path="hide_when_empty" ${section.hide_when_empty ? 'checked' : ''}/> Hide section when empty</label>
          </div>
          ${this._atSlider(sid, 'window_minutes', 'Recent window (min)', section.window_minutes ?? 0, 0, 1440, 15, 'Off')}
          ${this._atSlider(sid, 'max_rows', 'Max rows shown', section.max_rows ?? 0, 0, 50, 1, 'No limit')}
        </div>
      </details>`;
  }

  // The full activity-table config body for one section.
  _atSectionBody(sid, section) {
    const isArray = section.row_source && section.row_source.type === 'attribute_array';
    return `
      <div class="seed-ed-at-body">
        ${this._atRowSourcePanel(sid, section)}
        ${this._atColumnsPanel(sid, section)}
        ${isArray ? '' : this._atSortPanel(sid, section)}
        ${this._atTitleRowPanel(sid, section)}
        ${this._atRowStylePanel(sid, section)}
        ${this._atActionsPanel(sid, section)}
      </div>`;
  }

  // Row-source selector: entities (default) or an attribute array (one row per
  // element of an entity attribute that holds a list of objects).
  _atRowSourcePanel(sid, section) {
    const src = section.row_source || {};
    const isArray = src.type === 'attribute_array';
    let extra = '';
    if (isArray) {
      extra = `
        <div class="seed-ed-font-row">
          <label>Entity<input type="text" class="at-input" list="ees-all-entities" data-at-sid="${sid}" data-at-path="row_source.entity" value="${escapeHtml(src.entity || '')}" placeholder="sensor.house_mode_history" style="width:220px;" /></label>
        </div>
        <div class="seed-ed-font-row">
          <label>Attribute<input type="text" class="at-input" data-at-sid="${sid}" data-at-path="row_source.attribute" value="${escapeHtml(src.attribute || '')}" placeholder="history" style="width:150px;" /></label>
          <label><input type="checkbox" class="at-check" data-at-sid="${sid}" data-at-path="row_source.reverse" ${src.reverse ? 'checked' : ''}/> Newest first (reverse)</label>
        </div>
        <span class="seed-ed-hint">Columns read element fields: set each column's Value to <strong>Array field</strong> and name the field (mode, start, end, duration). Use the <strong>Timestamp → time/date</strong> and <strong>Seconds → duration</strong> transforms for time fields; an element with <code>end: null</code> shows "Now" + a live duration.</span>`;
    }
    return `
      <details class="seed-ed-substyle"${isArray ? ' open' : ''}>
        <summary>Row Source</summary>
        <div class="seed-ed-substyle-body">
          <div class="seed-ed-font-row">
            <label>Rows from:<select class="at-input at-structural" data-at-sid="${sid}" data-at-path="row_source.type">${this._atOpts([['entities', 'Entities (filter / rule sets)'], ['attribute_array', 'An attribute array (list of objects)']], isArray ? 'attribute_array' : 'entities')}</select></label>
          </div>
          ${extra}
        </div>
      </details>`;
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
    // Top-level collapsible panels (Sections / Rule Sets / Frame Styles),
    // keyed by their title text so their open/closed state survives re-render.
    this._openPanels = this._openPanels || new Set();
    this._openPanels.clear();
    this.querySelectorAll('details.seed-ed-collapsible-panel').forEach(d => {
      const t = d.querySelector('.seed-ed-sections-panel-title');
      if (t) { this._panelSeen = this._panelSeen || new Set(); this._panelSeen.add(t.textContent.trim()); if (d.open) this._openPanels.add(t.textContent.trim()); }
    });

    // Activity-table sub-panels (Filter / Columns / Sort / Title / Row style /
    // Actions, and per-column details). Keyed by owning section id + a stable
    // label so they survive a re-render instead of snapping shut - that
    // collapse is what reads as "the panel refreshed" when editing a select.
    this._openSubPanels = this._openSubPanels || new Set();
    this._openSubPanels.clear();
    this.querySelectorAll('details.seed-ed-substyle').forEach(d => {
      if (!d.open) return;
      const sec = d.closest('.seed-ed-section');
      const sid = sec ? sec.dataset.sectionId : '';
      // Prefer a stable data-panel key (summaries may contain controls, so
      // summary text isn't a reliable identity). Fall back to summary text.
      const summary = d.querySelector('summary');
      const label = d.dataset.panel || (summary ? summary.textContent.trim() : '');
      this._openSubPanels.add(sid + '||' + label);
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

    if (this._openSubPanels && this._openSubPanels.size) {
      this.querySelectorAll('details.seed-ed-substyle').forEach(d => {
        const sec = d.closest('.seed-ed-section');
        const sid = sec ? sec.dataset.sectionId : '';
        const summary = d.querySelector('summary');
        const label = d.dataset.panel || (summary ? summary.textContent.trim() : '');
        if (this._openSubPanels.has(sid + '||' + label)) d.open = true;
      });
    }

    // Restore top-level collapsible panels. Only adjust panels we've seen
    // before (so first render keeps the markup's default open state).
    if (this._panelSeen && this._panelSeen.size) {
      this.querySelectorAll('details.seed-ed-collapsible-panel').forEach(d => {
        const t = d.querySelector('.seed-ed-sections-panel-title');
        if (!t) return;
        const key = t.textContent.trim();
        if (this._panelSeen.has(key)) d.open = this._openPanels.has(key);
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
        /* ============================================================
           DESIGN TOKENS — single source of truth for the whole editor.
           Change a value here and every control that uses the token
           updates in one place. Seeded at the pre-refactor values so
           this is visually identical; tune from here going forward.
           (Mirror this block in the Color card for cross-card parity.)
           ============================================================ */
        .seed-ed {
          /* Font sizes (by role, not by pixel) */
          --ltek-fs-panel-title: 16px;  /* top-level panel / section title */
          --ltek-fs-header: 15px;       /* editor header, panel summary */
          --ltek-fs-group: 14px;        /* group heading inside a panel */
          --ltek-fs-label: 13px;        /* standard field label / row */
          --ltek-fs-body: 12px;         /* body text, most controls */
          --ltek-fs-small: 11px;        /* hints, secondary text */
          --ltek-fs-tiny: 10px;         /* badges, micro-labels */
          /* Font weights */
          --ltek-fw-normal: 400;        /* control labels (recede) */
          --ltek-fw-medium: 500;
          --ltek-fw-semibold: 600;
          --ltek-fw-bold: 700;          /* titles, values (lead) */
          /* Text colors */
          --ltek-c-text: var(--primary-text-color, #e1e1e1);  /* primary */
          --ltek-c-label: #ccc;         /* control labels */
          --ltek-c-muted: #888;         /* hints / disabled */
          --ltek-c-accent: var(--primary-color, #2196F3);
          /* Accent tints — hover / active fills (kept as rgba literals; one place
             to change). Default to the Material blue the cards shipped with. */
          --ltek-c-accent-fade: rgba(var(--rgb-primary-color,33,150,243),0.12);       /* active / pressed fill */
          --ltek-c-accent-fade-soft: rgba(var(--rgb-primary-color,33,150,243),0.08);  /* hover fill */
          --ltek-c-error-fade: rgba(244,67,54,0.15);         /* delete hover fill */
          /* Status colors — defer to the user's theme, fall back to Material. */
          --ltek-c-error: var(--error-color, #f44336);
          --ltek-c-success: var(--success-color, #4caf50);
          --ltek-c-warning: var(--warning-color, #ffb300);
          --ltek-c-info: var(--info-color, #2196F3);
          /* Second accent: the green "library / shared" grouping (distinct from
             the blue layout accent on purpose — NOT tied to --primary-color). */
          --ltek-c-accent-lib: #7fd18a;
          --ltek-c-on-accent: #fff;   /* text/icon on a solid accent fill */
          /* Action icons (edit/copy/hide/etc): neutral idle → brighten on hover.
             Delete stays a status color (error) on its own hover. */
          --ltek-c-icon: #aaa;        /* idle action icon */
          --ltek-c-icon-hover: #fff;  /* hovered action icon */
          /* Surfaces */
          --ltek-c-surface: rgba(255,255,255,0.015);        /* panels */
          --ltek-c-surface-raised: rgba(255,255,255,0.02);  /* cards / rows */
          /* Borders */
          --ltek-c-panel-border: #3a3a3a;   /* panels */
          --ltek-c-border: #444;            /* controls */
          --ltek-c-border-soft: #333;       /* subtle inner dividers */
          /* Radii */
          --ltek-r-panel: 12px;   /* panels */
          --ltek-r-card: 10px;    /* section cards */
          --ltek-r-md: 8px;       /* blocks */
          --ltek-r-ctrl: 6px;     /* inputs, selects, buttons */
          /* Spacing scale (4px base) */
          --ltek-sp-1: 4px;
          --ltek-sp-2: 6px;
          --ltek-sp-3: 8px;
          --ltek-sp-4: 10px;
          --ltek-sp-5: 12px;
          --ltek-sp-6: 16px;
          /* Control padding — uniform input/select/button height. */
          --ltek-ctrl-pad: 6px 10px;
          /* Icon sizes (two clear roles; one-off glyphs stay literal). */
          --ltek-icon-sm: 16px;   /* inline / action icons */
          --ltek-icon-lg: 20px;   /* panel-title icons */
          /* Slider row geometry (shared by every slider) */
          --ltek-slider-val-w: 44px;   /* value readout column width */
          display: flex; flex-direction: column; gap: 8px; padding: 8px 0;
        }
        .seed-ed-row {
          display: flex;
          flex-direction: column;
          gap:var(--ltek-sp-4);
          border: 1px solid var(--ltek-c-panel-border);
          border-radius: var(--ltek-r-panel);
          padding: 16px;
          background: var(--ltek-c-surface);
        }
        /* Expanded panel → theme-color border around the whole panel, so it's
           clear which options belong together (matches the Section Order rows). */
        details.seed-ed-row[open] { border-color: var(--primary-color); }
        .seed-ed-row label { font-size: var(--ltek-fs-label); font-weight: var(--ltek-fw-semibold); color: var(--ltek-c-text); }
        .seed-ed-row > label:first-child {
          font-size: var(--ltek-fs-panel-title);
          font-weight: var(--ltek-fw-bold);
        }
        .seed-ed-row > .seed-ed-hint:first-of-type {
          font-size: var(--ltek-fs-body);
          padding-bottom: 12px;
          margin-top: -2px;
          border-bottom: 1px solid #3a3a3a;
        }
        /* A collapsible panel must be a plain block like WFC's .wfc-panel -
           NOT the flex+gap layout the .seed-ed-row base rule applies (that gap
           adds the extra space under the summary text). */
        details.seed-ed-row {
          padding: 0;
          display: block;
          gap: 0;
        }
        /* Matches the Weather Flex Card .wfc-panel summary exactly. */
        details.seed-ed-row > summary {
          list-style: none;
          cursor: pointer;
          user-select: none;
          padding: 10px 14px;
          font-size: var(--ltek-fs-panel-title);
          font-weight: var(--ltek-fw-bold);
          color: var(--ltek-c-text);
          display: flex;
          align-items: center;
          gap:var(--ltek-sp-3);
        }
        /* Group heading inside a panel: labels a cluster of related settings
           (e.g. the "Title", "Scaling", "Card Wrapper" groups within the
           single Card Appearance panel). */
        .seed-ed-group-title {
          font-size: var(--ltek-fs-group);
          font-weight: var(--ltek-fw-bold);
          /* Standout accent so group headers pop against the panel. */
          color: var(--accent-color, #2196F3);
          /* Divider line ABOVE, subtitle sits under it. */
          margin-top: 14px;
          padding-top: 8px;
          border-top: 1px solid #3a3a3a;
        }
        .seed-ed-group-title:first-child { margin-top: 0; padding-top: 0; border-top: none; }
        /* The intro hint already draws a bottom divider; a group-title right
           after it must NOT add its own top divider (that was the doubled line
           at the top of Card Appearance). */
        .seed-ed-collapsible-body > .seed-ed-hint:first-of-type + .seed-ed-group-title {
          margin-top: 4px; padding-top: 0; border-top: none;
        }
        /* Frame-grouping title: distinct green accent so it reads as a separate
           kind of grouping (Frame Styles) vs the blue layout groups. */
        .seed-ed-group-title-frame { color: var(--ltek-c-accent-lib); border-top-color: rgba(127,209,138,0.4); }
        details.seed-ed-row > summary > ha-icon.seed-ed-summary-icon {
          --mdc-icon-size:var(--ltek-icon-lg);
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
          gap:var(--ltek-sp-4);
          padding: 0 16px 16px 16px;
        }
        details.seed-ed-row > .seed-ed-collapsible-body > .seed-ed-hint:first-of-type {
          padding-bottom: 12px;
          margin-top: -6px;
          border-bottom: 1px solid #3a3a3a;
        }
        .seed-ed-row input[type="text"], .seed-ed-row input[type="number"], .seed-ed-row select {
          background: var(--secondary-background-color, #1c1c1c);
          border: 1px solid var(--ltek-c-border);
          border-radius: var(--ltek-r-ctrl);
          padding: 8px 10px;
          color: var(--ltek-c-text);
          font-size: var(--ltek-fs-group);
          width: 100%;
          box-sizing: border-box;
        }
        .seed-ed-row select option { background: #1c1c1c; }
        .seed-ed-row input[type="checkbox"] { cursor: pointer; }
        .seed-ed-hint { font-size: var(--ltek-fs-small); color: var(--ltek-c-muted); }
        /* Entity Display Rules editor */
        .seed-ed-rules { display: flex; flex-direction: column; gap:var(--ltek-sp-3); }
        .seed-ed-rule {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap:var(--ltek-sp-2);
          padding: 6px;
          border: 1px solid var(--ltek-c-border-soft);
          border-radius: var(--ltek-r-ctrl);
          background: var(--ltek-c-surface-raised);
        }
        .seed-ed-rule .seed-ed-rule-when { font-size: var(--ltek-fs-small); color: var(--ltek-c-muted); font-weight: var(--ltek-fw-semibold); }
        .seed-ed-rule .seed-ed-rule-label { font-size: var(--ltek-fs-body); color: var(--ltek-c-label); }
        .seed-ed-rule-line { display: flex; flex-wrap: wrap; align-items: center; gap:var(--ltek-sp-2); flex: 1; }
        .seed-ed-rule select, .seed-ed-rule input[type="text"] {
          background: var(--secondary-background-color, #1c1c1c);
          border: 1px solid var(--ltek-c-border);
          border-radius: var(--ltek-r-ctrl);
          padding:var(--ltek-ctrl-pad);
          color: var(--ltek-c-text);
          font-size: var(--ltek-fs-label);
        }
        .seed-ed-rule input[type="text"] { flex: 1; min-width: 90px; }
        .seed-ed-rule .ed-rule-join { font-weight: var(--ltek-fw-bold); }
        .seed-ed-mini-btn {
          display: inline-flex;
          align-items: center;
          gap:var(--ltek-sp-1);
          align-self: flex-start;
          font-size: var(--ltek-fs-body);
          color:var(--ltek-c-accent);
          cursor: pointer;
          padding: 4px 8px;
          border: 1px dashed var(--ltek-c-accent);
          border-radius: var(--ltek-r-ctrl);
          user-select: none;
        }
        .seed-ed-mini-btn:hover { background: var(--ltek-c-accent-fade-soft); }
        .seed-ed-mini-btn ha-icon { --mdc-icon-size:var(--ltek-icon-sm); }
        .seed-ed-colors { display: flex; flex-wrap: wrap; gap:var(--ltek-sp-6); padding: 4px 0; }
        .seed-ed-color {
          display: flex;
          align-items: center;
          gap:var(--ltek-sp-2);
          color: var(--ltek-c-text);
          font-size: var(--ltek-fs-body);
        }
        .seed-ed-color label { min-width: 0; color: var(--ltek-c-label); }
        /* Color pickers unified with the Color card: 44x32, thin divider-color
           border, 4px radius, no padding, flat swatch. Generic rule covers every
           input[type=color] (bare pickers included); scoped rules just tweak size. */
        input[type="color"] {
          width: 44px;
          height: 32px;
          padding: 0;
          border: 1px solid var(--divider-color, #333);
          border-radius: 4px;
          background: transparent;
          cursor: pointer;
          flex: none;
          box-sizing: border-box;
        }
        input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
        input[type="color"]::-webkit-color-swatch { border: none; border-radius: 3px; }
        .seed-ed-color input[type="color"] { width: 44px; height: 32px; }
        .seed-ed-style-field input[type="color"] { width: 100%; height: 30px; }
        .seed-ed-section {
          border: 1px solid var(--ltek-c-border);
          border-radius: var(--ltek-r-card);
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap:var(--ltek-sp-4);
          background: var(--ltek-c-surface-raised);
        }
        /* Hidden sections stay in the list but read as dimmed so it's obvious. */
        .seed-ed-section.seed-ed-section-hidden > summary { opacity: 0.5; }
        /* Expanded section rows get an accent border around the whole block. */
        details.seed-ed-section[open] { border-color: var(--primary-color, #2196F3) !important; }
        details.seed-ed-section {
          background: transparent !important;
          padding: 0;
          border: 1px solid var(--ltek-c-border);
          border-radius: var(--ltek-r-card);
          margin-bottom: 8px;   /* vertical gap between section rows (matches Color's .cpce-order-list gap) */
        }
        details.seed-ed-section > summary {
          list-style: none;
          cursor: pointer;
          padding: 6px 8px;
          user-select: none;
          display: flex;
          align-items: center;
          gap:var(--ltek-sp-2);
        }
        details.seed-ed-section > summary::-webkit-details-marker { display: none; }
        details.seed-ed-section > summary::marker { content: ""; }
        details.seed-ed-section > .seed-ed-section-body {
          padding: 0 12px 12px 12px;
          display: flex;
          flex-direction: column;
          gap:var(--ltek-sp-4);
        }
        .seed-ed-section-head { display: flex; align-items: center; gap:var(--ltek-sp-3); flex: 1; }
        /* Section-name field: compact like the Color card's .cpce-order-rename
           (control padding + label font) so rows aren't taller than needed. */
        .seed-ed-section-head input[type="text"] { flex: 1; min-width: 60px; padding: var(--ltek-ctrl-pad); background: var(--secondary-background-color, #1c1c1c); border: 1px solid var(--ltek-c-border); border-radius: var(--ltek-r-ctrl); color: var(--ltek-c-text); font-size: var(--ltek-fs-label); box-sizing: border-box; }
        .seed-ed-icon-btn {
          cursor: pointer;
          --mdc-icon-size:var(--ltek-icon-lg);
          color: var(--ltek-c-icon);
          display: flex;
          align-items: center;
        }
        .seed-ed-icon-btn:hover { color: var(--ltek-c-icon-hover); }
        .seed-ed-icon-btn.disabled { opacity: 0.25; pointer-events: none; }
        .seed-ed-checkbox-row { display: flex; align-items: center; gap:var(--ltek-sp-2); font-size: var(--ltek-fs-body); color: var(--ltek-c-label); }
        .seed-ed-style-block {
          border: 1px solid var(--ltek-c-border-soft);
          border-radius: var(--ltek-r-md);
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap:var(--ltek-sp-3);
        }
        .seed-ed-style-title {
          font-size: var(--ltek-fs-small);
          font-weight: var(--ltek-fw-bold);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--accent-color, var(--primary-color));
          display: flex;
          align-items: center;
          gap:var(--ltek-sp-3);
        }
        /* All Reset controls are chip-style: accent outline + text, pill shape.
           Scoped variants below only tweak size/placement. */
        /* Group sub-heading rows that hold a title + optional Reset chip. Flex so
           the Reset chip's margin-left:auto right-justifies it (was crammed left
           because the div defaulted to block). */
        .seed-ed-group-div { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
        .seed-ed-reset-btn {
          margin-left: auto;
          font-size: var(--ltek-fs-tiny);
          font-weight: var(--ltek-fw-semibold);
          text-transform: none;
          letter-spacing: 0;
          color:var(--ltek-c-accent);
          cursor: pointer;
          user-select: none;
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 2px 8px;
          border:1px solid var(--ltek-c-accent);
          border-radius: 999px;
          background: transparent;
          transition: background 0.15s ease;
        }
        .seed-ed-reset-btn:hover { background: rgba(33,150,243,0.15); }
        .seed-ed-reset-btn ha-icon { --mdc-icon-size: 12px; }
        .seed-ed-style-title .seed-ed-reset-btn { margin-left: auto; }
        /* Reset row inside an expanded style panel: right-aligned; same small chip. */
        .seed-ed-reset-row { display: flex; justify-content: flex-end; margin-top: 2px; }
        .seed-ed-style-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
          gap:var(--ltek-sp-4);
        }
        .seed-ed-style-field { display: flex; flex-direction: column; gap: 3px; }
        .seed-ed-style-field label { font-size: var(--ltek-fs-tiny); color: #999; font-weight: var(--ltek-fw-normal); }
        .seed-ed-style-field label.seed-ed-custom-toggle { display: inline-flex; align-items: center; gap:var(--ltek-sp-1); cursor: pointer; }
        .seed-ed-style-field label.seed-ed-custom-toggle input { cursor: pointer; }
        .seed-ed-style-field input[type="color"] {
          width: 100%;
          height: 30px;
          padding: 2px;
          border-radius: var(--ltek-r-ctrl);
          border: 1px solid var(--ltek-c-border);
          background: transparent;
          cursor: pointer;
        }
        .seed-ed-style-field input[type="number"] {
          background: var(--secondary-background-color, #1c1c1c);
          border: 1px solid var(--ltek-c-border);
          border-radius: var(--ltek-r-ctrl);
          padding:var(--ltek-ctrl-pad);
          color: var(--ltek-c-text);
          font-size: var(--ltek-fs-body);
          width: 100%;
          box-sizing: border-box;
        }
        .seed-ed-icon-input-row { display: flex; align-items: center; gap:var(--ltek-sp-2); }
        .seed-ed-icon-input-row ha-icon { --mdc-icon-size:var(--ltek-icon-lg); color: var(--ltek-c-label); flex-shrink: 0; }
        .seed-ed-icon-input-row input[type="text"] {
          background: var(--secondary-background-color, #1c1c1c);
          border: 1px solid var(--ltek-c-border);
          border-radius: var(--ltek-r-ctrl);
          padding:var(--ltek-ctrl-pad);
          color: var(--ltek-c-text);
          font-size: var(--ltek-fs-body);
          width: 100%;
          box-sizing: border-box;
        }
        .seed-ed-search {
          width: 100%;
          box-sizing: border-box;
          background: var(--secondary-background-color, #1c1c1c);
          border: 1px solid var(--ltek-c-border);
          border-radius: var(--ltek-r-ctrl);
          padding:var(--ltek-ctrl-pad);
          color: var(--ltek-c-text);
          font-size: var(--ltek-fs-body);
        }
        .seed-ed-entity-list {
          max-height: 180px;
          overflow-y: auto;
          border: 1px solid var(--ltek-c-border-soft);
          border-radius: var(--ltek-r-ctrl);
          padding: 4px;
        }
        .seed-ed-entity-item {
          display: flex;
          align-items: center;
          gap:var(--ltek-sp-3);
          padding: 4px 6px;
          font-size: var(--ltek-fs-body);
          color: #ddd;
          border-radius: 4px;
        }
        .seed-ed-entity-item:hover { background: rgba(255,255,255,0.05); }
        .seed-ed-entity-item .eid { color: var(--ltek-c-muted); font-size: var(--ltek-fs-tiny); }
        /* Clean candidate row (Color-card style): name truncates, id in a muted
           fixed column, round accent + button — no horizontal overflow. */
        .seed-ed-ent-row { display: flex; align-items: center; gap: var(--ltek-sp-3); padding: 5px 6px; border-top: 1px solid var(--ltek-c-border-soft); font-size: var(--ltek-fs-body); color: var(--ltek-c-text); }
        .seed-ed-ent-row:first-child { border-top: none; }
        .seed-ed-ent-row:hover { background: rgba(255,255,255,0.05); }
        .seed-ed-ent-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .seed-ed-ent-id { flex: 0 1 auto; max-width: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ltek-c-muted); font-size: var(--ltek-fs-tiny); font-family: var(--code-font-family, monospace); }
        .seed-ed-ent-add { flex: none; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border: none; border-radius: var(--ltek-r-ctrl); background: var(--ltek-c-accent); color: var(--ltek-c-on-accent); cursor: pointer; font-size: 18px; line-height: 1; }
        .seed-ed-ent-add:hover { filter: brightness(1.1); }
        /* Searchable single-entity picker (_atEntityPicker): a shorter list than
           the section picker, so the row stays compact inside a rule block. */
        .seed-ed-ent-picker .seed-ed-entity-list { max-height: 160px; }
        .at-ent-pick { cursor: pointer; }
        .at-ent-pick-sel { background: var(--ltek-c-accent-fade); }
        .seed-ed-ent-selicon { flex: none; color: var(--ltek-c-accent); }
        /* Colour-mode field: label + mode dropdown + (custom picker | theme select). */
        .seed-ed-color-field { display: flex; align-items: center; gap: var(--ltek-sp-2); flex-wrap: wrap; }
        .seed-ed-color-field > label { display: flex; align-items: center; gap: var(--ltek-sp-2); }
        .seed-ed-color-field input[type="color"] { width: 44px; height: 26px; padding: 0; border: none; background: none; cursor: pointer; }
        /* Header-rule preview box — a stand-in header row with the rule's look. */
        .seed-ed-hdr-prev { display: flex; align-items: center; gap: var(--ltek-sp-3); padding: 8px 10px; margin: 4px 0 8px; border: 1px dashed var(--ltek-c-panel-border); border-radius: var(--ltek-r-md); background: rgba(255,255,255,0.03); }
        .seed-ed-hdr-prev-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .seed-ed-hdr-prev-sec { font-size: var(--ltek-fs-tiny); color: var(--ltek-c-muted); }
        .hdr-rule-preview-on { color: var(--ltek-c-accent); }
        /* Collapsible header rule row: summary shows Rule N + output chips. */
        .seed-ed-hdr-rule > summary .seed-ed-rule-when { flex: none; margin-right: 8px; }
        .seed-ed-hdr-rule-chips { display: inline-flex; flex-wrap: wrap; align-items: center; gap: var(--ltek-sp-2); }
        .seed-ed-hdr-rule-chip { display: inline-flex; align-items: center; gap: 3px; padding: 1px 6px; border: 1px solid var(--ltek-c-border); border-radius: 10px; font-size: var(--ltek-fs-tiny); color: var(--ltek-c-muted); background: rgba(255,255,255,0.03); }
        .seed-ed-hdr-rule-chip ha-icon { --mdc-icon-size: 14px; width: 14px; height: 14px; }
        .seed-ed-hdr-rule-swatch { width: 10px; height: 10px; border-radius: 2px; border: 1px solid rgba(0,0,0,0.35); display: inline-block; }
        /* Header-rule entity binding: bound-state icon, reveal checkbox, warning. */
        .seed-ed-hdr-bound { flex: none; margin-right: 4px; --mdc-icon-size: 18px; }
        .seed-ed-hdr-bound-on { color: var(--ltek-c-accent); }
        .seed-ed-hdr-bound-off { color: var(--ltek-c-muted); opacity: 0.7; }
        /* Bound-entity badge shown on a collapsed Header-rule ref summary. */
        .seed-ed-hdr-ref-ent {
          flex: none;
          font-size: var(--ltek-fs-tiny, 11px);
          color: var(--ltek-c-muted);
          font-variant-numeric: tabular-nums;
          max-width: 40%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .seed-ed-hdr-ent { margin: 4px 0 2px; }
        .seed-ed-hdr-ent-cb { display: inline-flex; align-items: center; gap: var(--ltek-sp-2); font-size: var(--ltek-fs-body); color: var(--ltek-c-text); cursor: pointer; }
        .seed-ed-hdr-ent-legacy { margin: 4px 0; padding: 6px 8px; border-left: 3px solid var(--ltek-c-border); border-radius: var(--ltek-r-ctrl); background: rgba(255,255,255,0.03); }
        .seed-ed-hdr-ent-warn { display: flex; align-items: flex-start; gap: var(--ltek-sp-2); margin: 2px 0 6px; padding: 7px 9px; border: 1px solid #b8860b; border-left: 3px solid #e0a800; border-radius: var(--ltek-r-ctrl); background: rgba(224,168,0,0.10); color: #e0a800; font-size: var(--ltek-fs-tiny); line-height: 1.35; }
        .seed-ed-hdr-ent-warn ha-icon { flex: none; --mdc-icon-size: 18px; margin-top: 1px; }
        .seed-ed-add-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap:var(--ltek-sp-2);
          padding: 10px;
          border: 1px dashed ${colors.border || '#2196F3'};
          border-radius: var(--ltek-r-md);
          color: ${colors.icon || '#2196F3'};
          cursor: pointer;
          font-size: var(--ltek-fs-label);
          font-weight: var(--ltek-fw-semibold);
        }
        .seed-ed-add-btn:hover { background: var(--ltek-c-accent-fade-soft); }
        .seed-ed-add-btn-sm { padding: 6px 8px; font-size: var(--ltek-fs-body); }
        /* Disabled action button (e.g. Save/Discard when there's nothing to save). */
        .seed-ed-add-btn.disabled { opacity: 0.4; cursor: not-allowed; pointer-events: none; }
        /* A solid (enabled) action button — used for the Frame Style Save when dirty. */
        .seed-ed-add-btn.seed-ed-btn-enabled { border-style: solid; }
        .seed-ed-add-btn.fx-save-draft.seed-ed-btn-enabled { background: var(--ltek-c-accent-fade); }
        /* Frame/Header Save+Discard row + unsaved banner. The whole row's dirty
           state is gated on ONE container class (seed-ed-fx-saverow-dirty): when
           it's absent the banner is hidden and BOTH buttons read as disabled
           (dimmed, no pointer events); when present both light up. This lets a
           live scalar edit flip everything by toggling one class — and fixes the
           old bug where Discard could never enable on a live edit. */
        .seed-ed-fx-saverow { margin-top: 10px; padding-top: 8px; border-top: 1px solid #333; }
        .seed-ed-fx-saverow-dirty { border-top-color: var(--ltek-c-error); }
        .seed-ed-fx-unsaved { display: flex; align-items: center; gap:var(--ltek-sp-2); margin-bottom: 6px; color: var(--ltek-c-error); font-weight: var(--ltek-fw-semibold); }
        .seed-ed-fx-unsaved ha-icon { --mdc-icon-size:var(--ltek-icon-sm); }
        /* Clean row: hide the unsaved notice; both buttons look/behave disabled. */
        .seed-ed-fx-saverow:not(.seed-ed-fx-saverow-dirty) .seed-ed-fx-unsaved { display: none; }
        .seed-ed-fx-saverow:not(.seed-ed-fx-saverow-dirty) .seed-ed-add-btn { opacity: 0.4; cursor: not-allowed; pointer-events: none; }
        /* Dirty row: solid buttons; Save takes the accent fill. */
        .seed-ed-fx-saverow-dirty .seed-ed-add-btn { border-style: solid; }
        .seed-ed-fx-saverow-dirty .hdr-save-draft,
        .seed-ed-fx-saverow-dirty .fx-save-draft { background: var(--ltek-c-accent-fade); }
        .seed-ed-add-row { display: flex; gap:var(--ltek-sp-3); margin-bottom: 16px; }
        .seed-ed-add-row > .seed-ed-add-btn { flex: 1; }
        .seed-ed-title-part { display: flex; flex-direction: column; gap:var(--ltek-sp-2); }
        .seed-ed-sections-panel {
          border: 1px solid var(--ltek-c-panel-border);
          border-radius: var(--ltek-r-panel);
          margin-top: 8px;
          background: var(--ltek-c-surface);
          display: flex;
          flex-direction: column;
          gap:var(--ltek-sp-4);
        }
        /* Non-collapsible panels keep interior padding. Collapsible ones put
           padding on the summary + body instead, so a COLLAPSED panel is just
           the summary height (no leftover body padding making it too tall). */
        .seed-ed-sections-panel:not(.seed-ed-collapsible-panel) { padding: 16px; }
        .seed-ed-collapsible-panel { padding: 0; gap: 0; }
        /* Expanded collapsible panel → theme-color border around the whole panel. */
        .seed-ed-collapsible-panel[open] { border-color: var(--primary-color); }
        .seed-ed-sections-panel-title { font-size: var(--ltek-fs-panel-title); font-weight: var(--ltek-fw-bold); color: var(--ltek-c-text); display: flex; align-items: center; gap:var(--ltek-sp-3); }
        /* Full-width section divider that groups the reusable-definition panels
           (matches the Color card's Libraries divider). */
        .seed-ed-lib-divider { display: flex; align-items: center; gap: 10px; margin: 18px 2px 10px; color: var(--ltek-c-accent); font-size: var(--ltek-fs-label); font-weight: var(--ltek-fw-bold); letter-spacing: 0.02em; text-transform: uppercase; }
        .seed-ed-lib-divider::before, .seed-ed-lib-divider::after { content: ''; flex: 1; height: 2px; background: linear-gradient(to right, transparent, var(--ltek-c-accent)); opacity: 0.5; }
        .seed-ed-lib-divider::before { background: linear-gradient(to left, transparent, var(--ltek-c-accent)); }
        .seed-ed-lib-divider ha-icon { --mdc-icon-size: 18px; }
        /* Summary: single click target, holds the title + hint, with a chevron
           matching the seed-ed-row panels (skewed-border, not a text glyph). */
        .seed-ed-collapsible-panel > summary.seed-ed-panel-summary {
          cursor: pointer; user-select: none; list-style: none;
          display: grid; grid-template-columns: 1fr auto; align-items: center;
          gap:var(--ltek-sp-1) 10px; padding: 14px 16px;
        }
        .seed-ed-collapsible-panel > summary.seed-ed-panel-summary > .seed-ed-hint { grid-column: 1; }
        /* Description now lives in the BODY (shown when expanded). Tighten the
           gap so it sits directly under the title, not floating far below:
           the open summary drops its bottom margin, and the first body hint
           sits snug under the title with a small top offset. */
        /* Description = first body child (shown when expanded). Matches the
           Color card's Section panel: sits tight under the title, small muted
           text, modest gap before content — NO divider line. */
        /* Description sits tight under the title (pulled up to cancel the
           summary's bottom padding), small muted text, 8px gap before content
           — exactly the Color card's .cpce-hint under .cpce-sec-header. */
        /* MUST be display:block — .seed-ed-hint is a <span> (inline), and inline
           elements IGNORE vertical margins. Without this the margin-bottom did
           nothing (why the desc→buttons gap never changed). */
        .seed-ed-collapsible-panel > .seed-ed-hint:first-of-type {
          display: block;
          margin: 0 16px 18px;
          font-size: var(--ltek-fs-small);
          color: var(--ltek-c-muted);
          line-height: 1.4;
        }
        .seed-ed-collapsible-panel > summary.seed-ed-panel-summary::-webkit-details-marker { display: none; }
        .seed-ed-collapsible-panel > summary.seed-ed-panel-summary::marker { content: ""; }
        .seed-ed-collapsible-panel > summary.seed-ed-panel-summary::after {
          content: ""; grid-column: 2; grid-row: 1;
          width: 10px; height: 10px; margin-left: auto;
          border-right: 2px solid #999; border-bottom: 2px solid #999;
          transform: rotate(45deg); transition: transform 0.2s ease;
        }
        .seed-ed-collapsible-panel[open] > summary.seed-ed-panel-summary::after { transform: rotate(-135deg); }
        /* Interior padding for a collapsible panel's content lives on a wrapper
           after the summary (or directly on flowed children via this rule). */
        .seed-ed-collapsible-panel[open] > summary.seed-ed-panel-summary { margin-bottom: 0; padding-bottom: 8px; }
        .seed-ed-collapsible-panel > *:not(summary) { margin-left: 16px; margin-right: 16px; }
        .seed-ed-collapsible-panel > *:last-child:not(summary) { margin-bottom: 16px; }
        .seed-ed-panel-title-icon { --mdc-icon-size: 20px; width: 20px; height: 20px; color: ${colors.icon || '#2196F3'}; flex-shrink: 0; }
        .seed-ed-empty-candidates { font-size: var(--ltek-fs-body); color: var(--ltek-c-muted); padding: 8px; text-align: center; font-style: italic; }
        /* ---- Activity-table editor ---- */
        .seed-ed-at-body { display: flex; flex-direction: column; gap:var(--ltek-sp-3); margin-top: 8px; }
        /* Panel styling copied from the Weather Flex Card editor (.wfc-panel):
           #3a3a3a border, 12px radius, 8px inter-panel margin, 10px 14px
           summary padding, and a 10px 14px 14px body. */
        .seed-ed-substyle {
          border: 1px solid var(--ltek-c-panel-border);
          border-radius: var(--ltek-r-panel);
          background: var(--ltek-c-surface);
        }
        /* Bordered subpanel rows (e.g. Frame Style presets) get vertical gap
           between them — matches the section rows. Flush variant is exempt
           (it uses top-dividers, no boxes). */
        .seed-ed-substyle:not(.seed-ed-substyle-flush) { margin-bottom: 8px; }
        .seed-ed-substyle > summary {
          list-style: none;
          cursor: pointer;
          user-select: none;
          padding: 10px 14px;
          font-size: var(--ltek-fs-label);
          font-weight: var(--ltek-fw-semibold);
          color: var(--ltek-c-accent);
          display: flex;
          align-items: center;
          gap:var(--ltek-sp-3);
        }
        .seed-ed-substyle > summary::-webkit-details-marker { display: none; }
        .seed-ed-substyle > summary::marker { content: ""; }
        /* Sub-panel chevron — blue skewed-border caret, right-aligned, matching
           the top-level panels. Rotates open. (Sub-panels = blue accent;
           top-level group titles stay orange --accent-color.) */
        .seed-ed-substyle > summary::after {
          content: ""; margin-left: auto;
          width: 8px; height: 8px;
          border-right: 2px solid var(--ltek-c-accent); border-bottom: 2px solid var(--ltek-c-accent);
          transform: rotate(-45deg); transition: transform 0.2s ease;
        }
        .seed-ed-substyle[open] > summary::after { transform: rotate(45deg); }
        .seed-ed-substyle-body { padding: 10px 14px 14px; display: flex; flex-direction: column; gap:var(--ltek-sp-4); }
        /* Summary with an inline mode dropdown (shown even when collapsed). */
        .seed-ed-substyle-sum { list-style: none; }
        .seed-ed-substyle-sum::-webkit-details-marker { display: none; }
        .seed-ed-rs-sum-icon { color: var(--ltek-c-accent); --mdc-icon-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
        /* Storage-location badge on a preset's collapsed summary. */
        .seed-ed-loc-badge {
          display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0;
          font-size: var(--ltek-fs-tiny); font-weight: var(--ltek-fw-semibold); text-transform: uppercase; letter-spacing: 0.03em;
          padding: 2px 7px; border-radius: var(--ltek-r-card); line-height: 1.4;
        }
        .seed-ed-loc-badge ha-icon { --mdc-icon-size: 13px; width: 13px; height: 13px; }
        .seed-ed-loc-card { color: #cfcfcf; background: rgba(255,255,255,0.08); }
        .seed-ed-loc-lib { color: var(--ltek-c-accent-lib); background: rgba(76,175,80,0.15); }
        /* Actions row lives INSIDE the expanded body so nothing is clickable
           while collapsed (prevents accidental delete/export). */
        .seed-ed-fx-actions { display: flex; align-items: center; gap:var(--ltek-sp-2); }
        .seed-ed-preview-swatch {
          height: 56px; border-radius: var(--ltek-r-card); margin: 6px 0 10px;
          background: #1a1a1a; display: flex; align-items: center; justify-content: center;
          color: var(--ltek-c-muted); font-size: var(--ltek-fs-body); box-sizing: border-box;
        }
        .seed-ed-rs-info { margin: 6px 0 10px; }
        .seed-ed-rs-info > summary {
          display: flex; align-items: center; gap:var(--ltek-sp-2); cursor: pointer;
          font-size: var(--ltek-fs-body); color: var(--ltek-c-accent); list-style: none; user-select: none;
        }
        .seed-ed-rs-info > summary::-webkit-details-marker { display: none; }
        .seed-ed-rs-info > summary ha-icon { --mdc-icon-size:var(--ltek-icon-sm); width: 16px; height: 16px; }
        .seed-ed-rs-info-body {
          margin-top: 6px; padding: 8px 10px;
          border-left: 2px solid rgba(74,158,255,0.5);
          background: rgba(74,158,255,0.06); border-radius: 4px;
          font-size: var(--ltek-fs-body); color: #cfcfcf; line-height: 1.45;
        }
        .seed-ed-rs-info-body p { margin: 0 0 8px; }
        .seed-ed-rs-info-body p:last-child { margin-bottom: 0; }
        .seed-ed-rs-info-body strong { color: #e8e8e8; }
        .ms-preview-list { max-height: 220px; overflow-y: auto; }
        .ms-prev-row { display: flex; justify-content: space-between; gap:var(--ltek-sp-3); padding: 1px 0; font-size: var(--ltek-fs-body); }
        .seed-ed-substyle-sum .seed-ed-substyle-name { text-transform: uppercase; letter-spacing: 0.04em; font-size: var(--ltek-fs-body); color: var(--ltek-c-accent); flex-shrink: 0; }
        /* Frame sub-panel: green "library" accent on its summary name, matching
           the old .seed-ed-group-title-frame accent (Frame Styles grouping). */
        .seed-ed-substyle-frame > summary .seed-ed-substyle-name { color: var(--ltek-c-accent-lib); }
        /* Flush subpanel: no box border/radius/bg — just a top divider line
           between siblings (Color-card style, image 4). First one has no line. */
        .seed-ed-substyle-flush { border: none; border-radius: 0; background: none; border-top: 1px solid var(--ltek-c-panel-border); }
        .seed-ed-substyle-flush:first-of-type { border-top: none; }
        .seed-ed-substyle-flush > summary { padding: 10px 2px 4px; }
        .seed-ed-substyle-flush > .seed-ed-substyle-body { padding: 0 2px 10px; }
        /* When flush subpanels sit inside a flex container with a gap (e.g. the
           section-body), cancel the gap between consecutive flush items so they
           touch — separated only by the top-divider line, not empty space. */
        .seed-ed-substyle-flush + .seed-ed-substyle-flush { margin-top: calc(-1 * var(--ltek-sp-4)); }
        .seed-ed-substyle-sum .seed-ed-sum-select {
          flex: 1;
          min-width: 0;
          background: var(--secondary-background-color, #1c1c1c);
          border: 1px solid var(--ltek-c-border);
          border-radius: var(--ltek-r-ctrl);
          padding: 4px 6px;
          color: var(--ltek-c-text);
          font-size: var(--ltek-fs-body);
        }
        .seed-ed-style-field-title { font-size: var(--ltek-fs-body); font-weight: var(--ltek-fw-bold); text-transform: uppercase; letter-spacing: 0.04em; color: var(--accent-color, var(--primary-color)); margin-top: 4px; display: flex; align-items: center; gap:var(--ltek-sp-2); }
        .seed-ed-style-field-title::before { content: ''; flex: none; width: 4px; height: 13px; border-radius: 2px; background: var(--accent-color, var(--primary-color)); }
        .seed-ed-at-body .at-input, .seed-ed-at-body select.at-input { font-size: var(--ltek-fs-body); }
        .seed-ed-at-body .seed-ed-rule { display: flex; align-items: center; gap:var(--ltek-sp-2); flex-wrap: wrap; }
        /* Keep rule controls inside the panel: flex children default to
           min-width:auto and refuse to shrink below their content, which pushed
           long dropdowns/inputs past the right edge. Force shrink + clamp. */
        .seed-ed-at-body .seed-ed-rule > .at-input {
          min-width: 0;
          max-width: 100%;
          box-sizing: border-box;
        }
        .seed-ed-at-body .seed-ed-rule > select.at-input { text-overflow: ellipsis; }
        /* ---- Unified slider row (single definition; was two conflicting
           blocks + two value classes). Label hugs its control (no min-width,
           like the dropdown rows); the value is bold + fixed-width +
           right-aligned + tabular-nums so it stands out and never jitters
           while dragging. .at-slider-val and .seed-ed-slider-value are kept
           as aliases so both markup helpers style identically. ---- */
        .seed-ed-slider-row { display: flex; align-items: center; gap:var(--ltek-sp-4); padding: 4px 0; flex-wrap: wrap; }
        .seed-ed-slider-row label { font-size: var(--ltek-fs-body); color: var(--ltek-c-label); font-weight: var(--ltek-fw-normal); display: flex; align-items: center; gap:var(--ltek-sp-3); }
        .seed-ed-slider-row input[type="range"] { flex: 1; min-width: 100px; accent-color: var(--ltek-c-accent); cursor: pointer; }
        .seed-ed-slider-row .at-slider-val,
        .seed-ed-slider-row .seed-ed-slider-value {
          min-width: var(--ltek-slider-val-w);
          text-align: right;
          font-size: var(--ltek-fs-body);
          font-weight: var(--ltek-fw-bold);
          color: var(--ltek-c-text);
          font-variant-numeric: tabular-nums;
        }
        .seed-ed-ruleblock {
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: var(--ltek-r-ctrl);
          padding: 6px;
          margin: 4px 0;
          display: flex;
          flex-direction: column;
          gap:var(--ltek-sp-1);
        }
        .seed-ed-when { display: flex; flex-direction: column; gap:var(--ltek-sp-1); }
        .seed-ed-when-head { display: flex; align-items: center; gap:var(--ltek-sp-2); }
        .seed-ed-cond-row { margin-left: 10px; }
        .seed-ed-rule-result { margin-top: 2px; }
        .seed-ed-add-btn-xs {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          padding: 2px 8px;
          font-size: var(--ltek-fs-small);
          border: 1px dashed rgba(33,150,243,0.5);
          border-radius: var(--ltek-r-panel);
          color:var(--ltek-c-accent);
          cursor: pointer;
        }
        .seed-ed-add-btn-xs:hover { background: var(--ltek-c-accent-fade-soft); }
        .seed-ed-add-btn-xs ha-icon { --mdc-icon-size: 14px; width: 14px; height: 14px; }
        .seed-ed-rule-group {
          border: 1px dashed rgba(33,150,243,0.4);
          border-radius: var(--ltek-r-ctrl);
          padding: 6px;
          margin: 4px 0;
        }
        /* Color-coded rule-group logic: Include=green, Exclude=red, ALL=blue,
           ANY=amber. Applied to the group border + the mode/match dropdowns. */
        .seed-ed-rule-group.seed-rs-include { border-color: rgba(76,175,80,0.55); }
        .seed-ed-rule-group.seed-rs-exclude { border-color: rgba(244,67,54,0.55); }
        select.seed-rs-mode { font-weight: var(--ltek-fw-bold); }
        select.seed-rs-mode.seed-rs-include { color: var(--ltek-c-success); border-color: var(--ltek-c-success); }
        select.seed-rs-mode.seed-rs-exclude { color: var(--ltek-c-error); border-color: var(--ltek-c-error); }
        select.seed-rs-match { font-weight: var(--ltek-fw-bold); }
        select.seed-rs-match.seed-rs-all { color:var(--ltek-c-accent); border-color:var(--ltek-c-accent); }
        select.seed-rs-match.seed-rs-any { color: var(--ltek-c-warning); border-color: var(--ltek-c-warning); }
        .seed-ed-rule-group-body {
          margin-left: 14px;
          padding-left: 8px;
          border-left: 2px solid rgba(255,255,255,0.1);
          display: flex;
          flex-direction: column;
          gap:var(--ltek-sp-2);
          margin-top: 6px;
        }
        .seed-ed-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap:var(--ltek-sp-5);
        }
        .seed-ed-subsection {
          border: 1px solid var(--ltek-c-border-soft);
          border-radius: var(--ltek-r-md);
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap:var(--ltek-sp-2);
        }
        .seed-ed-subsection label {
          font-size: var(--ltek-fs-body);
          font-weight: var(--ltek-fw-semibold);
        }
        .seed-ed-subsection select {
          font-size: var(--ltek-fs-body);
          padding:var(--ltek-ctrl-pad);
        }
        .seed-ed-yaml {
          border: 1px solid ${colors.border || '#2196F3'};
          border-radius: var(--ltek-r-card);
          padding: 12px;
          background: rgba(0,0,0,0.25);
          color: #cde6ff;
          font-family: monospace;
          font-size: var(--ltek-fs-body);
          line-height: 1.5;
          margin: 0;
          max-height: 320px;
          overflow: auto;
          white-space: pre;
        }
        .seed-ed-hint-text {
          font-size: var(--ltek-fs-small);
          color: var(--ltek-c-muted);
          font-style: italic;
          padding: 4px 0;
        }
        .seed-ed-section-type-badge {
          font-size: var(--ltek-fs-tiny);
          padding: 2px 8px;
          border-radius: var(--ltek-r-card);
          background: ${colors.border || '#2196F3'}33;
          color: ${colors.border || '#2196F3'};
          border: 1px solid ${colors.border || '#2196F3'}66;
        }
        .seed-ed-header {
          display: flex;
          align-items: center;
          gap:var(--ltek-sp-3);
          padding: 2px 2px 10px;
          border-bottom: 1px solid #333;
          margin-bottom: 4px;
        }
        .seed-ed-header ha-icon { --mdc-icon-size: 22px; color: ${colors.icon || '#2196F3'}; }
        .seed-ed-header-title { font-size: var(--ltek-fs-header); font-weight: var(--ltek-fw-bold); color: var(--ltek-c-text); }
        .seed-ed-header-build { margin-left: auto; font-size: var(--ltek-fs-small); color: var(--ltek-c-muted); font-family: var(--code-font-family, monospace); }
        /* (slider-row unified above — the second/duplicate definition was removed) */
        .seed-ed-side-toggles { display: flex; flex-wrap: wrap; gap:var(--ltek-sp-5); padding: 4px 0; }
        .seed-ed-side-toggles label { display: flex; align-items: center; gap: 5px; font-size: var(--ltek-fs-body); color: var(--ltek-c-label); cursor: pointer; }
        .seed-ed-corner-toggles { display: flex; gap:var(--ltek-sp-4); flex-wrap: wrap; padding: 4px 0; }
        .seed-ed-corner-toggles label { display: flex; align-items: center; gap:var(--ltek-sp-1); font-size: var(--ltek-fs-small); color: var(--ltek-c-label); cursor: pointer; }
        .seed-ed-strip-tags { display: flex; flex-wrap: wrap; gap:var(--ltek-sp-2); padding: 4px 0; }
        .seed-ed-strip-tag {
          display: inline-flex;
          align-items: center;
          gap:var(--ltek-sp-2);
          background: rgba(255,255,255,0.06);
          border: 1px solid var(--ltek-c-border);
          border-radius: 999px;
          padding: 4px 10px;
          font-size: var(--ltek-fs-body);
          color: var(--ltek-c-text);
        }
        .seed-ed-strip-tag .strip-remove { cursor: pointer; opacity: 0.7; font-weight: bold; }
        .seed-ed-strip-tag .strip-remove:hover { opacity: 1; color: #f44336; }
        .seed-ed-strip-tag .ed-section-entity-remove { cursor: pointer; opacity: 0.7; font-weight: bold; }
        .seed-ed-strip-tag .ed-section-entity-remove:hover { opacity: 1; color: #f44336; }
        .seed-ed-select-allnone { display: flex; align-items: center; gap: 8px; padding: 2px 0; font-size: var(--ltek-fs-body); }
        .seed-ed-select-allnone .ed-section-select-all,
        .seed-ed-select-allnone .ed-section-select-none {
          color: #2196F3; cursor: pointer; user-select: none;
        }
        .seed-ed-select-allnone .ed-section-select-all:hover,
        .seed-ed-select-allnone .ed-section-select-none:hover { text-decoration: underline; }
        .seed-ed-allnone-sep { color: #666; }
        .seed-ed-font-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          padding: 4px 0;
        }
        .seed-ed-font-row label { font-size: var(--ltek-fs-body); color: var(--ltek-c-label); font-weight: var(--ltek-fw-normal); display: flex; align-items: center; gap: 6px; }
        .seed-ed-font-row select {
          background: var(--secondary-background-color, #1c1c1c);
          border: 1px solid var(--ltek-c-border);
          border-radius: var(--ltek-r-ctrl);
          padding:var(--ltek-ctrl-pad);
          color: var(--ltek-c-text);
          font-size: var(--ltek-fs-body);
        }
        /* Compact pairing row: places related controls (e.g. a slider + a color
           swatch, or icon-size + icon-color) side-by-side instead of one full
           row each. Sliders grow to fill; color swatches / short selects hug
           their content. Wraps to stacked on narrow editors. */
        .seed-ed-pair {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: var(--ltek-sp-6);
          padding: 4px 0;
        }
        .seed-ed-pair > .seed-ed-slider-row,
        .seed-ed-pair > .seed-ed-font-row { padding: 0; flex: 1 1 200px; min-width: 150px; }
        .seed-ed-pair > .seed-ed-color,
        .seed-ed-pair > .seed-ed-colors { padding: 0; flex: 0 0 auto; }
      </style>
    `;

    let html = styles + `<div class="seed-ed">`;

    // Used by the Title box below (and, for grayIconsWhenOff, by Child Row Visuals further down)
    const showLastChanged = this._config.show_last_changed === true;
    const showTitleText = this._config.show_title !== false;
    const showTitleIcon = this._config.show_title_icon !== false;
    const grayIconsWhenOff = this._config.gray_icons_when_off === true;
    const showCardChevron = this._config.show_card_chevron !== false;

    // Editor header - icon + name + build, matching the Color card's layout.
    html += `
      <div class="seed-ed-header">
        <span class="seed-ed-header-title">Easy Entity Styler Card</span>
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

    html += `
      <details class="seed-ed-row">
        <summary><ha-icon class="seed-ed-summary-icon" icon="mdi:palette-outline"></ha-icon>Card Appearance</summary>
        <div class="seed-ed-collapsible-body">

        <div class="seed-ed-checkbox-row">
          <input type="checkbox" id="ed-card-collapsible" ${cardCollapsible ? 'checked' : ''} />
          <label for="ed-card-collapsible">Make card collapsible (click title to expand/collapse)</label>
        </div>
        ${cardCollapsible ? `
        <div class="seed-ed-checkbox-row">
          <input type="checkbox" id="ed-show-card-chevron" ${showCardChevron ? 'checked' : ''} />
          <label for="ed-show-card-chevron">Show expand/collapse chevron on the title row</label>
        </div>
        <div class="seed-ed-checkbox-row">
          <span style="font-size:var(--ltek-fs-body); color:var(--ltek-c-label);">Default state:</span>
          <select id="ed-card-default-state">
            <option value="expanded" ${(this._config.card_default_state || 'expanded') !== 'collapsed' ? 'selected' : ''}>Expanded</option>
            <option value="collapsed" ${this._config.card_default_state === 'collapsed' ? 'selected' : ''}>Collapsed (title bar only)</option>
          </select>
        </div>
        ` : ''}

        ${this._edCardSub('title', 'Card Header', `
        <div class="seed-ed-group-title">Title Text</div>
        <div class="seed-ed-pair">
          <div class="seed-ed-checkbox-row" style="flex:0 0 auto;padding:0;">
            <input type="checkbox" id="ed-show-title" ${showTitleText ? 'checked' : ''} />
            <label for="ed-show-title">Show</label>
          </div>
          <input type="text" id="ed-title" value="${this._config.title || ''}" placeholder="e.g. SEED" style="flex:1 1 200px;min-width:150px;" />
        </div>
        ${showTitleText ? `
        <div class="seed-ed-pair">
          <div class="seed-ed-slider-row">
            <label><span>Size:</span></label>
            <input type="range" id="ed-title-font-size" min="10" max="40" step="1" value="${this._config.title_font_size || 16}" />
            <span class="seed-ed-slider-value" id="ed-title-font-size-value">${this._config.title_font_size || 16}px</span>
          </div>
          <div class="seed-ed-color">
            <label>Color:</label>
            <input type="color" id="ed-color-title-text" value="${this._config.title_text_color || '#e1e1e1'}" />
          </div>
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
          <label style="margin-left:auto;"><input type="checkbox" id="ed-show-last-changed" ${showLastChanged ? 'checked' : ''} /> Show "last changed" time</label>
        </div>
        ` : ''}

        <div class="seed-ed-group-title">Title Icon</div>
        <div class="seed-ed-pair">
          <div class="seed-ed-checkbox-row" style="flex:0 0 auto;padding:0;">
            <input type="checkbox" id="ed-show-title-icon" ${showTitleIcon ? 'checked' : ''} />
            <label for="ed-show-title-icon">Show</label>
          </div>
          <input type="text" id="ed-title-icon" value="${this._config.title_icon || 'mdi:view-list'}" style="flex:1 1 200px;min-width:150px;" placeholder="mdi:view-list" />
        </div>
        ${showTitleIcon ? `
        <div class="seed-ed-pair">
          <div class="seed-ed-slider-row">
            <label><span>Size:</span></label>
            <input type="range" id="ed-title-icon-size" min="10" max="48" step="1" value="${this._config.title_icon_size || 22}" />
            <span class="seed-ed-slider-value" id="ed-title-icon-size-value">${this._config.title_icon_size || 22}px</span>
          </div>
          <div class="seed-ed-color">
            <label>Color:</label>
            <input type="color" id="ed-color-title-icon" value="${this._config.title_icon_color || '#2196F3'}" />
          </div>
        </div>
        ` : ''}

        ${this._atHeaderRuleRefEditor('__card__', this._config, { flush: true })}
        `)}

        ${this._edCardSub('section-headers', 'Section Header Defaults', `
        <span class="seed-ed-hint">"Show title row" is set per-section below, in each section's settings.</span>
        <div class="seed-ed-checkbox-row">
          <input type="checkbox" id="ed-show-section-count" ${showSectionCount ? 'checked' : ''} />
          <label for="ed-show-section-count">Show the entity count in the title row</label>
        </div>
        <div class="seed-ed-checkbox-row">
          <input type="checkbox" id="ed-auto-close-sections" ${autoCloseSections ? 'checked' : ''} />
          <label for="ed-auto-close-sections">Auto-close other sections when expanding one</label>
        </div>
        `)}

        ${this._edCardSub('scaling', 'Scaling', `
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
        `)}

        ${this._edCardSub('performance', 'Performance', `
        <span class="seed-ed-hint">Minimum time between live refreshes. Raise this if a frequently-updating sensor (e.g. a lux value that keeps resetting "last changed") makes the card refresh too often. 0 = default (~4×/sec).</span>
        <div class="seed-ed-slider-row">
          <label><span>Min refresh:</span></label>
          <input type="range" id="ed-min-refresh" min="0" max="60" step="1" value="${this._config.min_refresh_seconds || 0}" />
          <span class="seed-ed-slider-value" id="ed-min-refresh-value">${(this._config.min_refresh_seconds || 0) === 0 ? 'Default' : (this._config.min_refresh_seconds + 's')}</span>
        </div>
        `)}

        ${this._edCardSub('card-frame', 'Card Frame', `
        <span class="seed-ed-hint">The card's frame (border / glow / shadow / background / edges) comes from Frame Styles, layered here — independent of the per-section frames.</span>
        ${this._atFrameRefEditor('__card_frame__', this._config.card_frame)}
        `)}
        </div>
      </details>
    `;

    const rowBorderColorVal = colors.row_border && colors.row_border !== 'transparent' ? colors.row_border : '#333333';
    const stripStrings = this._config.strip_entity_strings || [];
    // (Global section-divider editor vars removed — dividers are their own sections.)
    const rowIndent = this._config.row_indent ?? 16;
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
    html += `
      <details class="seed-ed-row seed-ed-section-defaults">
        <summary><ha-icon class="seed-ed-summary-icon" icon="mdi:cog-outline"></ha-icon>Section Layout Defaults</summary>
        <div class="seed-ed-collapsible-body">
        <span class="seed-ed-hint">Layout defaults for sections: between-section dividers, entity-group row visuals, and the seed style for new Entity Tables. Frame styling (border / glow / shadow / background / edges) is now defined entirely in <strong>Frame Styles</strong> and applied per section or to the card.</span>

      <details class="seed-ed-substyle seed-ed-substyle-flush" data-panel="row_defaults">
        <summary class="seed-ed-substyle-sum"><ha-icon class="seed-ed-rs-sum-icon" icon="mdi:format-list-bulleted"></ha-icon><span class="seed-ed-substyle-name" style="flex:1;">Entity Group Row Defaults</span></summary>
        <div class="seed-ed-substyle-body">
        <span class="seed-ed-hint">Default row visuals for Entity Group sections (indent + row border). Entity Tables use Entity Table Defaults instead.</span>

        <div class="seed-ed-group-title">Row</div>
        <div class="seed-ed-slider-row">
          <label><span>Row Indent:</span></label>
          <input type="range" id="ed-row-indent" min="0" max="48" step="2" value="${rowIndent}" />
          <span class="seed-ed-slider-value" id="ed-row-indent-value">${rowIndent}px</span>
        </div>

        <div class="seed-ed-group-title">Icon</div>
        <div class="seed-ed-pair">
          <div class="seed-ed-checkbox-row" style="flex:1 1 220px;padding:0;">
            <input type="checkbox" id="ed-gray-icons-when-off" ${grayIconsWhenOff ? 'checked' : ''} />
            <label for="ed-gray-icons-when-off">Gray out icons when off / unavailable</label>
          </div>
          <div class="seed-ed-color">
            <label>Default Icon:</label>
            <input type="color" id="ed-color-icon" value="${colors.icon || '#2196F3'}" />
          </div>
        </div>

        <div class="seed-ed-group-title">Row Border</div>
        <div class="seed-ed-checkbox-row">
          <input type="checkbox" id="ed-show-row-border" ${showRowBorder ? 'checked' : ''} />
          <label for="ed-show-row-border">Enable row borders</label>
        </div>
        <div class="seed-ed-pair">
          <div class="seed-ed-slider-row">
            <label><span>Weight:</span></label>
            <input type="range" id="ed-row-border-width" min="1" max="8" step="1" value="${rowBorderWidth}" />
            <span class="seed-ed-slider-value" id="ed-row-border-width-value">${rowBorderWidth}px</span>
          </div>
          <div class="seed-ed-color">
            <label>Color:</label>
            <input type="color" id="ed-color-row-border" value="${rowBorderColorVal}" />
          </div>
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

      ${this._tableDefaultsPanel()}

        </div>
      </details>

      <details class="seed-ed-row">
        <summary><ha-icon class="seed-ed-summary-icon" icon="mdi:format-text"></ha-icon>Global Entity Name Cleaner</summary>
        <div class="seed-ed-collapsible-body">
        <span class="seed-ed-hint">Strip a substring (e.g. a redundant device or integration prefix) out of every entity name shown on the card.</span>
        <div style="display:flex; gap:6px;">
          <input type="text" id="ed-strip-string-input" placeholder="e.g. Living Room" style="flex:1;" />
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

    // Sections editor - this is where all sections are ordered. One titled
    // panel: the label is the panel header, and the section list + the two
    // "Add ..." buttons all live inside the same bordered box.
    html += `<details class="seed-ed-sections-panel seed-ed-collapsible-panel" open>`;
    html += `<summary class="seed-ed-panel-summary">
      <div class="seed-ed-sections-panel-title"><ha-icon icon="mdi:view-dashboard-outline" class="seed-ed-panel-title-icon"></ha-icon>Section Layout &amp; Config</div>
    </summary>`;
    // Description shows INSIDE the panel (when expanded), like every other panel.
    html += `<span class="seed-ed-hint">Select and Order the card sections. Click the section icon to edit the section settings.</span>`;
    // Add buttons at the TOP of the panel, sharing one row.
    html += `<div class="seed-ed-add-row">
      <div class="seed-ed-add-btn seed-ed-add-btn-sm" id="ed-add-table-menu"><ha-icon icon="mdi:table-plus"></ha-icon>Add Entity Table</div>
      <div class="seed-ed-add-btn seed-ed-add-btn-sm" id="ed-add-section"><ha-icon icon="mdi:plus"></ha-icon>Add Entity Group</div>
      <div class="seed-ed-add-btn seed-ed-add-btn-sm" id="ed-add-divider"><ha-icon icon="mdi:minus"></ha-icon>Add Divider</div>
    </div>`;
    html += `<div id="ed-table-preset-menu" style="display:none; flex-direction:column; gap:4px; margin-top:6px;">
      ${getActivityPresets().map(p => `<div class="seed-ed-add-btn seed-ed-add-btn-sm ed-add-table-preset" data-preset="${p.key}"><ha-icon icon="mdi:plus"></ha-icon>${p.label}</div>`).join('')}
      <div class="seed-ed-add-btn seed-ed-add-btn-sm ed-add-table-preset" data-preset="__blank__"><ha-icon icon="mdi:plus"></ha-icon>Blank entity table</div>
    </div>`;

    // Shared datalist of every entity id, for the Entity Display Rules
    // "compare against another entity" inputs (autocomplete without forcing a
    // giant <select> per rule).
    const allEntityIds = this._hass ? Object.keys(this._hass.states).sort() : [];
    html += `<datalist id="ees-all-entities">${allEntityIds.map(id => `<option value="${id}"></option>`).join('')}</datalist>`;

    const sections = this._config.sections || [];
    sections.forEach((section, idx) => {
      // Divider section: a compact config card (no entities/table/frame editor).
      if (section.type === 'divider') {
        html += this._edDividerSection(section, idx, sections.length);
        return;
      }
      const assigned = new Set(section.entities || []);

      // Friendly display name for any entity id (resolves through the state
      // registry + name-stripping; falls back to the raw id).
      const displayName = (id) => {
        const st = this._hass ? this._hass.states[id] : null;
        const raw = st ? st.attributes.friendly_name || id : id;
        return stripEntityName(raw, this._config.strip_entity_strings);
      };

      // Assigned-entity chips: every entity currently in this section, shown
      // regardless of whether it still matches the card's entity filter (so
      // pre-existing / filtered-out entities remain visible and removable).
      const assignedChipsHtml = (section.entities || []).length
        ? (section.entities || []).map(id => `
            <span class="seed-ed-strip-tag" title="${id}">
              ${displayName(id)}
              <span class="ed-section-entity-remove" data-section-id="${section.id}" data-entity-id="${id}">×</span>
            </span>
          `).join('')
        : `<span class="seed-ed-hint">No entities added yet.</span>`;

      // Candidate picker options: filter-matched entities not already added.
      const pickerOptions = entityOptions.filter(opt => !assigned.has(opt.value));
      const pickerHtml = `
        <option value="">${entityOptions.length ? '-- Select an entity to add --' : 'No entities match the card filter'}</option>
        ${pickerOptions.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
      `;

      const showEntityList = true;

      const headerIcon = section.icon || 'mdi:folder-outline';

      // ---- Entity Display Rules editor markup ----
      const rules = Array.isArray(section.entity_rules) ? section.entity_rules : [];
      const rulesHtml = rules.map((rule, rIdx) => `
        <div class="seed-ed-rule" data-section-id="${section.id}" data-rule-index="${rIdx}">
          ${rIdx > 0 ? `
          <select class="ed-rule-join" data-section-id="${section.id}" data-rule-index="${rIdx}" title="How this rule combines with the ones above">
            <option value="and" ${rule.join !== 'or' ? 'selected' : ''}>AND</option>
            <option value="or" ${rule.join === 'or' ? 'selected' : ''}>OR</option>
          </select>` : `<span class="seed-ed-rule-when">When</span>`}
          <span class="seed-ed-rule-line">
            <span class="seed-ed-rule-label">value</span>
            <select class="ed-rule-operator" data-section-id="${section.id}" data-rule-index="${rIdx}">
              <option value="eq" ${rule.operator !== 'ne' ? 'selected' : ''}>is equal to</option>
              <option value="ne" ${rule.operator === 'ne' ? 'selected' : ''}>is not equal to</option>
            </select>
            <select class="ed-rule-compare-type" data-section-id="${section.id}" data-rule-index="${rIdx}">
              <option value="value" ${rule.compare_type !== 'entity' ? 'selected' : ''}>a value</option>
              <option value="entity" ${rule.compare_type === 'entity' ? 'selected' : ''}>an entity's value</option>
            </select>
            ${rule.compare_type === 'entity'
              ? `<input type="text" class="ed-rule-compare-entity" data-section-id="${section.id}" data-rule-index="${rIdx}" list="ees-all-entities" value="${rule.compare_entity || ''}" placeholder="entity_id" />`
              : `<input type="text" class="ed-rule-value" data-section-id="${section.id}" data-rule-index="${rIdx}" value="${(rule.value || '').replace(/"/g, '&quot;')}" placeholder="e.g. on" />`}
            <ha-icon class="seed-ed-icon-btn ed-rule-remove" icon="mdi:close" data-section-id="${section.id}" data-rule-index="${rIdx}" title="Remove rule"></ha-icon>
          </span>
        </div>
      `).join('');

      // ---- Chip tap/hold action editor markup ----
      // `kind` is 'tap' or 'hold'; drives the data-action-kind attribute so
      // one set of handlers serves both.
      const chipActionHtml = (kind, cfg, label) => {
        cfg = normalizeAction(cfg, kind === 'tap' ? 'more-info' : 'none');
        const sid = section.id;
        const opt = (v, t) => `<option value="${v}" ${cfg.action === v ? 'selected' : ''}>${t}</option>`;
        let extra = '';
        if (cfg.action === 'more-info' || cfg.action === 'toggle') {
          extra = `
            <div class="seed-ed-slider-row">
              <label><span>Entity:</span></label>
              <input type="text" class="ed-chip-action-entity" data-section-id="${sid}" data-action-kind="${kind}" list="ees-all-entities" value="${cfg.action_entity || ''}" placeholder="(chip's own entity)" style="flex:1;" />
            </div>`;
        } else if (cfg.action === 'navigate') {
          extra = `
            <div class="seed-ed-slider-row">
              <label><span>Path:</span></label>
              <input type="text" class="ed-chip-action-navpath" data-section-id="${sid}" data-action-kind="${kind}" value="${(cfg.navigation_path || '').replace(/"/g, '&quot;')}" placeholder="/lovelace/1" style="flex:1;" />
            </div>`;
        } else if (cfg.action === 'url') {
          extra = `
            <div class="seed-ed-slider-row">
              <label><span>URL:</span></label>
              <input type="text" class="ed-chip-action-url" data-section-id="${sid}" data-action-kind="${kind}" value="${(cfg.url_path || '').replace(/"/g, '&quot;')}" placeholder="https://..." style="flex:1;" />
            </div>`;
        } else if (cfg.action === 'call-service') {
          const sd = cfg.service_data && Object.keys(cfg.service_data).length ? JSON.stringify(cfg.service_data) : '';
          extra = `
            <div class="seed-ed-slider-row">
              <label><span>Service:</span></label>
              <input type="text" class="ed-chip-action-service" data-section-id="${sid}" data-action-kind="${kind}" value="${(cfg.service || '').replace(/"/g, '&quot;')}" placeholder="light.turn_on" style="flex:1;" />
            </div>
            <div class="seed-ed-slider-row">
              <label><span>Data (JSON):</span></label>
              <input type="text" class="ed-chip-action-servicedata" data-section-id="${sid}" data-action-kind="${kind}" value="${sd.replace(/"/g, '&quot;')}" placeholder='{"entity_id":"light.x"}' style="flex:1;" />
            </div>`;
        }
        return `
          <div class="seed-ed-checkbox-row">
            <span style="font-size:12px; color:#ccc;">${label}:</span>
            <select class="ed-chip-action" data-section-id="${sid}" data-action-kind="${kind}">
              ${opt('none','No action')}
              ${opt('more-info','More Info dialog')}
              ${opt('toggle','Toggle entity')}
              ${opt('navigate','Navigate')}
              ${opt('url','Open URL')}
              ${opt('call-service','Call Service')}
            </select>
          </div>
          ${extra}`;
      };

      // Small "Reset" pill for a style group's title bar. `group` matches a key
      // in SEED_STYLE_GROUPS; clicking reverts just that group to defaults.
      const resetBtn = (group) =>
        `<span class="seed-ed-reset-btn" data-section-id="${section.id}" data-reset-group="${group}" title="Reset this group to defaults"><ha-icon icon="mdi:backup-restore"></ha-icon>Reset</span>`;

      html += `
        <details class="seed-ed-section${section.hidden ? ' seed-ed-section-hidden' : ''}" data-section-id="${section.id}">
          <summary>
            <span class="seed-ed-section-head">
              <ha-icon class="ed-section-icon-preview" data-section-id="${section.id}" icon="${headerIcon}" style="color: ${section.icon_color || colors.icon || '#2196F3'};"></ha-icon>
              <input type="text" class="ed-section-name" data-section-id="${section.id}" value="${section.name}" placeholder="Section Name" style="flex:1;" />
              <span class="seed-ed-section-type-badge">${section.type === 'activity_table' ? 'Table' : 'Entities'}</span>
              <ha-icon class="seed-ed-icon-btn ed-move-up ${idx === 0 ? 'disabled' : ''}" icon="mdi:arrow-up-bold" data-section-id="${section.id}"></ha-icon>
              <ha-icon class="seed-ed-icon-btn ed-move-down ${idx === sections.length - 1 ? 'disabled' : ''}" icon="mdi:arrow-down-bold" data-section-id="${section.id}"></ha-icon>
              <ha-icon class="seed-ed-icon-btn ed-duplicate-section" icon="mdi:content-copy" data-section-id="${section.id}" title="Duplicate this section"></ha-icon>
              <ha-icon class="seed-ed-icon-btn ed-hide-section" icon="${section.hidden ? 'mdi:eye-off' : 'mdi:eye'}" data-section-id="${section.id}" title="${section.hidden ? 'Hidden — click to show on card' : 'Shown — click to hide from card'}"></ha-icon>
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
            ${(section.show_title !== false && section.collapsible !== false) ? `
            <div class="seed-ed-checkbox-row">
              <span style="font-size:12px; color:#ccc;">Default state:</span>
              <select class="ed-section-default-state" data-section-id="${section.id}">
                <option value="collapsed" ${(section.default_state || 'collapsed') === 'collapsed' ? 'selected' : ''}>Collapsed</option>
                <option value="expanded" ${section.default_state === 'expanded' ? 'selected' : ''}>Expanded</option>
              </select>
            </div>
            <div class="seed-ed-checkbox-row">
              <input type="checkbox" class="ed-section-keep-expanded" data-section-id="${section.id}" ${section.keep_expanded_when_entities ? 'checked' : ''} />
              <label>Keep expanded while entities are displayed in this section</label>
            </div>
            ` : ''}
            ${section.type === 'activity_table' ? this._atSectionBody(section.id, section) : `
            <div class="seed-ed-checkbox-row">
              <input type="checkbox" class="ed-section-chips-only" data-section-id="${section.id}" ${section.chips_only ? 'checked' : ''} />
              <label>Chips Only (every entity in this section renders as just its chip - no row icon or name)</label>
            </div>`}

            <details class="seed-ed-substyle seed-ed-substyle-flush" data-panel="frame">
              <summary class="seed-ed-substyle-sum">
                <span class="seed-ed-substyle-name">Frame (border / glow / shadow / edges)</span>
                <span class="seed-ed-hint">${section.frame ? ((section.frame.presets || []).length + ' preset(s)') : 'none'}</span>
              </summary>
              <div class="seed-ed-substyle-body">
                <span class="seed-ed-hint">This section's frame comes entirely from Frame Styles (defined in the Frame Styles panel). Choose a Default and layer presets on top.</span>
                ${this._atFrameRefEditor(section.id, section.frame)}
              </div>
            </details>

            ${section.type === 'activity_table' ? `
            <details class="seed-ed-substyle seed-ed-substyle-flush" data-panel="row_visuals">
              <summary class="seed-ed-substyle-sum">
                <span class="seed-ed-substyle-name">Row Layout</span>
                <select class="ed-section-row-visuals-mode seed-ed-sum-select" data-section-id="${section.id}">
                  <option value="global" ${(section.row_visuals_mode || 'global') === 'global' ? 'selected' : ''}>Use Section Default Row Visuals</option>
                  <option value="custom" ${section.row_visuals_mode === 'custom' ? 'selected' : ''}>Custom</option>
                </select>
              </summary>
              <div class="seed-ed-substyle-body">
              <span class="seed-ed-hint">Row indent + row borders for this table's rows.</span>
              ${section.row_visuals_mode === 'custom' ? this._rowVisualsControls(section, colors) : '<span class="seed-ed-hint">Using the selected mode. Switch to Custom for options.</span>'}
              <div class="seed-ed-reset-row">${resetBtn('row_visuals')}</div>
              </div>
            </details>` : ''}

            ${section.type === 'activity_table' ? '' : `
            <details class="seed-ed-substyle seed-ed-substyle-flush" data-panel="section_header">
              <summary class="seed-ed-substyle-sum">
                <span class="seed-ed-substyle-name">Section Header</span>
                <span class="seed-ed-hint">icon / title / count / visibility</span>
              </summary>
              <div class="seed-ed-substyle-body">
              <div class="seed-ed-group-div" style="margin:2px 0 6px;">Header style${resetBtn('header')}</div>
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
              <div class="seed-ed-slider-row">
                <label><span>Header Indent:</span></label>
                <input type="range" class="ed-section-title-indent" data-section-id="${section.id}" min="0" max="48" step="2" value="${section.title_indent ?? 0}" />
                <span class="seed-ed-slider-value ed-section-title-indent-value" data-section-id="${section.id}">${section.title_indent ?? 0}px</span>
              </div>

              <div class="seed-ed-group-div" style="margin:12px 0 6px;">Entity count in header${resetBtn('count')}</div>
              <div class="seed-ed-checkbox-row">
                <span style="font-size:12px; color:#ccc;">Display:</span>
                <select class="ed-count-mode" data-section-id="${section.id}">
                  <option value="off" ${(section.count_mode || 'off') === 'off' ? 'selected' : ''}>Off</option>
                  <option value="title" ${section.count_mode === 'title' ? 'selected' : ''}>Next to title (e.g. "Name - 2")</option>
                  <option value="right" ${section.count_mode === 'right' ? 'selected' : ''}>Far right (in place of the time value)</option>
                </select>
              </div>
              ${section.count_mode === 'title' ? `
              <div class="seed-ed-slider-row">
                <label><span>Prefix:</span></label>
                <input type="text" class="ed-count-prefix" data-section-id="${section.id}" value="${(section.count_prefix ?? ' - ').replace(/"/g, '&quot;')}" placeholder=" - " style="flex:1;" />
              </div>
              ` : ''}
              ${section.count_mode && section.count_mode !== 'off' ? `
              <div class="seed-ed-style-grid">
                <div class="seed-ed-style-field">
                  <label>Color</label>
                  <input type="color" class="ed-count-color" data-section-id="${section.id}" value="${section.count_color || colors.secondary_text || '#808080'}" />
                </div>
                <div class="seed-ed-style-field">
                  <label>Font size (px)</label>
                  <input type="number" class="ed-count-font-size" data-section-id="${section.id}" min="8" max="36" value="${section.count_font_size ?? 13}" />
                </div>
              </div>
              <div class="seed-ed-font-row">
                <label>Weight:
                  <select class="ed-count-font-weight" data-section-id="${section.id}">
                    <option value="400" ${(section.count_font_weight || 400) == 400 ? 'selected' : ''}>Normal</option>
                    <option value="600" ${section.count_font_weight == 600 ? 'selected' : ''}>Semibold</option>
                    <option value="700" ${section.count_font_weight == 700 ? 'selected' : ''}>Bold</option>
                    <option value="900" ${section.count_font_weight == 900 ? 'selected' : ''}>Black</option>
                  </select>
                </label>
                <label><input type="checkbox" class="ed-count-font-italic" data-section-id="${section.id}" ${section.count_font_style === 'italic' ? 'checked' : ''} /> Italic</label>
              </div>
              ` : ''}

              <div class="seed-ed-group-div" style="margin:12px 0 6px;">Section display</div>
              <div class="seed-ed-checkbox-row">
                <span style="font-size:12px; color:#ccc;">When rules leave no entities:</span>
                <select class="ed-section-display" data-section-id="${section.id}">
                  <option value="always" ${(section.section_display || 'always') === 'always' ? 'selected' : ''}>Always show the section</option>
                  <option value="hide_when_empty" ${section.section_display === 'hide_when_empty' ? 'selected' : ''}>Hide the whole section (header included)</option>
                </select>
              </div>
              ${this._atHeaderRuleRefEditor(section.id, section)}
              </div>
            </details>
            `}

            ${section.type === 'activity_table' ? '' : `
            <details class="seed-ed-substyle seed-ed-substyle-flush" data-panel="entity_rows">
              <summary class="seed-ed-substyle-sum">
                <span class="seed-ed-substyle-name">Entity Rows</span>
                <span class="seed-ed-hint">layout / style / secondary line</span>
              </summary>
              <div class="seed-ed-substyle-body">
              <div class="seed-ed-group-div" style="margin:2px 0 6px;">Row layout${resetBtn('row_visuals')}</div>
              <div class="seed-ed-checkbox-row">
                <span style="font-size:12px; color:#ccc;">Row visuals:</span>
                <select class="ed-section-row-visuals-mode" data-section-id="${section.id}">
                  <option value="global" ${(section.row_visuals_mode || 'global') === 'global' ? 'selected' : ''}>Use Section Default Row Visuals</option>
                  <option value="custom" ${section.row_visuals_mode === 'custom' ? 'selected' : ''}>Custom</option>
                </select>
              </div>
              ${section.row_visuals_mode === 'custom' ? this._rowVisualsControls(section, colors) : ''}
              <div class="seed-ed-group-div" style="margin:12px 0 6px;">Row style (every entity in this section)${resetBtn('entity_row')}</div>
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
            `}

            ${section.type === 'activity_table' ? '' : (() => {
              const si = section.secondary_info || {};
              const on = si.enabled === true;
              const SI_SOURCES = [['attribute','Attribute'],['state','State'],['area','Area'],['last_changed_ago','Time since change'],['last_changed_time','Change clock time'],['entity_id','Entity ID'],['integration','Integration']];
              return `
              <div class="seed-ed-group-div" style="margin:12px 0 6px;">Secondary info line (under the name)</div>
              <span class="seed-ed-hint">A small string beneath the entity name, e.g. "Zone 1" from an attribute (like the native multiple-entity-row).</span>
              <div class="seed-ed-checkbox-row">
                <input type="checkbox" class="ed-si-enabled" data-section-id="${section.id}" ${on ? 'checked' : ''} />
                <label>Show secondary info line</label>
              </div>
              ${on ? `
              <div class="seed-ed-style-grid">
                <div class="seed-ed-style-field">
                  <label>Source</label>
                  <select class="ed-si-source" data-section-id="${section.id}">
                    ${SI_SOURCES.map(([v,l]) => `<option value="${v}" ${(si.source||'attribute')===v?'selected':''}>${l}</option>`).join('')}
                  </select>
                </div>
                ${(si.source||'attribute')==='attribute' ? `
                <div class="seed-ed-style-field">
                  <label>Attribute</label>
                  <input type="text" class="ed-si-attribute" data-section-id="${section.id}" value="${escapeHtml(si.attribute||'')}" placeholder="zone" />
                </div>` : ''}
                <div class="seed-ed-style-field">
                  <label>Prefix (optional)</label>
                  <input type="text" class="ed-si-prefix" data-section-id="${section.id}" value="${escapeHtml(si.prefix||'')}" placeholder="Zone " />
                </div>
                <div class="seed-ed-style-field">
                  <label>Text color</label>
                  <label class="seed-ed-custom-toggle"><input type="checkbox" class="ed-si-color-custom" data-section-id="${section.id}" ${si.color ? 'checked' : ''} /> Custom</label>
                  ${si.color ? `<input type="color" class="ed-si-color" data-section-id="${section.id}" value="${/^#[0-9a-fA-F]{6}$/.test(si.color) ? si.color : '#808080'}" />` : ''}
                </div>
                <div class="seed-ed-style-field">
                  <label>Font size (px)</label>
                  <input type="number" class="ed-si-font-size" data-section-id="${section.id}" min="8" max="28" value="${si.font_size ?? 12}" />
                </div>
                <div class="seed-ed-style-field">
                  <label>Indent (px)</label>
                  <input type="number" class="ed-si-indent" data-section-id="${section.id}" min="0" max="64" value="${si.indent ?? 0}" />
                </div>
              </div>
              <div class="seed-ed-font-row">
                <label>Weight:
                  <select class="ed-si-font-weight" data-section-id="${section.id}">
                    <option value="400" ${(si.font_weight||400)==400?'selected':''}>Normal</option>
                    <option value="600" ${(si.font_weight||400)==600?'selected':''}>Semibold</option>
                    <option value="700" ${(si.font_weight||400)==700?'selected':''}>Bold</option>
                  </select>
                </label>
                <label><input type="checkbox" class="ed-si-italic" data-section-id="${section.id}" ${si.italic ? 'checked' : ''} /> Italic</label>
              </div>` : ''}
              </div>
            </details>
            `; })()}

            ${section.type === 'activity_table' ? '' : `
            <details class="seed-ed-substyle seed-ed-substyle-flush" data-panel="chip">
              <summary class="seed-ed-substyle-sum">
                <span class="seed-ed-substyle-name">Chip Style</span>
                <span class="seed-ed-hint">chips-only sections</span>
              </summary>
              <div class="seed-ed-substyle-body">
              <div class="seed-ed-group-div" style="margin:2px 0 6px;">Chip style${resetBtn('chip')}</div>
              <span class="seed-ed-hint">Each color inherits the card's global chip color until you enable "Custom". (A blank/inherited value can be a translucent global default, which a color box can't show — hence the toggle.)</span>
              <div class="seed-ed-style-grid">
                <div class="seed-ed-style-field">
                  <label>Background</label>
                  <label class="seed-ed-custom-toggle"><input type="checkbox" class="ed-chip-bg-custom" data-section-id="${section.id}" ${section.chip_bg ? 'checked' : ''} /> Custom</label>
                  ${section.chip_bg ? `<input type="color" class="ed-chip-bg" data-section-id="${section.id}" value="${/^#[0-9a-fA-F]{6}$/.test(section.chip_bg) ? section.chip_bg : '#2196F3'}" />` : ''}
                </div>
                <div class="seed-ed-style-field">
                  <label>Border</label>
                  <label class="seed-ed-custom-toggle"><input type="checkbox" class="ed-chip-border-custom" data-section-id="${section.id}" ${section.chip_border_color ? 'checked' : ''} /> Custom</label>
                  ${section.chip_border_color ? `<input type="color" class="ed-chip-border-color" data-section-id="${section.id}" value="${/^#[0-9a-fA-F]{6}$/.test(section.chip_border_color) ? section.chip_border_color : '#2196F3'}" />` : ''}
                </div>
                <div class="seed-ed-style-field">
                  <label>Text</label>
                  <label class="seed-ed-custom-toggle"><input type="checkbox" class="ed-chip-text-custom" data-section-id="${section.id}" ${section.chip_text_color ? 'checked' : ''} /> Custom</label>
                  ${section.chip_text_color ? `<input type="color" class="ed-chip-text-color" data-section-id="${section.id}" value="${/^#[0-9a-fA-F]{6}$/.test(section.chip_text_color) ? section.chip_text_color : '#64b5f6'}" />` : ''}
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
                  <option value="entity" ${(section.chip_icon_source || 'entity') === 'entity' ? 'selected' : ''}>Entity's own icon</option>
                  <option value="section" ${section.chip_icon_source === 'section' ? 'selected' : ''}>This section's icon</option>
                  <option value="none" ${section.chip_icon_source === 'none' ? 'selected' : ''}>None</option>
                </select>
              </div>
              <div class="seed-ed-checkbox-row">
                <input type="checkbox" class="ed-chip-show-name" data-section-id="${section.id}" ${section.chip_show_name ? 'checked' : ''} />
                <label>Show the entity's (stripped) name in the chip</label>
              </div>
              <div class="seed-ed-checkbox-row">
                <input type="checkbox" class="ed-chip-hide-state" data-section-id="${section.id}" ${section.chip_hide_state ? 'checked' : ''} />
                <label>Hide the entity state/value on the chip</label>
              </div>
              <span class="seed-ed-hint">Hide the chip entirely when the entity is:</span>
              <div class="seed-ed-checkbox-row">
                <input type="checkbox" class="ed-chip-hide-off" data-section-id="${section.id}" ${section.chip_hide_off ? 'checked' : ''} />
                <label>Off</label>
              </div>
              <div class="seed-ed-checkbox-row">
                <input type="checkbox" class="ed-chip-hide-unknown" data-section-id="${section.id}" ${section.chip_hide_unknown ? 'checked' : ''} />
                <label>Unknown</label>
              </div>
              <div class="seed-ed-checkbox-row">
                <input type="checkbox" class="ed-chip-hide-unavailable" data-section-id="${section.id}" ${section.chip_hide_unavailable ? 'checked' : ''} />
                <label>Unavailable</label>
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
            </details>

            <details class="seed-ed-substyle seed-ed-substyle-flush" data-panel="chip_actions">
              <summary class="seed-ed-substyle-sum">
                <span class="seed-ed-substyle-name">Chip Actions</span>
                <span class="seed-ed-hint">tap / hold</span>
              </summary>
              <div class="seed-ed-substyle-body">
              <div class="seed-ed-group-div" style="margin:2px 0 6px;">Chip actions${resetBtn('chip_actions')}</div>
              <span class="seed-ed-hint">Tap and hold (press &amp; hold ~0.5s) actions for chips in this section.</span>
              ${chipActionHtml('tap', section.chip_tap_action, 'Tap')}
              ${chipActionHtml('hold', section.chip_hold_action, 'Hold')}
              </div>
            </details>

            `}
            ${section.type === 'activity_table' ? `
            <details class="seed-ed-substyle seed-ed-substyle-flush" data-panel="se-filter-${section.id}">
              <summary class="seed-ed-substyle-sum"><ha-icon icon="mdi:filter-variant" class="seed-ed-rs-sum-icon"></ha-icon><span class="seed-ed-substyle-name">Entity Filters</span></summary>
              <div class="seed-ed-substyle-body">${this._atMembershipPanel(section)}</div>
            </details>
            ` : `
            <details class="seed-ed-substyle seed-ed-substyle-flush" data-panel="se-entities-${section.id}">
              <summary class="seed-ed-substyle-sum"><ha-icon icon="mdi:format-list-bulleted" class="seed-ed-rs-sum-icon"></ha-icon><span class="seed-ed-substyle-name">Entities</span></summary>
              <div class="seed-ed-substyle-body">
                <div class="seed-ed-group-div" style="margin:2px 0 6px;">Selected entities</div>
                ${this._sectionSelectedChipsHtml(section, assignedChipsHtml)}
                ${this._sectionEntitySearchHtml(section, pickerOptions)}
                ${this._atMembershipPanel(section)}
              </div>
            </details>
            <details class="seed-ed-substyle seed-ed-substyle-flush" data-panel="se-display-${section.id}">
              <summary class="seed-ed-substyle-sum"><ha-icon icon="mdi:eye-check-outline" class="seed-ed-rs-sum-icon"></ha-icon><span class="seed-ed-substyle-name">Display Rules &amp; Names</span></summary>
              <div class="seed-ed-substyle-body">
                <div class="seed-ed-group-div" style="margin:2px 0 6px;">Entity Display Rules</div>
                <span class="seed-ed-hint">Of the selected entities, each is shown only if it passes these rules (checked per entity, top to bottom; each joins the running result with AND / OR). No rules = show all.</span>
                <div class="seed-ed-rules" data-section-id="${section.id}">${rulesHtml || '<span class="seed-ed-hint">No rules — every entity is shown.</span>'}</div>
                <div class="seed-ed-mini-btn ed-rule-add" data-section-id="${section.id}"><ha-icon icon="mdi:plus"></ha-icon>Add Rule</div>
                ${this._atNameCleanerHtml(section)}
              </div>
            </details>
            `}
          </div>
        </details>
      `;
    });

    html += `</details>`; // .seed-ed-sections-panel

    // LIBRARIES section divider — groups the reusable-definition panels
    // (Entity Filter Rules, Frame Styles, Header Rules) under one heading.
    html += `<div class="seed-ed-lib-divider"><ha-icon icon="mdi:bookshelf"></ha-icon>Libraries</div>`;

    // Global Entity Filter Rules panel.
    html += this._atRuleSetsPanel();

    // Global Frame Styles panel.
    html += this._atFramePresetsPanel();
    html += this._atHeaderRuleSetsPanel();

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

  // Delegated listeners for every activity-table control. Each control carries
  // data-at-sid + either data-at-path (set a value) or data-at-list/idx (list
  // ops: add/delete/move). Parse the value by input type, coercing numbers and
  // comma-lists where the path expects them.
  _attachActivityTableListeners() {
    const coerce = (el, path) => {
      if (el.type === 'checkbox') return el.checked;
      let v = el.value;
      // Comma-list paths: values arrays, pin_top, strip_strings.
      if (el.classList.contains('at-input-multi') || /\.values$|\.pin_top$|\.strip_strings$/.test(path)) {
        return v.split(',').map(s => s.trim()).filter(Boolean);
      }
      // Sliders and known numeric styling paths -> numbers. (Condition/filter
      // `.value` is intentionally NOT coerced here - it may be a string like
      // 'window'; applyOp does Number() itself for numeric ops.)
      if (el.type === 'range' || el.type === 'number' ||
          /\.(size|font_size|weight|width|default_weight|window_minutes)$/.test(path)) {
        const n = Number(v);
        if (!Number.isNaN(n) && v !== '') return n;
      }
      return v;
    };

    // Value / select / checkbox edits.
    //
    // The editor must NOT rebuild the DOM on a routine edit - a rebuild loses a
    // text field's caret AND collapses/scrolls the panels (what reads as "the
    // panel refreshed"). So the default for EVERY control - text, number, range,
    // color, select, checkbox - is a LIVE apply that updates config + card
    // without re-rendering the editor.
    //
    // Only controls explicitly marked `.at-structural` re-render, because they
    // reveal/hide OTHER controls (e.g. column kind, value source, filter
    // field/op single-vs-list, count mode, paired-entity match). Even then,
    // open sub-panel state + scroll are preserved across the rebuild.
    const bind = el => {
      const sid = el.dataset.atSid;
      const path = el.dataset.atPath;
      if (!sid || !path) return;

      const structural = el.classList.contains('at-structural');
      if (structural) {
        el.addEventListener('change', () => {
          this._atApply(sid, sec => this._atSet(sec, path, coerce(el, path)));
        });
        return;
      }

      const applyLive = () => this._atApplyLive(sid, sec => this._atSet(sec, path, coerce(el, path)));
      // Selects/checkboxes commit on 'change'; text/number/range/color also
      // fire 'input' for immediate feedback (with slider-label sync).
      el.addEventListener('input', () => {
        if (el.type === 'range') {
          const lbl = el.parentElement && el.parentElement.querySelector('.at-slider-val');
          if (lbl) lbl.textContent = el.value === '0' && el.dataset.atZero ? el.dataset.atZero : el.value;
        }
        applyLive();
      });
      el.addEventListener('change', applyLive);
    };
    // Controls with dedicated handlers below (they mutate object shape, not a
    // scalar, so the generic scalar-set bind must NOT touch them).
    const DEDICATED = ['at-group-kind', 'at-cond-what', 'at-cond-kind', 'at-width-mode', 'at-width-val', 'at-gradient-toggle', 'at-color-mode'];
    this.querySelectorAll('.at-input[data-at-path], .at-check[data-at-path]').forEach(el => {
      if (DEDICATED.some(c => el.classList.contains(c))) return;
      bind(el);
    });

    // Frame preset name: reflect edits in the collapsible summary title live, so
    // the panel doesn't look "unsaved" until another control forces a re-render.
    // (The value itself already persists via the generic live-apply above.)
    this.querySelectorAll('.at-input[data-at-path="name"][data-at-sid]').forEach(el => {
      el.addEventListener('input', () => {
        const panel = this.querySelector(`[data-panel="effect-${el.dataset.atSid}"] .seed-ed-substyle-name`);
<<<<<<< HEAD
        if (panel) panel.textContent = el.value || 'Frame Style';
=======
        if (panel) panel.textContent = el.value || 'Frame Preset';
>>>>>>> d65989548fdbf203a804606d75440bca7a95012c
      });
    });

    // Column width mode picker (Auto / px / % / fr): sets a sensible default
    // width for the chosen unit, then re-renders so the matching value control
    // appears. Structural.
    this.querySelectorAll('.at-width-mode').forEach(el => {
      el.addEventListener('change', () => {
        const sid = el.dataset.atSid, path = el.dataset.atPath;
        const mode = el.value;
        const val = mode === 'auto' ? 0 : mode === 'px' ? 42 : mode === 'pct' ? '20%' : '1fr';
        this._atApply(sid, sec => this._atSet(sec, path, val));
      });
    });
    // Column width value input for % / fr: append the unit and store as string.
    this.querySelectorAll('.at-width-val').forEach(el => {
      const apply = () => {
        const sid = el.dataset.atSid, path = el.dataset.atPath, unit = el.dataset.atWidthUnit;
        const n = parseFloat(el.value);
        const val = Number.isFinite(n) && n > 0 ? `${n}${unit}` : 0;
        this._atApplyLive(sid, sec => this._atSet(sec, path, val));
      };
      el.addEventListener('input', apply);
      el.addEventListener('change', apply);
    });

    // Colour-mode picker (_atColorField): Default clears the value; Custom seeds
    // the last hex; Theme seeds the last var(--…). Structural — re-renders to
    // swap in the matching value control.
    this.querySelectorAll('.at-color-mode').forEach(el => {
      el.addEventListener('change', () => {
        const sid = el.dataset.atSid, path = el.dataset.atPath, mode = el.value;
        const val = mode === 'unset' ? '' : mode === 'theme' ? (el.dataset.atColorTheme || 'var(--primary-color)') : (el.dataset.atColorHex || '#2196F3');
        this._atApply(sid, sec => {
          if (val === '') {
            // Remove the key entirely so nothing is emitted (byte-stable).
            const parts = path.split('.'); const key = parts.pop();
            const parent = this._atGet(sec, parts.join('.'));
            if (parent && typeof parent === 'object') delete parent[key];
          } else {
            this._atSet(sec, path, val);
          }
        });
      });
    });

    // Color-gradient toggle: enabling seeds two default stops; disabling removes
    // the gradient entirely. Structural (reveals/hides the stop editor).
    this.querySelectorAll('.at-gradient-toggle').forEach(el => {
      el.addEventListener('change', () => {
        const sid = el.dataset.atSid, path = el.dataset.atPath; // path = ...gradient
        this._atApply(sid, sec => {
          if (el.checked) {
            this._atSet(sec, path, { stops: [{ value: 0, color: '#3c3834' }, { value: 900, color: '#ffee00' }] });
          } else {
            // Remove the gradient key from its parent.
            const parts = path.split('.');
            const key = parts.pop();
            const parent = this._atGet(sec, parts.join('.'));
            if (parent && typeof parent === 'object') delete parent[key];
          }
        });
      });
    });

    // Effect sub-object toggles (glow/shadow/border/when): seed a sensible
    // default object on enable, delete the key on disable. Structural.
    this.querySelectorAll('.at-fx-obj-toggle').forEach(el => {
      el.addEventListener('change', () => {
        const sid = el.dataset.atSid, key = el.dataset.fxKey;
        const defaults = {
          glow: { color: '#2196F3', intensity: 1.0, borders_only: false },
          shadow: { color: '#000000', x: 0, y: 4, blur: 12, spread: 0, opacity: 0.35 },
<<<<<<< HEAD
          border: { color: '#2196F3', width: 1, radius: 12, corners: [true, true, true, true], follow_icon: false, sides: ['top', 'bottom', 'left', 'right'] },
=======
          border: { color: '#2196F3', width: 1, radius: 12, follow_icon: false, sides: ['top', 'bottom', 'left', 'right'] },
>>>>>>> d65989548fdbf203a804606d75440bca7a95012c
          background: { mode: 'custom', color: '#1c1c1c' }
        };
        this._atApply(sid, fx => {
          if (el.checked) { fx[key] = defaults[key]; }
          else { delete fx[key]; }
        });
      });
    });

    // Frame preset "Only apply when…" master toggle. Enable seeds an entity
    // condition (the default kind); disable clears every condition field.
    this.querySelectorAll('.fx-when-toggle').forEach(el => {
      el.addEventListener('change', () => {
        const fid = el.dataset.fxId;
        this._atApply(fid, fx => {
          if (el.checked) { fx.when = { op: 'eq', value: '' }; fx.when_entity = fx.when_entity || ''; }
          else { delete fx.when; delete fx.when_entity; delete fx.when_kind; delete fx.when_section; }
        });
      });
    });

    // Frame preset condition-kind picker: entity state vs section membership.
    // Switching kinds swaps which fields the preset carries (normalizeFramePreset
    // keeps only the active kind's keys).
    this.querySelectorAll('.fx-when-kind').forEach(el => {
      el.addEventListener('change', () => {
        const fid = el.dataset.fxId, kind = el.value;
        this._atApply(fid, fx => {
          if (kind === 'entity') {
            delete fx.when_kind; delete fx.when_section;
            fx.when = fx.when || { op: 'eq', value: '' };
            fx.when_entity = fx.when_entity || '';
          } else {
            delete fx.when; delete fx.when_entity;
            fx.when_kind = kind;
            fx.when_section = fx.when_section || '';
          }
        });
      });
    });

    // Frame preset background mode: custom color / transparent / theme.
    // 'custom' carries a color; the other modes are mode-only. Structural
    // (shows/hides the color picker).
    this.querySelectorAll('.fx-bg-mode').forEach(el => {
      el.addEventListener('change', () => {
        const fid = el.dataset.fxId, mode = el.value;
        this._atApply(fid, fx => {
          if (mode === 'custom') {
            fx.background = { mode: 'custom', color: (fx.background && fx.background.color) || '#1c1c1c' };
          } else {
            fx.background = { mode };
          }
        });
      });
    });

<<<<<<< HEAD
    // Gradient-border pattern picker (per side): applies a preset's stops to
    // that edge and records the pattern name. '' = Custom (leave stops as-is).
    this.querySelectorAll('.fx-edge-pattern').forEach(el => {
      el.addEventListener('change', () => {
        const fid = el.dataset.fxId, side = el.dataset.fxSide, pat = el.value;
        this._atApply(fid, fx => {
          fx.edges = fx.edges || {};
          const cur = fx.edges[side] || { enabled: true, thickness: 1, stops: [] };
          if (pat && EDGE_GRADIENT_PATTERNS[pat]) {
            fx.edges[side] = { ...cur, enabled: true, pattern: pat,
              stops: JSON.parse(JSON.stringify(EDGE_GRADIENT_PATTERNS[pat])) };
          } else {
            // Custom: keep current stops, drop the pattern tag.
            const { pattern, ...rest } = cur;
            fx.edges[side] = rest;
          }
        });
      });
    });

    // Per-stop color SOURCE mode: Color (a hex) / Match (border-icon color) /
    // Transparent. Mirrors the Divider stop-mode dropdown. Structural so the
    // color picker enables/disables to match.
    this.querySelectorAll('.fx-edge-stop-mode').forEach(el => {
      el.addEventListener('change', () => {
        const fid = el.dataset.fxId, side = el.dataset.fxSide, i = Number(el.dataset.fxIdx), mode = el.value;
        this._atApply(fid, fx => {
          if (!fx.edges || !fx.edges[side] || !Array.isArray(fx.edges[side].stops) || !fx.edges[side].stops[i]) return;
          const st = fx.edges[side].stops[i];
          if (mode === 'match') st.color = 'match';
          else if (mode === 'transparent') st.color = 'transparent';
          else if (!/^#[0-9a-f]{6}$/i.test(st.color || '')) st.color = '#2196F3';
          delete fx.edges[side].pattern;   // manual edit → custom
        });
      });
    });

    // Solid-edge color SOURCE: Match / Theme / Custom. Structural (_atApply
    // re-renders so the Custom color picker shows/hides to match).
    this.querySelectorAll('.fx-edge-solid-mode').forEach(el => {
      el.addEventListener('change', () => {
        const fid = el.dataset.fxId, side = el.dataset.fxSide, mode = el.value;
        this._atApply(fid, fx => {
          fx.edges = fx.edges || {};
          const cur = fx.edges[side] || { enabled: true, thickness: 1, gradient: false };
          if (mode === 'match') cur.color = 'match';
          else if (mode === 'theme') cur.color = 'theme';
          else if (!/^#[0-9a-f]{6}$/i.test(cur.color || '')) cur.color = '#2196F3';
          cur.gradient = false;
          fx.edges[side] = cur;
        });
      });
    });

    // Edge sub-mode: Solid line ↔ Gradient. Seeds a sensible default for the
    // chosen mode (a center-fade gradient, or a solid 'match' line).
    this.querySelectorAll('.fx-edge-mode').forEach(el => {
      el.addEventListener('change', () => {
        const fid = el.dataset.fxId, side = el.dataset.fxSide, mode = el.value;
        this._atApply(fid, fx => {
          fx.edges = fx.edges || {};
          const cur = fx.edges[side] || { enabled: true, thickness: 1 };
          if (mode === 'solid') {
            fx.edges[side] = { enabled: true, thickness: cur.thickness || 1, gradient: false, color: cur.color || 'match' };
          } else {
            fx.edges[side] = { enabled: true, thickness: cur.thickness || 1, gradient: true, pattern: 'center_fade',
              stops: JSON.parse(JSON.stringify(EDGE_GRADIENT_PATTERNS.center_fade)) };
          }
        });
      });
    });

    // "All edges the same" toggle — normalizeEdges mirrors top→all when on.
    this.querySelectorAll('.fx-edges-allsame').forEach(el => {
      el.addEventListener('change', () => {
        const fid = el.dataset.fxId;
        this._atApply(fid, fx => {
          fx.edges = fx.edges || {};
          if (el.checked) {
            fx.edges.all_same = true;
            // Ensure the source (top) is enabled so there's something to mirror.
            fx.edges.top = fx.edges.top || { enabled: true, thickness: 1, gradient: true, pattern: 'center_fade', stops: JSON.parse(JSON.stringify(EDGE_GRADIENT_PATTERNS.center_fade)) };
            if (!fx.edges.top.enabled) fx.edges.top.enabled = true;
          } else {
            delete fx.edges.all_same;
          }
        });
      });
    });

=======
>>>>>>> d65989548fdbf203a804606d75440bca7a95012c
    // Effect border side toggles: maintain the border.sides array.
    this.querySelectorAll('.fx-border-side').forEach(el => {
      el.addEventListener('change', () => {
        const sid = el.dataset.atSid, side = el.dataset.fxSide;
        this._atApplyLive(sid, fx => {
          fx.border = fx.border || {};
          const set = new Set(Array.isArray(fx.border.sides) ? fx.border.sides : ['top', 'bottom', 'left', 'right']);
          if (el.checked) set.add(side); else set.delete(side);
          fx.border.sides = ['top', 'bottom', 'left', 'right'].filter(s => set.has(s));
        });
      });
    });

    // Frame Style dirty-draft Save / Discard (per lib: preset).
    this.querySelectorAll('.fx-save-draft').forEach(el => el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const d = this._frameDrafts[el.dataset.fxSlug];
      if (!d || !d.dirty) return;   // disabled visual = no-op
      this._saveFrameDraft(el.dataset.fxSlug);
    }));
    this.querySelectorAll('.fx-discard-draft').forEach(el => el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const d = this._frameDrafts[el.dataset.fxSlug];
      if (!d || !d.dirty) return;
      this._discardFrameDraft(el.dataset.fxSlug);
    }));

    // Add Frame Style — creates a new preset directly in the shared System
    // library (there is no card-local frame concept).
    // ---- Header Rule Set library: add / duplicate / delete ----
    const hdrScope = () => (this._config && this._config.header_library_scope) || 'system';
    // Reflect a new map in the module cache immediately so the UI shows it
    // before the subscription round-trips (mirrors _saveHeaderDraft).
    const hdrEcho = (scope, map) => { SEED_HEADER_LIBRARY[scope === 'system' ? 'system' : 'user'].map = map; };
    const hdrAdd = this.querySelector('#hdr-add');
    if (hdrAdd) hdrAdd.addEventListener('click', () => {
      const scope = hdrScope();
      const map = { ...headerLibraryMap(scope) };
      const base = 'New Header Rule';
      let slug = headerLibSlug(base), n = 2;
      while (map[slug]) { slug = headerLibSlug(base + ' ' + n); n++; }
      map[slug] = normalizeHeaderRuleSet({ name: n > 2 ? `${base} ${n - 1}` : base, rules: [{ when: { op: 'is_on' }, set_icon_color: 'var(--primary-color)' }] });
      hdrEcho(scope, map);
      saveHeaderLibrary(this._hass, scope, map).then(() => this.renderEditor()).catch(() => this.renderEditor());
    });
    this.querySelectorAll('.hdr-duplicate').forEach(el => el.addEventListener('click', () => {
      const scope = hdrScope();
      const map = { ...headerLibraryMap(scope) };
      const srcSlug = el.dataset.hdrSlug;
      // Duplicate the CURRENT (draft-aware) look if the source has unsaved edits.
      const src = srcSlug === BUILTIN_HEADER_SLUG ? builtinHeaderRuleSet() : (this._headerDisplaySet(srcSlug) || map[srcSlug]);
      if (!src) return;
      const base = (src.name || 'Header Rules') + ' (copy)';
      let slug = headerLibSlug(base), n = 2;
      while (map[slug]) { slug = headerLibSlug(base + ' ' + n); n++; }
      const copy = normalizeHeaderRuleSet(JSON.parse(JSON.stringify(src))); copy.name = base; delete copy._builtin; delete copy.id;
      map[slug] = copy;
      hdrEcho(scope, map);
      saveHeaderLibrary(this._hass, scope, map).then(() => this.renderEditor()).catch(() => this.renderEditor());
    }));
    this.querySelectorAll('.hdr-delete').forEach(el => el.addEventListener('click', () => {
      const slug = el.dataset.hdrSlug;
      if (!window.confirm('Delete this Header Rule Set from the shared library? Sections referencing it will fall back to no header rules.')) return;
      const scope = hdrScope();
      const map = { ...headerLibraryMap(scope) };
      delete map[slug];
      delete this._headerDrafts[slug];   // drop any staged edits for the deleted set
      hdrEcho(scope, map);
      saveHeaderLibrary(this._hass, scope, map).then(() => this.renderEditor()).catch(() => this.renderEditor());
    }));

    // ---- Header Rule Set portability: export / import ----
    const hdrPortalStatus = (msg) => { const s = this.querySelector('#hdr-portal-status'); if (s) s.textContent = msg || ''; };
    const hdrNowISO = () => { try { return new Date().toISOString().slice(0, 10); } catch (e) { return ''; } };
    const hdrCopyText = (text) => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
      }
      try {
        const ta = this.querySelector('#hdr-portal-text');
        if (ta) { ta.select(); document.execCommand('copy'); return Promise.resolve(true); }
      } catch (e) {}
      return Promise.resolve(false);
    };
    // Resolve any header-set slug to its current (draft-aware) object.
    const hdrSetBySlug = (slug) => slug === BUILTIN_HEADER_SLUG
      ? builtinHeaderRuleSet()
      : (this._headerDisplaySet(slug) || headerLibraryMap(hdrScope())[slug] || null);

    // Export a single set to text. Bindings are KEPT so the exported text fully
    // reflects what the user is running (this is a debugging aid — they hand it
    // back with their card YAML), unlike frame presets which strip conditions.
    this.querySelectorAll('.hdr-export').forEach(el => el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const src = hdrSetBySlug(el.dataset.hdrSlug);
      if (!src) return;
      this._hdrPortal('export', serializeHeaderRuleSets([src], { exported: hdrNowISO(), keepBindings: true }),
        `Exported "${src.name || 'Header Rules'}". Copy this text — paste it into another card's Import, or share it (with your card YAML) to debug why a rule isn't applying.`);
    }));

    // Open the import portal.
    const hdrImport = this.querySelector('#hdr-import');
    if (hdrImport) hdrImport.addEventListener('click', () => {
      this._hdrPortal('import', '', 'Paste exported Header Rule text below, then Import. Imported sets are added to the shared System library with fresh names.');
    });

    // Portal primary: Copy (export) or Import (import).
    const hdrPortalPrimary = this.querySelector('#hdr-portal-primary');
    if (hdrPortalPrimary) hdrPortalPrimary.addEventListener('click', () => {
      const mode = hdrPortalPrimary.dataset.mode;
      const ta = this.querySelector('#hdr-portal-text');
      if (mode === 'export') {
        hdrCopyText(ta ? ta.value : '').then(okc => hdrPortalStatus(okc ? 'Copied to clipboard.' : 'Copy failed — select the text and copy manually.'));
        return;
      }
      // import: parse, then add each set to the shared library under a fresh
      // slug/name (dedupe byte-identical sets by content key).
      const res = parseHeaderRuleSetBlob(ta ? ta.value : '');
      if (!res.ok) { hdrPortalStatus('Import failed: ' + res.error); return; }
      const scope = hdrScope();
      const map = { ...headerLibraryMap(scope) };
      const seen = new Set(Object.keys(map).map(s => headerRuleSetContentKey(map[s])));
      let added = 0, skipped = 0;
      res.sets.forEach(s => {
        const key = headerRuleSetContentKey(s);
        if (seen.has(key)) { skipped += 1; return; }
        seen.add(key);
        const base = s.name || 'Imported Header Rules';
        let slug = headerLibSlug(base), n = 2;
        while (map[slug]) { slug = headerLibSlug(base + ' ' + n); n++; }
        const store = normalizeHeaderRuleSet(s); store.id = 'lib:' + slug;
        map[slug] = store; added += 1;
      });
      hdrEcho(scope, map);
      this._hdrPendingStatus = `Imported ${added} rule set${added === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}` : ''}.`;
      saveHeaderLibrary(this._hass, scope, map).then(() => this.renderEditor()).catch(() => this.renderEditor());
    });

    // Close the portal.
    const hdrPortalClose = this.querySelector('#hdr-portal-close');
    if (hdrPortalClose) hdrPortalClose.addEventListener('click', () => {
      const portal = this.querySelector('#hdr-portal');
      if (portal) portal.style.display = 'none';
    });

    // Re-show a status stashed before the last re-render (import summary), so it
    // survives the DOM rebuild. Status-only: message row, no textarea/primary.
    if (this._hdrPendingStatus) {
      const portal = this.querySelector('#hdr-portal');
      const ta = this.querySelector('#hdr-portal-text');
      const primary = this.querySelector('#hdr-portal-primary');
      const lbl = this.querySelector('#hdr-portal-label');
      if (portal) portal.style.display = '';
      if (lbl) lbl.textContent = '';
      if (ta) ta.style.display = 'none';
      if (primary) primary.style.display = 'none';
      hdrPortalStatus(this._hdrPendingStatus);
      this._hdrPendingStatus = null;
    }

    const fxAdd = this.querySelector('#fx-add');
    if (fxAdd) fxAdd.addEventListener('click', () => {
      const scope = this._config.frame_library_scope || 'system';
      const map = { ...frameLibraryMap(scope) };
      const baseName = 'New Frame Style';
      let slug = frameLibSlug(baseName), n = 2;
      while (map[slug]) { slug = frameLibSlug(baseName + ' ' + n); n++; }
      map[slug] = normalizeFramePreset({
        name: n > 2 ? `${baseName} ${n - 1}` : baseName,
        glow: { color: '#2196F3', intensity: 1.0, borders_only: false }
      });
      this._libEchoJSON = null;
      saveFrameLibrary(this._hass, scope, map)
        .then(() => this.renderEditor())
        .catch(() => { this._fxPendingStatus = 'Could not create — the shared library store is unavailable on this connection.'; this.renderEditor(); });
    });

    // Duplicate Effect preset (deep copy with a fresh id + " (copy)" name).
    this.querySelectorAll('.fx-duplicate').forEach(el => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const fid = el.dataset.fxId;
        const src = (this._config.frame_presets || []).find(f => f.id === fid);
        if (!src) return;
        const copy = normalizeFramePreset(JSON.parse(JSON.stringify(src)));
        copy.id = _fxId();
        copy.name = `${src.name || 'Effect'} (copy)`;
        const idx = this._config.frame_presets.findIndex(f => f.id === fid);
        this._config.frame_presets.splice(idx + 1, 0, copy);
        this._fireConfigChanged();
        this.renderEditor();
      });
    });

    // Delete Frame preset (and scrub any references to it from frame refs).
    this.querySelectorAll('.fx-delete').forEach(el => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (!this._confirmDelete('Delete this Frame Style? Sections/cards using it will lose that frame. This cannot be undone.')) return;
        const fid = el.dataset.fxId;
        this._config.frame_presets = (this._config.frame_presets || []).filter(f => f.id !== fid);
        const scrub = fr => {
          if (!fr) return fr;
          if (Array.isArray(fr.presets)) fr.presets = fr.presets.filter(p => p !== fid);
          return fr;
        };
        (this._config.sections || []).forEach(s => { if (s.frame) scrub(s.frame); });
        if (this._config.card_frame) scrub(this._config.card_frame);
        this._fireConfigChanged();
        this.renderEditor();
      });
    });

    // ---- Frame Style portability: export / import / library ----

    // Copy text to clipboard with a textarea fallback for non-secure contexts.
    const copyText = (text) => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
      }
      try {
        const ta = this.querySelector('#fx-portal-text');
        if (ta) { ta.select(); document.execCommand('copy'); return Promise.resolve(true); }
      } catch (e) {}
      return Promise.resolve(false);
    };
    const portalStatus = (msg) => { const s = this.querySelector('#fx-portal-status'); if (s) s.textContent = msg || ''; };
    const nowISO = () => { try { return new Date().toISOString().slice(0, 10); } catch (e) { return ''; } };

<<<<<<< HEAD
    // Resolve any preset id (Built-In, lib:<slug>, or legacy local fx_*) to its
    // object.
    const presetById = (id) => {
      if (id === BUILTIN_FRAME_ID) return builtinFramePreset();
=======
    // Resolve any preset id (local fx_* or lib:<slug>) to its object.
    const presetById = (id) => {
>>>>>>> d65989548fdbf203a804606d75440bca7a95012c
      if (typeof id === 'string' && id.startsWith('lib:')) {
        return frameLibraryMap(this._config.frame_library_scope)[id.slice(4)] || null;
      }
      return (this._config.frame_presets || []).find(f => f.id === id) || null;
    };

    // Export a single preset (local or library) to text.
    this.querySelectorAll('.fx-export').forEach(el => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const src = presetById(el.dataset.fxId);
        if (!src) return;
        this._fxPortal('export', serializeFramePresets([src], { exported: nowISO() }),
          `Exported "${src.name || 'preset'}". Copy this text and paste it into another card's Import.`);
      });
    });

    // Library preset → copy into THIS card as a Local, editable preset (a fork;
    // the library entry is untouched, and this card doesn't start referencing it).
    this.querySelectorAll('.fx-lib-tolocal').forEach(el => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const src = presetById(el.dataset.fxId);
        if (!src) return;
        const copy = normalizeFramePreset(JSON.parse(JSON.stringify(src)));
        copy.id = _fxId();
        copy.name = `${src.name || 'Preset'} (local copy)`;
        this._config.frame_presets = this._config.frame_presets || [];
        this._config.frame_presets.push(copy);
        this._fireConfigChanged();
        this._fxPendingStatus = `Copied "${src.name}" into this card as a Local preset.`;
        this.renderEditor();
      });
    });

    // Duplicate a library preset within the shared library (fresh slug + name).
    this.querySelectorAll('.fx-lib-duplicate').forEach(el => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const src = presetById(el.dataset.fxId);
        if (!src) return;
        const scope = this._config.frame_library_scope || 'system';
        const map = { ...frameLibraryMap(scope) };
        const baseName = `${src.name || 'Preset'} (copy)`;
        let slug = frameLibSlug(baseName), n = 2;
        while (map[slug]) { slug = frameLibSlug(baseName + ' ' + n); n++; }
        const copy = portableFramePreset(src, true);
        copy.name = baseName;
        map[slug] = copy;
        this._libEchoJSON = null;
        saveFrameLibrary(this._hass, scope, map)
          .then(() => this.renderEditor())
          .catch(() => {});
      });
    });

    // Delete a library preset from the shared store. Warn if this card uses it.
    this.querySelectorAll('.fx-lib-delete').forEach(el => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const slug = el.dataset.fxId.slice(4);
        const scope = this._config.frame_library_scope || 'system';
        const usesLib = fr => fr && (fr.presets || []).some(id => id === 'lib:' + slug);
        const usedHere = usesLib(this._config.card_frame) || (this._config.sections || []).some(s => usesLib(s.frame));
<<<<<<< HEAD
        const msg = usedHere
          ? 'This card references this System Frame Style. Deleting it from the shared library will leave those spots with no frame.\n\nDelete it anyway?'
          : 'Delete this System Frame Style from the shared library? This affects every card that uses it. This cannot be undone.';
        if (!this._confirmDelete(msg)) return;
        const map = { ...frameLibraryMap(scope) };
        delete map[slug];
        delete this._frameDrafts[slug];   // drop any open draft for the deleted preset
=======
        if (usedHere) {
          const ok = (() => { try { return window.confirm(`This card references this System preset. Deleting it from the shared library will leave those spots with no frame.\n\nDelete it anyway?`); } catch (e) { return true; } })();
          if (!ok) return;
        }
        const map = { ...frameLibraryMap(scope) };
        delete map[slug];
>>>>>>> d65989548fdbf203a804606d75440bca7a95012c
        this._libEchoJSON = null;
        saveFrameLibrary(this._hass, scope, map)
          .then(() => this.renderEditor())
          .catch(() => {});
      });
    });

    // Repoint every frame ref (card + sections) that uses preset id `fromId`
    // to `toId` in the presets[] list. Used to swap a local preset for its
    // library reference (and back, on Detach).
    const repointRefs = (fromId, toId) => {
      const fix = fr => {
        if (!fr) return;
        if (Array.isArray(fr.presets)) fr.presets = fr.presets.map(id => id === fromId ? toId : id);
      };
      fix(this._config.card_frame);
      (this._config.sections || []).forEach(s => fix(s.frame));
    };

    // Save to Library: publish the preset to the Style Library, then LINK this
    // card to it — repoint every ref from the local preset to lib:<slug> and
    // drop the now-orphaned local copy. The library becomes the single source
    // of truth (Color-Light "Save to Entity" model): editing the library entry
    // updates this and every other card that references it, live.
    this.querySelectorAll('.fx-save-lib').forEach(el => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const src = (this._config.frame_presets || []).find(f => f.id === el.dataset.fxId);
        if (!src) return;
        const scope = this._config.frame_library_scope || 'system';
        const map = { ...frameLibraryMap(scope) };
        const slug = frameLibSlug(src.name);
        map[slug] = portableFramePreset(src, true);   // keep conditions within-system
        this._fxPortal('export', '', '');
        portalStatus(`Publishing "${src.name}" to the Style Library as lib:${slug}…`);
        saveFrameLibrary(this._hass, scope, map)
          .then(() => {
            // Link the card to the library entry: swap refs, remove local copy.
            const libId = 'lib:' + slug;
            repointRefs(src.id, libId);
            this._config.frame_presets = (this._config.frame_presets || []).filter(f => f.id !== src.id);
            this._fireConfigChanged();
            this._fxPendingStatus = `Published "${src.name}" to the Style Library and linked this card to it (lib:${slug}). It now follows the library.`;
            this.renderEditor();
          })
          .catch(() => { portalStatus('Could not save — the Style Library store is unavailable on this connection.'); });
      });
    });

    // Open the import portal.
    const fxImport = this.querySelector('#fx-import');
    if (fxImport) fxImport.addEventListener('click', () => {
      this._fxPortal('import', '', 'Paste exported Frame Style text below, then Import.');
    });

    // Portal primary button: Copy (export mode) or Import (import mode).
    const portalPrimary = this.querySelector('#fx-portal-primary');
    if (portalPrimary) portalPrimary.addEventListener('click', () => {
      const mode = portalPrimary.dataset.mode;
      const ta = this.querySelector('#fx-portal-text');
      if (mode === 'export') {
        copyText(ta ? ta.value : '').then(okc => portalStatus(okc ? 'Copied to clipboard.' : 'Copy failed — select the text and copy manually.'));
        return;
      }
      // import
      const res = parseFramePresetBlob(ta ? ta.value : '');
      if (!res.ok) { portalStatus('Import failed: ' + res.error); return; }
      const merged = mergeFramePresets(this._config.frame_presets || [], res.presets);
      this._config.frame_presets = merged.list;
      this._fireConfigChanged();
      // Stash a status message to re-show after the re-render (which rebuilds
      // the portal DOM and would otherwise clear it), so the user sees the
      // import summary alongside the freshly-added presets.
      this._fxPendingStatus = `Imported ${merged.added} preset${merged.added === 1 ? '' : 's'}${merged.skipped ? `, skipped ${merged.skipped} duplicate${merged.skipped === 1 ? '' : 's'}` : ''}.`;
      this.renderEditor();
    });

    // Close the portal.
    const portalClose = this.querySelector('#fx-portal-close');
    if (portalClose) portalClose.addEventListener('click', () => {
      const portal = this.querySelector('#fx-portal');
      if (portal) portal.style.display = 'none';
    });

    // Re-show a status message stashed before the last re-render (e.g. an
    // import summary or a "published to library" confirmation), so it survives
    // the DOM rebuild. Status-only: show the portal with just the message row.
    if (this._fxPendingStatus) {
      const portal = this.querySelector('#fx-portal');
      const ta = this.querySelector('#fx-portal-text');
      const primary = this.querySelector('#fx-portal-primary');
      const lbl = this.querySelector('#fx-portal-label');
      if (portal) portal.style.display = '';
      if (lbl) lbl.textContent = '';
      if (ta) ta.style.display = 'none';
      if (primary) primary.style.display = 'none';
      portalStatus(this._fxPendingStatus);
      this._fxPendingStatus = null;
    }

    // "Reset to Table Defaults": overwrite this section's headers + row_style
    // with the global Entity Table Defaults. This is the ONLY way an existing
    // table adopts the defaults (new tables inherit them on creation).
    this.querySelectorAll('.at-reset-table-defaults').forEach(el => {
      el.addEventListener('click', () => {
        const sid = el.dataset.atSid;
        const td = normalizeTableDefaults(this._config.table_defaults);
        this._atApply(sid, sec => {
          sec.headers = JSON.parse(JSON.stringify(td.headers));
          // Preserve the section's own name-strip list; only reset visual style.
          const keepStrip = (sec.row_style && sec.row_style.strip_strings) || [];
          sec.row_style = JSON.parse(JSON.stringify(td.row_style));
          sec.row_style.strip_strings = Array.isArray(keepStrip) ? keepStrip.slice() : [];
        });
      });
    });

    // Add to a list.
    this.querySelectorAll('.at-add[data-at-list]').forEach(el => {
      el.addEventListener('click', () => {
        const sid = el.dataset.atSid, list = el.dataset.atList, kind = el.dataset.atNew;
        this._atApply(sid, sec => {
          const arr = this._atGet(sec, list) || [];
          const item =
            kind === 'filterrule'  ? { field: 'state', op: 'eq', value: '' } :
            kind === 'filtergroup' ? { mode: 'include', match: 'all', rules: [{ field: 'domain', op: 'eq', value: 'light' }] } :
            kind === 'rule'        ? { when: { op: 'gt', value: 0 }, result: '' } :
            kind === 'sortrule'    ? { when: { op: 'is_on' }, weight: 0 } :
            kind === 'column'      ? { kind: 'value', header: '', value: { source: 'state' } } :
            kind === 'textpart'    ? { kind: 'text', template: '{last_changed_ago}', align: 'right', size: 14 } :
            kind === 'iconpart'    ? { kind: 'icon', icon: 'mdi:information-outline', align: 'right', size: 20 } :
            kind === 'gradientstop'? { value: 0, color: '#888888' } :
            kind === 'hdrrule'     ? { when: { op: 'is_on' } } :
            kind === 'edgestop'    ? { pos: 50, color: '#2196F3' } : {};
          this._atSet(sec, list, arr.concat([item]));
        });
      });
    });

    // Delete from a list.
    this.querySelectorAll('.at-del[data-at-list]').forEach(el => {
      el.addEventListener('click', (ev) => {
        // Some at-del icons live inside a <summary> (e.g. Header rule rows);
        // stop the click from toggling that <details> open/closed.
        ev.preventDefault();
        ev.stopPropagation();
        if (!this._confirmDelete('Delete this item?')) return;
        const sid = el.dataset.atSid, list = el.dataset.atList, idx = Number(el.dataset.atIdx);
        this._atApply(sid, sec => {
          const arr = this._atGet(sec, list) || [];
          arr.splice(idx, 1);
          this._atSet(sec, list, arr);
        });
      });
    });

    // Header Rule Set: apply a set to a section (append a ref, blank entity).
    this.querySelectorAll('.at-hdr-ref-add').forEach(el => {
      el.addEventListener('change', () => {
        const ref = el.value; if (!ref) return;
        const sid = el.dataset.atSid;
        this._atApply(sid, sec => {
          const arr = Array.isArray(sec.header_rule_refs) ? sec.header_rule_refs.slice() : [];
          arr.push({ ref, entity: '' });
          sec.header_rule_refs = arr;
        });
      });
    });

    // Searchable single-entity picker (_atEntityPicker). Search filters rows in
    // place (no re-render → keeps focus); clicking a row sets the value; the
    // chip's clear button empties it. Uses the generic at-* apply so drafts +
    // sections + card all persist correctly.
    this.querySelectorAll('.at-ent-search').forEach(el => {
      el.addEventListener('input', () => {
        const pid = el.dataset.entPid;
        const list = this.querySelector(`.at-ent-list[data-ent-pid="${pid}"]`);
        if (!list) return;
        const term = el.value.trim().toLowerCase();
        list.querySelectorAll('.at-ent-pick').forEach(row => {
          const hay = row.dataset.search || '';
          row.style.display = (!term || hay.includes(term)) ? '' : 'none';
        });
      });
    });
    this.querySelectorAll('.at-ent-pick').forEach(el => {
      el.addEventListener('click', () => {
        const sid = el.dataset.atSid, path = el.dataset.atPath, id = el.dataset.entityId;
        if (!sid || !path || !id) return;
        this._atApply(sid, sec => this._atSet(sec, path, id));
      });
    });
    this.querySelectorAll('.at-ent-clear').forEach(el => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const sid = el.dataset.atSid, path = el.dataset.atPath;
        this._atApply(sid, sec => this._atSet(sec, path, ''));
      });
    });

    // "Choose an Entity" / "Bind a Default Entity" checkbox — reveals or hides
    // the entity picker for a Header Rule binding. Transient (_hdrEntPickerOpen),
    // not persisted; re-renders so the picker appears/disappears. Unchecking
    // also clears any partially-typed (unselected) state — the actual value only
    // persists when a row is clicked, so nothing to undo there.
    this.querySelectorAll('.hdr-ent-toggle').forEach(el => {
      el.addEventListener('change', () => {
        const key = el.dataset.hdrEntKey;
        if (el.checked) this._hdrEntPickerOpen.add(key);
        else this._hdrEntPickerOpen.delete(key);
        this.renderEditor();
      });
    });

    // Header rule Preview toggle — flips a transient per-rule flag and re-renders
    // so the preview box shows/hides. Not persisted to config.
    this.querySelectorAll('.hdr-rule-preview').forEach(el => {
      el.addEventListener('click', (ev) => {
        // Lives in the rule's <summary>; stop the click from toggling the row.
        ev.preventDefault();
        ev.stopPropagation();
        const key = el.dataset.hdrSlug + '||' + el.dataset.hdrIdx;
        if (this._hdrRulePreview.has(key)) this._hdrRulePreview.delete(key);
        else this._hdrRulePreview.add(key);
        this.renderEditor();
      });
    });

    // Header Rule Set dirty-draft Save / Discard (per set).
    this.querySelectorAll('.hdr-save-draft').forEach(el => el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const d = this._headerDrafts[el.dataset.hdrSlug];
      if (!d || !d.dirty) return;   // disabled visual = no-op
      this._saveHeaderDraft(el.dataset.hdrSlug);
    }));
    this.querySelectorAll('.hdr-discard-draft').forEach(el => el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const d = this._headerDrafts[el.dataset.hdrSlug];
      if (!d || !d.dirty) return;
      this._discardHeaderDraft(el.dataset.hdrSlug);
    }));

    // Group kind toggle (any_of <-> all_of): rename the key, keep children.
    this.querySelectorAll('.at-group-kind[data-at-path]').forEach(el => {
      el.addEventListener('change', () => {
        const sid = el.dataset.atSid, path = el.dataset.atPath;
        const oldKind = el.dataset.atKind, newKind = el.value;
        if (oldKind === newKind) return;
        this._atApply(sid, sec => {
          const grp = this._atGet(sec, path);
          if (!grp) return;
          const children = grp[oldKind] || [];
          delete grp[oldKind];
          grp[newKind] = children;
        });
      });
    });

    // Condition "what" toggle (State <-> Time since change): set or clear the
    // condition's ref, and reset value/op to sensible defaults for the new kind.
    this.querySelectorAll('.at-cond-what[data-at-path]').forEach(el => {
      el.addEventListener('change', () => {
        const sid = el.dataset.atSid, path = el.dataset.atPath;
        const what = el.value, prev = el.dataset.atWhat;
        if (what === prev) return;
        this._atApply(sid, sec => {
          const cond = this._atGet(sec, path);
          if (!cond) return;
          if (what === 'last_changed_ago') {
            cond.ref = { source: 'last_changed_ago' };
            if (!['lt', 'le', 'gt', 'ge', 'between'].includes(cond.op)) cond.op = 'lt';
            if (cond.value === undefined || cond.value === '') cond.value = 600;
          } else {
            delete cond.ref;
            cond.op = 'is_on';
            cond.value = '';
          }
        });
      });
    });

    // Add a condition to a rule's `when` (turns a single condition into an
    // all-group, or appends to an existing group). New condition defaults to a
    // time gate, since that's the common "value + time" combo.
    this.querySelectorAll('.at-cond-add[data-at-when]').forEach(el => {
      el.addEventListener('click', () => {
        const sid = el.dataset.atSid, whenPath = el.dataset.atWhen;
        this._atApply(sid, sec => {
          const when = this._atGet(sec, whenPath) || { op: 'is_on' };
          const newCond = { ref: { source: 'last_changed_ago' }, op: 'lt', value: 600 };
          let group;
          if (Array.isArray(when.all)) group = { all: when.all.concat([newCond]) };
          else if (Array.isArray(when.any)) group = { any: when.any.concat([newCond]) };
          else group = { all: [when, newCond] };
          this._atSet(sec, whenPath, group);
        });
      });
    });

    // Condition combine toggle (all <-> any) for a rule's `when`.
    this.querySelectorAll('.at-cond-kind[data-at-path]').forEach(el => {
      el.addEventListener('change', () => {
        const sid = el.dataset.atSid, path = el.dataset.atPath;
        const oldKind = el.dataset.atKind, newKind = el.value;
        if (oldKind === newKind) return;
        this._atApply(sid, sec => {
          const when = this._atGet(sec, path);
          if (!when) return;
          const conds = when[oldKind] || [];
          delete when[oldKind];
          when[newKind] = conds;
        });
      });
    });

    // Move within a list.
    this.querySelectorAll('.at-move[data-at-list]').forEach(el => {
      el.addEventListener('click', () => {
        const sid = el.dataset.atSid, list = el.dataset.atList;
        const idx = Number(el.dataset.atIdx), dir = Number(el.dataset.atDir);
        this._atApply(sid, sec => {
          const arr = this._atGet(sec, list) || [];
          const j = idx + dir;
          if (j < 0 || j >= arr.length) return;
          [arr[idx], arr[j]] = [arr[j], arr[idx]];
          this._atSet(sec, list, arr);
        });
      });
    });

    // --- Global Rule Sets panel controls ---
    const rsAdd = this.querySelector('#rs-add');
    if (rsAdd) rsAdd.addEventListener('click', () => {
      this._config.rule_sets = this._config.rule_sets || [];
      this._config.rule_sets.push(normalizeRuleSetDef({ name: 'New Filter Rule',
        filter: { include: [{ field: 'domain', op: 'eq', value: 'light' }], exclude: [] } }));
      this._fireConfigChanged();
      this.renderEditor();
    });

    // Duplicate a rule set (deep copy, fresh id, " (copy)" name). The copy is
    // NOT auto-assigned to any section - the user assigns it where needed.
    this.querySelectorAll('.rs-duplicate[data-rs-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.rsId;
        const src = (this._config.rule_sets || []).find(r => r.id === id);
        if (!src) return;
        const copy = normalizeRuleSetDef(JSON.parse(JSON.stringify(src)));
        copy.id = _rsId();
        copy.name = `${src.name || 'Rule Set'} (copy)`;
        const idx = this._config.rule_sets.findIndex(r => r.id === id);
        this._config.rule_sets.splice(idx + 1, 0, copy);
        this._fireConfigChanged();
        this.renderEditor();
      });
    });

    this.querySelectorAll('.rs-delete[data-rs-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.rsId;
        const usedBy = (this._config.sections || []).filter(s =>
          Array.isArray(s.rule_sets) && s.rule_sets.some(r => r.ref === id)).length;
        const msg = usedBy
          ? `Delete this filter rule? It's used by ${usedBy} section(s) — those references will be removed too. This cannot be undone.`
          : 'Delete this filter rule? This cannot be undone.';
        if (!this._confirmDelete(msg)) return;
        this._config.rule_sets = (this._config.rule_sets || []).filter(r => r.id !== id);
        // Drop refs to it from every section.
        (this._config.sections || []).forEach(s => {
          if (Array.isArray(s.rule_sets)) s.rule_sets = s.rule_sets.filter(r => r.ref !== id);
          if (s.static_entities) delete s.static_entities[id];
        });
        this._fireConfigChanged();
        this.renderEditor();
      });
    });

    // "Update Sections using this Rule Set": repopulate the frozen id list for
    // every section that references this set STATICALLY. Authoritative + confirm.
    this.querySelectorAll('.rs-update-sections[data-rs-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.rsId;
        const rs = (this._config.rule_sets || []).find(r => r.id === id);
        if (!rs || !this._hass) return;
        const members = evalRuleSetMembers(rs, this._hass);
        const targets = (this._config.sections || []).filter(s =>
          Array.isArray(s.rule_sets) && s.rule_sets.some(r => r.ref === id && r.mode === 'static'));
        if (!targets.length) { alert('No sections use this rule set statically.'); return; }
        if (!confirm(`Replace the entity list in ${targets.length} section(s) with the ${members.length} entities matching "${rs.name}"?`)) return;
        targets.forEach(s => {
          s.static_entities = s.static_entities || {};
          s.static_entities[id] = members.slice();
        });
        this._fireConfigChanged();
        this.renderEditor();
      });
    });

    // Rule-set name field must not toggle its summary <details>.
    this.querySelectorAll('.rs-name').forEach(el => el.addEventListener('click', e => e.stopPropagation()));

    // --- Per-section membership (assign rule sets) ---
    // Preview dropdown: transient (not saved) - just re-render to refresh the
    // preview list for the chosen set.
    this._msPreview = this._msPreview || {};
    this.querySelectorAll('.ms-preview-pick').forEach(el => {
      el.addEventListener('change', () => {
        this._msPreview[el.dataset.atSid] = el.value;
        this.renderEditor();
      });
    });

    // Assign a rule set (Dynamic or Static). Static freezes the current matches
    // into static_entities[ref] immediately ("snapshot now").
    this.querySelectorAll('.ms-assign').forEach(el => {
      el.addEventListener('click', () => {
        const sid = el.dataset.atSid, mode = el.dataset.msMode;
        const ref = (this._msPreview && this._msPreview[sid]) ||
          ((this._config.rule_sets || [])[0] && this._config.rule_sets[0].id);
        if (!ref) return;
        this._atApply(sid, sec => {
          sec.rule_sets = Array.isArray(sec.rule_sets) ? sec.rule_sets : [];
          if (sec.rule_sets.some(r => r.ref === ref)) return; // already assigned
          sec.rule_sets.push({ ref, mode });
          if (mode === 'static' && this._hass) {
            const rs = (this._config.rule_sets || []).find(r => r.id === ref);
            if (rs) { sec.static_entities = sec.static_entities || {}; sec.static_entities[ref] = evalRuleSetMembers(rs, this._hass); }
          }
        });
      });
    });

    // Unassign: drop the ref AND its frozen entity list (entities from OTHER
    // assigned sets survive - they live under their own static_entities key /
    // recompute dynamically).
    this.querySelectorAll('.ms-unassign').forEach(el => {
      el.addEventListener('click', () => {
        if (!this._confirmDelete('Unassign this filter rule from the section? Its entities will be removed from this section.')) return;
        const sid = el.dataset.atSid, ref = el.dataset.msRef;
        this._atApply(sid, sec => {
          if (Array.isArray(sec.rule_sets)) sec.rule_sets = sec.rule_sets.filter(r => r.ref !== ref);
          if (sec.static_entities) delete sec.static_entities[ref];
        });
      });
    });

    // Mode toggle on an assigned set. Switching to Static freezes current
    // matches; switching to Dynamic drops the frozen list for that ref.
    this.querySelectorAll('.ms-mode').forEach(el => {
      el.addEventListener('change', () => {
        const sid = el.dataset.atSid, i = Number(el.dataset.msIdx), mode = el.value;
        this._atApply(sid, sec => {
          const ref = sec.rule_sets && sec.rule_sets[i] && sec.rule_sets[i].ref;
          if (!ref) return;
          sec.rule_sets[i].mode = mode;
          if (mode === 'static' && this._hass) {
            const rs = (this._config.rule_sets || []).find(r => r.id === ref);
            if (rs) { sec.static_entities = sec.static_entities || {}; sec.static_entities[ref] = evalRuleSetMembers(rs, this._hass); }
          } else if (mode === 'dynamic' && sec.static_entities) {
            delete sec.static_entities[ref];
          }
        });
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

    // The inline mode dropdown lives INSIDE a <summary>; clicking it must not
    // toggle the <details>. Swallow the click so opening the dropdown doesn't
    // collapse the panel. (Reset now lives in the body, not the summary.)
    this.querySelectorAll('.seed-ed-substyle-sum .seed-ed-sum-select').forEach(el => {
      el.addEventListener('click', e => e.stopPropagation());
    });

    // Per-group Reset: revert just the clicked group's keys to the section
    // defaults (from a fresh normalizeSection), then re-render the editor.
    this.querySelectorAll('.seed-ed-reset-btn[data-reset-group]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        const keys = SEED_STYLE_GROUPS[el.dataset.resetGroup];
        if (!section || !keys) return;
        const defaults = normalizeSection({}); // all-default section
        keys.forEach(k => { section[k] = defaults[k]; });
        // Chip color reset also clears any legacy custom flag echoes.
        this._fireConfigChanged();
        this.renderEditor();
      });
    });

    // Accordion behavior: when auto-close is on, opening one collapsible panel
    // closes only its SIBLINGS (same parent) — not nested sub-panels and not
    // its own parent. `seed-ed-row` is used at multiple nesting levels (e.g. the
    // Dividers / Row Defaults sub-panels live inside Section Defaults), so a
    // flat "close all others" would collapse a panel's own parent when you open
    // a child. Grouping by parentElement keeps each level independent.
    // A panel is any collapsible editor box: the two top-level panel systems
    // (seed-ed-row and seed-ed-collapsible-panel) plus the sub-panels inside
    // them (also seed-ed-row). Auto-close is SIBLING-scoped by parentElement so
    // opening one closes only its same-level neighbors — a nested sub-panel
    // never closes its own parent, and the top-level panels (which mix BOTH
    // classes but share one container) all close each other regardless of class.
    const PANEL_SEL = 'details.seed-ed-row, details.seed-ed-collapsible-panel';
    const isPanel = el => el && el.tagName === 'DETAILS'
      && (el.classList.contains('seed-ed-row') || el.classList.contains('seed-ed-collapsible-panel'));
    this.querySelectorAll(PANEL_SEL).forEach(d => {
      d.addEventListener('toggle', () => {
        if (!d.open || !this._editorAutoClose) return;
        const parent = d.parentElement;
        if (!parent) return;
        Array.from(parent.children).forEach(other => {
          if (other !== d && isPanel(other) && other.open) other.open = false;
        });
      });
    });

    this.querySelectorAll('details.seed-ed-section').forEach(d => {
      d.addEventListener('toggle', () => {
        if (d.open && this._editorAutoClose) {
          this.querySelectorAll('details.seed-ed-section').forEach(other => {
            if (other !== d && other.open) other.open = false;
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

    const minRefreshEl = this.querySelector('#ed-min-refresh');
    if (minRefreshEl) {
      minRefreshEl.addEventListener('input', () => {
        const val = parseInt(minRefreshEl.value, 10) || 0;
        this._config.min_refresh_seconds = val;
        const label = this.querySelector('#ed-min-refresh-value');
        if (label) label.textContent = val === 0 ? 'Default' : `${val}s`;
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
    // Frame-ref controls (shared by the card wrapper and every section). The
    // scope id is in data-fr-sid: '__card_frame__' => card_frame, else a section
    // id => that section's .frame. _frameRefFor() returns (and lazily creates)
    // the frame ref object for a scope.
    const frameRefFor = (sid) => {
      if (sid === '__card_frame__') {
        this._config.card_frame = this._config.card_frame || { presets: [] };
        return this._config.card_frame;
      }
      const sec = (this._config.sections || []).find(s => s.id === sid);
      if (!sec) return null;
      sec.frame = sec.frame || { presets: [] };
      return sec.frame;
    };
    // On an empty frame ref (no presets): the CARD frame drops to null (its
    // renderer forces the wrapper frame fully off). A SECTION frame is KEPT as
    // { presets: [] } — never deleted — so the section stays frame-driven and
    // can't fall back to the dead inline border/glow path (which would repaint
    // the global default border).
    const pruneFrame = (sid) => {
      if (sid === '__card_frame__') {
        const fr = this._config.card_frame;
        if (fr && (!fr.presets || !fr.presets.length)) this._config.card_frame = null;
      }
    };
    this.querySelectorAll('.fr-add').forEach(el => el.addEventListener('click', () => {
      const pick = el.parentElement.querySelector('.fr-add-pick');
      const val = pick && pick.value; if (!val) return;
      const fr = frameRefFor(el.dataset.frSid); if (!fr) return;
      fr.presets = fr.presets || []; fr.presets.push(val);
      this._fireConfigChanged(); this.renderEditor();
    }));
    this.querySelectorAll('.fr-remove').forEach(el => el.addEventListener('click', () => {
      if (!this._confirmDelete('Remove this applied frame from here? (The Frame Style itself is kept in the library.)')) return;
      const fr = frameRefFor(el.dataset.frSid); if (!fr) return;
      const removed = fr.presets.splice(Number(el.dataset.frIdx), 1)[0];
      // Keep `disabled` in sync when a preset is removed.
      if (Array.isArray(fr.disabled)) fr.disabled = fr.disabled.filter(id => id !== removed);
      pruneFrame(el.dataset.frSid);
      this._fireConfigChanged(); this.renderEditor();
    }));
    // Toggle an applied preset on/off without removing it (preview helper).
    this.querySelectorAll('.fr-toggle').forEach(el => el.addEventListener('click', () => {
      const fr = frameRefFor(el.dataset.frSid); if (!fr) return;
      const id = el.dataset.frId;
      const set = new Set(fr.disabled || []);
      if (set.has(id)) set.delete(id); else set.add(id);
      fr.disabled = [...set].filter(x => (fr.presets || []).includes(x));
      if (!fr.disabled.length) delete fr.disabled;
      this._fireConfigChanged(); this.renderEditor();
    }));
    this.querySelectorAll('.fr-move').forEach(el => el.addEventListener('click', () => {
      const fr = frameRefFor(el.dataset.frSid); if (!fr) return;
      const i = Number(el.dataset.frIdx), dir = Number(el.dataset.frDir), j = i + dir;
      if (j < 0 || j >= fr.presets.length) return;
      const t = fr.presets[i]; fr.presets[i] = fr.presets[j]; fr.presets[j] = t;
      this._fireConfigChanged(); this.renderEditor();
    }));
    // Ignore-conditions: this layer applies HERE even when its own condition is
    // false. Kept in sync with the preset list; emitted only when non-empty.
    this.querySelectorAll('.fr-ignore').forEach(el => el.addEventListener('change', () => {
      const fr = frameRefFor(el.dataset.frSid); if (!fr) return;
      const id = el.dataset.frId;
      const set = new Set(fr.ignore_conditions || []);
      if (el.checked) set.add(id); else set.delete(id);
      fr.ignore_conditions = [...set].filter(x => (fr.presets || []).includes(x));
      if (!fr.ignore_conditions.length) delete fr.ignore_conditions;
      this._fireConfigChanged(); this.renderEditor();
    }));

    const cardCollapsibleEl = this.querySelector('#ed-card-collapsible');
    if (cardCollapsibleEl) {
      // Toggling collapsible shows/hides the chevron sub-option, so re-render.
      cardCollapsibleEl.addEventListener('change', () => {
        this._config.card_collapsible = cardCollapsibleEl.checked;
        this._fireConfigChanged();
        this.renderEditor();
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

    const cardDefaultStateEl = this.querySelector('#ed-card-default-state');
    if (cardDefaultStateEl) {
      cardDefaultStateEl.addEventListener('change', () => {
        this._config.card_default_state = cardDefaultStateEl.value === 'collapsed' ? 'collapsed' : 'expanded';
        this._fireConfigChanged();
      });
    }

    const showTitleEl = this.querySelector('#ed-show-title');
    if (showTitleEl) {
      // Toggling shows/hides the title-text sub-settings, so re-render.
      showTitleEl.addEventListener('change', () => {
        this._config.show_title = showTitleEl.checked;
        this._fireConfigChanged();
        this.renderEditor();
      });
    }

    const showTitleIconEl = this.querySelector('#ed-show-title-icon');
    if (showTitleIconEl) {
      // Toggling shows/hides the title-icon sub-settings, so re-render.
      showTitleIconEl.addEventListener('change', () => {
        this._config.show_title_icon = showTitleIconEl.checked;
        this._fireConfigChanged();
        this.renderEditor();
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

    // Add a standalone Divider section (seeded with a subtle center-fade line).
    const addDividerBtn = this.querySelector('#ed-add-divider');
    if (addDividerBtn) {
      addDividerBtn.addEventListener('click', () => {
        this._config.sections.push(normalizeDividerSection({
          type: 'divider', label: '', thickness: 1, length: 100, justify: 'center'
        }));
        this._fireConfigChanged();
        this.renderEditor();
      });
    }

    // Divider section config. `_dividerPatch` mutates the section in place then
    // re-normalizes it (keeps the divider shape clean). Text/number/color/select
    // apply live (no re-render); checkboxes that reveal fields re-render.
    const dividerPatch = (sid, key, val, rerender) => {
      const s = (this._config.sections || []).find(x => x.id === sid);
      if (!s) return;
      s[key] = val;
      const i = this._config.sections.findIndex(x => x.id === sid);
      this._config.sections[i] = normalizeDividerSection(s);
      this._fireConfigChanged();
      if (rerender) this.renderEditor();
    };
    // Live-repaint a divider's preview box in place (no full re-render) after a
    // value edit, so the user sees the change without losing focus/scroll.
    const refreshDivPreview = (sid) => {
      const box = this.querySelector(`.ed-div-preview[data-div-sid="${sid}"]`);
      const s = (this._config.sections || []).find(x => x.id === sid);
      if (box && s) box.innerHTML = dividerLineHtml(s, { scale: this._config.scale || 1.0, divider_color: this._edColors().section_divider });
    };
    this.querySelectorAll('.ed-div-input').forEach(el => {
      const evt = (el.type === 'range' || el.type === 'text' || el.type === 'color') ? 'input' : 'change';
      // Selects that reveal/hide dependent controls must re-render the editor.
      const structural = el.classList.contains('at-structural');
      el.addEventListener(evt, () => {
        const sid = el.dataset.divSid, key = el.dataset.divKey;
        let val = el.value;
        if (el.type === 'range') {
          val = Number(el.value);
          const lbl = this.querySelector(`.ed-div-val[data-div-sid="${sid}"][data-div-key="${key}"]`);
          if (lbl) lbl.textContent = (val === 0 && el.dataset.divZero) ? el.dataset.divZero : `${val}${key === 'length' ? '%' : (/size|thickness|indent/.test(key) ? 'px' : '')}`;
        }
        dividerPatch(sid, key, val, structural);
        if (!structural) refreshDivPreview(sid);
      });
    });
    this.querySelectorAll('.ed-div-check').forEach(el => {
      el.addEventListener('change', () => {
        // Show Line/Text/Icon are inverse of the stored hide_* flags (data-invert).
        const val = el.dataset.invert ? !el.checked : el.checked;
        // gradient/hide toggles change revealed fields → re-render.
        dividerPatch(el.dataset.divSid, el.dataset.divKey, val, true);
      });
    });
    this.querySelectorAll('.ed-div-gpattern').forEach(el => {
      el.addEventListener('change', () => {
        const sid = el.dataset.divSid, idx = el.value;
        const s = (this._config.sections || []).find(x => x.id === sid);
        if (!s) return;
        if (idx === '') { delete s.gradient_pattern; }
        else {
          const pat = DIVIDER_GRADIENT_PATTERNS[Number(idx)];
          if (!pat) return;
          // Resolve null placeholder stops to the divider's own color.
          const color = /^#/.test(s.color || '') ? s.color : '#333333';
          s.stops = pat.stops.map(st => ({ pos: st.pos, color: st.color == null ? color : st.color }));
          s.gradient = true;
          s.gradient_pattern = Number(idx);
        }
        const i = this._config.sections.findIndex(x => x.id === sid);
        this._config.sections[i] = normalizeDividerSection(s);
        this._fireConfigChanged();
        this.renderEditor();
      });
    });
    // Per-stop gradient editor: position slider (live) + color + source mode +
    // add/remove. A manual stop edit drops the pattern tag (→ Custom).
    const stopMutate = (sid, fn, rerender) => {
      const s = (this._config.sections || []).find(x => x.id === sid);
      if (!s) return;
      s.stops = Array.isArray(s.stops) ? s.stops : [];
      fn(s);
      delete s.gradient_pattern;
      const i = this._config.sections.findIndex(x => x.id === sid);
      this._config.sections[i] = normalizeDividerSection(s);
      this._fireConfigChanged();
      if (rerender) this.renderEditor(); else refreshDivPreview(sid);
    };
    this.querySelectorAll('.ed-div-stop-pos').forEach(el => el.addEventListener('input', () => {
      const sid = el.dataset.divSid, i = Number(el.dataset.idx), v = clamp(Number(el.value) || 0, 0, 100);
      const lbl = el.parentElement && el.parentElement.querySelector('.ed-div-stop-pos-val');
      if (lbl) lbl.textContent = `${v}%`;
      stopMutate(sid, s => { if (s.stops[i]) s.stops[i].pos = v; }, false);
    }));
    this.querySelectorAll('.ed-div-stop-color').forEach(el => el.addEventListener('input', () => {
      const sid = el.dataset.divSid, i = Number(el.dataset.idx);
      stopMutate(sid, s => { if (s.stops[i]) s.stops[i].color = el.value; }, false);
    }));
    this.querySelectorAll('.ed-div-stop-mode').forEach(el => el.addEventListener('change', () => {
      const sid = el.dataset.divSid, i = Number(el.dataset.idx), mode = el.value;
      stopMutate(sid, s => {
        const st = s.stops[i]; if (!st) return;
        if (mode === 'transparent') st.color = 'transparent';
        else if (mode === 'theme') st.color = 'theme';
        else if (!/^#[0-9a-f]{6}$/i.test(st.color || '')) st.color = /^#/.test(s.color || '') ? s.color : '#2196F3';
      }, true);   // re-render so the color picker enables/disables
    }));
    this.querySelectorAll('.ed-div-stop-remove').forEach(el => el.addEventListener('click', () => {
      if (!this._confirmDelete('Remove this gradient stop?')) return;
      const sid = el.dataset.divSid, i = Number(el.dataset.idx);
      stopMutate(sid, s => { s.stops.splice(i, 1); }, true);
    }));
    this.querySelectorAll('.ed-div-stop-add').forEach(el => el.addEventListener('click', () => {
      const sid = el.dataset.divSid;
      stopMutate(sid, s => {
        const last = s.stops[s.stops.length - 1];
        const base = /^#/.test(s.color || '') ? s.color : '#2196F3';
        s.stops.push({ pos: last ? Math.min(100, (Number(last.pos) || 0) + 10) : 50, color: base });
        s.gradient = true;
      }, true);
    }));

    // Activity table: toggle the preset menu, then add the chosen preset.
    const addTableMenuBtn = this.querySelector('#ed-add-table-menu');
    const tablePresetMenu = this.querySelector('#ed-table-preset-menu');
    if (addTableMenuBtn && tablePresetMenu) {
      addTableMenuBtn.addEventListener('click', () => {
        tablePresetMenu.style.display = tablePresetMenu.style.display === 'none' ? 'flex' : 'none';
      });
    }
    this.querySelectorAll('.ed-add-table-preset').forEach(el => {
      el.addEventListener('click', () => {
        const key = el.dataset.preset;
        let sectionCfg;
        if (key === '__blank__') {
          sectionCfg = {
            name: 'Entity Table', type: 'activity_table', collapsible: true,
            filter: { include: [{ field: 'domain', op: 'eq', value: 'light' }], exclude: [] },
            columns: [
              { kind: 'name', value: { source: 'name' } },
              { kind: 'value', header: 'State', value: { source: 'state' } }
            ],
            title_row: { text: { template: '{name} - {count}' }, count: { mode: 'rows' } }
          };
        } else {
          const preset = getActivityPresets().find(p => p.key === key);
          sectionCfg = preset ? JSON.parse(JSON.stringify(preset.section)) : null;
        }
        if (!sectionCfg) return;
        // Seed presentation (headers + row style) from the global Entity Table
        // Defaults for any keys this section didn't already specify. The blank
        // table specifies neither, so it fully inherits the house style; named
        // presets keep their own baked-in look.
        applyTableDefaults(sectionCfg, this._config);
        // New-model insert: lift the preset's inline filter into a named global
        // rule set and give the section a dynamic ref (same shape as migration),
        // so presets participate in the Rule Sets system from the start.
        this._config.rule_sets = this._config.rule_sets || [];
        if (_sectionHasInlineFilter(sectionCfg)) {
          const gen = normalizeRuleSetDef({
            name: (sectionCfg.name || 'Section') + ' — filter',
            filter: sectionCfg.filter
          });
          this._config.rule_sets.push(gen);
          sectionCfg.rule_sets = [{ ref: gen.id, mode: 'dynamic' }];
          delete sectionCfg.filter;
        }
        this._config.sections.push(normalizeSection(sectionCfg));
        this._fireConfigChanged();
        this.renderEditor();
      });
    });

    this._attachActivityTableListeners();
    this._paintFramePreviews();

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
        const sec = (this._config.sections || []).find(s => s.id === el.dataset.sectionId);
        const nm = sec ? (sec.name || sec.label || sec.type || 'section') : 'section';
        if (!this._confirmDelete(`Delete the "${nm}" section? This removes the section and its settings. This cannot be undone.`)) return;
        this._config.sections = this._config.sections.filter(
          s => s.id !== el.dataset.sectionId
        );
        this._fireConfigChanged();
        this.renderEditor();
      });
    });

    // Duplicate a section (entities, table, or divider). Deep-copies, gives it a
    // fresh id + a " (copy)" name, and inserts it right after the original.
    this.querySelectorAll('.ed-duplicate-section').forEach(el => {
      el.addEventListener('click', () => {
        const sections = this._config.sections;
        const idx = sections.findIndex(s => s.id === el.dataset.sectionId);
        if (idx < 0) return;
        const clone = JSON.parse(JSON.stringify(sections[idx]));
        clone.id = uid();
        if (clone.type === 'divider') { if (clone.label) clone.label = clone.label + ' (copy)'; }
        else clone.name = (clone.name || 'Section') + ' (copy)';
        const norm = clone.type === 'divider' ? normalizeDividerSection(clone) : normalizeSection(clone);
        sections.splice(idx + 1, 0, norm);
        this._fireConfigChanged();
        this.renderEditor();
      });
    });

    // Hide / show a section: toggles section.hidden (kept in config + editor list,
    // skipped at render). Re-normalizes so the flag is emitted only when true.
    this.querySelectorAll('.ed-hide-section').forEach(el => {
      el.addEventListener('click', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (!section) return;
        const next = { ...section, hidden: !section.hidden };
        const norm = next.type === 'divider' ? normalizeDividerSection(next) : normalizeSection(next);
        const idx = this._config.sections.findIndex(s => s.id === section.id);
        this._config.sections[idx] = norm;
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
          this.renderEditor(); // shows/hides the keep-expanded option
        }
      });
    });

    this.querySelectorAll('.ed-section-keep-expanded').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.keep_expanded_when_entities = el.checked;
          this._fireConfigChanged();
        }
      });
    });

    this.querySelectorAll('.ed-section-default-state').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.default_state = el.value === 'expanded' ? 'expanded' : 'collapsed';
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

    this.querySelectorAll('.ed-section-title-indent').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          const val = parseInt(el.value, 10);
          section.title_indent = val;
          const label = this.querySelector(`.ed-section-title-indent-value[data-section-id="${el.dataset.sectionId}"]`);
          if (label) label.textContent = `${val}px`;
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

    // Secondary info line (per section, Entity Group). Helper mutates the
    // section's secondary_info object, defaulting it if absent.
    const siEdit = (el, fn, rerender) => {
      const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
      if (!section) return;
      section.secondary_info = section.secondary_info || { enabled: true, source: 'attribute' };
      fn(section.secondary_info);
      this._fireConfigChanged();
      if (rerender) this.renderEditor();
    };
    // Structural (reveal/hide controls) -> re-render.
    this.querySelectorAll('.ed-si-enabled').forEach(el => el.addEventListener('change', () =>
      siEdit(el, si => { si.enabled = el.checked; }, true)));
    this.querySelectorAll('.ed-si-source').forEach(el => el.addEventListener('change', () =>
      siEdit(el, si => { si.source = el.value; }, true)));
    this.querySelectorAll('.ed-si-color-custom').forEach(el => el.addEventListener('change', () =>
      siEdit(el, si => { si.color = el.checked ? (si.color || '#808080') : ''; }, true)));
    // Live (no re-render).
    this.querySelectorAll('.ed-si-attribute').forEach(el => el.addEventListener('input', () =>
      siEdit(el, si => { si.attribute = el.value; }, false)));
    this.querySelectorAll('.ed-si-prefix').forEach(el => el.addEventListener('input', () =>
      siEdit(el, si => { si.prefix = el.value; }, false)));
    this.querySelectorAll('.ed-si-color').forEach(el => el.addEventListener('input', () =>
      siEdit(el, si => { si.color = el.value; }, false)));
    this.querySelectorAll('.ed-si-font-size').forEach(el => el.addEventListener('change', () =>
      siEdit(el, si => { const n = parseInt(el.value, 10); if (!Number.isNaN(n)) si.font_size = n; }, false)));
    this.querySelectorAll('.ed-si-indent').forEach(el => el.addEventListener('change', () =>
      siEdit(el, si => { const n = parseInt(el.value, 10); if (!Number.isNaN(n)) si.indent = n; }, false)));
    this.querySelectorAll('.ed-si-font-weight').forEach(el => el.addEventListener('change', () =>
      siEdit(el, si => { si.font_weight = parseInt(el.value, 10); }, false)));
    this.querySelectorAll('.ed-si-italic').forEach(el => el.addEventListener('change', () =>
      siEdit(el, si => { si.italic = el.checked; }, false)));

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

    // Chip color "Custom" toggles: checked = use a custom hex (seeded with the
    // resolved global default so the picker starts sensibly); unchecked = blank
    // to inherit the global chip color. Re-render to show/hide the picker.
    const edColors = this._config.colors || SEEDCard.getStubConfig().colors;
    const chipColorCustomMap = {
      'ed-chip-bg-custom': { key: 'chip_bg', fallback: edColors.chip_bg },
      'ed-chip-border-custom': { key: 'chip_border_color', fallback: edColors.chip_border },
      'ed-chip-text-custom': { key: 'chip_text_color', fallback: edColors.chip_text }
    };
    Object.entries(chipColorCustomMap).forEach(([cls, { key, fallback }]) => {
      this.querySelectorAll('.' + cls).forEach(el => {
        el.addEventListener('change', () => {
          const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
          if (!section) return;
          if (el.checked) {
            // Seed with a valid hex so the color picker has a starting value;
            // rgba() globals can't seed a color input, so fall back to a hex.
            section[key] = /^#[0-9a-fA-F]{6}$/.test(fallback || '') ? fallback : '#2196F3';
          } else {
            section[key] = '';
          }
          this._fireConfigChanged();
          this.renderEditor();
        });
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

    this.querySelectorAll('.ed-chip-hide-state').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) { section.chip_hide_state = el.checked; this._fireConfigChanged(); }
      });
    });

    const chipHideStateMap = {
      'ed-chip-hide-off': 'chip_hide_off',
      'ed-chip-hide-unknown': 'chip_hide_unknown',
      'ed-chip-hide-unavailable': 'chip_hide_unavailable'
    };
    Object.entries(chipHideStateMap).forEach(([cls, key]) => {
      this.querySelectorAll('.' + cls).forEach(el => {
        el.addEventListener('change', () => {
          const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
          if (section) {
            section[key] = el.checked;
            // Drop the migrated-from legacy flag so it doesn't re-expand.
            delete section.chip_hide_when_off;
            this._fireConfigChanged();
          }
        });
      });
    });

    // ---- Chip tap/hold actions ----
    // Returns the action object for the given element's section + kind,
    // creating it if missing.
    const chipActionOf = (el) => {
      const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
      if (!section) return null;
      const key = el.dataset.actionKind === 'hold' ? 'chip_hold_action' : 'chip_tap_action';
      section[key] = normalizeAction(section[key], el.dataset.actionKind === 'hold' ? 'none' : 'more-info');
      return section[key];
    };

    this.querySelectorAll('.ed-chip-action').forEach(el => {
      el.addEventListener('change', () => {
        const a = chipActionOf(el);
        if (a) { a.action = el.value; this._fireConfigChanged(); this.renderEditor(); }
      });
    });

    this.querySelectorAll('.ed-chip-action-entity').forEach(el => {
      el.addEventListener('input', () => {
        const a = chipActionOf(el);
        if (a) { a.action_entity = el.value; this._fireConfigChanged(); }
      });
    });

    this.querySelectorAll('.ed-chip-action-navpath').forEach(el => {
      el.addEventListener('input', () => {
        const a = chipActionOf(el);
        if (a) { a.navigation_path = el.value; this._fireConfigChanged(); }
      });
    });

    this.querySelectorAll('.ed-chip-action-url').forEach(el => {
      el.addEventListener('input', () => {
        const a = chipActionOf(el);
        if (a) { a.url_path = el.value; this._fireConfigChanged(); }
      });
    });

    this.querySelectorAll('.ed-chip-action-service').forEach(el => {
      el.addEventListener('input', () => {
        const a = chipActionOf(el);
        if (a) { a.service = el.value; this._fireConfigChanged(); }
      });
    });

    this.querySelectorAll('.ed-chip-action-servicedata').forEach(el => {
      el.addEventListener('input', () => {
        const a = chipActionOf(el);
        if (!a) return;
        const raw = el.value.trim();
        if (!raw) { a.service_data = {}; el.style.borderColor = ''; this._fireConfigChanged(); return; }
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            a.service_data = parsed;
            el.style.borderColor = '';
            this._fireConfigChanged();
          } else {
            el.style.borderColor = '#f44336';
          }
        } catch (e) {
          // Invalid JSON mid-typing: flag it, don't save.
          el.style.borderColor = '#f44336';
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

    // ---- Entity Display Rules ----
    const ruleOf = (el) => {
      const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
      if (!section || !Array.isArray(section.entity_rules)) return null;
      const rule = section.entity_rules[parseInt(el.dataset.ruleIndex, 10)];
      return rule ? { section, rule } : null;
    };

    this.querySelectorAll('.ed-rule-add').forEach(el => {
      el.addEventListener('click', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (!section) return;
        if (!Array.isArray(section.entity_rules)) section.entity_rules = [];
        section.entity_rules.push(normalizeRule({}));
        this._fireConfigChanged();
        this.renderEditor();
      });
    });

    this.querySelectorAll('.ed-rule-remove').forEach(el => {
      el.addEventListener('click', () => {
        if (!this._confirmDelete('Delete this display rule?')) return;
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (!section || !Array.isArray(section.entity_rules)) return;
        section.entity_rules.splice(parseInt(el.dataset.ruleIndex, 10), 1);
        this._fireConfigChanged();
        this.renderEditor();
      });
    });

    this.querySelectorAll('.ed-rule-join').forEach(el => {
      el.addEventListener('change', () => {
        const ctx = ruleOf(el);
        if (ctx) { ctx.rule.join = el.value === 'or' ? 'or' : 'and'; this._fireConfigChanged(); }
      });
    });

    this.querySelectorAll('.ed-rule-operator').forEach(el => {
      el.addEventListener('change', () => {
        const ctx = ruleOf(el);
        if (ctx) { ctx.rule.operator = el.value === 'ne' ? 'ne' : 'eq'; this._fireConfigChanged(); }
      });
    });

    this.querySelectorAll('.ed-rule-compare-type').forEach(el => {
      el.addEventListener('change', () => {
        const ctx = ruleOf(el);
        if (ctx) {
          ctx.rule.compare_type = el.value === 'entity' ? 'entity' : 'value';
          this._fireConfigChanged();
          this.renderEditor(); // swaps the value input <-> entity picker
        }
      });
    });

    this.querySelectorAll('.ed-rule-value').forEach(el => {
      el.addEventListener('input', () => {
        const ctx = ruleOf(el);
        if (ctx) { ctx.rule.value = el.value; this._fireConfigChanged(); }
      });
    });

    this.querySelectorAll('.ed-rule-compare-entity').forEach(el => {
      el.addEventListener('input', () => {
        const ctx = ruleOf(el);
        if (ctx) { ctx.rule.compare_entity = el.value; this._fireConfigChanged(); }
      });
    });

    // ---- Section Display Condition ----
    this.querySelectorAll('.ed-section-display').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.section_display = el.value === 'hide_when_empty' ? 'hide_when_empty' : 'always';
          this._fireConfigChanged();
        }
      });
    });

    // ---- Per-section entity count in header ----
    this.querySelectorAll('.ed-count-mode').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) {
          section.count_mode = ['title', 'right'].includes(el.value) ? el.value : 'off';
          this._fireConfigChanged();
          this.renderEditor(); // shows/hides prefix + styling controls
        }
      });
    });

    this.querySelectorAll('.ed-count-prefix').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) { section.count_prefix = el.value; this._fireConfigChanged(); }
      });
    });

    this.querySelectorAll('.ed-count-color').forEach(el => {
      el.addEventListener('input', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) { section.count_color = el.value; this._fireConfigChanged(); }
      });
    });

    this.querySelectorAll('.ed-count-font-size').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        const val = parseInt(el.value, 10);
        if (section && !Number.isNaN(val)) { section.count_font_size = val; this._fireConfigChanged(); }
      });
    });

    this.querySelectorAll('.ed-count-font-weight').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) { section.count_font_weight = parseInt(el.value, 10); this._fireConfigChanged(); }
      });
    });

    this.querySelectorAll('.ed-count-font-italic').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (section) { section.count_font_style = el.checked ? 'italic' : 'normal'; this._fireConfigChanged(); }
      });
    });

    // ---- Searchable section entity picker (client-filter + add rows) ----
    // Search box: show/hide candidate rows in place (no re-render → keeps focus).
    this.querySelectorAll('.ed-sec-entity-search').forEach(el => {
      el.addEventListener('input', () => {
        const sid = el.dataset.sectionId;
        const term = el.value.trim().toLowerCase();
        const list = this.querySelector(`.ed-sec-cand-list[data-section-id="${sid}"]`);
        if (!list) return;
        list.querySelectorAll('.ed-sec-cand').forEach(row => {
          const hay = row.dataset.search || '';
          row.style.display = (!term || hay.includes(term)) ? '' : 'none';
        });
      });
    });
    // Add a candidate entity (the + on a search-list row).
    this.querySelectorAll('.ed-sec-cand-add').forEach(el => {
      el.addEventListener('click', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (!section) return;
        const id = el.dataset.entityId;
        if (!id) return;
        if (!(section.entities || []).includes(id)) {
          section.entities = [...(section.entities || []), id];
          this._fireConfigChanged();
          this.renderEditor();
        }
      });
    });

    // ---- Section entity selector: picker, chips, select all / remove all ----
    // Picker adds the chosen entity immediately on selection (no + button).
    this.querySelectorAll('.ed-section-entity-picker').forEach(el => {
      el.addEventListener('change', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (!section || !el.value) return;
        const entities = new Set(section.entities || []);
        if (!entities.has(el.value)) {
          section.entities = [...(section.entities || []), el.value];
          this._fireConfigChanged();
          this.renderEditor();
        }
      });
    });

    // Remove an assigned-entity chip.
    this.querySelectorAll('.ed-section-entity-remove').forEach(el => {
      el.addEventListener('click', () => {
        if (!this._confirmDelete(`Remove "${this._friendly(el.dataset.entityId)}" from this section?`)) return;
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (!section) return;
        section.entities = (section.entities || []).filter(id => id !== el.dataset.entityId);
        this._fireConfigChanged();
        this.renderEditor();
      });
    });

    // Select all currently filter-matched candidate entities.
    this.querySelectorAll('.ed-section-select-all').forEach(el => {
      el.addEventListener('click', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (!section) return;
        const candidates = this._getCandidateEntities();
        const merged = new Set([...(section.entities || []), ...candidates]);
        section.entities = Array.from(merged);
        this._fireConfigChanged();
        this.renderEditor();
      });
    });

    // Clear all entities from this section.
    this.querySelectorAll('.ed-section-select-none').forEach(el => {
      el.addEventListener('click', () => {
        const section = this._config.sections.find(s => s.id === el.dataset.sectionId);
        if (!section) return;
        if (!(section.entities || []).length) return;
        if (!this._confirmDelete(`Clear all ${(section.entities || []).length} entities from this section?`)) return;
        section.entities = [];
        this._fireConfigChanged();
        this.renderEditor();
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
  name: 'Easy Entity Styler Card',
  description: 'Easy Entity Styler Card',
});

console.log(`✅ easy-entity-styler-card registered successfully! [${BUILD_NUMBER}]`);
