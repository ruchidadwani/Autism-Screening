/**
 * Shared reusable UI Components
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radii } from '../styles/theme';

// ── Risk Score Gauge Bar ─────────────────────────────────────────────────────

interface RiskBarProps {
  score: number;            // 0.0 - 1.0
  color: string;
  label?: string;
  height?: number;
}

export function RiskBar({ score, color, label, height = 8 }: RiskBarProps) {
  return (
    <View>
      {label && (
        <View style={styles.riskBarHeader}>
          <Text style={styles.riskBarLabel}>{label}</Text>
          <Text style={[styles.riskBarValue, { color }]}>
            {(score * 100).toFixed(0)}%
          </Text>
        </View>
      )}
      <View style={[styles.riskBarTrack, { height }]}>
        <View
          style={[
            styles.riskBarFill,
            { width: `${Math.min(100, score * 100)}%`, backgroundColor: color, height }
          ]}
        />
      </View>
    </View>
  );
}

// ── Metric Tile ──────────────────────────────────────────────────────────────

interface MetricTileProps {
  label: string;
  value: string | number;
  subLabel?: string;
  color?: string;
  icon?: string;
}

export function MetricTile({ label, value, subLabel, color = Colors.textPrimary, icon }: MetricTileProps) {
  return (
    <View style={styles.metricTile}>
      {icon && <Text style={styles.metricTileIcon}>{icon}</Text>}
      <Text style={[styles.metricTileValue, { color }]}>{value}</Text>
      <Text style={styles.metricTileLabel}>{label}</Text>
      {subLabel && <Text style={styles.metricTileSubLabel}>{subLabel}</Text>}
    </View>
  );
}

// ── Primary Button ───────────────────────────────────────────────────────────

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function PrimaryButton({ label, onPress, disabled, loading }: PrimaryButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.primaryBtn, disabled && styles.primaryBtnDisabled]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.85}
    >
      <LinearGradient
        colors={disabled ? [Colors.bg3, Colors.bg3] : [Colors.accent, Colors.accentDim]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.primaryBtnGradient}
      >
        {loading
          ? <ActivityIndicator color={Colors.textInverse} />
          : <Text style={[styles.primaryBtnText, disabled && styles.primaryBtnTextDisabled]}>{label}</Text>
        }
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ── Section Header ───────────────────────────────────────────────────────────

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionHeaderSub}>{subtitle}</Text>}
    </View>
  );
}

// ── Info Card ────────────────────────────────────────────────────────────────

interface InfoCardProps {
  type: 'info' | 'warning' | 'success' | 'error';
  message: string;
  title?: string;
}

const INFO_COLORS = {
  info:    { bg: Colors.accentGlow, border: Colors.borderActive, text: Colors.accent },
  warning: { bg: Colors.riskModerateBg, border: 'rgba(245,158,11,0.3)', text: Colors.riskModerate },
  success: { bg: Colors.riskLowBg, border: 'rgba(34,197,94,0.3)', text: Colors.riskLow },
  error:   { bg: Colors.riskHighBg, border: 'rgba(239,68,68,0.3)', text: Colors.riskHigh },
};

export function InfoCard({ type, message, title }: InfoCardProps) {
  const c = INFO_COLORS[type];
  return (
    <View style={[styles.infoCard, { backgroundColor: c.bg, borderColor: c.border }]}>
      {title && <Text style={[styles.infoCardTitle, { color: c.text }]}>{title}</Text>}
      <Text style={[styles.infoCardMessage, { color: c.text }]}>{message}</Text>
    </View>
  );
}

// ── Divider ──────────────────────────────────────────────────────────────────

export function Divider({ spacing = Spacing.md }: { spacing?: number }) {
  return <View style={[styles.divider, { marginVertical: spacing }]} />;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // RiskBar
  riskBarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  riskBarLabel: { ...Typography.caption, color: Colors.textSecondary },
  riskBarValue: { ...Typography.captionMedium },
  riskBarTrack: {
    backgroundColor: Colors.bg3,
    borderRadius: Radii.full,
    overflow: 'hidden',
  },
  riskBarFill: {
    borderRadius: Radii.full,
  },

  // MetricTile
  metricTile: {
    backgroundColor: Colors.bg2,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  metricTileIcon: { fontSize: 20 },
  metricTileValue: { ...Typography.headline },
  metricTileLabel: { ...Typography.caption, color: Colors.textSecondary },
  metricTileSubLabel: { ...Typography.label, color: Colors.textMuted },

  // PrimaryButton
  primaryBtn: { borderRadius: Radii.lg, overflow: 'hidden' },
  primaryBtnDisabled: {},
  primaryBtnGradient: {
    paddingVertical: Spacing.md + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { ...Typography.title, color: Colors.textInverse },
  primaryBtnTextDisabled: { color: Colors.textMuted },

  // SectionHeader
  sectionHeader: { marginBottom: Spacing.md },
  sectionHeaderTitle: { ...Typography.headline, color: Colors.textPrimary, marginBottom: 4 },
  sectionHeaderSub: { ...Typography.body, color: Colors.textSecondary },

  // InfoCard
  infoCard: {
    borderRadius: Radii.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  infoCardTitle: { ...Typography.bodyMedium, marginBottom: Spacing.xs },
  infoCardMessage: { ...Typography.body, lineHeight: 21 },

  // Divider
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
});