ProcGen.track = function(params) {
  var track = new Object();
  var min = params.min;
  var max = params.max;
  var minSegmentLength = params.minSegmentLength;
  var maxSegmentLength = params.maxSegmentLength;
  var curviness = params.curviness;
  var maxAngle = params.maxAngle / 360 * Math.PI;
  
  track.data = new Array();
  track.points = ProcGen.rand(max - min) + min;
  
  track.minX = 0;
  track.minY = 0;
  track.maxX = 0;
  track.maxY = 0;
  
  track.data[0] = {x: 250, y: 250};
  direction = 0;
  
  for(i = 1; i < track.points; i++) {
    var len = ProcGen.rand(maxSegmentLength - minSegmentLength) + minSegmentLength;
    var dx = Math.sin(direction) * len;
    var dy = Math.cos(direction) * len;
    var x = track.data[i-1].x + dx;
    var y = track.data[i-1].y + dy;
    track.data[i] = { x: x, y: y };
    turn = Math.pow(Math.random(), 1 / curviness);
    if(Math.random() < .5) turn = -turn;
    direction += turn * maxAngle;
  }
  
  // In the last quarter of the track, force the points progressively closer to the start.
  q = Math.floor(track.points * .75);
  c = track.points - q;
  var x0 = track.data[0].x;
  var y0 = track.data[0].y;
  
  for(i = q; i < track.points; i++) {
    var x = track.data[i].x;
    var y = track.data[i].y;
    var a = i-q;
    track.data[i].x = x0 * a/c + x * (1 - a/c);
    track.data[i].y = y0 * a/c + y * (1 - a/c);
  }
  
  for(i = 1; i < track.points; i++) {  
    x = track.data[i].x;
    y = track.data[i].y;
    if(x < track.minX) track.minX = x;
    if(y < track.minY) track.minY = y;
    if(x > track.maxX) track.maxX = x;
    if(y > track.maxY) track.maxY = y;
    
    track.minSize = Math.min(track.minX, track.minY);
    track.maxSize = Math.max(track.maxX, track.maxY);
  }
  
  return track;
}

ProcGen.drawTrack = function(track) {
  //scale = 500 / (track.maxSize - track.minSize);
  //ctx.setTransform(scale, 0, 0, scale, -track.minSize, -track.minSize);
  ctx.strokeStyle = '#ccc';
  ctx.moveTo(track.data[0].x, track.data[0].y);
  for(i = 1; i <= track.points; i++) {
    var p = i % track.points;
    ctx.lineTo(track.data[p].x, track.data[p].y);
  }
  ctx.stroke();
  
  // To draw the actual track, we need to bisect each line segment and use the center as the curve
  // endpoint, then use the original line endpoints as the control points
  ctx.beginPath();
  ctx.strokeStyle = '#444444';
  ctx.lineWidth = 3;
  for(i = 0; i <= track.points; i++) {
    var p1 = i % track.points;
    var p2 = (i+1) % track.points;
    x = (track.data[p1].x + track.data[p2].x) / 2;
    y = (track.data[p1].y + track.data[p2].y) / 2;
    
    if(i == 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.quadraticCurveTo(track.data[p1].x, track.data[p1].y, x, y);
    }
  }
  
  ctx.stroke();
}