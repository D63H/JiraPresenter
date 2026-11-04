from contextlib import redirect_stderr
from io import StringIO
import os
import unittest
from unittest.mock import Mock, patch

import fetch_jira


STATUS_CATEGORIES = {
    "new": {"key": "new", "name": "To Do"},
    "indeterminate": {"key": "indeterminate", "name": "In Progress"},
    "done": {"key": "done", "name": "Done"}
}


def parent_reference(key, summary, category, issue_type, parent=None, assignee=None):
    return {
        "key": key,
        "fields": {
            "summary": summary,
            "status": {
                "name": STATUS_CATEGORIES[category]["name"],
                "statusCategory": STATUS_CATEGORIES[category]
            },
            "issuetype": {"name": issue_type},
            "assignee": {"displayName": assignee} if assignee else None,
            "parent": parent
        }
    }


def raw_issue(key, summary, category, issue_type, parent=None, assignee=None):
    reference = parent_reference(key, summary, category, issue_type, parent, assignee)
    reference["fields"]["description"] = "synthetic field excluded from public output"
    return reference


class DescendantProgressTests(unittest.TestCase):
    @patch("fetch_jira.requests.get")
    def test_omits_progress_when_descendants_cannot_be_loaded(self, get):
        get.return_value = Mock(status_code=403)

        with redirect_stderr(StringIO()):
            progress = fetch_jira.fetch_descendant_progress(
                "https://jira.example",
                "APP-1",
                auth=None,
                headers={"Accept": "application/json"}
            )

        self.assertIsNone(progress)

    @patch("fetch_jira.requests.get")
    def test_jira_rejected_parent_batch_retries_with_single_parent_queries(self, get):
        first_response = Mock(status_code=400)
        first_parent_response = Mock(status_code=200)
        first_parent_response.json.return_value = {
            "issues": [raw_issue("APP-3", "Completed task", "done", "Task")],
            "isLast": True
        }
        second_parent_response = Mock(status_code=200)
        second_parent_response.json.return_value = {
            "issues": [raw_issue("APP-4", "Active task", "indeterminate", "Task")],
            "isLast": True
        }
        get.side_effect = [first_response, first_parent_response, second_parent_response]

        with redirect_stderr(StringIO()):
            children = fetch_jira.fetch_direct_children(
                "https://jira.example",
                ["APP-1", "APP-2"],
                auth=None,
                headers={"Accept": "application/json"}
            )

        self.assertEqual([child["key"] for child in children], ["APP-3", "APP-4"])
        self.assertEqual(
            [call.kwargs["params"]["jql"] for call in get.call_args_list],
            [
                'parent in ("APP-1", "APP-2")',
                'parent = "APP-1"',
                'parent = "APP-2"'
            ]
        )

    @patch("fetch_jira.requests.get")
    def test_query_errors_omit_progress_without_raising(self, get):
        get.return_value = Mock(status_code=400)

        with redirect_stderr(StringIO()):
            progress = fetch_jira.fetch_descendant_progress(
                "https://jira.example",
                "APP-1",
                auth=None,
                headers={"Accept": "application/json"}
            )

        self.assertIsNone(progress)

    @patch("fetch_jira.requests.get")
    def test_counts_completed_tickets_across_all_descendant_levels(self, get):
        children_by_parent = {
            "APP-1": [
                raw_issue("APP-2", "Epic", "done", "Epic"),
                raw_issue("APP-5", "Another Epic", "new", "Epic")
            ],
            "APP-2": [
                raw_issue("APP-3", "Completed task", "done", "Task"),
                raw_issue("APP-4", "Active task", "indeterminate", "Task")
            ]
        }

        def search_children(endpoint, **kwargs):
            jql = kwargs["params"]["jql"]
            if jql.startswith("parent = "):
                parent_keys = [jql.split('"')[1]]
            else:
                parent_keys = [
                    key.strip().strip('"')
                    for key in jql[jql.index("(") + 1:-1].split(",")
                ]
            response = Mock(status_code=200)
            response.json.return_value = {
                "issues": [
                    child
                    for parent_key in parent_keys
                    for child in children_by_parent.get(parent_key, [])
                ],
                "isLast": True
            }
            return response

        get.side_effect = search_children

        progress = fetch_jira.fetch_descendant_progress(
            "https://jira.example",
            "APP-1",
            auth=None,
            headers={"Accept": "application/json"}
        )

        self.assertEqual(progress, {"completed": 2, "total": 4})
        self.assertEqual(get.call_count, 3)
        self.assertEqual(get.call_args_list[0].kwargs["params"]["fields"], "status")
        self.assertEqual(
            get.call_args_list[1].kwargs["params"]["jql"],
            'parent in ("APP-2", "APP-5")'
        )

    @patch("fetch_jira.requests.get")
    def test_follows_jira_search_page_tokens(self, get):
        def search_children(endpoint, **kwargs):
            params = kwargs["params"]
            response = Mock(status_code=200)
            if params["jql"] == 'parent = "APP-1"' and "nextPageToken" not in params:
                response.json.return_value = {
                    "issues": [raw_issue("APP-2", "Task", "done", "Task")],
                    "isLast": False,
                    "nextPageToken": "next-page"
                }
            elif params["jql"] == 'parent = "APP-1"':
                response.json.return_value = {
                    "issues": [raw_issue("APP-3", "Task", "new", "Task")],
                    "isLast": True
                }
            else:
                response.json.return_value = {"issues": [], "isLast": True}
            return response

        get.side_effect = search_children

        progress = fetch_jira.fetch_descendant_progress(
            "https://jira.example",
            "APP-1",
            auth=None,
            headers={"Accept": "application/json"}
        )

        self.assertEqual(progress, {"completed": 1, "total": 2})
        root_query_calls = [
            call for call in get.call_args_list
            if call.kwargs["params"]["jql"] == 'parent = "APP-1"'
        ]
        self.assertEqual(len(root_query_calls), 2)
        self.assertEqual(root_query_calls[1].kwargs["params"]["nextPageToken"], "next-page")


