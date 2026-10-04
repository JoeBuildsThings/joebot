export const isWindows = process.platform === 'win32';
export const isTermux =
  Boolean(process.env.TERMUX_VERSION) ||
  String(process.env.PREFIX || '').includes('com.termux');
export const platformName = isTermux
  ? 'Termux on Android'
  : isWindows
    ? 'Windows'
    : process.platform === 'darwin'
      ? 'macOS'
      : 'Linux';
export const shellName = isWindows ? 'cmd.exe' : 'sh';

export function environmentBlock() {
  const lines = [
    'ENVIRONMENT',
    `Platform: ${platformName}`,
    `Shell for run_command: ${shellName}`,
    `Project folder: ${process.cwd()}`
  ];
  if (isTermux) {
    lines.push(
      'Phone storage: ~/storage/downloads, ~/storage/dcim, ~/storage/pictures, ~/storage/music, ~/storage/movies, ~/storage/shared'
    );
  }
  if (isWindows) {
    lines.push('Use Windows command syntax for run_command, such as dir and type, not ls and cat.');
  }
  return lines.join('\n');
}
