================================================================================
  Auth - Authentication & Authorization
================================================================================
  Module    : Authentication & Authorization
  Service   : backend
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

Overview
--------

The Auth feature handles user registration, login, profile retrieval, and
session logout via JWT. Register and Login are fully implemented with bcrypt
password hashing, PostgreSQL persistence, JWT signing, and HttpOnly cookie
setting. The JWT middleware validates tokens from cookies or the Authorization
header on protected endpoints.

File Structure
--------------

+------------------------------------------+--------------------------------------------+
| Path                                     | Description                                |
+------------------------------------------+--------------------------------------------+
| internal/handler/auth_handler.go         | HTTP handlers: Register, Login, Me, Logout |
| internal/service/auth_service.go         | AuthService interface & struct (impl.)     |
| internal/repository/user_repository.go   | UserRepository interface & struct (impl.)  |
| internal/middleware/auth.go              | AuthRequired middleware - JWT validation   |
| internal/constants/auth/jwt.go           | Auth constants: headers, cookie, errors    |
| frontend/web/src/features/auth/index.ts  | Barrel exports: LoginForm, AuthGuard, ...  |
| frontend/web/src/features/auth/          |                                            |
|   stores/authStore.ts                    | Zustand auth store (token, user, loading)  |
| frontend/web/src/features/auth/          |                                            |
|   hooks/useLoginPage.ts                  | Login page hook (form state, submit)       |
+------------------------------------------+--------------------------------------------+

Flow Diagram - Register
-----------------------

  ┌──────────┐         ┌──────────────────┐
  │  Client  │         │ Backend (Fiber)  │
  └────┬─────┘         └────────┬─────────┘
       │  POST /register        │
       │  {email,password,name} │
       │───────────────────────►│
       │                        │  1. bcrypt.GenerateFromPassword
       │                        │  2. userRepo.Create (INSERT INTO)
       │                        │  3. generateToken (JWT HS256)
       │                        │  4. setAuthCookie (HttpOnly)
       │                        │
       │  Set-Cookie: auth_token│
       │  {token:...,           │
       │   user:{id,email,...}} │
       │◄───────────────────────│

Flow Diagram - Login
--------------------

  ┌──────────┐         ┌──────────────────┐
  │  Client  │         │ Backend (Fiber)  │
  └────┬─────┘         └────────┬─────────┘
       │  POST /login           │
       │  {email,password}      │
       │───────────────────────►│
       │                        │  1. userRepo.GetByEmail (SELECT)
       │                        │  2. bcrypt.CompareHashAndPassword
       │                        │  3. generateToken (JWT HS256)
       │                        │  4. setAuthCookie (HttpOnly)
       │                        │
       │  Set-Cookie: auth_token│
       │  {token:...,           │
       │   user:{id,email,...}} │
       │◄───────────────────────│

Request / Response Flow - Login
-------------------------------

  Login Request (POST /api/v1/auth/login)
    │
    ├─ AuthHandler.HandleLogin (auth_handler.go:59)
    │   │
    │   ├─ Parse body → loginRequest{Email, Password}
    │   │
    │   └─ h.AuthSvc.Login(ctx, email, password)
    │       │
    │       ├─ authService.Login (auth_service.go:33)
    │       │   │
    │       │   ├─ (1) userRepo.GetByEmail(ctx, email)
    │       │   │       └─ SELECT ... FROM users WHERE email = $1
    │       │   │
    │       │   ├─ (2) bcrypt.CompareHashAndPassword(
    │       │   │         user.PasswordHash, password)
    │       │   │
    │       │   ├─ (3) generateToken(cfg, user.ID)
    │       │   │       └─ jwt.MapClaims{sub, exp, iat}
    │       │   │          jwt.NewWithClaims(HS256)
    │       │   │          token.SignedString(cfg.JWTSecret)
    │       │   │
    │       │   └─ (4) Return (user, token, nil)
    │       │
    │       └─ handler: setAuthCookie(c, env, token)
    │            ├─ Name:     auth_token
    │            ├─ Value:    token
    │            ├─ Expires:  +72h
    │            ├─ HttpOnly: true
    │            ├─ Secure:   true (production only)
    │            ├─ SameSite: Lax
    │            └─ Path:     /
    │
    └─ Return JSON:
       { "token": "...", "user": { "id":1, "email":"...", "name":"...", ... } }

