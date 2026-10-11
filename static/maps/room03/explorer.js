import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadSemanticMap, loadEnvironment, configureCameraForRosZUp } from './js/semantic-map-loader.js';

const $ = (id) => document.getElementById(id);
const nf = new Intl.NumberFormat('en');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const palette = ['#8bb5ff','#9edbc4','#cda4ec','#e0af84','#db93a6','#83c9d9','#d2d18c','#acaaf1','#91c59c','#b9b1a6','#87a1ce','#ceb97c','#ad8fcb','#d59f91','#86b9af','#a8c5e6','#c49bb8','#b3c9a0','#f3c6cf','#70aad0','#edceaa','#c9dbea'];
let scene, camera, renderer, controls, map, environment, boundsGroup;
let selected = null, semantic = false, topView = false, transition = null;
let objects = [], visibleIds = new Set(), classColors = new Map(), hoverId = null;
let renderRequested = true, frameId = null, suspended = false, parentPaused = false;
const toast = (message) => { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').hidden = true, 2400); };
const requestRender = () => { renderRequested = true; if (!frameId && !suspended) frameId = requestAnimationFrame(frame); };

function frame(time) {
  frameId = null;
  if (suspended) return;
  let moving = false;
  if (transition) {
    const t = Math.min(1, (time - transition.time) / 680);
    const ease = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(transition.from, transition.to, ease);
    controls.target.lerpVectors(transition.targetFrom, transition.targetTo, ease);
    if (t === 1) transition = null; else moving = true;
    renderRequested = true;
  }
  moving = controls.update() || moving;
  if (renderRequested || moving) { renderer.render(scene, camera); renderRequested = false; }
  if (moving || transition) requestRender();
}

function moveCamera(target, distance) {
  const direction = topView ? new THREE.Vector3(0, 0, 1) : camera.position.clone().sub(controls.target).normalize();
  const to = target.clone().addScaledVector(direction, distance);
  if (reducedMotion) { camera.position.copy(to); controls.target.copy(target); transition = null; }
  else transition = { from:camera.position.clone(), to, targetFrom:controls.target.clone(), targetTo:target.clone(), time:performance.now() };
  requestRender();
}

function focusObject(item) {
  const extent = new THREE.Vector3(...(item.oriented_bounds?.size || item.extent)).length();
  moveCamera(new THREE.Vector3(...(item.oriented_bounds?.center || item.center)), Math.max(1.1, extent / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.6));
}

function resetCamera() {
  const bounds = map.manifest.semantic_bounds;
  const center = new THREE.Vector3(...bounds.min).add(new THREE.Vector3(...bounds.max)).multiplyScalar(.5);
  topView = false; camera.up.set(0,0,1);
  $('top').classList.remove('active'); $('top').setAttribute('aria-pressed', 'false');
  camera.position.copy(center).add(new THREE.Vector3(8,-10,9)); controls.target.copy(center); transition = null;
  moveCamera(center, new THREE.Vector3(...bounds.max).sub(new THREE.Vector3(...bounds.min)).length() * 1.13);
}

function updateAppearance() {
  const filtered = $('category').value !== '' || $('search').value.trim() !== '';
  for (const [id, points] of map.registry) {
    const item = points.userData.semanticObject;
    const matched = visibleIds.has(id), active = selected?.id === id;
    points.visible = $('isolate').checked ? (selected ? active : matched) : true;
    const dimmed = selected ? !active : filtered && !matched;
    points.material.vertexColors = !semantic && !active;
    points.material.color.set(active ? '#cde1ff' : semantic ? classColors.get(item.label) : '#ffffff');
    points.material.opacity = dimmed ? .065 : 1;
    points.material.size = Number($('point-size').value) / 1000 * (item.point_size_scale ?? 1) * (active ? 1.65 : 1);
    points.material.depthWrite = !dimmed;
    points.material.needsUpdate = true;
  }
  for (const child of boundsGroup.children) { child.geometry.dispose(); child.material.dispose(); }
  boundsGroup.clear();
  for (const item of objects) {
    if (selected?.id !== item.id && (!$('boxes').checked || !visibleIds.has(item.id))) continue;
    if ($('isolate').checked && selected && item.id !== selected.id) continue;
    const color = selected?.id === item.id ? 0xcde1ff : classColors.get(item.label);
    let helper;
    if (item.oriented_bounds) {
      const box = new THREE.BoxGeometry(...item.oriented_bounds.size);
      const edges = new THREE.EdgesGeometry(box); box.dispose();
      helper = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({color}));
      helper.position.fromArray(item.oriented_bounds.center);
      helper.quaternion.fromArray(item.oriented_bounds.quaternion);
    } else helper = new THREE.Box3Helper(new THREE.Box3(new THREE.Vector3(...item.min_bound),new THREE.Vector3(...item.max_bound)), color);
    helper.material.transparent = true; helper.material.opacity = selected?.id === item.id ? .85 : .35;
    helper.material.depthWrite = false;
    boundsGroup.add(helper);
  }
  if (environment) { environment.visible = $('environment').checked; environment.material.opacity = selected ? .12 : .26; }
  requestRender();
}

