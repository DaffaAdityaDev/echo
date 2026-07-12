================================================================================
  Repository Pattern - Data Access Layer
================================================================================
  Module    : Repository Pattern
  Service   : backend
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

Overview
--------

The Repository pattern abstracts data access from the database (PostgreSQL via
pgx). Each repository is responsible for one entity and hides SQL query details
behind an interface. UserRepository is fully implemented with Create,
GetByEmail, and GetUserByID methods.

File Structure
--------------

+------------------------------------------+--------------------------------------------+
| Path                                     | Description                                |
+------------------------------------------+--------------------------------------------+
| internal/repository/user_repository.go   | UserRepository interface + struct          |
| internal/database/db.go                  | Infrastructure (Redis client)              |
| internal/database/postgres.go            | pgx pool connection factory                |
| internal/constants/db/postgres.go        | SQL queries & error messages               |
+------------------------------------------+--------------------------------------------+

Interface Pattern
------------------

  type UserRepository interface {
      Create(ctx context.Context, user *models.User) error
      GetByEmail(ctx context.Context, email string) (*models.User, error)
      GetUserByID(ctx context.Context, id int) (*models.User, error)
  }

  type userRepository struct {
      infra *database.Infrastructure
  }

  func NewUserRepository(infra *database.Infrastructure) UserRepository {
      return &userRepository{infra: infra}
  }

Data Flow (implemented)
------------------------

  Handler -> Service -> Repository -> Database (pgx pool)
                          │
                          ├─ UserRepository.Create(ctx, user)
                          │     └─ INSERT INTO users (email, password_hash, name, role)
                          │        VALUES ($1, $2, $3, $4) RETURNING id, created_at, updated_at
                          │
                          ├─ UserRepository.GetByEmail(ctx, email)
                          │     └─ SELECT id, email, password_hash, name, role,
                          │        created_at, updated_at FROM users WHERE email = $1
                          │
                          └─ UserRepository.GetUserByID(ctx, id)
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

  Infrastructure exposes infra.DB.Pool (*pgxpool.Pool). If transactional
  queries are needed, the pattern would follow:

  // Example (not used — repositories currently use single queries):
  func (r *userRepository) CreateWithTx(ctx context.Context, user *models.User) error {
      tx, err := r.infra.DB.Pool.Begin(ctx)
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
| UserRepository        | Interface    | repository/user_repository.go:13   |
| NewUserRepository     | Constructor  | repository/user_repository.go:23   |
| (infra)               |              |                                    |
| Infrastructure        | Struct       | database/db.go:11                  |
| NewInfrastructure(cfg)| Constructor  | database/db.go:16                  |
| Connect(connString)   | Function     | database/postgres.go:14            |
+-----------------------+--------------+------------------------------------+

Dependencies
------------

+-----------------------------------+-------------------------------------------+
| Dependency                        | Used For                                  |
+-----------------------------------+-------------------------------------------+
| github.com/jackc/pgx/v5           | PostgreSQL driver                         |
| github.com/jackc/pgx/v5/pgxpool  | Connection pool                           |
| database.Infrastructure          | Shared DB/Redis access                    |
+-----------------------------------+-------------------------------------------+

Source References
-----------------

- internal/repository/user_repository.go - Repository interface + struct
- internal/database/postgres.go - pgx pool connection
- internal/database/db.go - Infrastructure struct
- internal/constants/db/postgres.go - SQL queries & error constants

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
