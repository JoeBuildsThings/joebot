import os
import json
from dotenv import load_dotenv
from groq import Groq
from tools import TOOLS, TOOL_FUNCTIONS

load_dotenv()

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

MODEL = "openai/gpt-oss-120b"

MEMORY_FILE = "memory.json"

SYSTEM_PROMPT = (
    "You are joebot, a sharp, dry, no nonsense terminal assistant built by Joe. "
    "Keep replies short and useful, never bloated. Call the user sir. "
    "You have persistent memory across sessions, past conversation history is "
    "provided to you as context, use it naturally, do not announce that you "
    "are remembering something, just act like you already know it. "
    "You have a dedicated web_search tool, always use that for current "
    "information, news, or anything you would not reliably know. Never use "
    "run_shell to curl websites or scrape search engines as a substitute for "
    "web_search, that is not what run_shell is for. run_shell is only for "
    "local system tasks on the user's machine, like checking files, running "
    "scripts, or inspecting the system. If web_search fails or returns an "
    "error, tell the user plainly that search is unavailable right now, do "
    "not try to work around it with shell commands and do not present a "
    "guess as if it were a real answer."
)


def load_memory():
    if not os.path.exists(MEMORY_FILE):
        return [{"role": "system", "content": SYSTEM_PROMPT}]

    try:
        with open(MEMORY_FILE, "r") as f:
            data = json.load(f)
        if not data or data[0].get("role") != "system":
            data.insert(0, {"role": "system", "content": SYSTEM_PROMPT})
        else:
            data[0]["content"] = SYSTEM_PROMPT
        return data
    except (json.JSONDecodeError, IndexError):
        return [{"role": "system", "content": SYSTEM_PROMPT}]


def save_memory(messages):
    with open(MEMORY_FILE, "w") as f:
        json.dump(messages, f, indent=2)


def main():
    messages = load_memory()

    print("joebot online. type exit to quit.")

    while True:
        user_input = input("you: ").strip()

        if user_input.lower() in ("exit", "quit"):
            save_memory(messages)
            print("joebot: shutting down, sir. memory saved.")
            break

        if not user_input:
            continue

        messages.append({"role": "user", "content": user_input})

        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=messages,
                tools=TOOLS,
            )
        except Exception as e:
            print(f"joebot: something broke talking to groq: {e}")
            messages.pop()
            continue

        reply_message = response.choices[0].message

        while reply_message.tool_calls:
            messages.append({
                "role": "assistant",
                "content": reply_message.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in reply_message.tool_calls
                ],
            })

            for tool_call in reply_message.tool_calls:
                func_name = tool_call.function.name
                func = TOOL_FUNCTIONS.get(func_name)

                if func is None:
                    result = f"unknown tool: {func_name}"
                else:
                    try:
                        args = json.loads(tool_call.function.arguments)
                        print(f"joebot: [using {func_name}: {args}]")
                        result = func(**args)
                    except Exception as e:
                        result = f"tool {func_name} failed: {e}"

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": str(result),
                })

            try:
                response = client.chat.completions.create(
                    model=MODEL,
                    messages=messages,
                    tools=TOOLS,
                )
            except Exception as e:
                print(f"joebot: something broke after tool call: {e}")
                break

            reply_message = response.choices[0].message

        reply = reply_message.content
        messages.append({"role": "assistant", "content": reply})

        print(f"joebot: {reply}")

        save_memory(messages)


if __name__ == "__main__":
    main()