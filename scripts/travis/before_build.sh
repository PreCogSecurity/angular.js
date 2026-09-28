#!/bin/bash

set -e

mkdir -p $LOGS_DIR

# The dependency and secret hygiene gates (verify-lockfile, security:check,
# audit-ci) run as explicit, visible steps in .travis.yml so that a failure is
# attributed to the right check. They are not repeated here.

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
