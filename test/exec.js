var flow = require('../lib/nue').flow;
var assert = require('assert');

describe('exec', function() {
  it('should execute other flows', function (done) {
    var add = flow('add')(
      function addStep(x, y) {
        this.next(x + y);
      }
    );

    var mul = flow('mul')(
      function mulStep(x, y) {
        this.next(x * y);
      }
    );

    flow('main')(
      function parallel() {
        this.exec(add, 10, 20, this.async());
        this.exec(mul, 10, 20, this.async());
      },
      function end(result1, result2) {
        assert.ok(!this.err);
        assert.strictEqual(result1, 30);
        assert.strictEqual(result2, 200);
        done();
      }
    )();
  });

  it('should execute other functions', function (done) {
    function add(x, y) {
      this.next(x + y);
    }

    function mul(x, y) {
      this.next(x * y);
    }

    flow('main')(
      function parallel() {
        this.exec(add, 10, 20, this.async());
        this.exec(mul, 10, 20, this.async());
      },
      function end(result1, result2) {
        assert.ok(!this.err);
        assert.strictEqual(result1, 30);
        assert.strictEqual(result2, 200);
        done();
      }
    )();
  });

  it('should validate arguments', function (done) {
    flow('main')(
      function parallel() {
        assert.throws(function () {
          exec(function () {});
        });
        assert.throws(function () {
          exec(1, 2);
        });
        assert.throws(function () {
          exec(function () {}, 2);
        });
        assert.throws(function () {
          exec(1, function () {});
        });
        done();
      }
    )();
  });

});