Flow Diagram - Me (GET /me)
---------------------------

  ┌──────────┐         ┌──────────────────┐            ┌──────────────┐
  │  Client  │         │ Backend (Fiber)  │            │   Database   │
  └────┬─────┘         └────────┬─────────┘            └──────┬───────┘
       │  GET /auth/me          │                             │
       │  Cookie: auth_token    │                             │
       │───────────────────────►│                             │
       │                        │  AuthRequired middleware    │
       │                        │  ✓ Validate JWT signature   │
       │                        │  ✓ Check expiry             │
       │                        │  ✓ Set c.Locals("user_id")  │
       │                        │                             │
       │                        │  HandleMe (auth_handler)    │
       │                        │  ├─ Read user_id from JWT   │
       │                        │  └─ authSvc.GetUserByID     │
       │                        │      └─ userRepo.GetUserByID│
       │                        │          └─ SELECT ...      │
       │                        │             WHERE id = $1 ──►│
       │                        │◄────────────────────────────│
       │  {id, email, name,     │                             │
       │   role, created_at,    │                             │
       │   updated_at}          │                             │
       │◄───────────────────────│                             │

Flow Diagram - Logout (POST /logout)
------------------------------------

  ┌──────────┐         ┌──────────────────┐
  │  Client  │         │ Backend (Fiber)  │
  └────┬─────┘         └────────┬─────────┘
       │  POST /auth/logout     │
       │  Cookie: auth_token    │
       │───────────────────────►│
       │                        │  HandleLogout (auth_handler)
       │                        │  └─ Clear auth_token cookie
       │                        │      Value: ""
       │                        │      Expires: -1h
       │                        │      HttpOnly: true
       │                        │
       │  Set-Cookie: auth_token│
       │  (expired)             │
       │  {message: "Logged out"}│
       │◄───────────────────────│

JWT Middleware Flow
------------------

  AuthRequired(cfg.JWTSecret) - applied via router on protected routes
    │
    ├─ (1) Check cookie "auth_token"
    ├─ (2) Fallback: check "Authorization: Bearer <token>" header
    │
    ├─ (3) If no token: 401 { "error": "Unauthorized: Missing token" }
    │
    ├─ (4) jwt.Parse(token, keyFunc) - validate signature & expiry
    │         └─ On error: 401 { "error": "Unauthorized: Invalid token" }
    │
    └─ (5) Set c.Locals("user_id", claims["sub"])
            └─ c.Next()

Entry Points & Exports
----------------------

+---------------------------------------+-------------+----------------------------------+
| Symbol                                | Kind        | Path                             |
+---------------------------------------+-------------+----------------------------------+
| NewAuthHandler(cfg, authSvc)          | Constructor | handler/auth_handler.go:18       |
| HandleRegister(c)                     | Method      | handler/auth_handler.go:36       |
| HandleLogin(c)                        | Method      | handler/auth_handler.go:59       |
| HandleMe(c)                           | Method      | handler/auth_handler.go:82       |
| HandleLogout(c)                       | Method      | handler/auth_handler.go:104      |
| NewAuthService(cfg, userRepo)         | Constructor | service/auth_service.go:26       |
| AuthService                           | Interface   | service/auth_service.go:15       |
| AuthRequired(secret)                  | Middleware  | middleware/auth.go:12            |
+---------------------------------------+-------------+----------------------------------+

Frontend Barrel Exports (features/auth/index.ts)
--------------------------------------------------

  export * from "./hooks/useAuth";
  export * from "./services/auth-api";
  export * from "./types";
  export * from "./components/LoginForm";
  export * from "./components/AuthGuard";

Dependencies
------------

+----------------------------------+------------------------------------+
| Dependency                       | Used For                           |
+----------------------------------+------------------------------------+
| github.com/gofiber/fiber/v3      | HTTP context, cookie, JSON         |
| github.com/golang-jwt/jwt/v5    | Token signing & parsing (HS256)    |
| golang.org/x/crypto/bcrypt       | Password hashing & verification    |
| repository.UserRepository        | Data access (PostgreSQL via pgx)   |
+----------------------------------+------------------------------------+

Source References
-----------------

- internal/handler/auth_handler.go - HTTP handlers for register & login
- internal/service/auth_service.go - AuthService interface + struct
- internal/middleware/auth.go - AuthRequired JWT middleware
- internal/constants/auth/jwt.go - Header/cookie names, error constants
- internal/constants/config/defaults.go - Default JWT secret, environment
- internal/router/router.go:43-45 - Route registration

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
