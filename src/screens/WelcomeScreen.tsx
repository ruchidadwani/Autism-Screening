import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radii } from '../styles/theme';
import { RootStackParamList } from '../utils/types';

const { width } = Dimensions.get('window');

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Welcome'>;
};

const ENGINE_CARDS = [
  {
    id: 'A',
    label: 'Gaze Analysis',
    desc: 'Tracks head yaw & iris deviation using 3D facial landmarks',
    color: Colors.engineGaze,
    weight: '40%',
  },
  {
    id: 'B',
    label: 'Motor Biometrics',
    desc: 'LSTM model detects stimming patterns from skeletal joints',
    color: Colors.engineMotor,
    weight: '40%',
  },
  {
    id: 'C',
    label: 'Facial Phenotyping',
    desc: 'MobileNetV2 CNN analyzes subtle morphological traits',
    color: Colors.engineFace,
    weight: '20%',
  },
];

export function WelcomeScreen({ navigation }: Props) {
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(30)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entry animation
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();

    // Pulse the CTA button
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header gradient pill */}
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <LinearGradient
            colors={['rgba(79,142,247,0.15)', 'transparent']}
            style={styles.headerGlow}
          />
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>CLINICAL GRADE · PRIVACY FIRST</Text>
            </View>
          </View>

          <Text style={styles.title}>Early ASD{'\n'}Screening</Text>
          <Text style={styles.subtitle}>
            Multimodal on-device AI analysis.{'\n'}No data leaves your device.
          </Text>
        </Animated.View>

        {/* Engine Cards */}
        <Animated.View style={[styles.enginesSection, { opacity: fadeAnim }]}>
          <Text style={styles.sectionLabel}>THREE ANALYSIS ENGINES</Text>
          {ENGINE_CARDS.map((engine, idx) => (
            <EngineCard key={engine.id} engine={engine} delay={idx * 120} />
          ))}
        </Animated.View>

        {/* Fusion Formula */}
        <Animated.View style={[styles.formulaCard, { opacity: fadeAnim }]}>
          <Text style={styles.formulaTitle}>DSM-5 Weighted Fusion</Text>
          <View style={styles.formulaRow}>
            <FormulaChip value="0.4" label="Gaze" color={Colors.engineGaze} />
            <Text style={styles.formulaOp}>+</Text>
            <FormulaChip value="0.4" label="Motor" color={Colors.engineMotor} />
            <Text style={styles.formulaOp}>+</Text>
            <FormulaChip value="0.2" label="Face" color={Colors.engineFace} />
          </View>
          <Text style={styles.formulaNote}>Threshold: score {'>'} 0.5 → Clinical Review</Text>
        </Animated.View>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            ⚠️  This tool is a screening aid only and does not constitute a
            medical diagnosis. Always consult a licensed clinician.
          </Text>
        </View>

        {/* CTA */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => navigation.navigate('Consent')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[Colors.accent, Colors.accentDim]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>Begin Screening Session</Text>
              <Text style={styles.ctaArrow}>→</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

      </ScrollView>
    </SafeAreaView>
  );
}

function EngineCard({ engine, delay }: { engine: typeof ENGINE_CARDS[0]; delay: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 600, delay, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[styles.engineCard, { opacity: anim }]}>
      <View style={[styles.engineIdBadge, { backgroundColor: `${engine.color}20`, borderColor: `${engine.color}40` }]}>
        <Text style={[styles.engineId, { color: engine.color }]}>{engine.id}</Text>
      </View>
      <View style={styles.engineContent}>
        <View style={styles.engineTitleRow}>
          <Text style={styles.engineLabel}>{engine.label}</Text>
          <View style={[styles.weightBadge, { backgroundColor: `${engine.color}15` }]}>
            <Text style={[styles.weightText, { color: engine.color }]}>{engine.weight}</Text>
          </View>
        </View>
        <Text style={styles.engineDesc}>{engine.desc}</Text>
      </View>
    </Animated.View>
  );
}

function FormulaChip({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View style={[styles.formulaChip, { borderColor: `${color}40` }]}>
      <Text style={[styles.formulaValue, { color }]}>{value}</Text>
      <Text style={styles.formulaLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg1 },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xxxl },

  header: { marginBottom: Spacing.xl, paddingTop: Spacing.md },
  headerGlow: {
    position: 'absolute', top: -40, left: -40,
    width: width + 80, height: 300,
    borderRadius: 300,
  },
  badgeRow: { marginBottom: Spacing.md },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accentGlow,
    borderWidth: 1,
    borderColor: Colors.borderActive,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
  },
  badgeText: { ...Typography.label, color: Colors.accent },
  title: {
    ...Typography.displayLarge,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    letterSpacing: -0.5,
  },
  subtitle: { ...Typography.body, color: Colors.textSecondary, lineHeight: 24 },

  enginesSection: { marginBottom: Spacing.lg },
  sectionLabel: {
    ...Typography.label,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  engineCard: {
    flexDirection: 'row',
    backgroundColor: Colors.bg2,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    alignItems: 'center',
    gap: Spacing.md,
  },
  engineIdBadge: {
    width: 40, height: 40,
    borderRadius: Radii.sm,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  engineId: { ...Typography.headline },
  engineContent: { flex: 1 },
  engineTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  engineLabel: { ...Typography.bodyMedium, color: Colors.textPrimary, flex: 1 },
  weightBadge: {
    borderRadius: Radii.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  weightText: { ...Typography.captionMedium },
  engineDesc: { ...Typography.caption, color: Colors.textSecondary },

  formulaCard: {
    backgroundColor: Colors.bg3,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  formulaTitle: { ...Typography.captionMedium, color: Colors.textSecondary, marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 0.8 },
  formulaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  formulaChip: {
    borderWidth: 1, borderRadius: Radii.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  formulaValue: { ...Typography.headline },
  formulaLabel: { ...Typography.label, color: Colors.textMuted, marginTop: 2 },
  formulaOp: { ...Typography.headline, color: Colors.textMuted },
  formulaNote: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center' },

  disclaimer: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  disclaimerText: { ...Typography.caption, color: Colors.riskModerate, lineHeight: 18 },

  ctaButton: { borderRadius: Radii.lg, overflow: 'hidden', marginBottom: Spacing.md },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md + 4,
    gap: Spacing.sm,
  },
  ctaText: { ...Typography.title, color: Colors.textInverse },
  ctaArrow: { ...Typography.title, color: Colors.textInverse },
});