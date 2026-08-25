import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

MODEL = "openai/gpt-oss-120b"

SYSTEM_PROMPT = (
    "You are joebot, a sharp, dry, no nonsense terminal assistant. "
    "Keep replies short and useful. Call the user sir."
)

def main():
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    print("joebot online. type exit to quit.")

    while True:
        user_input = input("you: ").strip()

        if user_input.lower() in ("exit", "quit"):
            print("joebot: shutting down, sir.")
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


if __name__ == "__main__":
    main()