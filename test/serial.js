var nue = require('../lib/nue');
var start = nue.start;
var serial = nue.serial;
var assert = require('assert');

describe('serial', function() {
  it('should chain functions', function (done) {
    start(serial(
      function () {
        this.next();
      },
      function () {
        this.next();
      },
      function () {
        this.next();
      },
      function () {
        done();
      }
    ));
  });
  it('should chain functions with specified batch size', function (done) {
    start(serial(1)(
      function () {
        this.next();
      },
      function () {
        this.next();
      },
      function () {
        this.next();
      },
      function () {
        done();
      }
    ));
  });
  it('should accept arguments on startup', function (done) {
    start(1, true, 'hoge', serial(
      function (number, boolean, string) {
        assert.strictEqual(number, 1);
        assert.strictEqual(boolean, true);
        assert.strictEqual(string, 'hoge');
        done();
      }
    ));
  });
  it('should pass arguments between functions"', function (done) {
    start(serial(
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
    ));
  });
  it('should ignore duplicated next function calls"', function (done) {
    start(serial(
      function () {
        this.next(this);
      },
      function (arg) {
        arg.next();
        done();
      }
    ));
  });
  it('should share data', function (done) {
    start(serial(
      function () {
        this.data = 'a'; 
        this.next();
      },
      function () {
        this.data += 'b';
        this.next();
      },
      function () {
        this.data += 'c';
        this.next();
      },
      function () {
        assert.strictEqual(this.data, 'abc');
        done();
      }
    ));
  });
  it('should exit from chain with the end function', function (done) {
    start(serial(
      function () {
        this.data = 'a';
        this.next();
      },
      function () {
        this.data += 'b';
        this.end();
      },
      function () {
        this.data += 'c';
        this.next();
      },
      function () {
        assert.strictEqual(this.data, 'ab');
        done();
      }
    ));
  });
});