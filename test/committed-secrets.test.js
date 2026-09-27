const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');

const REPOSITORY_ROOT = path.join(__dirname, '..');
const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules', 'coverage', 'dist', 'build']);

// A PostgreSQL URL that carries an inline password. Documentation and tests are
// allowed to show the *shape* of a connection string, so the obviously fake
// placeholders are listed below and only a value that is not one of them counts
// as a leak.
const CREDENTIAL_BEARING_URL = /postgres(?:ql)?:\/\/[^/\s'"@]*:([^@\s'"]*)@/g;
const DOCUMENTED_PLACEHOLDER_PASSWORDS = new Set([
  'PASSWORD',
  'password',
  'placeholder',
  'test_password',
  '***',
  '*****',
  // Decoding fixtures: a percent-escaped password, and a malformed escape.
  'p%40ss%2Fword',
  '100%pure',
]);

const listRepositoryFiles = directory =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory()) {
      return SKIPPED_DIRECTORIES.has(entry.name)
        ? []
        : listRepositoryFiles(path.join(directory, entry.name));
    }

    return [path.join(directory, entry.name)];
  });

const readRepositoryFile = filePath => fs.readFileSync(filePath, 'utf8');

const findCredentialBearingUrls = content => {
  const findings = [];

  for (const [, password] of content.matchAll(CREDENTIAL_BEARING_URL)) {
    if (!DOCUMENTED_PLACEHOLDER_PASSWORDS.has(password)) {
      findings.push(password);
    }
  }

  return findings;
};

describe('committed secrets', () => {
  it('never writes a credentialed connection string into a tracked file', () => {
    const offenders = [];

    for (const filePath of listRepositoryFiles(REPOSITORY_ROOT)) {
      for (const password of findCredentialBearingUrls(readRepositoryFile(filePath))) {
        offenders.push(
          `${path.relative(REPOSITORY_ROOT, filePath)} (password of length ${password.length})`,
        );
      }
    }

    assert.deepEqual(offenders, []);
  });

  it('keeps the real .env out of the working tree', () => {
    const environmentFiles = fs
      .readdirSync(REPOSITORY_ROOT)
      .filter(entry => entry.startsWith('.env'));

    assert.deepEqual(environmentFiles, ['.env.example']);
  });

  it('ships DATABASE_URL in the template without a value', () => {
    const template = readRepositoryFile(path.join(REPOSITORY_ROOT, '.env.example'));

    assert.match(template, /^DATABASE_URL=\s*$/m);
  });
});
