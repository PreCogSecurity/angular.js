'use strict';

// Committed-secret scanner.
//
// Fails the build (non-zero exit) when a credential is about to be committed
// to the repository. This is a guard rail, not a silver bullet: it targets the
// mistakes that actually happen in this project, namely a developer copying
// `.env.example` to `.env`, filling in real SauceLabs / BrowserStack keys and
// committing the result, or pasting a key into a CI config, a script or a
// doc example.
//
// Checks, in order of signal-to-noise ratio:
//
//   1. `env_file`     - a committed local environment file (`.env`,
//                       `.env.local`, ...). Only the committed templates
//                       (`.env.example` and friends) are allowed.
//   2. `private_key`  - PEM/OpenSSH/DER private key material.
//   3. `vendor_key`   - a credential with a well known, provider specific
//                       shape (AWS, GitHub, Slack, Google, Stripe, npm, ...).
//                       These signatures are unambiguous, so this check has
//                       no false positives.
//   4. `assignment`   - a credential-shaped variable name assigned a literal
//                       value that is neither a placeholder nor a reference to
//                       something else (e.g. `process.env.FOO`).
//   5. `low_entropy`  - a credential-shaped variable assigned a trivially
//                       guessable password (`password123`, `letmein`, ...).
//
// False positives are handled with an inline pragma on the offending line or
// on the line immediately above it:
//
//     // security-check: ignore
//
// Usage: node scripts/security/check-secrets.js [--verbose] [--root=<dir>]
//
// `--root` scans another git working tree (a release export, for example)
// instead of the repository this script lives in.

var child_process = require('child_process');
var fs = require('fs');
var path = require('path');

var PROJECT_ROOT = path.join(__dirname, '../..');

var VERBOSE = process.argv.indexOf('--verbose') !== -1;

var ROOT_ARG = process.argv.filter(function(arg) {
  return arg.indexOf('--root=') === 0;
})[0];
if (ROOT_ARG) {
  PROJECT_ROOT = path.resolve(ROOT_ARG.slice('--root='.length));
}

// Only text-ish files are scanned. Generated and vendored trees are skipped:
// they are machine produced, never hand-edited, and the largest of them
// (i18n/closure) is tens of thousands of lines of CLDR data.
var SKIP_PATH_PATTERNS = [
  /^\.git\//,
  /^bower_components\//,
  /^docs\/bower_components\//,
  /^node_modules\//,
  /^build\//,
  /^coverage\//,
  /^i18n\/closure\//,
  /^i18n\/ucd\/dist\//
];

// Files that may legitimately mention secret-shaped names and values.
var ALLOW_FILES = [
  '.env.example',
  path.join('scripts', 'security', 'check-secrets.js')
];

// Credentials are never in files this large.
var MAX_FILE_SIZE = 2 * 1024 * 1024;

// 1. Local environment files: `.env`, `.env.local`, `.env.production`, ...
var ENV_FILE_REGEX = /(^|\/)\.env(\.[^/]*)?$/;
var ENV_FILE_ALLOWLIST = ['.env.example', '.env.sample', '.env.template'];

// 2. Private key material.
var PRIVATE_KEY_REGEX = /-----BEGIN[ A-Z0-9]*(PRIVATE KEY|OPENSSH PRIVATE KEY)/;

