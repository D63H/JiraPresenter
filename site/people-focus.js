(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.TeamFocus = api;
  }
  if (root && root.document) {
    const start = () => api.initialize(root);
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const IN_PROGRESS = 'indeterminate';

  function getWorkListClass(mode, ticketLayout) {
    return mode === 'carousel' && ticketLayout === 'stacked'
      ? 'team-work-list team-work-list-stacked'
      : 'team-work-list';
  }

  function parseViewSettings(search) {
    const parameters = new URLSearchParams(search || '');
    return {
      view: parameters.get('view') === 'overview' ? 'overview' : 'carousel',
      layout: parameters.get('layout') === 'stacked' ? 'stacked' : 'side-by-side'
    };
  }

  function buildViewSettingsUrl(location, view, layout) {
    const parameters = new URLSearchParams(location.search || '');
    parameters.set('view', view);
    parameters.set('layout', layout);
    return `${location.pathname}?${parameters.toString()}${location.hash || ''}`;
  }

  function getIssueKey(issue) {
    return typeof issue.key === 'string' ? issue.key.trim() : '';
  }

  function getParentIssue(issue, issuesByKey, parentContextsByKey) {
    const parentKey = typeof issue.parent_key === 'string' ? issue.parent_key.trim() : '';
    if (!parentKey) {
      return null;
    }

    return issuesByKey.get(parentKey) || parentContextsByKey.get(parentKey) || {
      key: parentKey,
      summary: issue.parent_summary || parentKey,
      issue_type: issue.parent_issue_type || 'Issue',
      status: issue.parent_status || '',
      status_category: issue.parent_status_category || '',
      assignee: issue.parent_assignee || null,
      jira_url: issue.parent_jira_url || ''
    };
  }

  function groupActiveIssues(activeIssues, issuesByKey, parentContextsByKey, activeKeys) {
    const groups = new Map();

    for (const issue of activeIssues) {
      let rootIssue = issue;
      let currentIssue = issue;
      const visitedKeys = new Set([getIssueKey(issue)]);

      while (currentIssue.parent_key) {
        const parentIssue = getParentIssue(currentIssue, issuesByKey, parentContextsByKey);
        const parentKey = parentIssue && getIssueKey(parentIssue);
        if (!parentKey || visitedKeys.has(parentKey)) {
          break;
        }

        rootIssue = parentIssue;
        currentIssue = parentIssue;
        visitedKeys.add(parentKey);
      }

      const rootKey = getIssueKey(rootIssue) || `issue-${groups.size}`;
      let group = groups.get(rootKey);
      if (!group) {
        group = {
          ticket: rootIssue,
          activeIssueCount: 0,
          memberOwnsTicket: activeKeys.has(rootKey)
        };
        groups.set(rootKey, group);
      }
      group.activeIssueCount++;
    }

    return Array.from(groups.values());
  }

  function buildTeamMembers(issues) {
    const issueList = Array.isArray(issues) ? issues.filter(issue => issue && typeof issue === 'object') : [];
    const issuesByKey = new Map();

    for (const issue of issueList) {
      const key = getIssueKey(issue);
      if (key) {
        issuesByKey.set(key, issue);
      }
    }

    const parentContextsByKey = new Map();
    for (const issue of issueList) {
      if (!Array.isArray(issue.parent_chain)) {
        continue;
      }

      for (const parent of issue.parent_chain) {
        const key = parent && typeof parent === 'object' ? getIssueKey(parent) : '';
        if (key && !parentContextsByKey.has(key)) {
          parentContextsByKey.set(key, parent);
        }
      }
    }

    const membersByName = new Map();
    for (const issue of issueList) {
      const name = typeof issue.assignee === 'string' ? issue.assignee.trim() : '';
      if (!name) {
        continue;
      }

      let member = membersByName.get(name);
      if (!member) {
        member = { name, avatar: '', activeIssues: [] };
        membersByName.set(name, member);
      }

      if (!member.avatar && typeof issue.assignee_avatar === 'string') {
        member.avatar = issue.assignee_avatar;
      }
      if (issue.status_category === IN_PROGRESS) {
        member.activeIssues.push(issue);
      }
    }

    return Array.from(membersByName.values())
      .map(member => {
        const activeKeys = new Set(member.activeIssues.map(getIssueKey).filter(Boolean));
        return {
          ...member,
          activeCount: member.activeIssues.length,
          groups: groupActiveIssues(member.activeIssues, issuesByKey, parentContextsByKey, activeKeys)
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  function createElement(document, tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (text !== undefined) {
      element.textContent = text;
    }
    return element;
  }

  function getSafeHttpUrl(value, root) {
    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }

    try {
      const url = new root.URL(value, root.location.href);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
    } catch {
      return null;
    }
  }

  function getIssueUrl(issue, metadata, root) {
    const baseUrl = typeof metadata.base_url === 'string' ? metadata.base_url.replace(/\/+$/, '') : '';
    const fallbackUrl = baseUrl && issue.key
      ? `${baseUrl}/browse/${encodeURIComponent(issue.key)}`
      : '';
    return getSafeHttpUrl(issue.jira_url || fallbackUrl, root);
  }

  function appendIssueKey(container, issue, metadata, root, document) {
    const key = issue.key || issue.id || 'Issue';
    const url = getIssueUrl(issue, metadata, root);

    if (!url) {
      container.appendChild(createElement(document, 'span', 'team-ticket-key', key));
      return;
    }

    const link = createElement(document, 'a', 'team-ticket-key', key);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    container.appendChild(link);
  }

  function createAvatar(member, root, document) {
    const avatarUrl = getSafeHttpUrl(member.avatar, root);
    if (avatarUrl) {
      const image = createElement(document, 'img', 'team-person-avatar');
      image.src = avatarUrl;
      image.alt = '';
      image.loading = 'lazy';
      image.addEventListener('error', () => {
        image.replaceWith(createAvatarInitial(member.name, document));
      }, { once: true });
      return image;
    }

    return createAvatarInitial(member.name, document);
  }

  function createAvatarInitial(name, document) {
    return createElement(document, 'span', 'team-person-avatar team-person-initial', name.charAt(0).toUpperCase());
  }

  function getDescendantProgress(issue) {
    const progress = issue && issue.descendant_progress;
    if (
      !progress ||
      !Number.isSafeInteger(progress.completed) ||
      !Number.isSafeInteger(progress.total) ||
      progress.completed < 0 ||
      progress.total <= 0 ||
      progress.completed > progress.total
    ) {
      return null;
    }

    return {
      completed: progress.completed,
      total: progress.total,
      percent: (progress.completed / progress.total) * 100
    };
  }

  function appendDescendantProgress(card, issue, document) {
    const progress = getDescendantProgress(issue);
    if (!progress) {
      return;
    }

    const bar = createElement(document, 'div', 'team-descendant-progress');
    const label = `${progress.completed} of ${progress.total} descendant tickets complete`;
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', 'Completed descendant tickets');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(progress.total));
    bar.setAttribute('aria-valuenow', String(progress.completed));
    bar.setAttribute('aria-valuetext', `${label} (${Math.round(progress.percent)}%)`);
    bar.title = label;

    const fill = createElement(document, 'span', 'team-descendant-progress-fill');
    fill.setAttribute('aria-hidden', 'true');
    fill.style.width = `${progress.percent}%`;
    bar.appendChild(fill);
    card.appendChild(bar);
  }

  function createTicketCard(group, metadata, root, document) {
    const isParentContext = !group.memberOwnsTicket;
    const cardClass = isParentContext
      ? 'team-ticket-card team-parent-context-card'
      : 'team-ticket-card';
    const card = createElement(document, 'article', cardClass);
    if (isParentContext) {
      card.appendChild(createElement(document, 'p', 'team-context-label', 'Working toward'));
    }

    const headingRow = createElement(document, 'div', 'team-ticket-heading');
    const identity = createElement(document, 'div', 'team-ticket-identity');
    const type = group.ticket.issue_type || 'Issue';
    identity.appendChild(createElement(document, 'span', 'team-ticket-type', type));
    appendIssueKey(identity, group.ticket, metadata, root, document);
    headingRow.appendChild(identity);
    card.appendChild(headingRow);

    card.appendChild(createElement(
      document,
      'h3',
      'team-ticket-summary',
      group.ticket.summary || group.ticket.key || 'No summary'
    ));
    if (isParentContext) {
      appendDescendantProgress(card, group.ticket, document);
    }

    return card;
  }

  function createPersonPanel(person, metadata, mode, root, document, ticketLayout = 'side-by-side') {
    const panelClass = mode === 'carousel'
      ? 'team-person-panel team-carousel-person'
      : 'team-person-panel team-overview-person';
    const panel = createElement(document, 'article', panelClass);
    const header = createElement(document, 'div', 'team-person-header');
    header.appendChild(createAvatar(person, root, document));

    const details = createElement(document, 'div', 'team-person-details');
    details.appendChild(createElement(document, 'h3', 'team-person-name', person.name));
    header.appendChild(details);
    panel.appendChild(header);

    if (person.groups.length === 0) {
      const noWork = createElement(document, 'div', 'team-no-work');
      noWork.appendChild(createElement(document, 'p', '', 'No in-progress tickets right now'));
      panel.appendChild(noWork);
      return panel;
    }

    const workList = createElement(document, 'div', getWorkListClass(mode, ticketLayout));
    for (const group of person.groups) {
      workList.appendChild(createTicketCard(group, metadata, root, document));
    }
    panel.appendChild(workList);
    return panel;
  }

  function initialize(root) {
    const document = root.document;
    if (!document.body || !document.body.classList.contains('team-focus')) {
      return;
    }

    const elements = {
      boardTitle: document.getElementById('board-title'),
      teamMeta: document.getElementById('team-meta'),
      teamSummary: document.getElementById('team-summary'),
      teamError: document.getElementById('team-error'),
      emptyState: document.getElementById('team-empty-state'),
      carouselView: document.getElementById('carousel-view'),
      overviewView: document.getElementById('overview-view'),
      carouselButton: document.getElementById('carousel-view-button'),
      overviewButton: document.getElementById('overview-view-button'),
      personSlide: document.getElementById('person-slide'),
      personPosition: document.getElementById('person-position'),
      personIndicators: document.getElementById('person-indicators'),
      previousButton: document.getElementById('previous-person-button'),
      nextButton: document.getElementById('next-person-button'),
      rotationButton: document.getElementById('toggle-rotation-button'),
      rotationIcon: document.getElementById('rotation-icon'),
      rotationLabel: document.getElementById('rotation-label'),
      sideBySideLayoutButton: document.getElementById('side-by-side-layout-button'),
      stackedLayoutButton: document.getElementById('stacked-layout-button'),
      overviewGrid: document.getElementById('team-overview-grid'),
      lastUpdated: document.getElementById('last-updated')
    };
    if (Object.values(elements).some(element => !element)) {
      console.error('Team Focus page is missing a required element.');
      return;
    }
    elements.carouselView.hidden = true;
    elements.overviewView.hidden = true;

    const initialSettings = parseViewSettings(root.location.search);
    const configuredDuration = Number(root.WALLBOARD_CONFIG && root.WALLBOARD_CONFIG.cycleDurationSeconds);
    const cycleDurationSeconds = Number.isFinite(configuredDuration) && configuredDuration > 0
      ? Math.max(5, configuredDuration)
      : 12;

    let members = [];
    let metadata = {};
    let currentIndex = 0;
    let currentView = initialSettings.view;
    let ticketLayout = initialSettings.layout;
    let rotationPaused = false;
    let rotationTimer = null;

    function stopRotation() {
      if (rotationTimer !== null) {
        root.clearInterval(rotationTimer);
        rotationTimer = null;
      }
    }

    function startRotation() {
      stopRotation();
      if (currentView !== 'carousel' || rotationPaused || members.length < 2 || document.hidden) {
        return;
      }

      rotationTimer = root.setInterval(() => {
        currentIndex = (currentIndex + 1) % members.length;
        renderCarousel();
      }, cycleDurationSeconds * 1000);
    }

    function renderCarousel() {
      elements.sideBySideLayoutButton.setAttribute('aria-pressed', String(ticketLayout === 'side-by-side'));
      elements.stackedLayoutButton.setAttribute('aria-pressed', String(ticketLayout === 'stacked'));
      if (!members.length) {
        elements.personSlide.replaceChildren();
        elements.personPosition.textContent = '0 / 0';
        elements.personIndicators.replaceChildren();
        elements.previousButton.disabled = true;
        elements.nextButton.disabled = true;
        elements.rotationButton.disabled = true;
        return;
      }

      const member = members[currentIndex];
      elements.personSlide.replaceChildren(createPersonPanel(member, metadata, 'carousel', root, document, ticketLayout));
      elements.personPosition.textContent = `${currentIndex + 1} / ${members.length}`;
      elements.previousButton.disabled = members.length < 2;
      elements.nextButton.disabled = members.length < 2;
      elements.rotationButton.disabled = members.length < 2;
      elements.rotationButton.setAttribute('aria-pressed', String(rotationPaused));
      elements.rotationLabel.textContent = rotationPaused ? 'Resume rotation' : 'Pause rotation';
      elements.rotationIcon.textContent = rotationPaused ? '>' : '||';
      elements.personIndicators.replaceChildren();

      members.forEach((person, index) => {
        const indicator = createElement(document, 'button', 'team-person-indicator');
        indicator.type = 'button';
        indicator.setAttribute('aria-label', `Show ${person.name}`);
        indicator.setAttribute('aria-current', String(index === currentIndex));
        indicator.classList.toggle('is-current', index === currentIndex);
        indicator.addEventListener('click', () => setPerson(index));
        elements.personIndicators.appendChild(indicator);
      });
    }

    function renderOverview() {
      elements.overviewGrid.replaceChildren();
      for (const person of members) {
        elements.overviewGrid.appendChild(createPersonPanel(person, metadata, 'overview', root, document));
      }
    }

    function setPerson(index) {
      if (!members.length) {
        return;
      }
      currentIndex = (index + members.length) % members.length;
      renderCarousel();
      startRotation();
    }

    function updateViewSettingsUrl() {
      if (root.history && typeof root.history.replaceState === 'function') {
        root.history.replaceState(
          null,
          '',
          buildViewSettingsUrl(root.location, currentView, ticketLayout)
        );
      }
    }

    function setTicketLayout(layout) {
      ticketLayout = layout;
      if (currentView === 'carousel') {
        renderCarousel();
      }
    }

    function setView(view) {
      currentView = view;
      const isCarousel = view === 'carousel';
      elements.carouselView.hidden = !isCarousel || members.length === 0;
      elements.overviewView.hidden = isCarousel || members.length === 0;
      elements.carouselButton.setAttribute('aria-pressed', String(isCarousel));
      elements.overviewButton.setAttribute('aria-pressed', String(!isCarousel));
      elements.emptyState.hidden = members.length > 0;

      if (isCarousel) {
        renderCarousel();
        startRotation();
      } else {
        stopRotation();
        renderOverview();
      }
    }

    function renderData(data) {
      metadata = data.metadata && typeof data.metadata === 'object' ? data.metadata : {};
      members = buildTeamMembers(data.issues);
      currentIndex = Math.min(currentIndex, Math.max(0, members.length - 1));

      elements.boardTitle.textContent = metadata.title || 'Team Focus';
      const metadataParts = [];
      if (metadata.project_key) {
        metadataParts.push(`Project ${metadata.project_key}`);
      }
      if (metadata.board_id) {
        metadataParts.push(`Board ${metadata.board_id}`);
      }
      elements.teamMeta.textContent = metadataParts.join(' · ') || 'In-progress work by assignee';

      const activeCount = members.reduce((total, member) => total + member.activeCount, 0);
      elements.teamSummary.textContent =
        `${members.length} ${members.length === 1 ? 'teammate' : 'teammates'} · ` +
        `${activeCount} assigned in-progress ${activeCount === 1 ? 'ticket' : 'tickets'}`;

      const updatedAt = metadata.last_updated_utc ? new Date(metadata.last_updated_utc) : null;
      elements.lastUpdated.textContent = updatedAt && !Number.isNaN(updatedAt.getTime())
        ? `Updated ${updatedAt.toLocaleString()}`
        : 'Update time unavailable';

      elements.teamError.hidden = true;
      setView(currentView);
    }

    async function loadData() {
      try {
        const response = await root.fetch(`data/jira_data.json?v=${Date.now()}`);
        if (!response.ok) {
          throw new Error(`Jira data request failed with HTTP ${response.status}`);
        }
        const data = await response.json();
        renderData(data && typeof data === 'object' ? data : {});
      } catch (error) {
        console.error('Failed to load Jira data:', error);
        elements.teamError.textContent = 'Could not load Jira data. Check the exported data file and try again.';
        elements.teamError.hidden = false;
        if (!members.length) {
          elements.carouselView.hidden = true;
          elements.overviewView.hidden = true;
        }
      }
    }

    elements.carouselButton.addEventListener('click', () => {
      setView('carousel');
      updateViewSettingsUrl();
    });
    elements.overviewButton.addEventListener('click', () => {
      setView('overview');
      updateViewSettingsUrl();
    });
    elements.sideBySideLayoutButton.addEventListener('click', () => {
      setTicketLayout('side-by-side');
      updateViewSettingsUrl();
    });
    elements.stackedLayoutButton.addEventListener('click', () => {
      setTicketLayout('stacked');
      updateViewSettingsUrl();
    });
    elements.previousButton.addEventListener('click', () => setPerson(currentIndex - 1));
    elements.nextButton.addEventListener('click', () => setPerson(currentIndex + 1));
    elements.rotationButton.addEventListener('click', () => {
      rotationPaused = !rotationPaused;
      renderCarousel();
      startRotation();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopRotation();
      } else {
        startRotation();
      }
    });

    root.initRefreshSettings(loadData);
    loadData();
  }

  return {
    buildTeamMembers,
    buildViewSettingsUrl,
    createTicketCard,
    createPersonPanel,
    getWorkListClass,
    initialize,
    parseViewSettings
  };
});
