import { MemoryAdapter } from "../../../adapter/outbound/backend/memory.adapter";
import { ENV } from "../../../config/env";
import type { AgentState, PausedMissionState } from "../../../shared/types";
import { logger } from "../../../shared/utils/logger";
import { STORAGE_LOG_MESSAGES } from "./constants";
import { InMemoryStateProvider } from "./memory";
import type { StateKey } from "./state-key";

export interface StateStore {
  get(key: StateKey): Promise<AgentState | PausedMissionState | null>;
  set(key: StateKey, state: AgentState | PausedMissionState, ttlSeconds?: number): Promise<void>;
  delete(key: StateKey): Promise<void>;
}

function createStateProvider(): StateStore {
  if (ENV.STATE_BACKEND === "backend") {
    const provider = new MemoryAdapter(ENV.BACKEND_URL);
    logger.info("🧠 Agent State Channel: BACKEND PERSISTENCE ACTIVE");

    return provider;
  }

  logger.info(STORAGE_LOG_MESSAGES.MEMORY_ACTIVE);

  return new InMemoryStateProvider();
}

const stateStorage = createStateProvider();

export { stateStorage };
