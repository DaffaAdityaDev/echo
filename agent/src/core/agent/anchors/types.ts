import { SystemMessage } from "@langchain/core/messages";

export interface IContextAnchor {
  build(options?: Record<string, any>): SystemMessage;
}