class MainFetchFailureTests(unittest.TestCase):
    def test_live_fetch_failure_preserves_output_but_fails_the_run(self):
        with (
            patch.dict(os.environ, {
                "JIRA_BASE_URL": "https://jira.example",
                "JIRA_USER_EMAIL": "user@example.com",
                "JIRA_API_TOKEN": "synthetic-token"
            }, clear=True),
            patch("sys.argv", ["fetch_jira.py", "--output", "synthetic/data.json"]),
            patch("fetch_jira.os.makedirs"),
            patch("fetch_jira.os.path.exists", return_value=True),
            patch(
                "fetch_jira.fetch_from_jira",
                side_effect=RuntimeError("synthetic request failure")
            ) as fetch,
            redirect_stderr(StringIO())
        ):
            with self.assertRaisesRegex(RuntimeError, "synthetic request failure"):
                fetch_jira.main()

        fetch.assert_called_once()


class ParentChainTests(unittest.TestCase):
    def test_fetches_and_sanitizes_missing_ancestors(self):
        feature_set = raw_issue("APP-1", "Feature Set", "new", "Feature Set")
        epic = raw_issue(
            "APP-2",
            "Epic",
            "new",
            "Epic",
            parent=parent_reference("APP-1", "Feature Set", "new", "Feature Set")
        )
        task = raw_issue(
            "APP-3",
            "Task",
            "indeterminate",
            "Task",
            parent=parent_reference("APP-2", "Epic", "new", "Epic")
        )
        available_ancestors = {"APP-2": epic, "APP-1": feature_set}
        fetched_keys = []

        def fetch_parent(key):
            fetched_keys.append(key)
            return available_ancestors[key]

        chain = fetch_jira.build_parent_chain(task, "https://jira.example", {}, fetch_parent)

        self.assertEqual(fetched_keys, ["APP-2", "APP-1"])
        self.assertEqual([ancestor["key"] for ancestor in chain], ["APP-2", "APP-1"])
        self.assertEqual(chain[1]["issue_type"], "Feature Set")
        self.assertEqual(chain[1]["status"], "To Do")
        self.assertNotIn("description", chain[0])
        self.assertNotIn("assignee", chain[0])

    def test_reuses_exported_ancestors_without_fetching(self):
        feature_set = raw_issue("APP-1", "Feature Set", "new", "Feature Set")
        epic = raw_issue(
            "APP-2",
            "Epic",
            "new",
            "Epic",
            parent=parent_reference("APP-1", "Feature Set", "new", "Feature Set")
        )
        task = raw_issue(
            "APP-3",
            "Task",
            "indeterminate",
            "Task",
            parent=parent_reference("APP-2", "Epic", "new", "Epic")
        )

        def unexpected_fetch(key):
            self.fail(f"unexpected Jira request for exported ancestor {key}")

        chain = fetch_jira.build_parent_chain(
            task,
            "https://jira.example",
            {"APP-2": epic, "APP-1": feature_set},
            unexpected_fetch
        )

        self.assertEqual([ancestor["key"] for ancestor in chain], ["APP-2", "APP-1"])

    @patch("fetch_jira.requests.get")
    def test_fetcher_exports_full_parent_chain_without_counting_ancestors(self, get):
        feature_set = raw_issue("APP-1", "Feature Set", "new", "Feature Set")
        epic = raw_issue(
            "APP-2",
            "Epic",
            "new",
            "Epic",
            parent=parent_reference("APP-1", "Feature Set", "new", "Feature Set")
        )
        task = raw_issue(
            "APP-3",
            "Task",
            "indeterminate",
            "Task",
            parent=parent_reference("APP-2", "Epic", "new", "Epic"),
            assignee="Alex"
        )

        search_response = Mock(status_code=200)
        search_response.json.return_value = {
            "issues": [task],
            "isLast": True
        }
        epic_response = Mock(status_code=200)
        epic_response.json.return_value = epic
        feature_response = Mock(status_code=200)
        feature_response.json.return_value = feature_set
        root_children_response = Mock(status_code=200)
        root_children_response.json.return_value = {"issues": [epic], "isLast": True}
        epic_children_response = Mock(status_code=200)
        epic_children_response.json.return_value = {"issues": [task], "isLast": True}
        task_children_response = Mock(status_code=200)
        task_children_response.json.return_value = {"issues": [], "isLast": True}
        get.side_effect = [
            search_response,
            epic_response,
            feature_response,
            root_children_response,
            epic_children_response,
            task_children_response
        ]

        data = fetch_jira.fetch_from_jira(
            "https://jira.example",
            email="user@example.com",
            token="synthetic-token",
            custom_jql='project = "APP"'
        )

        self.assertEqual(data["stats"]["total"], 1)
        self.assertEqual(data["stats"]["in_progress"], 1)
        self.assertEqual(len(data["issues"]), 1)
        self.assertEqual(
            [parent["key"] for parent in data["issues"][0]["parent_chain"]],
            ["APP-2", "APP-1"]
        )
        self.assertEqual(
            data["issues"][0]["parent_chain"][-1]["descendant_progress"],
            {"completed": 0, "total": 2}
        )

    @patch("fetch_jira.requests.get")
    def test_descendant_progress_failure_does_not_drop_parent_chain(self, get):
        feature_set = raw_issue("APP-1", "Feature Set", "new", "Feature Set")
        epic = raw_issue(
            "APP-2",
            "Epic",
            "new",
            "Epic",
            parent=parent_reference("APP-1", "Feature Set", "new", "Feature Set")
        )
        task = raw_issue(
            "APP-3",
            "Task",
            "indeterminate",
            "Task",
            parent=parent_reference("APP-2", "Epic", "new", "Epic"),
            assignee="Alex"
        )

        search_response = Mock(status_code=200)
        search_response.json.return_value = {"issues": [task], "isLast": True}
        epic_response = Mock(status_code=200)
        epic_response.json.return_value = epic
        feature_response = Mock(status_code=200)
        feature_response.json.return_value = feature_set
        progress_response = Mock(status_code=400)
        get.side_effect = [search_response, epic_response, feature_response, progress_response]

        with redirect_stderr(StringIO()):
            data = fetch_jira.fetch_from_jira(
                "https://jira.example",
                email="user@example.com",
                token="synthetic-token",
                custom_jql='project = "APP"'
            )

        self.assertEqual(
            [parent["key"] for parent in data["issues"][0]["parent_chain"]],
            ["APP-2", "APP-1"]
        )
        self.assertNotIn("descendant_progress", data["issues"][0]["parent_chain"][-1])

    @patch("fetch_jira.requests.get")
    def test_fetches_only_allowlisted_ancestor_fields(self, get):
        response = Mock(status_code=200)
        response.json.return_value = raw_issue("APP-2", "Epic", "new", "Epic")
        get.return_value = response

        issue = fetch_jira.fetch_parent_issue(
            "https://jira.example",
            "APP-2",
            auth=None,
            headers={"Accept": "application/json"}
        )

        self.assertEqual(issue["key"], "APP-2")
        self.assertEqual(get.call_args.args[0], "https://jira.example/rest/api/3/issue/APP-2")
        self.assertEqual(
            get.call_args.kwargs["params"],
            {"fields": "summary,status,issuetype,parent"}
        )


if __name__ == "__main__":
    unittest.main()
