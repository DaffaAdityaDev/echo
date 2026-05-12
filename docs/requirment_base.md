# 🌌 ECHO: Enterprise Cutting-edge Hybrid Orchestrator

> **Vision**: A high-performance, modular playground project mimicking enterprise-grade architecture for game server management and AI orchestration.

---

## 🏗️ Core Pillars

### 1. 🚀 Backend (Golang)
*   **Role**: The "Engine" & Orchestrator.
*   **Architecture**: **Hexagonal (Ports & Adapters)**.
*   **Responsibilities**:
    *   **Docker Management**: Abstracted container orchestration via Docker SDK.
    *   **Resource Monitoring**: Real-time telemetry provider.
    *   **Toggle Engine**: Custom-built feature management (Unleash-style) with real-time propagation.
    *   **Discord Bot**: remote management adapter.
    *   **API Gateway**: gRPC service exposing domain tools.

### 2. 🧠 AI Agent (Node.js/TypeScript)
*   **Role**: The "Brain" & Intelligence.
*   **Architecture**: **Provider-Agnostic AI Logic**.
*   **Responsibilities**:
    *   **Harness AI**: Langchain/LangGraph orchestration.
    *   **MCP Integration**: Connecting AI to backend tools via standardized protocol.
    *   **Context/Notes**: RAG-based context management for proactive assistance.

### 3. 🖥️ Frontend (React / Desktop)
*   **Role**: The "Command Center".
*   **Architecture**: **Service-Layer Abstraction**.
*   **Responsibilities**:
    *   **Dashboard**: High-fidelity modular UI components.
    *   **Control Plane**: Central command for feature toggles and kill-switches.
    *   **Data Isolation**: UI is separated from data-fetching (React Query/SWR agnostic).

---

## 🧩 Decoupling Manifesto (The "Swappable" Rule)

To ensure this project remains an enterprise-grade portfolio, we adhere to **Zero Tight Coupling**:

1.  **Interface-First (Go)**: No domain logic may depend on a concrete library. We depend on interfaces (e.g., `Repository`, `Orchestrator`). Swapping PostgreSQL for MongoDB or Docker for K8s requires zero changes to the `internal/domain`.
2.  **Model Agnostic (Agent)**: AI logic must target `BaseModel` abstractions. Swapping GPT-4 for Claude 3 or a local Llama model is a configuration change, not a code change.
3.  **The "Bridge" Contract**: gRPC serves as the strictly typed contract between services. As long as the `.proto` is satisfied, the underlying service implementation can be entirely rewritten.
4.  **Pub/Sub Event Bus**: Services communicate asynchronously via events (Redis/NATS). A service emitting an event never knows (or cares) who is listening.
5.  **Frontend Repository Pattern**: UI components consume data through abstract hooks. The underlying fetcher (React Query, SWR, or Axios) is injected at the provider level.

---

## 📐 Architectural Decisions

| Decision | Implementation | Why? |
|--- |--- |--- |
| **Communication** | gRPC | High performance, typed contracts, enterprise standard. |
| **Events** | Redis Pub/Sub | Real-time updates for UI and Agent proactively. |
| **Toggle System** | Custom Engine | Local control, real-time sync, and zero external dependency. |
| **Modularity** | Hexagonal Architecture | Implementation details never leak into domain logic. |
| **Frontend** | Service Factory | Allows swapping data libraries (React Query → SWR) in one place. |
| **Scaling** | Container-First | Isolation, portability, and resource control. |

