// Globals
var ProcGen = new Object();

ProcGen.dir = ['up', 'down', 'left', 'right'];
ProcGen.oDir = { up: 'down', down: 'up', left: 'right', right: 'left' };

ProcGen.rand = function(max) {
  return Math.floor(max * Math.random());
}
