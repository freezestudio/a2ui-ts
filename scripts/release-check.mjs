#!/usr/bin/env node
/**
 * Release consistency gate.
 *
 * For PRs, require that every changed public npm package has a changeset.
 * Private workspace packages are intentionally ignored and must not be published.
 *
 * Usage:
 *   node scripts/release-check.mjs [baseRef]
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baseRef = process.argv[2] ?? 'origin/main';

const PACKAGE_DIRS = {
  'packages/shared': '@freezestudio/a2ui-shared',
  'packages/sdk': '@freezestudio/a2ui-sdk',
  'packages/web-core': '@freezestudio/a2ui-web-core',
  'packages/agent': '@freezestudio/a2ui-agent',
  'renderers/angular': '@freezestudio/a2ui-angular',
};

const CHANGESET_DIR = join(ROOT, '.changeset');

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', cwd: ROOT }).trim();
}

function gitDiff(base) {
  let files = [];
  try {
    files = run('git', ['diff', '--name-only', `${base}...HEAD`])
      .split('\n')
      .filter(Boolean);
  } catch {
    files = [];
  }

  // 本地工作区尚未提交时，把 staged/unstaged 变更也纳入检查。
  if (files.length === 0) {
    const staged = run('git', ['diff', '--cached', '--name-only']).split('\n').filter(Boolean);
    const unstaged = run('git', ['diff', '--name-only']).split('\n').filter(Boolean);
    files = [...new Set([...staged, ...unstaged])];
  }
  return files;
}

function parseChangesets() {
  const packages = new Set();
  if (!readdirSync(CHANGESET_DIR).some((file) => file.endsWith('.md') && file !== 'README.md')) {
    return packages;
  }

  for (const file of readdirSync(CHANGESET_DIR)) {
    if (!file.endsWith('.md') || file === 'README.md') continue;
    const text = readFileSync(join(CHANGESET_DIR, file), 'utf8');
    const match = text.match(/^---\n([\s\S]*?)\n---/);
    if (!match) continue;
    for (const line of match[1].split('\n')) {
      const packageMatch = line.match(/^['"]([^'"]+)['"]\s*:/);
      if (packageMatch) packages.add(packageMatch[1]);
    }
  }
  return packages;
}

const changedFiles = gitDiff(baseRef);
const changedPackages = new Set();
for (const file of changedFiles) {
  for (const [dir, packageName] of Object.entries(PACKAGE_DIRS)) {
    if (file.startsWith(`${dir}/`) || file === `${dir}/package.json`) {
      changedPackages.add(packageName);
    }
  }
}

const changesetPackages = parseChangesets();
const missing = [...changedPackages].filter((pkg) => !changesetPackages.has(pkg)).sort((a, b) => a.localeCompare(b));

console.log(
  `Changed public packages: ${[...changedPackages].sort((a, b) => a.localeCompare(b)).join(', ') || '(none)'}`,
);
console.log(
  `Changeset packages:      ${[...changesetPackages].sort((a, b) => a.localeCompare(b)).join(', ') || '(none)'}`,
);

if (missing.length > 0) {
  console.error(`Missing changesets for changed public packages: ${missing.join(', ')}`);
  console.error('Run `pnpm changeset` to describe the change and choose major/minor/patch.');
  process.exit(1);
}

console.log('Release check passed.');
