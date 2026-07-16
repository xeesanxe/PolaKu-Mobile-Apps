// Design tokens terpusat untuk Login, Register, dan Onboarding.
// Satu sumber kebenaran biar warna, radius, dan style field konsisten
// di semua screen alur autentikasi.

export const AuthDesign = {
  primary: '#024594',
  primaryLight: '#2C5EAD',
  onPrimary: '#FFFFFF',
  onSurface: '#191B21',
  onSurfaceVariant: '#434751',
  outline: '#737782',
  outlineVariant: '#C3C6D3',
  background: '#F9F9FF',
  brandAccent: '#C4E2F5',
  error: '#BA1A1A',
  surface: '#FFFFFF',
};

export const AuthRadius = {
  card: 20,
  input: 12,
  button: 12,
  chip: 999, // full round untuk chip/pill
};

export const AuthSpacing = {
  screenPadding: 20,
  cardPadding: 24,
  fieldGap: 16,
  labelGap: 6,
};

// Style field input yang konsisten dipakai di semua screen (boxed style)
export const inputBoxStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  borderWidth: 1.5,
  borderRadius: AuthRadius.input,
  paddingHorizontal: 12,
  height: 48,
  borderColor: AuthDesign.outlineVariant,
};

export const cardStyle = {
  borderRadius: AuthRadius.card,
  borderWidth: 1,
  borderColor: AuthDesign.brandAccent + '4D',
  backgroundColor: AuthDesign.surface,
  padding: AuthSpacing.cardPadding,
};