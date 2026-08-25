import os
import json
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

MODEL = "openai/gpt-oss-120b"

MEMORY_FILE = "memory.json"

SYSTEM_PROMPT = (
    "You are joebot, a sharp, dry, no nonsense terminal assistant built by Joe. "
    "Keep replies short and useful, never bloated. Call the user sir. "
    "You have persistent memory across sessions, past conversation history is "
    "provided to you as context, use it naturally, do not announce that you "
    "are remembering something, just act like you already know it."
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
            )
        except Exception as e:
            print(f"joebot: something broke talking to groq: {e}")
            messages.pop()
            continue

        reply = response.choices[0].message.content
        messages.append({"role": "assistant", "content": reply})

        print(f"joebot: {reply}")

        save_memory(messages)


if __name__ == "__main__":
    main()