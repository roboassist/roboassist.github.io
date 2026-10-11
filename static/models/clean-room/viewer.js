import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { createComparison } from './fade-comparison.js?v=copy-v7';

const $ = id => document.getElementById(id);
const host = $('canvas-host'), viewport = $('viewport');
const regions = [
  {id:'operating',title:'Operating table',prefixes:['Long_workbench_A','Long_workbench_B']},
  {id:'sterile',title:'Sterile table',prefixes:['Gauze_worktable']},
  {id:'handover',title:'Handover table',prefixes:['Bottle_worktable']}
];
let renderer, scene, camera, controls, model, comparison, width=1, height=1;
const descriptions={operating:'Operating table · the main surgical work surface.',sterile:'Sterile table · gauze and the aluminum box.',handover:'Handover table · the instrument and supply handover area.'};
let dirty=true, active=true, ready=false, showLabels=true, wallMode='auto', selected=null;
let animation=null, frameHandle=0, lastLayout=0;
const walls=[], raycaster=new THREE.Raycaster(), center=new THREE.Vector3(-.65,.9,-1.25);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const isQA=new URLSearchParams(location.search).has('qa');
const viewDirection=new THREE.Vector3(8.65,8.1,10.25).normalize();
const fullBounds=new THREE.Box3();

function requestRender(){dirty=true;if(!frameHandle && active && !document.hidden)frameHandle=requestAnimationFrame(tick);}
function tick(time){
  frameHandle=0;if(!active || document.hidden)return;
  if(animation){
    const t=Math.min(1,(time-animation.start)/480), ease=1-(1-t)**3;
    camera.position.lerpVectors(animation.from,animation.to,ease);
    controls.target.lerpVectors(animation.targetFrom,animation.targetTo,ease);
    if(t===1)animation=null;dirty=true;
  }
  const changed=controls.update();
  if(comparison?.advance(time))dirty=true;
  if(dirty || changed){
    camera.updateMatrixWorld();updateWalls();
    if(comparison)comparison.render(width,height);else renderer.render(scene,camera);
    if(time-lastLayout>28 || !changed){layoutLabels();lastLayout=time;}
    dirty=false;
  }
  if(animation || changed || comparison?.animating)requestRender();
}

function updateWalls(){
  const direction=camera.position.clone().sub(center).normalize();
  for(const wall of walls){
    wall.object.visible=wallMode==='all' || (wallMode==='auto' && wall.normal.dot(direction)<.12);
  }
}

function travel(position,target){
  controls.autoRotate=false;
  if(reducedMotion){camera.position.copy(position);controls.target.copy(target);animation=null;}
  else animation={from:camera.position.clone(),to:position,targetFrom:controls.target.clone(),targetTo:target,start:performance.now()};
  requestRender();
}
function clearSelection(){selected=null;for(const button of document.querySelectorAll('[data-region]'))button.setAttribute('aria-pressed','false');$('overview').setAttribute('aria-pressed','true');$('view-name').textContent='ROOM OVERVIEW';$('region-description').textContent='One room, three functional regions. Select a table to take a closer look.';updateHighlight();}
function fitDistance(){
  const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),viewDirection).normalize();
  const up=new THREE.Vector3().crossVectors(viewDirection,right).normalize();
  const tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov)/2),tanH=tanV*camera.aspect;
  let distance=0;
  for(const x of [fullBounds.min.x,fullBounds.max.x])for(const y of [fullBounds.min.y,fullBounds.max.y])for(const z of [fullBounds.min.z,fullBounds.max.z]){
    const p=new THREE.Vector3(x,y,z).sub(center);
    distance=Math.max(distance,p.dot(viewDirection)+Math.abs(p.dot(right))/tanH,p.dot(viewDirection)+Math.abs(p.dot(up))/tanV);
  }
  return distance*(width<520?1.10:1.07);
}
function updateHighlight(){
  if(!model)return;
  model.traverse(object=>{
    if(!object.userData.regionMaterial)return;
    const focused=selected && object.userData.regionId===selected;
    object.material.emissive.set(focused?0x164b72:0x000000);object.material.emissiveIntensity=focused?.24:0;
  });
}
function reset(){
  if(!ready)return;clearSelection();$('top').setAttribute('aria-pressed','false');
  const distance=fitDistance();
  travel(center.clone().addScaledVector(viewDirection,distance),center.clone());
}
function focusRegion(id){
  if(!ready)return;
  const region=regions.find(r=>r.id===id);if(!region)return;
  selected=id;$('top').setAttribute('aria-pressed','false');
  $('overview').setAttribute('aria-pressed','false');$('view-name').textContent=region.title.toUpperCase();$('region-description').textContent=descriptions[id];updateHighlight();
  for(const button of document.querySelectorAll('[data-region]'))button.setAttribute('aria-pressed',String(button.dataset.region===id));
  // A fixed three-quarter view avoids leaving a selected region behind a wall.
  if(wallMode==='all'){wallMode='auto';$('walls').value='auto';}
  const distance=(id==='operating'?6.5:4.8)/Math.min(1,camera.aspect);
  travel(region.anchor.clone().addScaledVector(viewDirection,distance),region.anchor.clone());
}

