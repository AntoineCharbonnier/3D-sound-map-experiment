Exp = function(setup) {
  if (setup != null) {
    for (var i in setup) {
      this[i] = setup[i];
    }
  }
  var self = this;
  this.ticker = function(t) {
    self.tick(t);
    window.requestAnimationFrame(self.ticker, self.renderer.domElement);
  };

  this.resizer = function(ev) {
    self.resize(window.innerWidth, window.innerHeight);
  };

  // if (window !== top) {

    this.startButton = document.createElement('button');
    document.body.appendChild(this.startButton);
    this.startButton.style.position = 'absolute';
    this.startButton.style.zIndex   = 10;
    this.startButton.textContent    = "Start Exp";
    this.startButton.onclick = function() {
      var frames = window.parent.frames;
      var scripts;
      var reload;
      // for (var i = 0, il = frames.length; i < il; i++) {
      //   if (frames[i] === window || !frames[i].document) {
      //     continue;
      //   }
      //   scripts = frames[i].document.getElementsByTagName('script');
      //   reload = false;
      //   for (var j = 0, jl = scripts.length; j < jl; j++) {
      //     if (scripts[j].src.indexOf('positional_audio.js') !== -1) {
      //       reload = true;
      //       break;
      //     }
      //   }
      //   if (reload) {
      //     frames[i].document.location.reload();
      //   }
      // }
      if (!self.playing) {
        if (!self.initComplete) {
          self.init();
        }
        self.startButton.textContent = "Stop Exp";
        self.play();
      } else {
        self.startButton.textContent = "Start Exp";
        self.stop();
      }
    };

    gyro.frequency = 1000

  // } else {
  //   this.init();
  //   this.play();
  // }
};

