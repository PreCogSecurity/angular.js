AngularJS [![Build Status](https://travis-ci.org/angular/angular.js.svg?branch=master)](https://travis-ci.org/angular/angular.js)
=========

AngularJS lets you write client-side web applications as if you had a smarter browser.  It lets you
use good old HTML (or HAML, Jade and friends!) as your template language and lets you extend HTML's
syntax to express your application's components clearly and succinctly.  It automatically
synchronizes data from your UI (view) with your JavaScript objects (model) through 2-way data
binding. To help you structure your application better and make it easy to test, AngularJS teaches
the browser how to do dependency injection and inversion of control.

It also helps with server-side communication, taming async callbacks with promises and deferreds,
and it makes client-side navigation and deeplinking with hashbang urls or HTML5 pushState a
piece of cake. Best of all? It makes development fun!

* Web site: https://angularjs.org
* Tutorial: https://docs.angularjs.org/tutorial
* API Docs: https://docs.angularjs.org/api
* Developer Guide: https://docs.angularjs.org/guide
* Contribution guidelines: [CONTRIBUTING.md](https://github.com/angular/angular.js/blob/master/CONTRIBUTING.md)
* Dashboard: https://dashboard.angularjs.org

##### Looking for Angular 2 (beta)? Go here: https://github.com/angular/angular

Prerequisites
---------
* **Node.js < 5** — this project targets the Node 4.x LTS line. A `.nvmrc` file is included; run `nvm use` if you use nvm.
* **npm ~2.5** — bundled with the recommended Node version.
* **Google Chrome** — required for the local headless test runner (`karma-local.conf.js`).

`package.json` pins the toolchain with `engines` + `engineStrict`, so `npm install`
refuses to run on an unexpected Node version instead of failing later in an
unreproducible way. Install the exact version the build expects:

    nvm install && nvm use

Building AngularJS
---------
[Once you have set up your environment](https://docs.angularjs.org/misc/contribute), just run:

    grunt package


Running tests
-------------
### Local tests (no external services required)

Run the full jQLite unit test suite in a headless local Chrome with a single command:

    npm run test:local

This uses `karma-local.conf.js` which does **not** need SauceLabs or BrowserStack credentials.

### Verifying a fresh clone

These are the checks CI runs, in the same order. A fresh clone should be able to
run all of them with no credentials and no manual steps:

    npm install                    # preinstall purges stale node_modules
    npm run lint                   # merge-conflict + ddescribe-iit + jshint + jscs
    npm run security:check         # no committed .env, no inlined credentials
    npm run verify-lockfile        # package.json == npm-shrinkwrap.json
    npm run audit-ci               # no high/critical advisory in prod dependencies
    npm run test:local             # jQLite unit tests in headless Chrome

`npm run audit` reports the full dependency tree (build tooling included) and is
informational; only `npm run audit-ci` blocks, because everything under
`dependencies/` ships to customers.

### Cross-browser tests (CI)

The cross-browser suite requires remote browser provider credentials. Copy the example
environment file and fill in the values you need:

    cp .env.example .env

`.env` is git-ignored and must never be committed; CI injects the same variables
from its own secret store. See `.env.example` for the full list of variables
(`BROWSER_PROVIDER`, `BROWSER_PROVIDER_READY_FILE`, `USE_JQUERY`, `SAUCE_USERNAME`,
`SAUCE_ACCESS_KEY`, `BROWSER_STACK_USERNAME`, `BROWSER_STACK_ACCESS_KEY`, `TRAVIS`,
`TRAVIS_BUILD_ID`, `TRAVIS_BUILD_NUMBER`, `TRAVIS_JOB_NUMBER`, `BUILD_NUMBER`,
`LOGS_DIR`). Every one of them is CI-only: local development, `npm run lint` and
`npm run test:local` do not use them.

### End-to-end tests

    grunt package
    grunt test:e2e

### Docker (zero-install)

Run the browser-free CI checks (secret scan, lockfile check, lint, style, static
analysis) and the Promises/A+ test suite in an isolated container — no local Node,
Chrome, or credentials required:

    docker-compose up

To learn more about the grunt tasks, run `grunt --help`

### npm scripts

| Script | What it does |
|--------|--------------|
| `npm run lint` | `grunt ci-checks`: merge-conflict, `ddescribe`/`iit`, `jshint`, `jscs` |
| `npm run test:local` | jQLite unit tests in headless local Chrome |
| `npm run test-i18n` | Jasmine specs for the i18n tooling |
| `npm run test-i18n-ucd` | Jasmine specs for the CLDR extraction pipeline |
| `npm run security:check` | Committed-secret scan (see [SECURITY.md](SECURITY.md)) |
| `npm run verify-lockfile` | Fails if `package.json` and `npm-shrinkwrap.json` drifted apart |
| `npm run audit` | Full-tree `npm audit`, informational |
| `npm run audit-ci` | `npm audit --production`; blocks on high/critical advisories |

## Security

Report vulnerabilities privately — see [SECURITY.md](SECURITY.md) for the
disclosure process, the list of security-critical source files, and the
hardening expected of applications that render untrusted content.

Contribute & Develop
--------------------

We've set up a separate document for our [contribution guidelines](https://github.com/angular/angular.js/blob/master/CONTRIBUTING.md).


[![Analytics](https://ga-beacon.appspot.com/UA-8594346-11/angular.js/README.md?pixel)](https://github.com/igrigorik/ga-beacon)

What to use AngularJS for and when to use it
---------
AngularJS is the next generation framework where each component is designed to work with every other component in an interconnected way like a well-oiled machine. AngularJS is JavaScript MVC made easy and done right. (Well it is not really MVC, read on, to understand what this means.)

#### MVC, no, MV* done the right way!
MVC, short for Model-View-Controller, is a design pattern, i.e. how the code should be organized and how the different parts of an application separated for proper readability and debugging. Model is the data and the database. View is the user interface and what the user sees. Controller is the main link between Model and View. These are the three pillars of major programming frameworks present on the market today. On the other hand AngularJS works on MV*, short for Model-View-_Whatever_. The _Whatever_ is AngularJS's way of telling that you may create any kind of linking between the Model and the View here.

Unlike other frameworks in any programming language, where MVC, the three separate components, each one has to be written and then connected by the programmer, AngularJS helps the programmer by asking him/her to just create these and everything else will be taken care of by AngularJS.

#### Interconnection with HTML at the root level
AngularJS uses HTML to define the user's interface. AngularJS also enables the programmer to write new HTML tags (AngularJS Directives) and increase the readability and understandability of the HTML code. Directives are AngularJS's way of bringing additional functionality to HTML. Directives achieve this by enabling us to invent our own HTML elements. This also helps in making the code DRY (Don't Repeat Yourself), which means once created, a new directive can be used anywhere within the application.

#### Data Handling made simple
Data and Data Models in AngularJS are plain JavaScript objects and one can add and change properties directly on it and loop over objects and arrays at will.

#### Two-way Data Binding
One of AngularJS's strongest features. Two-way Data Binding means that if something changes in the Model, the change gets reflected in the View instantaneously, and the same happens the other way around. This is also referred to as Reactive Programming, i.e. suppose `a = b + c` is being programmed and after this, if the value of `b` and/or `c` is changed then the value of `a` will be automatically updated to reflect the change. AngularJS uses its "scopes" as a glue between the Model and View and makes these updates in one available for the other.

#### Less Written Code and Easily Maintainable Code
Everything in AngularJS is created to enable the programmer to end up writing less code that is easily maintainable and readable by any other new person on the team. Believe it or not, one can write a complete working two-way data binded application in less than 10 lines of code. Try and see for yourself!

#### Testing Ready
AngularJS has Dependency Injection, i.e. it takes care of providing all the necessary dependencies to its controllers whenever required. This helps in making the AngularJS code ready for unit testing by making use of mock dependencies created and injected. This makes AngularJS more modular and easily testable thus in turn helping a team create more robust applications.
