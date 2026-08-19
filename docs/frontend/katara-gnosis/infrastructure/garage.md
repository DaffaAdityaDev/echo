================================================================================
  KataraGnosis GarageHQ Blob Storage
================================================================================
  Module    : GarageHQ
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

GarageHQ is the S3-compatible object store for all uploaded sources (PDF,
markdown, text; future: audio). The backend talks to it with the minio-go
v7 client — Garage is protocol-compatible, so swapping to Cloudflare R2 /
AWS S3 later is a config change only (ADR-02).

Configuration (env)
-------------------

+---------------------+------------------------------------------------------+
| Var                 | Default (dev)                                        |
+---------------------+------------------------------------------------------+
| GARAGE_ENDPOINT     | http://localhost:3900                                |
| GARAGE_ACCESS_KEY   | key imported via make katara-garage-init             |
| GARAGE_SECRET_KEY   | (never committed)                                    |
| GARAGE_BUCKET       | inquizitive-docs                                     |
+---------------------+------------------------------------------------------+

Initialization (make katara-garage-init)
----------------------------------------

  Target added to root Makefile (or backend/Makefile; root preferred):

    katara-garage-init:
      docker compose exec echo-garage garage bucket create inquizitive-docs \
        || true
      docker compose exec echo-garage garage key import katara-dev \
        <dev-access-key> <dev-secret-key> || true
      docker compose exec echo-garage garage bucket allow --read \
        --write katara-dev inquizitive-docs
      @echo "Copy dev keys into .env (GARAGE_ACCESS_KEY / GARAGE_SECRET_KEY)"

  - Dev keys: fixed known values committed only as DEV defaults in
    .env.example with a loud comment. Production: generate real keys via
    `garage key create` and inject via CI/secrets — never commit.
  - The target is idempotent (|| true on create/import).

Object Naming
-------------

  object_key = "<user_id>/<source_id>.<ext>"
  example:    "42/0f3c2a1b-...-9d1f.pdf"

  - Namespacing by user id guarantees isolation without per-user buckets.
  - ext derived from source_type: pdf|md|txt.

Go Client (internal/pkg/garage)
-------------------------------

  - minio-go v7 client constructed once (New with credentials + endpoint;
    UseSSL=false in dev).
  - API surface (thin wrapper, interface for testability):

      type BlobStore interface {
          PutObject(ctx, key string, r io.Reader, size int64,
                    contentType string) error
          GetObject(ctx, key string) (io.ReadCloser, error)
          DeleteObject(ctx, key string) error
          PresignedGetURL(ctx, key string, ttl time.Duration) (string, error)
          EnsureBucket(ctx) error
      }

  - EnsureBucket called at startup (fail-hard if bucket cannot be
    verified).
  - All operations carry context timeout (Put/Get 2 min; Delete 30s).

Presigned URLs
--------------

  - GET /katara/sources/:id/download returns a presigned URL (5 min TTL,
    GET only). Never long-lived public URLs.
  - Used by the frontend "Unduh" action; the reader itself streams via
    the BFF (proxy GET) to keep analytics + auth single-source.

Delete Semantics
----------------

  - Source deletion: PG transaction commits first, then Garage delete
    (best-effort, logged). A nightly reconciliation task in the Asynq
    server (jobs) removes Garage objects without a sources row
    (orphan sweep).

Security Notes
--------------

  - Credentials live only in server env; never exposed to the browser
    (BFF proxies handle download; presigned URLs are server-generated).
  - Bucket access is restricted to the katara-dev key (least privilege:
    read/write on inquizitive-docs only).

Future Migration (R2/S3)
------------------------

  Swap GARAGE_ENDPOINT + credentials to the new provider; ensure bucket
  name matches; run a bulk copy tool (rclone) — zero application change.

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
