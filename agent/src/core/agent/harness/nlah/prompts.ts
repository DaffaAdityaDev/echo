export const HARNESS_PROMPTS = {
  STUCK_CLASSIFIER_SYSTEM: "You are a state classifier. Respond with exactly 'COMPLETE' or 'STUCK'.",
  STUCK_CLASSIFIER_USER: (objective: string, assistantContent: string) => 
    `Analyze the Assistant's last response and the User's objective.
Determine if the Assistant has halted in an internal thinking/planning state (e.g. stating "I should search", "I need to find", "Let me check" without actually outputting a message for the human or calling a tool).

If the Assistant is asking the human user a clarifying question, proposing options to choose from, greeting the user, or explaining why it cannot proceed without more details, this is NOT stuck. It is a valid response to the user.

User Objective: "${objective}"
Assistant Response: "${assistantContent}"

Respond with exactly "COMPLETE" (if it's a valid message/clarification/answer to the user) or "STUCK" (if it is just internal planning/thinking/halting without a message/action).`,
  
  COMPACTION_SYSTEM: "You are a structured state summarization system.",
  COMPACTION_PROMPT: `Summarize the conversation so far. You MUST return your response as a dense, structured JSON block (wrapped in a markdown code block) with the following schema:
{
  "decisions": ["list of key technical decisions"],
  "accomplishments": ["list of tasks completed"],
  "facts": {"key_variable": "value"},
  "pending_challenges": ["remaining roadblocks to solve"]
}
Return ONLY this structured JSON.`,

  COMPACTION_SUMMARY_WRAPPER: (iteration: number, summaryText: string) => 
    `[Context Compaction Structured State Summary of Steps 1-${iteration - 1}]:\n${summaryText}`,

  PACING_WARNING: (iteration: number) => 
    `[SYSTEM PACING WARNING]: You have taken ${iteration} turns. Please analyze if you are stuck in a loop. Adjust your plan, summarize what works, and move towards final synthesis to preserve execution budget.`,

  REPEATING_WARNING: 
    `SYSTEM SYSTEM WARNING: You are repeating your previous reasoning path. Your last action failed with a silent state conflict. Do not attempt the same tool configuration again. Choose a different diagnostic endpoint or execute a graceful exit.`,

  RECOVERY_PROMPT: 
    `[HARNESS SYSTEM ERROR]: You attempted to call a tool using raw XML tags but the parameters were malformed. Please use the strict native tool call protocol or fix your XML block format immediately. Do not chat, execute the tool.`,

  FEEDBACK_PROMPT: 
    `[HARNESS SYSTEM NOTICE]: You are currently halting in a thought state without triggering an action. If you need external data, you MUST call an available tool now. If you have completed the task, output your FINAL ANSWER immediately.`,

  LOG_COMPACTED: (tokens: number) => 
    `*[System: Context compacted. Accumulated history of ${tokens} tokens summarized into structured high-density state to avoid context window bloating.]*`,
  
  LOG_RE_ROUTE: 
    `[Harness Notice]: Tool execution automatically re-routed via Soft Recovery.`,

  FINANCIAL_ABORT: (threshold: number, spend: number) => 
    `FINANCIAL_ABORT: Execution budget of $${threshold.toFixed(2)} exceeded. Current spend: $${spend.toFixed(4)}. Aborting run to protect resources.`,

  VALIDATION_REJECTION: (reason: string) => 
    `Validation Gate Rejection: ${reason}. You are prohibited from writing files containing empty placeholders or syntax errors. Fix the code/content and write it.`,

  OFFLOAD_WRAPPER: (filename: string, previewLines: string) => 
    `[Context Offloaded to sa-output/runtime/files/${filename} due to size limit. First 10 lines preview:]\n${previewLines}\n\n...[Full contents saved to disk]...`,

  MD_LEDGER_HEADER: (time: string, missionId: string, iteration: number, strategy: string, storageStatus: string, depth: number, systemPrompt: string) => `
================================================================================
## 🕒 [${time}] | MID: #_${missionId}_ | ITERATION: ${iteration}
### 🤖 ROLE: ${strategy.toUpperCase()}
================================================================================
### 🗄️ MONITORING GATES
- **Storage Engine:** \`${storageStatus}\`
- **Context Memory Depth:** \`${depth} messages\`
---
### 🛑 COMPRESSED XML SYSTEM PROMPT (Sent to LLM)
\`\`\`xml
${systemPrompt}
\`\`\`
`,

  MD_LEDGER_FOOTER: `\n---`,

  PURE_LEDGER: (iteration: number, missionId: string, time: string, systemPrompt: string, messages: string) => `

================================================================================
ITERATION: ${iteration} | MID: ${missionId} | TIME: ${time}
================================================================================
SYSTEM PROMPT:
${systemPrompt}
\n---
MESSAGES:
${messages}
\n`
} as const;
