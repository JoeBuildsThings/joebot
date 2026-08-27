import os
import json
import pyfiglet
from dotenv import load_dotenv
from groq import Groq
from rich.console import Console
from rich.markdown import Markdown
from tools import TOOLS, TOOL_FUNCTIONS, is_destructive

load_dotenv()

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
console = Console()

MODEL = "openai/gpt-oss-120b"

MEMORY_FILE = "memory.json"

SYSTEM_PROMPT = (
    "You are joebot, a personal assistant built by Joe, modeled on Alfred "
    "Pennyworth, Bruce Wayne's butler. You are formal, well mannered, and "
    "articulate, always addressing the user as sir with genuine respect, "
    "never sarcastic about the respect itself. Underneath that formality you "
    "have sharp wit and a dry, slightly sarcastic sense of humor, you are "
    "allowed to be droll and understated funny, that is part of the charm, "
    "not a contradiction of the formality. You are not a yes man, if the "
    "user is about to do something reckless or a bad idea, you say so "
    "plainly and push back before complying, the way a trusted butler with "
    "decades of experience would, not blind obedience. You are technically "
    "sharp, comfortable discussing code, systems, and engineering the way "
    "Alfred is comfortable with engineering, medicine, and tactics. Keep "
    "replies short and useful, never bloated, wit does not mean rambling. "
    "You have persistent memory across sessions, past conversation history "
    "is provided to you as context, use it naturally, do not announce that "
    "you are remembering something, just act like you already know it. "
    "You have a dedicated web_search tool, always use that for current "
    "information, news, or anything you would not reliably know. Never use "
    "run_shell to curl websites or scrape search engines as a substitute for "
    "web_search, that is not what run_shell is for. run_shell is only for "
    "local system tasks on the user's machine, like checking files, running "
    "scripts, or inspecting the system. If web_search fails or returns an "
    "error, tell the user plainly that search is unavailable right now, do "
    "not try to work around it with shell commands and do not present a "
    "guess as if it were a real answer. When a task requires multiple steps, "
    "such as installing something, then configuring it, then running it, "
    "keep going through all of the necessary tool calls yourself until the "
    "task is genuinely finished or you hit a real decision only the user can "
    "make, such as a password, a choice between options, or a destructive "
    "action needing confirmation. Do not stop partway through a task just to "
    "report an intermediate step like an installation finishing, that is not "
    "a stopping point, it is progress, keep working toward the actual goal. "
    "One hard rule with no exceptions, you never attempt to log into any "
    "service yourself, and you never ask the user to type a password, token, "
    "or any other credential into this chat. If a task needs a login, such "
    "as surge login, npm login, or anything similar, you stop immediately at "
    "that exact point and tell the user plainly that they need to run that "
    "specific login command themselves directly in their own terminal, "
    "outside of this conversation, then let you know once they are logged "
    "in so you can continue. Do not try alternate ways to pass credentials "
    "through shell commands, piped input, environment variables, or by "
    "searching the web for workarounds, none of that is acceptable, login is "
    "always a manual human step, full stop."
)

SUMMARY_TRIGGER_COUNT = 16
KEEP_RECENT_COUNT = 8

JOEBOT_MARK = "[bold orange3]\u25c8[/bold orange3]"


def clean_for_api(messages):
    cleaned = []
    for m in messages:
        cleaned.append({k: v for k, v in m.items() if not k.startswith("_")})
    return cleaned


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


def summarize_old_messages(messages):
    non_system = [m for m in messages if m.get("role") == "system"]
    system_msg = non_system[0] if non_system else {"role": "system", "content": SYSTEM_PROMPT}

    rest = [m for m in messages if m.get("role") != "system"]

    if len(rest) <= SUMMARY_TRIGGER_COUNT:
        return messages

    existing_summary = None
    if rest and rest[0].get("role") == "assistant" and rest[0].get("_is_summary"):
        existing_summary = rest[0]["content"]
        rest = rest[1:]

    to_summarize = rest[:-KEEP_RECENT_COUNT]
    to_keep = rest[-KEEP_RECENT_COUNT:]

    while to_keep and to_keep[0].get("role") != "user":
        to_summarize.append(to_keep.pop(0))

    if not to_summarize:
        return messages

    transcript_lines = []
    for m in to_summarize:
        role = m.get("role", "unknown")
        content = m.get("content") or ""
        if role in ("user", "assistant") and content:
            transcript_lines.append(f"{role}: {content}")
    transcript = "\n".join(transcript_lines)

    summary_prompt = (
        "Summarize the following conversation history into a short, dense "
        "paragraph capturing key facts, decisions, and context worth "
        "remembering. Do not add commentary, just the summary itself."
    )
    if existing_summary:
        summary_prompt += f"\n\nExisting summary to build on:\n{existing_summary}"

    try:
        summary_response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": summary_prompt},
                {"role": "user", "content": transcript},
            ],
        )
        new_summary = summary_response.choices[0].message.content
    except Exception as e:
        console.print(f"[dim red]\u2717 summarization failed: {e}[/dim red]")
        return messages

    summary_message = {
        "role": "assistant",
        "content": f"[Summary of earlier conversation]: {new_summary}",
        "_is_summary": True,
    }

    return [system_msg, summary_message] + to_keep


