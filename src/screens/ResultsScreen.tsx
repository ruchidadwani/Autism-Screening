import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Dimensions, Share
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, G } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { Colors, Typography, Spacing, Radii } from '../styles/theme';
import { RootStackParamList, ScreeningResult, FUSION_WEIGHTS } from '../utils/types';
import { estimateConfidence } from '../services/fusionEngine';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;

const { width } = Dimensions.get('window');
const GAUGE_SIZE = 200;
const GAUGE_STROKE = 16;
const GAUGE_RADIUS = (GAUGE_SIZE - GAUGE_STROKE) / 2;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

// ── Risk colour helper ────────────────────────────────────────────────────────
function riskColors(level: ScreeningResult['riskLevel']) {
  switch (level) {
    case 'high':     return { primary: Colors.riskHigh,     bg: Colors.riskHighBg };
    case 'moderate': return { primary: Colors.riskModerate, bg: Colors.riskModerateBg };
    case 'low':      return { primary: Colors.riskLow,      bg: Colors.riskLowBg };
  }
}

function riskLabel(level: ScreeningResult['riskLevel']) {
  switch (level) {
    case 'high':     return '⚠️  High Risk — Clinical Review Recommended';
    case 'moderate': return '⚡  Moderate Risk — Monitor & Consult Pediatrician';
    case 'low':      return '✓  Low Risk — Routine Developmental Monitoring';
  }
}

