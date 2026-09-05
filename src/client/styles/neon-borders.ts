const borderTargets='.panel,.atlas-panel,.lab-stage,.recommendation-shelf,.blueprint,.auto-safety,.auto-modal,.overlap-modal,.theme-modal,.profile-modal,.settings-modal';
const visibility=new IntersectionObserver(entries=>entries.forEach(entry=>entry.target.classList.toggle('neon-border-active',entry.isIntersecting)),{rootMargin:'80px',threshold:.01});

function installBorder(node){if(!(node instanceof Element)||node.classList.contains('neon-border-host'))return;node.classList.add('neon-border-host');const runner=document.createElement('i');runner.className='neon-border-runner';runner.setAttribute('aria-hidden','true');runner.innerHTML='<span></span><span></span><span></span><span></span>';node.append(runner);visibility.observe(node)}
function scan(root:any=document){if(root.matches?.(borderTargets))installBorder(root);root.querySelectorAll?.(borderTargets).forEach(installBorder)}

const mutations=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>scan(node))));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{scan();mutations.observe(document.body,{childList:true,subtree:true})});else{scan();mutations.observe(document.body,{childList:true,subtree:true})}
