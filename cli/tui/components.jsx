import React, {useState, useEffect} from 'react';
import {Box, Text} from 'ink';
import {renderMarkdown} from './markdown.js';

export const VERSION = '1.0.0';

const ACCENT = '#d77757';          // terracotta (Claude Code primary)
const HOT_PINK = '#fd5db1';        // tool / bash borders
const LAVENDER = '#b1b9f9';        // permission dialogs
const SUCCESS = '#4eba65';
const MUTED = '#888888';
const BOX_WIDTH = 64;

const TOOL_ICONS = {
  read_file: '◈',
  write_file: '✎',
  list_files: '▤',
  search_code: '⌕',
  run_command: '❯_',
  web_search: '◎'
};

export const COMMANDS = [
  ['/help', 'Show available commands'],
  ['/status', 'Show JOEBOT status'],
  ['/memory', 'Show saved memory'],
  ['/chats', 'Show conversations'],
  ['/clear', 'Clear agent context'],
  ['/compact', 'Compact conversation context'],
  ['/doctor', 'Run diagnostics'],
  ['/plan', 'Planning mode'],
  ['/tools', 'Show available tools'],
  ['/permissions', 'Show permission settings'],
  ['/exit', 'Exit JOEBOT']
];

export function Header({busy, provider, model, lastActivity}) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text>🙂 </Text>
        <Text bold color={ACCENT}>JOEBOT</Text>
        <Text dimColor> v{VERSION}</Text>
        <Text dimColor> · \~/joebot</Text>
        <Text dimColor> · </Text>
        <Text color={busy ? ACCENT : 'green'}>
          {busy ? 'working' : 'ready'}
        </Text>
        {provider && (
          <>
            <Text dimColor> · </Text>
            <Text dimColor>{provider}/{model}</Text>
          </>
        )}
      </Box>
      <Box>
        <Text dimColor>Recent: {lastActivity || 'No recent activity'}</Text>
      </Box>
    </Box>
  );
}

export function Divider() {
  return <Text dimColor>{'─'.repeat(BOX_WIDTH)}</Text>;
}

const SPINNER_FRAMES = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];
const THINKING_VERBS = [
  'Cogitating', 'Percolating', 'Ruminating', 'Ideating',
  'Synthesizing', 'Moonwalking', 'Shenaniganing', 'Calibrating',
  'Harmonizing', 'Distilling', 'Orchestrating', 'Pondering'
];

export function Thinking() {
  const [frame, setFrame] = useState(0);
  const [verb] = useState(
    () => THINKING_VERBS[Math.floor(Math.random() * THINKING_VERBS.length)]
  );

  useEffect(() => {
    const id = setInterval(() => {
      setFrame(f => (f + 1) % SPINNER_FRAMES.length);
    }, 120);
    return () => clearInterval(id);
  }, []);

  return (
    <Box marginLeft={2} marginBottom={1}>
      <Text color={ACCENT}>
        {SPINNER_FRAMES[frame]} {verb}...
      </Text>
    </Box>
  );
}

export function ToolCard({event}) {
  const status =
    event.phase === 'completed'
      ? '✓ completed'
      : event.phase === 'denied'
        ? '✗ denied'
        : '● running';

  const statusColor =
    event.phase === 'completed'
      ? SUCCESS
      : event.phase === 'denied'
        ? 'red'
        : ACCENT;

  const icon = TOOL_ICONS[event.tool] || '⚙';
  const args = event.arguments || {};

  let target = '';
  if (args.path) target = args.path;
  else if (args.query) target = `"${args.query}"`;
  else if (args.command) target = args.command;
  else target = JSON.stringify(args);

  return (
    <Box flexDirection="column" marginLeft={2} marginBottom={1}>
      <Box>
        <Text color={HOT_PINK}>┌─ </Text>
        <Text>{icon} </Text>
        <Text bold>{event.tool}</Text>
      </Box>

      <Box marginLeft={3}>
        <Text dimColor>{target}</Text>
      </Box>

      <Box>
        <Text color={HOT_PINK}>└─ </Text>
        <Text color={statusColor} bold>{status}</Text>
      </Box>
    </Box>
  );
}

