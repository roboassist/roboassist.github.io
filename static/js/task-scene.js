// Progressive enhancement: load the renderer only when this section approaches view.
const host = document.querySelector('[data-task-demo-3d]');
if (host) {
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); startScene(); }
  }, { rootMargin: '350px' });
  observer.observe(host);
}

async function startScene() {
  const loading = host.querySelector('[data-scene-loading]');
  const send = host.querySelector('[data-task-send]');
  const status = host.querySelector('[data-task-status]');
  const caption = host.querySelector('[data-scene-status]');
  const consoleState = host.querySelector('[data-console-state]');
  const photo = host.querySelector('[data-scene-photo]');
  let chooseView = (view) => { photo.hidden = view !== 'reference'; };
  host.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => chooseView(button.dataset.view)));
  try {
    const [T, { OrbitControls }, { buildSurgicalRoom }, { loadRoomModel }] = await Promise.all([
      import('../vendor/three/three.module.js'), import('../vendor/three/OrbitControls.js'), import('./surgical-room.js?v=20261011-surgeon'), import('./room-model.js?v=20261011-room')
    ]);
    const canvasHost = host.querySelector('[data-scene-canvas]');
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = .94;
    renderer.domElement.setAttribute('aria-label', 'Interactive 3D reconstruction of the recorded RoboAssist surgical workspace with an articulated Unitree G1');
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.tabIndex = 0;
    canvasHost.append(renderer.domElement);
    const scene = new T.Scene(); scene.background = new T.Color('#eeeef0');
    const camera = new T.PerspectiveCamera(37, 1, .05, 100); camera.up.set(0, 0, 1);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false; controls.enableZoom = false; controls.enablePan = false;
    controls.minPolarAngle = .27; controls.maxPolarAngle = Math.PI / 2 - .07;
    controls.minAzimuthAngle = -Math.PI * .9; controls.maxAzimuthAngle = Math.PI * .9;
    const narrow = window.matchMedia('(max-width: 768px)');
    const configureTouch = () => { controls.enableRotate = !narrow.matches; renderer.domElement.style.touchAction = narrow.matches ? 'pan-y' : 'none'; };
    configureTouch(); narrow.addEventListener('change', configureTouch);
    const ambient = new T.HemisphereLight('#fcfcff', '#65635f', 1.0); ambient.position.set(0, 0, 5); scene.add(ambient);
    const key = new T.DirectionalLight('#fff7ec', 1.8); key.position.set(-3, -4, 7); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = key.shadow.camera.bottom = -4;
    key.shadow.camera.right = key.shadow.camera.top = 4; key.shadow.camera.near = .1; key.shadow.camera.far = 15;
    key.shadow.normalBias = .018; key.shadow.bias = -.00025; key.shadow.radius = 3; scene.add(key);
    const fill = new T.DirectionalLight('#e7efff', .65); fill.position.set(4, 2, 5); scene.add(fill);
    // A soft studio environment gives the official silver meshes a readable finish.
    const env = new T.Scene(); env.background = new T.Color('#bfc4ca');
    for (const [position, color, size] of [ [[0,0,4],'#ffffff',5], [[-4,-2,2],'#e1e8ef',3], [[4,2,1],'#777d86',3] ]) {
      const panel = new T.Mesh(new T.PlaneGeometry(size,size),new T.MeshBasicMaterial({color,side:T.DoubleSide}));
      panel.position.set(...position); panel.lookAt(0,0,1); env.add(panel);
    }
    const pmrem = new T.PMREMGenerator(renderer); const envMap = pmrem.fromScene(env, .12, .1, 30);
    scene.environment = envMap.texture; pmrem.dispose();
    env.traverse((object) => { object.geometry?.dispose(); object.material?.dispose(); });
    loading.textContent = 'Loading the recorded workspace…';
    const environment = await loadRoomModel();
    const room = buildSurgicalRoom(scene, environment);
    // Screen-space callouts retain readable type at any camera distance.
    const annotations=document.createElement('div');annotations.className='surgical-annotations';
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');annotations.append(svg);
    const callouts=room.labels.map((label)=>{
      const element=document.createElement('span');element.className='surgical-table-label';element.textContent=label.text;
      const line=document.createElementNS(svg.namespaceURI,'polyline');svg.append(line);annotations.append(element);
      return {...label,element,line};
    });canvasHost.append(annotations);
    const speech=document.createElement('div');speech.className='surgical-speech';speech.hidden=true;
    speech.setAttribute('role','status');speech.setAttribute('aria-live','polite');speech.setAttribute('aria-atomic','true');
    const speaker=document.createElement('strong'),words=document.createElement('span');speech.append(speaker,words);annotations.append(speech);
    let dialogueStage='',speechBounds=null;
    function updateDialogue(elapsed) {
      const stage=elapsed<2.2?'surgeon':elapsed<5.2?'nurse':'';
      if(stage===dialogueStage)return;
      dialogueStage=stage;speech.hidden=!stage;speech.dataset.speaker=stage;
      speaker.textContent=stage==='surgeon'?'Surgeon':stage==='nurse'?'G1 Nurse':'';
      words.textContent=stage==='surgeon'?'Nurse, give the gauze.':stage==='nurse'?'Understood. I’ll bring you the gauze.':'';
    }
    function positionSpeech() {
      speechBounds=null;if(speech.hidden)return;
      const w=canvasHost.clientWidth,h=canvasHost.clientHeight;
      const anchor=dialogueStage==='surgeon'?room.surgeon.localToWorld(new T.Vector3(0,0,1.78)):head.localToWorld(new T.Vector3(0,0,hb.max.z+.06));
      anchor.project(camera);
      const ax=(anchor.x+1)*w/2,ay=(1-anchor.y)*h/2;
      const sw=speech.offsetWidth,sh=speech.offsetHeight;
      const x=T.MathUtils.clamp(ax-sw/2,10,Math.max(10,w-sw-10));
      const y=T.MathUtils.clamp(ay-sh-20,65,Math.max(65,h-sh-60));
      speech.style.transform=`translate(${x}px,${y}px)`;
      speech.style.setProperty('--speech-tail',`${T.MathUtils.clamp(ax-x,18,sw-18)}px`);
      speechBounds={x,y,right:x+sw,bottom:y+sh+12};
    }
    function updateLabels() {
      const w=canvasHost.clientWidth,h=canvasHost.clientHeight;if(!w||!h)return;
      const project=(x,y,z)=>{const p=new T.Vector3(x,y,z).project(camera);return{x:(p.x+1)*w/2,y:(1-p.y)*h/2};};
      const bounds=callouts.map(l=>{
        const corners=[0,.80].flatMap(z=>[[-1,-1],[-1,1],[1,-1],[1,1]].map(([a,b])=>project(l.x+a*l.w/2,l.y+b*l.d/2,z)));
        return {x:Math.min(...corners.map(p=>p.x)),y:Math.min(...corners.map(p=>p.y)),right:Math.max(...corners.map(p=>p.x)),bottom:Math.max(...corners.map(p=>p.y))};
      });
      const intersects=(a,b)=>a.x<b.right+7&&a.right>b.x-7&&a.y<b.bottom+7&&a.bottom>b.y-7;
      const placed=speechBounds?[speechBounds]:[];
      callouts.forEach((l,i)=>{
        const b=bounds[i],lw=l.element.offsetWidth,lh=l.element.offsetHeight;
        const anchor=project(l.x,l.y,.77), candidates=[];
        const add=(x,y)=>{x=T.MathUtils.clamp(x,8,w-lw-8);y=T.MathUtils.clamp(y,64,h-lh-55);const rect={x,y,right:x+lw,bottom:y+lh};
          const overlap=bounds.filter(o=>intersects(rect,o)).length+placed.filter(o=>intersects(rect,o)).length*3;
          candidates.push({...rect,score:overlap*100000+Math.hypot(x+lw/2-anchor.x,y+lh/2-anchor.y)});};
        add(b.x-lw-17,(b.y+b.bottom-lh)/2);add(b.right+17,(b.y+b.bottom-lh)/2);
        add((b.x+b.right-lw)/2,b.y-lh-17);add((b.x+b.right-lw)/2,b.bottom+17);
        for(let y=70;y<h-lh-55;y+=lh+12){add(8,y);add(w-lw-8,y);}
        const chosen=candidates.sort((a,b)=>a.score-b.score)[0];placed.push(chosen);
        l.element.style.transform=`translate(${chosen.x}px,${chosen.y}px)`;
        const endX=T.MathUtils.clamp(anchor.x,chosen.x,chosen.right),endY=T.MathUtils.clamp(anchor.y,chosen.y,chosen.bottom);
        const startX=T.MathUtils.clamp(endX,b.x,b.right),startY=T.MathUtils.clamp(endY,b.y,b.bottom);
        l.line.setAttribute('points',`${startX},${startY} ${endX},${startY} ${endX},${endY}`);
      });
    }
    const rig = new T.Group(); scene.add(rig);
    const links = new Map(), joints = new Map();
    loading.textContent = 'Loading Unitree G1…';
    const base = new URL('../models/g1/', import.meta.url);
    const [manifestResponse, binaryResponse] = await Promise.all([fetch(new URL('g1.json',base)), fetch(new URL('g1.bin',base))]);
    if (!manifestResponse.ok || !binaryResponse.ok) throw new Error('The G1 model could not be downloaded.');
    const [data, binary] = await Promise.all([manifestResponse.json(), binaryResponse.arrayBuffer()]);
    const geometries = new Map();
    for (const [name, info] of Object.entries(data.geometries)) {
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(binary,info.position.offset,info.position.count),3));
      geometry.setAttribute('normal',new T.BufferAttribute(new Float32Array(binary,info.normal.offset,info.normal.count),3));
      geometry.setIndex(new T.BufferAttribute(new Uint32Array(binary,info.index.offset,info.index.count),1));
      geometries.set(name,geometry);
    }
    const silver = new T.MeshStandardMaterial({color:'#b8bbbc',metalness:.64,roughness:.36});
    const dark = new T.MeshStandardMaterial({color:'#24292d',metalness:.3,roughness:.38});
    const handWhite = new T.MeshStandardMaterial({color:'#dcddd8',metalness:.2,roughness:.52});
    const rotation = (rpy) => new T.Quaternion().setFromEuler(new T.Euler(...rpy, 'ZYX'));
    for (const link of data.links) {
      const group = new T.Group(); group.name = link.name; links.set(link.name,group);
      for (const v of link.visuals) {
        const mat = v.color[0] < .4 ? dark : v.color[0] > .9 ? handWhite : silver;
        const mesh = new T.Mesh(geometries.get(v.mesh),mat);
        mesh.position.set(...v.xyz); mesh.quaternion.copy(rotation(v.rpy));
        mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
      }
    }
    for (const j of data.joints) {
      const frame = new T.Group(); frame.position.set(...j.xyz); frame.quaternion.copy(rotation(j.rpy));
      const pivot = new T.Group(); frame.add(pivot); pivot.add(links.get(j.child)); links.get(j.parent).add(frame);
      joints.set(j.name,{...j,frame,pivot,axisVector:new T.Vector3(...j.axis),value:0});
    }
    rig.add(links.get('pelvis')); rig.position.set(-.30,-.55,.79); rig.rotation.z = -Math.PI / 2;
    const setJoint = (name,value) => {
      const j = joints.get(name); if (!j || j.type === 'fixed') return;
      j.value = T.MathUtils.clamp(value,j.lower,j.upper); j.pivot.quaternion.setFromAxisAngle(j.axisVector,j.value);
    };
    const neutral = () => {
      for (const j of joints.values()) if (j.type !== 'fixed') setJoint(j.name,0);
      for (const side of ['left','right']) {
        setJoint(`${side}_shoulder_pitch_joint`, .10);
        setJoint(`${side}_shoulder_roll_joint`, side === 'left' ? .10 : -.10);
        setJoint(`${side}_elbow_joint`, .86);
        setJoint(`${side}_hip_pitch_joint`, -.08); setJoint(`${side}_knee_joint`, .16); setJoint(`${side}_ankle_pitch_joint`, -.08);
      }
    };
    neutral(); rig.updateMatrixWorld(true);
    // Ground the official foot meshes, rather than guessing a pelvis height.
    const leftFootBox = new T.Box3().setFromObject(links.get('left_ankle_roll_link'));
    const groundHeight = .79 - leftFootBox.min.z + .004;
    rig.position.z = groundHeight;
    // The camera/light fitted to the real robot and its distinctive cyan face rim.
    const head = links.get('head_link');
    const headBounds = geometries.get('meshes/head_link.STL'); headBounds.computeBoundingBox();
    const hb = headBounds.boundingBox;
    const rimPoints = [
      [hb.max.x-.012,-.069,hb.max.z-.075],[hb.max.x+.002,-.072,hb.max.z-.125],
      [hb.max.x+.009,-.050,hb.max.z-.195],[hb.max.x+.012,0,hb.max.z-.215],
      [hb.max.x+.009,.050,hb.max.z-.195],[hb.max.x+.002,.072,hb.max.z-.125],[hb.max.x-.012,.069,hb.max.z-.075]
    ].map(p=>new T.Vector3(...p));
    const rim = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(rimPoints),36,.0027,6,false),new T.MeshStandardMaterial({color:'#52ccd6',emissive:'#1996ad',emissiveIntensity:.6}));
    head.add(rim);
    const rightHand = links.get('R_hand_base_link');
    const graspPoint = new T.Object3D(); graspPoint.position.set(0,-.115,.018); rightHand.add(graspPoint);
    const armNames = ['right_shoulder_pitch_joint','right_shoulder_roll_joint','right_shoulder_yaw_joint','right_elbow_joint','right_wrist_roll_joint','right_wrist_pitch_joint','right_wrist_yaw_joint'];
    // Cyclic coordinate descent uses the actual URDF axes and joint limits.
    function reach(target) {
      for (let iteration=0; iteration<15; iteration++) {
        for (const name of [...armNames].reverse()) {
          const j=joints.get(name); rig.updateMatrixWorld(true);
          const pivot=j.pivot.getWorldPosition(new T.Vector3());
          const axis=j.axisVector.clone().applyQuaternion(j.frame.getWorldQuaternion(new T.Quaternion())).normalize();
          const a=graspPoint.getWorldPosition(new T.Vector3()).sub(pivot);
          const b=target.clone().sub(pivot);
          a.addScaledVector(axis,-a.dot(axis)); b.addScaledVector(axis,-b.dot(axis));
          if(a.lengthSq()<1e-9 || b.lengthSq()<1e-9) continue;
          a.normalize(); b.normalize();
          const angle=Math.atan2(axis.dot(new T.Vector3().crossVectors(a,b)),T.MathUtils.clamp(a.dot(b),-1,1));
          setJoint(name,j.value+T.MathUtils.clamp(angle,-.24,.24));
        }
        if(graspPoint.getWorldPosition(new T.Vector3()).distanceTo(target)<.004) break;
      }
    }
    function grip(amount) {
      for (const name of ['R_index_proximal_joint','R_index_intermediate_joint','R_middle_proximal_joint','R_middle_intermediate_joint','R_ring_proximal_joint','R_ring_intermediate_joint','R_pinky_proximal_joint','R_pinky_intermediate_joint']) setJoint(name,.50*amount);
      setJoint('R_thumb_proximal_yaw_joint',.25*amount);
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pauseButton = host.querySelector('[data-task-pause]');
    const input = host.querySelector('#task-instruction');
    const steps = [...host.querySelectorAll('[data-task-step]')];
    let isVisible = true, isRunning = false, paused = false, time = 0, lastFrame = 0, frame = 0, currentState = '', photoMode = false, view = 'overview';
    let heldBy = 'table', surgeryClock=0;
    // Give the request and acknowledgement reading time before the existing rollout.
    const dialogueDelay = 4, taskDuration = 32, duration = dialogueDelay + taskDuration;
    const smooth = v => { const x=T.MathUtils.clamp(v,0,1); return x*x*(3-2*x); };
    const progress=(t,a,b)=>smooth((t-a)/(b-a));
    const lerp=(a,b,u)=>a+(b-a)*u;
    const turn=(a,b,u)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*u;
    const start = new T.Vector2(-.30,-.55), pick = environment.pick.clone(), delivery = new T.Vector2(-.30,-.72);
    const pickYaw=Math.PI/2, deliverYaw=.05;
    const v3 = (v,z=groundHeight)=>new T.Vector3(v.x,v.y,z);
    function changeState(index,label,state) {
      if(currentState===state) return;
      currentState=state; host.dataset.taskState=state;
      status.textContent=caption.textContent=label;
      consoleState.textContent=state==='complete'?'Complete':state==='idle'?'Standby':'Executing';
      steps.forEach((step,i)=>{step.classList.toggle('is-active',i===index);step.classList.toggle('is-complete',i<index);});
    }
    const detachGauze = () => { room.room.attach(room.gauze); room.gauze.position.copy(room.gauzeHome); room.gauze.rotation.set(0,0,0); heldBy='table'; };
    function pose(elapsed) {
      updateDialogue(elapsed);
      const t=Math.max(0,elapsed-dialogueDelay);
      neutral(); const recipient=room.surgeonSequence(t); let walk=0, phase=0, armTarget=null, closing=0;
      let pos=start.clone(), yaw=-Math.PI/2;
      if(t<1.5){changeState(0,'Request received · Bring gauze','understand');}
      else if(t<7){
        changeState(1,'Walking to the sterile table','navigate');
        const u=progress(t,2.3,6.3); pos.lerp(pick,u);
        const travelYaw=Math.atan2(pick.y-start.y,pick.x-start.x);
        yaw=t<2.3?turn(-Math.PI/2,travelYaw,progress(t,1.5,2.3)):t<6.3?travelYaw:turn(travelYaw,pickYaw,progress(t,6.3,7));
        walk=Math.sin(Math.PI*u); phase=(t-2.3)*8;
      } else if(t<13){
        changeState(2,'Reaching for and grasping the gauze','pick'); pos.copy(pick);yaw=pickYaw;
      } else if(t<20){
        changeState(3,'Carrying gauze to the surgeon','return');
        const u=progress(t,14,18.9); pos.copy(pick).lerp(delivery,u);
        const travelYaw=Math.atan2(delivery.y-pick.y,delivery.x-pick.x);
        yaw=t<14?turn(pickYaw,travelYaw,progress(t,13,14)):t<18.9?travelYaw:turn(travelYaw,deliverYaw,progress(t,18.9,20));
        walk=Math.sin(Math.PI*u);phase=(t-14)*8;
      } else {
        pos.copy(delivery);yaw=deliverYaw;
        if(t<22.25) changeState(4,'Waiting for the surgeon to turn and extend a hand','prepare-handover');
        else if(t<24) changeState(4,'Offering gauze to the surgeon','handover');
        else if(t<28) changeState(5,'Placing the received gauze on the operating table','place');
        else if(t<taskDuration) changeState(6,'Resuming the surgical task','resume');
        else changeState(7,'Gauze delivered · Surgical task resumed','complete');
      }
      rig.position.copy(v3(pos,groundHeight+.009*Math.sin(phase*2)*walk));rig.rotation.z=yaw;
      for(const [side,offset] of [['left',0],['right',Math.PI]]) {
        const stride=Math.sin(phase+offset)*walk;
        setJoint(`${side}_hip_pitch_joint`,-.08+.34*stride);
        setJoint(`${side}_knee_joint`,.16+.38*Math.max(0,stride));
        setJoint(`${side}_ankle_pitch_joint`,-.08-.16*stride-.2*Math.max(0,stride));
        if(side==='left'||t<7) setJoint(`${side}_shoulder_pitch_joint`,.1-.25*stride);
      }
      rig.updateMatrixWorld(true);
      const restTarget=graspPoint.getWorldPosition(new T.Vector3());
      const carryTarget=rig.localToWorld(new T.Vector3(.28,-.20,.075));
      const graspTarget=room.gauzeHome.clone().add(new T.Vector3(0,0,.018));
      if(t>=7 && t<10.5) armTarget=restTarget.clone().lerp(graspTarget,progress(t,7,10));
      if(t>=10.5 && t<13) armTarget=graspTarget.clone().lerp(carryTarget,progress(t,11,13));
      if(t>=13 && t<20) armTarget=carryTarget;
      if(t>=20) {
        // The surgeon is ready at 22 s; only then does the G1 extend its arm.
        armTarget=carryTarget.clone().lerp(recipient,progress(t,22.25,23.1));
        if(t>23.5) armTarget.lerp(restTarget,progress(t,23.5,25));
      }
      if(armTarget) reach(armTarget);
      closing=t<10?0:t<11?progress(t,10,11):t<23?1:1-progress(t,23,23.6);
      grip(closing);rig.updateMatrixWorld(true);
      if(t>=10.8 && t<23.25 && heldBy==='table') {
        graspPoint.attach(room.gauze); room.gauze.position.set(0,0,0); heldBy='robot';
      }
      if(t>=23.25 && t<28 && heldBy!=='human') {
        room.humanPalm.attach(room.gauze);room.gauze.position.set(0,0,0); heldBy='human';
      }
      if(t>=28 && heldBy!=='operating') {
        room.room.attach(room.gauze);room.gauze.position.copy(room.gauzeDrop);room.gauze.rotation.set(0,0,0);heldBy='operating';
      }
      if(t>=taskDuration) { isRunning=false;send.disabled=false;send.querySelector('span').textContent='Replay';pauseButton.hidden=reduceMotion.matches;input.disabled=false; }
    }
    function setCamera(kind) {
      if(kind==='robot') {
        controls.target.copy(rig.position).add(new T.Vector3(0,0,.0));
        camera.position.copy(controls.target).add(new T.Vector3(2.55,-3.35,2.05));
      } else {
        controls.target.set(0,-.35,.70);
        const distance=narrow.matches?1.40:1.12;
        camera.position.set(3.1*distance,-8.3*distance,5.6*distance);
      }
      controls.update();render();
    }
    function render() { if(!photoMode) {environment.updateCutaway(camera);renderer.render(scene,camera);positionSpeech();updateLabels();} }
    function tick(timestamp) {
      frame=0;
      const delta=lastFrame?Math.min((timestamp-lastFrame)/1000,.05):0;lastFrame=timestamp;
      if(isRunning&&!paused&&!document.hidden&&isVisible&&!photoMode) {
        time=Math.min(time+delta,duration);pose(time);
      } else if(!isRunning&&!paused&&!reduceMotion.matches&&isVisible&&!document.hidden&&!photoMode&&['idle','complete'].includes(currentState)) {
        surgeryClock+=delta;
        room.surgeonSequence(currentState==='complete'?32+surgeryClock:surgeryClock%10);
      }
      render();
      if((isRunning||(!reduceMotion.matches&&['idle','complete'].includes(currentState)))&&!paused&&isVisible&&!document.hidden&&!photoMode) frame=requestAnimationFrame(tick);
    }
    function wake() { if(!frame){lastFrame=0;frame=requestAnimationFrame(tick);} }
    controls.addEventListener('change',render);
    const resize=new ResizeObserver(()=>{
      const w=canvasHost.clientWidth,h=canvasHost.clientHeight;
      if(w&&h){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();render();}
    });resize.observe(canvasHost);
    chooseView=(kind)=>{
      photoMode=kind==='reference';photo.hidden=!photoMode;
      canvasHost.hidden=photoMode;
      host.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===kind)));
      if(!photoMode){view=kind;setCamera(kind);wake();}
    };
    host.querySelectorAll('[data-camera]').forEach(button=>button.addEventListener('click',()=>{
      if(photoMode) chooseView(view);
      if(button.dataset.camera==='reset') setCamera(view);
      else {
        const offset=camera.position.clone().sub(controls.target).multiplyScalar(button.dataset.camera==='in'?.85:1.18);
        if(offset.length()>1.7 && offset.length()<16){camera.position.copy(controls.target).add(offset);controls.update();render();}
      }
    }));
    // Keyboard users get the same camera control without needing a drag gesture.
    renderer.domElement.addEventListener('keydown',event=>{
      const action={'+':'in','=':'in','-':'out','0':'reset'}[event.key];
      if(action){event.preventDefault();host.querySelector(`[data-camera="${action}"]`).click();}
      if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
        event.preventDefault();const offset=camera.position.clone().sub(controls.target);
        offset.applyAxisAngle(new T.Vector3(0,0,1),event.key==='ArrowLeft'?.12:-.12);
        camera.position.copy(controls.target).add(offset);controls.update();render();
      }
    });
    send.addEventListener('click',()=>{
      if(!input.value.trim()){status.textContent='Enter the gauze request first.';input.focus();return;}
      if(!/gauze|纱布/i.test(input.value)){status.textContent='This demonstration supports “Nurse, please bring me gauze.”';input.focus();return;}
      detachGauze();time=0;currentState='';paused=false;isRunning=true;
      send.disabled=true;send.querySelector('span').textContent='Running';input.disabled=true;
      pauseButton.hidden=reduceMotion.matches;pauseButton.textContent='Pause';
      if(photoMode) chooseView('overview');
      if(reduceMotion.matches){time=duration;pose(time);render();}
      else{pose(0);wake();}
    });
    pauseButton.addEventListener('click',()=>{paused=!paused;pauseButton.textContent=paused?'Resume':'Pause';consoleState.textContent=paused?'Paused':isRunning?'Executing':currentState==='complete'?'Complete':'Standby';wake();});
    const visibility=new IntersectionObserver(entries=>{isVisible=entries[0].isIntersecting;if(isVisible)wake();});visibility.observe(canvasHost);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)wake();});
    reduceMotion.addEventListener('change',()=>{if(reduceMotion.matches&&isRunning){time=duration;pose(time);render();}});
    renderer.domElement.addEventListener('webglcontextlost',event=>{
      event.preventDefault();isRunning=false;send.disabled=true;photo.hidden=false;loading.hidden=false;
      loading.textContent='The 3D view was interrupted. Reload the page to try again.';
    });
    neutral();rig.updateMatrixWorld(true);setCamera('overview');
    loading.hidden=true;send.disabled=false;status.textContent='Ready to send';consoleState.textContent='Standby';
    changeState(-1,'Ready for instruction','idle');
    pauseButton.hidden=reduceMotion.matches;wake();
  } catch(error) {
    console.error('RoboAssist 3D scene:',error);
    photo.hidden=false;loading.hidden=true;send.disabled=true;
    status.textContent='3D view unavailable. Please reload or view the recorded demonstrations.';
    caption.textContent='Recorded experimental setup';consoleState.textContent='Unavailable';
  }
}
