================================================================================
  Settings Feature
================================================================================
  Module    : Settings Feature
  Service   : Web
  Version   : 1.0
  Updated   : 2026-07-10
================================================================================

## Deskripsi

Settings page for configuring default agent preferences — default mode, model,
features, and skills. Uses a Zustand-only state approach (no React Query); server
sync is done via raw API calls. Cross-feature dependency on chat hooks for
features, skills, and models data.

## File Structure

```
src/features/settings/
├── index.ts
├── components/
│   └── SettingsPage.tsx
├── hooks/
│   ├── useSettings.ts
│   └── useSettingsPage.ts
├── services/
│   └── settings-api.ts
├── stores/
│   └── settingsStore.ts
└── types/
    └── index.ts
```

## Flow Diagrams

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      useSettingsPage (orchestrator)                  │
│                                                                     │
│   ┌──────────────────┐   ┌──────────────────┐   ┌───────────────┐  │
│   │  useSettings     │   │  useFeatures     │   │  useSkills    │  │
│   │  (Zustand bridge)│   │  (chat RQ hook)  │   │  (chat RQ     │  │
│   └────────┬─────────┘   └────────┬─────────┘   │   hook)       │  │
│            │                      │              └───────┬───────┘  │
│            v                      v                      v          │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    settingsApi (raw fetch)                   │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐   │   │
│   │  │ get()       │  │ update()    │  │ getDefaults()     │   │   │
│   │  │ GET /setting│  │ PUT /setting│  │ GET /settings/    │   │   │
│   │  │ s           │  │ s           │  │ defaults          │   │   │
│   │  └─────────────┘  └─────────────┘  └───────────────────┘   │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                  settingsStore (Zustand)                     │   │
│   │  ┌────────────┐  ┌──────────────┐  ┌────────────────────┐  │   │
│   │  │ config     │  │ setConfig()  │  │ resetConfig()      │  │   │
│   │  │ + persist  │  │ + write to  │  │ + clear localStorage│  │   │
│   │  │ to local   │  │ localStorage │  │ + restore defaults │  │   │
│   │  │ Storage    │  │              │  │                     │  │   │
│   │  └────────────┘  └──────────────┘  └────────────────────┘  │   │
│   └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Page Mount Flow

```
┌──────────────────┐
│  SettingsPage    │
│  rendered        │
└────────┬─────────┘
         │ useSettingsPage() called
         v
┌──────────────────┐      ┌───────────────────────────────┐
│  useSettings()   │      │  useSettingsStore initialised │
│  (Zustand)       │─────→│  config from localStorage     │
└──────────────────┘      └───────────────────────────────┘
         │
         │ useEffect on mount
         v
┌──────────────────┐  success  ┌────────────────────────────┐
│  settingsApi     │──────────→│  store.setConfig(server)   │
│  .get()          │           │  → overwrites localStorage │
│  GET /settings   │           └────────────────────────────┘
└──────────────────┘
         │ error → silently fallback to localStorage
         v
┌──────────────────┐
│  loaded = true   │
└──────────────────┘
```

### Save Flow

```
┌──────────────────┐
│  "Save & Return" │
│  button clicked  │
└────────┬─────────┘
         │ handleSave()
         v
┌──────────────────┐  PUT /settings  ┌──────────────────┐
│  settingsApi     │───────────────→│  Backend API     │
│  .update(config) │                └──────────────────┘
└────────┬─────────┘
         │ on success
         v
┌──────────────────┐
│  setSaved(true)  │
│  show toast      │
│  router.push("/")│
└──────────────────┘
```

## Entry Points & Exports

### Barrel (`src/features/settings/index.ts`)

+----------------+----------+-----------------------------------------------+
| Export         | Kind     | Source                                        |
+----------------+----------+-----------------------------------------------+
| useSettings    | Hook     | hooks/useSettings.ts                          |
+----------------+----------+-----------------------------------------------+
| AgentConfig    | Type     | types/index.ts                                |
+----------------+----------+-----------------------------------------------+
| DEFAULT_AGENT_CONFIG | Constant | types/index.ts                         |
+----------------+----------+-----------------------------------------------+

### Components

+--------------+-----------------------------+----------------------------------------+
| Symbol       | File                        | Props                                  |
+--------------+-----------------------------+----------------------------------------+
| SettingsPage | components/SettingsPage.tsx  | config, loaded, features, skills,      |
|              |                             | models, groupedModels, saved,          |
|              |                             | handleModeChange, handleModelChange,   |
|              |                             | handleFeatureToggle, handleSkillToggle,|
|              |                             | resetConfig, handleSave                |
+--------------+-----------------------------+----------------------------------------+

