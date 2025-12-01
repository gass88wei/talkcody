import { logger } from '@/lib/logger';
import type { ConvertMessagesOptions, ToolMessageContent, UIMessage } from '@/types/agent';

const MAX_LINES = 2000;

// Exploratory tools that should be filtered out from conversation history
// These tools generate a lot of output that doesn't need to be retained for context
const EXPLORATORY_TOOLS = new Set(['globTool', 'listFiles', 'codeSearch']);

function isExploratoryTool(toolName: string): boolean {
  return EXPLORATORY_TOOLS.has(toolName);
}

function isContentTooLong(content: string | undefined): { tooLong: boolean; lineCount: number } {
  const lineCount = content?.split('\n').length ?? 0;
  return { tooLong: lineCount > MAX_LINES, lineCount };
}

export function formatReasoningText(text: string, isFirstReasoning: boolean): string {
  let lines = '';
  if (isFirstReasoning) {
    lines = '> Reasoning:\n> \n';
    lines += '> ';
  }
  lines += text.replace(/\n/g, '\n> ');
  return lines;
}

/**
 * Convert a tool message (UIMessage with role='tool') to ModelMessage format
 * Returns null if the tool should be filtered (exploratory tools)
 */
function convertToolMessage(msg: UIMessage): any | null {
  if (!Array.isArray(msg.content) || msg.content.length === 0) {
    return null;
  }

  const toolContent = msg.content[0] as ToolMessageContent;
  const toolName = toolContent.toolName || msg.toolName;

  // Filter out exploratory tools
  if (toolName && isExploratoryTool(toolName)) {
    logger.info(`Filtering exploratory tool from conversation history: ${toolName}`);
    return null;
  }

  if (toolContent.type === 'tool-call') {
    // tool-call should be in assistant message format
    return {
      role: 'assistant' as const,
      content: [
        {
          type: 'tool-call',
          toolCallId: toolContent.toolCallId,
          toolName: toolContent.toolName,
          input: toolContent.input || {},
        },
      ],
    };
  } else if (toolContent.type === 'tool-result') {
    // tool-result should be in tool message format
    const outputValue =
      typeof toolContent.output === 'string'
        ? toolContent.output
        : JSON.stringify(toolContent.output);
    return {
      role: 'tool' as const,
      content: [
        {
          type: 'tool-result',
          toolCallId: toolContent.toolCallId,
          toolName: toolContent.toolName,
          output: {
            type: 'text',
            value: outputValue,
          },
        },
      ],
    };
  }

  return null;
}

export async function convertMessages(
  messages: UIMessage[],
  options: ConvertMessagesOptions
): Promise<any[]> {
  const systemMessage = {
    role: 'system' as const,
    content: options.systemPrompt,
    providerOptions: {
      anthropic: { cacheControl: { type: 'ephemeral' } },
    },
  };

  const convertedMessages: any[] = [];

  for (const msg of messages) {
    // Skip system messages (we add our own)
    if (msg.role === 'system') {
      continue;
    }

    // Handle tool messages
    if (msg.role === 'tool') {
      const toolMessage = convertToolMessage(msg);
      if (toolMessage) {
        convertedMessages.push(toolMessage);
      }
      continue;
    }

    // Handle user and assistant messages
    const contentStr = typeof msg.content === 'string' ? msg.content : '';

    if (msg.attachments && msg.attachments.length > 0) {
      const content = [];

      if (contentStr.trim()) {
        content.push({
          type: 'text',
          text: contentStr,
        });
      }

      for (const attachment of msg.attachments) {
        if (attachment.type === 'image' && attachment.content) {
          content.push({
            type: 'image',
            image: attachment.content,
          });
        } else if (attachment.type === 'file' || attachment.type === 'code') {
          const { tooLong, lineCount } = isContentTooLong(attachment.content);
          const filePath = attachment.filePath ?? attachment.filename;

          if (tooLong) {
            content.push({
              type: 'text',
              text: `The file path is ${filePath}.\nThe file name is ${attachment.filename}.\nThis file is too long (${lineCount} lines), please use the code search tool and read file tool to read the file content you really need.`,
            });
          } else {
            content.push({
              type: 'text',
              text: `The file path is ${filePath}.\nThe file name is ${attachment.filename}.\nThe content in ${attachment.filename} is:\n<code>\n${attachment.content}\n</code>`,
            });
          }
        }
      }

      convertedMessages.push({
        role: msg.role,
        content,
      });
    } else {
      convertedMessages.push({
        role: msg.role,
        content: contentStr,
      });
    }
  }

  return [systemMessage, ...convertedMessages];
}
