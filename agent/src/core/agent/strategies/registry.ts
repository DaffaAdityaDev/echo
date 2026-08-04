import type {
  AgentStrategy,
  StrategyRegistry as IStrategyRegistry,
  StrategyRegistryEntry,
} from "../../../shared/types";
import { STRATEGY_VERSION_ALIASES, STRATEGY_VERSIONS } from "./constants";
import { StrategyFactory } from "./factory";

const CATALOG: StrategyRegistryEntry[] = Object.entries(STRATEGY_VERSIONS).map(([name, version]) => ({
  name,
  versions: [
    {
      version,
      status: "active",
      aliases: [...STRATEGY_VERSION_ALIASES[version]],
    },
  ],
}));

export class StrategyRegistry implements IStrategyRegistry {
  public list(): StrategyRegistryEntry[] {
    return CATALOG;
  }

  public resolve(versionOrAlias: string): AgentStrategy {
    const normalized = versionOrAlias.toLowerCase().trim();

    for (const entry of CATALOG) {
      for (const vInfo of entry.versions) {
        if (
          vInfo.version.toLowerCase() === normalized ||
          vInfo.aliases.some((alias) => alias.toLowerCase() === normalized)
        ) {
          return StrategyFactory.create(entry.name);
        }
      }
    }

    return StrategyFactory.create(normalized);
  }

  public isDeprecated(versionOrAlias: string): boolean {
    const normalized = versionOrAlias.toLowerCase().trim();

    for (const entry of CATALOG) {
      for (const vInfo of entry.versions) {
        if (
          vInfo.version.toLowerCase() === normalized ||
          vInfo.aliases.some((alias) => alias.toLowerCase() === normalized)
        ) {
          return vInfo.status === "deprecated";
        }
      }
    }

    return false;
  }
}

export const strategyRegistry = new StrategyRegistry();