### Hooks & Services (internal, not barrel-exported)

+-----------------+----------------------------+----------------------------------------+
| Export          | File                       | Purpose                                |
+-----------------+----------------------------+----------------------------------------+
| useSettings     | hooks/useSettings.ts       | Thin Zustand bridge — wraps            |
|                 |                            | useSettingsStore with useCallback      |
+-----------------+----------------------------+----------------------------------------+
| useSettingsPage | hooks/useSettingsPage.ts   | Orchestrator — fetches from Go backend |
|                 |                            | on mount, saves on "Save & Return",    |
|                 |                            | imports useFeatures/useSkills/useModels|
|                 |                            | from chat feature                      |
+-----------------+----------------------------+----------------------------------------+
| settingsApi     | services/settings-api.ts   | get (GET /v1/settings), update         |
|                 |                            | (PUT /v1/settings), getDefaults        |
|                 |                            | (GET /v1/settings/defaults) —          |
|                 |                            | snake↔camel mapping via toDTO /        |
|                 |                            | toAgentConfig                          |
+-----------------+----------------------------+----------------------------------------+

### Store

+------------------+---------------------------+----------------------------------------+
| Export           | File                      | Purpose                                |
+------------------+---------------------------+----------------------------------------+
| useSettingsStore | stores/settingsStore.ts   | Zustand store:                        |
|                  |                           | - config: AgentConfig                  |
|                  |                           | - loaded: boolean                      |
|                  |                           | - setConfig(partial): merges + persist |
|                  |                           | - resetConfig(): clear + restore       |
|                  |                           |   defaults                             |
|                  |                           | localStorage key: "echo_agent_config"  |
+------------------+---------------------------+----------------------------------------+

## Dependencies

### Internal

- `@/lib/api-client` — `api.get()`, `api.put()` for all API calls
- `@/utils/cn` — classname merging
- `@/features/chat/constants` — `CHAT_MODES` (STANDARD, AGENT)
- `@/features/chat/hooks/useFeatures` — `useFeatures()`, type `AgentFeature`
- `@/features/chat/hooks/useSkills` — `useSkills()`, type `AgentSkill`
- `@/features/chat/hooks/useModels` — `useModels()`, type `Model`
- `@/lib/queries` — type `Model`
- `@/lib/query-client` — query client (via chat hooks)

### External

- `zustand` — state management
- `lucide-react` — icons (Settings, Save, RotateCcw, ChevronLeft)
- `next/navigation` — `useRouter`

## Architecture Note

Settings uses **Zustand-only** (NOT React Query). Server sync is performed via
raw API calls (`settingsApi.get/update`). It has a cross-feature dependency on
chat hooks for features, skills, and models data.

## Source References

+-------------------------------------------+-------+------------------------------------------+
| File                                      | Lines | Description                              |
+-------------------------------------------+-------+------------------------------------------+
| src/features/settings/types/index.ts      | 1-13  | AgentConfig interface, DEFAULT_AGENT_CONF |
|                                           |       | IG constant                              |
+-------------------------------------------+-------+------------------------------------------+
| src/features/settings/stores/settingsStore| 1-35  | Zustand store with localStorage persist  |
| .ts                                       |       |                                          |
+-------------------------------------------+-------+------------------------------------------+
| src/features/settings/services/settings-  | 1-45  | settingsApi: get, update, getDefaults     |
| api.ts                                    |       | with snake↔camel mapping                  |
+-------------------------------------------+-------+------------------------------------------+
| src/features/settings/hooks/useSettings.ts| 1-17  | Thin Zustand bridge wrapper              |
+-------------------------------------------+-------+------------------------------------------+
| src/features/settings/hooks/useSettingsPag| 1-92  | Orchestrator hook — fetch on mount,      |
| e.ts                                      |       | save, toggle handlers, model grouping    |
+-------------------------------------------+-------+------------------------------------------+
| src/features/settings/components/Setting  | 1-224 | Settings page UI — 4 sections + save/reset|
| sPage.tsx                                 |       |                                          |
+-------------------------------------------+-------+------------------------------------------+
| src/features/settings/index.ts            | 1-2   | Barrel exports (useSettings, types)      |
+-------------------------------------------+-------+------------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
