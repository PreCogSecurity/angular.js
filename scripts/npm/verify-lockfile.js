'use strict';

// Verifies that npm-shrinkwrap.json is in sync with package.json.
//
// The repository pins its dependency tree with a committed npm-shrinkwrap.json
// (the npm 2.x-era equivalent of a lockfile). This script fails with a non-zero
// exit code when a dependency listed in package.json is missing from the
// shrinkwrap or has drifted to a different exact version, so CI can catch
// accidental dependency changes before they are merged.

var path = require('path');

var PROJECT_ROOT = path.join(__dirname, '../..');
var pkg = require(path.join(PROJECT_ROOT, 'package.json'));
var shrinkwrap = require(path.join(PROJECT_ROOT, 'npm-shrinkwrap.json'));

var errors = [];

function checkDeps(deps, section) {
  if (!deps) return;

  Object.keys(deps).forEach(function(name) {
    var wrapped = shrinkwrap.dependencies && shrinkwrap.dependencies[name];

    if (!wrapped) {
      errors.push('Missing from npm-shrinkwrap.json: ' + name + ' (' + section + ')');
      return;
    }

    var expected = deps[name];
    var actual = wrapped.version;

    // Git URL specs (e.g. "https://github.com/org/repo.git#branch") are pinned
    // by the `resolved` commit in the shrinkwrap, so there is no version to
    // compare. Presence in the shrinkwrap is sufficient.
    if (isGitUrl(expected)) return;

    // Exact pins must match the shrinkwrap. Ranges (^, ~, x) are only checked
    // for presence, since the shrinkwrap is the source of truth for the exact
    // version that gets installed.
    if (actual && isExact(expected) && expected !== actual) {
      errors.push(
          'Version mismatch for ' + name + ': package.json wants ' + expected +
          ' but npm-shrinkwrap.json has ' + actual);
    }
  });
}

function isExact(range) {
  return range.indexOf('^') !== 0 && range.indexOf('~') !== 0 && range.indexOf('x') === -1;
}

function isGitUrl(spec) {
  return spec.indexOf('git://') === 0 || spec.indexOf('git+') === 0 ||
      spec.indexOf('https://github.com/') === 0 || spec.indexOf('git@') === 0;
}

checkDeps(pkg.dependencies, 'dependencies');
checkDeps(pkg.devDependencies, 'devDependencies');

if (errors.length > 0) {
  console.error('npm-shrinkwrap.json is out of sync with package.json:');
  errors.forEach(function(err) {
    console.error('  - ' + err);
  });
  console.error('Run `npm install` and commit the updated npm-shrinkwrap.json.');
  process.exit(1);
}

console.log('npm-shrinkwrap.json is in sync with package.json.');