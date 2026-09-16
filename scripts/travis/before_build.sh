#!/bin/bash

set -e

mkdir -p $LOGS_DIR

# Verify the lockfile (npm-shrinkwrap.json) is in sync with package.json.
echo "Verifying lockfile..."
node scripts/npm/verify-lockfile.js

# Run a dependency audit (informational; does not fail the build).
echo "Running dependency audit..."
node scripts/npm/audit.js

if [ $JOB != "ci-checks" ]; then
  echo "start_browser_provider"
  ./scripts/travis/start_browser_provider.sh
fi

npm install -g grunt-cli

if [ $JOB != "ci-checks" ]; then
  grunt package
  echo "wait_for_browser_provider"
  ./scripts/travis/wait_for_browser_provider.sh
fi
