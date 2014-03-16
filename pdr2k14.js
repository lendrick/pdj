$(function() {
  var Q = Quintus({ development: true, audioSupported: ['ogg'] }).include("Sprites, Scenes, Input, 2D, Anim, Audio").setup("pdr").controls();   
  
  var terrain = [
    0,
    {
      name: 'finish',
      traction: 1,
      speed: 1
    },
    
    {
      name: 'road',
      traction: 1,
      speed: 1
    },
    
    {
      name: 'edge',
      traction: 1,
      speed: 1
    },    
    
    {
      name: 'gravel',
      traction: .5,
      speed: .7
    },
    
    {
      name: 'dirt',
      traction: .5,
      speed: .5
    },

    {
      name: 'grass',
      traction: .3,
      speed: .3
    },
    
  ];
  
  var tilemap;
  var obstacles;
  var track;
  var enemyCheckpoints;
  var mapContext = $('#map')[0].getContext('2d');
  var allCars;
  var paused = true;
  var player;
  var currentTarget = false;
  var prevTarget = false;
  
  Q.SPRITE_CAR = 64;
  Q.SPRITE_BULLET = 128;
  
  Q.setImageSmoothing(false);
  
  Q.Sprite.extend("Smoke",{
    init: function(p) {
      this._super(p, { 
        color: '#eeeeee',
        frame: 2,
        w: 8, 
        h: 8, 
        vx: 0,
        vy: 0,
        life: 1,
        type: Q.SPRITE_PARTICLE,
        spriteType: 'particle'
      });   
    },
    
    step: function(dt) {
      this.p.life -= dt;
      this.p.opacity = this.p.life;
      if(this.p.life <= 0) this.destroy();
    }
  });
  
  Q.Sprite.extend("Player",{
    init: function(p) {
      this._super(p, { 
        sheet: "cars", 
        frame: 9,
        w: 64, 
        h: 64, 
        x: 250*32,
        y: 250*32,
        vx: 0,
        vy: 0,
        speed: 0,
        angle: 180,
        maxSpeed: 500,
        accel: 200,
        brake: 200,
        turnSpeed: 200,
        traction: 500,
        gravity: 0,
        guns: new Array(),
        prevPosition: 0,
        position: 0,
        realPosition: 0,
        fired: false,
        spriteType: 'car',
        maxLife: 100,
        life: 100,
        lap: 0,
        maxEnergy: 100,
        energy: 100,
        energyRegen: 20
      });
      this.add("2d");
      this.p.type |= Q.SPRITE_CAR;
      $('#playerPortrait .portrait').show().css('background-position', (this.p.frame * 64) + "px 0");
    },
    
    step: function(dt) {
      if(paused) return;
      
      this.p.energy += this.p.energyRegen * dt;
      this.p.energy = Math.min(this.p.energy, this.p.maxEnergy);
      
      $('#playerPortrait .energyBar').css('width', Math.floor(this.p.energy / this.p.maxEnergy * 100) + "%");
      $('#playerPortrait .healthBar').css('width', Math.floor(this.p.life / this.p.maxLife * 100) + "%");
      
      if(currentTarget && !prevTarget) {
        $('#targetPortrait').show();
      }
      
      if(currentTarget && currentTarget != prevTarget) {
        $('#targetPortrait .portrait').css('background-position', (currentTarget.p.frame * 64) + "px 0");
      }
      
      if(prevTarget && !currentTarget) {
        $('#targetPortrait').hide();
      }
      
      if(currentTarget) {
        $('#targetPortrait .energyBar').css('width', Math.floor(currentTarget.p.energy / currentTarget.p.maxEnergy * 100) + "%");
        $('#targetPortrait .healthBar').css('width', Math.floor(currentTarget.p.life / currentTarget.p.maxLife * 100) + "%");
        $('#targetPortrait .lap').html("Lap " + (currentTarget.p.lap+1) + " / " + track.laps);        
        $('#targetPortrait .place').html(currentTarget.p.place + " / " + allCars.length);
      }
      
      prevTarget = currentTarget;      
      
      var tx = Math.floor(this.p.x / tilemap.p.w);
      var ty = Math.floor(this.p.y / tilemap.p.h);
      var tile = 1;
      if(tx >= 0 && tx < 500 && ty > 0 && ty < 500) {
        tile = tilemap.p.tiles[ty][tx];
      }
      
      var realSpeed = Math.sqrt(this.p.vx*this.p.vx + this.p.vy*this.p.vy);
      
      var traction = this.p.traction * terrain[tile]['traction'];
      var maxSpeed = this.p.maxSpeed * terrain[tile]['speed'];
      
      //console.log(tx, ", " , ty, ": ", tile);
      
      if(Q.inputs['right']) {
        this.p.angle = (this.p.angle + this.p.turnSpeed * dt) % 360;
      }
      if(Q.inputs['left']) {
        this.p.angle = (this.p.angle - this.p.turnSpeed * dt) % 360;
      }
      
      if(Q.inputs['up']) {
        if(this.p.speed > 0) {
          this.p.speed = Math.min(this.p.speed + dt * this.p.accel, maxSpeed);
        } else {
          this.p.speed = Math.min(this.p.speed + dt * this.p.brake, maxSpeed);
        }
      }
      
      if(Q.inputs['down']) {
        if(this.p.speed < 0) {
          this.p.speed -= dt * this.p.accel;
        } else {
          this.p.speed -= dt * this.p.brake;
        }
      }
      
      if(!Q.inputs['up'] && !Q.inputs['down']) {
        if(this.p.speed > 0) {
          this.p.speed = Math.max(0, this.p.speed - dt * maxSpeed * 3);
        } else {
          this.p.speed = Math.min(0, this.p.speed + dt * maxSpeed * 3);
        }
      }
      
      var rad = this.p.angle * Math.PI / 180;     

      if(this.p.speed > realSpeed + this.p.accel * dt) {
        this.p.speed = realSpeed + this.p.accel * dt;
      }
      
      //$('#lap').html(Math.floor(this.p.speed) + " / " + Math.floor(realSpeed));
      
      // Find intended vector
      var ivx = Math.sin(rad) * this.p.speed;
      var ivy = -Math.cos(rad) * this.p.speed;
      
      // Change actual vector to match intended vector (but only as much as traction will allow)
      var dvx = ivx - this.p.vx;
      var dvy = ivy - this.p.vy;
      
      var dDist = Math.sqrt(dvx * dvx + dvy * dvy);
      if(dDist <= traction * dt) {
        this.p.vx = ivx;
        this.p.vy = ivy;
      } else {
        this.p.vx += dvx * (traction * dt) / dDist;
        this.p.vy += dvy * (traction * dt) / dDist;
        
        if(Math.random() < .2) {
          var b = this.stage.insert(new Q.Smoke({
            x: this.p.x, 
            y: this.p.y
          }));
        }
      }
      
      if(Q.inputs['fire'] && !this.p.fired) {
        for(var g in this.p.guns) {
          this.p.guns[g].fire();
        }
      }
      
      $('#playerMarker').css({left: this.p.x / 32 * 150/500 - 3, top: this.p.y / 32 * 150/500 - 3});
      
      this.p.prevPosition = this.p.position;
      this.p.position = Math.atan2(this.p.y - 250*32, this.p.x - 250*32) / Math.PI * 180;
      if(this.p.position < 0) this.p.position += 360;

      if(this.p.prevPosition >= 358 && this.p.position <= 2) {
        this.p.lap++;
        $('#playerPortrait .lap').html("Lap " + (this.p.lap+1) + " / " + track.laps);
      } else if(this.p.prevPosition <= 2 && this.p.position >= 358) {
        this.p.lap--;
        $('#playerPortrait .lap').html("Lap " + (this.p.lap+1) + " / " + track.laps);
      }
      
      this.p.realPosition = this.p.lap * 360 + this.p.position;
      
      allCars.sort(sortCars);
      this.p.place = allCars.length - allCars.indexOf(this);
      $('#playerPortrait .place').html(this.p.place + " / " + allCars.length);
      
      // Cross the finish line...
      if(this.p.lap > track.laps) {
        paused = true; 
        Q.pauseGame();
        $('#overlay').fadeIn();
        $('#countdown').show().fadeIn();
        $('#countdown').html("PLACE: " + this.p.place);
      }
      
      // Eliminate all other cars...
      if(allCars.length == 1) {
        paused = true; 
        Q.pauseGame();
        $('#overlay').fadeIn();
        $('#countdown').show().fadeIn();
        $('#countdown').html("WIN!");
      }      
    },
    
    collision: function(objs) {
      console.log(objs);
    }
  });
  
  Q.Sprite.extend("Enemy",{
    init: function(p) {
      this._super(p, { 
        sheet: "cars", 
        frame: 6,
        w: 64, 
        h: 64, 
        x: 250*32,
        y: 250*32,
        vx: 0,
        vy: 0,
        speed: 0,
        angle: 180,
        maxSpeed: 450,
        accel: 190,
        brake: 200,
        turnSpeed: 200,
        traction: 500,
        gravity: 0,
        currentCheckpoint: 1,
        lookAhead: 5,
        marker: '',
        guns: new Array(),
        position: 0,
        prevPosition: 0,
        realPosition: 0,
        spriteType: 'car',
        maxLife: 100,
        life: 100,
        lap: 0,
        maxEnergy: 100,
        energy: 100,
        energyRegen: 1
      });
      this.add("2d");
      this.p.type |= Q.SPRITE_CAR;
    },
    
    step: function(dt) {
      if(paused) return;
      if(this.p.life <= 0) {
        for(g in this.p.guns) {
          this.p.guns[g].destroy();
        }
        $(this.p.marker).fadeOut();
        allCars.splice(allCars.indexOf(this), 1);
        if(currentTarget == this) currentTarget = false;
        this.destroy();
        return;
      }
      
      this.p.energy += this.p.energyRegen * dt;
      this.p.energy = Math.min(this.p.energy, this.p.maxEnergy);
      
      var tx = Math.floor(this.p.x / tilemap.p.w);
      var ty = Math.floor(this.p.y / tilemap.p.h);
      var tile = 1;
      if(tx >= 0 && tx < 500 && ty > 0 && ty < 500) {
        tile = tilemap.p.tiles[ty][tx];
      }
      
      var realSpeed = Math.sqrt(this.p.vx*this.p.vx + this.p.vy*this.p.vy);
      
      var traction = this.p.traction * terrain[tile]['traction'];
      var maxSpeed = this.p.maxSpeed * terrain[tile]['speed'];
      
      //console.log(this.p.x, ", " , this.p.y);
      var cx = enemyCheckpoints[this.p.currentCheckpoint].x;
      var cy = enemyCheckpoints[this.p.currentCheckpoint].y;
      var cdx = cx - this.p.x;
      var cdy = cy - this.p.y;
      var cdist = Math.sqrt(cdx*cdx + cdy*cdy);
      
      /*
      this.stage.insert(new Q.Smoke({
        x: cx, 
        y: cy
      }));
      */
      
      while(cdist < this.p.lookAhead*32) {
        this.p.currentCheckpoint++;
        if(this.p.currentCheckpoint >= enemyCheckpoints.length) {
          this.p.currentCheckpoint -= enemyCheckpoints.length;
        }
        cx = enemyCheckpoints[this.p.currentCheckpoint].x;
        cy = enemyCheckpoints[this.p.currentCheckpoint].y;
        cdx = cx - this.p.x;
        cdy = cy - this.p.y;
        cdist = Math.sqrt(cdx*cdx + cdy*cdy);
        
        /*
        this.stage.insert(new Q.Smoke({
          x: cx, 
          y: cy
        }));
        */
      }
      
      var cangle = Math.atan2(-cdx, cdy);      
      cangle = cangle / (Math.PI * 2) * 360;
      
      //console.log(cx, ", " , cy, ": " + cdist + " / " + cangle);
      //console.log(this.p.currentCheckpoint);

      var checkpointAngle = (cangle - this.p.angle) % 360;
      if(checkpointAngle < 0) checkpointAngle += 360;
      if(checkpointAngle > 180) {
        this.p.angle = (this.p.angle + this.p.turnSpeed * dt) % 360;
      }
      if(checkpointAngle < 180) {
        this.p.angle = (this.p.angle - this.p.turnSpeed * dt) % 360;
      }
      
      //if(checkpointAngle > 150 && checkpointAngle < 210) 
        this.p.speed = Math.min(this.p.speed + dt * this.p.accel, maxSpeed);
        
      if(this.p.speed > realSpeed + this.p.accel * dt) {
        this.p.speed = realSpeed + this.p.accel * dt;
      }
      
      var rad = this.p.angle * Math.PI / 180;
      
      // Find intended vector
      var ivx = Math.sin(rad) * this.p.speed;
      var ivy = -Math.cos(rad) * this.p.speed;
      
      // Change actual vector to match intended vector (but only as much as traction will allow)
      var dvx = ivx - this.p.vx;
      var dvy = ivy - this.p.vy;
      
      var dDist = Math.sqrt(dvx * dvx + dvy * dvy);
      if(dDist <= traction * dt) {
        this.p.vx = ivx;
        this.p.vy = ivy;
      } else {
        this.p.vx += dvx * (traction * dt) / dDist;
        this.p.vy += dvy * (traction * dt) / dDist;
        
        if(Math.random() < .2) {
          var b = this.stage.insert(new Q.Smoke({
            x: this.p.x, 
            y: this.p.y
          }));
        }
      }
      
      //this.p.x += this.p.vx;
      //this.p.y += this.p.vy;
      this.p.prevPosition = this.p.position;
      this.p.position = Math.atan2(this.p.y - 250*32, this.p.x - 250*32) / Math.PI * 180;
      if(this.p.position < 0) this.p.position += 360;

      if(this.p.prevPosition >= 358 && this.p.position <= 2) {
        this.p.lap++;
      } else if(this.p.prevPosition <= 2 && this.p.position >= 358) {
        this.p.lap--;
      }
      
      this.p.realPosition = this.p.lap * 360 + this.p.position;
      this.p.place = allCars.length - allCars.indexOf(this);
      
      $(this.p.marker).css({left: this.p.x / 32 * 150/500 - 3, top: this.p.y / 32 * 150/500 - 3});
    },
  });
  
  Q.Sprite.extend("Gun",{
    init: function(p) {
      this._super(p, { 
        sheet: "guns", 
        x: 0,
        y: 0,
        car: false,        
        type: Q.SPRITE_PARTICLE,
        mountX: 0,
        mountY: 0,
        muzzleVelocity: 500,
        damage: 0,
        spriteType: 'gun',
        rof: 0,
        nextShot: 0,
        energy: 5
      });
    },
    
    step: function(dt) {
      this.p.cx = this.p.w / 2 + this.p.mountX;
      this.p.cy = this.p.h / 2 + this.p.mountY;
      if(this.p.nextShot > 0) this.p.nextShot -= dt;
      
      // No need to do anything here.  We let the car handle it
      if(this.p.car) { // should never be false, but just in case.
        this.p.x = this.p.car.p.x;
        this.p.y = this.p.car.p.y;
        this.p.angle = this.p.car.p.angle;
      }
    },
    
    fire: function() {
      if(this.p.nextShot > 0) return;
      if(this.p.car.p.energy < this.p.energy) return;
      this.p.car.p.energy -= this.p.energy;
      this.p.nextShot = this.p.rof;
      var angle = this.p.angle / 180 * Math.PI;
      var car = this.p.car;
      var b = this.stage.insert(new Q.Bullet());
      b.p.frame = this.p.frame;
      b.p.x = this.p.x + Math.cos(angle) * this.p.mountX * ((this.p.flip == 'x') ? 1 : -1);
      b.p.y = this.p.y + Math.sin(angle) * this.p.mountX * ((this.p.flip == 'x') ? 1 : -1);
      b.p.vx = car.p.vx + Math.sin(angle) * this.p.muzzleVelocity;
      b.p.vy = car.p.vy - Math.cos(angle) * this.p.muzzleVelocity;
      b.p.angle = this.p.angle;
      b.p.car = car;
      b.p.damage = this.p.damage;
    }
  });
  
  Q.Sprite.extend("Bullet",{
    init: function(p) {
      this._super(p, { 
        sheet: "bullets", 
        frame: 0,
        x: 0,
        y: 0,
        car: false,  
        type: Q.SPRITE_DEFAULT,
        sensor: true,
        life: 3,
        gravity: 0,
        spriteType: 'bullet',
        collisionMask: Q.SPRITE_CAR,
        damage: 50
      });
      this.on("hit",this,"collision");
    },
    
    step: function(dt) {
      if(paused) return;
      this.p.life -= dt;
      if(this.p.life <= 0) this.destroy();
      this.p.x += this.p.vx * dt;
      this.p.y += this.p.vy * dt;
      var c = this.stage.collide(this);
    },
    
    collision: function(c) {
      if(c.obj.p.type | Q.SPRITE_CAR && c.obj != this.p.car) {
        c.obj.p.life -= this.p.damage;
        //if(this.p.car == player) {
          currentTarget = c.obj;
        //}
        this.destroy();
      }
    }
  });
  
  Q.scene("map", function(stage) { 
    track = ProcGen.track({
      min: 40,
      max: 80,
      minSegmentLength: 6,
      maxSegmentLength: 16,
      curviness: .7,  
      maxAngle: 150
    });
    
    console.log("Building track...");
    tilemap = new Q.TileLayer({
      tileW: 32,
      tileH: 32,
      sheet: "tiles",      
    });
    
    obstacles = new Q.TileLayer({
      tileW: 32,
      tileH: 32,
      sheet: "tiles",
    });
    
    tilemap.p.tiles = new Array();
    obstacles.p.tiles = new Array();
    for(var x = 0; x < 500; x++) {
      tilemap.p.tiles[x] = new Array();
      obstacles.p.tiles[x] = new Array();
      for(var y = 0; y < 500; y++) {
        tilemap.p.tiles[x][y] = 6;
        obstacles.p.tiles[x][y] = 0;
      }
    }
    
    var start = {};
    var startAngle = 180;
    enemyCheckpoints = [];
    console.log(track);
    
    for(var i = 0; i < track.points; i++) {
      var p1 = i;
      var p2 = (i+1) % track.points;
      var p3 = (i+2) % track.points;
      
      var mx1 = (track.data[p1].x + track.data[p2].x) / 2;
      var my1 = (track.data[p1].y + track.data[p2].y) / 2;
      var mx2 = (track.data[p2].x + track.data[p3].x) / 2;
      var my2 = (track.data[p2].y + track.data[p3].y) / 2;  
      
      var t = 30;
      for(var j = 0; j < t; j++) {
        var x1 = mx1 * (1 - j/t) + track.data[p2].x * j/t;
        var y1 = my1 * (1 - j/t) + track.data[p2].y * j/t;
        
        var x2 = track.data[p2].x * (1 - j/t) + mx2 * j/t;
        var y2 = track.data[p2].y * (1 - j/t) + my2 * j/t;
        
        var y = x1 * (1-j/t) + x2 * j/t;
        var x = y1 * (1-j/t) + y2 * j/t;
        
        var width = track.data[p1].width * (1 - j/t) + track.data[p2].width * j/t;
        
        enemyCheckpoints.push({y: x * 32, x: y * 32});
        
        x = Math.floor(x);
        y = Math.floor(y);
        
        if(i == 0 && j == 0) {
          start.x = y;
          start.y = x;
          console.log(start);
        }
        
        for(var a = -9; a <= 9; a++) {
          for(var b = -9; b <= 9; b++) {          
            if(x + a > 0 && x + a < 500 && y + b > 0 && y + b < 500) {
              var d = Math.sqrt(a * a + b * b);
              var tile = 6;
              if(d <= width - 1) {
                if(x+a == 250 && y+b > 250) {
                  tile = 1;
                } else {
                  tile = 2;
                }
              } else if(d <= width) {
                tile = 3;
              } else if(d <= width + 1) {
                tile = 4;
              } else if(d <= width + 3) {
                tile = 5;
              }
              if(tilemap.p.tiles[x+a][y+b] > tile) {
                tilemap.p.tiles[x+a][y+b] = tile;
              }
            }
          }
        }
      }
    }
    
    var cdx = enemyCheckpoints[1].x - enemyCheckpoints[0].x;
    var cdy = enemyCheckpoints[1].y - enemyCheckpoints[0].y;
    
    startAngle = Math.atan2(cdx, -cdy) * 360 / (Math.PI * 2);
    
    for(var x = 0; x < 500; x++) {
      for(var y = 0; y < 500; y++) {
        if(tilemap.p.tiles[x][y] == 4 && Math.random() < .02) {
          //obstacles.p.tiles[x][y] = 25;
        }
      }
    }
    console.log("done");
  
    allCars = [];
  
    stage.insert(tilemap);
    stage.collisionLayer(obstacles);
    player = stage.insert(new Q.Player());
    player.p.x = start.x * 32;
    player.p.y = start.y * 32;
    player.p.angle = startAngle;
    allCars.push(player);

    addGun(player, 2);
    stage.add("viewport").follow(player);
    
    for(var i = 0; i < 20; i++) {
      var enemy = stage.insert(new Q.Enemy());
      enemy.p.x = enemyCheckpoints[(i+1)*10].x;
      enemy.p.y = enemyCheckpoints[(i+1)*10].y;
      enemy.p.currentCheckpoint = (i+1)*10;
      enemy.p.lookAhead = ProcGen.rand(5) + 10;
      enemy.p.angle = startAngle;
      enemy.p.frame = ProcGen.rand(6) + 6;
      enemy.p.marker = '#marker-' + i;
      addGun(enemy, ProcGen.rand(6));
      allCars.push(enemy);
    }
    
    ProcGen.drawTrack(track, mapContext, 20, 150);
    $('#playerPortrait .lap').html("Lap 1 / " + track.laps);
  });
  
  Q.load("terrain.png, race_or_die5.png, pdrbullets.png, pdrguns.png, pdrpowerups.png", startRace);

  function startRace() {
    Q.sheet("tiles", "terrain.png", {
      tilew: 32,
      tileh: 32,
    });
    
    Q.sheet("cars", "race_or_die5.png", {
      tilew: 64,
      tileh: 64,
    });
    
    Q.sheet("guns", "pdrguns.png", {
      tilew: 16,
      tileh: 32,
    });
    
    Q.sheet("bullets", "pdrbullets.png", {
      tilew: 16,
      tileh: 16,
    });
    
    Q.sheet("powerups", "pdrpowerups.png", {
      tilew: 32,
      tileh: 16,
    });

    Q.stageScene("map");
    $('#overlay').fadeOut();
    var timeLeft = 3;
    $('#countdown').html(timeLeft).show();
    $('#pdr').focus();
    var interval = window.setInterval(function() {
      timeLeft--;

      if(timeLeft <= 0) {
        paused = false;          
        $('#countdown').fadeOut();
        $('#countdown').html("GO!");
        window.clearInterval(interval);
      }
      $('#countdown').html(timeLeft);
      console.log('tick');
    }, 1000);
  }
  
  function addGun(car, g) {
    var gun = car.stage.insert(new Q.Gun());
    car.p.guns.push(gun);
    gun.p.car = car;
    gun.p.frame = g;
    switch(g) {
      case 0:
        gun.p.mountX = 20;
        gun.p.damage = 10;
        gun.p.rof = .1;
        gun.p.muzzleVelocity = 800;
        
        var gun2 = car.stage.insert(new Q.Gun());
        car.p.guns.push(gun2);
        gun2.p.rof = .1;
        gun2.p.damage = 10;
        gun2.p.car = car;
        gun2.p.frame = 0;
        gun2.p.mountX = 20;
        gun2.p.flip = 'x';
        gun2.p.muzzleVelocity = 800;
        car.p.guns.push(gun2);

        break;
      case 1:
        gun.p.mountY = -10;
        gun.p.damage = 34;
        gun.p.rof = .5;
        gun.p.muzzleVelocity = 350;
        break;
      case 2:
        gun.p.mountX = 20;
        gun.p.damage = 4;
        gun.p.rof = .03;
        gun.p.muzzleVelocity = 1600;
        
        var gun2 = car.stage.insert(new Q.Gun());
        car.p.guns.push(gun2);
        gun2.p.rof = .03;
        gun2.p.damage = 4;
        gun2.p.car = car;
        gun2.p.frame = 2;
        gun2.p.mountX = 20;
        gun2.p.flip = 'x';
        gun2.p.muzzleVelocity = 1600;
        car.p.guns.push(gun2);
        break;
      case 3:
        gun.p.mountX = 20;
        gun.p.damage = 15;
        gun.p.rof = .1;
        gun.p.muzzleVelocity = 550;
        
        var gun2 = car.stage.insert(new Q.Gun());
        car.p.guns.push(gun2);
        gun2.p.rof = .1;
        gun2.p.damage = 15;
        gun2.p.car = car;
        gun2.p.frame = 3;
        gun2.p.mountX = 20;
        gun2.p.flip = 'x';
        gun2.p.muzzleVelocity = 550;
        car.p.guns.push(gun2);
        break;
      case 4:
        gun.p.mountY = -30;
        gun.p.damage = 34;
        gun.p.rof = .1;
        gun.p.muzzleVelocity = 350;
        break;
      case 5:
        gun.p.mountY = -30;
        gun.p.damage = 34;
        gun.p.rof = .5;
        gun.p.muzzleVelocity = 350;
        break;      
    }    
  }
  
  function sortCars(a, b) {
    if(a.p.realPosition < b.p.realPosition) {
      return -1;
    } else if(a.p.realPosition > b.p.realPosition) {
      return 1;
    }
    
    return 0;
  }
});

