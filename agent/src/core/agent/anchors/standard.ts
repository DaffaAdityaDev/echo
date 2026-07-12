import { SystemMessage } from "@langchain/core/messages";
import { ANCHOR_DEFAULTS, ANCHOR_TEMPLATES } from "./constants";

export class StandardContextAnchor {
  public build(options?: Record<string, any>): SystemMessage {
    const location = options?.location || ANCHOR_DEFAULTS.LOCATION;
    const currentYear = options?.year || new Date().getFullYear();
    return new SystemMessage(
      ANCHOR_TEMPLATES.STANDARD_ANCHOR(currentYear, location)
    );
  }
}
