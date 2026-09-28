'use strict';

// Dependency audit.
//
// Two modes:
//
//   node scripts/npm/audit.js                 full tree (dev + prod), report only
//   node scripts/npm/audit.js --production    shipped dependencies only, gating
//
// The distinction matters for a release: this package ships
// `dependencies: {}`, so everything AngularJS actually puts in a customer's
// page is the source in `src/`, and the entire npm tree is build-time only.
// Vulnerabilities in the legacy build tooling are real and cannot be fixed
// without migrating off grunt 0.4 / karma 0.13, so they are reported but do not
// break the build. A high or critical advisory in a *production* dependency
// does break the build, because that reaches customers.
//
// Failure policy:
//   * high/critical advisory in a production dependency -> exit 1 (gate)
//   * `npm audit` unavailable or unparseable          -> warn loudly, exit 0
//     (the pinned toolchain is npm 2.x, which has no `npm audit`; failing the
//     build on a missing tool would make the gate unrunnable rather than safe)
//   * anything else                                    -> exit 0
//
// Usage: node scripts/npm/audit.js [--production]

var spawn = require('child_process').spawn;

var PRODUCTION = process.argv.indexOf('--production') !== -1;

// `npm audit` is always asked for JSON: npm exits non-zero when it finds
// vulnerabilities, so the exit code cannot distinguish "found problems" from
// "failed to run", and only the structured report can be classified by
// severity. The human readable summary is printed from that report below.
var auditArgs = ['audit', '--json'];
if (PRODUCTION) auditArgs.push('--production');

var BLOCKING_SEVERITIES = ['high', 'critical'];

function run() {
  var npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  var options = {stdio: ['ignore', 'pipe', 'pipe']};
  var audit;

  if (process.platform === 'win32') {
    // .cmd shims cannot be spawned directly on Windows; go through cmd.exe.
    audit = spawn('cmd.exe', ['/c', npmBin].concat(auditArgs), options);
  } else {
    audit = spawn(npmBin, auditArgs, options);
  }

  var stdout = '';
  var stderr = '';
  var settled = false;

  audit.stdout.on('data', function(chunk) { stdout += chunk; });
  audit.stderr.on('data', function(chunk) { stderr += chunk; });

  audit.on('error', function(err) {
    if (settled) return;
    settled = true;
    console.error('Could not run `npm audit`: ' + err.message);
    process.exit(0);
  });

  audit.on('close', function(code) {
    if (settled) return;
    settled = true;

    // npm exits non-zero when it finds vulnerabilities, so the exit code alone
    // cannot be used to detect "the audit failed to run".
    var report = tryParse(stdout);

    if (!report) {
      console.warn('');
      console.warn('SECURITY NOTICE: `npm audit` produced no parsable report');
      console.warn('(exit code ' + code + '). This is expected on the pinned');
      console.warn('toolchain, which is npm 2.x and predates `npm audit`.');
      console.warn('Run the audit with a modern npm before a release.');
      if (stderr) console.warn(stderr.trim().split('\n').slice(0, 10).join('\n'));
      process.exit(0);
    }

    handleReport(report, code);
  });
}

function tryParse(stdout) {
  var start = stdout.indexOf('{');
  if (start === -1) return null;
  try {
    return JSON.parse(stdout.slice(start));
  } catch (e) {
    return null;
  }
}

// npm 7+ reports `vulnerabilities`; npm 3-6 report `advisories`. Support both.
function collectAdvisories(report) {
  if (report.vulnerabilities && typeof report.vulnerabilities === 'object') {
    var modern = [];
    Object.keys(report.vulnerabilities).forEach(function(name) {
      var entry = report.vulnerabilities[name] || {};
      modern.push({
        name: name,
        severity: entry.severity || 'unknown',
        direct: !!entry.isDirect,
        via: (entry.via || []).map(function(via) {
          return typeof via === 'string' ? via : (via.title || via.name);
        })
      });
    });
    return modern;
  }

  var legacy = [];
  Object.keys(report.advisories || {}).forEach(function(id) {
    var advisory = report.advisories[id] || {};
    legacy.push({
      name: advisory.module_name || id,
      severity: advisory.severity || 'unknown',
      direct: false,
      via: [advisory.title || advisory.module_name || id]
    });
  });
  return legacy;
}

function isBlocking(severity) {
  var normalized = String(severity).toLowerCase();
  return BLOCKING_SEVERITIES.indexOf(normalized) !== -1;
}

function handleReport(report, code) {
  var advisories = collectAdvisories(report);
  var blocking = advisories.filter(function(a) { return isBlocking(a.severity); });

  if (advisories.length === 0) {
    console.log('npm audit: no known vulnerabilities in the ' +
                (PRODUCTION ? 'production' : 'full') + ' dependency tree.');
    process.exit(0);
  }

  var bySeverity = {};
  advisories.forEach(function(a) {
    bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
  });

  console.log('npm audit: ' + advisories.length + ' advisories in the ' +
              (PRODUCTION ? 'production' : 'full') + ' dependency tree.');
  Object.keys(bySeverity).sort().forEach(function(severity) {
    console.log('  ' + severity + ': ' + bySeverity[severity]);
  });

  if (!PRODUCTION) {
    console.log('');
    advisories.forEach(function(a) {
      console.log('  [' + a.severity + '] ' + a.name +
        (a.direct ? ' (direct)' : '') + (a.via.length ? ': ' + a.via[0] : ''));
    });
    console.log('');
    console.log('These are informational: the whole npm tree is build-time only');
    console.log('for this package. Review the list above and track NEW advisories');
    console.log('before merging. `npm run audit-ci` gates production dependencies.');
    process.exit(0);
  }

  if (blocking.length === 0) {
    console.log('');
    console.log('No high or critical advisories in production dependencies. OK.');
    process.exit(0);
  }

  console.error('');
  console.error('BLOCKING: ' + blocking.length +
    ' high/critical advisories in production dependencies:');
  blocking.forEach(function(a) {
    console.error('  - [' + a.severity + '] ' + a.name +
      (a.direct ? ' (direct)' : '') + ': ' + a.via.join('; '));
  });
  console.error('');
  console.error('Production dependencies ship to customers. Fix or remove these');
  console.error('before merging, or record a reviewed exception.');

  process.exit(1);
}

module.exports = {isBlocking: isBlocking, collectAdvisories: collectAdvisories,
  BLOCKING_SEVERITIES: BLOCKING_SEVERITIES};

if (require.main === module) {
  run();
}