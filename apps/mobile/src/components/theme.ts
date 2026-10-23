import { useColorScheme } from 'react-native';

const light = {
  bg: '#F6F7F9', card: '#FFFFFF', text: '#14171A', muted: '#5B6470', border: '#E3E6EA',
  accent: '#1F6FEB', accentText: '#FFFFFF', chip: '#EEF1F5',
  warn: '#B54708', warnBg: '#FEF0C7', info: '#175CD3', infoBg: '#D1E9FF', good: '#067647', goodBg: '#D1FADF',
};
const dark: typeof light = {
  bg: '#0E1116', card: '#161B22', text: '#E6EDF3', muted: '#8B949E', border: '#30363D',
  accent: '#4C8DFF', accentText: '#0E1116', chip: '#21262D',
  warn: '#F5B451', warnBg: '#3D2A0C', info: '#79B8FF', infoBg: '#10243E', good: '#56D364', goodBg: '#0F2E1A',
};

export type Theme = typeof light;
export const useTheme = (): Theme => (useColorScheme() === 'dark' ? dark : light);
