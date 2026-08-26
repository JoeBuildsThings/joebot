import os
import subprocess
import requests
from dotenv import load_dotenv

load_dotenv()

TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY")


def web_search(query):
    if not TAVILY_API_KEY:
        return "web search unavailable, no tavily api key set."

    try:
        response = requests.post(
            "https://api.tavily.com/search",
            json={
                "api_key": TAVILY_API_KEY,
                "query": query,
                "max_results": 5,
            },
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        return f"web search failed: {e}"

    results = data.get("results", [])
    if not results:
        return "no results found."

    formatted = []
    for r in results:
        title = r.get("title", "untitled")
        url = r.get("url", "")
        content = r.get("content", "")[:300]
        formatted.append(f"{title}\n{url}\n{content}")

    return "\n\n".join(formatted)


DESTRUCTIVE_PATTERNS = [
    "rm ",
    "rm-",
    "rmdir",
    "mv ",
    "dd ",
    "mkfs",
    "chmod 000",
    "chmod -r 000",
    "shred",
    ":(){:|:&};:",
    "sudo",
    "> /dev",
    "git push --force",
    "git reset --hard",
    "truncate",
]


def is_destructive(command):
    lowered = command.lower()
    return any(pattern in lowered for pattern in DESTRUCTIVE_PATTERNS)


def run_shell(command):
    if is_destructive(command):
        print(f"\njoebot wants to run a DESTRUCTIVE command:\n  {command}\n")
        confirm = input(
            "type CONFIRM in caps to allow this, anything else cancels: "
        ).strip()
        if confirm != "CONFIRM":
            return "command cancelled by user, did not run."

    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
        output = result.stdout.strip()
        error = result.stderr.strip()

        response = ""
        if output:
            response += f"stdout:\n{output}\n"
        if error:
            response += f"stderr:\n{error}\n"
        if not output and not error:
            response = "command ran with no output."

        response += f"exit code: {result.returncode}"
        return response

    except subprocess.TimeoutExpired:
        return "command timed out after 30 seconds."
    except Exception as e:
        return f"command failed to run: {e}"


TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": (
                "Search the live web for current information, news, prices, "
                "or anything the model would not know from training data."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "the search query",
                    }
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_shell",
            "description": (
                "Run a shell command on the user's Linux machine and return "
                "stdout, stderr, and exit code. Destructive commands require "
                "user confirmation before running, this is handled automatically, "
                "you do not need to ask permission yourself, just call the tool."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "the exact shell command to run",
                    }
                },
                "required": ["command"],
            },
        },
    },
]

TOOL_FUNCTIONS = {
    "web_search": web_search,
    "run_shell": run_shell,
}