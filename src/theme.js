export const colors = {
  bg: '#F2F8FD',
  card: '#FFFFFF',
  navy: '#12214F',
  text: '#1B2A41',
  muted: '#6B7B93',
  border: '#E3ECF5',
  primary: '#1976D2',
  primarySoft: '#E3F0FB',
  infoBg: '#E4F0FB',
  infoText: '#33475F',
  toggleOn: '#4CAF50',
  toggleOff: '#CBD5E1',
};

// Palettes keyed by level; the status card reuses them (good / moderate / bad).
export const palettes = {
  good: { bg: '#E3F4E4', title: '#1B5E20', accent: '#2E9E4B', pillBg: '#D5EFD8', pillText: '#2E7D32' },
  moderate: { bg: '#FDEBD0', title: '#E65100', accent: '#F39C12', pillBg: '#FFE6B3', pillText: '#D98200' },
  bad: { bg: '#FCE2E2', title: '#C62828', accent: '#E53935', pillBg: '#FDE0E0', pillText: '#D32F2F' },
  info: { bg: '#E3F0FB', title: '#1565C0', accent: '#1976D2', pillBg: '#E3F0FB', pillText: '#1976D2' },
  // No reading for this channel: grey, so it reads as absent rather than as a grade.
  none: { bg: '#EEF2F7', title: '#5B6B80', accent: '#AFBCCC', pillBg: '#E8EDF3', pillText: '#6B7B93' },
};

export const cardShadow = {
  shadowColor: '#0B2447',
  shadowOpacity: 0.07,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};
