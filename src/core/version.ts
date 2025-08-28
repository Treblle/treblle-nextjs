/**
 * @file src/core/version.ts
 * @description Utilities to provide SDK version as a float for Treblle payloads
 */

// Use TS resolveJsonModule to import package.json at runtime (Node).
// In Edge or bundlers that don't allow JSON imports, fallback to a constant.

let versionString: string | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require('../../package.json');
  versionString = typeof pkg.version === 'string' ? pkg.version : null;
} catch (_e) {
  versionString = null;
}

// Fallback if package.json not available at runtime
const FALLBACK_VERSION = '2.0.0';

function toFloatVersion(ver: string): number {
  // Convert semantic version like 2.0.0 -> 2.0 (as number)
  const parts = ver.split('.');
  const major = parseInt(parts[0] || '0', 10);
  const minor = parseInt(parts[1] || '0', 10);
  const numeric = parseFloat(`${major}.${isNaN(minor) ? '0' : minor}`);
  return isNaN(numeric) ? 0 : numeric;
}

export function getSdkVersionFloat(): number {
  const ver = versionString || FALLBACK_VERSION;
  return toFloatVersion(ver);
}

