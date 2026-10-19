package crypto

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEncryptDecrypt_RoundTrip(t *testing.T) {
	key := []byte("this-is-32-byte-encryption-key!!")
	tests := []struct {
		name  string
		input string
	}{
		{"simple text", "hello world"},
		{"with special chars", "a+b=c&d=e!@#$%^&*()"},
		{"unicode", "你好世界"},
		{"long text", string(make([]byte, 1000))},
		{"single char", "x"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			enc, err := Encrypt(tt.input, key)
			require.NoError(t, err)
			assert.NotEmpty(t, enc)

			dec, err := Decrypt(enc, key)
			require.NoError(t, err)
			assert.Equal(t, tt.input, dec)
		})
	}
}

func TestEncrypt_DifferentNonceEachTime(t *testing.T) {
	key := []byte("this-is-32-byte-encryption-key!!")
	input := "same text"

	c1, err := Encrypt(input, key)
	require.NoError(t, err)

	c2, err := Encrypt(input, key)
	require.NoError(t, err)

	assert.NotEqual(t, c1, c2)
}

func TestEncryptDecrypt_EmptyString(t *testing.T) {
	key := []byte("this-is-32-byte-encryption-key!!")

	enc, err := Encrypt("", key)
	require.NoError(t, err)
	assert.Empty(t, enc)

	dec, err := Decrypt("", key)
	require.NoError(t, err)
	assert.Empty(t, dec)
}

func TestEncryptDecrypt_InvalidKeyLength(t *testing.T) {
	shortKey := []byte("too-short")
	longKey := []byte("this-key-is-way-too-long-for-aes-256!")

	_, err := Encrypt("test", shortKey)
	assert.ErrorIs(t, err, errKeyLength)

	_, err = Encrypt("test", longKey)
	assert.ErrorIs(t, err, errKeyLength)

	_, err = Decrypt("test", shortKey)
	assert.ErrorIs(t, err, errKeyLength)

	_, err = Decrypt("test", longKey)
	assert.ErrorIs(t, err, errKeyLength)
}

func TestDecrypt_InvalidBase64(t *testing.T) {
	key := []byte("this-is-32-byte-encryption-key!!")

	_, err := Decrypt("not-base64!!!", key)
	assert.Error(t, err)
}

func TestDecrypt_CiphertextTooShort(t *testing.T) {
	key := []byte("this-is-32-byte-encryption-key!!")

	_, err := Decrypt("dG9v", key)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "ciphertext too short")
}

func TestMaskAPIKey(t *testing.T) {
	tests := []struct {
		name   string
		input  string
		expect string
	}{
		{"empty", "", ""},
		{"short key", "abc12345", "********"},
		{"exactly 8 chars", "12345678", "********"},
		{"typical sk key", "sk-ant-abc12345xyz67890secretkey", "sk-a...tkey"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expect, MaskAPIKey(tt.input))
		})
	}
}
