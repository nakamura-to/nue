var nue = require('../lib/nue');
var assert = require('assert');

describe('series', function() {
  it('should invoke next function', function (done) {
    nue.series(
      function () {
        this.next();
      },
      function () {
        done();
      }
    )();
  });
  it('should pass arguments to the first function"', function (done) {
    nue.series(
      function (number, boolean, string) {
        assert.strictEqual(number, 1);
        assert.strictEqual(boolean, true);
        assert.strictEqual(string, 'hoge');
        done();
      }
    )(1, true, 'hoge');
  });
  it('should pass arguments to the next function"', function (done) {
    nue.series(
      function () {
        this.next(1, true, 'hoge');
      },
      function (number, boolean, string) {
        assert.strictEqual(number, 1);
        assert.strictEqual(boolean, true);
        assert.strictEqual(string, 'hoge');
        done();
      }
    )();
  });
  it('should pass arguments to the callback"', function (done) {
    nue.series([
      function () {
        this.next(1);
      },
      function (i) {
        this.next(null, ++i);
      }],
      function (err, data) {
        if (err) throw err;
        assert.strictEqual(data, 2);
        done();
      }
    )();
  });
});