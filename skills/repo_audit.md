name: repo_audit
description: Audit a code repository with evidence: structure, dead code, dependencies, secrets, history and ranked findings. Use when asked to review, grill or audit a repo.

Goal: produce a ranked review where every finding is backed by something you observed in this session. Never change files during an audit unless Joe asks.

Steps:
1. Map the repo. Use list_files on the root and each main folder. Read package.json or the build file, and any README.
2. Find the real entry points from the scripts, bin entries and main files.
3. Trace imports from the entry points with search_code to find files nothing reaches. Report them as dead code with their line counts.
4. Compare declared dependencies with what the code imports. Report unused ones, and runtime tools that are listed as dev dependencies.
5. Search for secrets: key shaped strings, tokens, passwords and committed env files. Report file names only, never print secret values.
6. Check history with run_command and a short git log. Note lazy commit messages and big unreviewed dumps.
7. Read the risky code paths in full: anything that runs commands, writes files, handles user input or sends data over a network.
8. Check for tests, CI, lint config and docs. Note what is missing.
9. Rank findings as Critical, High or Medium. For each one give the file, what you saw, why it matters and a concrete fix.
10. Finish with what is genuinely good, using only facts you verified.

Rules:
* If a step could not be completed, say so in the first line of the report.
* Do not guess line numbers or file contents. Use only what a tool returned.
* Keep the report short enough to read on a phone, top findings first.