const overlap=(a,b,pad=8)=>a.x<b.x+b.w+pad && a.x+a.w+pad>b.x && a.y<b.y+b.h+pad && a.y+a.h+pad>b.y;
function layoutLabels(){
  if(!ready)return;
  const placed=[], visibleWalls=walls.filter(w=>w.object.visible).map(w=>w.object);
  const viewRect=viewport.getBoundingClientRect();
  const reserved=[document.querySelector('.toolbar'),document.querySelector('.scene-title'),$('fade-toggle'),$('compare-status'),$('view-settings')].filter(el=>!el.hidden).map(el=>{
    const b=el.getBoundingClientRect();return {x:b.left-viewRect.left-4,y:b.top-viewRect.top-4,w:b.width+8,h:b.height+8};
  });
  const candidates=[];let occluded=0, crowded=0;
  for(const region of regions){
    region.button.hidden=true;region.lineGroup.setAttribute('hidden','');
    region.reason='labels-off';if(!showLabels)continue;
    const p=region.anchor.clone().project(camera);
    if(p.z< -1 || p.z>1 || Math.abs(p.x)>1 || Math.abs(p.y)>1){region.reason='offscreen';continue;}
    const direction=region.anchor.clone().sub(camera.position),distance=direction.length();
    raycaster.set(camera.position,direction.normalize());raycaster.far=distance-.06;
    if(raycaster.intersectObjects(visibleWalls,false).length){region.reason='wall-occluded';occluded++;continue;}
    const anchor={x:(p.x+1)*width/2,y:(1-p.y)*height/2};
    region.button.hidden=false;
    const w=region.button.offsetWidth,h=region.button.offsetHeight;
    region.button.hidden=true;
    candidates.push({region,anchor,w,h,distance});
  }
  // Stable identity order avoids swapping labels as the camera crosses an axis.
  candidates.sort((a,b)=>(b.region.id===selected)-(a.region.id===selected) || regions.indexOf(a.region)-regions.indexOf(b.region));
  for(const {region,anchor,w,h} of candidates){
    const options=[];
    for(const [dx,dy] of [[0,-59],[-92,-48],[92,-48],[0,55],[-115,0],[115,0],[0,-110],[-135,68],[135,68],[0,108]]){
      const rect={x:Math.max(10,Math.min(width-w-10,anchor.x+dx-w/2)),y:Math.max(12,Math.min(height-h-74,anchor.y+dy-h/2)),w,h};
      if(w>width-20 || rect.y<8 || reserved.some(r=>overlap(rect,r,5)) || placed.some(r=>overlap(rect,r,9)))continue;
      const drift=region.last?Math.hypot(rect.x-region.last.x,rect.y-region.last.y)*.18:0;
      const score=Math.hypot(rect.x+w/2-anchor.x,rect.y+h/2-anchor.y)+drift+(dy>0?14:0);
      options.push({rect,score});
    }
    options.sort((a,b)=>a.score-b.score);
    if(!options.length){region.reason='crowded';crowded++;continue;}
    const box=options[0].rect;placed.push(box);region.last=box;
    region.button.style.transform=`translate(${box.x.toFixed(1)}px, ${box.y.toFixed(1)}px)`;
    region.button.dataset.active=String(region.id===selected);region.button.dataset.muted=String(!!selected && region.id!==selected);region.lineGroup.dataset.muted=region.button.dataset.muted;region.button.hidden=false;region.reason='visible';
    const end={x:Math.max(box.x+7,Math.min(box.x+box.w-7,anchor.x)),y:Math.max(box.y+5,Math.min(box.y+box.h-5,anchor.y))};
    region.line.setAttribute('x1',anchor.x);region.line.setAttribute('y1',anchor.y);
    region.line.setAttribute('x2',end.x);region.line.setAttribute('y2',end.y);
    region.dot.setAttribute('cx',anchor.x);region.dot.setAttribute('cy',anchor.y);
    region.lineGroup.removeAttribute('hidden');region.screenAnchor=anchor;
  }
  const message=occluded?'Labels behind walls are hidden · use Auto cutaway to see inside':crowded?'Some labels are hidden to avoid overlap · use the region buttons below':'';
  if($('label-status').textContent!==message)$('label-status').textContent=message;
}

