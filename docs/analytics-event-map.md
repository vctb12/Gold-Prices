# Analytics Event Map — Implemented in this execution

This map only lists events implemented/updated in the current 3-batch run.

## Tracker mode + language

| Event                 | Trigger                                  | Payload (privacy-safe)                   | Source file               |
| --------------------- | ---------------------------------------- | ---------------------------------------- | ------------------------- |
| `tracker_mode_change` | Tracker tab/mode switch                  | `from_mode`, `to_mode`, `workspace`      | `src/tracker/ui-shell.js` |
| `language_switch`     | Tracker language dropdown change         | `from`, `to`, `surface: "tracker"`       | `src/tracker/events.js`   |
| `language_switch`     | Nav language toggle inside tracker shell | `from`, `to`, `surface: "tracker_shell"` | `src/tracker/ui-shell.js` |

## Compare actions

| Event            | Trigger                            | Payload (privacy-safe)                                          | Source file             |
| ---------------- | ---------------------------------- | --------------------------------------------------------------- | ----------------------- |
| `compare_action` | Region tab switch in compare board | `surface`, `action: "region_switch"`, `mode`, `region`          | `src/tracker/events.js` |
| `compare_action` | Compare country selector change    | `surface`, `action: "country_select"`, `mode`, `selected_count` | `src/tracker/events.js` |
| `compare_action` | Compare karat toggle               | `surface`, `action: "karat_toggle"`, `mode`, `selected_count`   | `src/tracker/events.js` |
| `compare_action` | Compare preset apply               | `surface`, `action: "preset_apply"`, `mode`, `preset`           | `src/tracker/events.js` |

## Export clicks

| Event          | Trigger                 | Payload (privacy-safe)                            | Source file             |
| -------------- | ----------------------- | ------------------------------------------------- | ----------------------- |
| `export_click` | Archive export buttons  | `surface`, `export_type: "archive_csv"`, `mode`   | `src/tracker/events.js` |
| `export_click` | History export buttons  | `surface`, `export_type: "history_csv"`, `mode`   | `src/tracker/events.js` |
| `export_click` | JSON download buttons   | `surface`, `export_type: "tracker_json"`, `mode`  | `src/tracker/events.js` |
| `export_click` | Chart export buttons    | `surface`, `export_type: "chart_csv"`, `mode`     | `src/tracker/events.js` |
| `export_click` | Compare export buttons  | `surface`, `export_type: "compare_csv"`, `mode`   | `src/tracker/events.js` |
| `export_click` | Watchlist export button | `surface`, `export_type: "watchlist_csv"`, `mode` | `src/tracker/events.js` |
| `export_click` | Brief download button   | `surface`, `export_type: "brief_txt"`, `mode`     | `src/tracker/events.js` |

## Governance updates in event catalog

- Added `compare_action` and `export_click` to:
  - `EVENTS`
  - `EVENT_SCHEMA`

Source: `src/lib/analytics.js`.
