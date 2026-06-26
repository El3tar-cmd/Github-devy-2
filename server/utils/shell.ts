import { existsSync } from 'fs';

export function resolveShell() {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'cmd.exe';
  }

  const candidates = [
    process.env.SHELL || '',
    process.env.PREFIX ? `${process.env.PREFIX}/bin/bash` : '',
    '/data/data/com.termux/files/usr/bin/bash',
    '/usr/bin/bash',
    '/bin/bash',
    process.env.PREFIX ? `${process.env.PREFIX}/bin/sh` : '',
    '/data/data/com.termux/files/usr/bin/sh',
    '/usr/bin/sh',
    '/bin/sh',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return 'sh';
}

function resolveBash() {
  if (process.platform === 'win32') return null;

  const candidates = [
    process.env.PREFIX ? `${process.env.PREFIX}/bin/bash` : '',
    '/data/data/com.termux/files/usr/bin/bash',
    '/usr/bin/bash',
    '/bin/bash',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

export function resolveScriptCommand() {
  if (process.platform === 'win32') return null;

  const candidates = [
    process.env.PREFIX ? `${process.env.PREFIX}/bin/script` : '',
    '/data/data/com.termux/files/usr/bin/script',
    '/usr/bin/script',
    '/bin/script',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

export function resolveInteractiveShellLaunch(rcFile?: string) {
  if (process.platform === 'win32') {
    const shell = resolveShell();
    return { command: shell, args: [] };
  }

  const shell = rcFile ? (resolveBash() || resolveShell()) : resolveShell();
  const isBash = /(^|\/)bash$/.test(shell);
  const shellArgs = isBash && rcFile
    ? ['--noprofile', '--rcfile', rcFile, '-i']
    : ['-i'];

  const script = resolveScriptCommand();
  if (script) {
    return {
      command: script,
      args: ['-q', '-f', '/dev/null', '--', shell, ...shellArgs],
    };
  }

  return { command: shell, args: shellArgs };
}
