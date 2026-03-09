export function joinPath(base: string, name: string): string {
  const sep = base.includes('\\') ? '\\' : '/';
  return base.endsWith(sep) ? base + name : base + sep + name;
}

export function getFileName(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || '';
}

export function getParentDir(filePath: string): string {
  const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  if (lastSep < 0) return filePath;
  return filePath.substring(0, lastSep + 1);
}
