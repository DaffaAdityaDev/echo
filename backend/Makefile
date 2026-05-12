.PHONY: run build test clean help

# Default target
help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  run       Run the application"
	@echo "  build     Build the binary"
	@echo "  test      Run tests"
	@echo "  clean     Remove binary files"

# Run the application
run:
	go run cmd/server/main.go

# Build the binary
build:
	go build -o bin/server cmd/server/main.go

# Run tests
test:
	go test -v -race ./...

# Clean build artifacts
clean:
	rm -rf bin/