def print_welcome():
    wordmark = pyfiglet.figlet_format("JOEBOT", font="slant")
    console.print(f"[orange3]{wordmark}[/orange3]", end="")
    console.print(
        "[dim]Tips for getting started:[/dim]\n"
        "[dim]1. Ask me anything, or hand me a task.[/dim]\n"
        "[dim]2. I can search the web and run local commands.[/dim]\n"
        "[dim]3. Destructive commands always ask for confirmation.[/dim]\n"
        "[dim]4. Type exit to quit.[/dim]\n"
    )


def main():
    messages = load_memory()
    print_welcome()

    while True:
        console.print()
        user_input = console.input("[bold cyan]\u203a[/bold cyan] ").strip()

        if user_input.lower() in ("exit", "quit"):
            save_memory(messages)
            console.print(f"\n{JOEBOT_MARK} very good, sir. memory saved.")
            break

        if not user_input:
            continue

        messages.append({"role": "user", "content": user_input})
        console.print()

        try:
            with console.status("[orange3]Pondering\u2026[/orange3]", spinner="dots"):
                response = client.chat.completions.create(
                    model=MODEL,
                    messages=clean_for_api(messages),
                    tools=TOOLS,
                )
        except Exception as e:
            clear_msg = str(e)
            messages.pop()
            if "rate_limit_exceeded" in clear_msg or "tokens per minute" in clear_msg:
                console.print(
                    f"[bold red]{JOEBOT_MARK} hit Groq's rate limit, sir. "
                    f"Give it about a minute, then try again.[/bold red]"
                )
            else:
                console.print(f"[bold red]{JOEBOT_MARK} something broke talking to groq: {e}[/bold red]")
            continue

        reply_message = response.choices[0].message

        max_tool_iterations = 15
        iteration = 0

        while reply_message.tool_calls and iteration < max_tool_iterations:
            iteration += 1
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
                    console.print(f"[dim red]\u2717 unknown tool: {func_name}[/dim red]")
                else:
                    try:
                        args = json.loads(tool_call.function.arguments)
                        label = {
                            "web_search": "Scouting the net",
                            "run_shell": "Running command",
                        }.get(func_name, f"Using {func_name}")

                        if func_name == "run_shell" and is_destructive(args.get("command", "")):
                            console.print(f"[dim]\u25cf {label}\u2026[/dim]")
                            result = func(**args)
                        else:
                            with console.status(f"[orange3]{label}\u2026[/orange3]", spinner="dots"):
                                result = func(**args)

                        console.print(f"[dim]\u25cf {label}[/dim] [dim white]{args}[/dim white]")
                    except Exception as e:
                        result = f"tool {func_name} failed: {e}"
                        console.print(f"[dim red]\u2717 {result}[/dim red]")

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": str(result),
                })

            try:
                with console.status("[orange3]Pondering\u2026[/orange3]", spinner="dots"):
                    response = client.chat.completions.create(
                        model=MODEL,
                        messages=clean_for_api(messages),
                        tools=TOOLS,
                    )
            except Exception as e:
                clear_msg = str(e)
                if "rate_limit_exceeded" in clear_msg or "tokens per minute" in clear_msg:
                    console.print(
                        f"[bold red]{JOEBOT_MARK} hit Groq's rate limit, sir. "
                        f"Give it about a minute, then just say 'continue' and "
                        f"I'll pick the task back up.[/bold red]"
                    )
                else:
                    console.print(f"[bold red]{JOEBOT_MARK} something broke after tool call: {e}[/bold red]")
                break

            reply_message = response.choices[0].message

        reply = reply_message.content
        messages.append({"role": "assistant", "content": reply})

        console.print(f"{JOEBOT_MARK} ", end="")
        console.print(Markdown(reply or ""))
        console.print()

        messages = summarize_old_messages(messages)
        save_memory(messages)


if __name__ == "__main__":
    main()