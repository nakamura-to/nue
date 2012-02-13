var nue = require('../lib/nue');
var flow = nue.flow;
var forEach = nue.forEach;
var assert = require('assert');

describe('forEach', function() {
  it('should chain functions with "next"', function (done) {
    flow(
      function () {
        this.next(1, 2, 3, 4, 5);
      },
      forEach(function (i) {
        this.next(i);
      }),
      function (results) {
        assert.ok(!this.err);
        assert.deepEqual(results, [1, 2, 3, 4, 5]);
        done();
      }
    )();
  });
});
