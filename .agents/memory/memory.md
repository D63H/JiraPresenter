# Agent Memory

*Last Updated: 2026-11-04 16:40*

## Project Overview
- **Name**: Jira Public Presenter
- **Purpose**: Zero-cost, automated pipeline to fetch issues from any Jira Cloud instance and host an interactive, responsive dashboard on GitHub Pages.
- **Audience**: Generic open-source template usable by anyone, not tied to any single organization.
- **Primary Display Target**: Big Office Monitor / Wallboard TV (high-contrast, large text, digital clock).

## Architecture & Security
- **Credentials**: Stored exclusively in **GitHub Secrets** (`JIRA_BASE_URL`, `JIRA_USER_EMAIL`, `JIRA_API_TOKEN`). Never committed to Git.
- **Git Security**: `.env` is strictly ignored in `.gitignore`. Committed `site/data/jira_data.json` contains generic demo issues (`DEMO-101`, etc.) to prevent exposing private company ticket titles when pushed to public GitHub repositories.
- **CI/CD**: `.github/workflows/sync-and-deploy.yml` runs weekdays at 10:05 AM America/New_York (timezone-aware across daylight saving time) and supports manual `workflow_dispatch`. Runs `scripts/fetch_jira.py` and deploys `site/` to GitHub Pages; actions use Node 24-compatible majors. It hashes the sanitized payload without `last_updated_utc` and caches the fingerprint only after successful deployment. Scheduled runs skip Pages deployment on a match; push/manual runs still deploy, and cache misses publish.

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
- The Team Focus header is a compact light status bar with project identity and clock, without a brand badge or visible refresh countdown. Keep the main heading free of decorative eyebrow text and retain background JSON polling so an open wallboard picks up new deployments.
- Carousel navigation uses matching icon-only buttons with accessible labels and tooltips; avoid asymmetric arrow/text layouts.
- `compact-grid.html` is an optional All Tickets status grid linked from the Team Focus footer.
- **Shared Wallboard Engine (`tv-common.js`)**:
  - Live digital clock (HH:MM:SS) and date.
  - In-browser polling re-fetches the deployed static `data/jira_data.json` with a visual countdown; it does not query Jira. New Jira data requires the workflow to fetch and redeploy the site.
  - Configurable in-browser refresh interval (defaults to 180 min / 3 hours, configurable via UI selector or `?refresh=180` URL param).
- Team Focus derives its roster from assignees in the sanitized issue export. Each in-progress issue is grouped by its actual assignee and rolled up to the highest Jira parent, regardless of ancestor status or assignee. Parent cards use a text-only “Working toward” cue and a bottom progress bar for completed descendants / all descendants; omit count lines, status pills, and child rows. The footer’s `Updated` timestamp uses browser-local `yyyy-MM-dd HH:mm` (24-hour) formatting. The fetcher follows parent links missing from the configured query and adds a sanitized `parent_chain` only to in-progress issues. It fetches descendant statuses in batches and publishes only completion/total counts, without changing issue totals or creating roster entries; progress-query failures warn and omit only the bar, preserving parent chains. Rejected batched parent queries retry individually. A live Jira fetch failure must fail the action rather than return success with stale data. Its shareable layouts use `view=carousel|overview` and `layout=side-by-side|stacked`; keep the stacked grid rule outside responsive media queries. Missing active tickets can still reflect `JIRA_JQL`/board scope; a corrected query restored PD-838 and PD-1445 without a code change. Keep parent fields allowlisted; use synthetic fixtures and do not inspect `.env` or generated Jira data during code changes.
- The wallboard layouts share a light palette in `style.css`, with dark utility colors remapped for readable bright-room display.

## Agent Guidelines & Rules
- Always include a confidence percentage (`0% - 100%`) in responses.
- Ask questions until 100% understood before undertaking tasks.
- Standard timestamp generation: `powershell -Command "Get-Date -Format 'yyyy-MM-dd HH:mm'"`.
- Keep this memory file concise and focused on high-value facts.
