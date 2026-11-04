const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  buildTeamMembers,
  buildViewSettingsUrl,
  createPersonPanel,
  createTicketCard,
  getWorkListClass,
  parseViewSettings
} = require('./people-focus.js');

function issue(key, assignee, statusCategory, parent = {}) {
  const statuses = {
    new: 'To Do',
    indeterminate: 'In Progress',
    done: 'Done'
  };
  return {
    key,
    summary: `${key} summary`,
    status: statuses[statusCategory] || 'Unknown',
    issue_type: 'Task',
    assignee,
    status_category: statusCategory,
    ...parent
  };
}

function createFakeDocument() {
  return {
    createElement(tagName) {
      return {
        tagName,
        className: '',
        children: [],
        attributes: {},
        style: {},
        appendChild(child) {
          this.children.push(child);
          return child;
        },
        setAttribute(name, value) {
          this.attributes[name] = value;
        },
        getAttribute(name) {
          return this.attributes[name] || null;
        },
        addEventListener() {},
        set textContent(value) {
          this._textContent = value;
        },
        get textContent() {
          return [this._textContent || '', ...this.children.map(child => child.textContent)]
            .filter(Boolean)
            .join(' ');
        }
      };
    }
  };
}

function findElementsByClass(element, className) {
  const matches = element.className.split(/\s+/).includes(className) ? [element] : [];
  for (const child of element.children) {
    matches.push(...findElementsByClass(child, className));
  }
  return matches;
}

test('supports side-by-side and stacked ticket layouts in the carousel', () => {
  assert.equal(getWorkListClass('carousel', 'side-by-side'), 'team-work-list');
  assert.equal(getWorkListClass('carousel', 'stacked'), 'team-work-list team-work-list-stacked');
  assert.equal(getWorkListClass('overview', 'side-by-side'), 'team-work-list');
});

test('stacked ticket layout has a desktop grid rule', () => {
  const stylesheet = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');

  assert.match(
    stylesheet,
    /^\.team-work-list-stacked\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/m
  );
});

test('reads view and ticket layout from query parameters with safe defaults', () => {
  assert.deepEqual(parseViewSettings('?view=overview&layout=stacked'), {
    view: 'overview',
    layout: 'stacked'
  });
  assert.deepEqual(parseViewSettings('?view=unknown&layout=unknown'), {
    view: 'carousel',
    layout: 'side-by-side'
  });
});

test('updates view query parameters while preserving unrelated settings and hash', () => {
  const url = buildViewSettingsUrl(
    { pathname: '/index.html', search: '?refresh=30&view=carousel', hash: '#team' },
    'overview',
    'stacked'
  );
  const parsedUrl = new URL(url, 'https://example.test');

  assert.equal(parsedUrl.searchParams.get('refresh'), '30');
  assert.equal(parsedUrl.searchParams.get('view'), 'overview');
  assert.equal(parsedUrl.searchParams.get('layout'), 'stacked');
  assert.equal(parsedUrl.hash, '#team');
});

test('groups in-progress work under the highest ancestor', () => {
  const members = buildTeamMembers([
    issue('APP-1', 'Alex', 'indeterminate'),
    issue('APP-2', 'Alex', 'indeterminate', { parent_key: 'APP-1' }),
    issue('APP-3', 'Alex', 'indeterminate', { parent_key: 'APP-2' }),
    issue('APP-4', 'Alex', 'new', { parent_key: 'APP-1' })
  ]);
  const alex = members.find(member => member.name === 'Alex');

  assert.equal(alex.activeCount, 3);
  assert.equal(alex.groups.length, 1);
  assert.equal(alex.groups[0].ticket.key, 'APP-1');
  assert.equal(alex.groups[0].memberOwnsTicket, true);
  assert.equal(alex.groups[0].activeIssueCount, 3);
});

test('uses sanitized parent fields when the parent is not in the issue export', () => {
  const members = buildTeamMembers([
    issue('APP-2', 'Alex', 'indeterminate', {
      parent_key: 'APP-1',
      parent_summary: 'Parent summary',
      parent_status_category: 'indeterminate',
      parent_issue_type: 'Epic'
    })
  ]);

  assert.equal(members[0].groups[0].ticket.key, 'APP-1');
  assert.equal(members[0].groups[0].ticket.summary, 'Parent summary');
  assert.equal(members[0].groups[0].memberOwnsTicket, false);
  assert.equal(members[0].groups[0].activeIssueCount, 1);
});

test('rolls work up under a parent even when it is not in progress', () => {
  const members = buildTeamMembers([
    issue('APP-1', 'Jordan', 'done'),
    issue('APP-2', 'Alex', 'indeterminate', { parent_key: 'APP-1' })
  ]);
  const alex = members.find(member => member.name === 'Alex');

  assert.equal(alex.groups.length, 1);
  assert.equal(alex.groups[0].ticket.key, 'APP-1');
  assert.equal(alex.groups[0].ticket.status, 'Done');
  assert.equal(alex.groups[0].activeIssueCount, 1);
});

