import * as THREE from 'three';

// Blend two complete render targets from the SAME camera, never a spatial wipe.
export function createComparison({renderer,camera,scene,requestRender,walls,model}){
  const $=id=>document.getElementById(id),cloudScene=new THREE.Scene(),groups=[];
  let blend=0,cloud=null,manifest=null,loading=false,failed=false,fade=null,colorMode='rgb';
  const depthPairs=[];
  const range=$('compare-range'),status=$('compare-status');
  const targetType=renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType;
  const scanTarget=new THREE.WebGLRenderTarget(1,1,{type:targetType});
  const modelTarget=new THREE.WebGLRenderTarget(1,1,{type:targetType});
  const compositeScene=new THREE.Scene(),compositeCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const composite=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{scan:{value:scanTarget.texture},model:{value:modelTarget.texture},blend:{value:blend}},
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:'uniform sampler2D scan; uniform sampler2D model; uniform float blend; varying vec2 vUv; void main(){gl_FragColor=mix(texture2D(scan,vUv),texture2D(model,vUv),blend);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
  compositeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),composite));
  renderer.setClearColor(0xe8eaed,1);
  const palette=[[0,'#463465'],[.22,'#3d558c'],[.48,'#287b91'],[.72,'#49a89b'],[1,'#b4ce81']].map(([t,c])=>[t,new THREE.Color(c)]);
  function updateText(){
    range.value=String(Math.round(blend*100));range.setAttribute('aria-valuetext',`${Math.round((1-blend)*100)}% point cloud, ${Math.round(blend*100)}% model`);
    if(cloud)status.textContent=`${Math.round((1-blend)*100)}% point cloud · ${Math.round(blend*100)}% model`;
    composite.uniforms.blend.value=blend;
  }
  function sync(){range.disabled=!cloud;$('fade-toggle').disabled=!cloud;document.body.dataset.comparison=failed?'error':cloud?'fade':'loading';updateText();requestRender();}
  function setBlend(value){fade=null;blend=THREE.MathUtils.clamp(value,0,1);sync();}
  function toggleFade(){
    if(!cloud)return;const to=blend<.5?1:0;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){setBlend(to);return;}
    fade={from:blend,to,start:performance.now()};requestRender();
  }
  function advance(time){if(!fade)return false;const t=Math.min(1,(time-fade.start)/850),ease=t*t*(3-2*t);blend=THREE.MathUtils.lerp(fade.from,fade.to,ease);updateText();if(t===1)fade=null;return true;}
  range.addEventListener('input',()=>setBlend(Number(range.value)/100));$('fade-toggle').onclick=toggleFade;
  document.addEventListener('keydown',event=>{if(event.key.toLowerCase()==='f'&&!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!/^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName)){event.preventDefault();toggleFade();}});
  $('cloud-color').onchange=()=>{colorMode=$('cloud-color').value;for(const group of groups)group.geometry.setAttribute('color',group.userData.colors[colorMode]);requestRender();};
  async function get(url,signal){const r=await fetch(url,{signal});if(!r.ok)throw Error(`Point cloud asset ${r.status}`);return r;}
  async function load(){
    if(loading||cloud)return;loading=true;failed=false;$('scan-retry').hidden=true;status.textContent='Loading the point cloud…';sync();
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
    try{
      manifest=await(await get('./presentation-manifest.json',controller.signal)).json();
      const [xyz,rgb,groupData,shadingData]=await Promise.all([manifest.files.positions,manifest.files.colors,manifest.files.groups,manifest.files.shading].map(async file=>(await get('./'+file,controller.signal)).arrayBuffer()));
      if(xyz.byteLength!==manifest.display_points*12||rgb.byteLength!==manifest.display_points*3||groupData.byteLength!==manifest.display_points||shadingData.byteLength!==manifest.display_points)throw Error('Point cloud data size mismatch');
      const positions=new Float32Array(xyz),colors=new Uint8Array(rgb),bins=Array.from({length:5},()=>[]);
      const groupIds=new Uint8Array(groupData),shading=new Uint8Array(shadingData);
      // Exact source-object identity replaces approximate spatial wall buckets.
      for(let i=0;i<positions.length;i+=3)bins[groupIds[i/3]].push(i);
      const linear=new Float32Array(256);for(let i=0;i<256;i++){const v=i/255;linear[i]=v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}
      const wallNames=[null,'Left_wall','Rear_white_partition','Right_white_partition','Front_white_partition'];
      cloud=new THREE.Group();cloud.name='Model_derived_presentation_points';
      bins.forEach((indices,b)=>{
        const p=new Float32Array(indices.length*3),heightColor=new Float32Array(p.length),rgbColor=new Float32Array(p.length);
        indices.forEach((i,k)=>{p.set(positions.subarray(i,i+3),k*3);for(let j=0;j<3;j++)rgbColor[k*3+j]=linear[colors[i+j]];
          const t=THREE.MathUtils.clamp(positions[i+1]/2.4,0,1);let n=1;while(n<palette.length-1&&t>palette[n][0])n++;
          const [a,ca]=palette[n-1],[b,cb]=palette[n],c=ca.clone().lerp(cb,(t-a)/(b-a)).multiplyScalar(shading[i/3]/255);heightColor.set([c.r,c.g,c.b],k*3);});
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(p,3));
        const attributes={height:new THREE.BufferAttribute(heightColor,3),rgb:new THREE.BufferAttribute(rgbColor,3)};geometry.setAttribute('color',attributes[colorMode]);geometry.computeBoundingSphere();
        const material=new THREE.PointsMaterial({size:.021875,vertexColors:true,sizeAttenuation:true});
        material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <fog_vertex>','#include <fog_vertex>\ngl_PointSize=clamp(gl_PointSize,2.5,5.9375);');shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(length(gl_PointCoord-vec2(0.5))>0.5) discard;');};
        const group=new THREE.Points(geometry,material);group.userData={colors:attributes,wallName:wallNames[b]};groups.push(group);cloud.add(group);
      });
      // A depth-only copy hides rear surfaces: no ghost points through tables.
      const occluder=model.clone(true),byName=new Map();model.traverse(o=>byName.set(o.name,o));
      const depthMaterial=new THREE.MeshBasicMaterial({colorWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
      occluder.traverse(o=>{const original=byName.get(o.name);if(/Floor_mineral_flecks|Floor_tile_joint|_Seam/i.test(o.name)){o.visible=false;return;}if(original)depthPairs.push([o,original]);if(o.isMesh){o.material=depthMaterial;o.renderOrder=-10;o.castShadow=false;o.receiveShadow=false;}});
      cloudScene.add(occluder,cloud);document.body.dataset.scanReady='true';sync();
    }catch(error){failed=true;cloud=null;blend=1;sync();status.textContent='Point cloud could not load. Model remains available.';$('scan-retry').hidden=false;}
    finally{clearTimeout(timer);loading=false;}
  }
  $('scan-retry').onclick=()=>{blend=0;load();};
  function render(width,height){
    renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);
    if(!cloud){renderer.render(scene,camera);return;}
    for(const [copy,original] of depthPairs)copy.visible=original.visible;
    for(const group of groups){if(!group.userData.wallName)continue;const wall=walls.find(w=>w.object.name===group.userData.wallName);group.visible=wall?wall.object.visible:true;}
    const ratio=renderer.getPixelRatio(),w=Math.round(width*ratio),h=Math.round(height*ratio);
    if(modelTarget.width!==w||modelTarget.height!==h){modelTarget.setSize(w,h);scanTarget.setSize(w,h);}
    if(blend<1){renderer.setRenderTarget(scanTarget);renderer.render(cloudScene,camera);}
    if(blend>0){renderer.setRenderTarget(modelTarget);renderer.render(scene,camera);}
    renderer.setRenderTarget(null);renderer.setViewport(0,0,width,height);renderer.render(compositeScene,compositeCamera);
  }
  sync();return {load,render,advance,setBlend,toggleFade,get animating(){return !!fade},get blend(){return blend},get cloud(){return cloud},get groups(){return groups},get failed(){return failed},get manifest(){return manifest}};
}
