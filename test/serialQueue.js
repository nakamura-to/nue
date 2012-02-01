var serialQueue = require('../lib/nue').serialQueue;
var assert = require('assert');

describe('serialQueue', function() {
  it('should chain queued tasks', function (done) {
    var q = serialQueue(
      function (i){
        if (this.isLast) {
          done();
        } else {
          this.next();
        }
      }
    );
    for (var i = 0; i < 10; i++) {
      q.push(i);
    }
    q.complete();
  });
  it('should accept arguments from the previous task', function (done) {
    var q = serialQueue(
      function (value, number, string){
        if (this.index === 0) {
          number = 0;
          string = 'hoge';
        }
        if (this.isLast) {
          assert.strictEqual(number, 6);
          assert.strictEqual(string, 'hoge');
          done();
        } else {
          this.next(value + number, string);
        }
      }
    );
    for (var i = 0; i < 5; i++) {
      q.push(i);
    }
    q.complete();
  });
});