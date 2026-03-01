import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { Colors, Typography, Spacing, Radii } from '../styles/theme';
import {
  RootStackParamList,
  SESSION_DURATION_SECONDS,
  GazeAnalysis,
  MotorAnalysis,
  FacialAnalysis,
} from '../utils/types';
import { useASDFrameProcessor } from '../hooks/useASDFrameProcessor';
import { buildScreeningResult } from '../services/fusionEngine';

const { width, height } = Dimensions.get('window');

// ── Stimulus video ─────────────────────────────────────────────────────────────
// Drop your video file at: src/assets/stimulus_video.mp4
const STIMULUS_VIDEO = require('../assets/stimulus_video.mp4');

type Props = NativeStackScreenProps<RootStackParamList, 'Recording'>;

interface LiveMetrics {
  gazeScore: number;
  motorScore: number;
  faceScore: number;
  framesProcessed: number;
}

type SessionPhase =
  | 'idle'        // before start pressed
  | 'countdown'   // 3-2-1 before video plays
  | 'recording'   // video playing + camera analyzing
  | 'paused'      // video paused + analysis paused
  | 'complete';   // done, navigating to results

export function RecordingScreen({ navigation }: Props) {
  const { hasPermission } = useCameraPermission();
  const device = useCameraDevice('front');

  // ── State ───────────────────────────────────────────────────────────────────
  const [phase, setPhase]           = useState<SessionPhase>('idle');
  const [elapsed, setElapsed]       = useState(0);
  const [countdown, setCountdown]   = useState(3);
  const [metrics, setMetrics]       = useState<LiveMetrics>({
    gazeScore: 0, motorScore: 0, faceScore: 0, framesProcessed: 0,
  });
  const [videoError, setVideoError] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const videoRef        = useRef<Video>(null);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gazeResultRef   = useRef<GazeAnalysis | null>(null);
  const motorResultRef  = useRef<MotorAnalysis | null>(null);
  const faceResultRef   = useRef<FacialAnalysis | null>(null);
  const elapsedRef      = useRef(0);  // for use in callbacks without stale closure

  // ── Animations ──────────────────────────────────────────────────────────────
  const countdownScale = useRef(new Animated.Value(1)).current;
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const pipBorderAnim   = useRef(new Animated.Value(0)).current;

  // ── Frame processor ─────────────────────────────────────────────────────────
  const onMetricsUpdate = useCallback((m: LiveMetrics) => {
    setMetrics(m);
  }, []);

  const onSessionComplete = useCallback(
    (gaze: GazeAnalysis, motor: MotorAnalysis, face: FacialAnalysis) => {
      gazeResultRef.current  = gaze;
      motorResultRef.current = motor;
      faceResultRef.current  = face;
    },
    []
  );

  const { frameProcessor, finalizeSession, resetEngines } = useASDFrameProcessor({
    isActive: phase === 'recording',
    onMetricsUpdate,
    onSessionComplete,
  });

  // ── Cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current)      clearInterval(timerRef.current);
      if (countdownRef.current)  clearInterval(countdownRef.current);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, []);

  // ── Auto-hide controls after 4s during recording ────────────────────────────
  useEffect(() => {
    if (phase === 'recording') {
      scheduleHideControls();
    } else {
      showControls();
    }
  }, [phase]);

  function showControls() {
    setControlsVisible(true);
    Animated.timing(controlsOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }

  function scheduleHideControls() {
    showControls();
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      Animated.timing(controlsOpacity, { toValue: 0, duration: 800, useNativeDriver: true }).start();
    }, 4000);
  }

  const handleScreenTap = () => {
    if (phase === 'recording') scheduleHideControls();
  };

  // ── PiP border pulse ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'recording') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pipBorderAnim, { toValue: 1, duration: 900, useNativeDriver: false }),
          Animated.timing(pipBorderAnim, { toValue: 0, duration: 900, useNativeDriver: false }),
        ])
      ).start();
    } else {
      pipBorderAnim.setValue(0);
      pipBorderAnim.stopAnimation();
    }
  }, [phase]);

  const pipBorderColor = pipBorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(79,142,247,0.3)', 'rgba(79,142,247,0.9)'],
  });

  // ── Session timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'recording') {
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
        if (elapsedRef.current >= SESSION_DURATION_SECONDS) {
          handleSessionEnd();
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // ── Session flow ─────────────────────────────────────────────────────────────

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    resetEngines();
    elapsedRef.current = 0;
    setElapsed(0);
    setCountdown(3);
    setPhase('countdown');
    runCountdown();
  };

  const runCountdown = () => {
    let count = 3;

    // Animate first number
    animateCountdownNumber();

    countdownRef.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(countdownRef.current!);
        beginRecording();
      } else {
        setCountdown(count);
        animateCountdownNumber();
      }
    }, 1000);
  };

  const animateCountdownNumber = () => {
    countdownScale.setValue(1.5);
    Animated.spring(countdownScale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

  const beginRecording = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPhase('recording');
    try {
      if (videoRef.current) {
        await videoRef.current.setPositionAsync(0);
        await videoRef.current.playAsync();
      }
    } catch (e) {
      console.warn('[Video] Could not play stimulus video:', e);
    }
  };

  const handlePause = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (phase === 'recording') {
      setPhase('paused');
      await videoRef.current?.pauseAsync();
    } else if (phase === 'paused') {
      setPhase('recording');
      await videoRef.current?.playAsync();
    }
  };

  const handleStop = () => {
    Alert.alert(
      'End Session?',
      'Stop screening and analyze results collected so far?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End & Analyze', style: 'destructive', onPress: handleSessionEnd },
      ]
    );
  };

  const handleSessionEnd = useCallback(async () => {
    if (timerRef.current)    clearInterval(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setPhase('complete');

    try { await videoRef.current?.pauseAsync(); } catch {}

    finalizeSession();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setTimeout(() => {
      const gaze  = gazeResultRef.current  ?? defaultGazeResult();
      const motor = motorResultRef.current ?? defaultMotorResult();
      const face  = faceResultRef.current  ?? defaultFaceResult();
      const result = buildScreeningResult(gaze, motor, face, elapsedRef.current);
      navigation.navigate('Results', { result });
    }, 900);
  }, [finalizeSession, navigation]);

  // Loop video if it ends before session finishes
  const onVideoStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    if (status.didJustFinish && phase === 'recording') {
      videoRef.current?.replayAsync();
    }
  };

  // ── Derived display values ────────────────────────────────────────────────
  const remaining = SESSION_DURATION_SECONDS - elapsed;
  const timeStr   = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  const progress  = Math.min(elapsed / SESSION_DURATION_SECONDS, 1);

  // ── Permission guard ──────────────────────────────────────────────────────
  if (!hasPermission || !device) {
    return (
      <View style={styles.errorScreen}>
        <Text style={styles.errorText}>Camera permission required.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar hidden />

      {/* ═══════════════════════════════════════════════════════════
          LAYER 1 — STIMULUS VIDEO (fullscreen, what child watches)
          ═══════════════════════════════════════════════════════════ */}
      <View style={StyleSheet.absoluteFill}>

        {/* Placeholder shown before session starts */}
        {(phase === 'idle' || phase === 'countdown') && (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>🎬</Text>
            <Text style={styles.placeholderTitle}>Stimulus Video</Text>
            <Text style={styles.placeholderSub}>
              The video will play here when the session begins.{'\n'}
              Position the child so their face fills the camera.
            </Text>
          </View>
        )}

        {/* The actual video */}
        <Video
          ref={videoRef}
          source={STIMULUS_VIDEO}
          style={[
            styles.stimulusVideo,
            (phase === 'idle' || phase === 'countdown') && { opacity: 0 },
          ]}
          resizeMode={ResizeMode.COVER}
          onPlaybackStatusUpdate={onVideoStatusUpdate}
          onError={() => setVideoError(true)}
          shouldPlay={false}
          isLooping={false}
          isMuted={false}
          volume={0.85}
        />

        {/* Video file missing error */}
        {videoError && (
          <View style={styles.videoErrorOverlay}>
            <Text style={styles.videoErrorText}>
              ⚠️  Video not found{'\n'}
              Add stimulus_video.mp4 to src/assets/
            </Text>
          </View>
        )}
      </View>

      {/* ═══════════════════════════════════════════════════════════
          LAYER 2 — ANALYSIS CAMERA (hidden, 1×1px, just runs)
          ═══════════════════════════════════════════════════════════ */}
      <Camera
        style={styles.analysisCamera}
        device={device}
        isActive={phase === 'recording' || phase === 'paused'}
        frameProcessor={frameProcessor}
        fps={30}
        pixelFormat="yuv"
      />

      {/* ═══════════════════════════════════════════════════════════
          LAYER 3 — UI OVERLAY
          ═══════════════════════════════════════════════════════════ */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        onPress={handleScreenTap}
        activeOpacity={1}
      >

        {/* ── Countdown splash ── */}
        {phase === 'countdown' && (
          <View style={styles.countdownOverlay}>
            <Animated.Text
              style={[styles.countdownNum, { transform: [{ scale: countdownScale }] }]}
            >
              {countdown}
            </Animated.Text>
            <Text style={styles.countdownSub}>Get ready…</Text>
          </View>
        )}

        {/* ── Session complete splash ── */}
        {phase === 'complete' && (
          <View style={styles.completeOverlay}>
            <Text style={styles.completeCheck}>✓</Text>
            <Text style={styles.completeTitle}>Session Complete</Text>
            <Text style={styles.completeSub}>Analyzing results…</Text>
          </View>
        )}

        {/* ── Top HUD ── */}
        <Animated.View style={[styles.topHUD, { opacity: controlsOpacity }]}>
          <SafeAreaView>
            <View style={styles.topRow}>

              {/* Close / back */}
              <TouchableOpacity
                style={styles.circleBtn}
                onPress={() => {
                  phase === 'recording' || phase === 'paused'
                    ? handleStop()
                    : navigation.goBack();
                }}
              >
                <Text style={styles.circleBtnText}>✕</Text>
              </TouchableOpacity>

              {/* Timer badge */}
              {(phase === 'recording' || phase === 'paused') && (
                <View style={[
                  styles.timerBadge,
                  phase === 'paused' && styles.timerBadgePaused,
                ]}>
                  <View style={[
                    styles.timerDot,
                    phase === 'paused' && styles.timerDotPaused,
                  ]} />
                  <Text style={styles.timerText}>{timeStr}</Text>
                </View>
              )}

              {/* PiP camera — parent verifies child is in frame */}
              {(phase === 'recording' || phase === 'paused') && (
                <Animated.View style={[styles.pipWrapper, { borderColor: pipBorderColor }]}>
                  <Camera
                    style={styles.pipCamera}
                    device={device}
                    isActive
                    fps={15}
                    pixelFormat="yuv"
                  />
                  <View style={styles.pipTag}>
                    <Text style={styles.pipTagText}>LIVE</Text>
                  </View>
                </Animated.View>
              )}

            </View>

            {/* Progress bar */}
            {(phase === 'recording' || phase === 'paused') && (
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              </View>
            )}
          </SafeAreaView>
        </Animated.View>

        {/* ── Bottom Controls ── */}
        <Animated.View style={[styles.bottomArea, { opacity: controlsOpacity }]}>

          {/* Live engine metrics */}
          {(phase === 'recording' || phase === 'paused') && (
            <View style={styles.metricsRow}>
              <MetricPill label="Gaze"  value={metrics.gazeScore}  color={Colors.engineGaze} />
              <MetricPill label="Motor" value={metrics.motorScore} color={Colors.engineMotor} />
              <MetricPill label="Face"  value={metrics.faceScore}  color={Colors.engineFace} />
              <Text style={styles.frameCount}>
                {metrics.framesProcessed.toLocaleString()} frames
              </Text>
            </View>
          )}

          {/* ── IDLE: instructions + start ── */}
          {phase === 'idle' && (
            <View style={styles.idleBox}>
              <View style={styles.idleCard}>
                <Text style={styles.idleTitle}>📋  Before you start</Text>
                <Text style={styles.idleBody}>
                  • Sit the child comfortably in front of the phone{'\n'}
                  • The stimulus video will play automatically{'\n'}
                  • Session runs for 3 minutes{'\n'}
                  • Keep the child's face visible in the top-right camera
                </Text>
              </View>
              <TouchableOpacity
                style={styles.startBtn}
                onPress={handleStart}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[Colors.accent, Colors.accentDim]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.startBtnGradient}
                >
                  <Text style={styles.startBtnText}>▶  Start Screening Session</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* ── RECORDING / PAUSED: pause + stop ── */}
          {(phase === 'recording' || phase === 'paused') && (
            <View style={styles.controlRow}>
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={handlePause}
                activeOpacity={0.8}
              >
                <Text style={styles.controlIcon}>{phase === 'paused' ? '▶' : '⏸'}</Text>
                <Text style={styles.controlLabel}>{phase === 'paused' ? 'Resume' : 'Pause'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlBtn, styles.stopBtn]}
                onPress={handleStop}
                activeOpacity={0.8}
              >
                <Text style={styles.controlIcon}>⏹</Text>
                <Text style={styles.controlLabel}>End Session</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'recording' && (
            <Text style={styles.tapHint}>Tap to show / hide controls</Text>
          )}

        </Animated.View>

      </TouchableOpacity>
    </View>
  );
}

// ── MetricPill component ───────────────────────────────────────────────────────
function MetricPill({ label, value, color }: {
  label: string; value: number; color: string;
}) {
  return (
    <View style={[sPill.pill, { borderColor: `${color}40` }]}>
      <View style={[sPill.dot, { backgroundColor: color }]} />
      <Text style={sPill.label}>{label}</Text>
      <Text style={[sPill.value, { color }]}>{Math.round(value * 100)}%</Text>
    </View>
  );
}

const sPill = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(10,14,26,0.82)',
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 99, borderWidth: 1,
  },
  dot:   { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: 'rgba(255,255,255,0.55)', minWidth: 30 },
  value: { fontSize: 11, fontFamily: 'Inter_600SemiBold', minWidth: 28, textAlign: 'right' },
});

