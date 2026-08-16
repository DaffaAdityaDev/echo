package logger

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	httpxconst "echo-backend/internal/constants/httpx"
)

const (
	flushInterval  = 5 * time.Second
	maxBatchBytes  = 1 << 20
	lineBufferSize = 2048
	pushTimeout    = 5 * time.Second
)

type lokiEntry struct {
	tsNanos int64
	msg     string
}

// lokiWriter batches JSON lines and pushes them to Loki. It is fire-and-
// forget by design: when the batch channel is full or a push fails, records
// are dropped silently so the application never blocks on the shipper.
type lokiWriter struct {
	url    string
	lines  chan string
	client *http.Client
}

func newLokiWriter(url string) *lokiWriter {
	w := &lokiWriter{
		url:    strings.TrimSuffix(url, "/"),
		lines:  make(chan string, lineBufferSize),
		client: &http.Client{Timeout: pushTimeout},
	}
	go w.run()
	return w
}

// Write enqueues one log line. It always reports success so callers (slog
// handlers, the access-log middleware) never treat the shipper as a failure.
func (w *lokiWriter) Write(p []byte) (int, error) {
	line := strings.TrimSuffix(string(p), "\n")
	select {
	case w.lines <- line:
	default:
	}
	return len(p), nil
}

func (w *lokiWriter) run() {
	ticker := time.NewTicker(flushInterval)
	defer ticker.Stop()
	var batch []lokiEntry
	batchBytes := 0
	flush := func() {
		if len(batch) > 0 {
			w.push(batch)
			batch = batch[:0]
			batchBytes = 0
		}
	}
	for {
		select {
		case <-ticker.C:
			flush()
		case line, ok := <-w.lines:
			if !ok {
				flush()
				return
			}
			batch = append(batch, lokiEntry{tsNanos: time.Now().UnixNano(), msg: line})
			batchBytes += len(line)
			if batchBytes >= maxBatchBytes {
				flush()
			}
		}
	}
}

type lokiPayload struct {
	Streams []lokiStream `json:"streams"`
}

type lokiStream struct {
	Stream map[string]string `json:"stream"`
	Values [][]string        `json:"values"`
}

func (w *lokiWriter) push(entries []lokiEntry) {
	values := make([][]string, 0, len(entries))
	for _, e := range entries {
		values = append(values, []string{strconv.FormatInt(e.tsNanos, 10), e.msg})
	}
	payload := lokiPayload{
		Streams: []lokiStream{{
			Stream: map[string]string{"service": "echo-backend", "stream": "stdout"},
			Values: values,
		}},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return
	}
	req, err := http.NewRequest(http.MethodPost, w.url+"/loki/api/v1/push", bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set(httpxconst.HeaderContentType, httpxconst.ContentTypeJSON)
	resp, err := w.client.Do(req)
	if err != nil {
		return
	}
	io.Copy(io.Discard, resp.Body)
	resp.Body.Close()
}
