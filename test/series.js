var nue = require('../lib/nue');
var assert = require('assert');

describe('series', function() {
  it('should chain functions', function (done) {
    nue.series(
      function () {
        assert.strictEqual(this.index, 0);
        this.next();
      },
      function () {
        assert.strictEqual(this.index, 1);
        this.next();
      },
      function () {
        assert.strictEqual(this.index, 2);
        this.next();
      },
      function () {
        assert.strictEqual(this.index, 3);
        done();
      }
    )();
  });
  it('should accept arguments on startup', function (done) {
    nue.series(
      function (number, boolean, string) {
        assert.strictEqual(number, 1);
        assert.strictEqual(boolean, true);
        assert.strictEqual(string, 'hoge');
        done();
      }
    )(1, true, 'hoge');
  });
  it('should accept arguments from the previous function"', function (done) {
    nue.series(
      function () {
        this.next(1, true, 'hoge');
      },
      function (number, boolean, string) {
        assert.strictEqual(number, 1);
        assert.strictEqual(boolean, true);
        assert.strictEqual(string, 'hoge');
        this.next(2, false, 'foo');
      },
      function (number, boolean, string) {
        assert.strictEqual(number, 2);
        assert.strictEqual(boolean, false);
        assert.strictEqual(string, 'foo');
        done();
      }
    )();
  });
});