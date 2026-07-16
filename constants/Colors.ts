const primary = '#2C5EAD'; 
const secondary = '#1591DC'; 
const accent = '#4BB8FA'; 
const soft = '#C4E2F5';   

export default {
  light: {
    text: '#1A1A1A',
    textSecondary: '#60646C',
    background: '#FFFFFF',
    backgroundElement: '#F0F4F9',
    tint: primary,
    tabIconDefault: '#B0B4BA',
    tabIconSelected: primary,
    border: soft,
    error: '#F4785C',
  },
  dark: {
    text: '#FFFFFF',
    textSecondary: '#B0B4BA',
    background: '#0D1117',
    backgroundElement: '#1A1F26',
    tint: accent,
    tabIconDefault: '#60646C',
    tabIconSelected: accent,
    border: '#2A2F38',
    error: '#F4785C',
  },
};


export const HealthPalette = {
  primary,
  secondary,
  accent,
  soft,
};