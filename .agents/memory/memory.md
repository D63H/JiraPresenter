# Agent Memory

*Last Updated: 2026-09-24 10:00*

## Project Overview
- **Name**: Jira Public Presenter
- **Purpose**: Zero-cost, automated pipeline to fetch issues from any Jira Cloud instance and host an interactive, responsive dashboard on GitHub Pages.
- **Audience**: Generic open-source template usable by anyone, not tied to any single organization.
- **Primary Display Target**: Big Office Monitor / Wallboard TV (high-contrast, large text, digital clock).

## Architecture & Security
- **Credentials**: Stored exclusively in **GitHub Secrets** (`JIRA_BASE_URL`, `JIRA_USER_EMAIL`, `JIRA_API_TOKEN`). Never committed to Git.
- **Git Security**: `.env` is strictly ignored in `.gitignore`. Committed `site/data/jira_data.json` contains generic demo issues (`DEMO-101`, etc.) to prevent exposing private company ticket titles when pushed to public GitHub repositories.
- **CI/CD**: `.github/workflows/sync-and-deploy.yml` runs every 3 hours (`0 */3 * * *`) and supports manual `workflow_dispatch`. Runs `scripts/fetch_jira.py` and deploys `site/` to GitHub Pages.

## Jira Cloud REST API Discoveries
- **Auth**: Uses HTTP Basic Auth (`email:token`). Also supports Bearer tokens if personal access tokens are supplied without email.
- **Endpoints**:
  - Agile Board: `/rest/agile/1.0/board/{board_id}/issue` (uses `startAt` offset pagination).
  - JQL Search: `/rest/api/3/search/jql` (Atlassian sunset `/rest/api/3/search` with 410 Gone; the new endpoint uses `nextPageToken` cursor pagination and `isLast` flag).
- **Status Categories**: Map Jira `fields.status.statusCategory.key`:
  - `new` -> To Do
  - `indeterminate` -> In Progress
  - `done` -> Done

## Frontend & Wallboard Modes (`site/`)
- Designed specifically for 1080p and 4K Wallboards and Big Monitors.
- `index.html` is the primary Team Focus page, with a large-text carousel and team overview, grouped by Jira assignee and active parent hierarchy. The carousel rotates assignees; URL parameters choose the view and ticket layout.
- The Team Focus header is intentionally a compact light status bar; retain project identity, refresh countdown, and clock without restoring a tall brand/navigation header.
- Carousel navigation uses matching icon-only buttons with accessible labels and tooltips; avoid asymmetric arrow/text layouts.
- `compact-grid.html` is an optional All Tickets status grid linked from the Team Focus footer.
- **Shared Wallboard Engine (`tv-common.js`)**:
  - Live digital clock (HH:MM:SS) and date.
  - In-browser silent background polling from `data/jira_data.json` with visual countdown.
  - Configurable in-browser refresh interval (defaults to 180 min / 3 hours, configurable via UI selector or `?refresh=180` URL param).
- Team Focus derives its roster from assignees in the sanitized export and rolls active issues up through in-progress parents. Its shareable layouts use `view=carousel|overview` and `layout=side-by-side|stacked`; the stacked grid rule must be outside responsive media queries to work on desktop. Missing active tickets can be caused by `JIRA_JQL`/board scope; a corrected query restored PD-838 and PD-1445 without a code change. Keep parent fields allowlisted; use synthetic fixtures for UI tests and do not inspect `.env` or generated Jira data during code changes.
- The wallboard layouts share a light palette in `style.css`, with dark utility colors remapped for readable bright-room display.

## Agent Guidelines & Rules
- Always include a confidence percentage (`0% - 100%`) in responses.
- Ask questions until 100% understood before undertaking tasks.
- Standard timestamp generation: `powershell -Command "Get-Date -Format 'yyyy-MM-dd HH:mm'"`.
- Keep this memory file concise and focused on high-value facts.
