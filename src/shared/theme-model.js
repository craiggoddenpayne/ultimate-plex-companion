export const COMPANION_THEMES = [
  { id:'solaris', name:'Solaris Command', tagline:'The original amber command deck', colour:'#f5ad2e', swatches:['#f5ad2e','#50d6d1','#a77aff'] },
  { id:'ion', name:'Ion Horizon', tagline:'Electric cyan and orbital blue', colour:'#39e7ff', swatches:['#39e7ff','#5488ff','#79ffd0'] },
  { id:'nebula', name:'Velvet Nebula', tagline:'Ultraviolet signals in deep space', colour:'#d76dff', swatches:['#d76dff','#ff659d','#765dff'] },
  { id:'aurora', name:'Aurora Protocol', tagline:'Emerald light over polar darkness', colour:'#56f5b2', swatches:['#56f5b2','#50d6e8','#d5ff72'] },
  { id:'ember', name:'Red Giant', tagline:'Hot coral telemetry and molten gold', colour:'#ff765e', swatches:['#ff765e','#ffbd59','#ef4773'] },
];

export const EFFECT_LEVELS = ['full','ambient','still'];

export function normalizeThemePreferences(input={}) {
  const theme=COMPANION_THEMES.some(item=>item.id===input.theme)?input.theme:'solaris';
  const effects=EFFECT_LEVELS.includes(input.effects)?input.effects:'full';
  return { theme, effects };
}
