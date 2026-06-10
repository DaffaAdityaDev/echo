import { IContextAnchor } from "./types";
import { StandardContextAnchor } from "./standard";
import { ANCHOR_VERSIONS } from "./constants";

export class AnchorFactory {
  public static create(version?: string): IContextAnchor {
    switch (version?.toLowerCase()) {
      case ANCHOR_VERSIONS.STANDARD:
      default:
        return new StandardContextAnchor();
    }
  }
}
