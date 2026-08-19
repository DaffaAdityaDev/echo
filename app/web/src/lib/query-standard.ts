import { keepPreviousData } from "@tanstack/react-query";

/**
 * Standard query server-state — must be used in every useQuery/useInfiniteQuery
 * (see docs/app/web/shared/tanstack-query-setup.md).
 *
 * - placeholderData: keepPreviousData — react-query v5 drops `data` when a
 *   refetch fails; without this the UI flashes empty (e.g. "No recent chats")
 *   and stays empty until the query reloads. Previous data keeps rendering
 *   during refetch/error — the cache is never dropped.
 * - retry: 1 — avoid retry storms (default 3).
 * - refetchOnWindowFocus: false — synchronize via explicit invalidation,
 *   not unexpected refetches when the tab regains focus.
 *
 * Note: queries whose queryKey changes per-selection (messages per session,
 * prompt versions per template) MUST override placeholderData with a function
 * scoped to the previous key — see useChatPage/usePromptVersions.
 */
export const QUERY_STANDARD = {
  retry: 1,
  refetchOnWindowFocus: false,
  placeholderData: keepPreviousData,
} as const;
