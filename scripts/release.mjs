#!/usr/bin/env node
/**
 * Bump semver, sync Tauri version files, prepend CHANGELOG.md, commit, tag v*, push.
 *
 * Usage:
 *   npm run release -- [patch|minor|major|x.y.z] [--notes "line"] [--dry-run] [--no-push] [--no-git]
 *   未写版本类型时默认为 patch。
 *
 * Examples:
 *   npm run release
 *   npm run release -- patch
 *   npm run release -- minor --notes "新功能：某某"
 *   npm run release -- 1.2.3 --dry-run
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const PKG = join(ROOT, 'package.json');
const CARGO = join(ROOT, 'src-tauri', 'Cargo.toml');
const TAURI_CONF = join(ROOT, 'src-tauri', 'tauri.conf.json');
const CHANGELOG = join(ROOT, 'CHANGELOG.md');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readCurrentVersion() {
  const pkg = readJson(PKG);
  if (!pkg.version || typeof pkg.version !== 'string') {
    throw new Error('package.json missing "version"');
  }
  return pkg.version;
}

function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-.+)?$/.exec(v.trim());
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3], raw: v.trim() };
}

function bumpVersion(current, kind) {
  const parsed = parseSemver(current);
  if (!parsed) throw new Error(`Invalid current version: ${current}`);

  if (kind === 'major') {
    return `${parsed.major + 1}.0.0`;
  }
  if (kind === 'minor') {
    return `${parsed.major}.${parsed.minor + 1}.0`;
  }
  if (kind === 'patch') {
    return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
  }

  const exact = parseSemver(kind);
  if (!exact) {
    throw new Error(
      `Invalid bump "${kind}". Use patch, minor, major, or exact semver (e.g. 1.2.3).`,
    );
  }
  return exact.raw;
}

function setPackageJsonVersion(content, newVer) {
  return content.replace(/"version"\s*:\s*"[^"]*"/, `"version": "${newVer}"`);
}

function setCargoPackageVersion(content, newVer) {
  const lines = content.split('\n');
  let inPackage = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (t === '[package]') {
      inPackage = true;
      continue;
    }
    if (t.startsWith('[')) {
      inPackage = false;
      continue;
    }
    if (inPackage && /^\s*version\s*=\s*"/.test(line)) {
      lines[i] = line.replace(/version\s*=\s*"[^"]*"/, `version = "${newVer}"`);
      return lines.join('\n');
    }
  }
  throw new Error('Could not find [package] version in Cargo.toml');
}

function setTauriVersion(content, newVer) {
  const j = JSON.parse(content);
  j.version = newVer;
  return `${JSON.stringify(j, null, 2)}\n`;
}

function gitOk(args, cwd = ROOT) {
  try {
    execFileSync('git', args, { cwd, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function gitOut(args, cwd = ROOT) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function lastReleaseTag(currentVer) {
  const candidates = [`v${currentVer}`, currentVer];
  for (const t of candidates) {
    if (gitOk(['rev-parse', `${t}^{}`], ROOT)) return t;
  }
  return null;
}

function defaultChangelogLines(fromTag) {
  const range = fromTag ? `${fromTag}..HEAD` : '-n30';
  const args = fromTag
    ? ['log', range, '--pretty=format:- %s']
    : ['log', '-n', '30', '--pretty=format:- %s'];
  try {
    const out = execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
    return out ? out.split('\n').filter(Boolean) : [];
  } catch {
    return [];
  }
}

function prependChangelog(version, bullets) {
  const date = new Date().toISOString().slice(0, 10);
  const body =
    bullets.length > 0
      ? bullets.join('\n')
      : '- （请补充本次发布说明，或下次使用 --notes）';

  const section = `## ${version} - ${date}\n\n${body}\n\n`;

  let existing = '';
  if (existsSync(CHANGELOG)) {
    existing = readFileSync(CHANGELOG, 'utf8');
  } else {
    existing =
      '# Changelog\n\n本文件由 `npm run release` 在发布时自动在顶部插入新版本；请按需润色条目。\n\n';
  }

  const lines = existing.split('\n');
  let insertAt = 0;
  if (lines[0]?.startsWith('# ')) {
    insertAt = 1;
    while (insertAt < lines.length && lines[insertAt].trim() === '') insertAt++;
  }
  lines.splice(insertAt, 0, section.trimEnd(), '');
  writeFileSync(CHANGELOG, lines.join('\n').replace(/\n{3,}/g, '\n\n'), 'utf8');
}

function parseArgs(argv) {
  const flags = { dryRun: false, noPush: false, noGit: false, help: false };
  const notes = [];
  let bump = null;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') flags.help = true;
    else if (a === '--dry-run') flags.dryRun = true;
    else if (a === '--no-push') flags.noPush = true;
    else if (a === '--no-git') flags.noGit = true;
    else if (a === '--notes') {
      const next = argv[++i];
      if (next == null) throw new Error('--notes requires a value');
      notes.push(next);
    } else if (!a.startsWith('-')) {
      if (bump != null) throw new Error(`Unexpected extra argument: ${a}`);
      bump = a;
    } else {
      throw new Error(`Unknown flag: ${a}`);
    }
  }

  return { flags, notes, bump };
}

function printHelp() {
  console.log(`Usage: npm run release -- [patch|minor|major|x.y.z] [options]

  未指定 patch|minor|major|x.y.z 时，默认使用 patch。

Options:
  --notes "text"   Extra changelog bullet(s); can repeat
  --dry-run        Print plan only
  --no-push        Commit and tag locally, do not push
  --no-git         Only bump versions + CHANGELOG (no commit/tag/push)
  -h, --help       Show this help
`);
}

function main() {
  const { flags, notes, bump: bumpFromArgs } = parseArgs(process.argv.slice(2));

  if (flags.help) {
    printHelp();
    process.exit(0);
  }

  const bumpArg = bumpFromArgs ?? 'patch';

  const current = readCurrentVersion();
  const next = bumpVersion(current, bumpArg);

  const fromTag = lastReleaseTag(current);
  const autoLines = defaultChangelogLines(fromTag);
  const noteLines = notes.map((n) => (n.startsWith('-') ? n : `- ${n}`));
  const ordered = [...noteLines, ...autoLines];
  const seen = new Set();
  const unique = [];
  for (const line of ordered) {
    if (seen.has(line)) continue;
    seen.add(line);
    unique.push(line);
  }

  const branch = gitOut(['rev-parse', '--abbrev-ref', 'HEAD']);

  console.log(`Current:  ${current}`);
  console.log(`Next:     ${next}`);
  console.log(
    `Bump:     ${bumpArg}${bumpFromArgs == null ? ' (default)' : ''}`,
  );
  console.log(`Branch:   ${branch}`);
  console.log(`Since:    ${fromTag ?? '(no prior tag, last 30 commits)'}`);
  if (flags.dryRun) {
    console.log('\n[dry-run] Would update:', PKG, CARGO, TAURI_CONF, CHANGELOG);
    console.log('\n[dry-run] Changelog preview:\n');
    console.log(`## ${next} - ${new Date().toISOString().slice(0, 10)}\n`);
    console.log(unique.join('\n') || '- …');
    if (!flags.noGit) {
      console.log('\n[dry-run] Would: git add … && git commit && git tag', `v${next}`);
      if (!flags.noPush) {
        console.log('[dry-run] Would: git push origin', branch, '&& git push origin', `v${next}`);
      }
    }
    return;
  }

  const pkgRaw = readFileSync(PKG, 'utf8');
  const cargoRaw = readFileSync(CARGO, 'utf8');
  const tauriRaw = readFileSync(TAURI_CONF, 'utf8');

  writeFileSync(PKG, setPackageJsonVersion(pkgRaw, next), 'utf8');
  writeFileSync(CARGO, setCargoPackageVersion(cargoRaw, next), 'utf8');
  writeFileSync(TAURI_CONF, setTauriVersion(tauriRaw, next), 'utf8');
  prependChangelog(next, unique);

  console.log(`Updated version to ${next} in package.json, Cargo.toml, tauri.conf.json`);
  console.log(`Prepended CHANGELOG.md`);

  if (flags.noGit) {
    console.log('Skipping git (--no-git). Stage and commit when ready.');
    return;
  }

  execFileSync(
    'git',
    ['add', 'package.json', 'src-tauri/Cargo.toml', 'src-tauri/tauri.conf.json', 'CHANGELOG.md'],
    { cwd: ROOT, stdio: 'inherit' },
  );
  execFileSync('git', ['commit', '-m', `chore: release v${next}`], { cwd: ROOT, stdio: 'inherit' });
  execFileSync('git', ['tag', `v${next}`], { cwd: ROOT, stdio: 'inherit' });
  console.log(`Tagged v${next}`);

  if (flags.noPush) {
    console.log('Skipping push (--no-push). Run: git push origin HEAD && git push origin v' + next);
    return;
  }

  execFileSync('git', ['push', 'origin', branch], { cwd: ROOT, stdio: 'inherit' });
  execFileSync('git', ['push', 'origin', `v${next}`], { cwd: ROOT, stdio: 'inherit' });
  console.log(`Pushed ${branch} and v${next} (CI release workflow should run on tag v*).`);
}

main();
