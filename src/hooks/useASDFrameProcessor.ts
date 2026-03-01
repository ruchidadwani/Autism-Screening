/**
 * FRAME PROCESSOR
 *
 * Runs on every camera frame via react-native-vision-camera's Frame Processor API.
 * Bridges MediaPipe (via a native Vision Camera Plugin) to our three JS engines.
 *
 * Architecture:
 *   Camera Frame
 *       │
 *       ▼
 *   [Native VisionCamera Plugin: mediapipe_face_mesh + mediapipe_pose]
 *       │
 *       ▼ JS worklet (Reanimated worklet thread)
 *   Frame Processor ──► Engine A (gaze math) — pure JS
 *                   ──► Engine B buffer feed  → async LSTM inference
 *                   ──► Engine C face crop    → async CNN inference (every 30 frames)
 *
 * NOTE: The actual MediaPipe VisionCamera plugin must be compiled as a native
 * module. The interface below assumes the plugin returns:
 *   { faceLandmarks: [{x,y,z}×478], poseLandmarks: [{x,y,z}×33], facePixels: number[] }
 *
 * See: https://github.com/mrousavy/react-native-vision-camera for plugin docs.
 */

import { useFrameProcessor } from 'react-native-vision-camera';
import { useSharedValue, runOnJS } from 'react-native-reanimated';
import { useCallback, useRef } from 'react';

import {
  createGazeEngine,
  processGazeFrame,
  finalizeGazeAnalysis,
} from '../services/engineA_GazeAnalysis';
import {
  createMotorEngine,
  addMotorFrame,
  runMotorInference,
  finalizeMotorAnalysis,
  MotorEngineState,
} from '../services/engineB_MotorBiometrics';
import {
  createFaceEngine,
  tickFaceEngine,
  shouldRunFaceInference,
  runFaceInference,
  finalizeFacialAnalysis,
  FaceEngineState,
} from '../services/engineC_FacialPhenotyping';
import { GazeAnalysis, MotorAnalysis, FacialAnalysis, FaceMeshLandmark } from '../utils/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LiveMetrics {
  gazeScore: number;
  motorScore: number;
  faceScore: number;
  framesProcessed: number;
}

interface UseFrameProcessorOptions {
  isActive: boolean;
  onMetricsUpdate: (metrics: LiveMetrics) => void;
  onSessionComplete: (gaze: GazeAnalysis, motor: MotorAnalysis, face: FacialAnalysis) => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useASDFrameProcessor({
  isActive,
  onMetricsUpdate,
  onSessionComplete,
}: UseFrameProcessorOptions) {
  // Engine state lives in refs (mutable, not React state, to avoid re-renders per frame)
  const gazeEngineRef  = useRef(createGazeEngine());
  const motorEngineRef = useRef<MotorEngineState>(createMotorEngine());
  const faceEngineRef  = useRef<FaceEngineState>(createFaceEngine());
  const frameCountRef  = useRef(0);

  // Running average scores (updated after each inference batch)
  const currentMotorRiskRef = useRef(0);
  const currentFaceRiskRef  = useRef(0);

  // ── Motor inference callback (runs on JS thread, async) ───────────────────
  const handleMotorInference = useCallback(async (motorState: MotorEngineState) => {
    const { motorRisk, stimmingDetected } = await runMotorInference(motorState);
    currentMotorRiskRef.current = motorRisk;
    motorEngineRef.current = { ...motorEngineRef.current, lastMotorRisk: motorRisk };
  }, []);

  // ── Face inference callback ───────────────────────────────────────────────
  const handleFaceInference = useCallback(
    async (faceState: FaceEngineState, facePixels: Float32Array) => {
      const newState = await runFaceInference(faceState, facePixels);
      faceEngineRef.current = newState;
      currentFaceRiskRef.current = newState.lastFaceRisk;
    },
    []
  );

  // ── Metrics broadcast (called from worklet via runOnJS) ───────────────────
  const broadcastMetrics = useCallback(
    (gazeScore: number, framesProcessed: number) => {
      onMetricsUpdate({
        gazeScore,
        motorScore: currentMotorRiskRef.current,
        faceScore: currentFaceRiskRef.current,
        framesProcessed,
      });
    },
    [onMetricsUpdate]
  );

  // ── Session complete (called from JS thread) ──────────────────────────────
  const finalizeSession = useCallback(() => {
    const gazeAnalysis  = finalizeGazeAnalysis(gazeEngineRef.current);
    const motorAnalysis = finalizeMotorAnalysis(
      motorEngineRef.current,
      currentMotorRiskRef.current,
      currentMotorRiskRef.current > 0.5
    );
    const faceAnalysis  = finalizeFacialAnalysis(
      faceEngineRef.current,
      faceEngineRef.current.inferenceCount > 0
    );
    onSessionComplete(gazeAnalysis, motorAnalysis, faceAnalysis);
  }, [onSessionComplete]);

  // ── Reset engines ─────────────────────────────────────────────────────────
  const resetEngines = useCallback(() => {
    gazeEngineRef.current   = createGazeEngine();
    motorEngineRef.current  = createMotorEngine();
    faceEngineRef.current   = createFaceEngine();
    frameCountRef.current   = 0;
    currentMotorRiskRef.current = 0;
    currentFaceRiskRef.current  = 0;
  }, []);

  // ── Frame Processor (Reanimated worklet) ──────────────────────────────────
  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (!isActive) return;

      // ── Call native MediaPipe plugin ─────────────────────────────────────
      // The plugin is expected to be registered as 'mediapipe_process'
      // It returns face mesh + pose landmarks extracted natively.
      let pluginResult: any = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const plugin = require('react-native-vision-camera').VisionCameraProxy;
        pluginResult = plugin.initFrameProcessorPlugin('mediapipeProcess')?.call(frame);
      } catch {
        // Plugin not available in dev/simulator; use mock data
      }

      const faceLandmarks: FaceMeshLandmark[] =
        pluginResult?.faceLandmarks ?? [];
      const poseLandmarks: FaceMeshLandmark[] =
        pluginResult?.poseLandmarks ?? [];
      const facePixels: Float32Array =
        pluginResult?.facePixels
          ? new Float32Array(pluginResult.facePixels)
          : new Float32Array(224 * 224 * 3);

      // ── Engine A: Gaze (synchronous math) ───────────────────────────────
      gazeEngineRef.current = processGazeFrame(gazeEngineRef.current, faceLandmarks);
      const gazeScore = gazeEngineRef.current.aversionFrames /
        Math.max(gazeEngineRef.current.totalFrames, 1);

      // ── Engine B: Motor (buffer + async LSTM) ────────────────────────────
      if (poseLandmarks.length > 0) {
        const { newState, bufferReady } = addMotorFrame(
          motorEngineRef.current,
          poseLandmarks
        );
        motorEngineRef.current = newState;
        if (bufferReady) {
          runOnJS(handleMotorInference)(motorEngineRef.current);
        }
      }

      // ── Engine C: Face (periodic async CNN) ──────────────────────────────
      faceEngineRef.current = tickFaceEngine(faceEngineRef.current);
      if (shouldRunFaceInference(faceEngineRef.current)) {
        runOnJS(handleFaceInference)(faceEngineRef.current, facePixels);
      }

      // ── Broadcast live metrics ───────────────────────────────────────────
      frameCountRef.current += 1;
      runOnJS(broadcastMetrics)(gazeScore, frameCountRef.current);
    },
    [isActive, broadcastMetrics, handleMotorInference, handleFaceInference]
  );

  return { frameProcessor, finalizeSession, resetEngines };
}