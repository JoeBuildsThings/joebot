const state = {
  chats: [],
  currentChat: null,
  loading: false
};

const $ = selector => document.querySelector(selector);

const chatList = $("#chatList");
const messages = $("#messages");
const messageInput = $("#messageInput");
const sendButton = $("#sendButton");
const newChatButton = $("#newChat");

const sidebar = $("#sidebar");
const sidebarBackdrop = $("#sidebarBackdrop");
const openSidebarButton = $("#openSidebar");
const closeSidebarButton = $("#closeSidebar");

const desktopChatTitle = $("#desktopChatTitle");
const moreButton = $("#moreButton");


// ============================================================
// API
// ============================================================

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || "Request failed"
    );
  }

  return data;
}


// ============================================================
// CHATS
// ============================================================

async function loadChats() {
  try {
    state.chats = await api("/api/chats");

    renderChatList();

    if (state.chats.length > 0) {
      await openChat(state.chats[0].id);
    } else {
      renderWelcome();
    }

  } catch (error) {
    console.error("[JOEBOT] Failed to load chats:", error);
    showToast("Couldn't load conversations.");
    renderWelcome();
  }
}


function renderChatList() {
  if (!chatList) return;

  chatList.innerHTML = "";

  if (state.chats.length === 0) {
    chatList.innerHTML = `
      <div class="history-empty">
        No conversations yet
      </div>
    `;
    return;
  }

  for (const chat of state.chats) {
    const item = document.createElement("div");

    item.className =
      "chat-list-item" +
      (
        state.currentChat?.id === chat.id
          ? " active"
          : ""
      );

    item.innerHTML = `
      <button class="chat-list-main">
        <span class="chat-list-title">
          ${escapeHtml(chat.title || "New conversation")}
        </span>

        <span class="chat-list-time">
          ${formatTime(chat.updatedAt)}
        </span>
      </button>

      <button
        class="chat-delete"
        aria-label="Delete conversation"
        title="Delete conversation"
      >
        ×
      </button>
    `;

    item
      .querySelector(".chat-list-main")
      .addEventListener("click", () => {
        openChat(chat.id);
        closeSidebar();
      });

    item
      .querySelector(".chat-delete")
      .addEventListener("click", event => {
        event.stopPropagation();
        deleteChat(chat.id);
      });

    chatList.appendChild(item);
  }
}


async function createChat() {
  try {
    const chat = await api("/api/chats", {
      method: "POST",
      body: JSON.stringify({})
    });

    state.chats.unshift(chat);
    state.currentChat = chat;

    renderChatList();
    renderMessages();
    updateTitle();

    closeSidebar();

    messageInput?.focus();

  } catch (error) {
    console.error("[JOEBOT] Failed to create chat:", error);
    showToast("Couldn't create a new chat.");
  }
}


async function openChat(id) {
  try {
    const chat = await api(
      `/api/chats/${encodeURIComponent(id)}`
    );

    state.currentChat = chat;

    renderChatList();
    renderMessages();
    updateTitle();

  } catch (error) {
    console.error("[JOEBOT] Failed to open chat:", error);
    showToast("Couldn't open that conversation.");
  }
}


async function deleteChat(id) {
  try {
    await api(
      `/api/chats/${encodeURIComponent(id)}`,
      {
        method: "DELETE"
      }
    );

    state.chats =
      state.chats.filter(chat => chat.id !== id);

    if (state.currentChat?.id === id) {
      state.currentChat = null;

      if (state.chats.length > 0) {
        await openChat(state.chats[0].id);
      } else {
        renderWelcome();
        updateTitle();
      }
    }

    renderChatList();

  } catch (error) {
    console.error("[JOEBOT] Failed to delete chat:", error);
    showToast("Couldn't delete that conversation.");
  }
}


// ============================================================
// MESSAGES
// ============================================================

function renderMessages() {
  if (!messages) return;

  messages.innerHTML = "";

  if (
    !state.currentChat ||
    !Array.isArray(state.currentChat.messages) ||
    state.currentChat.messages.length === 0
  ) {
    renderWelcome();
    return;
  }

  for (const message of state.currentChat.messages) {
    addMessageBubble(
      message.role,
      message.content,
      message.timestamp
    );
  }

  scrollToBottom();
}


