import { AgentHarness, HarnessConfig } from './types';
import { NlahHarness } from './nlah/harness';

export class HarnessFactory {
    static create(type: string, options: HarnessConfig): AgentHarness {
        const typeLower = type.toLowerCase();
        switch (typeLower) {
            case 'nlah':
            default:
                return new NlahHarness(options);
        }
    }
}