function filterObjects() {
  const query = $('search').value.trim().toLowerCase(), category = $('category').value;
  const filtered = objects.filter(o => (!category || o.label === category) && (!query || `${o.label} ${o.id}`.toLowerCase().includes(query)));
  visibleIds = new Set(filtered.map(o => o.id));
  if (selected && !visibleIds.has(selected.id)) { selected = null; const url=new URL(location.href);url.searchParams.delete('object');history.replaceState(null,'',url); }
  $('result-count').textContent = `${filtered.length} / ${objects.length}`;
  $('object-list').replaceChildren();
  if (!filtered.length) { const empty=document.createElement('p'); empty.className='empty-list'; empty.textContent='No objects found. Try another category or object ID.'; $('object-list').append(empty); }
  for (const item of filtered) {
    const row = document.createElement('button'); row.className = 'object-row'; row.dataset.id = item.id;
    row.setAttribute('aria-label', `Inspect ${item.label}, ${item.id}`); row.setAttribute('aria-pressed',String(selected?.id === item.id));
    const dot = document.createElement('span'); dot.className='object-swatch'; dot.style.background=classColors.get(item.label);
    const text = document.createElement('span'), name = document.createElement('span'), id = document.createElement('span');
    name.className='object-name'; name.textContent=item.label; id.className='object-id'; id.textContent=item.id;
    text.append(name,id); const count=document.createElement('span'); count.className='object-meta'; count.textContent=nf.format(item.point_count);
    row.append(dot,text,count); row.addEventListener('click',()=>selectObject(item)); $('object-list').append(row);
  }
  updateSelectionRows(); updateDetails(); updateAppearance();
}

function updateSelectionRows() {
  for (const row of $('object-list').querySelectorAll('button')) { const active = row.dataset.id === selected?.id; row.classList.toggle('active', active); row.setAttribute('aria-pressed',String(active)); }
}

function selectObject(item, focus = true) {
  selected = item; updateSelectionRows(); updateDetails(); updateAppearance();
  if (focus) focusObject(item);
  const url = new URL(location.href); url.searchParams.set('object',item.id); history.replaceState(null,'',url);
  window.parent.postMessage({type:'roboassist:semantic-object',sceneId:map.manifest.scene_id,objectId:item.id,label:item.label}, location.origin);
}

