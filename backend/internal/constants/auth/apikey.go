package auth

// APIKeyPrefix is prepended to the random secret returned to admin users when
// creating an API key. Clients present the full "sk_<hex>" string; only its
// SHA-256 hash is stored in the database.
const APIKeyPrefix = "sk_"
