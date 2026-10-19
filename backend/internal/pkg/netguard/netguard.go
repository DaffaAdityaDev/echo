// Package netguard blocks server-side requests to user-supplied URLs from
// reaching loopback, private, link-local or cloud metadata addresses.
package netguard

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"sync"
	"syscall"
	"time"
)

var (
	ErrInvalidURL       = errors.New("URL must be an absolute http or https URL without credentials")
	ErrUnresolvableHost = errors.New("URL host could not be resolved")
	ErrForbiddenAddress = errors.New("URL resolves to a private, loopback or link-local address")
)

const dialTimeout = 10 * time.Second

var carrierGradeNAT = &net.IPNet{IP: net.IPv4(100, 64, 0, 0), Mask: net.CIDRMask(10, 32)}

// Resolver looks up the IP addresses of a host.
type Resolver interface {
	LookupIPAddr(ctx context.Context, host string) ([]net.IPAddr, error)
}

// IsForbiddenIP reports whether ip is not a publicly routable unicast address.
func IsForbiddenIP(ip net.IP) bool {
	return ip.IsLoopback() ||
		ip.IsPrivate() ||
		ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() ||
		ip.IsInterfaceLocalMulticast() ||
		ip.IsMulticast() ||
		ip.IsUnspecified() ||
		carrierGradeNAT.Contains(ip)
}

// ValidateURL checks that raw is an http(s) URL and, unless allowPrivate is
// set, that every address its host resolves to is publicly routable.
func ValidateURL(ctx context.Context, raw string, allowPrivate bool, resolver Resolver) error {
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" || u.User != nil {
		return ErrInvalidURL
	}
	if allowPrivate {
		return nil
	}
	return checkHost(ctx, u.Hostname(), resolver)
}

func checkHost(ctx context.Context, host string, resolver Resolver) error {
	if ip := net.ParseIP(host); ip != nil {
		if IsForbiddenIP(ip) {
			return ErrForbiddenAddress
		}
		return nil
	}
	addrs, err := resolver.LookupIPAddr(ctx, host)
	if err != nil || len(addrs) == 0 {
		return ErrUnresolvableHost
	}
	for _, addr := range addrs {
		if IsForbiddenIP(addr.IP) {
			return ErrForbiddenAddress
		}
	}
	return nil
}

// rejectForbiddenDial runs after DNS resolution on every connection attempt,
// so redirects and DNS rebinding cannot reach a forbidden address.
func rejectForbiddenDial(_, address string, _ syscall.RawConn) error {
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		return fmt.Errorf("netguard: parse dial address: %w", err)
	}
	ip := net.ParseIP(host)
	if ip == nil || IsForbiddenIP(ip) {
		return ErrForbiddenAddress
	}
	return nil
}

func newTransport(allowPrivate bool) *http.Transport {
	dialer := &net.Dialer{Timeout: dialTimeout}
	if !allowPrivate {
		dialer.Control = rejectForbiddenDial
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = nil
	transport.DialContext = dialer.DialContext
	return transport
}

var (
	transportsOnce      sync.Once
	strictTransport     *http.Transport
	permissiveTransport *http.Transport
)

// Transport returns a shared transport for outbound requests to user-supplied
// URLs. When allowPrivate is false it refuses to connect to forbidden addresses.
func Transport(allowPrivate bool) http.RoundTripper {
	transportsOnce.Do(func() {
		strictTransport = newTransport(false)
		permissiveTransport = newTransport(true)
	})
	if allowPrivate {
		return permissiveTransport
	}
	return strictTransport
}

// Client returns an http.Client with the given timeout backed by Transport.
func Client(allowPrivate bool, timeout time.Duration) *http.Client {
	return &http.Client{Timeout: timeout, Transport: Transport(allowPrivate)}
}
