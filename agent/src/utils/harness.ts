import { BaseMessage } from "@langchain/core/messages";
import * as ts from 'typescript';

export function getCosineSimilarity(text1: string, text2: string): number {
    const tokenize = (text: string) => {
        return text.toLowerCase().match(/\b\w+\b/g) || [];
    };
    const tokens1 = tokenize(text1);
    const tokens2 = tokenize(text2);
    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    const freq1: Record<string, number> = {};
    const freq2: Record<string, number> = {};
    const allWords = new Set<string>();

    for (const w of tokens1) {
        freq1[w] = (freq1[w] || 0) + 1;
        allWords.add(w);
    }
    for (const w of tokens2) {
        freq2[w] = (freq2[w] || 0) + 1;
        allWords.add(w);
    }

    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (const w of allWords) {
        const val1 = freq1[w] || 0;
        const val2 = freq2[w] || 0;
        dotProduct += val1 * val2;
        mag1 += val1 * val1;
        mag2 += val2 * val2;
    }

    if (mag1 === 0 || mag2 === 0) return 0;
    return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

export function getHistoryTokens(msgs: BaseMessage[]): number {
    return msgs.reduce((acc, m) => acc + Math.ceil((m.content || "").toString().length / 4), 0);
}

export function selectiveTruncateToolResults(messages: BaseMessage[], threshold: number): BaseMessage[] {
    return messages.map(msg => {
        if (msg._getType() === 'tool') {
            const contentStr = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            if (contentStr.length > threshold) {
                const ToolMsgClass = msg.constructor as any;
                return new ToolMsgClass({
                    content: `[Tool output truncated: original length ${contentStr.length} chars exceeding threshold ${threshold}]`,
                    name: msg.name,
                    id: msg.id,
                    tool_call_id: (msg as any).tool_call_id,
                    additional_kwargs: msg.additional_kwargs,
                    response_metadata: msg.response_metadata,
                });
            }
        }
        return msg;
    });
}

/** @deprecated Use selectiveTruncateToolResults instead */
export const selectiveDropToolResults = selectiveTruncateToolResults;

export function validateContent(filename: string, content: string): { valid: boolean; reason?: string } {
    const placeholders = [
        /\[Not available\]/i,
        /\(need to extract\)/i,
        /\(list if available\)/i,
        /placeholder/i,
        /insert here/i,
        /\[The abstract text was not extracted\]/i
    ];
    for (const pattern of placeholders) {
        if (pattern.test(content)) {
            return {
                valid: false,
                reason: `Content contains invalid placeholder: ${pattern.toString()}`
            };
        }
    }

    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'json') {
        try {
            JSON.parse(content);
        } catch (err: any) {
            return { valid: false, reason: `Invalid JSON syntax: ${err.message}` };
        }
    } else if (ext === 'ts' || ext === 'js' || ext === 'tsx' || ext === 'jsx') {
        try {
            const sourceFile = ts.createSourceFile(
                filename,
                content,
                ts.ScriptTarget.Latest,
                true
            );
            const diagnostics = (sourceFile as any).parseDiagnostics || [];
            if (diagnostics.length > 0) {
                const errors = diagnostics
                    .slice(0, 3)
                    .map((d: any) => `${d.messageText} (at line ${sourceFile.getLineAndCharacterOfPosition(d.start).line + 1})`)
                    .join(', ');
                return { valid: false, reason: `Syntax errors detected: ${errors}` };
            }
        } catch (err: any) {
            return { valid: false, reason: `Failed to compile/parse JS/TS: ${err.message}` };
        }
    }
    return { valid: true };
}
