import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography, Spacing, Radii } from '../styles/theme';
import { RootStackParamList } from '../utils/types';
import * as Haptics from 'expo-haptics';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Consent'>;
};

const CONSENT_ITEMS = [
  {
    id: 1,
    title: 'Camera Access',
    body: 'The app uses the front camera to capture video of the child. All video processing occurs entirely on this device. No video is recorded, stored, or transmitted.',
    icon: '📷',
  },
  {
    id: 2,
    title: 'On-Device Processing Only',
    body: 'All AI inference is performed locally using the iPhone Neural Engine. No biometric data, results, or personal information leaves this device.',
    icon: '🔒',
  },
  {
    id: 3,
    title: 'Not a Medical Diagnosis',
    body: 'This screening tool provides a risk score to guide clinical decision-making. It does not diagnose Autism Spectrum Disorder. A formal diagnosis requires evaluation by a licensed clinician.',
    icon: '⚕️',
  },
  {
    id: 4,
    title: 'Parental Consent Required',
    body: 'By proceeding, you confirm that you are the parent or legal guardian of the child being screened, and consent to this non-invasive behavioral observation.',
    icon: '👨‍👩‍👦',
  },
  {
    id: 5,
    title: 'Age Criteria',
    body: 'This tool is designed for children aged 18–36 months. Results may not be valid outside this age range.',
    icon: '🎂',
  },
];

export function ConsentScreen({ navigation }: Props) {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const allChecked = checkedItems.size === CONSENT_ITEMS.length;

  const toggleItem = (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCheckedItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAgree = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.navigate('Setup');
  };

  return (
    <SafeAreaView style={styles.safe}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Informed Consent</Text>
        <Text style={styles.subtitle}>
          Please read and acknowledge each item before proceeding.
        </Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {CONSENT_ITEMS.map((item) => {
          const checked = checkedItems.has(item.id);
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.consentCard, checked && styles.consentCardChecked]}
              onPress={() => toggleItem(item.id)}
              activeOpacity={0.8}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardIcon}>{item.icon}</Text>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                  {checked && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </View>
              <Text style={styles.cardBody}>{item.body}</Text>
            </TouchableOpacity>
          );
        })}

        <View style={styles.progress}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressBar,
                { width: `${(checkedItems.size / CONSENT_ITEMS.length) * 100}%` }
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {checkedItems.size} / {CONSENT_ITEMS.length} acknowledged
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.agreeButton, !allChecked && styles.agreeButtonDisabled]}
          onPress={allChecked ? handleAgree : undefined}
          activeOpacity={allChecked ? 0.85 : 1}
        >
          <Text style={[styles.agreeText, !allChecked && styles.agreeTextDisabled]}>
            {allChecked ? 'I Understand & Agree →' : 'Acknowledge All Items to Continue'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg1 },
  header: {
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { marginBottom: Spacing.sm },
  backText: { ...Typography.body, color: Colors.accent },
  title: { ...Typography.displayMedium, color: Colors.textPrimary, marginBottom: Spacing.xs },
  subtitle: { ...Typography.body, color: Colors.textSecondary },
  scroll: { flex: 1, padding: Spacing.md },

  consentCard: {
    backgroundColor: Colors.bg2,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  consentCardChecked: {
    borderColor: Colors.accentDim,
    backgroundColor: Colors.accentGlow,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  cardIcon: { fontSize: 20 },
  cardTitle: { ...Typography.bodyMedium, color: Colors.textPrimary, flex: 1 },
  checkbox: {
    width: 24, height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.textMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { borderColor: Colors.accent, backgroundColor: Colors.accent },
  checkmark: { ...Typography.captionMedium, color: Colors.textInverse },
  cardBody: { ...Typography.caption, color: Colors.textSecondary, lineHeight: 18 },

  progress: { marginVertical: Spacing.md },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.bg3,
    borderRadius: Radii.full,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: Radii.full,
  },
  progressText: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'right' },

  agreeButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radii.lg,
    paddingVertical: Spacing.md + 4,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  agreeButtonDisabled: { backgroundColor: Colors.bg3 },
  agreeText: { ...Typography.title, color: Colors.textInverse },
  agreeTextDisabled: { color: Colors.textMuted },
});