function updateDetails() {
  const m = map.manifest;
  $('details').replaceChildren();
  // Labels and identifiers below are rendered as text, never interpreted as markup.
  const title=document.createElement('h2'); title.textContent=selected ? selected.label : 'Scene overview'; $('details').append(title);
  const description=document.createElement('p'); description.className='description';
  description.textContent=selected ? 'An object instance in the scene. Click Focus to return to its spatial extent.' : 'Explore the object-level semantic scene. Select a category or pick an object in the scene.';
  $('details').append(description);
  const cards=document.createElement('div'); cards.className='stat-grid';
  const stats=selected ? [[nf.format(selected.point_count),'Semantic points'],selected.num_detections == null ? [selected.extent[2].toFixed(2),'Height · m'] : [nf.format(selected.num_detections),'Source detections']] : [[objects.length,'Object instances'],[map.labels().length,'Semantic categories']];
  for (const [value,label] of stats) { const card=document.createElement('div');card.className='stat-card'; const strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=value;span.textContent=label;card.append(strong,span);cards.append(card); }
  $('details').append(cards);
  const table=document.createElement('div'); table.className='detail-table';
  const rows=selected ? [['Object ID',selected.id],['Extent · m',(selected.oriented_bounds?.size || selected.extent).map(x=>x.toFixed(2)).join(' × ')],['Center X / Y / Z',(selected.oriented_bounds?.center || selected.center).map(x=>x.toFixed(2)).join(' / ')]] : [['Semantic points',nf.format(m.semantic_geometry.point_count)],['Environment points',nf.format(m.environment.point_count)],['Coordinate system','ROS map · Z-up'],['Environment voxel','4 cm']];
  for (const [label,value] of rows) { const row=document.createElement('div');row.className='detail-row';const span=document.createElement('span'),strong=document.createElement('strong');span.textContent=label;strong.textContent=value;row.append(span,strong);table.append(row); }
  $('details').append(table);
  if (selected) {
    const quality=document.createElement('p');quality.className=`quality ${selected.quality_flags.length ? '' : 'good'}`;
    const flags={very_low_point_count:'Very few reconstructed points',low_point_count:'Sparse reconstructed geometry',large_spatial_extent:'Large spatial extent'};
    quality.textContent=selected.quality_flags.length ? 'Review hint: ' + selected.quality_flags.map(x=>flags[x] || x).join(' · ') : 'No geometry review flags.';
    $('details').append(quality);
    const actions=document.createElement('div');actions.className='detail-actions';const focus=document.createElement('button'),clear=document.createElement('button');focus.textContent='◎ Focus';clear.textContent='Clear selection';focus.onclick=()=>focusObject(selected);clear.onclick=clearSelection;actions.append(focus,clear);$('details').append(actions);
  }
}

function clearSelection() {
  selected=null;updateSelectionRows();updateDetails();updateAppearance();
  const url=new URL(location.href);url.searchParams.delete('object');history.replaceState(null,'',url);
}

function setupPicking() {
  const raycaster=new THREE.Raycaster(); raycaster.params.Points.threshold=.045;
  const pointer=new THREE.Vector2(), rayBox=new THREE.Box3(), padding=new THREE.Vector3(.045,.045,.045);
  let down=null, lastHover=0;
  function pick(event) {
    const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    const candidates=[];
    for (const [id,points] of map.registry) {
      if (!points.visible || (!visibleIds.has(id) && selected?.id !== id)) continue;
      rayBox.copy(points.geometry.boundingBox).expandByVector(padding);
      if(raycaster.ray.intersectsBox(rayBox)) candidates.push(points);
    }
    return raycaster.intersectObjects(candidates,false)[0]?.object.userData.semanticObject;
  }
  renderer.domElement.addEventListener('pointerdown',e=>down={x:e.clientX,y:e.clientY});
  renderer.domElement.addEventListener('pointerup',e=>{if(down && Math.hypot(e.clientX-down.x,e.clientY-down.y)<5){const item=pick(e);if(item)selectObject(item);}down=null;});
  renderer.domElement.addEventListener('pointermove',e=>{
    if(e.buttons || performance.now()-lastHover<80)return;
    lastHover=performance.now();const item=pick(e);hoverId=item?.id;
    renderer.domElement.style.cursor=item?'pointer':'grab';$('tooltip').hidden=!item;
    if(item){const rect=$('canvas-host').getBoundingClientRect();$('tooltip').textContent=`${item.label} · ${item.id}`;$('tooltip').style.left=`${Math.max(8,Math.min(e.clientX-rect.left+15,rect.width-195))}px`;$('tooltip').style.top=`${e.clientY-rect.top+14}px`;}
  });
  renderer.domElement.addEventListener('pointerleave',()=>{$('tooltip').hidden=true;hoverId=null;});
}

