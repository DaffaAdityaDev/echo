package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	domainconst "echo-backend/internal/constants/domain"
	msgconst "echo-backend/internal/constants/msg"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// stressParagraphs is a pool of realistic technical paragraphs used to build
// the ~4.4 MB / ~1.1M token stress messages. Content is real text (not lorem
// ipsum) rotated per message so no two messages have identical ordering.
var stressParagraphs = []string{
	`Pagination berbasis offset memang paling mudah diimplementasikan, tetapi biayanya membengkak seiring pertumbuhan data. Setiap loncatan halaman membuat database membaca ulang semua baris sebelumnya hanya untuk membuangnya, sehingga latensi naik hampir linear terhadap offset. Keyset pagination memecahkan masalah ini dengan memanfaatkan index yang sudah ada, namun menuntut UI untuk tidak lagi mendukung lompatan ke halaman acak.`,
	`Composite index yang disusun dengan urutan kolom yang tepat adalah investasi kecil dengan dampak besar. Untuk query yang selalu difilter oleh user_id lalu diurutkan berdasarkan updated_at, index (user_id, updated_at DESC) membuat PostgreSQL membaca hanya baris yang relevan. Tanpa index seperti ini, planner terpaksa memilih sequential scan yang biayanya terus naik seiring tabel membesar.`,
	`Redis Streams menyediakan struktur data append-only yang sempurna untuk event streaming antar service. Dengan consumer group, setiap event hanya diproses oleh satu consumer, dan XPENDING menyimpan jejak event yang belum di-ack. Ketika sebuah instance mati di tengah proses, XAUTOCLAIM mengambil alih event yang tertinggal tanpa duplikasi.`,
	`Pub/sub memang cepat, tetapi ia tidak menyimpan apa pun. Event yang terbit saat tidak ada subscriber akan hilang tanpa jejak, dan tidak ada cara untuk memutar ulang history setelah reconnect. Untuk sistem yang membutuhkan konsistensi seperti chat atau notifikasi, ketiadaan durability ini sering menjadi akar bug yang sulit dilacak.`,
	`Menjalankan container sebagai user non-root adalah langkah keamanan paling berdampak dengan biaya paling kecil. Eksploitasi di dalam container yang berjalan sebagai root memberikan akses penuh ke proses di dalamnya, termasuk kemampuan membaca file lain. Dengan USER appuser, blast radius setiap kerentanan langsung mengecil.`,
	`Menyuntikkan secret lewat environment variable memang praktis, tetapi env ikut tercetak ke dalam proses inspect, log startup, dan terkadang error dump library. Alternatif yang lebih aman adalah menempatkan secret sebagai file mount yang hanya bisa dibaca oleh aplikasi, sehingga developer tidak bisa sembarangan melihatnya dan library yang verbose pun tidak akan membocorkannya.`,
	`Readiness probe yang hanya memastikan proses hidup tidak melindungi traffic dari kegagalan dependency. Probe yang baik melakukan check ringan ke database dan cache dengan timeout pendek, lalu mengembalikan 503 ketika salah satu dependency tidak terjangkau. Orchestrator kemudian menarik pod dari service endpoint sampai semuanya pulih.`,
	`OpenTelemetry memberi satu standar untuk trace, metric, dan log sehingga observability tidak terkunci pada satu vendor. Setelah pipeline telemetri terpasang, trace antar service otomatis terhubung lewat konteks propagasi, dan masalah latency antar komponen langsung terlihat di backend seperti Jaeger atau Tempo.`,
	`Load test yang baik dimulai dari profil traffic yang realistis, bukan sekadar request per detik maksimal. Gunakan skenario yang merepresentasikan perilaku user nyata, lengkap dengan waktu pikir dan distribusi endpoint. Hasilnya selalu dibaca di persentil, karena p50 yang mulus bisa menyembunyikan p99 yang berantakan.`,
	`Cache mempercepat pembacaan, tetapi invalidasi adalah sumber bug paling umum di sistem terdistribusi. Pendekatan yang paling dapat dipertanggungjawabkan adalah versioning pada key dan TTL pendek sebagai jaring pengaman, ditambah event bus untuk menghapus key yang berubah secara proaktif. Tanpa strategi invalidasi, cache hanya menunda masalah, bukan menyelesaikannya.`,
	`SSE membutuhkan strategi reconnect yang eksplisit karena koneksi TCP bisa putus tanpa pemberitahuan. Client sebaiknya mengirim Last-Event-ID saat menyambung kembali, dan server menjawab dengan event yang terlewat sejak ID tersebut. Kombinasi ini membuat stream toleran terhadap restart instance tanpa kehilangan data.`,
	`Pprof adalah alat pertama yang harus dijalankan ketika Go service terasa lambat. Dengan membuka endpoint debug, kita bisa mendapatkan heap profile dan CPU profile yang langsung menunjukkan fungsi mana yang menghabiskan waktu. Tuning tanpa data profile hampir selalu menebak-nebak dan jarang tepat sasaran.`,
}