// 3. Provider specific credential shapes. These are the highest-signal checks
// in the file: a match is a real credential, not a guess.
var VENDOR_PATTERNS = [
  {name: 'AWS access key id', regex: /\bAKIA[0-9A-Z]{16}\b/},
  {name: 'AWS secret access key', regex: /\baws_secret_access_key\s*[:=]\s*["']?[A-Za-z0-9\/+=]{40}["']?/i},
  {name: 'GitHub token', regex: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/},
  {name: 'GitHub OAuth secret', regex: /\bgithub[_-]?oauth[_-]?secret\s*[:=]\s*["']?[A-Za-z0-9]{40,}/i},
  {name: 'Slack token', regex: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/},
  {name: 'Google API key', regex: /\bAIza[0-9A-Za-z\-_]{35}\b/},
  {name: 'Google OAuth client secret', regex: /\bGOCSPX-[0-9A-Za-z\-_]{28}\b/},
  {name: 'Stripe live secret', regex: /\b[rs]k_live_[0-9A-Za-z]{20,}\b/},
  {name: 'npm access token', regex: /\bnpm_[A-Za-z0-9]{36}\b/},
  {name: 'JSON Web Token', regex: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/},
  {name: 'SauceLabs access key', regex: /\bsauce[_-]?access[_-]?key\s*[:=]\s*["']?[0-9a-f]{32,}/i},
  {name: 'BrowserStack access key', regex: /\bbrowser_?stack[_-]?access[_-]?key\s*[:=]\s*["']?[A-Za-z0-9]{16,}/i}
];

// 4./5. Credential-shaped variable names. Matching is on the WHOLE identifier
// (optionally `SCREAMING_SNAKE_CASE` with underscores) so that ordinary source
// code such as `token`, `tokens`, `this.tokens`, `config.withCredentials` or
// `$scope.password` is not mistaken for a credential.
var SECRET_NAME_REGEX = new RegExp(
  '^(?:' + [
    'password', 'passwd', 'passphrase', 'pass_word',
    'secret', 'secret_key', 'secretkey', 'client_secret', 'clientsecret',
    'api_key', 'apikey', 'api_secret', 'apisecret',
    'access_key', 'accesskey', 'access_token', 'accesstoken',
    'auth_token', 'authtoken', 'auth_key', 'bearer_token', 'refresh_token',
    'private_key', 'privatekey', 'encryption_key', 'signing_key',
    'credentials', 'credential', 'creds',
    'sauce_key', 'sauce_access_key',
    'browser_stack_key', 'browser_stack_access_key',
    'aws_secret_access_key', 'aws_access_key_id',
    'authorization', 'auth_token_value'
  ].join('|') + ')$', 'i');

// `name = value`, `name: "value"`, `name := value` where `name` is a bare
// credential-shaped identifier. The optional opening quote is captured so that
// a literal can be told apart from a variable reference.
var ASSIGNMENT_REGEX = new RegExp(
  '(^|[^A-Za-z0-9_$.\\[\\]"\'])' +  // start of line or a separator
  '([A-Za-z_][A-Za-z0-9_]*)' +        // the bare variable / env var name
  '\\s*(?::=|=|:)\\s*' +              // assignment
  '([\"\']?)([^"\'\\s`,;)\\]}]{1,})', // the value, with its opening quote
  'g');

// An unquoted value that is a bare identifier is a reference to something
// else, e.g. `data: {Passwd: password}` in a function that receives the
// password as a parameter. Requiring a literal keeps the check precise: a
// scanned-out provider key that is inlined without quotes is still caught by
// the vendor signatures above.
var IDENTIFIER_VALUE_REGEX = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

// Values that are obviously not credentials.
var PLACEHOLDER_VALUES = [
  /^<.*>$/,            // <your-access-key>
  /^\$\{.*\}$/,        // ${SAUCE_ACCESS_KEY}
  /^\{\{.*\}\}$/,      // {{access_key}}
  /^%.*%$/,            // %SAUCE_ACCESS_KEY%
  /^%[A-Z_]+%$/,       // %s (printf)
  /^\.\.\./,           // ...password...
  /^\*+$/,             // ****
  /^x+$/i,             // xxxxx
  /^changeme$/i,
  /^redacted$/i,
  /^example$/i,
  /^placeholder$/i,
  /^dummy$/i,
  /^not[_-]?set$/i,
  /^none$/i,
  /^null$/i,
  /^nil$/i,
  /^undefined$/i,
  /^true$/i,
  /^false$/i,
  /^todo$/i,
  /^tbd$/i,
  /^[0-9]+$/,          // 1234
  /^your[_-]/i,        // your-access-key
  /^prefix_/i,         // prefix_ (used for vault/db url templates)
  /^suffix_/i
];

// Values that are references to something else, not inline secrets.
var REFERENCE_VALUE_REGEX = new RegExp(
  '^(?:' + [
    'process\\.env',            // process.env.FOO
    'os\\.environ',             // os.environ['FOO']
    'angular\\.',
    '\\$[A-Za-z_]',              // $scope.foo, $env
    'require\\(',
    'new\\s',
    'env\\(',
    'this\\.',
    'self\\.',
    'window\\.'
  ].join('|') + ')');

function isPlaceholder(value) {
  for (var i = 0; i < PLACEHOLDER_VALUES.length; i++) {
    if (PLACEHOLDER_VALUES[i].test(value)) return true;
  }
  return false;
}

// A real key mixes character classes; a bare English word or a short test
// fixture value does not. Requiring length *and* variety keeps the check
// precise instead of noisy.
function looksLikeCredential(value) {
  if (value.length < 8) return false;

  var hasLower = /[a-z]/.test(value);
  var hasUpper = /[A-Z]/.test(value);
  var hasDigit = /[0-9]/.test(value);
  var hasSymbol = /[^A-Za-z0-9]/.test(value);

  var classes = 0;
  if (hasLower) classes++;
  if (hasUpper) classes++;
  if (hasDigit) classes++;
  if (hasSymbol) classes++;

  return classes >= 3;
}

// Trivially guessable passwords: an allowed charset with very little variety.
function isLowEntropy(value) {
  if (value.length < 6 || value.length > 32) return false;
  if (COMMON_PASSWORDS.indexOf(value.toLowerCase()) !== -1) return true;
  if (!/^[a-z0-9_.!@#$%-]+$/i.test(value)) return false;

  var unique = {};
  for (var i = 0; i < value.length; i++) {
    unique[value.charAt(i)] = true;
  }

  // `password`, `admin`, `changeme` ...
  return Object.keys(unique).length <= 3;
}

// A short list of passwords that show up in real breaches. Exact matches only,
// so this adds signal without adding noise.
var COMMON_PASSWORDS = [
  'letmein', 'password', 'passw0rd', 'admin', 'administrator', 'root',
  'qwerty', 'qwertyuiop', '123456', '12345678', '123456789', 'abc123',
  'welcome', 'monkey', 'dragon', 'iloveyou', 'trustno1', 'master', 'login',
  'princess', 'football', 'shadow', 'sunshine', 'angular', 'angularjs',
  'changeme', 'secret', 'test', 'guest', 'default', 'passw0rd1'
];

function normalize(p) {
  return p.replace(/\\/g, '/');
}

function isSkipped(relPath) {
  for (var i = 0; i < SKIP_PATH_PATTERNS.length; i++) {
    if (SKIP_PATH_PATTERNS[i].test(relPath)) return true;
  }
  return false;
}

function isAllowed(relPath) {
  for (var i = 0; i < ALLOW_FILES.length; i++) {
    if (normalize(ALLOW_FILES[i]) === relPath) return true;
  }
  return false;
}

function isEnvFileAllowed(relPath) {
  for (var i = 0; i < ENV_FILE_ALLOWLIST.length; i++) {
    if (relPath === ENV_FILE_ALLOWLIST[i]) return true;
  }
  return false;
}

function listTrackedFiles() {
  var out = child_process.execFileSync('git', ['ls-files', '-z'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });

  var files = out.split('\0');
  var result = [];
  for (var i = 0; i < files.length; i++) {
    if (files[i]) result.push(normalize(files[i]));
  }
  return result;
}

function readIfText(absPath, size) {
  if (size > MAX_FILE_SIZE) return null;

  var buf;
  try {
    buf = fs.readFileSync(absPath);
  } catch (e) {
    return null;
  }

  // Git only tracks bytes, so a tracked file can still be binary (fixtures,
  // images). A NUL in the first 8KB is a reliable-enough heuristic.
  if (buf.slice(0, 8192).indexOf(0) !== -1) return null;

  return buf.toString('utf8');
}

function finding(type, file, line, message) {
  return {type: type, file: file, line: line, message: message};
}

function scanFile(relPath) {
  var findings = [];
  var absPath = path.join(PROJECT_ROOT, relPath);

  if (ENV_FILE_REGEX.test(relPath) && !isEnvFileAllowed(relPath)) {
    findings.push(finding(
      'env_file', relPath, 0,
      'a local environment file is committed and may contain real credentials. ' +
      'Keep it out of git, commit only the .env.example template, and rotate ' +
      'any credential that was already pushed.'));
  }

  var stat;
  try {
    stat = fs.statSync(absPath);
  } catch (e) {
    return findings;
  }

  var content = readIfText(absPath, stat.size);
  if (content === null) return findings;

  var lines = content.split(/\r?\n/);

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var lineNo = i + 1;
    var ignored = line.indexOf('security-check: ignore') !== -1 ||
      (i > 0 && lines[i - 1].indexOf('security-check: ignore') !== -1);

    if (ignored) continue;

    // 2. Private key material.
    if (PRIVATE_KEY_REGEX.test(line)) {
      findings.push(finding(
        'private_key', relPath, lineNo,
        'private key material is committed. Generate keys locally and inject ' +
        'them from the CI secret store.'));
    }

    // 3. Provider specific credential shapes.
    for (var v = 0; v < VENDOR_PATTERNS.length; v++) {
      if (VENDOR_PATTERNS[v].regex.test(line)) {
        findings.push(finding(
          'vendor_key', relPath, lineNo,
          'a live ' + VENDOR_PATTERNS[v].name +
          ' appears to be committed. Revoke and rotate it now, then load it ' +
          'from the environment instead.'));
      }
    }

    // 4./5. Credential-shaped names assigned a literal value.
    ASSIGNMENT_REGEX.lastIndex = 0;
    var match;
    while ((match = ASSIGNMENT_REGEX.exec(line)) !== null) {
      var name = match[2];
      var quote = match[3];
      var value = match[4];

      if (!SECRET_NAME_REGEX.test(name)) continue;
      if (!quote && IDENTIFIER_VALUE_REGEX.test(value)) continue;
      if (isPlaceholder(value)) continue;
      if (REFERENCE_VALUE_REGEX.test(value)) continue;

      if (isLowEntropy(value)) {
        findings.push(finding(
          'low_entropy', relPath, lineNo,
          '`' + name + '` is assigned the guessable value `' + value +
          '`. Generate credentials with a CSPRNG.'));
      } else if (looksLikeCredential(value)) {
        findings.push(finding(
          'assignment', relPath, lineNo,
          '`' + name + '` is assigned a literal credential (`' +
          value.slice(0, 4) + '...`, ' + value.length +
          ' chars). Read it from the environment or the CI secret store.'));
      }
    }
  }

  return findings;
}

function main() {
  var files;
  try {
    files = listTrackedFiles();
  } catch (e) {
    console.error('Could not list git-tracked files: ' + e.message);
    process.exit(1);
  }

  var scanned = 0;
  var findings = [];

  for (var i = 0; i < files.length; i++) {
    var relPath = files[i];
    if (isSkipped(relPath) || isAllowed(relPath)) continue;
    scanned++;
    findings = findings.concat(scanFile(relPath));
  }

  if (findings.length === 0) {
    console.log('check-secrets: OK - no committed secrets found (' + scanned +
                ' tracked files scanned).');
    return;
  }

  console.error('check-secrets: ' + findings.length +
    ' potential secret(s) in tracked files:\n');
  for (var j = 0; j < findings.length; j++) {
    var f = findings[j];
    console.error('  [' + f.type + '] ' + f.file +
      (f.line ? ':' + f.line : '') + '\n      ' + f.message);
  }
  console.error('');
  console.error('Never commit credentials. Keep them in Travis repository');
  console.error('secrets (Settings -> Environment Variables) or a local,');
  console.error('git-ignored .env. For a known-safe line, put');
  console.error('`security-check: ignore` on the line above it.');

  process.exit(1);
}

if (VERBOSE) {
  console.error('check-secrets: scanning git-tracked files under ' + PROJECT_ROOT);
}

main();
