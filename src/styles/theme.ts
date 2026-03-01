import { StyleSheet } from 'react-native';

export const Colors = {
  // Background hierarchy
  bg0: '#040609',
  bg1: '#0A0E1A',
  bg2: '#111827',
  bg3: '#1C2333',
  bg4: '#243047',

  // Brand / Accent
  accent: '#4F8EF7',
  accentDim: '#2D5DB0',
  accentGlow: 'rgba(79, 142, 247, 0.15)',

  // Risk colours
  riskLow: '#22C55E',
  riskLowBg: 'rgba(34, 197, 94, 0.1)',
  riskModerate: '#F59E0B',
  riskModerateBg: 'rgba(245, 158, 11, 0.1)',
  riskHigh: '#EF4444',
  riskHighBg: 'rgba(239, 68, 68, 0.1)',

  // Engine colours
  engineGaze: '#60A5FA',
  engineMotor: '#A78BFA',
  engineFace: '#34D399',

  // Text
  textPrimary: '#F0F4FF',
  textSecondary: '#8B9BBE',
  textMuted: '#4B5A7A',
  textInverse: '#0A0E1A',

  // Border
  border: 'rgba(255,255,255,0.07)',
  borderActive: 'rgba(79, 142, 247, 0.4)',

  // Status
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
};

export const Typography = {
  displayLarge: { fontSize: 32, fontFamily: 'Inter_700Bold', lineHeight: 40 },
  displayMedium: { fontSize: 24, fontFamily: 'Inter_700Bold', lineHeight: 32 },
  headline: { fontSize: 20, fontFamily: 'Inter_600SemiBold', lineHeight: 28 },
  title: { fontSize: 17, fontFamily: 'Inter_600SemiBold', lineHeight: 24 },
  body: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  bodyMedium: { fontSize: 15, fontFamily: 'Inter_600SemiBold', lineHeight: 22 },
  caption: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  captionMedium: { fontSize: 13, fontFamily: 'Inter_600SemiBold', lineHeight: 18 },
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold', lineHeight: 16, letterSpacing: 0.8 },
  mono: { fontSize: 13, fontFamily: 'Courier', lineHeight: 18 },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const Radii = {
  sm: 6,
  md: 12,
  lg: 18,
  xl: 24,
  full: 9999,
};

export const Shadows = {
  glow: {
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
};

export const GlobalStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bg1,
  },
  card: {
    backgroundColor: Colors.bg2,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    ...Shadows.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});