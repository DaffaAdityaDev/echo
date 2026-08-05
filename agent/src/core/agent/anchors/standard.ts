import { SystemMessage } from "@langchain/core/messages";
import { ANCHOR_TEMPLATES } from "./constants";

export class StandardContextAnchor {
  public build(options?: { year?: number }): SystemMessage {
    const currentYear = options?.year || new Date().getFullYear();
    return new SystemMessage(ANCHOR_TEMPLATES.STANDARD_ANCHOR(currentYear));
  }
}
