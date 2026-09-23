import * as filesystem from './filesystem.js';
import {searchCode} from './search.js';
import {runCommand} from './shell.js';
import {searchWeb} from './websearch.js';
import {searchComposioAction, executeComposioAction} from './composio.js';
import {addMemory, removeMemory} from '../ai/profileMemory.js';

export const tools = {
  read_file: {
    description: 'Read a text file. Works for files inside the project directory or anywhere in the phone shared storage folder (~/storage/shared and its subfolders like downloads, dcim, pictures).',
    requiresApproval: false,
    parameters: {
      type: 'object',
      properties: {
        path: {type: 'string', description: 'Path of the file to read. Can be relative to the project, or an absolute path like ~/storage/downloads/file.txt.'}
      },
      required: ['path'],
      additionalProperties: false
    },
    execute: ({path}) => filesystem.readFile(path)
  },

  write_file: {
    description: 'Write or replace a text file. Works for files inside the project directory or anywhere in the phone shared storage folder (~/storage/shared and its subfolders).',
    requiresApproval: true,
    parameters: {
      type: 'object',
      properties: {
        path: {type: 'string', description: 'Path of the file to write. Can be relative to the project, or an absolute path like ~/storage/downloads/file.txt.'},
        content: {type: 'string', description: 'Complete new contents of the file.'}
      },
      required: ['path', 'content'],
      additionalProperties: false
    },
    execute: ({path, content}) => filesystem.writeFile(path, content)
  },

  list_files: {
    description: 'List files and directories. Works for the project directory or anywhere in the phone shared storage folder (~/storage/shared and its subfolders like downloads, dcim, pictures, music, movies). Use this whenever the user asks about files anywhere on their phone, not only inside the project.',
    requiresApproval: false,
    parameters: {
      type: 'object',
      properties: {
        path: {type: 'string', description: 'Directory to list. Can be relative to the project (default .), or an absolute path like ~/storage/downloads.', default: '.'}
      },
      additionalProperties: false
    },
    execute: ({path = '.'}) => filesystem.listFiles(path)
  },

  search_code: {
    description: 'Search project files for a text string.',
    requiresApproval: false,
    parameters: {
      type: 'object',
      properties: {
        query: {type: 'string', description: 'Text to search for.'},
        path: {type: 'string', description: 'Project relative directory to search.', default: '.'}
      },
      required: ['query'],
      additionalProperties: false
    },
    execute: ({query, path = '.'}) => searchCode(query, path)
  },

  run_command: {
    description: 'Run a shell command in the project directory. Use for git, npm, vercel and similar deployment or tooling commands. Always requires explicit user approval.',
    requiresApproval: true,
    parameters: {
      type: 'object',
      properties: {
        command: {type: 'string', description: 'The exact shell command to run.'}
      },
      required: ['command'],
      additionalProperties: false
    },
    execute: ({command}) => runCommand(command)
  },

  web_search: {
    description: 'Search the live web for current information, documentation, or anything that may have changed since training data was last updated. Use this for current events, latest package versions, recent documentation, or anything time sensitive.',
    requiresApproval: false,
    parameters: {
      type: 'object',
      properties: {
        query: {type: 'string', description: 'The search query.'}
      },
      required: ['query'],
      additionalProperties: false
    },
    execute: ({query}) => searchWeb(query)
  },

  use_composio: {
    description: 'Only use this tool when the user explicitly says to use Composio, or names a connected app or service by name such as Gmail, GitHub, Slack, Calendar, or similar. Do not use this for local files, project code, or general web search. Pass the user request in plain words and the app name if one was mentioned. This tool finds the right action inside Composio and runs it, or returns a connection link if the app is not yet connected.',
    requiresApproval: true,
    parameters: {
      type: 'object',
      properties: {
        request: {type: 'string', description: 'What the user wants done, in plain words.'},
        app: {type: 'string', description: 'The app or service named by the user, if any, such as gmail or github.'}
      },
      required: ['request'],
      additionalProperties: false
    },
    execute: async ({request, app}) => {
      const found = await searchComposioAction(request, app);

      if (found.needsConnection) {
        return {
          status: 'needs_connection',
          app: found.app,
          connectUrl: found.connectUrl,
          message: `${found.app} is not connected yet. Open this link to connect it, then try again: ${found.connectUrl}`
        };
      }

      if (!found.action) {
        return {
          status: 'not_found',
          message: `No matching Composio action found for: ${request}`
        };
      }

      return executeComposioAction(found.action, found.args);
    }
  },

  remember: {
    description: 'Save a fact about Joe or this project to long term memory, so it persists across sessions and future conversations. Use this whenever Joe tells you something worth remembering about himself, his preferences, his projects, or how he wants you to behave. Save it as a short clear sentence.',
    requiresApproval: false,
    parameters: {
      type: 'object',
      properties: {
        fact: {type: 'string', description: 'The fact to remember, written as a short clear sentence.'}
      },
      required: ['fact'],
      additionalProperties: false
    },
    execute: ({fact}) => {
      const saved = addMemory(fact);
      return {status: saved ? 'saved' : 'already_known', fact};
    }
  },

  forget: {
    description: 'Remove a previously saved fact from long term memory. Use this when Joe asks you to forget something or corrects a fact you had saved.',
    requiresApproval: false,
    parameters: {
      type: 'object',
      properties: {
        fact: {type: 'string', description: 'The exact fact text to remove, matching what was saved.'}
      },
      required: ['fact'],
      additionalProperties: false
    },
    execute: ({fact}) => {
      removeMemory(fact);
      return {status: 'removed', fact};
    }
  }
};

export function getToolDefinitions() {
  return Object.entries(tools).map(([name, tool]) => ({
    type: 'function',
    function: {
      name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
}

export async function executeTool(name, args = {}) {
  const tool = tools[name];

  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  return tool.execute(args);
}

export function getTools() {
  return Object.entries(tools).map(([name, tool]) => ({
    name,
    description: tool.description,
    requiresApproval: Boolean(tool.requiresApproval)
  }));
}