// buildStressMessageText builds a long realistic text (~targetChars bytes) by
// rotating through stressParagraphs, starting at a per-message offset so no two
// messages have identical ordering.
func buildStressMessageText(targetChars int, offset int) string {
	var sb strings.Builder
	for i := offset; sb.Len() < targetChars; i++ {
		sb.WriteString(stressParagraphs[i%len(stressParagraphs)])
		sb.WriteString("\n\n")
	}
	return sb.String()
}

// seedStressSession creates one session with 10 turns (20 messages) of
// ~4.4 MB / ~1.1M tokens each (realistic text) to stress test rendering and
// pagination.
func seedStressSession(ctx context.Context, pool *pgxpool.Pool, userID int) {
	slog.Info(msgconst.InfoSeedingStress, msgconst.ComponentKey, msgconst.ComponentSeed)

	createdAt := time.Now()
	var stressSessionID string
	err := pool.QueryRow(ctx,
		`INSERT INTO sessions (user_id, title, context_summary, status, strategy_version, last_accessed_at, created_at, updated_at)
		 VALUES ($1, $2, $3, 'active', 'nlah:v1', $4, $4, $4)
		 RETURNING id`,
		userID,
		"🔥 Stress Test Session (1M Context)",
		"10 turns of ~4.4 MB user/assistant messages to stress test the frontend scroll performance and backend pagination.",
		createdAt,
	).Scan(&stressSessionID)
	if err != nil {
		slog.Error(msgconst.ErrCreateStressSession, msgconst.ComponentKey, msgconst.ComponentSeed, msgconst.KeyErr, err)
		os.Exit(1)
	}

	const turns = 10
	const stressTargetChars = 4_400_000 // ~4.4 MB ≈ ~1.1M tokens per message content

	messageRows := make([][]interface{}, 0, turns*2)
	for turn := 1; turn <= turns; turn++ {
		msgTime := createdAt.Add(-time.Duration(10000-turn) * time.Second)

		userContent := fmt.Sprintf("Turn %d: %s", turn, buildStressMessageText(stressTargetChars, turn))
		assistantContent := fmt.Sprintf("Reply %d: %s", turn, buildStressMessageText(stressTargetChars, turn+100))

		messageRows = append(messageRows,
			[]interface{}{stressSessionID, domainconst.MessageRoleUser, userContent, countTokensCached(userContent), turn, msgTime},
			[]interface{}{stressSessionID, domainconst.MessageRoleAssistant, assistantContent, countTokensCached(assistantContent), turn, msgTime.Add(30 * time.Second)},
		)
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		slog.Error(msgconst.ErrBeginTxStress, msgconst.ComponentKey, msgconst.ComponentSeed, msgconst.KeyErr, err)
		os.Exit(1)
	}
	_, err = tx.CopyFrom(
		ctx,
		pgx.Identifier{"messages"},
		[]string{"session_id", "role", "content", "token_count", "turn_number", "created_at"},
		pgx.CopyFromRows(messageRows),
	)
	if err != nil {
		_ = tx.Rollback(ctx)
		slog.Error(msgconst.ErrCopyStressMessages, msgconst.ComponentKey, msgconst.ComponentSeed, msgconst.KeyErr, err)
		os.Exit(1)
	}
	if err := tx.Commit(ctx); err != nil {
		slog.Error(msgconst.ErrCommitStressMessages, msgconst.ComponentKey, msgconst.ComponentSeed, msgconst.KeyErr, err)
		os.Exit(1)
	}

	slog.Info(msgconst.InfoStressSessionReady, msgconst.ComponentKey, msgconst.ComponentSeed, msgconst.KeyID, stressSessionID, msgconst.KeyTitle, "🔥 Stress Test Session (1M Context)")
}
