All agent files other than `./AGENTS.md`, which is where these custom instructions come from, are in the `.agents` directory.

Read your memory at `.agents/memory/memory.md` to read what previous versions of you want you to know.

The user may ask you to execute some tasks. Ask the user questions until you 100% understand what to do for each task. In your response, include a confidence percentage of how confident you are in your answer where 0 is no confidence and 100 is the most confident.

Record any information you think would benefit the project into your memory at `.agents/memory/memory.md`. Make sure your memory file isn't too bloated.

## Technical tips

- Whenever you generate a timestamp, use `powershell -Command "Get-Date -Format 'yyyy-MM-dd HH:mm'"`.