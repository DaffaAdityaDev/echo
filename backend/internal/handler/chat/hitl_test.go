package chat

import (
	"bufio"
	"bytes"
	"errors"
	"strings"
	"testing"
)

func TestRelaySSEForwardsAllLines(t *testing.T) {
	stream := "data: {\"type\":\"content\"}\n\ndata: {\"type\":\"turn_complete\"}\n"
	var out bytes.Buffer
	w := bufio.NewWriter(&out)

	if err := relaySSE(w, strings.NewReader(stream)); err != nil {
		t.Fatalf("relaySSE: %v", err)
	}
	if out.String() != stream {
		t.Errorf("relayed %q, want %q", out.String(), stream)
	}
}

type failingReader struct{}

func (failingReader) Read([]byte) (int, error) {
	return 0, errors.New("connection reset")
}

func TestRelaySSEReportsUpstreamReadError(t *testing.T) {
	var out bytes.Buffer
	if err := relaySSE(bufio.NewWriter(&out), failingReader{}); err == nil {
		t.Fatal("expected read error")
	}
}
