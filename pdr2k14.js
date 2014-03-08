$(function() {
  var Q = Quintus({ development: true }).include("Sprites, Scenes, Input, 2D, Anim, Audio").setup("pdr").controls();
  
  Q.load("tiles.png", function() {
    Q.sheet("tiles", "tiles.png", {
      tilew: 32,
      tileh: 32,
    });
    
    Q.animations("tiles", {
      idle: { frames: [2], rate: 1 },
    });
  });
  
  var track = ProcGen.track({
    min: 20,
    max: 40,
    minSegmentLength: 2,
    maxSegmentLength: 16,
    curviness: .7,  
    maxAngle: 150
  });
  
  var tilemap = new Q.TileLayer({
    tileW: 2,
    tileH: 2,
    sheet: "tiles"
  });
  
  tilemap.p.tiles = new Array();
  for(x = 0; x < 500; x++) {
    tilemap.p.tiles[x] = new Array();
    for(y = 0; y < 500; y++) {
      tilemap.p.tiles[x][y] = 1;
    }
  }
  
  for(i = 0; i < track.points; i++) {
    p1 = i;
    p2 = (i+1) % track.points;
    p3 = (i+2) % track.points;
    
    var t = 10;
    for(j = 0; j < t; j++) {
      x1 = track.data[p1].x * (1 - j/t) + track.data[p2].x * j/t;
      y1 = track.data[p1].y * (1 - j/t) + track.data[p2].y * j/t;
      x2 = track.data[p2].x * (1 - j/t) + track.data[p3].x * j/t;
      y2 = track.data[p2].y * (1 - j/t) + track.data[p3].y * j/t;
      
      x = Math.floor((x1 + x2)/2);
      y = Math.floor((y1 + y2)/2);
      
      for(a = -2; a <= 2; a++) {
        for(b = -2; b <= 2; b++) {          
          if(x + a > 0 && x + a < 500 && y + b > 0 && y + b < 500) {
            if(tilemap.p.tiles[x+a][y+b] == 1) {
              tilemap.p.tiles[x+a][y+b] = 3;
            }
          }
        }
      }
      
      if(x > 0 && x < 500 && y > 0 && y < 500) tilemap.p.tiles[x][y] = 2;
    }
  }
  
  Q.Sprite.extend("Player",{
    init: function(p) {
      this._super(p, { 
        sheet: "tiles", 
        sprite: "tiles", 
        w: 32, 
        h: 32, 
        x: 250*2,
        y: 250*2,
        gravity: 0,
        anim: "idle"
      });

      this.add('animation');      
    },
    
    step: function(dt) {
      if(Q.inputs['right']) {
        console.log('right');
        this.p.x++;
      }
      if(Q.inputs['left']) {
      
        console.log('left');
        this.p.x--;
      }
      if(Q.inputs['up']) {
        console.log('up');
        this.p.y--;
      }
      if(Q.inputs['down']) {
        console.log('down');
        this.p.y++;
      }
    },
  });
  
  Q.scene("map", function(stage) {
    stage.collisionLayer(tilemap);
    var player = stage.insert(new Q.Player());
    stage.add("viewport").follow(player);
  });
  
  Q.stageScene("map");
});