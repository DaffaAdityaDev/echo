package logger

import (
	"bytes"
	"encoding/json"
	"net/http"
	"testing"
)

func TestParseLabels(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want map[string]string
	}{
		{name: "empty", raw: "", want: map[string]string{}},
		{name: "single", raw: "tenant=acme", want: map[string]string{"tenant": "acme"}},
		{name: "multiple", raw: "tenant=acme,project=echo", want: map[string]string{"tenant": "acme", "project": "echo"}},
		{name: "trims spaces", raw: " tenant = acme , project=echo ", want: map[string]string{"tenant": "acme", "project": "echo"}},
		{name: "drops malformed", raw: "noequals,=onlyvalue,ok=yes", want: map[string]string{"ok": "yes"}},
		{name: "last wins", raw: "tenant=a,tenant=b", want: map[string]string{"tenant": "b"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseLabels(tt.raw)
			if len(got) != len(tt.want) {
				t.Fatalf("parseLabels(%q) = %v, want %v", tt.raw, got, tt.want)
			}
			for k, v := range tt.want {
				if got[k] != v {
					t.Fatalf("parseLabels(%q)[%q] = %q, want %q", tt.raw, k, got[k], v)
				}
			}
		})
	}
}

func TestBuildPushRequest(t *testing.T) {
	payload := lokiPayload{
		Streams: []lokiStream{{
			Stream: map[string]string{"service": "echo-backend", "stream": "stdout", "tenant": "acme"},
			Values: [][]string{{"1", `{"msg":"hello"}`}},
		}},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	req, err := http.NewRequest(http.MethodPost, "http://loki:3100/loki/api/v1/push", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}

	writer := &lokiWriter{user: "user", password: "pass", tenantID: "tenant-1"}
	writer.applyPushAuth(req)

	if u, p, ok := req.BasicAuth(); !ok || u != "user" || p != "pass" {
		t.Fatalf("basic auth = %q/%q (ok=%v), want user/pass", u, p, ok)
	}
	if got := req.Header.Get("X-Scope-OrgID"); got != "tenant-1" {
		t.Fatalf("X-Scope-OrgID = %q, want %q", got, "tenant-1")
	}
}

func TestBuildPushRequestNoAuth(t *testing.T) {
	req, err := http.NewRequest(http.MethodPost, "http://loki:3100/loki/api/v1/push", nil)
	if err != nil {
		t.Fatal(err)
	}

	writer := &lokiWriter{}
	writer.applyPushAuth(req)

	if _, _, ok := req.BasicAuth(); ok {
		t.Fatal("expected no basic auth when credentials are empty")
	}
	if got := req.Header.Get("X-Scope-OrgID"); got != "" {
		t.Fatalf("X-Scope-OrgID = %q, want empty", got)
	}
}

func TestStreamLabelsMerge(t *testing.T) {
	writer := &lokiWriter{labels: map[string]string{"tenant": "acme", "service": "override"}}
	stream := writer.streamLabels()

	if stream["service"] != "override" {
		t.Fatalf("extra labels must override base, got service=%q", stream["service"])
	}
	if stream["tenant"] != "acme" {
		t.Fatalf("extra label tenant = %q, want acme", stream["tenant"])
	}
	if stream["stream"] != "stdout" {
		t.Fatalf("base label stream = %q, want stdout", stream["stream"])
	}
}
