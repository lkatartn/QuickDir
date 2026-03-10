const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { version } = require('../package.json');
const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');

const CATEGORIES = {
  feat:     'Features',
  fix:      'Bug Fixes',
  perf:     'Performance',
  refactor: 'Refactoring',
  ui:       'UI Changes',
  build:    'Build',
  docs:     'Documentation',
  chore:    'Chores',
};

function getLastTag() {
  try {
    return execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function getCommits(since) {
  const range = since ? `${since}..HEAD` : 'HEAD';
  try {
    const raw = execSync(`git log ${range} --pretty=format:"%s|||%h" --no-merges`, {
      encoding: 'utf8',
    });
    if (!raw.trim()) return [];
    return raw.trim().split('\n').map(line => {
      const [subject, hash] = line.split('|||');
      return { subject, hash };
    });
  } catch {
    return [];
  }
}

function categorize(commits) {
  const grouped = {};
  const uncategorized = [];

  for (const { subject, hash } of commits) {
    if (subject.startsWith('release:')) continue;

    const match = subject.match(/^(\w+?)(?:\(.+?\))?:\s*(.+)$/);
    if (match) {
      const [, type, message] = match;
      const category = CATEGORIES[type] || 'Other';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push({ message, hash });
    } else {
      uncategorized.push({ message: subject, hash });
    }
  }

  if (uncategorized.length) {
    grouped['Other'] = (grouped['Other'] || []).concat(uncategorized);
  }

  return grouped;
}

function buildMarkdown(version, grouped) {
  const date = new Date().toISOString().split('T')[0];
  let md = `## [${version}] - ${date}\n\n`;

  const order = [...Object.values(CATEGORIES), 'Other'];
  for (const category of order) {
    const items = grouped[category];
    if (!items || !items.length) continue;
    md += `### ${category}\n\n`;
    for (const { message, hash } of items) {
      md += `- ${message} (${hash})\n`;
    }
    md += '\n';
  }

  return md;
}

const lastTag = getLastTag();
const commits = getCommits(lastTag);

if (!commits.length) {
  console.log('No commits since last tag — changelog unchanged.');
  process.exit(0);
}

const grouped = categorize(commits);
const newSection = buildMarkdown(version, grouped);

let existing = '';
if (fs.existsSync(changelogPath)) {
  existing = fs.readFileSync(changelogPath, 'utf8');
}

const header = '# Changelog\n\n';
const body = existing.startsWith('# Changelog')
  ? existing.replace(/^# Changelog\n\n/, '')
  : existing;

fs.writeFileSync(changelogPath, header + newSection + body, 'utf8');
console.log(`CHANGELOG.md updated for v${version}`);
