export const COMPANION_THEMES = [
  {
    id: 'solaris',
    name: 'Solaris Command',
    tagline: 'The original amber command deck',
    colour: '#f5ad2e',
    mode: 'dark',
    preview: ['#080a0f', '#101319'],
    swatches: ['#f5ad2e', '#50d6d1', '#a77aff'],
  },
  {
    id: 'ion',
    name: 'Ion Horizon',
    tagline: 'Electric cyan and orbital blue',
    colour: '#39e7ff',
    mode: 'dark',
    preview: ['#040b12', '#09151f'],
    swatches: ['#39e7ff', '#5488ff', '#79ffd0'],
  },
  {
    id: 'nebula',
    name: 'Velvet Nebula',
    tagline: 'Ultraviolet signals in deep space',
    colour: '#d76dff',
    mode: 'dark',
    preview: ['#0b0712', '#151020'],
    swatches: ['#d76dff', '#ff659d', '#765dff'],
  },
  {
    id: 'aurora',
    name: 'Aurora Protocol',
    tagline: 'Emerald light over polar darkness',
    colour: '#56f5b2',
    mode: 'dark',
    preview: ['#04100f', '#091a18'],
    swatches: ['#56f5b2', '#50d6e8', '#d5ff72'],
  },
  {
    id: 'ember',
    name: 'Red Giant',
    tagline: 'Hot coral telemetry and molten gold',
    colour: '#ff765e',
    mode: 'dark',
    preview: ['#100706', '#1b100e'],
    swatches: ['#ff765e', '#ffbd59', '#ef4773'],
  },

  // Additional dark command environments.
  {
    id: 'darcula',
    name: 'Darcula IDE',
    tagline: 'Focused graphite with warm code accents',
    colour: '#cc7832',
    mode: 'dark',
    preview: ['#2b2b2b', '#323232'],
    swatches: ['#cc7832', '#6897bb', '#9876aa'],
  },
  {
    id: 'void',
    name: 'OLED Void',
    tagline: 'True-black cinema room minimalism',
    colour: '#dff6ff',
    mode: 'dark',
    preview: ['#000104', '#080a0e'],
    swatches: ['#dff6ff', '#32e6c4', '#788bff'],
  },
  {
    id: 'synthwave',
    name: 'Synthwave 2099',
    tagline: 'Electric sunset across a violet grid',
    colour: '#ff4fd8',
    mode: 'dark',
    preview: ['#10051b', '#1b0a2a'],
    swatches: ['#ff4fd8', '#35e8ff', '#8c63ff'],
  },
  {
    id: 'matrix',
    name: 'Matrix Terminal',
    tagline: 'Phosphor green operator console',
    colour: '#54ff83',
    mode: 'dark',
    preview: ['#020b05', '#07140b'],
    swatches: ['#54ff83', '#18c75a', '#c8ff63'],
  },
  {
    id: 'nordic',
    name: 'Nordic Night',
    tagline: 'Calm arctic blues and polar contrast',
    colour: '#88c0d0',
    mode: 'dark',
    preview: ['#242933', '#2e3440'],
    swatches: ['#88c0d0', '#81a1c1', '#b48ead'],
  },

  // Light environments preserve the same information hierarchy without glare.
  {
    id: 'daylight',
    name: 'Lunar Daylight',
    tagline: 'Crisp mission control in open daylight',
    colour: '#007f8b',
    mode: 'light',
    preview: ['#eef3f7', '#ffffff'],
    swatches: ['#007f8b', '#1769aa', '#7756c8'],
  },
  {
    id: 'porcelain',
    name: 'Porcelain Signal',
    tagline: 'Warm paper surfaces and copper signals',
    colour: '#a85409',
    mode: 'light',
    preview: ['#f7f3ec', '#fffdfa'],
    swatches: ['#a85409', '#237c76', '#7357a8'],
  },
  {
    id: 'sakura',
    name: 'Sakura Dawn',
    tagline: 'Soft rose light with cool telemetry',
    colour: '#b82f65',
    mode: 'light',
    preview: ['#fff4f7', '#fffafd'],
    swatches: ['#b82f65', '#317b86', '#735bc0'],
  },
  {
    id: 'arctic',
    name: 'Arctic Console',
    tagline: 'Glacial clarity for bright workspaces',
    colour: '#007792',
    mode: 'light',
    preview: ['#edf7fb', '#fafdff'],
    swatches: ['#007792', '#2d70b3', '#6b58b5'],
  },
  {
    id: 'solar-paper',
    name: 'Solar Paper',
    tagline: 'Sunlit cream with cobalt navigation',
    colour: '#b85d00',
    mode: 'light',
    preview: ['#fff8e8', '#fffdf7'],
    swatches: ['#b85d00', '#225ea8', '#6f4db2'],
  },
];

export const EFFECT_LEVELS = ['full', 'ambient', 'still'];
export const TEXT_SIZES = ['standard', 'comfortable', 'large', 'extra-large'];
export const BACKGROUND_VISUALIZATIONS = [
  { id: 'starfield', name: 'Starfield', tagline: 'A calm flight through distant light' },
  { id: 'vortex', name: 'Vortex', tagline: 'A slow spiral around the command deck' },
  { id: 'aurora', name: 'Aurora', tagline: 'Soft ribbons of atmospheric colour' },
  { id: 'constellation', name: 'Constellations', tagline: 'Drifting points with quiet connections' },
  { id: 'orbits', name: 'Orbital Rings', tagline: 'Measured paths and travelling satellites' },
  { id: 'waves', name: 'Signal Waves', tagline: 'Layered telemetry moving across the horizon' },
  { id: 'embers', name: 'Ember Drift', tagline: 'Warm particles rising through the interface' },
  { id: 'off', name: 'No visualizer', tagline: 'Theme colour and haze only' },
];

export function normalizeThemePreferences(input: any = {}) {
  // Accept the common misspelling while storing the canonical Darcula id.
  const requestedTheme = input.theme === 'darkula' ? 'darcula' : input.theme;
  const theme = COMPANION_THEMES.some((item) => item.id === requestedTheme) ? requestedTheme : 'solaris';
  const effects = EFFECT_LEVELS.includes(input.effects) ? input.effects : 'full';
  const textSize = TEXT_SIZES.includes(input.textSize) ? input.textSize : 'comfortable';
  const background = BACKGROUND_VISUALIZATIONS.some((item) => item.id === input.background)
    ? input.background
    : 'starfield';
  return { theme, effects, textSize, background };
}
