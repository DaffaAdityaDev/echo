package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"echo-backend/internal/config"
	"echo-backend/internal/database"
	authmodel "echo-backend/internal/models/auth"
	pkglogger "echo-backend/internal/pkg/logger"
	authrepo "echo-backend/internal/repository/auth"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

var (
	agentHTTPURL  = strings.TrimRight(os.Getenv("AGENT_HTTP_URL"), "/")
	internalToken = os.Getenv("INTERNAL_AUTH_TOKEN")
	tokenCache    = map[string]int{}
)

// countTokensCached counts content with the agent's official tiktoken endpoint
// (BPE tokenizer), cached per unique content. Falls back to chars/4 (with a
// warning) only when the agent is unreachable.
func countTokensCached(content string) int {
	if n, ok := tokenCache[content]; ok {
		return n
	}
	n := countTokensViaAgent(content)
	tokenCache[content] = n
	return n
}

func countTokensViaAgent(text string) int {
	if agentHTTPURL == "" || internalToken == "" {
		return estimateTokens(text)
	}

	payload, err := json.Marshal(map[string]string{"text": text})
	if err != nil {
		return estimateTokens(text)
	}

	req, err := http.NewRequest(http.MethodPost, agentHTTPURL+"/api/internal/tokenize", bytes.NewReader(payload))
	if err != nil {
		return estimateTokens(text)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Token", internalToken)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		slog.Warn("agent tokenize unreachable, falling back to estimate", "component", "seed", "err", err)
		return estimateTokens(text)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		slog.Warn("agent tokenize failed, falling back to estimate", "component", "seed", "status", resp.StatusCode)
		return estimateTokens(text)
	}

	var out struct {
		Tokens int `json:"tokens"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		slog.Warn("agent tokenize decode failed, falling back to estimate", "component", "seed", "err", err)
		return estimateTokens(text)
	}
	return out.Tokens
}

// estimateTokens is the last-resort chars/4 approximation used only when the
// agent's tokenizer endpoint is unreachable.
func estimateTokens(content string) int {
	tokens := len(content) / 4
	if tokens == 0 && len(content) > 0 {
		return 1
	}
	return tokens
}

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

func main() {
	loadTest := flag.Bool("load-test", false, "Seed stress session + 50 bulk sessions (dev only, TRUNCATES sessions)")
	flag.Parse()

	if err := config.LoadDotEnv(".env"); err != nil {
		slog.Info("no .env file found, using system environment variables")
	}

	pkglogger.Init(os.Getenv("ENVIRONMENT"))

	cfg := config.Load()

	pool := database.NewPostgresPool(cfg)
	if pool == nil {
		slog.Error("DATABASE_URL not set or database pool initialization failed")
		os.Exit(1)
	}
	defer pool.Close()

	ctx := context.Background()
	userRepo := authrepo.NewRepository(pool)

	adminPassword := os.Getenv("ADMIN_PASSWORD")
	if adminPassword == "" {
		slog.Error("ADMIN_PASSWORD environment variable is required to seed the admin user")
		os.Exit(1)
	}

	email := "admin@gmail.com"
	var adminUser *authmodel.User
	existingUser, err := userRepo.GetByEmail(ctx, email)
	if err != nil {
		slog.Error("failed to check existing user", "component", "seed", "err", err)
		os.Exit(1)
	}

	if existingUser != nil {
		slog.Info("user already exists, using existing id", "component", "seed", "email", email, "user_id", existingUser.ID)
		adminUser = existingUser
	} else {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
		if err != nil {
			slog.Error("failed to hash password", "component", "seed", "err", err)
			os.Exit(1)
		}

		adminUser = &authmodel.User{
			Email:        email,
			PasswordHash: string(hashedPassword),
			Name:         "Admin",
			Role:         "admin",
		}

		if err := userRepo.Create(ctx, adminUser); err != nil {
			slog.Error("failed to seed admin user", "component", "seed", "err", err)
			os.Exit(1)
		}
		slog.Info("seeded default admin user", "component", "seed", "user_id", adminUser.ID)
	}

	if !*loadTest {
		slog.Info("safe mode: skipping database truncation and fake load-test data seeding", "component", "seed")
		slog.Info("database seeded successfully with default admin user", "component", "seed")
		return
	}

	// ---- Load-test path (development only) ----

	if strings.EqualFold(os.Getenv("APP_ENV"), "production") {
		slog.Error("refusing --load-test with APP_ENV=production: it TRUNCATES all sessions and messages. Development only.")
		os.Exit(1)
	}

	fmt.Print("--load-test will TRUNCATE all sessions and messages. Type 'yes' to continue: ")
	scanner := bufio.NewScanner(os.Stdin)
	scanner.Scan()
	if strings.TrimSpace(strings.ToLower(scanner.Text())) != "yes" {
		slog.Error("aborted: --load-test requires explicit 'yes' confirmation")
		os.Exit(1)
	}

	slog.Info("cleaning up old sessions and messages", "component", "seed")
	if _, err := pool.Exec(ctx, "TRUNCATE TABLE sessions CASCADE"); err != nil {
		slog.Error("failed to truncate sessions table", "component", "seed", "err", err)
		os.Exit(1)
	}
	slog.Info("old sessions and messages truncated successfully", "component", "seed")

	seedStressSession(ctx, pool, adminUser.ID)
	seedBulkSessions(ctx, pool, adminUser.ID)

	slog.Info("load-test seeding complete", "component", "seed")
}

// seedStressSession creates one session with 10 turns (20 messages) of
// ~4.4 MB / ~1.1M tokens each (realistic text) to stress test rendering and
// pagination.
func seedStressSession(ctx context.Context, pool *pgxpool.Pool, userID int) {
	slog.Info("seeding stress session with 10 turns (20 messages), ~4.4 MB (~1.1M tokens) per message", "component", "seed")

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
		slog.Error("failed to create stress session", "component", "seed", "err", err)
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
			[]interface{}{stressSessionID, "user", userContent, countTokensCached(userContent), turn, msgTime},
			[]interface{}{stressSessionID, "assistant", assistantContent, countTokensCached(assistantContent), turn, msgTime.Add(30 * time.Second)},
		)
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		slog.Error("failed to begin transaction for stress messages", "component", "seed", "err", err)
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
		slog.Error("failed to copy stress messages", "component", "seed", "err", err)
		os.Exit(1)
	}
	if err := tx.Commit(ctx); err != nil {
		slog.Error("failed to commit stress messages", "component", "seed", "err", err)
		os.Exit(1)
	}

	slog.Info("stress test session ready", "component", "seed", "id", stressSessionID, "title", "🔥 Stress Test Session (1M Context)")
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
	slog.Info("preparing to seed 50 sessions and 1,000 realistic long-format messages", "component", "seed")
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
			slog.Error("failed to generate UUIDs for batch", "component", "seed", "batch_start", batchStart, "err", err)
			os.Exit(1)
		}

		tx, err := pool.Begin(ctx)
		if err != nil {
			slog.Error("failed to begin transaction", "component", "seed", "err", err)
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
				"active",
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
					[]interface{}{sessionID, "user", userContent, countTokensCached(userContent), turn, userMsgTime},
					[]interface{}{sessionID, "assistant", assistantContent, countTokensCached(assistantContent), turn, assistMsgTime},
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
			slog.Error("failed to copy sessions in batch", "component", "seed", "batch_start", batchStart, "err", err)
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
			slog.Error("failed to copy messages in batch", "component", "seed", "batch_start", batchStart, "err", err)
			os.Exit(1)
		}

		err = tx.Commit(ctx)
		if err != nil {
			slog.Error("failed to commit transaction in batch", "component", "seed", "batch_start", batchStart, "err", err)
			os.Exit(1)
		}

		slog.Info("committed batch", "component", "seed", "from", batchStart+1, "to", batchEnd)
	}

	slog.Info("database seeded", "component", "seed", "sessions", totalSessions, "messages", totalSessions*turnsPerSession*2, "elapsed", time.Since(startTime))
}
