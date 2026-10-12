document.addEventListener('DOMContentLoaded',()=>{
  const shell=document.getElementById('workspace-shell'),frame=document.getElementById('workspace-frame');
  if(!shell || !frame)return;
  const poster=document.getElementById('workspace-poster'),start=document.getElementById('workspace-start'),note=document.getElementById('workspace-load-note');
  let inView=false,started=false,timeout;
  const signal=()=>frame.contentWindow?.postMessage({type:inView?'roboassist:resume':'roboassist:pause'},location.origin);
  const fail=()=>{start.disabled=false;start.textContent='Reload 3D workspace ↗';note.textContent='The model could not load. You can retry or open the full-screen view.';};
  const mount=()=>{
    if(started)return;started=true;start.disabled=true;note.textContent='Loading the interactive scene…';
    frame.src=frame.dataset.src;timeout=setTimeout(fail,45000);
  };
  start.onclick=()=>{if(started){frame.src='about:blank';started=false;}inView=true;mount();};
  frame.addEventListener('load',signal);
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin || event.source!==frame.contentWindow)return;
    if(event.data?.type==='roboassist:ready'){
      clearTimeout(timeout);shell.dataset.ready='true';poster.hidden=true;frame.removeAttribute('aria-hidden');frame.removeAttribute('tabindex');signal();
    }else if(event.data?.type==='roboassist:error'){clearTimeout(timeout);fail();}
  });
  if('IntersectionObserver' in window){
    new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;if(inView)mount();if(started)signal();},{rootMargin:'160px'}).observe(shell);
  }
});
