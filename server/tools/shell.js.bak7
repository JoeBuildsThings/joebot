import {execFile} from 'child_process';

const MAX_OUTPUT_CHARS = 8000;
const TIMEOUT_MS = 30000;

const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\//,
  /rm\s+-rf\s+~/,
  /\bdd\b/,
  /mkfs/,
  /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;/,
  /\.env\b/,
  /GROQ_API_KEY/,
  /OPENROUTER_API_KEY/,
  /GEMINI_API_KEY/,
  /shutdown/,
  /reboot/,
  /passwd/
];

const OUTSIDE_PROJECT_PATTERNS = [
  /\/data\/data\/com\.termux\/files\/home\/(?!joebot)[^\s]+/,
  /\/sdcard\//,
  /\/storage\//,
  /~\/(?!joebot)[^\s]+/
];

function isBlocked(command) {
  return BLOCKED_PATTERNS.some(pattern => pattern.test(command));
}

function touchesOutsideProject(command) {
  return OUTSIDE_PROJECT_PATTERNS.some(pattern => pattern.test(command));
}

export function runCommand(command) {
  return new Promise((resolve, reject) => {
    if (typeof command !== 'string' || !command.trim()) {
      reject(new Error('Command is required'));
      return;
    }

    if (isBlocked(command)) {
      reject(new Error('This command is blocked for safety reasons.'));
      return;
    }

    if (touchesOutsideProject(command)) {
      reject(
        new Error(
          'This command appears to reference a path outside the project directory and was not run. If this is intentional, phrase the command without an explicit outside path and confirm with Joe first.'
        )
      );
      return;
    }

    execFile(
      'sh',
      ['-c', command],
      {
        cwd: process.cwd(),
        timeout: TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT_CHARS * 4
      },
      (error, stdout, stderr) => {
        const output = {
          stdout: String(stdout || '').slice(0, MAX_OUTPUT_CHARS),
          stderr: String(stderr || '').slice(0, MAX_OUTPUT_CHARS),
          truncated:
            String(stdout || '').length > MAX_OUTPUT_CHARS ||
            String(stderr || '').length > MAX_OUTPUT_CHARS
        };

        if (error && error.killed) {
          reject(new Error(`Command timed out after ${TIMEOUT_MS}ms`));
          return;
        }

        if (error && typeof error.code === 'number' && error.code !== 0) {
          resolve({...output, exitCode: error.code, success: false});
          return;
        }

        resolve({...output, exitCode: 0, success: true});
      }
    );
  });
}
