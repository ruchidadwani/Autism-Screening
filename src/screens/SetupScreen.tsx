import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Camera } from 'react-native-vision-camera';
import { Colors, Typography, Spacing, Radii } from '../styles/theme';
import { RootStackParamList } from '../utils/types';
import { loadMotorModel } from '../services/engineB_MotorBiometrics';
import { loadFaceModel } from '../services/engineC_FacialPhenotyping';
import * as Haptics from 'expo-haptics';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Setup'>;
};

type StepStatus = 'idle' | 'loading' | 'done' | 'error';

interface SetupStep {
  id: string;
  label: string;
  description: string;
}

const STEPS: SetupStep[] = [
  { id: 'camera',   label: 'Camera Permission',     description: 'Required for real-time analysis' },
  { id: 'motorModel',  label: 'Loading Motor Model',  description: 'LSTM on Neural Engine (motor_risk_model.tflite)' },
  { id: 'faceModel',   label: 'Loading Face Model',   description: 'MobileNetV2 on Neural Engine (face_risk_model.tflite)' },
  { id: 'gaze',     label: 'Initializing Gaze Engine', description: 'Pure math engine — no model required' },
];

export function SetupScreen({ navigation }: Props) {
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>(
    Object.fromEntries(STEPS.map(s => [s.id, 'idle']))
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [allDone, setAllDone] = useState(false);

  const setStatus = (id: string, status: StepStatus) => {
    setStepStatuses(prev => ({ ...prev, [id]: status }));
  };

  useEffect(() => {
    runSetup();
  }, []);

  async function runSetup() {
    try {
      // Step 1: Camera
      setStatus('camera', 'loading');
      const cameraStatus = await Camera.requestCameraPermission();
      if (cameraStatus !== 'granted') {
        setStatus('camera', 'error');
        setErrorMessage('Camera permission is required to run the screening.');
        return;
      }
      setStatus('camera', 'done');
      await delay(300);

      // Step 2: Motor model
      setStatus('motorModel', 'loading');
      await loadMotorModel();
      setStatus('motorModel', 'done');
      await delay(300);

      // Step 3: Face model
      setStatus('faceModel', 'loading');
      await loadFaceModel();
      setStatus('faceModel', 'done');
      await delay(300);

      // Step 4: Gaze engine (instant)
      setStatus('gaze', 'loading');
      await delay(400);
      setStatus('gaze', 'done');

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAllDone(true);
    } catch (err: any) {
      setErrorMessage(err?.message ?? 'Setup failed. Please restart the app.');
    }
  }

  const allStepsDone = Object.values(stepStatuses).every(s => s === 'done');

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        <View style={styles.header}>
          <Text style={styles.title}>System Preparation</Text>
          <Text style={styles.subtitle}>
            Loading AI models onto the Neural Engine. This may take a few seconds.
          </Text>
        </View>

        <View style={styles.stepsContainer}>
          {STEPS.map((step) => (
            <StepRow key={step.id} step={step} status={stepStatuses[step.id]} />
          ))}
        </View>

        {errorMessage && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Setup Failed</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={runSetup}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!errorMessage && (
          <View style={styles.readinessCard}>
            <Text style={styles.readinessTitle}>
              {allDone ? '✓ All Systems Ready' : 'Initializing…'}
            </Text>
            {!allDone && (
              <Text style={styles.readinessNote}>
                Models load into the Neural Engine only once per session.
              </Text>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.startButton, !allDone && styles.startButtonDisabled]}
          onPress={() => allDone && navigation.navigate('Recording')}
          activeOpacity={allDone ? 0.85 : 1}
        >
          <Text style={[styles.startText, !allDone && styles.startTextDisabled]}>
            {allDone ? 'Start Screening Session →' : 'Preparing…'}
          </Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

function StepRow({ step, status }: { step: SetupStep; status: StepStatus }) {
  const statusConfig: Record<StepStatus, { icon: React.ReactNode; color: string }> = {
    idle:    { icon: <View style={styles.idleDot} />, color: Colors.textMuted },
    loading: { icon: <ActivityIndicator size="small" color={Colors.accent} />, color: Colors.accent },
    done:    { icon: <Text style={styles.doneIcon}>✓</Text>, color: Colors.success },
    error:   { icon: <Text style={styles.errorIcon}>✗</Text>, color: Colors.error },
  };

  const { icon, color } = statusConfig[status];

  return (
    <View style={styles.stepRow}>
      <View style={styles.stepIconContainer}>{icon}</View>
      <View style={styles.stepContent}>
        <Text style={[styles.stepLabel, { color }]}>{step.label}</Text>
        <Text style={styles.stepDesc}>{step.description}</Text>
      </View>
    </View>
  );
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg1 },
  container: {
    flex: 1, padding: Spacing.md,
    justifyContent: 'center',
  },
  header: { marginBottom: Spacing.xl },
  title: { ...Typography.displayMedium, color: Colors.textPrimary, marginBottom: Spacing.sm },
  subtitle: { ...Typography.body, color: Colors.textSecondary },

  stepsContainer: {
    backgroundColor: Colors.bg2,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stepIconContainer: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  idleDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.textMuted,
  },
  doneIcon: { ...Typography.body, color: Colors.success, fontFamily: 'Inter_700Bold' },
  errorIcon: { ...Typography.body, color: Colors.error, fontFamily: 'Inter_700Bold' },
  stepContent: { flex: 1 },
  stepLabel: { ...Typography.bodyMedium, marginBottom: 2 },
  stepDesc: { ...Typography.caption, color: Colors.textMuted },

  readinessCard: {
    backgroundColor: Colors.accentGlow,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.borderActive,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
  readinessTitle: { ...Typography.bodyMedium, color: Colors.accent },
  readinessNote: { ...Typography.caption, color: Colors.textSecondary, marginTop: 4 },

  errorCard: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
  errorTitle: { ...Typography.bodyMedium, color: Colors.error, marginBottom: Spacing.sm },
  errorText: { ...Typography.caption, color: Colors.textSecondary, marginBottom: Spacing.sm },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.error,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  retryText: { ...Typography.captionMedium, color: '#fff' },

  startButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radii.lg,
    paddingVertical: Spacing.md + 4,
    alignItems: 'center',
  },
  startButtonDisabled: { backgroundColor: Colors.bg3 },
  startText: { ...Typography.title, color: Colors.textInverse },
  startTextDisabled: { color: Colors.textMuted },
});