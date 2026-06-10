import { SystemMessage } from "@langchain/core/messages";
import { IContextAnchor } from "./types";
import { ANCHOR_DEFAULTS, ANCHOR_TEMPLATES } from "./constants";

export class StandardContextAnchor implements IContextAnchor {
  public build(options?: Record<string, any>): SystemMessage {
    const location = options?.location || ANCHOR_DEFAULTS.LOCATION;
    const currentYear = options?.year || new Date().getFullYear();
    return new SystemMessage(
      ANCHOR_TEMPLATES.STANDARD_ANCHOR(currentYear, location)
    );
  }
}
