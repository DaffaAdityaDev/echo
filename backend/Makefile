.PHONY: swagger-gen

swagger-gen:
	go run github.com/swaggo/swag/cmd/swag@latest init -g cmd/server/main.go -o api/docs --parseDependency --parseInternal
