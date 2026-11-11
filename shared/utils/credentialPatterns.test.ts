import { scanForCredentials, credentialPatterns } from "./credentialPatterns";

const a = (n: number) => "A".repeat(n);

describe("credentialPatterns: should detect", () => {
  const cases: [string, string, string][] = [
    ["AWS Access Key ID", "plain", `key is AKIA${a(16)} here`],
    ["AWS Access Key ID", "temporary ASIA key", `ASIA${a(16)}`],
    ["AWS Access Key ID", "at end of line", `id=AKIA${a(16)}\nnext line`],
    ["AWS Secret Access Key", "env style", `AWS_SECRET_ACCESS_KEY=${a(40)}`],
    ["AWS Secret Access Key", "spaced", `aws_secret_access_key = ${a(40)}`],
    [
      "AWS Secret Access Key",
      "JSON style",
      `{"aws_secret_access_key": "${a(40)}"}`,
    ],
    ["GitHub Token", "ghp", `token: ghp_${"a1".repeat(18)}`],
    ["GitHub Token", "gho", `gho_${"a1".repeat(18)}`],
    ["GitHub Token", "ghs in url", `https://x:ghs_${"a1".repeat(18)}@host`],
    ["GitHub Fine-Grained Token", "github_pat", `github_pat_${a(30)}`],
    ["Private Key", "RSA", "-----BEGIN RSA PRIVATE KEY-----\nMIIE..."],
    ["Private Key", "unprefixed", "-----BEGIN PRIVATE KEY-----"],
    ["Private Key", "EC", "-----BEGIN EC PRIVATE KEY-----"],
    ["Private Key", "OpenSSH", "-----BEGIN OPENSSH PRIVATE KEY-----"],
    ["Private Key", "encrypted", "-----BEGIN ENCRYPTED PRIVATE KEY-----"],
    ["PGP Private Key", "PGP", "-----BEGIN PGP PRIVATE KEY BLOCK-----"],
    ["Generic API Key", "colon", "api_key: 'abcd1234efgh5678ijkl'"],
    ["Generic API Key", "env prefix", `STRIPE_API_KEY=abcd1234efgh5678`],
    ["Generic API Key", "camelCase", `apiKey = "abcd1234efgh5678"`],
    ["Generic API Key", "JSON", `{"api_key": "abcd1234efgh5678"}`],
    ["Generic Secret", "client secret", "client_secret=abcd1234efgh5678"],
    ["Generic Secret", "secret key JSON", `"secret_key": "abcd1234efgh5678"`],
    [
      "Database Connection String",
      "postgresql",
      "postgresql://user:pass@localhost:5432/db",
    ],
    ["Database Connection String", "postgres", "postgres://u:p@host/db"],
    ["Database Connection String", "mongodb+srv", "mongodb+srv://u:p@c.net/db"],
    ["Database Connection String", "redis, no user", "redis://:pass@host:6379"],
    ["Slack Token", "bot token", "xoxb-1234567890-abcdefghij"],
    ["Google API Key", "plain", `key=AIza${a(35)}`],
    ["Google API Key", "ends with dash", `AIza${a(34)}-`],
    ["Bearer Token", "JWT", "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc123"],
    ["Bearer Token", "lowercase", `bearer ${a(10)}1234567890`],
  ];

  it.each(cases)("%s: %s", (name, _label, text) => {
    expect(scanForCredentials(text)).toContain(name);
  });

  it("detects multiple credentials in one text", () => {
    const matches = scanForCredentials(
      `AKIA${a(16)} and ghp_${"a1".repeat(18)}`
    );
    expect(matches).toContain("AWS Access Key ID");
    expect(matches).toContain("GitHub Token");
  });

  it("returns consistent results when called repeatedly", () => {
    const text = `AKIA${a(16)}`;
    expect(scanForCredentials(text)).toEqual(scanForCredentials(text));
  });
});

describe("credentialPatterns: should NOT detect", () => {
  const cases: [string, string][] = [
    ["plain prose", "This is a normal document with no credentials."],
    ["empty string", ""],
    ["short AKIA mention", "Keys starting with AKIA are AWS access keys."],
    ["AKIA key that is too long", `AKIA${a(17)}`],
    ["AKIA key that is too short", `AKIA${a(15)}`],
    ["bearer in a sentence", "Use Bearer authentication when calling the API."],
    [
      "hyphenated word after bearer",
      "Bearer authentication-based-systems are common.",
    ],
    ["placeholder API key", "api_key: YOUR_API_KEY_HERE"],
    ["placeholder secret", "client_secret=<your-client-secret>"],
    ["URL with an email later", "see postgres://localhost:5432/db or me@x.com"],
    ["https URL with credentials", "https://user:pass@example.com/path"],
    ["PRIVATE KEY mention in prose", "Never share your PRIVATE KEY with anyone."],
    ["short ghp prefix", "ghp_tooShort"],
    ["short secret value", "secret_key=abc123"],
  ];

  it.each(cases)("%s", (_label, text) => {
    expect(scanForCredentials(text)).toHaveLength(0);
  });
});

describe("credentialPatterns: library shape", () => {
  it("every pattern has a unique name and a non-global regex", () => {
    const names = credentialPatterns.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    for (const { name, pattern } of credentialPatterns) {
      expect(name.length).toBeGreaterThan(0);
      expect(pattern).toBeInstanceOf(RegExp);
      expect(pattern.global).toBe(false);
      expect(pattern.sticky).toBe(false);
    }
  });
});