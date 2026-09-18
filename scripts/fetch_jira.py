#!/usr/bin/env python3
"""
fetch_jira.py
Generic Jira Cloud issue extractor for static dashboards on GitHub Pages.
Works with any Jira Cloud instance, board, project, or custom JQL filter.
"""

import os
import sys
import json
import argparse
from datetime import datetime, timezone
import requests
from requests.auth import HTTPBasicAuth

# Optional dotenv for local development
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def get_mock_data(site_title="Sprint & Kanban Roadmap", base_url="https://example.atlassian.net", project_key="DEMO", board_id="1"):
    """Generates realistic generic mock data for demonstration and preview."""
    now = datetime.now(timezone.utc).isoformat()
    return {
        "metadata": {
            "title": site_title or f"{project_key} Board",
            "board_id": board_id,
            "project_key": project_key,
            "board_type": "kanban",
            "last_updated_utc": now,
            "is_mock": True,
            "base_url": base_url
        },
        "stats": {
            "total": 9,
            "todo": 3,
            "in_progress": 3,
            "done": 3
        },
        "issues": [
            {
                "id": "10001",
                "key": f"{project_key}-101",
                "summary": "Implement responsive navigation bar and mobile menu",
                "status": "In Progress",
                "status_category": "indeterminate",
                "status_category_name": "In Progress",
                "issue_type": "Story",
                "priority": "High",
                "assignee": "Alex Mercer",
                "assignee_avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64&h=64&fit=crop&crop=faces",
                "created": "2026-09-10T14:30:00.000Z",
                "updated": "2026-09-17T18:22:00.000Z",
                "labels": ["frontend", "ui/ux"],
                "sprint": f"{project_key} Sprint 12",
                "jira_url": f"{base_url}/browse/{project_key}-101"
            },
            {
                "id": "10002",
                "key": f"{project_key}-102",
                "summary": "Optimize database query performance on customer dashboard",
                "status": "In Progress",
                "status_category": "indeterminate",
                "status_category_name": "In Progress",
                "issue_type": "Task",
                "priority": "Highest",
                "assignee": "Sarah Connor",
                "assignee_avatar": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=64&h=64&fit=crop&crop=faces",
                "created": "2026-09-12T09:15:00.000Z",
                "updated": "2026-09-17T20:11:00.000Z",
                "labels": ["backend", "performance"],
                "sprint": f"{project_key} Sprint 12",
                "jira_url": f"{base_url}/browse/{project_key}-102"
            },
            {
                "id": "10003",
                "key": f"{project_key}-103",
                "summary": "Fix broken export to CSV/Excel in monthly billing report",
                "status": "To Do",
                "status_category": "new",
                "status_category_name": "To Do",
                "issue_type": "Bug",
                "priority": "High",
                "assignee": "David Kim",
                "assignee_avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop&crop=faces",
                "created": "2026-09-15T11:00:00.000Z",
                "updated": "2026-09-16T10:45:00.000Z",
                "labels": ["reporting", "bug"],
                "sprint": f"{project_key} Sprint 12",
                "jira_url": f"{base_url}/browse/{project_key}-103"
            },
            {
                "id": "10004",
                "key": f"{project_key}-104",
                "summary": "Implement OAuth2 / SSO token refresh logic",
                "status": "In Progress",
                "status_category": "indeterminate",
                "status_category_name": "In Progress",
                "issue_type": "Story",
                "priority": "Medium",
                "assignee": "Elena Rostova",
                "assignee_avatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=faces",
                "created": "2026-09-14T08:20:00.000Z",
                "updated": "2026-09-17T19:05:00.000Z",
                "labels": ["security", "auth"],
                "sprint": f"{project_key} Sprint 12",
                "jira_url": f"{base_url}/browse/{project_key}-104"
            },
            {
                "id": "10005",
                "key": f"{project_key}-105",
                "summary": "Research WebSockets for live status notifications",
                "status": "To Do",
                "status_category": "new",
                "status_category_name": "To Do",
                "issue_type": "Spike",
                "priority": "Low",
                "assignee": None,
                "assignee_avatar": None,
                "created": "2026-09-16T15:30:00.000Z",
                "updated": "2026-09-16T15:30:00.000Z",
                "labels": ["research", "realtime"],
                "sprint": f"{project_key} Sprint 12",
                "jira_url": f"{base_url}/browse/{project_key}-105"
            },
            {
                "id": "10006",
                "key": f"{project_key}-106",
                "summary": "Add Cypress end-to-end test suite for user checkout flow",
                "status": "To Do",
                "status_category": "new",
                "status_category_name": "To Do",
                "issue_type": "Task",
                "priority": "Medium",
                "assignee": "David Kim",
                "assignee_avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop&crop=faces",
                "created": "2026-09-13T10:00:00.000Z",
                "updated": "2026-09-15T12:00:00.000Z",
                "labels": ["qa", "testing"],
                "sprint": f"{project_key} Sprint 12",
                "jira_url": f"{base_url}/browse/{project_key}-106"
            },
            {
                "id": "10007",
                "key": f"{project_key}-107",
                "summary": "Release v2.4.0 to production staging environment",
                "status": "Done",
                "status_category": "done",
                "status_category_name": "Done",
                "issue_type": "Release",
                "priority": "High",
                "assignee": "Alex Mercer",
                "assignee_avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64&h=64&fit=crop&crop=faces",
                "created": "2026-09-08T09:00:00.000Z",
                "updated": "2026-09-17T16:00:00.000Z",
                "labels": ["devops", "release"],
                "sprint": f"{project_key} Sprint 12",
                "jira_url": f"{base_url}/browse/{project_key}-107"
            },
            {
                "id": "10008",
                "key": f"{project_key}-108",
                "summary": "Fix mobile layout overflow on small screen devices",
                "status": "Done",
                "status_category": "done",
                "status_category_name": "Done",
                "issue_type": "Bug",
                "priority": "Medium",
                "assignee": "Sarah Connor",
                "assignee_avatar": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=64&h=64&fit=crop&crop=faces",
                "created": "2026-09-11T13:40:00.000Z",
                "updated": "2026-09-16T17:30:00.000Z",
                "labels": ["mobile", "frontend"],
                "sprint": f"{project_key} Sprint 12",
                "jira_url": f"{base_url}/browse/{project_key}-108"
            },
            {
                "id": "10009",
                "key": f"{project_key}-109",
                "summary": "Update developer API documentation for third-party webhooks",
                "status": "Done",
                "status_category": "done",
                "status_category_name": "Done",
                "issue_type": "Documentation",
                "priority": "Low",
                "assignee": "Elena Rostova",
                "assignee_avatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=faces",
                "created": "2026-09-09T16:15:00.000Z",
                "updated": "2026-09-15T14:10:00.000Z",
                "labels": ["docs", "api"],
                "sprint": f"{project_key} Sprint 12",
                "jira_url": f"{base_url}/browse/{project_key}-109"
            }
        ]
    }