test('uses exported parent chains for an unassigned To Do top-level parent', () => {
  const members = buildTeamMembers([
    issue('APP-3', 'Alex', 'indeterminate', {
      parent_key: 'APP-2',
      parent_summary: 'Epic summary',
      parent_status: 'To Do',
      parent_status_category: 'new',
      parent_issue_type: 'Epic',
      parent_chain: [
        {
          key: 'APP-2',
          summary: 'Epic summary',
          issue_type: 'Epic',
          status: 'To Do',
          status_category: 'new',
          parent_key: 'APP-1'
        },
        {
          key: 'APP-1',
          summary: 'Feature Set summary',
          issue_type: 'Feature Set',
          status: 'To Do',
          status_category: 'new',
          assignee: null
        }
      ]
    })
  ]);
  const alex = members.find(member => member.name === 'Alex');

  assert.deepEqual(members.map(member => member.name), ['Alex']);
  assert.equal(alex.activeCount, 1);
  assert.equal(alex.groups[0].ticket.key, 'APP-1');
  assert.equal(alex.groups[0].ticket.issue_type, 'Feature Set');
  assert.equal(alex.groups[0].ticket.status, 'To Do');
  assert.equal(alex.groups[0].activeIssueCount, 1);
  assert.equal(alex.groups[0].memberOwnsTicket, false);
});

test('renders a text parent cue and descendant progress without status or count text', () => {
  const document = createFakeDocument();
  const card = createTicketCard({
    ticket: issue('APP-1', null, 'new', {
      issue_type: 'Feature Set',
      summary: 'Feature Set summary',
      descendant_progress: { completed: 2, total: 5 }
    }),
    memberOwnsTicket: false,
    children: [{ issue: issue('APP-3', 'Alex', 'indeterminate') }]
  }, { base_url: '' }, { URL, location: { href: 'https://board.example/' } }, document);

  const progressBar = card.children[card.children.length - 1];
  const progressFill = progressBar.children[0];

  assert.equal(card.className, 'team-ticket-card team-parent-context-card');
  assert.equal(card.children[0].className, 'team-context-label');
  assert.equal(card.children[0].textContent, 'Working toward');
  assert.match(card.textContent, /Feature Set summary/);
  assert.doesNotMatch(card.textContent, /2 in-progress|To Do|In Progress|Done/);
  assert.equal(findElementsByClass(card, 'team-ticket-work-count').length, 0);
  assert.equal(findElementsByClass(card, 'team-context-pill').length, 0);
  assert.equal(progressBar.className, 'team-descendant-progress');
  assert.equal(progressBar.getAttribute('role'), 'progressbar');
  assert.equal(progressBar.getAttribute('aria-valuenow'), '2');
  assert.equal(progressBar.getAttribute('aria-valuemax'), '5');
  assert.equal(progressBar.getAttribute('aria-valuetext'), '2 of 5 descendant tickets complete (40%)');
  assert.equal(progressFill.style.width, '40%');
  assert.equal(findElementsByClass(card, 'team-status-pill').length, 0);
  assert.doesNotMatch(card.textContent, /APP-3/);
  assert.equal(card.children.some(child => child.className === 'team-children'), false);
});

test('omits parent cue and progress when the member owns the displayed ticket', () => {
  const document = createFakeDocument();
  const card = createTicketCard({
    ticket: issue('APP-1', 'Alex', 'indeterminate', {
      descendant_progress: { completed: 1, total: 2 }
    }),
    memberOwnsTicket: true
  }, { base_url: '' }, { URL, location: { href: 'https://board.example/' } }, document);

  assert.equal(findElementsByClass(card, 'team-context-label').length, 0);
  assert.equal(findElementsByClass(card, 'team-descendant-progress').length, 0);
});

test('does not show a fabricated progress bar when descendant data is missing', () => {
  const document = createFakeDocument();
  const card = createTicketCard({
    ticket: issue('APP-1', null, 'new'),
    memberOwnsTicket: false
  }, { base_url: '' }, { URL, location: { href: 'https://board.example/' } }, document);

  assert.equal(findElementsByClass(card, 'team-context-label').length, 1);
  assert.equal(findElementsByClass(card, 'team-descendant-progress').length, 0);
});

test('omits the person work count while keeping the person and ticket visible', () => {
  const document = createFakeDocument();
  const panel = createPersonPanel({
    name: 'Alex',
    avatar: '',
    activeCount: 3,
    groups: [{
      ticket: issue('APP-1', null, 'new'),
      memberOwnsTicket: false
    }]
  }, { base_url: '' }, 'carousel', {
    URL,
    location: { href: 'https://board.example/' }
  }, document);

  assert.match(panel.textContent, /Alex/);
  assert.match(panel.textContent, /APP-1/);
  assert.doesNotMatch(panel.textContent, /3 in-progress tickets/);
  assert.equal(findElementsByClass(panel, 'team-person-work-count').length, 0);
});

test('includes assigned teammates with no in-progress work and excludes unassigned issues', () => {
  const members = buildTeamMembers([
    issue('APP-1', 'Alex', 'done'),
    issue('APP-2', null, 'indeterminate')
  ]);

  assert.equal(members.length, 1);
  assert.equal(members[0].name, 'Alex');
  assert.equal(members[0].activeCount, 0);
  assert.deepEqual(members[0].groups, []);
});
