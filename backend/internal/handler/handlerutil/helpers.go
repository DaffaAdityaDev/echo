package handlerutil

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"strconv"

	"github.com/gofiber/fiber/v3"
)

var HttpClient = &http.Client{}

func GetUserID(c fiber.Ctx) (int, error) {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return 0, errors.New("user_id not found")
	}
	return strconv.Atoi(userIDStr)
}

func GenerateUUID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func RespondSuccess(c fiber.Ctx, data any) error {
	return c.JSON(data)
}

func RespondCreated(c fiber.Ctx, data any) error {
	return c.Status(fiber.StatusCreated).JSON(data)
}

func RespondMessage(c fiber.Ctx, msg string) error {
	return c.JSON(fiber.Map{
		"status":  "success",
		"message": msg,
	})
}

func RespondError(c fiber.Ctx, status int, msg string) error {
	return RespondErrorDetail(c, status, msg, "")
}

func RespondErrorDetail(c fiber.Ctx, status int, msg string, details string) error {
	return c.Status(status).JSON(fiber.Map{
		"error":   msg,
		"details": details,
	})
}

// HealthCheck godoc
// @Summary Health check
// @Description Returns the health status of the backend API
// @Tags Health
// @Produce json
// @Success 200 {object} map[string]string
// @Router /health [get]
func HealthCheck() {}