def parse_issue(issue, base_url):
    """Sanitizes raw Jira issue object into safe public dictionary."""
    fields = issue.get("fields", {})
    
    # Status & category
    status_obj = fields.get("status") or {}
    status_name = status_obj.get("name", "Unknown")
    cat_obj = status_obj.get("statusCategory") or {}
    category_key = cat_obj.get("key", "new")  # 'new' (To Do), 'indeterminate' (In Progress), 'done' (Done)
    category_name = cat_obj.get("name", "To Do")

    # Issue type
    type_obj = fields.get("issuetype") or {}
    issue_type = type_obj.get("name", "Task")

    # Priority
    priority_obj = fields.get("priority") or {}
    priority = priority_obj.get("name", "Medium")

    # Assignee (only public display name and avatar)
    assignee_obj = fields.get("assignee")
    assignee_name = assignee_obj.get("displayName") if assignee_obj else None
    assignee_avatar = (
        assignee_obj.get("avatarUrls", {}).get("48x48")
        if assignee_obj
        else None
    )

    # Sprint info if present
    sprint_name = None
    sprint_field = fields.get("sprint")
    if sprint_field and isinstance(sprint_field, dict):
        sprint_name = sprint_field.get("name")
    elif "customfield_10020" in fields and fields["customfield_10020"]:
        # Standard Jira Cloud sprint field
        sprints = fields["customfield_10020"]
        if isinstance(sprints, list) and len(sprints) > 0:
            last_sprint = sprints[-1]
            if isinstance(last_sprint, dict):
                sprint_name = last_sprint.get("name")
            elif isinstance(last_sprint, str) and "name=" in last_sprint:
                for part in last_sprint.split(","):
                    if part.strip().startswith("name="):
                        sprint_name = part.split("=")[1]
                        break

    key = issue.get("key", "")
    jira_url = f"{base_url}/browse/{key}" if key else ""

    return {
        "id": str(issue.get("id", "")),
        "key": key,
        "summary": fields.get("summary", "No summary"),
        "status": status_name,
        "status_category": category_key,
        "status_category_name": category_name,
        "issue_type": issue_type,
        "priority": priority,
        "assignee": assignee_name,
        "assignee_avatar": assignee_avatar,
        "created": fields.get("created"),
        "updated": fields.get("updated"),
        "labels": fields.get("labels", []),
        "sprint": sprint_name,
        "jira_url": jira_url
    }


