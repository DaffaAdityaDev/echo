import { join } from 'node:path';
import { mkdir, appendFile } from 'node:fs/promises';
import { AgentState } from '../../../../../shared/types';
import { logger } from '../../../../../shared/utils/logger';
import { FILE_OPS } from '../constants';
import { HARNESS_PROMPTS } from '../prompts';

export interface DebugLedgerOptions {
    state: AgentState;
    iteration: number;
    strategyName: string;
    systemPrompt: string;
}

/**
 * Writes agent execution prompt logs asynchronously to local file storage.
 * Runs inside the non-blocking event loop (setImmediate) so disk I/O does not
 * stall the agent's main execution runtime.
 */
export function queuePromptDebug({ state, iteration, strategyName, systemPrompt }: DebugLedgerOptions): void {
    setImmediate(async () => {
        try {
            const debugDir = join(process.cwd(), FILE_OPS.DEBUG_DIR);
            const today = new Date().toISOString().split('T')[0];
            const debugPath = join(debugDir, `agent_history_debug_${today}.md`);
            const purePath = join(debugDir, `agent_history_pure_${today}.md`);

            const now = new Date();
            const pad = (n: number) => String(n).padStart(2, '0');
            const ms = String(now.getMilliseconds()).padStart(3, '0');
            const timeString = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${ms}`;

            const shortMissionId = state.missionId.slice(0, 8);

            const sampleMsg = state.messages[0];
            const isLangChainInstance = sampleMsg && typeof sampleMsg._getType === 'function';
            const storageStatus = isLangChainInstance ? "✅ HEALTHY" : "❌ OBJECT_CORRUPT";

            // Format message chronology with emoji badges based on message type
            const messageHistoryString = state.messages.map((m, idx) => {
                const rawType = m._getType ? m._getType().toUpperCase() : 'UNKNOWN';

                let badge = '⚪ UNKNOWN';
                if (rawType === 'HUMAN') badge = '🟢 HUMAN';
                if (rawType === 'AI') badge = '🤖 AI_THOUGHT';
                if (rawType === 'TOOL') badge = '⚙️ TOOL_OBSERVATION';

                return `**[MsgID: ${idx}] ${badge}:**\n${m.content}\n`;
            }).join('\n---\n');

            const mdContent = [
                HARNESS_PROMPTS.MD_LEDGER_HEADER(timeString, shortMissionId, iteration, strategyName, storageStatus, state.messages.length, systemPrompt),
                `\n`,
                `### 📥 KRONOLOGI CONTEXT HISTORY (Injected Visual Emojis)`,
                messageHistoryString,
                HARNESS_PROMPTS.MD_LEDGER_FOOTER
            ].join('\n');

            const pureMessagesString = state.messages.map((m, idx) => {
                const rawType = m._getType ? m._getType() : 'unknown';
                return `[Message ${idx}] [${rawType}]:\n${m.content}`;
            }).join('\n\n');

            const pureContent = HARNESS_PROMPTS.PURE_LEDGER(iteration, shortMissionId, timeString, systemPrompt, pureMessagesString);

            // Create directory if absent, then write both logs in parallel
            await mkdir(debugDir, { recursive: true });
            await Promise.all([
                appendFile(debugPath, mdContent, FILE_OPS.FILE_ENCODING),
                appendFile(purePath, pureContent, FILE_OPS.FILE_ENCODING)
            ]);
        } catch (err) {
            logger.error("Failed to write prompt debug ledger to local file", err);
        }
    });
}
