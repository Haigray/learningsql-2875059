// Design tokens, matching the printed guides so the two read as one product.
import { useColorScheme } from 'react-native';

const light = {
  bg: '#fbfaf8', surface: '#ffffff', ink: '#1c1a17', muted: '#5f5a52', faint: '#8a837a',
  line: '#e3ded6', lineStrong: '#cfc7bb', accent: '#8a3324', accentSoft: '#f5ebe8',
  ok: '#2f6a4a', okSoft: '#e7f2ec', warn: '#8a6a1f', warnSoft: '#fbf3e0',
  danger: '#a3301f', dangerSoft: '#fbeceb',
};
const dark = {
  bg: '#16151a', surface: '#1e1d23', ink: '#eceaf0', muted: '#a8a3b0', faint: '#7d7889',
  line: '#2e2c36', lineStrong: '#413e4c', accent: '#e08a72', accentSoft: '#2c2020',
  ok: '#7fc4a0', okSoft: '#1d2b24', warn: '#e0bd72', warnSoft: '#2b2519',
  danger: '#f0897a', dangerSoft: '#2e1e1c',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 6, md: 10, pill: 999 };

export const type = {
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: -0.4 },
  h2: { fontSize: 20, fontWeight: '650', letterSpacing: -0.2 },
  h3: { fontSize: 16, fontWeight: '650' },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 19 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
};

/** State colours are shared by every screen, so they mean one thing everywhere. */
export const stateColor = (c, state) => ({
  ready: c.ok, waiting: c.warn, locked: c.faint, overdue: c.danger,
  infeasible: c.danger, reorder: c.danger, done: c.faint,
  ongoing: c.muted, contingency: c.muted, scheduled: c.muted,
}[state] ?? c.muted);

export const stateLabel = state => ({
  ready: 'Do now', waiting: 'Not yet', locked: 'Blocked', overdue: 'Overdue',
  infeasible: 'Impossible', reorder: 'Re-order', done: 'Done',
  ongoing: 'Ongoing', contingency: 'If needed', scheduled: 'Scheduled',
}[state] ?? state);

export function useTheme() {
  return useColorScheme() === 'dark' ? dark : light;
}
