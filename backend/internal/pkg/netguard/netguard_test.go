package netguard

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

type fakeResolver struct {
	addrs []net.IPAddr
	err   error
}

func (f fakeResolver) LookupIPAddr(context.Context, string) ([]net.IPAddr, error) {
	return f.addrs, f.err
}

func resolvesTo(ips ...string) fakeResolver {
	addrs := make([]net.IPAddr, 0, len(ips))
	for _, ip := range ips {
		addrs = append(addrs, net.IPAddr{IP: net.ParseIP(ip)})
	}
	return fakeResolver{addrs: addrs}
}

func TestIsForbiddenIP(t *testing.T) {
	t.Parallel()

	forbidden := []string{"127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fd00:ec2::254", "fe80::1", "::ffff:127.0.0.1"}
	for _, ip := range forbidden {
		if !IsForbiddenIP(net.ParseIP(ip)) {
			t.Errorf("expected %s to be forbidden", ip)
		}
	}
	allowed := []string{"8.8.8.8", "104.18.0.1", "2606:4700::1111"}
	for _, ip := range allowed {
		if IsForbiddenIP(net.ParseIP(ip)) {
			t.Errorf("expected %s to be allowed", ip)
		}
	}
}

func TestValidateURL(t *testing.T) {
	t.Parallel()

	public := resolvesTo("104.18.0.1")
	tests := []struct {
		name         string
		raw          string
		allowPrivate bool
		resolver     Resolver
		want         error
	}{
		{name: "public https host", raw: "https://api.openai.com/v1", resolver: public},
		{name: "non http scheme", raw: "file:///etc/passwd", resolver: public, want: ErrInvalidURL},
		{name: "gopher scheme", raw: "gopher://example.com", resolver: public, want: ErrInvalidURL},
		{name: "relative url", raw: "/v1/models", resolver: public, want: ErrInvalidURL},
		{name: "credentials in url", raw: "https://user:pass@example.com", resolver: public, want: ErrInvalidURL},
		{name: "metadata ip literal", raw: "http://169.254.169.254/latest", resolver: public, want: ErrForbiddenAddress},
		{name: "hostname resolving to loopback", raw: "http://evil.example/v1", resolver: resolvesTo("104.18.0.1", "127.0.0.1"), want: ErrForbiddenAddress},
		{name: "unresolvable host", raw: "https://nope.invalid", resolver: fakeResolver{err: errors.New("no such host")}, want: ErrUnresolvableHost},
		{name: "private allowed when flag set", raw: "http://localhost:1234/v1", allowPrivate: true, resolver: resolvesTo("127.0.0.1")},
		{name: "scheme still checked when private allowed", raw: "ftp://localhost", allowPrivate: true, resolver: public, want: ErrInvalidURL},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			err := ValidateURL(context.Background(), tt.raw, tt.allowPrivate, tt.resolver)
			if !errors.Is(err, tt.want) {
				t.Fatalf("ValidateURL(%q) = %v, want %v", tt.raw, err, tt.want)
			}
		})
	}
}

func TestClient_BlocksLoopbackUnlessAllowed(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(server.Close)

	if _, err := Client(false, time.Second).Get(server.URL); !errors.Is(err, ErrForbiddenAddress) {
		t.Fatalf("expected strict client to refuse loopback, got %v", err)
	}

	resp, err := Client(true, time.Second).Get(server.URL)
	if err != nil {
		t.Fatalf("expected permissive client to reach loopback, got %v", err)
	}
	_ = resp.Body.Close()
}
