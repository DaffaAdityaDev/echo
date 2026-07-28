import { MemoryAdapter } from "../../../adapter/outbound/backend/memory.adapter";
import { ENV } from "../../../config/env";
import { logger } from "../../../shared/utils/logger";
import { STORAGE_LOG_MESSAGES } from "./constants";
import { InMemoryStateProvider } from "./memory";

function createStateProvider() {
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
