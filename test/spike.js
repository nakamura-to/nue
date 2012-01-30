var nue = require('../lib/nue');
var assert = require('assert');

describe('spike', function() {
  it('should complete parallel execution', function (done) {
    var result = 0;
    nue.parallel(
      [ function(i){ result += i; },
        function(i){ result += i; },
        function(i){ result += i; },
        function(i){ result += i; },
        function(i){ result += i; } ],
      function(err){
        if (err) throw err;
        assert.strictEqual(result, 5);
        done();
      }
    )(1);
  });
  it('should complete series execution"', function (done) {
    nue.series(
      [ function (i) { this.next(++i); },
        function (i) { this.next(++i); },
        function (i) { this.next(++i); },
        function (i) { this.next(++i); },
        function (i) { this.next(++i); } ],
      function (i) {
        assert.strictEqual(i, 6);
        done();
      }
    )(1);
  });
  it('should complete parallel queue execution"', function (done) {
    var result = 0;
    var q = nue.parallelQueue(
      function (i){
        result += i;
      },
      function (err) {
        if (err) throw err;
        assert.strictEqual(result, 45);
        done();
      }
    );
    for (var i = 0; i < 10; i++) {
      q.push(i);
    }
    q.complete();
  });
  it('should complete series queue execution"', function (done) {
    var result = 0;
    var q = nue.seriesQueue(
      function (i){
        result += i;
        this.next();
      },
      function (err) {
        if (err) throw err;
        assert.strictEqual(result, 45);
        done();
      }
    );
    for (var i = 0; i < 10; i++) {
      q.push(i);
    }
    q.complete();
  });
});