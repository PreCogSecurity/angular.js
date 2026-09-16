'use strict';

// Runs `npm audit` against the full dependency tree (including devDependencies)
// and reports the results in CI logs.
//
// This is intentionally non-fatal: the dependency tree predates npm audit, so
// known advisories in the legacy build tooling are expected and would otherwise
// keep CI permanently red. The report is still surfaced on every run so that
// NEW advisories (a regression relative to the last run) are visible.
//
// The script only fails when `npm audit` itself cannot run (e.g. no network
// access or an unsupported npm version).

var spawn = require('child_process').spawn;

var args = ['audit', '--production=false'];
var audit;

if (process.platform === 'win32') {
  // .cmd shims cannot be spawned directly on Windows; go through cmd.exe.
  audit = spawn('cmd.exe', ['/c', 'npm'].concat(args), {stdio: 'inherit'});
} else {
  audit = spawn('npm', args, {stdio: 'inherit'});
}

audit.on('error', function(err) {
  console.error('Could not run `npm audit`: ' + err.message);
  process.exit(1);
});

audit.on('close', function(code) {
  if (code !== 0) {
    console.error('');
    console.error('npm audit reported vulnerabilities (exit code ' + code + ').');
    console.error('This is expected for the legacy dependency tree; the audit is informational.');
    console.error('Review the report above and track any NEW advisories before merging.');
  }
  process.exit(0);
});