FROM node:4

# The browser-free CI checks (jshint, jscs, ddescribe-iit, merge-conflict) and
# the Promises/A+ test suite do not require Chrome or any external services,
# making them suitable for an isolated container build.

WORKDIR /app

# Copy the files needed for `npm install` first so dependency installation can
# be cached independently of source changes.
COPY package.json npm-shrinkwrap.json ./
COPY scripts/npm/ scripts/npm/
COPY scripts/security/ scripts/security/

# Install npm dependencies. The preinstall script purges stale node_modules;
# the postinstall script caches the shrinkwrap for future staleness checks.
RUN npm install

# grunt-cli is not part of the devDependencies; it is installed globally.
RUN npm install -g grunt-cli

# Copy the rest of the source tree.
COPY . .

# Run the secret/lockfile gates, then lint + style checks, then the Promises/A+
# compliance suite. Any gate that fails aborts the container with a non-zero
# exit code.
CMD ["sh", "-c", "node scripts/security/check-secrets.js && node scripts/npm/verify-lockfile.js && grunt ci-checks && grunt test:promises-aplus"]