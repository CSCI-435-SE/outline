/**
 * A credential pattern with a name and regex for detection.
 */
export type CredentialPattern = {
  /** Human-readable name of the credential type */
  name: string;
  /** Regex pattern to detect the credential */
  pattern: RegExp;
};

/**
 * A centralized library of regex patterns for detecting common credential
 * formats in document content. Patterns must not use the global or sticky
 * flags, as they are reused with `.test()`.
 */
export const credentialPatterns: CredentialPattern[] = [
  {
    name: "AWS Access Key ID",
    pattern: /(?<![A-Z0-9])(?:AKIA|ASIA)[0-9A-Z]{16}(?![A-Z0-9])/,
  },
  {
    name: "AWS Secret Access Key",
    pattern:
      /aws[_-]?secret[_-]?(?:access[_-]?)?key['"]?\s*[:=]\s*['"]?[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/i,
  },
  {
    name: "GitHub Token",
    pattern: /(?<![A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{36,}(?![A-Za-z0-9])/,
  },
  {
    name: "GitHub Fine-Grained Token",
    pattern: /(?<![A-Za-z0-9])github_pat_[A-Za-z0-9_]{22,}/,
  },
  {
    name: "Private Key",
    pattern:
      /-----BEGIN (?:(?:RSA|EC|DSA|ENCRYPTED|OPENSSH) )?PRIVATE KEY-----/,
  },
  {
    name: "PGP Private Key",
    pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/,
  },
  {
    name: "Generic API Key",
    pattern:
      /api[_-]?key['"]?\s*[:=]\s*['"]?(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{16,}/i,
  },
  {
    name: "Generic Secret",
    pattern:
      /(?:client[_-]?)?secret(?:[_-]?key)?['"]?\s*[:=]\s*['"]?(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{16,}/i,
  },
  {
    name: "Database Connection String",
    pattern:
      /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|amqps?):\/\/[^\s:/@]*:[^\s@]+@/i,
  },
  {
    name: "Slack Token",
    pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/,
  },
  {
    name: "Google API Key",
    pattern: /(?<![A-Za-z0-9])AIza[A-Za-z0-9_-]{35}(?![A-Za-z0-9_-])/,
  },
  {
    name: "Bearer Token",
    pattern: /\b[Bb]earer\s+(?=[A-Za-z0-9._~+/-]*\d)[A-Za-z0-9._~+/-]{20,}=*/,
  },
];

/**
 * Scans text content against all credential patterns and returns any matches.
 *
 * @param text The plain text content to scan.
 * @returns An array of matched credential pattern names.
 */
export function scanForCredentials(text: string): string[] {
  return credentialPatterns
    .filter(({ pattern }) => pattern.test(text))
    .map(({ name }) => name);
}