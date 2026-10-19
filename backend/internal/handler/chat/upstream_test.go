package chat

import (
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

func TestAgentMissionURLEscapesMode(t *testing.T) {
	got := agentMissionURL("http://agent:3000", "agent&debug=true")
	parsed, err := url.Parse(got)
	if err != nil {
		t.Fatalf("parse %q: %v", got, err)
	}
	query := parsed.Query()
	if mode := query.Get("mode"); mode != "agent&debug=true" {
		t.Errorf("mode = %q, want %q", mode, "agent&debug=true")
	}
	if query.Has("debug") {
		t.Errorf("injected query parameter leaked into %q", got)
	}
	if parsed.Path != "/api/v1/generate-mission" {
		t.Errorf("path = %q", parsed.Path)
	}
}

func TestUpstreamFailureStatus(t *testing.T) {
	cases := map[int]int{
		http.StatusBadRequest:          http.StatusBadRequest,
		http.StatusNotFound:            http.StatusNotFound,
		http.StatusConflict:            http.StatusConflict,
		http.StatusUnauthorized:        http.StatusBadGateway,
		http.StatusForbidden:           http.StatusBadGateway,
		http.StatusProxyAuthRequired:   http.StatusBadGateway,
		http.StatusInternalServerError: http.StatusBadGateway,
		http.StatusServiceUnavailable:  http.StatusBadGateway,
		http.StatusAccepted:            http.StatusBadGateway,
		http.StatusFound:               http.StatusBadGateway,
	}
	for agentStatus, want := range cases {
		if got := upstreamFailureStatus(agentStatus); got != want {
			t.Errorf("upstreamFailureStatus(%d) = %d, want %d", agentStatus, got, want)
		}
	}
}

type closeTrackingBody struct {
	io.Reader
	closed bool
}

func (b *closeTrackingBody) Close() error {
	b.closed = true
	return nil
}

func TestReadUpstreamErrorLimitsAndCloses(t *testing.T) {
	body := &closeTrackingBody{Reader: strings.NewReader(strings.Repeat("x", upstreamErrorBodyLimit+100))}
	detail, err := readUpstreamError(&http.Response{Body: body})
	if err != nil {
		t.Fatalf("readUpstreamError: %v", err)
	}
	if len(detail) != upstreamErrorBodyLimit {
		t.Errorf("detail length = %d, want %d", len(detail), upstreamErrorBodyLimit)
	}
	if !body.closed {
		t.Error("body was not closed")
	}
}