// ── Default result fallbacks ───────────────────────────────────────────────────
function defaultGazeResult(): GazeAnalysis {
  return { gazeRiskScore: 0, headYawMean: 0, irisDeviationMean: 0, aversionFrameCount: 0, totalFramesAnalyzed: 0 };
}
function defaultMotorResult(): MotorAnalysis {
  return { motorRiskScore: 0, stimmingDetected: false, motionEnergy: 0, bufferComplete: false };
}
function defaultFaceResult(): FacialAnalysis {
  return { faceRiskScore: 0, confidence: 0, faceDetected: false };
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  // Video
  stimulusVideo: { width: '100%', height: '100%' },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.bg0,
    alignItems: 'center', justifyContent: 'center', gap: Spacing.md,
  },
  placeholderIcon:  { fontSize: 64 },
  placeholderTitle: { ...Typography.headline, color: Colors.textSecondary },
  placeholderSub:   { ...Typography.body, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: Spacing.xl, lineHeight: 22 },
  videoErrorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,14,26,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  videoErrorText: { ...Typography.body, color: Colors.riskModerate, textAlign: 'center', lineHeight: 26 },

  // Analysis camera (hidden)
  analysisCamera: { position: 'absolute', width: 1, height: 1, opacity: 0 },

  // Top HUD
  topHUD: { position: 'absolute', top: 0, left: 0, right: 0 },
  topRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm, paddingBottom: Spacing.sm,
  },
  circleBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  circleBtnText: { fontSize: 15, color: '#fff' },

  timerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 99, borderWidth: 1, borderColor: 'rgba(239,68,68,0.5)',
  },
  timerBadgePaused: { borderColor: 'rgba(245,158,11,0.5)' },
  timerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.error },
  timerDotPaused: { backgroundColor: Colors.riskModerate },
  timerText: { fontFamily: 'Courier', fontSize: 16, color: '#fff', fontWeight: '700' },

  pipWrapper: {
    width: 68, height: 90, borderRadius: 8,
    overflow: 'hidden', borderWidth: 2,
  },
  pipCamera:  { width: '100%', height: '100%' },
  pipTag: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', paddingVertical: 2,
  },
  pipTagText: { fontSize: 9, fontFamily: 'Inter_600SemiBold', color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5 },

  progressTrack: {
    height: 3, backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: Spacing.md, marginTop: 4,
    borderRadius: 99, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 99 },

  // Countdown
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,6,9,0.78)',
    alignItems: 'center', justifyContent: 'center',
  },
  countdownNum:  { fontSize: 130, fontFamily: 'Inter_700Bold', color: '#fff', lineHeight: 140 },
  countdownSub:  { ...Typography.headline, color: Colors.textSecondary, marginTop: Spacing.sm },

  // Complete
  completeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,6,9,0.88)',
    alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
  },
  completeCheck: { fontSize: 72, color: Colors.riskLow },
  completeTitle: { ...Typography.displayMedium, color: Colors.riskLow },
  completeSub:   { ...Typography.body, color: Colors.textSecondary },

  // Bottom area
  bottomArea: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: Spacing.md, paddingBottom: 44, gap: Spacing.sm,
  },
  metricsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4,
    flexWrap: 'wrap',
  },
  frameCount: {
    ...Typography.caption, color: 'rgba(255,255,255,0.28)', marginLeft: 'auto',
  },

  // Idle UI
  idleBox:  { gap: Spacing.md },
  idleCard: {
    backgroundColor: 'rgba(10,14,26,0.88)',
    borderRadius: Radii.md, padding: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  idleTitle: { ...Typography.bodyMedium, color: '#fff', marginBottom: Spacing.sm },
  idleBody:  { ...Typography.caption, color: 'rgba(255,255,255,0.5)', lineHeight: 20 },
  startBtn:  { borderRadius: Radii.lg, overflow: 'hidden' },
  startBtnGradient: {
    paddingVertical: Spacing.md + 4,
    alignItems: 'center', justifyContent: 'center',
  },
  startBtnText: { ...Typography.title, color: '#fff' },

  // Recording controls
  controlRow: { flexDirection: 'row', gap: Spacing.sm },
  controlBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: Radii.md, paddingVertical: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  stopBtn: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  controlIcon:  { fontSize: 18, color: '#fff' },
  controlLabel: { ...Typography.bodyMedium, color: '#fff' },
  tapHint: { ...Typography.caption, color: 'rgba(255,255,255,0.2)', textAlign: 'center' },

  // Error screen
  errorScreen: {
    flex: 1, backgroundColor: Colors.bg1,
    alignItems: 'center', justifyContent: 'center', gap: Spacing.md,
  },
  errorText:    { ...Typography.body, color: Colors.error },
  backBtn:      { backgroundColor: Colors.bg3, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: Radii.md },
  backBtnText:  { ...Typography.bodyMedium, color: Colors.textPrimary },
});