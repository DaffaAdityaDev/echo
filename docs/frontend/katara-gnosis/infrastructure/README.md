================================================================================
  KataraGnosis Infrastructure Documentation Index
================================================================================
  Module    : Infrastructure
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
================================================================================

KataraGnosis runs on the Echo monorepo's local stack (docker-compose.yml)
plus two new services: Qdrant (vector engine, replacing the unused Chroma)
and GarageHQ (S3-compatible blob storage).

Documentation Index
-------------------

+--------------------------------------+----------------------------------------+
| Module                               | Description                            |
+--------------------------------------+----------------------------------------+
| docker-compose.md                    | Service definitions, ports, volumes,   |
|                                      | healthchecks.                          |
| garage.md                            | GarageHQ setup: config, bucket, keys,  |
|                                      | make target, object naming.            |
| qdrant.md                            | Collections, payload schema, filters,  |
|                                      | fail-hard behavior.                    |
| env-contract.md                      | Full environment variable contract.    |
+--------------------------------------+----------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