function createLabels(){
  for(const region of regions){
    const button=document.createElement('button');button.className='region-label';
    const index=document.createElement('span');index.className='label-index';index.textContent=String(regions.indexOf(region)+1).padStart(2,'0');
    const title=document.createElement('span');title.textContent=region.title;button.append(index,title);
    button.dataset.region=region.id;button.setAttribute('aria-label',`Focus ${region.title}`);
    button.onclick=()=>focusRegion(region.id);$('region-labels').append(button);region.button=button;
    const svg='http://www.w3.org/2000/svg',g=document.createElementNS(svg,'g'),line=document.createElementNS(svg,'line'),dot=document.createElementNS(svg,'circle');
    dot.setAttribute('r','2.6');g.append(line,dot);$('leaders').append(g);Object.assign(region,{lineGroup:g,line,dot});
    const box=new THREE.Box3();
    model.traverse(object=>{if(object.isMesh && region.prefixes.some(prefix=>object.name.startsWith(prefix+'_Top')))box.union(new THREE.Box3().setFromObject(object));});
    if(box.isEmpty())throw new Error(`Missing region geometry: ${region.title}`);
    region.anchor=box.getCenter(new THREE.Vector3());region.anchor.y=box.max.y+.10;
    model.traverse(object=>{
      if(object.isMesh && region.prefixes.some(prefix=>object.name.startsWith(prefix+'_Cover')) && object.material.emissive){
        object.material=object.material.clone();object.userData.regionMaterial=true;object.userData.regionId=region.id;
      }
    });
  }
}

