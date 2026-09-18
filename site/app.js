// app.js - Public Jira Board Dashboard Client Logic

let jiraData = null;
let filteredIssues = [];
let activeView = 'kanban'; // 'kanban' | 'table'

// Elements
const boardTitleEl = document.getElementById('board-title');
const projectKeyEl = document.getElementById('project-key');
const boardIdEl = document.getElementById('board-id');
const lastUpdatedEl = document.getElementById('last-updated');
const mockBadgeEl = document.getElementById('mock-badge');
const liveBadgeEl = document.getElementById('live-badge');
const jiraBoardLinkEl = document.getElementById('jira-board-link');

const metricTotalEl = document.getElementById('metric-total');
const metricTodoEl = document.getElementById('metric-todo');
const metricInprogressEl = document.getElementById('metric-inprogress');
const metricDoneEl = document.getElementById('metric-done');
const metricPercentEl = document.getElementById('metric-percent');
const progressDoneEl = document.getElementById('progress-done');
const progressInprogressEl = document.getElementById('progress-inprogress');

const searchInputEl = document.getElementById('search-input');
const filterStatusEl = document.getElementById('filter-status');
const filterAssigneeEl = document.getElementById('filter-assignee');
const filterTypeEl = document.getElementById('filter-type');
const filterPriorityEl = document.getElementById('filter-priority');
const resetFiltersEl = document.getElementById('reset-filters');
const filteredCountEl = document.getElementById('filtered-count');
const totalCountEl = document.getElementById('total-count');

const kanbanViewEl = document.getElementById('kanban-view');
const tableViewEl = document.getElementById('table-view');
const viewKanbanBtn = document.getElementById('view-kanban-btn');
const viewTableBtn = document.getElementById('view-table-btn');

const colIssuesTodo = document.getElementById('col-issues-todo');
const colIssuesInprogress = document.getElementById('col-issues-inprogress');
const colIssuesDone = document.getElementById('col-issues-done');
const colCountTodo = document.getElementById('col-count-todo');
const colCountInprogress = document.getElementById('col-count-inprogress');
const colCountDone = document.getElementById('col-count-done');
const tableBody = document.getElementById('table-body');

// Modal Elements
const issueModal = document.getElementById('issue-modal');
const modalBackdrop = document.getElementById('modal-backdrop');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalKey = document.getElementById('modal-key');
const modalType = document.getElementById('modal-type');
const modalSummary = document.getElementById('modal-summary');
const modalStatus = document.getElementById('modal-status');
const modalPriority = document.getElementById('modal-priority');
const modalAssignee = document.getElementById('modal-assignee');
const modalSprint = document.getElementById('modal-sprint');
const modalUpdated = document.getElementById('modal-updated');
const modalLabels = document.getElementById('modal-labels');
const modalJiraLink = document.getElementById('modal-jira-link');

// Helpers
function formatRelativeTime(isoString) {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSeconds = Math.floor((now - date) / 1000);

    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  } catch (e) {
    return isoString;
  }
}

function getPriorityBadgeClass(priority) {
  const p = (priority || '').toLowerCase();
  if (p.includes('highest') || p.includes('blocker')) return 'badge-highest';
  if (p.includes('high') || p.includes('critical')) return 'badge-high';
  if (p.includes('medium')) return 'badge-medium';
  if (p.includes('low')) return 'badge-low';
  return 'badge-lowest';
}

function getTypeIcon(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('bug')) return 'bug';
  if (t.includes('story')) return 'bookmark';
  if (t.includes('release')) return 'milestone';
  if (t.includes('spike') || t.includes('research')) return 'lightbulb';
  return 'check-square';
}

// Data loading
async function loadData() {
  try {
    const res = await fetch('data/jira_data.json?v=' + Date.now());
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    jiraData = await res.json();
    initApp();
  } catch (err) {
    console.error('Failed to load jira_data.json:', err);
    boardTitleEl.textContent = 'Failed to load Jira data';
    lastUpdatedEl.textContent = 'Error loading data';
  }
}

