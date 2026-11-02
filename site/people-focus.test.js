const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  buildTeamMembers,
  buildViewSettingsUrl,
  getWorkListClass,
  parseViewSettings
} = require('./people-focus.js');

function issue(key, assignee, statusCategory, parent = {}) {
  return {
    key,
    summary: `${key} summary`,
    issue_type: 'Task',
    assignee,
    status_category: statusCategory,
    ...parent
  };
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

test('groups in-progress work under the highest in-progress ancestor', () => {
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
  assert.deepEqual(alex.groups[0].children.map(child => child.issue.key), ['APP-2', 'APP-3']);
  assert.deepEqual(alex.groups[0].children.map(child => child.depth), [1, 2]);
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
  assert.equal(members[0].groups[0].children[0].issue.key, 'APP-2');
});

test('does not roll work up under a parent that is not in progress', () => {
  const members = buildTeamMembers([
    issue('APP-1', 'Alex', 'done'),
    issue('APP-2', 'Alex', 'indeterminate', { parent_key: 'APP-1' })
  ]);

  assert.equal(members[0].groups.length, 1);
  assert.equal(members[0].groups[0].ticket.key, 'APP-2');
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
