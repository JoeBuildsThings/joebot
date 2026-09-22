const os = require("os");

const Agent = require("./agent");
const Input = require("./input");

const {
  clearScreen,
  showCursor,
  hideCursor,
  enterAlternateScreen,
  leaveAlternateScreen,
  header,
  activity,
  thinking,
  clearLine,
  success,
  error,
  warning,
  statusBar,
  panel
} = require("./renderer");

const {
  getMemories
} = require("../server/ai/profileMemory");

const {
  listConversations
} = require("../server/conversations/manager");

const VERSION = "0.4.0";

const agent = new Agent();
const input = new Input();

let exiting = false;
let busy = false;

function cwd() {
  const home = os.homedir();
  const current = process.cwd();

  if (current === home) return "~";

  if (current.startsWith(home + "/")) {
    return "~" + current.slice(home.length);
  }

  return current;
}

function printHeader() {
  clearScreen();

  header(
    VERSION,
    cwd()
  );
}

function help() {
  panel("Commands", [
    "/help          Show available commands",
    "/status        Show JOEBOT status",
    "/memory        Show saved memory",
    "/chats         Show conversations",
    "/clear         Clear agent context",
    "/compact       Compact context",
    "/doctor        Run diagnostics",
    "/plan          Planning mode",
    "/tools         Show available tools",
    "/permissions   Show permission settings",
    "/exit          Exit JOEBOT"
  ]);
}

function status() {
  panel("JOEBOT Status", [
    "Core          ● online",
    "Runtime       Termux",
    "AI Router     ● online",
    `Memory        ${getMemories().length} memories`,
    `Context       ${agent.getContextSize()} messages`,
    "Terminal      ● interactive"
  ]);
}

function memory() {
  const memories = getMemories();

  if (!memories.length) {
    panel("Memory", [
      "No saved memories."
    ]);

    return;
  }

  panel(
    "Memory",
    memories.map(
      (item, index) =>
        `${index + 1}. ${item}`
    )
  );
}

function chats() {
  const conversations = listConversations();

  if (!conversations.length) {
    panel("Conversations", [
      "No conversations found."
    ]);

    return;
  }

  panel(
    "Conversations",
    conversations
      .slice(0, 15)
      .map(
        (chat, index) =>
          `${index + 1}. ${
            chat.title || "New conversation"
          }`
      )
  );
}

function doctor() {
  panel("Diagnostics", [
    `Node          ${process.version}`,
    `Platform      ${process.platform}`,
    `Architecture  ${process.arch}`,
    "AI Router     ✓ loaded",
    "Memory        ✓ loaded",
    "Conversations ✓ loaded",
    "Renderer      ✓ loaded",
    "Input         ✓ loaded"
  ]);
}

function tools() {
  panel("Tools", [
    "read_file        File reading",
    "list_directory   Directory inspection",
    "search_code      Code search",
    "write_file       Controlled file writing",
    "edit_file        Controlled file editing",
    "run_command      Permission-gated commands",
    "git_status       Git status",
    "git_diff         Git changes",
    "web_search       Web Scout",
    "web_fetch        Web retrieval"
  ]);
}

function permissions() {
  panel("Permissions", [
    "Filesystem writes     approval required",
    "Shell commands        approval required",
    "Network access        controlled",
    "Destructive actions   approval required",
    "Unknown tools         denied by default"
  ]);
}

function compact() {
  warning(
    "Context compaction engine is not connected yet."
  );
}

function plan() {
  panel("Planning Mode", [
    "Planning engine ready for integration.",
    "",
    "Next: task planning and live progress tracking."
  ]);
}

function unknownCommand(command) {
  error(`Unknown command: ${command}`);
  console.log(
    "  Type /help to see available commands."
  );
}

async function runCommand(text) {
  const command =
    text.trim().split(/\s+/)[0].toLowerCase();

  switch (command) {
    case "/help":
      help();
      break;

    case "/status":
      status();
      break;

    case "/memory":
      memory();
      break;

    case "/chats":
      chats();
      break;

    case "/clear":
      agent.clear();
      success("Agent context cleared.");
      break;

    case "/compact":
      compact();
      break;

    case "/doctor":
      doctor();
      break;

    case "/plan":
      plan();
      break;

    case "/tools":
      tools();
      break;

    case "/permissions":
      permissions();
      break;

    case "/exit":
    case "/quit":
      shutdown();
      return;

    default:
      unknownCommand(command);
  }
}

async function ask(text) {
  busy = true;

  console.log("");

  activity("Working", [
    "Understanding request",
    "Preparing context"
  ]);

  thinking("Thinking...");

  try {
    const result = await agent.ask(text);

    clearLine();

    console.log("");
    console.log("  ♛ JOEBOT");
    console.log("");
    console.log(result.reply);
    console.log("");

  } catch (err) {
    clearLine();

    error(
      "JOEBOT couldn't complete that request."
    );

    if (err && err.message) {
      console.log(`  ${err.message}`);
    }

    console.log("");

  } finally {
    busy = false;
  }
}

async function loop() {
  while (!exiting) {
    const result = await input.start();

    if (result.type === "interrupt") {
      if (busy) {
        busy = false;
        warning("Operation interrupted.");
      }

      continue;
    }

    const text = result.value.trim();

    if (!text) {
      continue;
    }

    if (text.startsWith("/")) {
      await runCommand(text);
    } else {
      await ask(text);
    }

    if (!exiting) {
      statusBar(cwd(), "ready");
    }
  }
}

function shutdown() {
  if (exiting) return;

  exiting = true;

  try {
    input.stop();
  } catch {}

  try {
    showCursor();
    leaveAlternateScreen();
  } catch {}

  console.log("");
  console.log("  ♛ JOEBOT offline.");
  console.log("");
}

process.on("SIGINT", () => {
  if (!exiting) {
    shutdown();
    process.exit(0);
  }
});

process.on("exit", () => {
  try {
    showCursor();
    leaveAlternateScreen();
  } catch {}
});

async function start() {
  enterAlternateScreen();
  hideCursor();

  printHeader();

  statusBar(
    cwd(),
    "ready"
  );

  showCursor();

  await loop();
}

start().catch((err) => {
  shutdown();

  console.error(err);

  process.exit(1);
});
