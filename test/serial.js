var serial = require('../lib/nue').serial;
var assert = require('assert');

describe('serial', function() {
  it('should chain functions', function (done) {
    serial(
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
  it('should chain functions with specified batch size', function (done) {
    serial(1)(
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
    serial(
      function (number, boolean, string) {
        assert.strictEqual(number, 1);
        assert.strictEqual(boolean, true);
        assert.strictEqual(string, 'hoge');
        done();
      }
    )(1, true, 'hoge');
  });
  it('should pass arguments between functions"', function (done) {
    serial(
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
  it('should ignore duplicated next function calls"', function (done) {
    serial(
      function () {
        this.next(this);
      },
      function (arg) {
        arg.next();
        done();
      }
    )();
  });
});