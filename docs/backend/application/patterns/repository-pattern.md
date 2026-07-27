================================================================================
  Repository Pattern - Data Access Layer
================================================================================
  Module    : Repository Pattern
  Service   : backend
  Version   : 1.1
  Updated   : 2026-07-27
================================================================================

Overview
--------

The Repository pattern abstracts data access from the database (PostgreSQL via
pgx). Each repository is responsible for one entity and hides SQL query details
behind an interface. Each domain gets its own sub-package under repository/:

  repository/auth/        UserRepository renamed Repository - user CRUD
  repository/session/     SessionRepository renamed Repository - session CRUD
  repository/settings/    SettingsRepository renamed Repository - preferences
  repository/admin/        ApiKeyRepository renamed Repository - API key mgmt
  repository/llmops/      Prompt/module repositories (sub-packages)

File Structure
--------------

+------------------------------------------------+--------------------------------------------+
| Path                                           | Description                                |
+------------------------------------------------+--------------------------------------------+
| internal/repository/auth/repository.go          | Repository - user CRUD                     |
| internal/repository/session/repository.go       | Repository - session CRUD + messages       |
| internal/repository/settings/repository.go      | Repository - user preferences              |
| internal/repository/admin/repository.go         | Repository - API key management            |
| internal/database/db.go                         | Infrastructure (Redis client)              |
| internal/database/postgres.go                   | pgx pool connection factory                |
| internal/constants/db/postgres.go               | SQL queries & error messages               |
+------------------------------------------------+--------------------------------------------+

Interface Pattern
-----------------

  type Repository interface {
      Create(ctx context.Context, user *models.User) error
      GetByEmail(ctx context.Context, email string) (*models.User, error)
      GetUserByID(ctx context.Context, id int) (*models.User, error)
  }

  type repository struct {
      pool *pgxpool.Pool
  }

  func NewRepository(pool *pgxpool.Pool) Repository {
      return &repository{pool: pool}
  }

Data Flow (implemented)
------------------------

  Handler -> Service -> Repository -> Database (pgx pool)
                          │
                          ├─ auth.Repository.Create(ctx, user)
                          │     └─ INSERT INTO users (email, password_hash, name, role)
                          │        VALUES ($1, $2, $3, $4) RETURNING id, created_at, updated_at
                          │
                          ├─ auth.Repository.GetByEmail(ctx, email)
                          │     └─ SELECT id, email, password_hash, name, role,
                          │        created_at, updated_at FROM users WHERE email = $1
                          │
                          └─ auth.Repository.GetUserByID(ctx, id)
                                └─ SELECT id, email, password_hash, name, role,
                                   created_at, updated_at FROM users WHERE id = $1

SQL Query Constants
--------------------

+------------------+--------------------------------------------------------------------------------------------------+------------------------------------+
| Constant         | SQL                                                                                              | File                               |
+------------------+--------------------------------------------------------------------------------------------------+------------------------------------+
| QueryCreateUser  | INSERT INTO users (email, password_hash, name, role, ...) VALUES ($1, $2, $3, $4, ...)           | constants/db/postgres.go:11        |
|                  | RETURNING id, created_at, updated_at                                                             |                                    |
| QueryGetUserBy   | SELECT id, email, password_hash, name, role, created_at, updated_at FROM users WHERE email = $1  | constants/db/postgres.go:16        |
| Email            |                                                                                                  |                                    |
+------------------+--------------------------------------------------------------------------------------------------+------------------------------------+

Transaction Handling (example — NOT actual code)
-------------------------------------------------

  Repository receives a *pgxpool.Pool directly. If transactional
  queries are needed, the pattern would follow:

  // Example (not used — repositories currently use single queries):
  func (r *repository) CreateWithTx(ctx context.Context, user *models.User) error {
      tx, err := r.pool.Begin(ctx)
      if err != nil {
          return fmt.Errorf("begin tx: %w", err)
      }
      defer tx.Rollback(ctx)
      // ...
  }

Entry Points & Exports
----------------------

+-----------------------+--------------+------------------------------------+
| Symbol                | Kind         | Path                               |
+-----------------------+--------------+------------------------------------+
| Repository            | Interface    | repository/auth/repository.go      |
| NewRepository(pool)   | Constructor  | repository/auth/repository.go      |
| Repository            | Interface    | repository/session/repository.go   |
| NewRepository(pool)   | Constructor  | repository/session/repository.go   |
| Repository            | Interface    | repository/settings/repository.go  |
| NewRepository(pool)   | Constructor  | repository/settings/repository.go  |
| Repository            | Interface    | repository/admin/repository.go     |
| NewRepository(pool)   | Constructor  | repository/admin/repository.go     |
+-----------------------+--------------+------------------------------------+

Dependencies
------------

+-----------------------------------+-------------------------------------------+
| Dependency                        | Used For                                  |
+-----------------------------------+-------------------------------------------+
| github.com/jackc/pgx/v5           | PostgreSQL driver                         |
| github.com/jackc/pgx/v5/pgxpool  | Connection pool                           |
| internal/constants/db/postgres.go | SQL query constants                       |
+-----------------------------------+-------------------------------------------+

Source References
-----------------

- internal/repository/auth/repository.go - Repository interface + struct
- internal/repository/session/repository.go - Session data access
- internal/database/postgres.go - pgx pool connection
- internal/database/db.go - Infrastructure struct
- internal/constants/db/postgres.go - SQL queries & error constants

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
