import { COMPANION_THEMES, normalizeThemePreferences } from '../../shared/theme-model.js';

const storageKey='ultimate-plex-companion:appearance';
const themeEscape=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
let preferences=loadPreferences();

function loadPreferences(){try{return normalizeThemePreferences(JSON.parse(localStorage.getItem(storageKey)||'{}'))}catch{return normalizeThemePreferences()}}

function applyPreferences(next,{persist=true,announce=false}={}){
  preferences=normalizeThemePreferences(next);
  document.documentElement.dataset.theme=preferences.theme;
  document.documentElement.dataset.effects=preferences.effects;
  const selected=COMPANION_THEMES.find(item=>item.id===preferences.theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',selected.colour);
  if(persist)localStorage.setItem(storageKey,JSON.stringify(preferences));
  window.dispatchEvent(new CustomEvent('companionthemechange',{detail:{...preferences}}));
  if(announce)themeToast(`${selected.name} theme active`);
}

function paletteIcon(){return '<svg class="icon" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18h1.3a1.7 1.7 0 0 0 0-3.4h-.7a1.4 1.4 0 0 1 0-2.8H15A6 6 0 0 0 21 9c0-3.3-4-6-9-6Z"/><circle cx="7.5" cy="10" r=".8"/><circle cx="10" cy="6.8" r=".8"/><circle cx="15" cy="7" r=".8"/></svg>'}

function modalMarkup(){return `<div class="theme-modal-wrap"><div class="theme-backdrop"></div><section class="theme-modal"><button class="theme-close" aria-label="Close">×</button><header><div class="theme-prism"><i></i><i></i><i></i></div><div><span class="eyebrow">VISUAL SYSTEM · PERSONAL CONSOLE</span><h2>Choose your universe.</h2><p>Every command surface, signal and ambient light responds instantly.</p></div></header><div class="theme-grid">${COMPANION_THEMES.map(item=>`<button class="theme-card ${item.id===preferences.theme?'active':''}" data-theme-choice="${item.id}" style="--preview:${item.colour}"><span class="theme-card-preview"><i></i><i></i><i></i><em></em></span><b>${themeEscape(item.name)}</b><small>${themeEscape(item.tagline)}</small><span class="theme-swatches">${item.swatches.map(colour=>`<i style="background:${colour}"></i>`).join('')}</span><strong>${item.id===preferences.theme?'ACTIVE':'SELECT'}</strong></button>`).join('')}</div><section class="effect-control"><div><span>VISUAL ENERGY</span><h3>Control ambient motion</h3><p>Still mode pauses decorative animation while preserving the complete interface.</p></div><div class="effect-options">${[['full','Full energy'],['ambient','Ambient'],['still','Still']].map(([value,label])=>`<button data-effect-choice="${value}" class="${preferences.effects===value?'active':''}"><i></i>${label}</button>`).join('')}</div></section><footer><span>Saved on this browser · No account data leaves your network</span><button class="theme-reset">Restore Solaris</button><button class="theme-done">Done</button></footer></section></div>`}

function themeToast(message){let region=document.querySelector('#toast-region');if(!region){region=document.createElement('div');region.id='toast-region';document.body.append(region)}const node=document.createElement('div');node.className='toast theme-toast';node.innerHTML=`${paletteIcon()}<span>${themeEscape(message)}</span>`;region.append(node);setTimeout(()=>node.remove(),3000)}

export function openThemeStudio(){document.querySelector('.theme-modal-wrap')?.remove();document.body.insertAdjacentHTML('beforeend',modalMarkup());const wrap=document.querySelector('.theme-modal-wrap'),close=()=>wrap.remove();wrap.querySelector('.theme-close').onclick=close;wrap.querySelector('.theme-backdrop').onclick=close;wrap.querySelector('.theme-done').onclick=close;wrap.querySelectorAll('[data-theme-choice]').forEach(button=>button.onclick=()=>{applyPreferences({...preferences,theme:button.dataset.themeChoice},{announce:true});wrap.querySelectorAll('.theme-card').forEach(card=>{const active=card.dataset.themeChoice===preferences.theme;card.classList.toggle('active',active);card.querySelector('strong').textContent=active?'ACTIVE':'SELECT'})});wrap.querySelectorAll('[data-effect-choice]').forEach(button=>button.onclick=()=>{applyPreferences({...preferences,effects:button.dataset.effectChoice});wrap.querySelectorAll('[data-effect-choice]').forEach(item=>item.classList.toggle('active',item.dataset.effectChoice===preferences.effects))});wrap.querySelector('.theme-reset').onclick=()=>{close();applyPreferences({theme:'solaris',effects:'full'},{announce:true})}}

function installLaunchers(){const actions=document.querySelector('.top-actions');if(actions&&!actions.querySelector('[data-action="themes"]')){const button=document.createElement('button');button.className='icon-button theme-launcher';button.dataset.action='themes';button.setAttribute('aria-label','Appearance and themes');button.innerHTML=paletteIcon();button.onclick=openThemeStudio;actions.insertBefore(button,actions.lastElementChild)}document.addEventListener('opencompanionthemes',openThemeStudio);document.addEventListener('keydown',event=>{if(event.shiftKey&&event.key.toLowerCase()==='t'&&!/input|textarea|select/i.test(event.target.tagName)){event.preventDefault();openThemeStudio()}})}

applyPreferences(preferences,{persist:false});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installLaunchers);else installLaunchers();