async function init(){
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  host.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','Room model: drag to rotate, scroll to zoom');
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(38,1,.05,100);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.10;
  controls.minDistance=1.5;controls.maxDistance=35;controls.minPolarAngle=.03;controls.maxPolarAngle=Math.PI*.485;
  controls.addEventListener('change',requestRender);controls.addEventListener('start',()=>{animation=null;});
  scene.add(new THREE.HemisphereLight(0xeef5ff,0x858a7b,2.8));
  for(const [position,intensity] of [[[0,8,3],3], [[-5,4,-3],1.1], [[5,5,-5],1.6]]){
    const light=new THREE.DirectionalLight(0xffffff,intensity);light.position.set(...position);light.target.position.copy(center);scene.add(light,light.target);
    if(intensity===3){light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.5,far:25});light.shadow.bias=-.0005;light.shadow.normalBias=.025;}
  }
  new ResizeObserver(()=>{
    width=Math.max(1,viewport.clientWidth);height=Math.max(1,viewport.clientHeight);
    renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();
    $('leaders').setAttribute('viewBox',`0 0 ${width} ${height}`);requestRender();
  }).observe(viewport);
  const loaded=await new GLTFLoader().loadAsync('./room.glb',event=>{if(event.total)$('load-progress').textContent=`Loading model · ${Math.round(event.loaded/event.total*100)}%`;});
  model=loaded.scene;scene.add(model);model.updateMatrixWorld(true);fullBounds.setFromObject(model);
  model.traverse(object=>{
    if(!object.isMesh)return;
    // Thin overlapping cover/seam geometry must not self-shadow (shadow acne).
    // Keep floor contact shadows; use smooth direct lighting on small equipment.
    object.castShadow=!object.name.startsWith('Floor_') && object.name!=='Continuous_floor';
    object.receiveShadow=object.name==='Continuous_floor';
    let normal=null;
    if(object.name==='Left_wall' || object.name.startsWith('Grey_window_curtain'))normal=new THREE.Vector3(-1,0,0);
    if(object.name==='Right_white_partition')normal=new THREE.Vector3(1,0,0);
    if(object.name==='Front_white_partition')normal=new THREE.Vector3(0,0,1);
    if(object.name==='Rear_white_partition')normal=new THREE.Vector3(0,0,-1);
    if(normal)walls.push({object,normal});
  });
  createLabels();ready=true;document.body.dataset.ready='true';$('loading').hidden=true;
  comparison=createComparison({renderer,camera,scene,requestRender,walls,model});comparison.load();
  $('reset').onclick=reset;$('overview').onclick=reset;
  $('top').onclick=()=>{clearSelection();$('top').setAttribute('aria-pressed','true');travel(controls.target.clone().add(new THREE.Vector3(0,Math.max(7,camera.position.distanceTo(controls.target)),.01)),controls.target.clone());};
  $('labels').onclick=()=>{showLabels=!showLabels;$('labels').setAttribute('aria-pressed',String(showLabels));requestRender();};
  $('walls').onchange=()=>{wallMode=$('walls').value;requestRender();};
  const closeSettings=()=>{$('view-settings').hidden=true;$('settings-toggle').setAttribute('aria-expanded','false');requestRender();};
  $('settings-toggle').onclick=()=>{$('view-settings').hidden=!$('view-settings').hidden;$('settings-toggle').setAttribute('aria-expanded',String(!$('view-settings').hidden));requestRender();};
  document.addEventListener('pointerdown',event=>{if(!$('view-settings').contains(event.target) && !$('settings-toggle').contains(event.target))closeSettings();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeSettings();});
  $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('label-status').textContent='Use Open full explorer for a larger view.'}};
  for(const button of document.querySelectorAll('nav [data-region]'))button.onclick=()=>focusRegion(button.dataset.region);
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();$('loading').hidden=false;$('loading').querySelector('strong').textContent='3D graphics interrupted';$('load-progress').textContent='Reload this view to restore the model.';active=false;});
  reset();parent.postMessage({type:'roboassist:ready'},location.origin);
  // Explicit opt-in diagnostics used by the local browser regression tests.
  if(isQA)window.roomQA={camera,controls,regions,model,walls,reset,requestRender,layoutLabels,renderer,comparison,get active(){return active}};
}

document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestRender();});
window.addEventListener('message',event=>{
  if(event.origin!==location.origin || event.source!==parent)return;
  if(event.data?.type==='roboassist:pause')active=false;
  if(event.data?.type==='roboassist:resume'){active=true;requestRender();}
});
init().catch(error=>{
  console.error(error);$('loading').hidden=false;$('loading').querySelector('strong').textContent='Unable to display the 3D model';
  $('load-progress').textContent='Please reload, or use a browser with WebGL enabled.';
  parent.postMessage({type:'roboassist:error'},location.origin);
  document.querySelector('.spinner').hidden=true;document.body.dataset.error='true';
});