function initApp() {
  const meta = jiraData.metadata || {};
  const issues = jiraData.issues || [];

  // Update header
  if (meta.title) boardTitleEl.textContent = meta.title;
  
  const projectMetaWrap = document.getElementById('project-meta-wrap');
  const boardMetaWrap = document.getElementById('board-meta-wrap');
  const boardMetaSep = document.getElementById('board-meta-sep');
  const jiraLinkContainer = document.getElementById('jira-link-container');
  const jiraLinkSep = document.getElementById('jira-link-sep');

  if (meta.project_key) {
    projectKeyEl.textContent = meta.project_key;
  } else if (projectMetaWrap) {
    projectMetaWrap.classList.add('hidden');
    if (boardMetaSep) boardMetaSep.classList.add('hidden');
  }

  if (meta.board_id) {
    boardIdEl.textContent = meta.board_id;
  } else if (boardMetaWrap) {
    boardMetaWrap.classList.add('hidden');
    if (boardMetaSep) boardMetaSep.classList.add('hidden');
  }

  if (meta.last_updated_utc) {
    lastUpdatedEl.textContent = formatRelativeTime(meta.last_updated_utc);
    lastUpdatedEl.title = new Date(meta.last_updated_utc).toLocaleString();
  }

  if (meta.base_url) {
    if (meta.board_id && meta.project_key) {
      jiraBoardLinkEl.href = `${meta.base_url}/jira/software/c/projects/${meta.project_key}/boards/${meta.board_id}`;
    } else if (meta.project_key) {
      jiraBoardLinkEl.href = `${meta.base_url}/browse/${meta.project_key}`;
    } else {
      jiraBoardLinkEl.href = meta.base_url;
    }
  } else if (jiraLinkContainer) {
    jiraLinkContainer.classList.add('hidden');
    if (jiraLinkSep) jiraLinkSep.classList.add('hidden');
  }

  // Badges
  if (meta.is_mock) {
    mockBadgeEl.classList.remove('hidden');
    liveBadgeEl.classList.add('hidden');
  } else {
    mockBadgeEl.classList.add('hidden');
    liveBadgeEl.classList.remove('hidden');
  }

  // Populate Dropdown Filters
  populateFilters(issues);

  // Initial Filter Application
  applyFilters();

  // Attach Event Listeners
  attachEvents();

  if (window.lucide) {
    lucide.createIcons();
  }
}

function populateFilters(issues) {
  const statuses = new Set();
  const assignees = new Set();
  const types = new Set();
  const priorities = new Set();

  issues.forEach(issue => {
    if (issue.status) statuses.add(issue.status);
    if (issue.assignee) assignees.add(issue.assignee);
    if (issue.issue_type) types.add(issue.issue_type);
    if (issue.priority) priorities.add(issue.priority);
  });

  const addOptions = (selectEl, items) => {
    Array.from(items).sort().forEach(item => {
      const opt = document.createElement('option');
      opt.value = item;
      opt.textContent = item;
      selectEl.appendChild(opt);
    });
  };

  addOptions(filterStatusEl, statuses);
  addOptions(filterAssigneeEl, assignees);
  addOptions(filterTypeEl, types);
  addOptions(filterPriorityEl, priorities);
}

function applyFilters() {
  if (!jiraData) return;

  const query = searchInputEl.value.trim().toLowerCase();
  const statusFilter = filterStatusEl.value;
  const assigneeFilter = filterAssigneeEl.value;
  const typeFilter = filterTypeEl.value;
  const priorityFilter = filterPriorityEl.value;

  filteredIssues = (jiraData.issues || []).filter(issue => {
    // Search query
    if (query) {
      const matchKey = (issue.key || '').toLowerCase().includes(query);
      const matchSummary = (issue.summary || '').toLowerCase().includes(query);
      const matchAssignee = (issue.assignee || '').toLowerCase().includes(query);
      const matchLabel = (issue.labels || []).some(l => l.toLowerCase().includes(query));
      if (!matchKey && !matchSummary && !matchAssignee && !matchLabel) return false;
    }

    // Status filter
    if (statusFilter && issue.status !== statusFilter) return false;

    // Assignee filter
    if (assigneeFilter && issue.assignee !== assigneeFilter) return false;

    // Type filter
    if (typeFilter && issue.issue_type !== typeFilter) return false;

    // Priority filter
    if (priorityFilter && issue.priority !== priorityFilter) return false;

    return true;
  });

  updateMetrics();
  renderViews();
}

