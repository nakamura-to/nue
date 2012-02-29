var flow = require('../lib/nue').flow;
var parallel = require('../lib/nue').parallel;
var assert = require('assert');

describe('parallel', function() {
  it('should execute functions in parallel', function (done) {
    var a;
    var b;
    var log = '';
    flow(
      parallel(
        function () {
          setTimeout(function () {
            a = true;
            log += 'a';
            this.next('AAA');
          }.bind(this), 10);
        },
        function () {
          b = true;
          log += 'b';
          this.next('BBB');
        }
      ),
      function (results) {
        assert.ok(!this.err);
        assert.ok(a);
        assert.ok(b);
        assert.strictEqual(log, 'ba');
        assert.deepEqual(['AAA', 'BBB'], results);
        done();
      }
    )();
  });

  it('should exit using `end`', function (done) {
    flow(
      parallel(
        function () {
          setTimeout(function () {
            this.end('AAA');
          }.bind(this), 10);
        },
        function () {
          this.end('BBB');
        }
      ),
      function (results) {
        assert.ok(!this.err);
        assert.strictEqual(results[0], 'AAA');
        assert.strictEqual(results[1], 'BBB');
        done();
      }
    )();
  });

  it('should exit using `endWith`', function (done) {
    var a;
    var b;
    var log = '';
    flow(
      parallel(
        function () {
          setTimeout(function () {
            a = true;
            log += 'a';
            this.endWith(new Error('AAA'));
          }.bind(this), 10);
        },
        function () {
          b = true;
          log += 'b';
          this.endWith(new Error('BBB'));
        }
      ),
      function () {
        assert.ok(this.err);
        assert.strictEqual(this.err.cause.message, 'BBB');
        assert.ok(!a);
        assert.ok(b);
        assert.strictEqual(log, 'b');
        done();
      }
    )();
  });

  it('should accept arguments from previous step', function (done) {
    flow(
      function () {
        this.next(10, 20);
      },      
      parallel('aaa')(
        function add(x, y) {
          this.next(x + y);
        },
        function mul(x, y) {
          this.next(x * y);
        }
      ),
      function (results) {
        assert.ok(!this.err);
        assert.strictEqual(results[0], 30);
        assert.strictEqual(results[1], 200);
        done();
      }
    )();
  });

});