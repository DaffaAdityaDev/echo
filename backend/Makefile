.PHONY: swagger-gen swagger-split swagger test test-short test-coverage test-html

swagger-gen:
	go run github.com/swaggo/swag/cmd/swag@latest init -g cmd/server/main.go -o api/docs --parseDependency --parseInternal

swagger-split:
	go run ./api/split/main.go

swagger: swagger-gen swagger-split

test:
	go test -v -short -parallel 8 -count=1 ./...

test-short:
	go test -v -short -parallel 8 -count=1 ./internal/service/... ./internal/middleware/... ./pkg/crypto/... ./internal/handler/...

test-coverage:
	go test -coverprofile=coverage.out -parallel 8 -count=1 ./...
	go tool cover -func=coverage.out

test-html: test-coverage
	go tool cover -html=coverage.out
