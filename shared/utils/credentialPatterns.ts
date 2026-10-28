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
   * formats in document content.
   */
  export const credentialPatterns: CredentialPattern[] = [
    {
      name: "AWS Access Key ID",
      pattern: /\bAKIA[0-9A-Z]{16}\b/,
    },
    {
      name: "AWS Secret Access Key",
      pattern: /\b[A-Za-z0-9/+=]{40}\b(?=.*aws|.*secret)/i,
    },
    {
      name: "GitHub Personal Access Token",
      pattern: /\bghp_[A-Za-z0-9]{36}\b/,
    },
    {
      name: "GitHub OAuth Token",
      pattern: /\bgho_[A-Za-z0-9]{36}\b/,
    },
    {
      name: "GitHub Actions Token",
      pattern: /\bghs_[A-Za-z0-9]{36}\b/,
    },
    {
      name: "RSA Private Key",
      pattern: /-----BEGIN RSA PRIVATE KEY-----/,
    },
    {
      name: "Private Key",
      pattern: /-----BEGIN PRIVATE KEY-----/,
    },
    {
      name: "PGP Private Key",
      pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/,
    },
    {
      name: "Generic API Key",
      pattern: /\bapi[_-]?key\s*[:=]\s*['"]?[A-Za-z0-9_-]{16,}['"]?/i,
    },
    {
      name: "Generic Secret",
      pattern: /\bsecret[_-]?key\s*[:=]\s*['"]?[A-Za-z0-9_-]{16,}['"]?/i,
    },
    {
      name: "Database Connection String",
      pattern: /\b(postgresql|mysql|mongodb|redis):\/\/[^:]+:[^@]+@/i,
    },
    {
      name: "Slack Token",
      pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
    },
    {
      name: "Google API Key",
      pattern: /\bAIza[A-Za-z0-9_-]{35}\b/,
    },
    {
      name: "Bearer Token",
      pattern: /\bBearer\s+[A-Za-z0-9._~+/-]+=*\b/i,
    },
  ];
  
  /**
   * Scans text content against all credential patterns and returns any matches.
   *
   * @param text The plain text content to scan.
   * @returns An array of matched credential pattern names.
   */
  export function scanForCredentials(text: string): string[] {
    const matches: string[] = [];
  
    for (const { name, pattern } of credentialPatterns) {
      if (pattern.test(text)) {
        matches.push(name);
      }
    }
  
    return matches;
  }