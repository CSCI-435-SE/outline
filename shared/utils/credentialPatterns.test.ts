import { scanForCredentials, credentialPatterns } from "./credentialPatterns";

describe("credentialPatterns", () => {
  it("detects AWS Access Key ID", () => {
    const text = "My key is AKIAIOSFODNN7EXAMPLE here";
    expect(scanForCredentials(text)).toContain("AWS Access Key ID");
  });

  it("detects AWS secret key with label first", () => {
    const text =
      "aws_secret_access_key = wJalrXUtnFEMIK7MDENGbPxRfiCYEXAMPLEKEYab";
    expect(scanForCredentials(text)).toContain("AWS Secret Access Key");
  });

  it("detects GitHub Personal Access Token", () => {
    const text = "token: ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890";
    expect(scanForCredentials(text)).toContain("GitHub Personal Access Token");
  });

  it("detects GitHub fine-grained token", () => {
    const text = "github_pat_" + "A".repeat(30);
    expect(scanForCredentials(text)).toContain("GitHub Fine-Grained Token");
  });

  it("detects RSA Private Key", () => {
    const text = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...";
    expect(scanForCredentials(text)).toContain("RSA Private Key");
  });

  it("detects OpenSSH private key", () => {
    const text = "-----BEGIN OPENSSH PRIVATE KEY-----";
    expect(scanForCredentials(text)).toContain("OpenSSH Private Key");
  });

  it("detects PGP private key", () => {
    const text = "-----BEGIN PGP PRIVATE KEY BLOCK-----";
    expect(scanForCredentials(text)).toContain("PGP Private Key");
  });

  it("detects database connection string", () => {
    const text = "postgresql://user:password@localhost:5432/mydb";
    expect(scanForCredentials(text)).toContain("Database Connection String");
  });

  it("detects Slack token", () => {
    const text = "slack token: xoxb-1234567890-abcdefghij";
    expect(scanForCredentials(text)).toContain("Slack Token");
  });

  it("detects Google API key", () => {
    const text = "key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI";
    expect(scanForCredentials(text)).toContain("Google API Key");
  });

  it("detects generic API key", () => {
    const text = "api_key: 'abcdef1234567890abcd'";
    expect(scanForCredentials(text)).toContain("Generic API Key");
  });

  it("detects a realistic Bearer token", () => {
    const text = "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc123def456";
    expect(scanForCredentials(text)).toContain("Bearer Token");
  });

  it("does not flag a normal sentence containing Bearer", () => {
    const text = "Use Bearer authentication when calling the endpoint.";
    expect(scanForCredentials(text)).not.toContain("Bearer Token");
  });

  it("returns empty array for clean text", () => {
    const text = "This is a normal document with no credentials.";
    expect(scanForCredentials(text)).toHaveLength(0);
  });

  it("returns multiple matches when multiple credentials are present", () => {
    const text =
      "AKIAIOSFODNN7EXAMPLE and ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890";
    const matches = scanForCredentials(text);
    expect(matches).toContain("AWS Access Key ID");
    expect(matches).toContain("GitHub Personal Access Token");
  });

  it("has at least 10 patterns defined", () => {
    expect(credentialPatterns.length).toBeGreaterThanOrEqual(10);
  });

  it("every pattern has a name and a regex", () => {
    for (const { name, pattern } of credentialPatterns) {
      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);
      expect(pattern).toBeInstanceOf(RegExp);
    }
  });
});