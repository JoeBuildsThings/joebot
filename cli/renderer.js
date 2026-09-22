const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",

  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",

  gray: "\x1b[90m",
  white: "\x1b[97m"
};

function color(type, text) {
  return `${ANSI[type] || ""}${text}${ANSI.reset}`;
}

function logo() {
  return `${color("cyan", "♛")} ${color("bold", "JOEBOT")}`;
}

function clearScreen() {
  process.stdout.write("\x1b[2J\x1b[H");
}

function moveCursor(row, column) {
  process.stdout.write(`\x1b[${row};${column}H`);
}

function hideCursor() {
  process.stdout.write("\x1b[?25l");
}

function showCursor() {
  process.stdout.write("\x1b[?25h");
}

function enterAlternateScreen() {
  process.stdout.write("\x1b[?1049h");
}

function leaveAlternateScreen() {
  process.stdout.write("\x1b[?1049l");
}

function terminalWidth() {
  return process.stdout.columns || 80;
}

function horizontalLine() {
  return "─".repeat(Math.max(20, Math.min(terminalWidth(), 100)));
}

function header(version, cwd) {
  const width = Math.max(40, Math.min(terminalWidth(), 100));
  const line = "─".repeat(width - 2);

  console.log("");
  console.log(`╭${line}╮`);

  const title = `│ ${logo()}`;
  const versionText = `v${version}`;

  const spaces = Math.max(
    1,
    width - 3 - stripAnsi(title).length - versionText.length
  );

  console.log(
    `${title}${" ".repeat(spaces)}${color("gray", versionText)} │`
  );

  const pathText = `│ ${color("dim", cwd)}`;

  console.log(
    `${pathText}${" ".repeat(
      Math.max(1, width - 2 - stripAnsi(pathText).length)
    )}│`
  );

  console.log(`╰${line}╯`);
  console.log("");
}


function banner(version, cwd = process.cwd()) {
  header(version, cwd);
}

function activity(title, items = []) {
  console.log("");
  console.log(`  ${color("cyan", "◇")} ${title}`);

  items.forEach((item, index) => {
    const last = index === items.length - 1;
    const branch = last ? "└─" : "├─";

    console.log(
      `  ${color("gray", branch)} ${item}`
    );
  });

  console.log("");
}

function thinking(text = "Thinking...") {
  process.stdout.write(
    `\r\x1b[K  ${color("cyan", "◇")} ${text}`
  );
}

function clearLine() {
  process.stdout.write("\r\x1b[K");
}

function success(text) {
  console.log(
    `  ${color("green", "✓")} ${text}`
  );
}

function error(text) {
  console.log(
    `  ${color("red", "✕")} ${text}`
  );
}

function warning(text) {
  console.log(
    `  ${color("yellow", "⚠")} ${text}`
  );
}

function tool(title, body = "") {
  console.log("");
  console.log(
    `  ${color("cyan", "┌─")} ${color("bold", title)}`
  );

  if (body) {
    for (const line of String(body).split("\n")) {
      console.log(
        `  ${color("cyan", "│")} ${line}`
      );
    }
  }

  console.log(
    `  ${color("cyan", "└─")}`
  );

  console.log("");
}

function diff(file, changes) {
  console.log("");
  console.log(
    `  ${color("bold", "Changes proposed")}`
  );
  console.log("");
  console.log(
    `  ${color("cyan", file)}`
  );
  console.log("");

  for (const line of String(changes).split("\n")) {
    if (line.startsWith("+")) {
      console.log(
        `  ${color("green", line)}`
      );
    } else if (line.startsWith("-")) {
      console.log(
        `  ${color("red", line)}`
      );
    } else {
      console.log(`  ${line}`);
    }
  }

  console.log("");
}

function task(title, steps = []) {
  console.log("");
  console.log(
    `  ${color("bold", "Task:")} ${title}`
  );
  console.log("");

  for (const step of steps) {
    let icon = "○";
    let type = "gray";

    if (step.status === "done") {
      icon = "✓";
      type = "green";
    }

    if (step.status === "active") {
      icon = "●";
      type = "cyan";
    }

    console.log(
      `  ${color(type, icon)} ${step.label}`
    );
  }

  console.log("");
}

function statusBar(cwd, state = "ready") {
  console.log("");
  console.log(color("gray", horizontalLine()));

  const stateColor =
    state === "ready"
      ? "green"
      : state === "error"
        ? "red"
        : "yellow";

  console.log(
    `  ${color("dim", cwd)} ${color("gray", "•")} ${color(
      stateColor,
      state
    )}`
  );
}


function statusLine(cwd, state = "ready") {
  statusBar(cwd, state);
}

function promptPrefix() {
  return `${color("cyan", "❯")} `;
}

function renderPrompt(cwd) {
  process.stdout.write(
    `\n${color("gray", cwd)}\n${promptPrefix()}`
  );
}

function panel(title, lines = []) {
  const width = Math.max(
    30,
    Math.min(terminalWidth() - 4, 80)
  );

  const inner = width - 2;

  console.log("");
  console.log(
    `  ┌─ ${title} ${"─".repeat(
      Math.max(0, inner - title.length - 3)
    )}┐`
  );

  for (const line of lines) {
    const text = String(line);
    const visible = stripAnsi(text);

    console.log(
      `  │ ${text}${" ".repeat(
        Math.max(0, inner - visible.length - 1)
      )}│`
    );
  }

  console.log(
    `  └${"─".repeat(inner)}┘`
  );

  console.log("");
}

function stripAnsi(text) {
  return String(text).replace(
    /\x1b\[[0-?]*[ -/]*[@-~]/g,
    ""
  );
}

module.exports = {
  ANSI,
  color,
  logo,
  clearScreen,
  moveCursor,
  hideCursor,
  showCursor,
  enterAlternateScreen,
  leaveAlternateScreen,
  terminalWidth,
  horizontalLine,
  header,
  banner,
  activity,
  thinking,
  clearLine,
  success,
  error,
  warning,
  tool,
  diff,
  task,
  statusBar,
  statusLine,
  promptPrefix,
  renderPrompt,
  panel,
  stripAnsi
};