export function ApprovalCard({approval, showDetail}) {
  if (!approval) return null;

  const args = approval.arguments || {};
  const icon = TOOL_ICONS[approval.tool] || '⚙';
  const isRisky = approval.tool === 'run_command';

  return (
    <Box
      flexDirection="column"
      marginLeft={2}
      marginBottom={1}
      borderStyle="round"
      borderColor={LAVENDER}
      paddingX={1}
    >
      <Text bold color={LAVENDER}>
        {isRisky ? 'Confirm before proceeding' : 'Permission required'}
      </Text>

      <Box marginTop={1}>
        <Text>JOEBOT wants to use </Text>
        <Text bold color={ACCENT}>{icon} {approval.tool}</Text>
      </Box>

      {args.path && (
        <Box>
          <Text dimColor>File: </Text>
          <Text>{args.path}</Text>
        </Box>
      )}

      {args.command && (
        <Box flexDirection="column">
          <Box>
            <Text dimColor>Command: </Text>
            <Text bold>{args.command}</Text>
          </Box>
          {showDetail && (
            <Box marginTop={1} flexDirection="column">
              <Text dimColor>Runs inside \~/joebot · cannot reach outside paths</Text>
              <Text dimColor>Destructive patterns are blocked</Text>
            </Box>
          )}
        </Box>
      )}

      <Box marginTop={1}>
        <Text bold color="green">[Y]</Text>
        <Text> Allow   </Text>
        <Text bold color="red">[N]</Text>
        <Text> Deny</Text>
        {isRisky && (
          <>
            <Text>   </Text>
            <Text bold color={ACCENT}>[D]</Text>
            <Text> Detail</Text>
          </>
        )}
      </Box>

      <Box>
        <Text dimColor>Y / N / Esc · D for detail on run_command</Text>
      </Box>
    </Box>
  );
}

export function Message({item}) {
  const isGreeting = Boolean(item.greeting);
  const renderedReply = item.reply ? renderMarkdown(item.reply) : '';
  const hasInput = item.input !== null && item.input !== undefined;

  return (
    <Box flexDirection="column" marginBottom={1}>
      {hasInput && (
        <Box>
          <Text color="white" bold>❯ </Text>
          <Text color="white">{item.input}</Text>
        </Box>
      )}

      {item.busy && <Thinking />}

      {item.events?.map((event, index) => (
        <ToolCard key={`\( {event.tool}- \){index}`} event={event} />
      ))}

      {item.reply && (
        <Box
          flexDirection="column"
          marginLeft={2}
          marginTop={hasInput ? 1 : 0}
        >
          <Text bold color={ACCENT}>
            {isGreeting ? '🙂 JOEBOT · welcome back' : '🙂 JOEBOT'}
          </Text>

          <Box marginTop={1}>
            <Text>{renderedReply}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export function CommandMenu({query, selected}) {
  if (!query.startsWith('/')) return null;

  const matches = COMMANDS.filter(([command]) =>
    command.startsWith(query.toLowerCase())
  );

  if (!matches.length) {
    return (
      <Box marginLeft={2} marginTop={1}>
        <Text dimColor>No matching commands</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginLeft={2} marginTop={1} marginBottom={1}>
      {matches.map(([command, description], index) => (
        <Box key={command}>
          <Text color={index === selected ? ACCENT : undefined}>
            {index === selected ? '❯ ' : '  '}
          </Text>
          <Text bold={index === selected}>{command}</Text>
          <Text dimColor>{'  '}{description}</Text>
        </Box>
      ))}
    </Box>
  );
}

export function StatusBar({busy, context, approval}) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Divider />

      <Box>
        <Text dimColor>\~/joebot</Text>
        <Text dimColor> · </Text>
        <Text color={approval ? 'yellow' : busy ? ACCENT : 'green'}>
          {approval ? 'waiting' : busy ? 'working' : 'ready'}
        </Text>
        <Text dimColor> · context {context}</Text>
      </Box>

      <Box>
        <Text dimColor>Enter send · / commands · ? shortcuts · Ctrl+C exit</Text>
      </Box>
    </Box>
  );
}
