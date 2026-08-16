package logger

import (
	"context"
	"io"
	"log/slog"
	"os"
	"strings"
)

var (
	currentEnvironment string
	loki               *lokiWriter
)

// Init configures the process-wide slog default: human-readable text on the
// console in development, JSON lines in production. This is the only channel
// until EnableLoki is called, so local development stays console-only.
func Init(environment string) {
	currentEnvironment = environment
	slog.SetDefault(slog.New(consoleHandler(environment)))
}

// EnableLoki appends an asynchronous Loki sink to the default logger and
// exposes it through LokiWriter. The sink drops records when Loki is
// unreachable, so the application never blocks or retries on it. Calling it
// twice is a no-op.
func EnableLoki(lokiURL string) {
	if lokiURL == "" || loki != nil {
		return
	}
	loki = newLokiWriter(lokiURL)
	jsonSink := slog.NewJSONHandler(loki, &slog.HandlerOptions{Level: slog.LevelInfo})
	slog.SetDefault(slog.New(compositeHandler{handlers: []slog.Handler{consoleHandler(currentEnvironment), jsonSink}}))
}

// LokiWriter returns the shared Loki sink writer, or nil when Loki logging
// is not enabled. Components that emit outside slog (e.g. the access-log
// middleware) tee into it.
func LokiWriter() io.Writer {
	if loki == nil {
		return nil
	}
	return loki
}

func consoleHandler(environment string) slog.Handler {
	if strings.EqualFold(environment, "production") {
		return slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelInfo})
	}
	return slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelDebug})
}

// compositeHandler fans a record out to every wrapped handler, each of which
// keeps its own level filtering. Stands in for slog.NewMultiHandler.
type compositeHandler struct {
	handlers []slog.Handler
}

func (h compositeHandler) Enabled(_ context.Context, level slog.Level) bool {
	for _, handler := range h.handlers {
		if handler.Enabled(context.Background(), level) {
			return true
		}
	}
	return false
}

func (h compositeHandler) Handle(ctx context.Context, record slog.Record) error {
	for _, handler := range h.handlers {
		if handler.Enabled(ctx, record.Level) {
			if err := handler.Handle(ctx, record); err != nil {
				return err
			}
		}
	}
	return nil
}

func (h compositeHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	handlers := make([]slog.Handler, len(h.handlers))
	for i, handler := range h.handlers {
		handlers[i] = handler.WithAttrs(attrs)
	}
	return compositeHandler{handlers: handlers}
}

func (h compositeHandler) WithGroup(name string) slog.Handler {
	handlers := make([]slog.Handler, len(h.handlers))
	for i, handler := range h.handlers {
		handlers[i] = handler.WithGroup(name)
	}
	return compositeHandler{handlers: handlers}
}