function renderWelcome() {
  if (!messages) return;

  messages.innerHTML = `
    <div class="welcome" id="welcome">

      <div class="welcome-logo">
        J
      </div>

      <h1>How can I help?</h1>

      <p>
        Your personal AI for coding, projects,
        questions and everyday work.
      </p>

      <div class="quick-actions">

        <button
          class="quick-action"
          data-message="Help me with some code"
        >
          <span>⌘</span>
          <div>
            <strong>Help me code</strong>
            <small>Debug or build something</small>
          </div>
        </button>

        <button
          class="quick-action"
          data-message="Help me understand my project"
        >
          <span>◇</span>
          <div>
            <strong>Work on a project</strong>
            <small>Plan, build or debug</small>
          </div>
        </button>

        <button
          class="quick-action"
          data-message="Check JOEBOT system status"
        >
          <span>●</span>
          <div>
            <strong>System status</strong>
            <small>Check the assistant</small>
          </div>
        </button>

      </div>

    </div>
  `;

  messages
    .querySelectorAll(".quick-action")
    .forEach(button => {
      button.addEventListener("click", () => {
        messageInput.value =
          button.dataset.message;

        autoResize();
        messageInput.focus();
      });
    });
}


function addMessageBubble(
  role,
  content,
  timestamp
) {
  const row =
    document.createElement("div");

  row.className =
    `message-row ${role}`;

  const bubble =
    document.createElement("div");

  bubble.className =
    "message-bubble";

  bubble.innerHTML =
    formatMessage(content);

  if (timestamp) {
    const time =
      document.createElement("span");

    time.className = "message-time";

    time.textContent =
      formatTime(timestamp);

    bubble.appendChild(time);
  }

  row.appendChild(bubble);
  messages.appendChild(row);
}


function showTyping() {
  hideTyping();

  const row =
    document.createElement("div");

  row.id = "typingIndicator";
  row.className =
    "message-row assistant";

  row.innerHTML = `
    <div class="message-bubble typing">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;

  messages.appendChild(row);

  scrollToBottom();
}


function hideTyping() {
  $("#typingIndicator")?.remove();
}


// ============================================================
// SEND
// ============================================================

async function sendMessage() {
  const message =
    messageInput.value.trim();

  if (!message || state.loading) {
    return;
  }

  if (!state.currentChat) {
    await createChat();
  }

  if (!state.currentChat) {
    return;
  }

  state.loading = true;

  sendButton.disabled = true;
  messageInput.disabled = true;

  messageInput.value = "";
  autoResize();

  addMessageBubble(
    "user",
    message,
    new Date().toISOString()
  );

  scrollToBottom();
  showTyping();

  try {
    const result = await api(
      `/api/chats/${encodeURIComponent(
        state.currentChat.id
      )}/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          message
        })
      }
    );

    hideTyping();

    state.currentChat =
      result.chat;

    const index =
      state.chats.findIndex(
        chat =>
          chat.id ===
          state.currentChat.id
      );

    if (index !== -1) {
      state.chats[index] =
        state.currentChat;
    }

    addMessageBubble(
      "assistant",
      result.reply,
      new Date().toISOString()
    );

    updateTitle();
    renderChatList();
    scrollToBottom();

  } catch (error) {
    hideTyping();

    console.error(
      "[JOEBOT] Message error:",
      error
    );

    addMessageBubble(
      "assistant",
      "I couldn't complete that request right now.",
      new Date().toISOString()
    );

    showToast(error.message);

  } finally {
    state.loading = false;

    sendButton.disabled = false;
    messageInput.disabled = false;

    messageInput.focus();
  }
}


// ============================================================
// SIDEBAR
// ============================================================

function openSidebar() {
  sidebar?.classList.add("open");
  sidebarBackdrop?.classList.add("show");

  document.body.classList.add("sidebar-open");
}


function closeSidebar() {
  sidebar?.classList.remove("open");
  sidebarBackdrop?.classList.remove("show");

  document.body.classList.remove("sidebar-open");
}


// ============================================================
// MEMORY
// ============================================================

async function loadMemory() {
  const memoryList =
    $("#memoryList");

  if (!memoryList) return;

  try {
    const data =
      await api("/api/memory");

    if (!data.memories?.length) {
      memoryList.innerHTML = `
        <div class="memory-empty">
          JOEBOT doesn't remember anything yet.
        </div>
      `;

      return;
    }

    memoryList.innerHTML =
      data.memories
        .map(
          (memory, index) => `
            <div class="memory-item">
              <span>
                ${escapeHtml(memory)}
              </span>

              <button
                class="memory-delete"
                data-index="${index}"
                aria-label="Delete memory"
              >
                ×
              </button>
            </div>
          `
        )
        .join("");

    memoryList
      .querySelectorAll(".memory-delete")
      .forEach(button => {
        button.addEventListener(
          "click",
          async () => {
            await api(
              `/api/memory/${button.dataset.index}`,
              {
                method: "DELETE"
              }
            );

            loadMemory();
          }
        );
      });

  } catch (error) {
    console.error(
      "[JOEBOT] Memory error:",
      error
    );

    memoryList.innerHTML = `
      <div class="memory-empty">
        Couldn't load memory.
      </div>
    `;
  }
}