Exp.prototype = {
  previousTime:       0,
  maxTimeDelta:       60,
  playing:            false,
  positionEnabled:    true,
  velocityEnabled:    true,
  orientationEnabled: true,
  environmentEnabled: true,
  initComplete:       false,

  init : function() {
    this.initComplete = true;
    this.setupRenderer();
    this.setupCamera();
    this.setupScene();
    this.setupObjects();
  },

  setupRenderer : function() {
    this.renderer = new THREE.WebGLRenderer();
    this.listenToResize();

    var s = this.renderer.domElement.style;
    document.body.appendChild(this.renderer.domElement);
  },

  listenToResize : function() {
    window.addEventListener('resize', this.resizer, false);
    this.resizer();
  },

  resize : function(w, h) {
    this.width  = w;
    this.height = h;
    this.renderer.setSize(this.width, this.height);
  },

  play : function() {
    this.playing = true;
    window.requestAnimationFrame(this.ticker, this.renderer.domElement);
    this.audio.volume.connect(this.audio.context.destination);
  },

  stop : function() {
    this.playing = false;
    this.audio.volume.disconnect();
  },

  tick : function(t) {
    if (!this.playing) {
      return;
    }
    var dt = Math.min(t - this.previousTime, this.maxTimeDelta);
    this.previousTime = t;
    this.update(t, dt);
    this.draw(t, dt);
  },

  draw : function(t, dt) {
    this.renderer.render(this.scene, this.camera);
  },

  setupScene : function() {
    this.scene = new THREE.Scene();
    this.scene.add(this.camera);
  },

  setupAudio : function() {
    var a = {};
    this.audio = a;

    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    a.context       = new AudioContext();
    a.convolver     = a.context.createConvolver();
    a.volume        = a.context.createGain();

    a.mixer         = a.context.createGain();

    a.flatGain      = a.context.createGain();
    a.convolverGain = a.context.createGain();

    a.destination   = a.mixer;
    a.mixer.connect(a.flatGain);
    //a.mixer.connect(a.convolver);
    a.convolver.connect(a.convolverGain);
    a.flatGain.connect(a.volume);
    a.convolverGain.connect(a.volume);
    a.volume.connect(a.context.destination);

    a.environments = {};
    // if (this.environmentEnabled) {
    //   this.loadEnvironment('cathedral');
    //   this.loadEnvironment('filter-telephone');
    //   this.loadEnvironment('echo-chamber');
    //   this.loadEnvironment('bright-hall');
    // }
  },

  // setEnvironment : function(name) {
  //   if (this.audio.environments[name]) {
  //     var cg = 0.7, fg = 0.3;
  //     if (name.match(/^filter-/)) {
  //       cg = 1, fg = 0;
  //     }
  //     this.audio.convolverGain.gain.value = cg;
  //     this.audio.flatGain.gain.value = fg;
  //     this.audio.convolver.buffer = this.audio.environments[name];
  //   } else {
  //     this.audio.flatGain.gain.value = 1;
  //     this.audio.convolverGain.gain.value = 0;
  //   }
  // },

  // loadEnvironment : function(name) {
  //   var self = this;
  //   this.loadBuffer('impulse_responses/'+name+'.wav', function(buffer) {
  //     self.audio.environments[name] = buffer;
  //   });
  // },

  loadBuffer : function(soundFileName, callback) {
    var request          = new XMLHttpRequest();
    request.open("GET", soundFileName, true);
    request.responseType = "arraybuffer";
    var ctx              = this.audio.context;

    request.onload       = function() {
      ctx.decodeAudioData(request.response, callback, function() {
        alert("Decoding the audio buffer failed");
      });
    };

    request.send();
    return request;
  },

  loadSound : function(soundFileName) {
    var ctx = this.audio.context;

    var sound         = {};
    sound.source      = ctx.createBufferSource();
    sound.source.loop = true;
    sound.panner      = ctx.createPanner();
    sound.volume      = ctx.createGain();

    sound.source.connect(sound.volume);
    sound.volume.connect(sound.panner);
    sound.panner.connect(this.audio.destination);

    this.loadBuffer(soundFileName, function(buffer){
      sound.buffer        = buffer;
      sound.source.buffer = sound.buffer;
      sound.source.start(ctx.currentTime + 0.020);
    });

    return sound;
  },

  setupCamera : function() {
    this.camera            = new THREE.PerspectiveCamera( 45, this.width/this.height, 0.01, 1000 );
    this.camera.position.z = 8.00;
    this.camera.position.y = -0.50;
  },

  createSoundCone : function(object, innerAngle, outerAngle, outerGain) {
    var innerScale = 1
    var outerScale = 1;
    var ia         = innerAngle;
    var oa         = outerAngle;
    if (outerAngle > Math.PI) {
      oa         = 2*Math.PI-outerAngle;
      outerScale = -1;
    }
    if (innerAngle > Math.PI) {
      ia         = 2*Math.PI-innerAngle;
      innerScale = -1;
    }

    var height       = 5;
    var innerRadius  = Math.sin(ia / 2) * height;
    var innerHeight  = Math.cos(ia / 2) * height;
    var outerRadius  = Math.sin(oa / 2) * height * 0.9;
    var outerHeight  = Math.cos(oa / 2) * height * 0.9;
    var innerConeGeo = new THREE.CylinderGeometry(0, innerRadius, innerHeight, 100, 1, true);
    var outerConeGeo = new THREE.CylinderGeometry(0, outerRadius, outerHeight, 100, 1, true);

    var innerCone = new THREE.Mesh(
      innerConeGeo,
      new THREE.MeshBasicMaterial({color: 0x00ff00, opacity: 0.5})
    );
    innerCone.material.side        = THREE.DoubleSide;
    innerCone.material.transparent = true;
    innerCone.material.blending    = THREE.AdditiveBlending;
    innerCone.material.depthWrite  = false;
    innerCone.scale.y              = innerScale;
    innerCone.position.y           = -innerHeight / 2 * innerScale;
    var outerCone = new THREE.Mesh(
      outerConeGeo,
      new THREE.MeshBasicMaterial({color: 0xff0000, opacity: 0.5})
    );
    outerCone.material.side        = THREE.DoubleSide;
    outerCone.material.transparent = true;
    outerCone.material.blending    = THREE.AdditiveBlending;
    outerCone.material.depthWrite  = false;
    outerCone.scale.y              = outerScale;
    outerCone.position.y           = -outerHeight / 2 * outerScale;

    var cones = new THREE.Object3D();
    cones.add(innerCone);
    cones.add(outerCone);
    cones.rotation.x = -Math.PI/2;
    object.add(cones);

    object.sound.panner.coneInnerAngle = innerAngle * 180 / Math.PI;
    object.sound.panner.coneOuterAngle = outerAngle * 180 / Math.PI;
    object.sound.panner.coneOuterGain  = outerGain;
  },

  setupObjects : function() {
    this.setupAudio();

    var cubeGeo = new THREE.BoxGeometry(1.20,1.20,2.00);
    var cubeMat = new THREE.MeshLambertMaterial({color: 0xFF0000});
    var cube    = new THREE.Mesh(cubeGeo, cubeMat);
    this.cube   = cube;
    this.cube.name = "light it up"

    var cubeGeo2 = new THREE.BoxGeometry(1.20,1.20,2.00);
    var cubeMat2 = new THREE.MeshLambertMaterial({color: 0xFFFF00});
    var cube2    = new THREE.Mesh(cubeGeo2, cubeMat2);
    this.cube2   = cube2;
    this.cube2.name = "all my love"



    this.sphereFromCube1 = new THREE.Mesh(
        new THREE.SphereGeometry(40, 32, 32),
        new THREE.MeshBasicMaterial(
          {
            color: 0x0040ff,
            side: THREE.DoubleSide,
            wireframe: true
          }
        )
    );

    this.sphereFromCube2 = new THREE.Mesh(
        new THREE.SphereGeometry(40, 32, 32),
        new THREE.MeshBasicMaterial(
          {
            color: 0xff0040,
            side: THREE.DoubleSide,
            wireframe: true
          }
        )
    );


    this.spotLightMesh = new THREE.SphereGeometry( 0.5, 16, 8 );
    this.colorLight1   = 0x0040ff;
    this.colorLight2   = 0xff0040;

    this.light1 = new THREE.PointLight( this.colorLight1, 2, 500, 50 );
    this.light1.add( new THREE.Mesh( this.spotLightMesh, new THREE.MeshBasicMaterial( { color: this.colorLight1 } ) ) );

    this.light2 = new THREE.PointLight( this.colorLight2, 2, 500, 50 );
    this.light2.add( new THREE.Mesh( this.spotLightMesh, new THREE.MeshBasicMaterial( { color: this.colorLight2 } ) ) );

    this.scene.add(this.cube);
    this.scene.add(this.cube2);
    this.scene.add(this.sphereFromCube1);
    this.scene.add(this.sphereFromCube2);
    this.scene.add(this.light1);
    this.scene.add(this.light2);

    this.cube.position.z  = -50
    this.cube2.position.z = 50


    console.log(this.cube.position, this.cube2.position)

    this.light1.position.x          = 0
    this.light1.position.y          = 0
    this.light1.position.z          = 0


    this.light2.position.x          = 0
    this.light2.position.y          = 0
    this.light2.position.z          = 100

    this.sphereFromCube1.position.x = 0
    this.sphereFromCube1.position.y = 0
    this.sphereFromCube1.position.z = 0

    this.sphereFromCube2.position.x = 0
    this.sphereFromCube2.position.y = 0
    this.sphereFromCube2.position.z = 100

    console.log(this.sphereFromCube2.position, this.sphereFromCube1.position)

    this.cube.rotation.y  = -Math.PI / 4
    this.cube2.rotation.y = Math.PI / 4

    var light        = new THREE.PointLight(0xFFFFFF);
    light.position.x = 4.00;
    light.position.y = 4.00;
    light.position.z = 4.00;
    this.light       = light;
    this.scene.add(light);


    var plane = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(2000, 2000, 2000, 2000),
      new THREE.MeshLambertMaterial({color: 0xffffff})
    );
    plane.position.y = -5.0;
    plane.rotation.x = -Math.PI / 2;
    this.scene.add(plane);

    // cube.sound  = this.loadSound('light-it-up.mp3');
    // cube2.sound = this.loadSound('all-my-love.mp3');
    cube.sound  = this.loadSound('tinush.mp3');
    cube2.sound = this.loadSound('barbes.mp3');
    if (this.orientationEnabled) {
      this.createSoundCone(cube, 10, 10.5, 0.001);
      this.createSoundCone(cube2, 10, 10.5, 0.001); // grande portée , presque ciruclaire ?
      // this.createSoundCone(cube2, 0.5, 1.5, 0.001); // petit cone sympa
      // this.createSoundCone(cube2, 1.0, 3.8, 0.001);
    }

    this.keyForward = this.keyBackward = this.keyLeft = this.keyRight = false;
    var self = this;
    var down = false;
    var mx   = 0;
    var my   = 0;
    this.camera.target = new THREE.Object3D();

    this.xangle = Math.PI;
    this.yangle = 0;

    window.addEventListener('mousedown', function(ev) {
      mx   = ev.clientX;
      my   = ev.clientY;
      down = true;
    }, false);
    window.addEventListener('mouseup', function() {
      down = false;
    }, false);
    window.addEventListener('mousemove', function(ev) {
      if (down) {
        var dx      = ev.clientX - mx;
        var dy      = ev.clientY - my;
        mx          = ev.clientX;
        my          = ev.clientY;
        self.xangle -= dx / 100;
        self.yangle = Math.min(Math.PI / 2, Math.max(-Math.PI / 2, self.yangle-dy / 100));
      }
    }, false);

    window.addEventListener('touchmove', function(event) {
      // If there's exactly two finger inside this element
      if (event.targetTouches.length == 2) {
        self.keyForward = true
      }
    }, false);

    // gyro.startTracking(function(o) {
    //     // o.x, o.y, o.z for accelerometer
    //     // o.alpha, o.beta, o.gamma for gyro
    //     console.log(o.alpha, o.beta, o.gamma)
    // });

    window.addEventListener('keydown', function(ev) {
       switch (ev.keyCode) {
        case 'W'.charCodeAt(0):
        case 38:
          self.keyForward = true; break;
        case 'S'.charCodeAt(0):
        case 40:
          self.keyBackward = true; break;
        case 'A'.charCodeAt(0):
        case 37:
          self.keyLeft = true; break;
        case 'D'.charCodeAt(0):
        case 39:
          self.keyRight = true; break;
      }
    }, false);
    window.addEventListener('keyup', function(ev) {
      switch (ev.keyCode) {
        case 'W'.charCodeAt(0):
        case 38:
          self.keyForward = false; break;
        case 'S'.charCodeAt(0):
        case 40:
          self.keyBackward = false; break;
        case 'A'.charCodeAt(0):
        case 37:
          self.keyLeft = false; break;
        case 'D'.charCodeAt(0):
        case 39:
          self.keyRight = false; break;
      }
    }, false);
  },

  updateCameraTarget: function() {
    var lx = Math.sin(this.xangle);
    var ly = Math.sin(this.yangle);
    var lz = Math.cos(this.xangle);
    this.camera.target.position.set(
      this.camera.position.x + lx,
      this.camera.position.y + ly,
      this.camera.position.z + lz
    );
  },

  setPositionAndVelocity : function(object, audioNode, x, y, z, dt) {
    var p = new THREE.Vector3();
    var q = new THREE.Vector3();
    p.setFromMatrixPosition(object.matrixWorld);
    var px = p.x
    var py = p.y
    var pz = p.z
    object.position.set(x,y,z);
    object.updateMatrixWorld();
    q.setFromMatrixPosition(object.matrixWorld);
    var dx = q.x - px
    var dy = q.y - py
    var dz = q.z - pz
    if (this.positionEnabled) {
      audioNode.setPosition(q.x, q.y, q.z);
    }
    if (this.velocityEnabled) {
      audioNode.setVelocity(dx / dt, dy / dt, dz / dt);
    }
  },

  setPosition : function(object, x, y, z, dt) {
    this.setPositionAndVelocity(object, object.sound.panner, x, y, z, dt);
    if (this.orientationEnabled) {
      var vec = new THREE.Vector3(0,0,1);
      var m   = object.matrixWorld;
      var mx  = m.elements[12]
      var my  = m.elements[13]
      var mz  = m.elements[14]
      m.elements[12] = m.elements[13] = m.elements[14] = 0;
      vec.applyProjection(m);
      vec.normalize();
      object.sound.panner.setOrientation(vec.x, vec.y, vec.z);
      m.elements[12] = mx;
      m.elements[13] = my;
      m.elements[14] = mz;
    }
  },

  setListenerPosition : function(object, x, y, z, dt) {
    this.setPositionAndVelocity(object, this.audio.context.listener, x, y, z, dt);
    if (this.orientationEnabled) {
      var m  = object.matrix;
      var mx = m.elements[12]
      var my = m.elements[13]
      var mz = m.elements[14]
      m.elements[12] = m.elements[13] = m.elements[14] = 0;

      var vec = new THREE.Vector3(0,0,1);
      vec.applyProjection(m);
      vec.normalize();

      var up = new THREE.Vector3(0,-1,0);
      up.applyProjection(m);
      up.normalize();

      this.audio.context.listener.setOrientation(vec.x, vec.y, vec.z, up.x, up.y, up.z);

      m.elements[12] = mx;
      m.elements[13] = my;
      m.elements[14] = mz;
    }
  },

  updateObjectVolume: function(object, camera) {
    var objectPosition = object.position
    var cameraPosition = camera.position
    var distanceObjectCamera = Math.sqrt( Math.pow((cameraPosition.x - objectPosition.x), 2) + Math.pow((cameraPosition.z - objectPosition.z), 2))

    // console.log(object.name,1 - (distanceObjectCamera * 2)/100)

    if(1 - (distanceObjectCamera * 2)/100 > 0){
      object.sound.volume.gain.value = 1 - (distanceObjectCamera * 2)/100
    }
  },

  update : function(t, dt) {
    this.updateCameraTarget();

    var cp    = this.camera.position;
    var camZ  = cp.z
    var camX  = cp.x
    var camY  = cp.y
    var vz    = Math.cos(this.xangle);
    var vx    = Math.sin(this.xangle);
    var speed = 1 / 60;

    if (this.keyForward) {
      camX += vx * dt * speed;
      camZ += vz * dt * speed;
    }
    if (this.keyBackward) {
      camX -= vx * dt * speed;
      camZ -= vz * dt * speed;
    }
    if (this.keyLeft) {
      camZ -= vx * dt * speed;
      camX -= -vz * dt * speed;
    }
    if (this.keyRight) {
      camZ += vx * dt * speed;
      camX += -vz * dt * speed;
    }
    this.camera.lookAt(this.camera.target.position);
    this.setListenerPosition(this.camera, camX, camY, camZ, dt / 1000);

    if (this.velocityEnabled && this.orientationEnabled) {
      this.cube.rotation.x += dt / 1000;
    }
    // this.cube.rotation.y += dt/800;
    var cx = Math.cos(t / 3000) * 5.00;
    var cz = Math.sin(t / 3000) * 5.00;
    if (this.velocityEnabled && !this.orientationEnabled) {
      cx = Math.cos(t / 1500) * 5.00;
      cz = Math.sin(t / 1500) * 50.00 + -10;
    }
    // var cy = Math.sin(t / 600) * 1.50;
    var cy = 0;

    this.setPosition(this.cube, 0, 0, 0, dt / 1000);
    this.setPosition(this.cube2, 0, 0, 0 + 100, dt / 1000);
    this.updateObjectVolume(this.cube, this.camera)
    this.updateObjectVolume(this.cube2, this.camera)
    // console.log(this.cube.sound.volume.gain.value)
  }

};
