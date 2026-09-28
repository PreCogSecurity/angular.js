# Security Policy

AngularJS is a client-side framework: its attack surface is executed in every
browser that loads it, in applications that frequently render untrusted content.
This document describes how to report a vulnerability, which code is treated as
security critical, and what hardening is expected of applications built on it.

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Report it privately to the maintainers at `security@angularjs.org`, or through
GitHub's private vulnerability reporting for this repository. Please include:

* the affected version or commit,
* a minimal reproduction (markup, scope expressions and controller code are
  enough; a URL is better),
* what an attacker gains, and what access they need to reach it.

We aim to acknowledge a report within 3 business days and to send a remediation
plan or a mitigation within 10 business days.

If a report is already public when it reaches us, treat it as critical: the
remediation is prioritised above all other work on the branch.

### Out of scope

* Vulnerabilities that require the application to call
  `$sce.trustAsHtml()`, `$sce.trustAsUrl()`, `compileProvider.debugInfoEnabled(true)`
  or otherwise opt out of the protections below. Opting out is documented,
  intentional, and moves responsibility to the caller.
* Findings that only reproduce with an attacker-modified build of AngularJS.
* Vulnerabilities in devDependencies. See [Dependency hygiene](#dependency-hygiene).

## Security critical code

Changes to these files are reviewed with security in mind and require an
explicit "does this allow arbitrary script execution?" check. The file headers
carry the same warning.

| File | Why it is critical |
|------|--------------------|
| `src/ngSanitize/sanitize.js` | The HTML allow-list sanitizer. A bypass here is a direct XSS. |
| `src/ng/sanitizeUri.js` | URL scheme allow-list for `a[href]` and `img[src]`. |
| `src/ng/sce.js` | Trusted-Expression / Trusted-Resource types and the delegation chain. |
| `src/ng/compile.js` | The expression sandbox, `$parse` binding and the DOM write path. |
| `src/ng/parse.js` | The expression parser and sandbox. |
| `src/ng/urlUtils.js` | URL normalisation and the same-origin check used by `$sce`. |
| `src/ngSanitize/filter/linky.js` | Builds HTML from untrusted text. |
| `src/ng/http.js`, `src/ng/httpBackend.js` | Outbound requests, headers, CORS and CSRF handling. |

The questions to answer in review, in this order:

1. Can untrusted input cause arbitrary script execution?
2. Can it modify the prototype of a built-in object?
3. Does it widen access to `document`, `window`, or any other global?
4. Does it change the behaviour of the sanitizer or the URL allow-list?

## Hardening expected of applications

* **Never bind untrusted HTML.** Use `ng-bind-html` (which goes through
  `$sanitize`) rather than `ng-bind-angular` with a user supplied template.
* **Prefer `ng-bind` over `ng-bind-html`.** `ng-bind` escapes text; if the
  value is plain text, it is always the right tool.
* **Template URLs.** Only load templates from URLs the application controls.
  A template URL that an attacker can influence is remote code execution,
  because the template is compiled.
* **`ng-include` / `ng-view` / route templates** must not be built from query
  string or fragment values without an allow-list.
* **`ngCsp`** must be enabled so that `eval` is not required for expressions.
* **JSONP** (`$http.jsonp`) executes the response as script. Never point it at a
  URL an attacker can influence.
* **`target="_blank"` links** should carry `rel="noopener noreferrer"`, otherwise
  the opened document receives a `window.opener` reference. The `linky` filter
  documents this; see its `attributes` parameter.
* **Disable the debug data** (`compileProvider.debugInfoEnabled(false)`) in
  production. It exposes scope and expression internals to anything that can
  run script on the page.

## Repository security gates

These run in CI on every push and are the automated counterpart of this policy:

| Gate | Command | What it enforces |
|------|---------|------------------|
| Lint / static analysis | `npm run lint` | `merge-conflict`, `ddescribe`/`iit`, `jshint`, `jscs`. Fails on any violation. |
| Committed-secret scan | `npm run security:check` | No committed `.env` and no inlined credentials (provider-specific key shapes, private keys, literal credential assignments). |
| Lockfile freshness | `npm run verify-lockfile` | `package.json` and the committed `npm-shrinkwrap.json` agree, so installs are reproducible. |
| Dependency audit | `npm run audit-ci` | No `high`/`critical` advisory in a **production** dependency. The full-tree `npm run audit` is informational. |

### Dependency hygiene

This package ships `dependencies: {}`: everything AngularJS puts in a customer's
page is the source under `src/`, and the whole npm tree is build-time only.
That is why the production-dependency gate is the blocking one and the
full-tree audit is advisory - the build tooling is legacy (grunt 0.4, karma
0.13) and cannot be replaced without a migration that is out of scope for a
security fix. Known advisories in the build tree are triaged rather than
silently ignored; anything that could execute during a build (a compromised
package, an install script) is treated as blocking regardless of severity.

### Secrets

* Credentials are **never** committed. `.env` is git-ignored; only
  `.env.example` is tracked.
* CI credentials live in the Travis repository secret store
  (Settings -> Environment Variables), not in `.travis.yml`.
* If a credential is ever pushed, assume it is compromised: rotate it first,
  then clean up the history.

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.5.x | Security fixes only |
| 1.4.x | End of life |
| < 1.4 | End of life |

AngularJS 1.x is in maintenance mode. For new applications, use a supported
framework; if you must stay on AngularJS 1.x, run the gates above and keep
`ngSanitize` enabled in every application that renders untrusted content.
