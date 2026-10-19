package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	domainconst "echo-backend/internal/constants/domain"
	msgconst "echo-backend/internal/constants/msg"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// generateUUIDs pre-generates n UUIDs via gen_random_uuid() (same function the
// schema uses as the column default), so bulk CopyFrom rows can reference them.
func generateUUIDs(ctx context.Context, pool *pgxpool.Pool, n int) ([]string, error) {
	rows, err := pool.Query(ctx, "SELECT gen_random_uuid()::text FROM generate_series(1, $1)", n)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := make([]string, 0, n)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// Bulk sessions carry REALISTIC multi-paragraph conversations (~2-3 KB per
// message, ~700 tokens) so every session opened in the UI shows genuine
// content, not placeholder one-liners. 50 sessions = 1,000 messages total.
type bulkTopic struct {
	user   string
	assist string
}

var bulkTopics = []bulkTopic{
	{
		user: `Halo, kemarin tim kami mengimplementasikan pagination berbasis offset di endpoint list session. Awalnya lancar, tapi setelah data bertambah sampai ratusan ribu baris, halaman 3 ke atas mulai terasa lambat dan kadang response-nya timeout. Saya sudah cek query plan-nya: sepertinya PostgreSQL tetap melakukan seq scan pada tabel sessions meskipun kolom id dan user_id sudah dibuatkan index. Ini cukup aneh karena kondisi WHERE-nya sederhana, hanya user_id dengan status aktif.

Apakah sebaiknya kami pindah ke keyset pagination (WHERE id > last_id) atau cukup menambahkan composite index (user_id, updated_at DESC)? Kalau melihat pola akses kami, user hampir selalu membuka session terbaru dulu, jadi sorting berdasarkan updated_at sangat sering terjadi. Saya juga penasaran bagaimana cara terbaik mengukur dampak index baru ini di staging tanpa mengganggu traffic produksi, misalnya apakah EXPLAIN ANALYZE dengan sample query sudah cukup mewakili atau perlu simulasi beban dengan pgbench.`,
		assist: `# Analisis Pagination Lambat

Terima kasih atas detail yang lengkap — ini pola klasik yang sering kami temui. Saya pecah jawabannya menjadi tiga bagian.

## 1. Kenapa seq scan masih terjadi

PostgreSQL bisa memilih seq scan meskipun index ada. Penyebab paling umum:

- Estimasi kardinalitas meleset karena statistics belum di-update — coba jalankan ANALYZE sessions dulu.
- Filter status = 'active' tidak selektif sehingga planner memutuskan full scan lebih murah.
- OFFSET besar memaksa database membaca dan membuang ribuan baris — offset 50000 akan membaca 50 ribu baris walau hanya 10 yang dikembalikan. Ini biaya yang tidak pernah hilang.

## 2. Rekomendasi: keyset vs composite index

Untuk pola akses Anda, saya sarankan kombinasi keduanya, bukan memilih salah satu:

- Composite index (user_id, status, updated_at DESC) — menyelesaikan kasus halaman awal (1-5) yang masih sering diakses.
- Keyset pagination untuk halaman dalam — WHERE (updated_at, id) < ($last_updated, $last_id) — biaya konstan berapapun halamannya. OFFSET dibuang total.

Catatan penting: keyset tidak bisa melompat ke halaman acak. Kalau UI Anda butuh itu, pertahankan offset hanya untuk halaman pertama dan alihkan ke keyset untuk navigasi next.

## 3. Pengukuran tanpa mengganggu produksi

Staging dengan profil data yang sama adalah minimum. Langkah yang saya sarankan:

1. Salin struktur + sample 10% baris ke staging.
2. EXPLAIN (ANALYZE, BUFFERS) untuk query halaman 1, 10, dan 100.
3. Jalankan pgbench dengan skenario read-only 5 menit, bandingkan p95 sebelum vs sesudah index.

Satu hal lagi: periksa juga shared_buffers dan work_mem — di server dengan RAM besar, tuning ini kadang memberi dampak lebih besar daripada pagination itu sendiri. Kalau mau, kirimkan output EXPLAIN aktual dari staging, nanti saya bantu baca plan-nya.`,
	},
	{
		user: `Kami sedang memindahkan layanan chat dari monolith ke arsitektur microservice dan salah satu bagian yang paling bikin pusing adalah SSE streaming. Sebelumnya semua state ada di memori proses yang sama, sekarang pesan harus lewat Redis pub/sub supaya konsisten di semua instance. Masalahnya, kadang event terkirim dua kali atau bahkan hilang ketika instance restart di tengah stream.

Saya baca dokumentasi bahwa Redis pub/sub itu fire-and-forget, jadi sepertinya pendekatan kami salah dari awal. Apakah sebaiknya kami pindah ke stream Redis (XADD/XREAD) dengan consumer group? Kalau iya, bagaimana menangani offset cursor per user — apakah cukup menyimpan last event ID di sisi client dan meminta lagi via HTTP setelah reconnect, atau harus ada mekanisme replay server-side? Mohon jelaskan juga trade-off latency-nya, karena di layanan kami latency di bawah 500ms itu sudah dianggap lambat.`,
		assist: `# SSE Streaming dengan Redis

Keputusan Anda benar — Redis pub/sub untuk SSE multi-instance adalah jebakan klasik. Saya jelaskan mengapa dan apa penggantinya.

## Kenapa pub/sub gagal di sini

Pub/sub tidak menyimpan history. Begitu subscriber disconnect (misal instance restart), event yang terbit saat itu hilang permanen. Tidak ada offset, tidak ada replay, tidak ada jaminan order antar channel. Untuk streaming percakapan yang harus konsisten, ini bukan alat yang tepat.

## Redis Streams + consumer group

Redis Streams (XADD/XREADGROUP) memang jawaban yang tepat:

- Setiap event punya ID monotonik (timestamp-sequence) — basis yang solid untuk cursor.
- Consumer group memberi jaminan: tiap event diproses satu instance saja, dengan XACK setelah sukses.
- XPENDING + XAUTOCLAIM menangani instance yang mati di tengah proses.

## Desain yang saya rekomendasikan

Untuk aplikasi chat Anda:

1. Satu stream per session (atau shard per 100 session) — jangan satu stream global, karena akan jadi hotspot dan beban replay jadi besar.
2. Producer menulis XADD session:1234 * event user_message dengan payload lengkap.
3. Consumer (instance yang pegang SSE) melakukan XREADGROUP GROUP chat session:1234 > dalam loop.
4. Cursor client cukup last_event_id — saat reconnect, client request ke HTTP GET /messages?after=<id>, server baca stream dari ID itu dan kirim ulang yang hilang.

## Trade-off latency

XADD + XREADGROUP menambah sekitar 0.5-2 ms per event di jaringan lokal — jauh di bawah 500 ms target Anda. Yang lebih berpengaruh adalah:

- Blocking read (XREADGROUP BLOCK 5000) membuat consumer idle tanpa polling.
- Jangan pakai XREAD polos tanpa group kalau ada lebih dari satu instance.

Catatan terakhir: Redis Streams menyimpan data di RAM — atur MAXLEN ~ 10000 per stream supaya history pendek tidak menguras memori. Untuk replay lebih dari beberapa menit, baca dari database utama, bukan dari Redis.`,
	},
	{
		user: `Halo, kami mau hardening deployment Docker untuk aplikasi web yang dipakai internal, dan ada beberapa keputusan yang belum yakin. Pertama, apakah sebaiknya menjalankan container sebagai non-root? Saya lihat banyak image official masih default root dan mudah dibuat salah. Kedua, bagaimana cara terbaik mengelola secret — selama ini kami menaruh semuanya di environment variable yang disuntik saat container start, tapi kemarin ada kejadian secret bocor ke log karena salah satu library mencetak seluruh env saat debug.

Ketiga, soal health check — kami pakai probe HTTP di endpoint /health, tapi kadang container dibilang sehat padahal dependency-nya (database, cache) sudah mati, jadi traffic masuk dan error baru ketahuan belakangan. Apakah ada pola yang lebih ketat untuk readiness yang benar-benar merefleksikan ketersediaan dependency? Terakhir, kami juga mempertimbangkan memakai read-only root filesystem — apakah ini akan banyak memakan effort untuk migrasi dari image yang sudah berjalan?`,
		assist: `# Hardening Deployment Docker

Pertanyaan yang bagus dan semuanya saling terkait. Saya bahas satu per satu.

## 1. Non-root container — wajib

Ya, ini bukan opsi lagi, ini standar minimum. Di Dockerfile, setelah COPY binary:

- Tambahkan RUN addgroup -S appgroup && adduser -S appuser -G appgroup.
- USER appuser sebelum CMD.
- Pastikan direktori yang ditulis (log, cache, tmp) punya permission yang benar: RUN mkdir -p /app/data && chown appuser:appgroup /app/data.

Konsekuensinya: port di bawah 1024 tidak bisa di-bind — jalankan di 8080 dan map port di compose. Ini justru bagus karena memaksa Anda eksplisit soal port.

## 2. Secret management

Environment variable langsung adalah anti-pattern untuk secret:

- Gunakan Docker secrets (Swarm) atau file mount /run/secrets/ — aplikasi membaca file, bukan env.
- Kalau pakai compose: secrets section, bukan environment.
- Di aplikasi: pastikan konfigurasi logging memfilter key yang mengandung PASSWORD, TOKEN, SECRET sebelum mencetak.
- Selalu gunakan tool seperti trivy di CI untuk scan image — banyak kebocoran secret terjadi lewat layer image yang tidak sengaja di-commit.

## 3. Readiness yang benar

Probe /health yang hanya mengecek proses hidup tidak cukup. Pisahkan menjadi tiga:

- Liveness: proses hidup? (/health/live) — tanpa cek dependency.
- Readiness: siap terima traffic? Cek koneksi ke PostgreSQL dan Redis dengan timeout pendek (misal 2 detik). Kalau dependency mati, kembalikan 503 supaya orchestrator menarik traffic.
- Startup: untuk aplikasi yang lambat inisialisasi — probe terpisah dengan failureThreshold lebih besar supaya tidak membunuh container yang masih booting.

## 4. Read-only root filesystem

Sangat layak dan tidak separah yang dibayangkan:

- read_only: true di compose, lalu mount tmpfs di /tmp (tmpfs: /tmp).
- Cari semua penulisan ke disk di aplikasi: log file, cache file, session — pindahkan ke volume atau stdout.
- Untuk Go: pastikan tidak ada kode yang menulis ke os.TempDir() secara implisit — mount tmpfs menanganinya.

Kombinasi non-root + read-only fs + readiness dependency-aware menghilangkan mayoritas masalah keamanan container yang umum. Kalau nanti ada output docker scan yang perlu dibaca, kirim saja ke sini.`,
	},
}

var bulkUserExtensions = []string{
	`Sebenarnya ada satu hal lagi yang ingin saya tambahkan: tim kami sempat mencoba solusi serupa bulan lalu dan hasilnya tidak sesuai harapan. Apakah ada gotcha yang biasanya baru ketahuan setelah dipakai beberapa minggu? Saya lebih suka tahu risiko jangka panjangnya sekarang daripada kaget di tengah jalan.`,
	`Kalau dilihat dari sisi operasional, tim kami kecil — cuma tiga engineer yang merangkap on-call. Jadi solusi yang butuh maintenance rutin atau tooling tambahan yang berat mungkin sulit diadopsi. Kalau ada opsi yang lebih sederhana tapi tetap benar secara arsitektur, saya lebih memilih itu.`,
	`Saya juga sudah coba menerapkan sebagian saran ini di lingkungan staging dan hasilnya cukup menjanjikan. Yang masih saya ragu adalah cara mengukur dampaknya secara kuantitatif — apakah ada metrik spesifik yang sebaiknya dipantau di dashboard supaya kami bisa membandingkan sebelum dan sesudah perubahan?`,
}

var bulkAssistantExtensions = []string{
	`## Hal yang sering terlewat

Satu catatan yang sering membuat tim terjebak: perubahan ini jarang berdampak sendiri-sendiri, tapi hampir selalu berinteraksi dengan tuning lain. Misalnya pagination cepat tapi query lain jadi lambat karena index baru menambah biaya write. Karena itu saya selalu sarankan mengukur end-to-end (p95 dari perspektif user), bukan cuma query individual.

Selain itu, jangan lupa dokumentasikan keputusan ini di runbook — enam bulan lagi orang yang membaca kode ini mungkin bukan tim yang sama, dan alasan di balik pilihan arsitektur sama berharganya dengan implementasinya.`,
	`## Checklist sebelum produksi

Sebelum rilis, saya biasa memastikan hal-hal berikut:

1. Backout plan tertulis — apa yang di-rollback dan berapa lama.
2. Metrik baseline tercatat (latency p50/p95, error rate, resource usage) minimal 24 jam sebelum perubahan.
3. Alert yang memantau metrik tersebut sudah aktif — bukan sesudah insiden.
4. Uji coba di jam sibuk, bukan di jam kosong — perilaku beban tinggi sering berbeda total.

Dengan checklist ini, kalau terjadi regresi, Anda bisa langsung melihat dari dashboard mana sumbernya tanpa harus menyelidiki dari nol.`,
	`## Estimasi effort

Berdasarkan pengalaman implementasi serupa, hitungan kasar effort-nya: satu sampai dua hari untuk perubahan inti, setengah hari untuk testing, dan satu hari untuk observability (metrik + alert). Kalau tim Anda kecil seperti yang disebutkan, saya sarankan mengerjakan dalam dua tahap: tahap pertama hanya yang benar-benar menyelesaikan masalah utama, tahap kedua sisanya.

Yang penting diingat: jangan menunda karena terlihat besar. Perubahan yang dipecah kecil dan di-deploy bertahap selalu lebih murah daripada yang ditumpuk jadi satu rilis besar.`,
}

func buildBulkUserMessage(sessionIdx, turn int) string {
	topic := bulkTopics[sessionIdx%len(bulkTopics)]
	ext := bulkUserExtensions[(sessionIdx+turn)%len(bulkUserExtensions)]
	return fmt.Sprintf("## Konteks\n\n%s\n\n%s", topic.user, ext)
}

func buildBulkAssistantReply(sessionIdx, turn int) string {
	topic := bulkTopics[sessionIdx%len(bulkTopics)]
	ext := bulkAssistantExtensions[(sessionIdx+turn)%len(bulkAssistantExtensions)]
	return fmt.Sprintf("%s\n\n%s", topic.assist, ext)
}

// seedBulkSessions creates 50 sessions (1,000 messages total) to stress test
// list pagination and session indexing.
func seedBulkSessions(ctx context.Context, pool *pgxpool.Pool, userID int) {
	slog.Info(msgconst.InfoPreparingBulk, msgconst.ComponentKey, msgconst.ComponentSeed)
	startTime := time.Now()

	const totalSessions = 50
	const batchSize = 50
	const turnsPerSession = 10

	for batchStart := 0; batchStart < totalSessions; batchStart += batchSize {
		batchEnd := batchStart + batchSize
		if batchEnd > totalSessions {
			batchEnd = totalSessions
		}

		ids, err := generateUUIDs(ctx, pool, batchEnd-batchStart)
		if err != nil {
			slog.Error(msgconst.ErrGenerateUUIDs, msgconst.ComponentKey, msgconst.ComponentSeed, msgconst.KeyBatchStart, batchStart, msgconst.KeyErr, err)
			os.Exit(1)
		}

		tx, err := pool.Begin(ctx)
		if err != nil {
			slog.Error(msgconst.ErrBeginTransaction, msgconst.ComponentKey, msgconst.ComponentSeed, msgconst.KeyErr, err)
			os.Exit(1)
		}

		sessionRows := [][]interface{}{}
		messageRows := [][]interface{}{}

		for idx, sessionID := range ids {
			i := batchStart + 1 + idx
			title := fmt.Sprintf("Bulk Chat Session %d", i)
			daysAgo := (totalSessions - i) / 5 // Spread sessions over 10 days
			createdAt := time.Now().AddDate(0, 0, -daysAgo).Add(time.Duration(i) * time.Second)

			sessionRows = append(sessionRows, []interface{}{
				sessionID,
				userID,
				title,
				fmt.Sprintf("Summary of bulk session %d containing simulated conversational load test data.", i),
				domainconst.StatusActive,
				"nlah:v1",
				createdAt,
				createdAt,
				createdAt,
			})

			for turn := 1; turn <= turnsPerSession; turn++ {
				userMsgTime := createdAt.Add(time.Duration(turn) * time.Minute)
				assistMsgTime := userMsgTime.Add(30 * time.Second)

				userContent := buildBulkUserMessage(i, turn)
				assistantContent := buildBulkAssistantReply(i, turn)

				messageRows = append(messageRows,
					[]interface{}{sessionID, domainconst.MessageRoleUser, userContent, countTokensCached(userContent), turn, userMsgTime},
					[]interface{}{sessionID, domainconst.MessageRoleAssistant, assistantContent, countTokensCached(assistantContent), turn, assistMsgTime},
				)
			}
		}

		// Copy Sessions
		_, err = tx.CopyFrom(
			ctx,
			pgx.Identifier{"sessions"},
			[]string{"id", "user_id", "title", "context_summary", "status", "strategy_version", "last_accessed_at", "created_at", "updated_at"},
			pgx.CopyFromRows(sessionRows),
		)
		if err != nil {
			_ = tx.Rollback(ctx)
			slog.Error(msgconst.ErrCopySessionsBatch, msgconst.ComponentKey, msgconst.ComponentSeed, msgconst.KeyBatchStart, batchStart, msgconst.KeyErr, err)
			os.Exit(1)
		}

		// Copy Messages
		_, err = tx.CopyFrom(
			ctx,
			pgx.Identifier{"messages"},
			[]string{"session_id", "role", "content", "token_count", "turn_number", "created_at"},
			pgx.CopyFromRows(messageRows),
		)
		if err != nil {
			_ = tx.Rollback(ctx)
			slog.Error(msgconst.ErrCopyMessagesBatch, msgconst.ComponentKey, msgconst.ComponentSeed, msgconst.KeyBatchStart, batchStart, msgconst.KeyErr, err)
			os.Exit(1)
		}

		err = tx.Commit(ctx)
		if err != nil {
			slog.Error(msgconst.ErrCommitTransaction, msgconst.ComponentKey, msgconst.ComponentSeed, msgconst.KeyBatchStart, batchStart, msgconst.KeyErr, err)
			os.Exit(1)
		}

		slog.Info(msgconst.InfoCommittedBatch, msgconst.ComponentKey, msgconst.ComponentSeed, msgconst.KeyFrom, batchStart+1, msgconst.KeyTo, batchEnd)
	}

	slog.Info(msgconst.InfoDatabaseSeededFull, msgconst.ComponentKey, msgconst.ComponentSeed, msgconst.KeySessions, totalSessions, msgconst.KeyMessages, totalSessions*turnsPerSession*2, msgconst.KeyElapsed, time.Since(startTime))
}
