package handler

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"strconv"

	"github.com/gofiber/fiber/v3"
)

func getUserID(c fiber.Ctx) (int, error) {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return 0, errors.New("user_id not found")
	}
	return strconv.Atoi(userIDStr)
}

func nonilSlice[T any](s []T) []T {
	if s == nil {
		return []T{}
	}
	return s
}

var httpClient = &http.Client{}

func generateUUID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}
