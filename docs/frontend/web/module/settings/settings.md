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
features, and skills. Server sync is done via React Query (dedup by query key);
fetched data is written into a Zustand store for local persistence and cross-feature
access. Cross-feature dependency on chat hooks for features, skills, and models data.

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
│   │                    settingsApi (via useQuery)                │   │
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
         │ useQuery({ queryKey: ["settings"] })
         │ (React Query dedup — 1 call regardless of mount count)
         v
┌──────────────────┐  on success  ┌────────────────────────────┐
│  useSettingsPage  │────────────→│  useEffect:                │
│  useQuery hook    │             │  store.setConfig(server)   │
│  GET /settings    │             │  → overwrites localStorage │
└──────────────────┘             └────────────────────────────┘
         │ error → console.warn + localStorage fallback
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

Settings uses **React Query** for server sync (deduplication by query key) and
**Zustand** for local persistence + cross-feature access. On mount, `useQuery`
fetches settings — React Query guarantees only one network request even if
`SettingsPage` and `SettingsModal` mount simultaneously. The fetched data is
written into the Zustand store via a `useEffect`. Writes (PUT) still use
raw `settingsApi.update()`. Has a cross-feature dependency on chat hooks for
features, skills, and models data.

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
