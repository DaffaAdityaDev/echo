package middleware

import (
	"echo-backend/internal/constants/app"
	"echo-backend/internal/handler/handlerutil"
	"log"
	"time"

	"github.com/gofiber/fiber/v3"
)

func Logger() fiber.Handler {
	return func(c fiber.Ctx) error {
		start := time.Now()
		err := c.Next()
		stop := time.Now()

		log.Printf("[%s] %d - %s %s %s",
			stop.Format(app.TimeFormat),
			c.Response().StatusCode(),
			c.Method(),
			c.Path(),
			stop.Sub(start),
		)

		return err
	}
}

func ErrorHandler(c fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
	}

	return handlerutil.RespondError(c, code, err.Error())
}