export function ResultsScreen({ navigation, route }: Props) {
  const { result } = route.params;
  const { primary, bg: bgColor } = riskColors(result.riskLevel);

  const confidence = estimateConfidence(
    result.gaze, result.motor, result.facial, result.sessionDurationSeconds
  );

  // ── Animations ─────────────────────────────────────────────────────────────
  const headerFade  = useRef(new Animated.Value(0)).current;
  const gaugeFill   = useRef(new Animated.Value(0)).current;
  const cardSlide   = useRef(new Animated.Value(40)).current;
  const cardFade    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(
      result.riskLevel === 'high'
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Success
    );

    Animated.sequence([
      Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(gaugeFill, { toValue: result.finalRiskScore, duration: 1200, useNativeDriver: false }),
        Animated.timing(cardSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
        Animated.timing(cardFade,  { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  // Gauge stroke offset
  const strokeDashoffset = gaugeFill.interpolate({
    inputRange: [0, 1],
    outputRange: [GAUGE_CIRCUMFERENCE * 0.75, GAUGE_CIRCUMFERENCE * 0.75 - GAUGE_CIRCUMFERENCE * 0.75 * result.finalRiskScore],
  });

  const handleShare = async () => {
    const scoreStr = (result.finalRiskScore * 100).toFixed(1);
    const msg = `ASD Screening Result — Session ${result.sessionId}\n` +
      `Risk Score: ${scoreStr}% (${result.riskLevel.toUpperCase()})\n` +
      `Gaze: ${(result.gaze.gazeRiskScore * 100).toFixed(0)}% | ` +
      `Motor: ${(result.motor.motorRiskScore * 100).toFixed(0)}% | ` +
      `Face: ${(result.facial.faceRiskScore * 100).toFixed(0)}%\n\n` +
      result.recommendation;
    await Share.share({ message: msg });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <Animated.View style={[styles.header, { opacity: headerFade }]}>
          <Text style={styles.headerLabel}>SCREENING RESULT</Text>
          <Text style={styles.sessionId}>Session #{result.sessionId}</Text>
          <Text style={styles.timestamp}>
            {new Date(result.timestamp).toLocaleDateString('en-US', {
              weekday: 'short', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            })}
          </Text>
        </Animated.View>

        {/* Gauge + Score */}
        <Animated.View style={[styles.gaugeSection, { opacity: headerFade }]}>
          <View style={styles.gaugeContainer}>
            <Svg width={GAUGE_SIZE} height={GAUGE_SIZE * 0.7} viewBox={`0 0 ${GAUGE_SIZE} ${GAUGE_SIZE * 0.7}`}>
              <G rotation="-135" origin={`${GAUGE_SIZE / 2}, ${GAUGE_SIZE / 2}`}>
                {/* Track */}
                <Circle
                  cx={GAUGE_SIZE / 2} cy={GAUGE_SIZE / 2}
                  r={GAUGE_RADIUS}
                  fill="none"
                  stroke={Colors.bg3}
                  strokeWidth={GAUGE_STROKE}
                  strokeDasharray={`${GAUGE_CIRCUMFERENCE * 0.75} ${GAUGE_CIRCUMFERENCE * 0.25}`}
                  strokeLinecap="round"
                />
                {/* Animated fill */}
                <AnimatedCircle
                  cx={GAUGE_SIZE / 2} cy={GAUGE_SIZE / 2}
                  r={GAUGE_RADIUS}
                  fill="none"
                  stroke={primary}
                  strokeWidth={GAUGE_STROKE}
                  strokeDasharray={`${GAUGE_CIRCUMFERENCE * 0.75} ${GAUGE_CIRCUMFERENCE * 0.25}`}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </G>
            </Svg>

            {/* Score text */}
            <View style={styles.gaugeCenter}>
              <Text style={[styles.gaugeScore, { color: primary }]}>
                {(result.finalRiskScore * 100).toFixed(0)}
              </Text>
              <Text style={styles.gaugeScoreUnit}>/ 100</Text>
            </View>
          </View>

          {/* Risk banner */}
          <View style={[styles.riskBanner, { backgroundColor: bgColor, borderColor: `${primary}40` }]}>
            <Text style={[styles.riskBannerText, { color: primary }]}>
              {riskLabel(result.riskLevel)}
            </Text>
          </View>

          <Text style={styles.confidenceText}>
            Analysis confidence: {confidence}% · {result.sessionDurationSeconds}s session
          </Text>
        </Animated.View>

        {/* Engine Breakdown */}
        <Animated.View style={[styles.section, { opacity: cardFade, transform: [{ translateY: cardSlide }] }]}>
          <Text style={styles.sectionTitle}>ENGINE BREAKDOWN</Text>
          <View style={styles.engineGrid}>
            <EngineBreakdownCard
              label="Engine A"
              name="Gaze Analysis"
              score={result.gaze.gazeRiskScore}
              weight={FUSION_WEIGHTS.gaze}
              color={Colors.engineGaze}
              details={[
                { label: 'Head Yaw', value: `${result.gaze.headYawMean.toFixed(1)}°` },
                { label: 'Iris Dev.', value: result.gaze.irisDeviationMean.toFixed(3) },
                { label: 'Aversion', value: `${result.gaze.aversionFrameCount} frames` },
              ]}
            />
            <EngineBreakdownCard
              label="Engine B"
              name="Motor Biometrics"
              score={result.motor.motorRiskScore}
              weight={FUSION_WEIGHTS.motor}
              color={Colors.engineMotor}
              details={[
                { label: 'Stimming', value: result.motor.stimmingDetected ? 'Detected' : 'None' },
                { label: 'Motion Energy', value: (result.motor.motionEnergy * 100).toFixed(0) + '%' },
                { label: 'Buffer', value: result.motor.bufferComplete ? 'Complete' : 'Partial' },
              ]}
            />
            <EngineBreakdownCard
              label="Engine C"
              name="Facial Phenotyping"
              score={result.facial.faceRiskScore}
              weight={FUSION_WEIGHTS.face}
              color={Colors.engineFace}
              details={[
                { label: 'Face Detected', value: result.facial.faceDetected ? 'Yes' : 'No' },
                { label: 'Confidence', value: (result.facial.confidence * 100).toFixed(0) + '%' },
              ]}
            />
          </View>
        </Animated.View>

        {/* Fusion Formula */}
        <Animated.View style={[styles.section, { opacity: cardFade }]}>
          <Text style={styles.sectionTitle}>FUSION CALCULATION</Text>
          <View style={styles.formulaCard}>
            <FormulaRow
              label="Gaze Risk"
              weight={0.4}
              score={result.gaze.gazeRiskScore}
              color={Colors.engineGaze}
            />
            <FormulaRow
              label="Motor Risk"
              weight={0.4}
              score={result.motor.motorRiskScore}
              color={Colors.engineMotor}
            />
            <FormulaRow
              label="Face Risk"
              weight={0.2}
              score={result.facial.faceRiskScore}
              color={Colors.engineFace}
            />
            <View style={styles.formulaDivider} />
            <View style={styles.formulaTotal}>
              <Text style={styles.formulaTotalLabel}>Final Risk Score</Text>
              <Text style={[styles.formulaTotalValue, { color: riskColors(result.riskLevel).primary }]}>
                {(result.finalRiskScore * 100).toFixed(1)}%
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Clinical Recommendation */}
        <Animated.View style={[styles.section, { opacity: cardFade }]}>
          <Text style={styles.sectionTitle}>CLINICAL RECOMMENDATION</Text>
          <View style={[styles.recCard, { borderColor: `${riskColors(result.riskLevel).primary}30` }]}>
            <LinearGradient
              colors={[riskColors(result.riskLevel).bg, 'transparent']}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.recText}>{result.recommendation}</Text>
          </View>
        </Animated.View>

        {/* Disclaimer */}
        <View style={styles.legalNote}>
          <Text style={styles.legalText}>
            This result is generated by an automated AI screening tool and is NOT a medical
            diagnosis. DSM-5 criteria require comprehensive clinical evaluation by qualified
            professionals. Session ID: {result.sessionId}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <Text style={styles.shareBtnText}>Share Report</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.newSessionBtn}
            onPress={() => navigation.navigate('Welcome')}
          >
            <LinearGradient
              colors={[Colors.accent, Colors.accentDim]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.newSessionGradient}
            >
              <Text style={styles.newSessionText}>New Screening Session</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// Animated SVG circle
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ── Sub-components ────────────────────────────────────────────────────────────

function EngineBreakdownCard({
  label, name, score, weight, color, details
}: {
  label: string; name: string; score: number; weight: number;
  color: string; details: { label: string; value: string }[];
}) {
  return (
    <View style={[styles.engineCard, { borderColor: `${color}25` }]}>
      <View style={styles.engineCardHeader}>
        <View style={[styles.engineLabel, { backgroundColor: `${color}15` }]}>
          <Text style={[styles.engineLabelText, { color }]}>{label}</Text>
        </View>
        <Text style={[styles.engineScore, { color }]}>{(score * 100).toFixed(0)}%</Text>
      </View>
      <Text style={styles.engineName}>{name}</Text>

      <View style={styles.engineBar}>
        <View style={[styles.engineBarFill, { width: `${score * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.engineWeight}>Weight: {(weight * 100).toFixed(0)}%</Text>

      {details.map((d) => (
        <View key={d.label} style={styles.detailRow}>
          <Text style={styles.detailLabel}>{d.label}</Text>
          <Text style={styles.detailValue}>{d.value}</Text>
        </View>
      ))}
    </View>
  );
}

function FormulaRow({
  label, weight, score, color
}: { label: string; weight: number; score: number; color: string }) {
  const contribution = weight * score;
  return (
    <View style={styles.formulaRow}>
      <Text style={[styles.formulaWeight, { color }]}>{weight.toFixed(1)}</Text>
      <Text style={styles.formulaOp}>×</Text>
      <Text style={styles.formulaScore}>{(score * 100).toFixed(1)}%</Text>
      <Text style={styles.formulaOp}>=</Text>
      <Text style={[styles.formulaContrib, { color }]}>{(contribution * 100).toFixed(2)}%</Text>
      <Text style={styles.formulaLabelText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg1 },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xxxl },

  header: { marginBottom: Spacing.lg },
  headerLabel: { ...Typography.label, color: Colors.textMuted, marginBottom: Spacing.xs },
  sessionId: { ...Typography.displayMedium, color: Colors.textPrimary, marginBottom: 4 },
  timestamp: { ...Typography.caption, color: Colors.textSecondary },

  gaugeSection: { alignItems: 'center', marginBottom: Spacing.xl },
  gaugeContainer: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  gaugeCenter: {
    position: 'absolute',
    bottom: 20,
    alignItems: 'center',
  },
  gaugeScore: { fontSize: 52, fontFamily: 'Inter_700Bold', lineHeight: 56 },
  gaugeScoreUnit: { ...Typography.caption, color: Colors.textMuted },

  riskBanner: {
    width: '100%',
    borderRadius: Radii.md,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  riskBannerText: { ...Typography.bodyMedium, textAlign: 'center' },
  confidenceText: { ...Typography.caption, color: Colors.textMuted },

  section: { marginBottom: Spacing.lg },
  sectionTitle: { ...Typography.label, color: Colors.textMuted, marginBottom: Spacing.md },

  engineGrid: { gap: Spacing.sm },
  engineCard: {
    backgroundColor: Colors.bg2,
    borderRadius: Radii.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  engineCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  engineLabel: { borderRadius: Radii.full, paddingHorizontal: 8, paddingVertical: 3 },
  engineLabelText: { ...Typography.captionMedium },
  engineScore: { ...Typography.headline },
  engineName: { ...Typography.caption, color: Colors.textSecondary, marginBottom: Spacing.sm },
  engineBar: {
    height: 4, backgroundColor: Colors.bg4,
    borderRadius: Radii.full, overflow: 'hidden', marginBottom: 4,
  },
  engineBarFill: { height: '100%', borderRadius: Radii.full },
  engineWeight: { ...Typography.caption, color: Colors.textMuted, marginBottom: Spacing.sm },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  detailLabel: { ...Typography.caption, color: Colors.textMuted },
  detailValue: { ...Typography.captionMedium, color: Colors.textSecondary },

  formulaCard: {
    backgroundColor: Colors.bg2,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  formulaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  formulaWeight: { ...Typography.bodyMedium, minWidth: 24 },
  formulaOp: { ...Typography.body, color: Colors.textMuted },
  formulaScore: { ...Typography.body, color: Colors.textSecondary, minWidth: 50 },
  formulaContrib: { ...Typography.bodyMedium, minWidth: 55 },
  formulaLabelText: { ...Typography.caption, color: Colors.textMuted, flex: 1 },
  formulaDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  formulaTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  formulaTotalLabel: { ...Typography.bodyMedium, color: Colors.textPrimary },
  formulaTotalValue: { ...Typography.headline },

  recCard: {
    backgroundColor: Colors.bg2,
    borderRadius: Radii.md,
    borderWidth: 1,
    padding: Spacing.md,
    overflow: 'hidden',
  },
  recText: { ...Typography.body, color: Colors.textSecondary, lineHeight: 22 },

  legalNote: {
    backgroundColor: Colors.bg3,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  legalText: { ...Typography.caption, color: Colors.textMuted, lineHeight: 17 },

  actions: { gap: Spacing.sm },
  shareBtn: {
    borderRadius: Radii.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.bg3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shareBtnText: { ...Typography.bodyMedium, color: Colors.textSecondary },
  newSessionBtn: { borderRadius: Radii.lg, overflow: 'hidden' },
  newSessionGradient: {
    paddingVertical: Spacing.md + 4,
    alignItems: 'center',
  },
  newSessionText: { ...Typography.title, color: Colors.textInverse },
});