function updateMetrics() {
  const total = filteredIssues.length;
  const allTotal = (jiraData.issues || []).length;

  const todo = filteredIssues.filter(i => i.status_category === 'new').length;
  const inprogress = filteredIssues.filter(i => i.status_category === 'indeterminate').length;
  const done = filteredIssues.filter(i => i.status_category === 'done').length;

  metricTotalEl.textContent = total;
  metricTodoEl.textContent = todo;
  metricInprogressEl.textContent = inprogress;
  metricDoneEl.textContent = done;

  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  metricPercentEl.textContent = `${percent}%`;

  const doneWidth = total > 0 ? (done / total) * 100 : 0;
  const inprogressWidth = total > 0 ? (inprogress / total) * 100 : 0;
  progressDoneEl.style.width = `${doneWidth}%`;
  progressInprogressEl.style.width = `${inprogressWidth}%`;

  filteredCountEl.textContent = total;
  totalCountEl.textContent = allTotal;

  colCountTodo.textContent = todo;
  colCountInprogress.textContent = inprogress;
  colCountDone.textContent = done;
}

function renderViews() {
  if (activeView === 'kanban') {
    renderKanban();
  } else {
    renderTable();
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

function createCardHTML(issue) {
  const priorityClass = getPriorityBadgeClass(issue.priority);
  const typeIcon = getTypeIcon(issue.issue_type);
  const avatarHTML = issue.assignee_avatar
    ? `<img src="${issue.assignee_avatar}" alt="${issue.assignee}" class="w-5 h-5 rounded-full object-cover ring-1 ring-slate-700" />`
    : `<div class="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-300">${issue.assignee ? issue.assignee.charAt(0) : '?'}</div>`;

  const labelsHTML = (issue.labels || []).slice(0, 2).map(l =>
    `<span class="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700/50">${l}</span>`
  ).join('');

  return `
    <div class="issue-card bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 cursor-pointer shadow-sm" data-id="${issue.id}">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-1.5">
          <i data-lucide="${typeIcon}" class="w-3.5 h-3.5 text-slate-400"></i>
          <span class="font-mono text-xs font-semibold text-blue-400 hover:underline">${issue.key}</span>
        </div>
        <span class="text-[10px] font-medium px-2 py-0.5 rounded-full ${priorityClass}">
          ${issue.priority}
        </span>
      </div>

      <p class="text-xs font-medium text-slate-200 line-clamp-2 leading-relaxed mb-3">
        ${issue.summary}
      </p>

      <div class="flex items-center justify-between pt-2 border-t border-slate-800/80">
        <div class="flex items-center gap-1.5 text-slate-400 text-xs">
          ${avatarHTML}
          <span class="text-[11px] truncate max-w-[90px]">${issue.assignee || 'Unassigned'}</span>
        </div>
        <div class="flex items-center gap-1">
          ${labelsHTML}
        </div>
      </div>
    </div>
  `;
}

function renderKanban() {
  colIssuesTodo.innerHTML = '';
  colIssuesInprogress.innerHTML = '';
  colIssuesDone.innerHTML = '';

  const todoIssues = filteredIssues.filter(i => i.status_category === 'new');
  const inprogressIssues = filteredIssues.filter(i => i.status_category === 'indeterminate');
  const doneIssues = filteredIssues.filter(i => i.status_category === 'done');

  const renderCol = (container, issues) => {
    if (issues.length === 0) {
      container.innerHTML = `<div class="text-center py-10 text-xs text-slate-500 italic">No issues</div>`;
      return;
    }
    container.innerHTML = issues.map(createCardHTML).join('');
  };

  renderCol(colIssuesTodo, todoIssues);
  renderCol(colIssuesInprogress, inprogressIssues);
  renderCol(colIssuesDone, doneIssues);

  // Attach card click handlers
  document.querySelectorAll('.issue-card').forEach(card => {
    card.addEventListener('click', () => {
      const issueId = card.getAttribute('data-id');
      const issue = jiraData.issues.find(i => i.id === issueId);
      if (issue) openModal(issue);
    });
  });
}

function renderTable() {
  if (filteredIssues.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-500 italic">No matching issues found</td></tr>`;
    return;
  }

  tableBody.innerHTML = filteredIssues.map(issue => {
    const priorityClass = getPriorityBadgeClass(issue.priority);
    const typeIcon = getTypeIcon(issue.issue_type);
    const updatedTime = formatRelativeTime(issue.updated);

    return `
      <tr class="hover:bg-slate-800/40 transition cursor-pointer issue-row" data-id="${issue.id}">
        <td class="px-4 py-3 font-mono font-semibold text-blue-400 whitespace-nowrap">${issue.key}</td>
        <td class="px-4 py-3 whitespace-nowrap">
          <div class="flex items-center gap-1.5 text-slate-300">
            <i data-lucide="${typeIcon}" class="w-3.5 h-3.5 text-slate-400"></i>
            <span>${issue.issue_type}</span>
          </div>
        </td>
        <td class="px-4 py-3 font-medium text-slate-200 max-w-xs truncate">${issue.summary}</td>
        <td class="px-4 py-3 whitespace-nowrap">
          <span class="px-2 py-0.5 rounded text-[11px] bg-slate-800 border border-slate-700 text-slate-300 font-medium">
            ${issue.status}
          </span>
        </td>
        <td class="px-4 py-3 whitespace-nowrap">
          <span class="px-2 py-0.5 rounded text-[10px] font-medium ${priorityClass}">
            ${issue.priority}
          </span>
        </td>
        <td class="px-4 py-3 whitespace-nowrap text-slate-300">
          <div class="flex items-center gap-2">
            ${issue.assignee_avatar ? `<img src="${issue.assignee_avatar}" class="w-4 h-4 rounded-full" />` : ''}
            <span>${issue.assignee || 'Unassigned'}</span>
          </div>
        </td>
        <td class="px-4 py-3 whitespace-nowrap text-slate-400 text-[11px]">${updatedTime}</td>
        <td class="px-4 py-3 text-right whitespace-nowrap">
          <a href="${issue.jira_url}" target="_blank" rel="noopener noreferrer" class="text-slate-400 hover:text-blue-400 transition" title="Open in Jira" onclick="event.stopPropagation()">
            <i data-lucide="external-link" class="w-4 h-4 inline"></i>
          </a>
        </td>
      </tr>
    `;
  }).join('');

  document.querySelectorAll('.issue-row').forEach(row => {
    row.addEventListener('click', () => {
      const issueId = row.getAttribute('data-id');
      const issue = jiraData.issues.find(i => i.id === issueId);
      if (issue) openModal(issue);
    });
  });
}

function openModal(issue) {
  modalKey.textContent = issue.key;
  modalType.textContent = issue.issue_type;
  modalSummary.textContent = issue.summary;
  modalStatus.textContent = issue.status;
  modalPriority.textContent = issue.priority;
  modalSprint.textContent = issue.sprint || 'None';
  modalUpdated.textContent = issue.updated ? new Date(issue.updated).toLocaleString() : 'N/A';
  modalJiraLink.href = issue.jira_url;

  if (issue.assignee) {
    modalAssignee.innerHTML = `
      ${issue.assignee_avatar ? `<img src="${issue.assignee_avatar}" class="w-5 h-5 rounded-full" />` : ''}
      <span>${issue.assignee}</span>
    `;
  } else {
    modalAssignee.textContent = 'Unassigned';
  }

  if (issue.labels && issue.labels.length > 0) {
    modalLabels.innerHTML = issue.labels.map(l =>
      `<span class="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300 border border-slate-700">${l}</span>`
    ).join('');
  } else {
    modalLabels.innerHTML = `<span class="text-slate-500">None</span>`;
  }

  issueModal.classList.remove('hidden');
}

function closeModal() {
  issueModal.classList.add('hidden');
}

function attachEvents() {
  // Search & Filter change events
  searchInputEl.addEventListener('input', applyFilters);
  filterStatusEl.addEventListener('change', applyFilters);
  filterAssigneeEl.addEventListener('change', applyFilters);
  filterTypeEl.addEventListener('change', applyFilters);
  filterPriorityEl.addEventListener('change', applyFilters);

  resetFiltersEl.addEventListener('click', () => {
    searchInputEl.value = '';
    filterStatusEl.value = '';
    filterAssigneeEl.value = '';
    filterTypeEl.value = '';
    filterPriorityEl.value = '';
    applyFilters();
  });

  // View switchers
  viewKanbanBtn.addEventListener('click', () => {
    activeView = 'kanban';
    viewKanbanBtn.className = 'flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md bg-blue-600 text-white transition-all shadow-sm';
    viewTableBtn.className = 'flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md text-slate-400 hover:text-slate-200 transition-all';
    kanbanViewEl.classList.remove('hidden');
    tableViewEl.classList.add('hidden');
    renderViews();
  });

  viewTableBtn.addEventListener('click', () => {
    activeView = 'table';
    viewTableBtn.className = 'flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md bg-blue-600 text-white transition-all shadow-sm';
    viewKanbanBtn.className = 'flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md text-slate-400 hover:text-slate-200 transition-all';
    tableViewEl.classList.remove('hidden');
    kanbanViewEl.classList.add('hidden');
    renderViews();
  });

  // Modal events
  modalCloseBtn.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', closeModal);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

// Start
document.addEventListener('DOMContentLoaded', loadData);
