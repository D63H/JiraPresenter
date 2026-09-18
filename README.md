# Jira Public Presenter 📊

[![GitHub Pages](https://img.shields.io/badge/Hosted%20on-GitHub%20Pages-blue?logo=github)](https://pages.github.com/)
[![GitHub Actions](https://img.shields.io/badge/Sync-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white)](https://github.com/features/actions)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Cost](https://img.shields.io/badge/Cost-$0%20(100%25%20Free)-emerald)](#)

A generic, automated, and **100% free** open-source solution to pull issues from **any Jira Cloud instance** and publish an interactive, responsive public dashboard to **GitHub Pages**.

- 🌐 **Works for Anyone**: Fully configurable for any organization, Jira Cloud domain, project, or board.
- 💰 **Zero Hosting or Server Costs**: Uses free GitHub Actions runners and free GitHub Pages static web hosting.
- 🔒 **Privacy & Credential Security**: Your Jira credentials and API tokens stay encrypted in **GitHub Secrets** and are never committed or exposed publicly.
- 🔄 **Periodic Automated Sync**: Synchronizes periodically on a schedule (e.g., hourly via cron) and includes a one-click manual refresh button.
- 🎯 **Flexible Data Queries**:
  - Fetch by **Board ID** (Scrum or Kanban)
  - Fetch by **Project Key**
  - Fetch by **Custom JQL Query** (e.g., filter by release versions, epics, labels, or multi-project queries)
- 🗂️ **Dual View Dashboard**: Kanban Board columns (To Do / In Progress / Done) and a sortable, searchable Table View.
- ⚡ **Instant Client-side Search & Filtering**: Filter by status, assignee, issue type, priority, and text search.
- 🛡️ **Sanitized Public Data**: Strips internal comments, user emails, and attachments, exposing only public-safe fields (Key, Summary, Status, Type, Priority, Assignee Display Name, Sprint, and Updated Date).

---

## Architecture

```
 Any Jira Cloud Instance
 (https://<your-domain>.atlassian.net)
                   │
                   ▼  (Periodic Cron / On-demand via GitHub Actions)
 ┌────────────────────────────────────────────────────────┐
 │ GitHub Actions Runner (Free)                           │
 │   • Authenticates securely using GitHub Secrets        │
 │   • Queries Jira REST API (Agile Board or JQL)         │
 │   • Sanitizes and exports to site/data/jira_data.json  │
 └────────────────────────────────────────────────────────┘
                   │
                   ▼  (Static Deployment)
 GitHub Pages (Free Public Web Dashboard)
   https://<your-github-username>.github.io/<repo-name>/
```

---

## 🚀 Quick Setup Guide (Takes ~3 Minutes)

### Step 1: Fork or Push this Repository to GitHub
1. Fork this repository on GitHub (or create a new GitHub repo and push this codebase):
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Jira presenter"
   git branch -M main
   git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO_NAME>.git
   git push -u origin main
   ```

---

### Step 2: Create your Atlassian API Token
1. Log in to your Atlassian account.
2. Visit **[Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)**.
3. Click **Create API token**, give it a label (e.g. `github-jira-presenter`), and copy the token string.
> 💡 *Keep this token private. You will only paste it into GitHub Secrets.*

---

### Step 3: Configure GitHub Secrets
In your GitHub repository:
1. Go to **Settings** -> **Secrets and variables** -> **Actions**.
2. Click **New repository secret** and add your configuration:

| Secret Name | Description | Example | Required? |
|-------------|-------------|---------|-----------|
| `JIRA_BASE_URL` | Your Jira Cloud URL | `https://mycompany.atlassian.net` | **Yes** |
| `JIRA_USER_EMAIL` | Your Atlassian account email | `jane.doe@mycompany.com` | **Yes** |
| `JIRA_API_TOKEN` | Atlassian API Token from Step 2 | `...` | **Yes** |
| `JIRA_BOARD_ID` | Your Agile/Kanban Board ID *(optional)* | `101` | Optional |
| `JIRA_PROJECT_KEY` | Project Key *(optional)* | `PROJ` | Optional |
| `JIRA_JQL` | Custom JQL Query *(optional)* | `project = "PROJ" AND status != "Cancelled"` | Optional |
| `SITE_TITLE` | Custom title shown in header *(optional)* | `Product Public Roadmap` | Optional |

> 📌 **Tip on Query Options:** You can supply `JIRA_BOARD_ID` (found in your Jira board URL `/boards/<id>`), a `JIRA_PROJECT_KEY`, or an explicit `JIRA_JQL` query. If `JIRA_JQL` is provided, it takes highest precedence.

---

### Step 4: Enable GitHub Pages
1. In your GitHub repository, go to **Settings** -> **Pages**.
2. Under **Build and deployment** -> **Source**, select **GitHub Actions**.

---

### Step 5: Trigger Initial Deployment
1. Go to the **Actions** tab in your GitHub repository.
2. Select **Sync Jira & Deploy to GitHub Pages** in the left sidebar.
3. Click **Run workflow** -> **Run workflow**.
4. In under 1 minute, your dashboard will be live at:
   `https://<YOUR_USERNAME>.github.io/<YOUR_REPO_NAME>/`

The dashboard will now automatically sync every hour via GitHub Actions!

---

## 💻 Local Development & Testing

You can run and test both the fetch script and the frontend locally.

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Run with Mock Data (No credentials required)
```bash
python scripts/fetch_jira.py --mock
```

### 3. Run with Live Jira Data
Copy `.env.example` to `.env` (strictly ignored by `.gitignore`):
```bash
cp .env.example .env
```
Fill in your details in `.env`:
```env
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_USER_EMAIL=your-email@example.com
JIRA_API_TOKEN=your_token
JIRA_BOARD_ID=123
JIRA_PROJECT_KEY=PROJ
SITE_TITLE=Team Sprint Board
```
Run the fetcher:
```bash
python scripts/fetch_jira.py
```

### 4. Preview the Website Locally
Start any static web server:
```bash
# Using Python
python -m http.server 8000 --directory site

# Or using Node
npx serve site
```
Open `http://localhost:8000` in your browser.

---

## 📁 Repository Structure

```
├── .github/
│   └── workflows/
│       └── sync-and-deploy.yml    # Generic hourly sync & GitHub Pages deployment
├── scripts/
│   └── fetch_jira.py              # Generic Jira Cloud REST API extractor & sanitizer
├── site/
│   ├── index.html                 # Responsive dashboard UI (Kanban + Table)
│   ├── style.css                  # Custom styling and animations
│   ├── app.js                     # Dynamic data rendering, filters & modals
│   └── data/
│       └── jira_data.json         # Sanitized issue data generated by fetch_jira.py
├── .env.example                   # Generic environment template
├── .gitignore                     # Prevents secrets/environment files from being committed
├── requirements.txt               # Lightweight Python dependencies (requests, python-dotenv)
└── README.md                      # Documentation
```

---

## ⚖️ License
This project is open-source under the [MIT License](LICENSE). Feel free to fork, customize, and adapt it for your team!
