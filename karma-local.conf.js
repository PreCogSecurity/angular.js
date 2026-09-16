'use strict';

var angularFiles = require('./angularFiles');
var sharedConfig = require('./karma-shared.conf');

module.exports = function(config) {
  sharedConfig(config, {testName: 'AngularJS: local', logFile: 'karma-local.log'});

  config.set({
    files: angularFiles.mergeFilesFor('karma'),
    exclude: angularFiles.mergeFilesFor('karmaExclude'),

    // Local-only test run: uses a headless local Chrome and does not require
    // SauceLabs or BrowserStack credentials. See .env.example for the optional
    // variables that are only needed for cross-browser CI runs.
    //
    // The pinned karma-chrome-launcher (0.2.x) predates the built-in
    // `ChromeHeadless` launcher, so it is defined here as a custom launcher
    // that runs the locally installed Chrome with the headless flags.
    customLaunchers: {
      ChromeHeadless: {
        base: 'Chrome',
        flags: ['--headless', '--disable-gpu', '--remote-debugging-port=9222']
      }
    },
    browsers: ['ChromeHeadless'],
    singleRun: true,
    autoWatch: false,

    junitReporter: {
      outputFile: 'test_out/local.xml',
      suite: 'local'
    }
  });
};