def fetch_from_jira(base_url, email, token, board_id=None, project_key=None, custom_jql=None, site_title=None):
    """Pulls issues from Jira Cloud REST API using Agile Board or JQL."""
    base_url = base_url.rstrip("/")
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json"
    }
    
    # Configure Authentication
    if email:
        auth = HTTPBasicAuth(email, token)
    else:
        # Bearer token fallback if personal access token used
        headers["Authorization"] = f"Bearer {token}"
        auth = None

    print(f"Connecting to Jira Cloud at {base_url}...")

    board_name = site_title or "Jira Board"
    board_type = "kanban"

    # 1. Fetch Board Info if board_id provided
    if board_id:
        board_url = f"{base_url}/rest/agile/1.0/board/{board_id}"
        try:
            r = requests.get(board_url, auth=auth, headers=headers, timeout=15)
            if r.status_code == 200:
                bdata = r.json()
                board_name = site_title or bdata.get("name", board_name)
                board_type = bdata.get("type", board_type)
                print(f"Discovered board: {board_name} (Type: {board_type})")
            else:
                print(f"Agile board endpoint returned HTTP {r.status_code}. Proceeding with JQL query...")
        except Exception as e:
            print(f"Board metadata query notice: {e}")

    # 2. Fetch Board Issues (Agile API or JQL search)
    raw_issues = []
    start_at = 0
    max_results = 50
    total = None

    # 2. Fetch Issues (Agile API or JQL Search)
    raw_issues = []
    fields_to_request = "summary,status,issuetype,priority,assignee,created,updated,labels,sprint,customfield_10020"

    # Determine query strategy
    use_agile_api = bool(board_id and not custom_jql)

    if use_agile_api:
        # Agile Board Issue Endpoint (uses startAt pagination)
        start_at = 0
        max_results = 50
        while True:
            endpoint = f"{base_url}/rest/agile/1.0/board/{board_id}/issue"
            params = {
                "startAt": start_at,
                "maxResults": max_results,
                "fields": fields_to_request
            }
            print(f"Fetching board batch: startAt={start_at}...")
            resp = requests.get(endpoint, auth=auth, headers=headers, params=params, timeout=20)
            if resp.status_code != 200:
                print(f"Agile board endpoint returned HTTP {resp.status_code}. Switching to JQL search...")
                use_agile_api = False
                break
            data = resp.json()
            issues_batch = data.get("issues", [])
            raw_issues.extend(issues_batch)
            total = data.get("total", len(raw_issues))
            start_at += len(issues_batch)
            if start_at >= total or len(issues_batch) == 0:
                break

    if not use_agile_api:
        # JQL Search Endpoint (/rest/api/3/search/jql with nextPageToken pagination)
        if custom_jql:
            jql_query = custom_jql
        elif project_key:
            jql_query = f'project = "{project_key}" ORDER BY Rank ASC'
        elif board_id:
            jql_query = 'ORDER BY Rank ASC'
        else:
            jql_query = 'ORDER BY updated DESC'

        print(f"Executing JQL query: {jql_query}")

        next_page_token = None
        batch_num = 1
        max_results = 50

        # Jira Cloud uses /rest/api/3/search/jql (token-based pagination)
        search_endpoint = f"{base_url}/rest/api/3/search/jql"

        while True:
            params = {
                "jql": jql_query,
                "maxResults": max_results,
                "fields": fields_to_request
            }
            if next_page_token:
                params["nextPageToken"] = next_page_token

            print(f"Fetching JQL batch #{batch_num}...")
            resp = requests.get(search_endpoint, auth=auth, headers=headers, params=params, timeout=20)

            # If /rest/api/3/search/jql 404s (e.g. older Jira Server/Data Center), fallback to legacy /rest/api/2/search
            if resp.status_code in (404, 405) and search_endpoint.endswith("/search/jql"):
                print("Endpoint /rest/api/3/search/jql not available, falling back to /rest/api/2/search...")
                search_endpoint = f"{base_url}/rest/api/2/search"
                continue

            if resp.status_code != 200:
                error_detail = ""
                try:
                    err_json = resp.json()
                    error_msgs = err_json.get("errorMessages", [])
                    field_errors = err_json.get("errors", {})
                    error_detail = f" Jira error: {error_msgs} {field_errors}".strip()
                except Exception:
                    error_detail = f" Jira response: {resp.text[:200]}"
                raise RuntimeError(f"HTTP {resp.status_code} querying Jira JQL: {error_detail}")

            data = resp.json()
            issues_batch = data.get("issues", [])
            raw_issues.extend(issues_batch)

            is_last = data.get("isLast", False)
            next_page_token = data.get("nextPageToken")

            # Check termination
            if is_last or not next_page_token or len(issues_batch) == 0:
                break

            batch_num += 1

    print(f"Successfully retrieved {len(raw_issues)} issues.")

    # 3. Sanitize and structure data
    parsed_issues = [parse_issue(issue, base_url) for issue in raw_issues]

    # Calculate statistics
    todo_count = sum(1 for i in parsed_issues if i["status_category"] == "new")
    inprogress_count = sum(1 for i in parsed_issues if i["status_category"] == "indeterminate")
    done_count = sum(1 for i in parsed_issues if i["status_category"] == "done")

    now = datetime.now(timezone.utc).isoformat()
    return {
        "metadata": {
            "title": board_name,
            "board_id": board_id or "",
            "project_key": project_key or "",
            "board_type": board_type,
            "last_updated_utc": now,
            "is_mock": False,
            "base_url": base_url
        },
        "stats": {
            "total": len(parsed_issues),
            "todo": todo_count,
            "in_progress": inprogress_count,
            "done": done_count
        },
        "issues": parsed_issues
    }


