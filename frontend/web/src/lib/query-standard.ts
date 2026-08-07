import { keepPreviousData } from "@tanstack/react-query";

/**
 * Standar query server-state — wajib dipakai di semua useQuery/useInfiniteQuery
 * (lihat docs/frontend/web/shared/tanstack-query-setup.md).
 *
 * - placeholderData: keepPreviousData — react-query v5 membuang `data` saat
 *   refetch gagal; tanpa ini UI flash kosong (mis. "No recent chats") dan
 *   tetap kosong sampai query dimuat ulang. Data lama tetap tampil selama
 *   refetch/error — cache tidak pernah di-drop.
 * - retry: 1 — hindari retry storm (default 3).
 * - refetchOnWindowFocus: false — sinkronisasi lewat invalidasi eksplisit,
 *   bukan refetch tak terduga saat tab kembali fokus.
 *
 * Catatan: query yang queryKey-nya berubah per-seleksi (messages per session,
 * prompt versions per template) HARUS menimpa placeholderData dengan fungsi
 * yang dibatasi key sebelumnya — lihat useChatPage/usePromptVersions.
 */
export const QUERY_STANDARD = {
  retry: 1,
  refetchOnWindowFocus: false,
  placeholderData: keepPreviousData,
} as const;
