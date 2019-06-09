#!/usr/bin/env node

const actioner = require('./actioner');
const payload = require('./payload-example.json')

var start = new Date()
var times = 10

function callback() {
  var end = new Date() - start
  console.info('Execution time: %dms', end)
}

for (var i = 0; i < times; i++) {
  actioner.run(payload, callback);
}