def main():
    parser = argparse.ArgumentParser(description="Fetch issues from Jira Cloud for GitHub Pages")
    parser.add_argument("--mock", action="store_true", help="Generate mock data without connecting to Jira")
    parser.add_argument("--output", default="site/data/jira_data.json", help="Path to write JSON output")
    args = parser.parse_args()

    # Read environment variables (generic configuration)
    base_url = os.environ.get("JIRA_BASE_URL", "").strip()
    email = os.environ.get("JIRA_USER_EMAIL", "").strip()
    token = os.environ.get("JIRA_API_TOKEN", "").strip()
    board_id = os.environ.get("JIRA_BOARD_ID", "").strip() or None
    project_key = os.environ.get("JIRA_PROJECT_KEY", "").strip() or None
    custom_jql = os.environ.get("JIRA_JQL", "").strip() or None
    site_title = os.environ.get("SITE_TITLE", "").strip() or None

    os.makedirs(os.path.dirname(args.output), exist_ok=True)

    if args.mock:
        print("Mock flag passed: generating generic sample data...")
        data = get_mock_data(site_title=site_title or "Project Roadmap", base_url=base_url or "https://example.atlassian.net", project_key=project_key or "DEMO", board_id=board_id or "1")
    elif not token or not base_url:
        print("Notice: JIRA_BASE_URL or JIRA_API_TOKEN not configured.")
        print("Generating mock preview data so the static site can be browsed immediately.")
        print("To fetch live Jira data, set JIRA_BASE_URL, JIRA_USER_EMAIL, and JIRA_API_TOKEN in GitHub Secrets or .env.")
        data = get_mock_data(site_title=site_title or "Project Roadmap", base_url=base_url or "https://example.atlassian.net", project_key=project_key or "DEMO", board_id=board_id or "1")
    else:
        try:
            data = fetch_from_jira(
                base_url=base_url,
                email=email,
                token=token,
                board_id=board_id,
                project_key=project_key,
                custom_jql=custom_jql,
                site_title=site_title
            )
        except Exception as e:
            print(f"Error fetching live data from Jira: {e}", file=sys.stderr)
            print("Falling back to existing or mock data so deployment does not fail...")
            if os.path.exists(args.output):
                print(f"Preserving existing {args.output}")
                return
            data = get_mock_data(site_title=site_title or "Project Roadmap", base_url=base_url, project_key=project_key or "DEMO", board_id=board_id or "1")

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Successfully wrote {len(data.get('issues', []))} issues to {args.output}")


if __name__ == "__main__":
    main()