function openMemory() {
  const modal =
    $("#memoryModal");

  if (!modal) return;

  modal.classList.remove("hidden");

  loadMemory();
}


function closeMemory() {
  $("#memoryModal")
    ?.classList.add("hidden");
}


async function clearAllMemory() {
  try {
    await api("/api/memory", {
      method: "DELETE"
    });

    loadMemory();
    showToast("All memories cleared.");

  } catch (error) {
    showToast("Couldn't clear memory.");
  }
}


// ============================================================
// STATUS
// ============================================================

async function showStatus() {
  try {
    const status =
      await api("/api/status");

    showToast(
      `JOEBOT is ${status.status}. ${status.providers.length} AI providers connected.`
    );

  } catch {
    showToast("JOEBOT status unavailable.");
  }
}


// ============================================================
// UI HELPERS
// ============================================================

function updateTitle() {
  if (!desktopChatTitle) return;

  desktopChatTitle.textContent =
    state.currentChat?.title ||
    "New conversation";
}


function scrollToBottom() {
  requestAnimationFrame(() => {
    if (!messages) return;

    messages.scrollTop =
      messages.scrollHeight;
  });
}


function autoResize() {
  if (!messageInput) return;

  messageInput.style.height =
    "auto";

  messageInput.style.height =
    Math.min(
      messageInput.scrollHeight,
      160
    ) + "px";
}


function showToast(message) {
  const container =
    $("#toastContainer");

  if (!container) return;

  const toast =
    document.createElement("div");

  toast.className = "toast";
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("hide");

    setTimeout(
      () => toast.remove(),
      250
    );
  }, 3000);
}


function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function formatMessage(content) {
  let text =
    escapeHtml(content);

  const codeBlocks = [];

  text = text.replace(
    /```(?:[a-zA-Z0-9_+-]+)?\n?([\s\S]*?)```/g,
    (_, code) => {
      const token =
        `___CODEBLOCK_${codeBlocks.length}___`;

      codeBlocks.push(
        `<pre><code>${code.trim()}</code></pre>`
      );

      return token;
    }
  );

  text = text.replace(
    /\*\*(.*?)\*\*/g,
    "<strong>$1</strong>"
  );

  text = text.replace(
    /`([^`]+)`/g,
    "<code>$1</code>"
  );

  text = text.replace(
    /\n/g,
    "<br>"
  );

  codeBlocks.forEach(
    (block, index) => {
      text = text.replace(
        `___CODEBLOCK_${index}___`,
        block
      );
    }
  );

  return text;
}


function formatTime(value) {
  if (!value) return "";

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleTimeString(
    [],
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}


// ============================================================
// EVENTS
// ============================================================

newChatButton?.addEventListener(
  "click",
  createChat
);


openSidebarButton?.addEventListener(
  "click",
  openSidebar
);


closeSidebarButton?.addEventListener(
  "click",
  closeSidebar
);


sidebarBackdrop?.addEventListener(
  "click",
  closeSidebar
);


messageInput?.addEventListener(
  "input",
  autoResize
);


messageInput?.addEventListener(
  "keydown",
  event => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendMessage();
    }
  }
);


sendButton?.addEventListener(
  "click",
  sendMessage
);


$("#memoryButton")?.addEventListener(
  "click",
  () => {
    closeSidebar();
    openMemory();
  }
);


$("#closeMemory")?.addEventListener(
  "click",
  closeMemory
);


$("#clearMemory")?.addEventListener(
  "click",
  clearAllMemory
);


$("#statusButton")?.addEventListener(
  "click",
  () => {
    closeSidebar();
    showStatus();
  }
);


moreButton?.addEventListener(
  "click",
  () => {
    showToast("More controls coming soon.");
  }
);


// Close memory when clicking outside card
$("#memoryModal")?.addEventListener(
  "click",
  event => {
    if (
      event.target.id ===
      "memoryModal"
    ) {
      closeMemory();
    }
  }
);


// ============================================================
// START
// ============================================================

loadChats();
