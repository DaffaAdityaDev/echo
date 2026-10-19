# Katara Infrastructure: GarageHQ Storage

> Object storage configuration for uploaded document materials.

---

## 1. Bucket Specifications

- **Bucket Name**: `inquizitive-docs`
- **Object Key Structure**:
  ```text
  users/{user_id}/sources/{source_id}/{filename}
  ```
- **Access Policy**: Private. Read/Write signed operations via AWS SDK v2 for Go within `app/KataraGnosis/backend/internal/pkg/garage/`.
