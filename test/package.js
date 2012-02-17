var nue = require('../lib/nue');
var pkg = require('../package.json');
var assert = require('assert');

describe('package.json', function() {
  it('should have same version with nue.js"', function () {
    assert.strictEqual(pkg.version, nue.version);
  });
});