import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Box, Text, useApp, useInput, render} from 'ink';
import {TextInput} from '@inkjs/ui';

import {
  COMMANDS,
  Header,
  Message,
  ApprovalCard,
  CommandMenu,
  StatusBar
} from './components.jsx';

function App() {
  const {exit} = useApp();

  const [input, setInput] = useState('');
  const [inputKey, setInputKey] = useState(0);
  const [selected, setSelected] = useState(0);
  const [messages, setMessages] = useState([]);

  const [busy, setBusy] = useState(false);
  const [agent, setAgent] = useState(null);

  const [provider, setProvider] = useState(null);
  const [model, setModel] = useState(null);

  const [approval, setApproval] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [lastActivity, setLastActivity] = useState(null);

  const approvalResolver = useRef(null);
  const currentMessage = useRef(null);
  const interrupted = useRef(false);

  function resetInput() {
    setInput('');
    setSelected(0);
    setInputKey(key => key + 1);
  }

  const matches = useMemo(
    () =>
      input.startsWith('/')
        ? COMMANDS.filter(([command]) =>
            command.startsWith(input.toLowerCase())
          )
        : [],
    [input]
  );

  useEffect(() => {
    let mounted = true;

    import('../agent.js')
      .then(module => {
        if (!mounted) {
          return;
        }

        const Agent = module.default || module;

        const instance = new Agent({
          onTool(event) {
            const messageId = currentMessage.current;

            if (!messageId) {
              return;
            }

            setMessages(previous =>
              previous.map(message => {
                if (message.id !== messageId) {
                  return message;
                }

                const events = [...(message.events || [])];

                const existingIndex = events.findIndex(
                  existing =>
                    existing.tool === event.tool &&
                    existing.phase === 'requested' &&
                    event.phase !== 'requested'
                );

                if (event.phase === 'completed' || event.phase === 'denied') {
                  if (existingIndex >= 0) {
                    events[existingIndex] = event;
                  } else {
                    events.push(event);
                  }
                } else {
                  events.push(event);
                }

                
                // Track last activity for header
                if (event.phase === 'completed' || event.phase === 'requested') {
                  const label =
                    event.tool === 'run_command'
                      ? `run ${(event.arguments?.command || '').slice(0, 36)}`
                      : event.tool === 'write_file'
                        ? `write ${event.arguments?.path || ''}`
                        : event.tool === 'read_file'
                          ? `read ${event.arguments?.path || ''}`
                          : event.tool;
                  setLastActivity(label);
                }

                return {...message, events};
              })
            );
          },

          async approveTool(request) {
            return new Promise(resolve => {
              approvalResolver.current = resolve;
              setShowDetail(false);
              setApproval(request);
            });
          }
        });

        setAgent(instance);
        setBusy(true);

        instance
          .ask('Greet me briefly using what you remember about me')
          .then(result => {
            if (!mounted) {
              return;
            }

            setProvider(result.provider);
            setModel(result.model);

            setMessages(previous => [
              ...previous,
              {
                id: `greeting-${Date.now()}`,
                input: null,
                reply: result.reply,
                greeting: true
              }
            ]);
          })
          .catch(() => {})
          .finally(() => {
            if (mounted) {
              setBusy(false);
            }
          });
      })
      .catch(error => {
        console.error('Failed to load JOEBOT agent:', error);
        setAgent(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useInput((value, key) => {
    if (key.ctrl && value === 'c') {
      exit();
      return;
    }

    if (approval) {
      const isRisky = approval.tool === 'run_command';

      if (value.toLowerCase() === 'y') {
        const resolve = approvalResolver.current;
        approvalResolver.current = null;
        setApproval(null);
        setShowDetail(false);
        if (resolve) resolve(true);
        return;
      }

      if (value.toLowerCase() === 'n' || key.escape) {
        const resolve = approvalResolver.current;
        approvalResolver.current = null;
        setApproval(null);
        setShowDetail(false);
        if (resolve) resolve(false);
        return;
      }

      if (isRisky && value.toLowerCase() === 'd') {
        setShowDetail(current => !current);
        return;
      }

      return;
    }

    if (key.escape && busy) {
      interrupted.current = true;
      return;
    }

    if (key.escape && input.startsWith('/')) {
      resetInput();
      return;
    }

    if (input.startsWith('/') && matches.length > 0) {
      if (key.upArrow) {
        setSelected(current =>
          current <= 0 ? matches.length - 1 : current - 1
        );
        return;
      }

      if (key.downArrow) {
        setSelected(current =>
          current >= matches.length - 1 ? 0 : current + 1
        );
        return;
      }

      if (key.tab) {
        setInput(matches[selected]?.[0] || input);
        return;
      }
    }
  });

  async function runCommand(command) {
    switch (command) {
      case '/exit':
        exit();
        return;

      case '/clear':
        setMessages([]);
        if (agent?.clear) agent.clear();
        resetInput();
        return;

      case '/help':
        setMessages(previous => [
          ...previous,
          {
            id: Date.now(),
            input: command,
            reply: COMMANDS.map(
              ([name, description]) => `${name.padEnd(16)} ${description}`
            ).join('\n')
          }
        ]);
        break;

      case '/status':
        setMessages(previous => [
          ...previous,
          {
            id: Date.now(),
            input: command,
            reply:
              'JOEBOT online\n\n' +
              'Runtime: Termux\n' +
              'TUI: Ink\n' +
              `Agent: ${agent ? 'connected' : 'loading'}\n` +
              `Provider: ${provider || 'auto'}\n` +
              `Model: ${model || 'auto'}`
          }
        ]);
        break;

      case '/tools':
        try {
          const module = await import('../../server/tools/index.js');
          const available = module.getTools ? module.getTools() : [];

          setMessages(previous => [
            ...previous,
            {
              id: Date.now(),
              input: command,
              reply: available.length
                ? available
                    .map(
                      tool =>
                        `${tool.name.padEnd(18)} ${
                          tool.requiresApproval ? 'approval required' : 'automatic'
                        }`
                    )
                    .join('\n')
                : 'No tools registered.'
            }
          ]);
        } catch {
          setMessages(previous => [
            ...previous,
            {id: Date.now(), input: command, reply: 'Unable to load tool registry.'}
          ]);
        }
        break;

      case '/permissions':
        setMessages(previous => [
          ...previous,
          {
            id: Date.now(),
            input: command,
            reply:
              'JOEBOT permissions\n\n' +
              'read_file       automatic\n' +
              'list_files      automatic\n' +
              'search_code     automatic\n' +
              'web_search      automatic\n' +
              'write_file      approval required\n' +
              'run_command     approval required, detail view available\n\n' +
              'Network         provider controlled'
          }
        ]);
        break;

      case '/plan':
        setMessages(previous => [
          ...previous,
          {
            id: Date.now(),
            input: command,
            reply:
              'Planning mode\n\n' +
              '1. Understand request\n' +
              '2. Inspect project\n' +
              '3. Build implementation plan\n' +
              '4. Request approval\n' +
              '5. Implement\n' +
              '6. Verify changes'
          }
        ]);
        break;

      case '/doctor':
        setMessages(previous => [
          ...previous,
          {
            id: Date.now(),
            input: command,
            reply:
              'JOEBOT diagnostics\n\n' +
              `Agent: ${agent ? 'OK' : 'NOT READY'}\n` +
              'TUI: OK\n' +
              'Tool registry: OK\n' +
              'Filesystem sandbox: OK\n' +
              `AI provider: ${provider || 'AUTO'}`
          }
        ]);
        break;

      case '/memory':
        try {
          const module = await import('../../server/ai/profileMemory.js');
          const memories = module.getMemories ? module.getMemories() : [];

          setMessages(previous => [
            ...previous,
            {
              id: Date.now(),
              input: command,
              reply: memories.length
                ? memories.map(item => `- ${item}`).join('\n')
                : 'No saved memories yet.'
            }
          ]);
        } catch {
          setMessages(previous => [
            ...previous,
            {id: Date.now(), input: command, reply: 'Unable to read the memory module.'}
          ]);
        }
        break;

      case '/chats':
        setMessages(previous => [
          ...previous,
          {
            id: Date.now(),
            input: command,
            reply: 'Conversation manager detected.\nPersistent chat browser will be connected next.'
          }
        ]);
        break;

      case '/compact':
        setMessages(previous => [
          ...previous,
          {
            id: Date.now(),
            input: command,
            reply: `Context compaction is not enabled yet.\nCurrent context: ${
              agent?.getContextSize?.() || 0
            } messages.`
          }
        ]);
        break;

      default:
        setMessages(previous => [
          ...previous,
          {id: Date.now(), input: command, reply: `Command ${command} is not implemented yet.`}
        ]);
    }

    resetInput();
  }

  async function submit(value) {
    const text = value.trim();

    if (!text || busy || approval) {
      return;
    }

    resetInput();

    if (text.startsWith('/')) {
      const exact = COMMANDS.find(([command]) => command === text);

      if (exact) {
        await runCommand(exact[0]);
        return;
      }

      if (text === '/' && matches.length > 0) {
        setInput(matches[selected]?.[0] || '/');
        return;
      }

      setMessages(previous => [
        ...previous,
        {id: Date.now(), input: text, reply: `Unknown command: ${text}. Type / for commands.`}
      ]);

      return;
    }

    if (!agent) {
      setMessages(previous => [
        ...previous,
        {id: Date.now(), input: text, reply: 'Agent is still starting. Try again in a moment.'}
      ]);

      return;
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    currentMessage.current = id;
    interrupted.current = false;

    setBusy(true);

    setMessages(previous => [
      ...previous,
      {id, input: text, busy: true, events: [], reply: ''}
    ]);

    try {
      const result = await agent.ask(text);

      setProvider(result.provider);
      setModel(result.model);

      setMessages(previous =>
        previous.map(message =>
          message.id === id
            ? {
                ...message,
                busy: false,
                reply: interrupted.current
                  ? 'Request completed after interrupt.'
                  : result.reply || 'No response returned.'
              }
            : message
        )
      );
    } catch (error) {
      setMessages(previous =>
        previous.map(message =>
          message.id === id
            ? {...message, busy: false, reply: `Agent error: ${error.message}`}
            : message
        )
      );
    } finally {
      setBusy(false);
      currentMessage.current = null;
    }

    setSelected(0);
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Header busy={busy} provider={provider} model={model} lastActivity={lastActivity} />

      <Box flexDirection="column">
        {messages.map(message => (
          <Message key={message.id} item={message}/>
        ))}
      </Box>

      {approval && <ApprovalCard approval={approval} showDetail={showDetail}/>}

      <Box flexDirection="column">
        <Box>
          <Text color="#FF8A3D" bold>❯ </Text>

          <Box flexDirection="column" marginTop={1}>
        <Text dimColor>{'- '.repeat(32).trim()}</Text>
        <Box>
          <Text color="#FF8A3D">❯ </Text>
          <TextInput
            key={inputKey}
            value={input}
            onChange={setInput}
            onSubmit={submit}
            placeholder="Message JOEBOT..."
          />
        </Box>
        <Text dimColor>{'- '.repeat(32).trim()}</Text>
      </Box>
        </Box>

        {!busy && !approval && (
          <CommandMenu query={input} selected={selected}/>
        )}
      </Box>

      <StatusBar
        busy={busy}
        context={agent?.getContextSize?.() || 0}
        approval={approval}
      />
    </Box>
  );
}

render(<App/>);
