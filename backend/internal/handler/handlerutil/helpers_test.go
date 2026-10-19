package handlerutil

import "testing"

func TestIsValidUUID(t *testing.T) {
	t.Parallel()

	cases := map[string]bool{
		"3b2f1d6a-7c4e-4a8b-9f10-2e5d7c9a1b34": true,
		"3B2F1D6A-7C4E-4A8B-9F10-2E5D7C9A1B34": true,
		"":                                     false,
		"sess_shared":                          false,
		"urn:uuid:3b2f1d6a-7c4e-4a8b-9f10-2e5d7c9a1b34": false,
		"{3b2f1d6a-7c4e-4a8b-9f10-2e5d7c9a1b34}":        false,
		"3b2f1d6a7c4e4a8b9f102e5d7c9a1b34":              false,
	}
	for input, want := range cases {
		if got := IsValidUUID(input); got != want {
			t.Errorf("IsValidUUID(%q) = %v, want %v", input, got, want)
		}
	}
}
