import { defineConfig } from 'kaukau/config'

export default defineConfig({
  enableLogs: true,
  exitOnFail: true,
  files: 'test/lib',
  ext: '.test.js',
  options: {
    bail: false,
    fullTrace: true,
    grep: '',
    ignoreLeaks: false,
    reporter: 'spec',
    retries: 0,
    slow: 200,
    timeout: 3000,
    ui: 'bdd',
    color: true,
  }
});
