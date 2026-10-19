# Katara Frontend: Feature-Based Architecture Pattern

> Feature boundary rules, layer separation, and strict TypeScript types.

---

## 1. Feature Directory Layout

Every feature under `app/KataraGnosis/frontend/src/features/<feature-name>/` follows the standardized 3-layer architecture:

```
src/features/<feature-name>/
├── components/                   # UI presentation & sub-components
├── hooks/                        # Custom React hooks & mutations
├── services/                     # Typed API calls via lib/api-client
├── stores/                       # Zustand store (if transient state required)
├── types/                        # TypeScript interfaces & snake_case mappers
└── index.ts                      # Clean barrel export
```

---

## 2. Feature Boundaries

- **`auth`**: `LoginPage`, `AuthGuard`, `useAuth`, `useLogin`, `auth-api`, `authStore`.
- **`library`**: `LibraryPage`, `SourceDetailPage`, `UploadZone`, `SourceCard`, `ChunkList`, `ChunkCard`, `SearchPanel`, `editor/*`.
- **`drill`**: `DrillPage`, `McqQuestion`, `TrueFalseQuestion`, `ShortAnswerQuestion`, `ScenarioQuestion`, `FeedbackPanel`, `ResultsScreen`, `useDrill`, `drill-api`, `drillStore`.
- **`progress`**: `DashboardPage`, `ProgressPage`, `MasteryMatrix`, `WeeklySynthesisCard`, `useDashboard`, `useProgress`, `progress-api`.
- **`settings`**: `SettingsPage`, `useSettings`, `settings-api`, `settingsStore`.
- **`shared`**: Shared UI composite widgets (`Sidebar`, `PageHeader`, `MasteryBar`, `StreakBadge`, `ScoreRing`, `SourceTypeIcon`, `StatusBadge`, `Markdown`, `WeeklySheetView`, `QuestionCard`).
