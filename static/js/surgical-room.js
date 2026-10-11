// Furniture proportions and materials follow the supplied experiment recordings.
// Measurements and human geometry are visual approximations, not a scene scan.
import * as T from '../vendor/three/three.module.js';

export function buildSurgicalRoom(scene, environment = null) {
  const room = new T.Group();
  scene.add(room);
  let seed = 37;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const material = (color, extra = {}) => new T.MeshStandardMaterial({ color, roughness: .78, ...extra });
  const steel = material('#b5b9bd', { metalness: .7, roughness: .33 });
  const black = material('#26282b', { roughness: .65 });
  const blue = material('#2598cf', { roughness: .94, side: T.DoubleSide });
  const linen = material('#edeee9', { side: T.DoubleSide, roughness: .99 });
  const gray = material('#a6a6ab', { side: T.DoubleSide, roughness: .96 });
  const white = material('#e4e6e2');
  const skin = material('#ba937c', { roughness: .9 });
  const gown = material('#246b59', { roughness: 1 });

  function mesh(geometry, mat, parent = room, pos = [0, 0, 0]) {
    const m = new T.Mesh(geometry, mat);
    m.position.set(...pos); m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  }
  function box(w, d, h, mat, pos, parent = room) { return mesh(new T.BoxGeometry(w, d, h), mat, parent, pos); }
  function ball(scale, mat, pos, parent = room) {
    const m = mesh(new T.SphereGeometry(1, 24, 18), mat, parent, pos); m.scale.set(...scale); return m;
  }
  function rod(a, b, radius, mat, parent = room, topRadius = radius) {
    const p = new T.Vector3(...a), q = new T.Vector3(...b), delta = q.clone().sub(p);
    const m = mesh(new T.CylinderGeometry(topRadius, radius, delta.length(), 14), mat, parent);
    m.position.copy(p.add(q).multiplyScalar(.5));
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize()); return m;
  }
  function fabricTexture(color) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 18000; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.035)';
      ctx.fillRect(rand() * 256, rand() * 256, 1, 1);
    }
    const tex = new T.CanvasTexture(c); tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.colorSpace = T.SRGBColorSpace; tex.repeat.set(5, 5); return tex;
  }
  blue.map = fabricTexture('#158fc5'); blue.color.set('#e3f0fa');
  linen.map = fabricTexture('#eeeee9'); linen.color.set('#ffffff');
  gown.map = fabricTexture('#276d59'); gown.color.set('#ffffff');

  // Keep the legacy environment available for comparison; never overlay it on GLB.
  if (!environment) {
  // Rubber tile floor, with the small light flecks visible in the recordings.
  const floorCanvas = document.createElement('canvas'); floorCanvas.width = floorCanvas.height = 512;
  const fc = floorCanvas.getContext('2d'); fc.fillStyle = '#343436'; fc.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 23000; i++) {
    fc.fillStyle = ['#454546','#575757','#666660','#7e7d73','#2b2c2d'][i % 5];
    const size = .4 + rand() * 1.4; fc.fillRect(rand() * 512, rand() * 512, size, size);
  }
  fc.strokeStyle = '#242528'; fc.lineWidth = 2; fc.strokeRect(0, 0, 512, 512);
  const floorTexture = new T.CanvasTexture(floorCanvas); floorTexture.colorSpace = T.SRGBColorSpace;
  floorTexture.wrapS = floorTexture.wrapT = T.RepeatWrapping; floorTexture.repeat.set(7, 6);
  box(5.25, 4.35, .07, material('#a1a1a1', { map: floorTexture, roughness: .96 }), [0, 0, -.06]);
  const backdrop = mesh(new T.PlaneGeometry(200, 200), material('#f0f0f2'), scene, [0, 0, -.101]);
  backdrop.receiveShadow = true;

  // Draped privacy screens: fabric folds, hem, visible rail, and narrow uprights.
  function curtain(x, y, width, height, rotation, mat) {
    const group = new T.Group(); group.position.set(x, y, 0); group.rotation.z = rotation; room.add(group);
    const geo = new T.PlaneGeometry(width, height, 90, 28), a = geo.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const u = a.getX(i), z = a.getY(i) + height / 2;
      const ripple = .025 * Math.sin(u * 35) + .02 * Math.sin(u * 17 + z * 2) + .009 * Math.sin(u * 68 + z * 3);
      a.setXYZ(i, u, ripple + .035 * Math.pow(1 - z / height, 2), z + .035 + .02 * Math.sin(u * 5) * (1 - z / height));
    }
    geo.computeVertexNormals(); mesh(geo, mat, group);
    rod([-width / 2, 0, height + .04], [width / 2, 0, height + .04], .013, steel, group);
    for (const xPos of [-width / 2, width / 2]) {
      rod([xPos, 0, .025], [xPos, 0, height + .09], .012, steel, group);
      rod([xPos, -.19, .015], [xPos, .19, .015], .013, black, group);
    }
    for (let xPos = -width / 2 + .08; xPos < width / 2; xPos += .22) {
      const ring = mesh(new T.TorusGeometry(.02, .004, 6, 12), white, group, [xPos, 0, height + .03]);
      ring.rotation.y = Math.PI / 2;
    }
  }
  curtain(-1.32, 1.88, 2.55, 1.85, 0, linen);
  curtain(1.26, 1.88, 2.55, 1.85, 0, linen);
  curtain(-2.56, .58, 2.6, 1.83, Math.PI / 2, linen);
  curtain(2.56, 1.18, 1.4, 2.05, Math.PI / 2, gray);

  function drapeEdge(width, depth, side, parent) {
    const drop = .20, geo = new T.PlaneGeometry(width, drop, 60, 10), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), t = (drop / 2 - p.getY(i)) / drop;
      const wave = .009 * Math.sin(x * 38) + .012 * Math.sin(x * 17 + t * 3);
      p.setXYZ(i, x, side * (depth / 2 + .01 + wave * t), .745 - t * drop + .012 * Math.sin(x * 8) * t);
    }
    geo.computeVertexNormals(); mesh(geo, blue, parent);
  }
  function table(x, y, w, d) {
    const group = new T.Group(); group.position.set(x, y, 0); room.add(group);
    box(w, d, .032, white, [0, 0, .722], group);
    for (const dx of [-w / 2 + .035, w / 2 - .035]) for (const dy of [-d / 2 + .035, d / 2 - .035]) {
      box(.031, .031, .70, steel, [dx, dy, .36], group);
      box(.038, .038, .035, black, [dx, dy, .012], group);
    }
    box(w - .02, .02, .055, steel, [0, d / 2 - .025, .66], group);
    box(w - .02, .02, .055, steel, [0, -d / 2 + .025, .66], group);
    const g = new T.PlaneGeometry(w + .018, d + .018, 55, 45), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i), py = p.getY(i);
      p.setZ(i, .746 + .0015 * Math.sin(px * 38 + py * 13) + .001 * Math.sin(py * 50));
    }
    g.computeVertexNormals(); mesh(g, blue, group);
    drapeEdge(w, d, -1, group); drapeEdge(w, d, 1, group);
    const ends = new T.Group(); ends.rotation.z = Math.PI / 2; group.add(ends);
    drapeEdge(d, w, -1, ends); drapeEdge(d, w, 1, ends);
    return group;
  }
  // The two supply/transfer tables face one another across the open aisle.
  // The operating table sits beside that aisle, on the right in the recording.
  const operating = table(1.40, -.62, 1.05, 1.72);
  const handover = table(-.90, -1.38, 1.38, .76);
  const sterile = table(-1.35, 1.20, 1.24, .86);

  function tray(parent, x, y, w = .25, d = .17) {
    box(w, d, .015, steel, [x, y, .762], parent);
    for (const s of [-1, 1]) {
      box(w, .008, .028, steel, [x, y + s * d / 2, .778], parent);
      box(.008, d, .028, steel, [x + s * w / 2, y, .778], parent);
    }
  }
  function bottle(parent, x, y, height, color, capColor) {
    const body = material(color, { metalness: .05, roughness: .36 });
    rod([x, y, .751], [x, y, .751 + height], .029, body, parent);
    rod([x, y, .751 + height], [x, y, .772 + height], .026, material(capColor), parent);
    rod([x, y, .8], [x, y, .8 + height * .3], .0294, white, parent);
  }
  tray(sterile, .35, .18); bottle(sterile, .22, .15, .20, '#e6e7e2', '#878e94');
  bottle(sterile, .40, -.03, .13, '#d5ebed', '#5967c1');
  // Handover-table inventory follows the supplied isolated reference photograph.
  tray(handover, -.32, -.11, .40, .26);
  box(.16, .11, .018, material('#218dc4'), [-.40, -.13, .788], handover);
  const capBlue = material('#164cdd', { roughness: .4 });
  const cupMaterial = material('#cedfe6', { roughness: .36, metalness: .05 });
  function specimenCup(x, y, z = .752) {
    rod([x,y,z],[x,y,z+.095],.035,cupMaterial,handover);
    rod([x,y,z+.095],[x,y,z+.11],.041,capBlue,handover);
    for(let i=0;i<18;i++) {
      const a=i*Math.PI*2/18;
      rod([x+.04*Math.cos(a),y+.04*Math.sin(a),z+.096],[x+.04*Math.cos(a),y+.04*Math.sin(a),z+.109],.0013,white,handover);
    }
  }
  specimenCup(-.20,-.09,.782); specimenCup(.43,-.13);
  // Rounded lidded stainless container between the tray and the spare cup.
  const tin = mesh(new T.CylinderGeometry(1,1,.069,32),steel,handover,[.17,-.12,.79]);
  tin.rotation.x=Math.PI/2; tin.scale.set(.058,1,.095);
  const lid = mesh(new T.CylinderGeometry(1,1,.01,32),steel,handover,[.17,-.12,.829]);
  lid.rotation.x=Math.PI/2; lid.scale.set(.061,1,.098);
  // White-and-cyan dispenser with a narrow nozzle.
  rod([-.05,.20,.755],[-.05,.20,.97],.036,white,handover);
  for(const z of [.79,.85,.93]) rod([-.05,.20,z],[-.05,.20,z+.032],.0365,material('#25b4d4'),handover);
  rod([-.05,.20,.97],[-.05,.20,1.015],.015,white,handover);
  rod([-.05,.20,1.015],[-.05,.20,1.055],.006,white,handover);
  // Tall graduated vessel: gray cap, narrow stem, and visible volume markings.
  rod([.28,.20,.755],[.28,.20,1.09],.042,material('#c3d3e3'),handover);
  rod([.28,.20,1.09],[.28,.20,1.115],.044,steel,handover);
  rod([.28,.20,1.115],[.28,.20,1.16],.006,white,handover);
  for(let i=0;i<8;i++) box(i%2?.016:.025,.002,.003,material('#46576a'),[.28,.157,.79+i*.037],handover);
  box(.13, .10, .032, material('#409aca', { metalness: .1 }), [.11, .02, .765], sterile);

  // White laparoscopic trainer and stainless instruments on the operating table.
  const dome = mesh(new T.SphereGeometry(.23, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), white, operating, [0, .06, .754]);
  dome.rotation.x = Math.PI / 2; dome.scale.set(.93, .75, 1.2);
  box(.41, .48, .055, white, [0, .06, .778], operating);
  for (let i = 0; i < 7; i++) {
    const a = i * Math.PI * 2 / 7, x = Math.cos(a) * .12, y = .06 + Math.sin(a) * .15;
    const z = .77 + .14 * Math.sqrt(Math.max(0, 1 - x * x / .05 - (y - .06) ** 2 / .08));
    const port = mesh(new T.TorusGeometry(.021, .007, 8, 20), material('#787e7d'), operating, [x, y, z]);
    port.rotation.x = .3 * Math.sin(a); port.rotation.y = .3 * Math.cos(a);
  }
  tray(operating, .2, .55, .24, .15);
  tray(operating, -.38, -.04, .20, .18);
  for (let i = 0; i < 5; i++) {
    rod([-.37 + i * .035, -.64, .762], [-.31 + i * .035, -.32, .762], .003, steel, operating);
    const ring = mesh(new T.TorusGeometry(.014, .003, 5, 14), white, operating, [-.37 + i * .035, -.64, .764]);
  }
  const screen = box(.25, .035, .18, black, [-.29, .52, .91], operating); screen.rotation.x = -.22;
  box(.20, .02, .025, black, [-.29, .5, .773], operating);
  box(.025, .025, .12, black, [-.29, .54, .81], operating);

  // Camera tripods and ring light from the recorded setup.
  function tripod(x, y, height, ringLight) {
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      rod([x + Math.cos(a) * .22, y + Math.sin(a) * .22, .025], [x, y, .76], .009, black);
    }
    rod([x, y, .20], [x, y, height], .01, black);
    if (ringLight) {
      const ring = mesh(new T.TorusGeometry(.13, .013, 10, 40), black, room, [x, y, height + .1]);
      ring.rotation.x = Math.PI / 2;
      const lightRing = mesh(new T.TorusGeometry(.13, .006, 8, 40), white, room, [x, y - .008, height + .1]);
      lightRing.rotation.x = Math.PI / 2;
      box(.033, .025, .07, black, [x, y, height + .09]);
    } else {
      box(.13, .06, .05, black, [x, y, height + .02]);
      rod([x, y - .045, height + .02], [x, y - .035, height + .02], .018, black);
    }
  }
  tripod(1.03, .65, 1.35, false);
  tripod(-2.15, -1.30, 1.12, true);
  } else {
    room.add(environment.model);
  }

  // A clothed operator at the operating table. Identity is deliberately generic.
  const surgeon = new T.Group(); surgeon.position.set(.48, -.82, 0); surgeon.rotation.z = Math.PI / 2; room.add(surgeon);
  for (const s of [-1, 1]) {
    rod([s * .10, 0, .09], [s * .095, 0, .78], .063, material('#252b2b'), surgeon);
    ball([.073, .145, .057], material('#deded7'), [s * .10, -.055, .066], surgeon);
    ball([.071, .13, .050], black, [s * .10, -.045, .085], surgeon);
  }
  const torso = new T.LatheGeometry([
    new T.Vector2(.235, .68), new T.Vector2(.224, .78), new T.Vector2(.177, 1.02),
    new T.Vector2(.182, 1.20), new T.Vector2(.226, 1.35), new T.Vector2(.15, 1.405), new T.Vector2(.071, 1.43)
  ], 48);
  torso.rotateX(Math.PI / 2);
  const torsoMesh = mesh(torso, gown, surgeon); torsoMesh.scale.y = .66;
  const seam = material('#3a8073'), glove = material('#e6ece0'), mask = material('#aecfc6');
  // Subtle cloth folds, collar, waist tie and pocket define the gown silhouette.
  for (const side of [-1,1]) {
    rod([side*.055,-.057,1.425],[side*.12,-.107,1.34],.006,seam,surgeon);
    rod([side*.155,-.107,1.19],[side*.165,-.115,.90],.004,seam,surgeon);
    ball([.095,.065,.10],gown,[side*.19,0,1.31],surgeon);
    ball([.017,.014,.031],skin,[side*.079,-.008,1.56],surgeon);
  }
  rod([-.17,-.119,1.035],[.17,-.119,1.035],.006,seam,surgeon);
  box(.08,.008,.09,gown,[-.10,-.132,1.18],surgeon);
  rod([-.14,-.138,1.225],[-.06,-.138,1.225],.004,seam,surgeon);
  for(let i=-2;i<=2;i++) rod([i*.068,-.139,.73],[i*.057,-.117,.98],.003,seam,surgeon);
  rod([0, 0, 1.37], [0, 0, 1.50], .052, skin, surgeon);
  ball([.083, .084, .111], skin, [0, -.012, 1.565], surgeon);
  const cap = mesh(new T.SphereGeometry(.096, 32, 20, 0, Math.PI * 2, 0, Math.PI * .57), material('#7aada2'), surgeon, [0, -.006, 1.59]);
  cap.rotation.x = Math.PI / 2; cap.scale.z = 1.05;
  const capBand=mesh(new T.TorusGeometry(.086,.004,8,40),seam,surgeon,[0,-.006,1.57]);capBand.scale.y=.97;
  for(const side of [-1,1]) {
    ball([.015,.006,.007],white,[side*.030,-.088,1.580],surgeon);
    ball([.005,.003,.005],material('#333e3c'),[side*.030,-.094,1.580],surgeon);
    rod([side*.015,-.09,1.594],[side*.046,-.083,1.597],.003,material('#514840'),surgeon);
    rod([side*.052,-.088,1.554],[side*.077,-.004,1.569],.0025,white,surgeon);
  }
  ball([.012,.015,.019],skin,[0,-.092,1.559],surgeon);
  ball([.062,.020,.035],mask,[0,-.087,1.533],surgeon);
  for(const z of [1.518,1.531,1.544]) rod([-.044,-.104,z],[.044,-.104,z],.0018,seam,surgeon);
  function glovedHand(side) {
    const hand=new T.Group();surgeon.add(hand);
    ball([.034,.044,.021],glove,[0,0,0],hand);
    for(let i=0;i<4;i++) {
      const x=(i-1.5)*.015, length=[.041,.052,.049,.037][i];
      rod([x,-.024,0],[x,-.024-length,.004],.007,glove,hand,.006);
      ball([.006,.007,.006],glove,[x,-.024-length,.004],hand);
    }
    rod([side*.026,0,0],[side*.048,-.028,.004],.010,glove,hand,.007);
    return hand;
  }
  // Two articulated arms; tools track the hands while the tips work at the trainer.
  const arms = [-1,1].map(side=>({
    side, shoulder:new T.Vector3(side*.21,0,1.32),
    upper:rod([0,0,0],[0,0,1],.064,gown,surgeon,.083),
    fore:rod([0,0,0],[0,0,1],.035,gown,surgeon,.049),
    cuff:ball([.039,.035,.028],seam,[0,0,0],surgeon),
    hand:glovedHand(side)
  }));
  const humanHand = arms[1].hand;
  const humanPalm = new T.Object3D(); surgeon.add(humanPalm);
  function bone(object, a, b) {
    const delta=b.clone().sub(a);
    object.position.copy(a).add(b).multiplyScalar(.5); object.scale.y=delta.length();
    object.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
  }
  function armPose(arm, target) {
    const direction=target.clone().sub(arm.shoulder), distance=Math.min(direction.length(),.705);
    direction.normalize(); const end=arm.shoulder.clone().addScaledVector(direction,distance);
    const along=(.35**2-.36**2+distance**2)/(2*distance);
    const bend=new T.Vector3(arm.side*.65,.15,-.7);
    bend.addScaledVector(direction,-bend.dot(direction)).normalize();
    const elbow=arm.shoulder.clone().addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,.35**2-along**2)));
    bone(arm.upper,arm.shoulder,elbow); bone(arm.fore,elbow,end); arm.hand.position.copy(end);
    arm.cuff.position.copy(end).lerp(elbow,.075);
  }
  const instruments=[new T.Group(),new T.Group()];
  instruments.forEach((instrument,index)=>{
    room.add(instrument);
    rod([0,0,-.045],[0,0,.035],.013,black,instrument);
    rod([0,0,.035],[0,0,.32],.0035,steel,instrument);
    if(index===1) {
      const blade=box(.013,.002,.042,steel,[0,0,.335],instrument); blade.rotation.y=.15;
    } else {
      for(const s of [-1,1]) {
        const ring=mesh(new T.TorusGeometry(.022,.004,6,20),black,instrument,[s*.020,0,-.045]); ring.rotation.x=Math.PI/2;
        rod([s*.003,0,.31],[s*.009,0,.342],.002,steel,instrument);
      }
    }
  });
  const gauzeDrop = new T.Vector3(.94,-.66,environment ? .80 : .777);

  // Gauze is a physical object: on the table, then in the G1 hand, then received.
  const gauze = new T.Group();
  for (let i = 0; i < 6; i++) box(.08, .065, .005, material(i % 2 ? '#edede5' : '#fbfaf1'), [0, 0, i * .005], gauze);
  room.add(gauze);
  const gauzeHome = environment ? environment.gauzeHome.clone() : new T.Vector3(-1.20, .845, .755);
  gauze.position.copy(gauzeHome);
  for (let i = 0; !environment && i < 2; i++) {
    const spare = gauze.clone(); spare.position.set(-1.10 + i * .10, .89, .755); room.add(spare);
  }

  const labels = environment ? environment.labels : [
    {text:'Sterile table',x:-1.35,y:1.20,w:1.24,d:.86},
    {text:'Handover table',x:-.90,y:-1.38,w:1.38,d:.76},
    {text:'Operating table',x:1.40,y:-.62,w:1.05,d:1.72}
  ];

  const ease=v=>{const u=T.MathUtils.clamp(v,0,1);return u*u*(3-2*u);};
  function surgeonSequence(t) {
    const turnToReceive=ease(t-20)*(1-ease((t-24)/2));
    surgeon.rotation.z=Math.PI/2-Math.PI*turnToReceive;
    const work=[new T.Vector3(-.13,-.45,1.08),new T.Vector3(.17,-.46,1.08)];
    const receiveTarget=new T.Vector3(.10,-.34,1.0);
    const park=[new T.Vector3(-.14,-.45,.79),new T.Vector3(.16,-.45,.79)];
    for(let i=0;i<2;i++) {
      const hand=work[i].clone();
      if(t<19 || t>=30) {hand.y+=.012*Math.sin(t*2.4+i);hand.z+=.009*Math.cos(t*2+i);}
      else if(t<20) hand.lerp(park[i],ease(t-19));
      else if(t<22) hand.copy(park[i]).lerp(i?receiveTarget:new T.Vector3(-.19,-.19,1.03),ease(t-21));
      else if(t<26) hand.copy(i?receiveTarget:new T.Vector3(-.19,-.19,1.03));
      else if(t<28) hand.copy(i?receiveTarget:new T.Vector3(-.19,-.19,1.03)).lerp(i?new T.Vector3(.16,-.46,.79):park[0],ease((t-26)/2));
      else if(t<30) hand.copy(park[i]).lerp(work[i],ease((t-28)/2));
      armPose(arms[i],hand);
    }
    humanPalm.position.copy(humanHand.position); humanPalm.position.z += .026;
    surgeon.updateMatrixWorld(true);
    instruments.forEach((tool,i)=>{
      if(t<20 || t>=28) {
        tool.position.copy(arms[i].hand.getWorldPosition(new T.Vector3()));
        const tip=environment?.workTips[i]?.clone() ?? new T.Vector3(1.31+i*.08,-.60+i*.06,.93);
        const direction=tip.sub(tool.position),reach=direction.length();
        tool.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),direction.normalize());
        const working=t<19||t>=30?1:t<20?1-ease(t-19):ease((t-28)/2);
        tool.scale.z=1+(reach/.35-1)*working;
        const flat=new T.Quaternion().setFromEuler(new T.Euler(Math.PI/2,0,0));
        if(t>=19&&t<20) tool.quaternion.slerp(flat,ease(t-19));
        if(t>=28&&t<30) tool.quaternion.slerp(flat,1-ease((t-28)/2));
      } else {
        tool.position.set(.93,-.96+i*.30,.79); tool.rotation.set(Math.PI/2,0,0);
        tool.scale.z=1;
      }
    });
    return humanPalm.getWorldPosition(new T.Vector3());
  }
  surgeonSequence(0);
  return { room, gauze, gauzeHome, gauzeDrop, labels, surgeon, humanHand, humanPalm, surgeonSequence };
}
