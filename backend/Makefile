.PHONY: swagger-gen swagger-split swagger

swagger-gen:
	go run github.com/swaggo/swag/cmd/swag@latest init -g cmd/server/main.go -o api/docs --parseDependency --parseInternal

swagger-split:
	go run ./api/split/main.go

swagger: swagger-gen swagger-split
