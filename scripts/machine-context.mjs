import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const trackedConfigPath = path.join(repoRoot, 'config', 'machine-profiles.json');
const localConfigPath = path.join(repoRoot, 'config', 'machine-overrides.local.json');

function stripBom(text) {
  return text.replace(/^\uFEFF/, '');
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return JSON.parse(stripBom(fs.readFileSync(filePath, 'utf8')));
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function mergeDeep(base, override) {
  const result = isPlainObject(base) ? structuredClone(base) : {};
  for (const [key, value] of Object.entries(override ?? {})) {
    if (Array.isArray(value)) {
      result[key] = [...value];
      continue;
    }

    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = mergeDeep(result[key], value);
      continue;
    }

    result[key] = value;
  }

  return result;
}

function normalizePathValue(value) {
  return value ? value.replace(/\\/g, '/') : value;
}

function expandEnvTokens(value) {
  if (!value) {
    return value;
  }

  return value.replace(/%([^%]+)%/g, (_, token) => process.env[token] ?? '');
}

function profileMatches(profile, context) {
  const match = profile?.match ?? {};

  if (match.computerName && match.computerName !== context.computerName) {
    return false;
  }

  if (match.workspaceRoot && normalizePathValue(match.workspaceRoot) !== context.workspaceRoot) {
    return false;
  }

  return Object.keys(match).length > 0;
}

function resolveRelativeToRoot(value) {
  if (!value) {
    return value;
  }

  const normalized = normalizePathValue(value);
  if (/^[A-Za-z]:\//.test(normalized) || normalized.startsWith('//')) {
    return normalized;
  }

  return normalizePathValue(path.resolve(repoRoot, normalized));
}

function tryGit(args, cwd) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return null;
  }
}

function parseRemoteHost(remoteUrl) {
  if (!remoteUrl) {
    return null;
  }

  const sshLike = remoteUrl.match(/^[^@]+@([^:]+):/);
  if (sshLike) {
    return sshLike[1];
  }

  const sshProtocol = remoteUrl.match(/^ssh:\/\/[^@]+@([^/]+)\//);
  if (sshProtocol) {
    return sshProtocol[1];
  }

  const httpsLike = remoteUrl.match(/^https?:\/\/([^/]+)\//);
  if (httpsLike) {
    return httpsLike[1];
  }

  return null;
}

const tracked = readJsonIfExists(trackedConfigPath);
const local = readJsonIfExists(localConfigPath);
const machineName = process.env.COMPUTERNAME || os.hostname();
const workspaceRoot = normalizePathValue(repoRoot);
const matchContext = { computerName: machineName, workspaceRoot };
const trackedProfiles = tracked.profiles ?? [];
const localProfiles = local.profiles ?? [];
const matchedTrackedProfiles = trackedProfiles.filter((profile) => profileMatches(profile, matchContext));
const matchedLocalProfiles = localProfiles.filter((profile) => profileMatches(profile, matchContext));

let effective = mergeDeep(tracked.defaults ?? {}, local.defaults ?? {});
for (const profile of matchedTrackedProfiles) {
  effective = mergeDeep(effective, profile);
}
for (const profile of matchedLocalProfiles) {
  effective = mergeDeep(effective, profile);
}

if (!effective.workspaceRoot) {
  effective.workspaceRoot = workspaceRoot;
}

const remoteName = effective.git?.remoteName ?? 'origin';
const safeDirectory = effective.git?.safeDirectory ?? effective.workspaceRoot;
const gitRemote = tryGit(['-c', `safe.directory=${safeDirectory}`, 'remote', 'get-url', remoteName], effective.workspaceRoot);
const gitBranch = tryGit(['-c', `safe.directory=${safeDirectory}`, 'branch', '--show-current'], effective.workspaceRoot) ?? effective.git?.defaultBranch ?? 'main';
const resolvedRemoteUrl = gitRemote ?? effective.git?.remoteUrl ?? null;
const resolvedSshHost = effective.ssh?.host ?? parseRemoteHost(resolvedRemoteUrl);
const expandedSshConfigPath = expandEnvTokens(effective.ssh?.configPath ?? '');
const resolvedSshConfigPath = expandedSshConfigPath ? normalizePathValue(expandedSshConfigPath) : null;
const resolvedDatabasePath = resolveRelativeToRoot(effective.storage?.databasePath ?? 'storage/db/aifiction.sqlite');

const result = {
  schemaVersion: tracked.schemaVersion ?? local.schemaVersion ?? 1,
  machine: {
    computerName: machineName,
    workspaceRoot: effective.workspaceRoot,
    workspaceName: effective.workspaceName ?? 'AiFiction'
  },
  profile: {
    id: effective.id ?? null,
    label: effective.label ?? null,
    matchedTrackedProfileIds: matchedTrackedProfiles.map((profile) => profile.id ?? profile.label ?? 'tracked'),
    matchedLocalProfileIds: matchedLocalProfiles.map((profile) => profile.id ?? profile.label ?? 'local'),
    localOverridePresent: fs.existsSync(localConfigPath)
  },
  git: {
    remoteName,
    remoteUrl: resolvedRemoteUrl,
    defaultBranch: gitBranch,
    safeDirectory,
    requiresSafeDirectory: effective.git?.requiresSafeDirectory ?? false
  },
  ssh: {
    mode: effective.ssh?.mode ?? null,
    host: resolvedSshHost,
    user: effective.ssh?.user ?? 'git',
    configPath: resolvedSshConfigPath,
    configPresent: resolvedSshConfigPath ? fs.existsSync(resolvedSshConfigPath) : false,
    identityHint: effective.ssh?.identityHint ?? null
  },
  web: {
    preferredPort: effective.web?.preferredPort ?? 8080
  },
  storage: {
    databasePath: resolvedDatabasePath
  },
  notes: effective.notes ?? []
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
