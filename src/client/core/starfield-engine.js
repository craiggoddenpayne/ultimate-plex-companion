export function initStarfield() {
  const canvas=document.querySelector('#starfield');
  if(!canvas)return;
  const ctx=canvas.getContext('2d',{alpha:true,desynchronized:true});
  const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
  let width=0,height=0,dpr=1,stars=[],frame=0,lastPaint=0,running=true;
  let warmColour='247,190,99',coolColour='200,218,238',effects='full';
  const depth=1100,focal=285;

  function palette(){const styles=getComputedStyle(document.documentElement);warmColour=styles.getPropertyValue('--star-warm-rgb').trim()||'247,190,99';coolColour=styles.getPropertyValue('--star-cool-rgb').trim()||'200,218,238';effects=document.documentElement.dataset.effects||'full'}
  function centre(){return {x:width*.55,y:height*.46}}
  function reset(star,initial=false){const origin=centre();star.z=initial?30+Math.random()*(depth-30):depth;const targetX=Math.random()*width,targetY=Math.random()*height;star.x=(targetX-origin.x)*star.z/focal;star.y=(targetY-origin.y)*star.z/focal;star.previousX=targetX;star.previousY=targetY;star.radius=.45+Math.random()*1.25;star.alpha=.52+Math.random()*.48;star.warm=Math.random()<.15;star.phase=Math.random()*Math.PI*2}
  function projected(star){const origin=centre(),scale=focal/Math.max(1,star.z);return {x:origin.x+star.x*scale,y:origin.y+star.y*scale}}

  function resize(){width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,1.35);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;ctx.setTransform(dpr,0,0,dpr,0,0);const count=Math.min(380,Math.max(190,Math.round(width*height/5800)));stars=Array.from({length:count},()=>{const star={};reset(star,true);const point=projected(star);star.previousX=point.x;star.previousY=point.y;return star});paint(performance.now(),0)}

  function paint(time,delta){const paused=motionQuery.matches||effects==='still';const speed=paused?0:effects==='ambient'?44:112;ctx.clearRect(0,0,width,height);ctx.globalCompositeOperation='lighter';const origin=centre();const glow=ctx.createRadialGradient(origin.x,origin.y,0,origin.x,origin.y,Math.min(width,height)*.22);glow.addColorStop(0,`rgba(${coolColour},.055)`);glow.addColorStop(.25,`rgba(${coolColour},.018)`);glow.addColorStop(1,`rgba(${coolColour},0)`);ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
    for(const star of stars){const before=projected(star);if(speed)star.z-=speed*delta/1000*(.82+star.radius*.24);let point=projected(star);if(star.z<4||point.x<-80||point.x>width+80||point.y<-80||point.y>height+80){reset(star);point=projected(star);star.previousX=point.x;star.previousY=point.y}const proximity=1-star.z/depth;const shimmer=paused?1:.88+Math.sin(time*.0012+star.phase)*.12;const alpha=Math.min(1,star.alpha*(.48+proximity*.8)*shimmer);const colour=star.warm?warmColour:coolColour;const trail=Math.hypot(point.x-before.x,point.y-before.y);if(speed&&trail>.12){const trailScale=effects==='ambient'?2.2:3.8;ctx.beginPath();ctx.moveTo(point.x-(point.x-before.x)*trailScale,point.y-(point.y-before.y)*trailScale);ctx.lineTo(point.x,point.y);ctx.strokeStyle=`rgba(${colour},${alpha*(.22+proximity*.48)})`;ctx.lineWidth=Math.min(2.2,.35+star.radius*proximity);ctx.stroke()}const radius=star.radius*(.42+proximity*1.6);ctx.beginPath();ctx.arc(point.x,point.y,radius,0,Math.PI*2);ctx.fillStyle=`rgba(${colour},${alpha})`;ctx.shadowColor=`rgb(${colour})`;ctx.shadowBlur=proximity>.72?5+star.radius*4:0;ctx.fill();ctx.shadowBlur=0;star.previousX=point.x;star.previousY=point.y}
    ctx.globalCompositeOperation='source-over'}

  function animate(time){if(!running)return;if(time-lastPaint>=33){paint(time,Math.min(80,time-lastPaint||33));lastPaint=time}frame=requestAnimationFrame(animate)}
  function syncTheme(){palette();paint(performance.now(),0);cancelAnimationFrame(frame);if(running&&!motionQuery.matches&&effects!=='still')frame=requestAnimationFrame(animate)}
  function visibility(){running=!document.hidden;cancelAnimationFrame(frame);if(running&&!motionQuery.matches&&effects!=='still')frame=requestAnimationFrame(animate)}
  addEventListener('resize',resize,{passive:true});addEventListener('companionthemechange',syncTheme);document.addEventListener('visibilitychange',visibility);motionQuery.addEventListener?.('change',syncTheme);palette();resize();if(!motionQuery.matches&&effects!=='still')frame=requestAnimationFrame(animate);
}