function bindControls() {
  $('search').addEventListener('input',filterObjects);$('category').addEventListener('change',filterObjects);
  for(const id of ['environment','boxes','isolate','point-size'])$(id).addEventListener('input',updateAppearance);
  function colorMode(value){semantic=value;for(const [id,active] of [['semantic',value],['rgb',!value]]){$(id).classList.toggle('active',active);$(id).setAttribute('aria-pressed',String(active));}updateAppearance();}
  $('rgb').onclick=()=>colorMode(false);$('semantic').onclick=()=>colorMode(true);
  $('top').onclick=()=>{topView=!topView;$('top').classList.toggle('active',topView);$('top').setAttribute('aria-pressed',String(topView));transition=null;const target=controls.target.clone(),distance=camera.position.distanceTo(target);camera.up.set(0,topView?1:0,topView?0:1);camera.position.copy(target).add(topView?new THREE.Vector3(0,0,distance):new THREE.Vector3(.5,-.65,.6).normalize().multiplyScalar(distance));requestRender();};
  $('reset').onclick=()=>{$('search').value='';$('category').value='';$('isolate').checked=false;clearSelection();filterObjects();resetCamera();};
  $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Use the full explorer page for fullscreen.');}};
  const toggleInspector = (open) => { $('scene-inspector').classList.toggle('is-open',open); $('inspector-toggle').setAttribute('aria-expanded',String(open)); };
  $('inspector-toggle').onclick=()=>toggleInspector(!$('scene-inspector').classList.contains('is-open'));
  $('inspector-close').onclick=()=>{toggleInspector(false);$('inspector-toggle').focus();};
  document.addEventListener('keydown',event=>{if(event.key==='Escape')toggleInspector(false);});
  controls.addEventListener('start',()=>{transition=null;$('tooltip').hidden=true;});controls.addEventListener('change',requestRender);
  document.addEventListener('visibilitychange',()=>{suspended=document.hidden || parentPaused;if(!suspended)requestRender();});
  window.addEventListener('message',event=>{if(event.origin!==location.origin)return;if(event.data?.type==='roboassist:pause'){parentPaused=true;suspended=true;controls.enabled=false;}if(event.data?.type==='roboassist:resume'){parentPaused=false;suspended=document.hidden;controls.enabled=true;requestRender();}});
}

async function init() {
  const host=$('canvas-host');scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(48,1,.02,120);configureCameraForRosZUp(camera);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));host.append(renderer.domElement);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.12;controls.minDistance=.35;controls.maxDistance=35;controls.maxPolarAngle=Math.PI*.94;
  boundsGroup=new THREE.Group();scene.add(boundsGroup);
  new ResizeObserver(()=>{const {width,height}=host.getBoundingClientRect();if(!width || !height)return;camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height);requestRender();}).observe(host);
  map=await loadSemanticMap('./data',{pointSize:.019});scene.add(map.group);objects=map.manifest.objects;
  const labels = Object.fromEntries(map.labels().map(({label,count})=>[label,count]));
  Object.keys(labels).sort().forEach((label,i)=>{classColors.set(label,label === 'table' ? '#5abce2' : palette[i%palette.length]);const option=document.createElement('option');option.value=label;option.textContent=`${label} (${labels[label]})`;$('category').append(option);});
  const floor=map.manifest.semantic_bounds.min[2]-.025;
  const grid=new THREE.GridHelper(18,36,0x43516b,0x293348);grid.rotation.x=Math.PI/2;grid.position.z=floor;grid.material.transparent=true;grid.material.opacity=.33;scene.add(grid);
  for(const [label,count] of Object.entries(labels).sort((a,b)=>b[1]-a[1]).slice(0,6)){
    const row=document.createElement('div');row.className='composition-row';const button=document.createElement('button');button.textContent=label;button.onclick=()=>{$('category').value=label;$('search').value='';filterObjects();};
    const bar=document.createElement('div');bar.className='bar';const fill=document.createElement('i');fill.style.width=`${count/10*100}%`;fill.style.background=classColors.get(label);bar.append(fill);const number=document.createElement('span');number.textContent=count;row.append(button,bar,number);$('composition').append(row);
  }
  bindControls();setupPicking();filterObjects();resetCamera();
  const requestedId=new URL(location.href).searchParams.get('object'),objectId=map.manifest.object_aliases?.[requestedId] || requestedId,item=objects.find(x=>x.id===objectId);if(item)selectObject(item);
  $('loading').hidden=true;$('render-status').textContent='Semantic scene ready';document.body.dataset.ready='true';
  if(innerWidth<650){$('environment').checked=false;toast('Environment is optional on mobile.');}
  // Context loads after semantic objects, and can fail without disabling picking.
  try { environment=await loadEnvironment('./data',{pointSize:.015,opacity:.26});scene.add(environment);updateAppearance();$('render-status').textContent='All scene layers ready'; }
  catch(error){$('environment').checked=false;$('environment').disabled=true;$('render-status').textContent='Semantic map ready · environment unavailable';console.warn(error);}
}

init().catch(error=>{$('loading-title').textContent='The scene could not be loaded';$('loading-note').textContent=`${error.message}. Serve this folder over HTTP and check WebGL support.`;document.querySelector('.spinner').style.display='none';console.error(error);});
