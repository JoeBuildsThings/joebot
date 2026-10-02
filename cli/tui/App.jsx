import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Box, Static, useApp, useInput, render} from 'ink';

import {
  COMMANDS,
  Welcome,
  Message,
  Live,
  ApprovalCard,
  CommandMenu,
  Prompt,
  Rule,
  Footer,
  argsOf
} from './components.jsx';

const WELCOME = {id: 'welcome', welcome: true};
const DECISIONS = ['once', 'session', 'deny'];

function sessionKey(request) {
  const args = argsOf(request);
  if (request.tool === 'run_command') {
    const words = String(args.command || '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .join(' ');
    return words ? `run_command:${words}` : null;
  }
  return request.tool || null;
}

function sameCall(a, b) {
  return a.tool === b.tool && JSON.stringify(a.arguments || {}) === JSON.stringify(b.arguments || {});
}

function App() {
  const {exit} = useApp();

  const [items, setItems] = useState([WELCOME]);
  const [epoch, setEpoch] = useState(0);
  const [live, setLive] = useState(null);
  const [agent, setAgent] = useState(null);
  const [meta, setMeta] = useState({provider: null, model: null});
  const [editor, setEditor] = useState({text: '', cursor: 0});
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [approval, setApproval] = useState(null);
  const [choice, setChoice] = useState(0);
  const [showDetail, setShowDetail] = useState(false);

  const resolver = useRef(null);
  const events = useRef([]);
  const session = useRef(new Set());
  const history = useRef([]);
  const histIndex = useRef(-1);
  const busyRef = useRef(false);
  const interrupted = useRef(false);
  const agentRef = useRef(null);

  const matches = useMemo(
    () =>
      editor.text.startsWith('/') && !editor.text.includes(' ')
        ? COMMANDS.filter(([name]) => name.startsWith(editor.text.toLowerCase()))
        : [],
    [editor.text]
  );

  function say(input, reply) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setItems(previous => [...previous, {id, input, reply}]);
  }

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
            const list = [...events.current];

            if (event.phase === 'completed' || event.phase === 'denied') {
              let index = -1;
              for (let i = list.length - 1; i >= 0; i--) {
                if (list[i].phase === 'requested' && sameCall(list[i], event)) {
                  index = i;
                  break;
                }
              }
              if (index < 0) {
                for (let i = list.length - 1; i >= 0; i--) {
                  if (list[i].phase === 'requested' && list[i].tool === event.tool) {
                    index = i;
                    break;
                  }
                }
              }
              if (index >= 0) {
                list[index] = event;
              } else {
                list.push(event);
              }
            } else {
              list.push(event);
            }

            events.current = list;
            setLive(previous => (previous ? {...previous, events: list} : previous));
          },

          async approveTool(request) {
            const key = sessionKey(request);
            if (key && session.current.has(key)) {
              return true;
            }
            return new Promise(resolve => {
              resolver.current = {resolve, key};
              setChoice(0);
              setShowDetail(false);
              setApproval(request);
            });
          }
        });

        agentRef.current = instance;
        setAgent(instance);
      })
      .catch(error => {
        console.error('Failed to load JOEBOT agent:', error);
        setAgent(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  function answer(decision) {
    const pending = resolver.current;
    resolver.current = null;
    setApproval(null);
    setShowDetail(false);
    if (!pending) {
      return;
    }
    if (decision === 'session' && pending.key) {
      session.current.add(pending.key);
    }
    pending.resolve(decision !== 'deny');
  }

  useInput(
    (ch, key) => {
      const c = ch.toLowerCase();
      if (key.upArrow) {
        setChoice(value => (value + 2) % 3);
      } else if (key.downArrow || key.tab) {
        setChoice(value => (value + 1) % 3);
      } else if (key.return) {
        answer(DECISIONS[choice]);
      } else if (c === 'y' || c === '1') {
        answer('once');
      } else if (c === 'a' || c === '2') {
        answer('session');
      } else if (c === 'n' || c === '3' || key.escape) {
        answer('deny');
      } else if (c === 'd') {
        setShowDetail(value => !value);
      }
    },
    {isActive: Boolean(approval)}
  );

  function interrupt() {
    interrupted.current = true;
    const target = agentRef.current;
    if (target && typeof target.abort === 'function') {
      target.abort();
    }
  }

  useInput(
    (ch, key) => {
      if (key.ctrl) {
        if (ch === 'c') {
          exit();
        } else if (ch === 'u') {
          setEditor({text: '', cursor: 0});
        } else if (ch === 'a') {
          setEditor(e => ({...e, cursor: 0}));
        } else if (ch === 'e') {
          setEditor(e => ({...e, cursor: e.text.length}));
        }
        return;
      }

      if (key.escape) {
        if (busyRef.current) {
          interrupt();
        } else {
          setEditor({text: '', cursor: 0});
          setSelected(0);
        }
        return;
      }

      if (key.return) {
        submit();
        return;
      }

      if (key.upArrow || key.downArrow) {
        if (matches.length) {
          setSelected(value =>
            key.upArrow ? (value + matches.length - 1) % matches.length : (value + 1) % matches.length
          );
        } else if (history.current.length) {
          const list = history.current;
          const next = key.upArrow
            ? Math.min(list.length - 1, histIndex.current + 1)
            : Math.max(-1, histIndex.current - 1);
          histIndex.current = next;
          const text = next < 0 ? '' : list[list.length - 1 - next];
          setEditor({text, cursor: text.length});
        }
        return;
      }

      if (key.tab) {
        if (matches.length) {
          const text = matches[Math.min(selected, matches.length - 1)][0];
          setEditor({text, cursor: text.length});
        }
        return;
      }

      if (key.leftArrow) {
        setEditor(e => ({...e, cursor: Math.max(0, e.cursor - 1)}));
        return;
      }

      if (key.rightArrow) {
        setEditor(e => ({...e, cursor: Math.min(e.text.length, e.cursor + 1)}));
        return;
      }

      if (key.backspace || key.delete) {
        setEditor(e =>
          e.cursor === 0
            ? e
            : {
                text: e.text.slice(0, e.cursor - 1) + e.text.slice(e.cursor),
                cursor: e.cursor - 1
              }
        );
        setSelected(0);
        return;
      }

      if (key.meta || !ch) {
        return;
      }

      const clean = ch.replace(/[\r\n]+/g, ' ');
      setEditor(e => ({
        text: e.text.slice(0, e.cursor) + clean + e.text.slice(e.cursor),
        cursor: e.cursor + clean.length
      }));
      setSelected(0);
    },
    {isActive: !approval}
  );

  async function runCommand(command) {
    switch (command) {
      case '/exit':
        exit();
        return;

      case '/clear':
        process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
        if (agent?.clear) agent.clear();
        setItems([WELCOME]);
        setEpoch(value => value + 1);
        return;

      case '/help':
        say(command, COMMANDS.map(([name, text]) => `${name.padEnd(14)} ${text}`).join('\n'));
        return;

      case '/status':
        say(
          command,
          `Agent: ${agent ? 'connected' : 'loading'}\n` +
            `Provider: ${meta.provider || 'auto'}\n` +
            `Model: ${meta.model || 'auto'}\n` +
            `Context: ${agent?.getContextSize?.() || 0} messages`
        );
        return;

      case '/tools':
      case '/permissions':
        try {
          const module = await import('../../server/tools/index.js');
          const registry = module.tools || {};
          const rows = Object.entries(registry).map(
            ([name, tool]) =>
              `${name.padEnd(16)} ${tool.requiresApproval ? 'approval required' : 'automatic'}`
          );
          let reply = rows.length ? rows.join('\n') : 'No tools registered.';
          if (command === '/permissions') {
            const allowed = [...session.current];
            reply += '\n\nSession approvals:\n' + (allowed.length ? allowed.join('\n') : 'none');
          }
          say(command, reply);
        } catch (error) {
          say(command, `Unable to load tool registry: ${error.message}`);
        }
        return;

      case '/revoke':
        session.current.clear();
        say(command, 'Session approvals cleared.');
        return;

      case '/memory':
        try {
          const module = await import('../../server/ai/profileMemory.js');
          const memories = module.getMemories ? module.getMemories() : [];
          say(command, memories.length ? memories.map(item => `• ${item}`).join('\n') : 'No saved memories yet.');
        } catch (error) {
          say(command, `Unable to read the memory module: ${error.message}`);
        }
        return;

      case '/compact':
        say(
          command,
          `Context compaction is not enabled yet.\nCurrent context: ${agent?.getContextSize?.() || 0} messages.`
        );
        return;

      case '/doctor':
        say(
          command,
          `Agent: ${agent ? 'loaded' : 'not loaded'}\n` +
            `Provider: ${meta.provider || 'none yet'}\n` +
            `Model: ${meta.model || 'none yet'}\n` +
            `Session approvals: ${session.current.size}`
        );
        return;

      default:
        say(command, `Unknown command: ${command}. Type / for commands.`);
    }
  }

  async function submit() {
    let text = editor.text.trim();

    if (!text || busyRef.current) {
      return;
    }

    if (
      text.startsWith('/') &&
      matches.length &&
      !COMMANDS.some(([name]) => name === text.toLowerCase())
    ) {
      text = matches[Math.min(selected, matches.length - 1)][0];
    }

    history.current.push(text);
    histIndex.current = -1;
    setEditor({text: '', cursor: 0});
    setSelected(0);

    if (text.startsWith('/')) {
      await runCommand(text.toLowerCase());
      return;
    }

    if (!agent) {
      say(text, 'Agent is still starting. Try again in a moment.');
      return;
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    events.current = [];
    interrupted.current = false;
    busyRef.current = true;
    setBusy(true);
    setLive({id, input: text, events: []});

    let reply = '';
    try {
      const result = await agent.ask(text);
      setMeta(previous => ({
        provider: result.provider || previous.provider,
        model: result.model || previous.model
      }));
      reply = result.reply || 'No response returned.';
    } catch (error) {
      reply = `Agent error: ${error.message}`;
    } finally {
      setItems(previous => [...previous, {id, input: text, events: events.current, reply}]);
      busyRef.current = false;
      setBusy(false);
      setLive(null);
    }
  }

  return (
    <Box flexDirection="column">
      <Static key={epoch} items={items}>
        {item => (
          <Box key={item.id} flexDirection="column">
            {item.welcome ? <Welcome /> : <Message item={item} />}
          </Box>
        )}
      </Static>

      {live ? <Live item={live} paused={Boolean(approval)} /> : null}

      {approval ? (
        <ApprovalCard approval={approval} choice={choice} showDetail={showDetail} />
      ) : null}

      <Rule />
      <Prompt
        text={editor.text}
        cursor={editor.cursor}
        active={!approval}
        placeholder={busy ? 'Working, you can keep typing' : 'Message JOEBOT'}
      />
      <Rule />

      {!approval ? <CommandMenu matches={matches} selected={selected} /> : null}

      <Footer
        provider={meta.provider}
        model={meta.model}
        context={agent?.getContextSize?.() || 0}
        approval={Boolean(approval)}
      />
    </Box>
  );
}

render(<App />);
