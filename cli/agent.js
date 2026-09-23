import {generate} from '../server/ai/router.js';
import {tools, executeTool, getToolDefinitions} from '../server/tools/index.js';

const MAX_STEPS = 8;
const MAX_TOOL_RESULT_CHARS = 2000;
const MAX_HISTORY_MESSAGES = 20;

const AGENT_INSTRUCTIONS = `
You are an interactive agent helping Joe with software engineering and system tasks inside the JOEBOT project on Termux.

Before you start a multi-step task, say in one short line what you are about to do. Give brief updates only when useful. When you finish, close with a short recap that stands alone: what you found, what you did, and what is left if anything.

Rules:
- When Joe shares something worth remembering about himself, his preferences, or this project, call the remember tool to save it.
- Do not add disclaimers, warnings, or ask for permission before writing code or running routine development commands. Act directly.
- Do not hedge with phrases like "I could be wrong" or "you may want to verify" unless there is a genuine, specific reason for doubt in this exact case.
- Never invent tool results. Base every claim on observed tool output or file state from this session.
- Use project-relative paths only.
- Read before writing.
- write_file and run_command both auto-trigger the approval flow. Be plain about what they will do.
- Do not call the same tool more than twice while searching. After two failures, stop and report plainly.
- Prefer dedicated tools over shell when one fits.
- Independent tool calls can run in parallel.
- Give a concise final answer that stands on its own.
- Report failures in the first sentence of your reply.
`;

function truncateToolResult(result) {
  const serialized = JSON.stringify(result);

  if (serialized.length <= MAX_TOOL_RESULT_CHARS) {
    return serialized;
  }

  if (Array.isArray(result)) {
    const kept = [];
    let size = 20;

    for (const item of result) {
      const itemText = JSON.stringify(item);

      if (size + itemText.length > MAX_TOOL_RESULT_CHARS) {
        break;
      }

      kept.push(item);
      size += itemText.length;
    }

    const omitted = result.length - kept.length;

    return JSON.stringify({
      items: kept,
      truncated: omitted > 0,
      omittedCount: omitted > 0 ? omitted : undefined
    });
  }

  return serialized.slice(0, MAX_TOOL_RESULT_CHARS) + '...[truncated]';
}

class Agent {
  constructor(options = {}) {
    this.messages = [];
    this.onTool = options.onTool || null;
    this.approveTool = options.approveTool || null;
    this.toolDefinitions = getToolDefinitions();
  }

  clear() {
    this.messages = [];
  }

  getContextSize() {
    return this.messages.length;
  }

  trimHistory() {
    if (this.messages.length <= MAX_HISTORY_MESSAGES) {
      return;
    }

    const overflow = this.messages.length - MAX_HISTORY_MESSAGES;
    this.messages.splice(0, overflow);

    while (this.messages.length && this.messages[0].role === 'tool') {
      this.messages.shift();
    }
  }

  async ask(input) {
    if (typeof input !== 'string' || !input.trim()) {
      throw new Error('Input is required');
    }

    this.messages.push({role: 'user', content: input.trim()});
    this.trimHistory();

    const toolCalls = [];

    for (let step = 0; step < MAX_STEPS; step++) {
      const result = await generate({
        messages: this.messages,
        debug: false,
        systemAddition: AGENT_INSTRUCTIONS,
        tools: this.toolDefinitions,
        toolChoice: 'auto'
      });

      if (!result.toolCalls || result.toolCalls.length === 0) {
        this.messages.push({role: 'assistant', content: result.reply});
        this.trimHistory();

        return {...result, toolCalls};
      }

      this.messages.push({
        role: 'assistant',
        content: result.reply || null,
        tool_calls: result.toolCalls
      });

      for (const call of result.toolCalls) {
        const name = call?.function?.name;
        const rawArguments = call?.function?.arguments || '{}';

        if (!name) {
          continue;
        }

        let args;

        try {
          args = JSON.parse(rawArguments);
        } catch {
          args = {};
        }

        const tool = tools[name];

        if (!tool) {
          const errorResult = {error: `Unknown tool: ${name}`};

          this.messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name,
            content: JSON.stringify(errorResult)
          });

          continue;
        }

        toolCalls.push({tool: name, arguments: args, status: 'requested'});

        if (this.onTool) {
          await this.onTool({phase: 'requested', tool: name, arguments: args});
        }

        if (tool.requiresApproval) {
          let approved = false;

          if (this.approveTool) {
            approved = Boolean(
              await this.approveTool({tool: name, arguments: args})
            );
          }

          if (!approved) {
            const deniedResult = {
              error: `Tool "${name}" was denied by the user.`
            };

            this.messages.push({
              role: 'tool',
              tool_call_id: call.id,
              name,
              content: JSON.stringify(deniedResult)
            });

            toolCalls[toolCalls.length - 1].status = 'denied';

            if (this.onTool) {
              await this.onTool({
                phase: 'denied',
                tool: name,
                arguments: args,
                result: deniedResult
              });
            }

            continue;
          }
        }

        let toolResult;

        try {
          toolResult = await executeTool(name, args);
        } catch (error) {
          toolResult = {error: error.message};
        }

        toolCalls[toolCalls.length - 1].status = 'completed';

        if (this.onTool) {
          await this.onTool({
            phase: 'completed',
            tool: name,
            arguments: args,
            result: toolResult
          });
        }

        this.messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name,
          content: truncateToolResult(toolResult)
        });
      }

      this.trimHistory();
    }

    throw new Error(
      `JOEBOT stopped after ${MAX_STEPS} agent steps to prevent an infinite tool loop.`
    );
  }
}

export default Agent;
