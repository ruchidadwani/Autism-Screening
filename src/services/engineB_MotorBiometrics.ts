/**
 * ENGINE B: Motor Biometrics & Stimming Detection
 *
 * - Buffers 100 frames × 24 joints × 3 coordinates → [1, 100, 72] tensor
 * - Runs motor_risk_model.tflite (LSTM) → probability of stimming/ASD motor pattern
 * - Computes kinematic Motion Energy as a secondary metric
 */

import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
import {
  MotorAnalysis,
  FaceMeshLandmark,
  FRAME_BUFFER_SIZE,
  POSE_JOINT_COUNT,
  POSE_FEATURE_DIM,
} from '../utils/types';

// ── Constants ─────────────────────────────────────────────────────────────────
const INPUT_SHAPE = [1, FRAME_BUFFER_SIZE, POSE_FEATURE_DIM]; // [1, 100, 72]
const MOTION_ENERGY_VELOCITY_SCALE = 0.01; // normalisation factor

// ── Model singleton ───────────────────────────────────────────────────────────
let motorModel: TensorflowModel | null = null;

export async function loadMotorModel(): Promise<void> {
  if (motorModel) return;
  try {
    motorModel = await loadTensorflowModel(
      require('../../models/motor_risk_model.tflite'),
      'core-ml'   // Apple Neural Engine via Core ML delegate
    );
    console.log('[EngineB] Motor model loaded on Neural Engine.');
  } catch (err) {
    console.error('[EngineB] Failed to load motor model:', err);
    throw err;
  }
}

export function disposeMotorModel(): void {
  motorModel = null;
}

// ── Frame Buffer ──────────────────────────────────────────────────────────────

export interface MotorEngineState {
  frameBuffer: Float32Array;       // [FRAME_BUFFER_SIZE * POSE_FEATURE_DIM]
  frameCount: number;              // how many frames have been added (0-100)
  writeIdx: number;                // circular write pointer
  motionEnergyAccumulator: number;
  motionEnergyFrames: number;
  previousJoints: Float32Array | null;
  inferencePending: boolean;
  lastMotorRisk: number;
}

export function createMotorEngine(): MotorEngineState {
  return {
    frameBuffer: new Float32Array(FRAME_BUFFER_SIZE * POSE_FEATURE_DIM),
    frameCount: 0,
    writeIdx: 0,
    motionEnergyAccumulator: 0,
    motionEnergyFrames: 0,
    previousJoints: null,
    inferencePending: false,
    lastMotorRisk: 0,
  };
}

/**
 * Normalise 24 pose landmarks into a flat 72-element Float32Array.
 * Centres on the hip midpoint and scales by torso height.
 */
function normalisePoseLandmarks(landmarks: FaceMeshLandmark[]): Float32Array {
  const joints = new Float32Array(POSE_FEATURE_DIM);

  // Use landmark index 23 (left hip) and 24 (right hip) to find centre
  // MediaPipe pose: 0=nose, 11=left shoulder, 12=right shoulder,
  //                 23=left hip, 24=right hip  (0-indexed in our slice)
  const leftHip  = landmarks[23] ?? { x: 0, y: 0, z: 0 };
  const rightHip = landmarks[24] ?? { x: 0, y: 0, z: 0 };
  const nose     = landmarks[0]  ?? { x: 0, y: 0, z: 0 };

  const hipMidX = (leftHip.x + rightHip.x) / 2;
  const hipMidY = (leftHip.y + rightHip.y) / 2;
  const hipMidZ = (leftHip.z + rightHip.z) / 2;

  // Torso height for scale normalisation
  const torsoHeight = Math.sqrt(
    Math.pow(nose.x - hipMidX, 2) +
    Math.pow(nose.y - hipMidY, 2) +
    Math.pow(nose.z - hipMidZ, 2)
  ) || 1;

  for (let i = 0; i < POSE_JOINT_COUNT; i++) {
    const lm = landmarks[i] ?? { x: 0, y: 0, z: 0 };
    joints[i * 3 + 0] = (lm.x - hipMidX) / torsoHeight;
    joints[i * 3 + 1] = (lm.y - hipMidY) / torsoHeight;
    joints[i * 3 + 2] = (lm.z - hipMidZ) / torsoHeight;
  }
  return joints;
}

/**
 * Compute per-frame motion energy as mean joint velocity.
 */
function computeMotionEnergy(
  currentJoints: Float32Array,
  previousJoints: Float32Array
): number {
  let totalVelocity = 0;
  for (let i = 0; i < POSE_FEATURE_DIM; i++) {
    totalVelocity += Math.abs(currentJoints[i] - previousJoints[i]);
  }
  return (totalVelocity / POSE_FEATURE_DIM) * MOTION_ENERGY_VELOCITY_SCALE;
}

/**
 * Add a new pose frame to the rolling buffer.
 * Returns true if buffer is full and ready for inference.
 */
export function addMotorFrame(
  state: MotorEngineState,
  landmarks: FaceMeshLandmark[]
): { newState: MotorEngineState; bufferReady: boolean } {
  const joints = normalisePoseLandmarks(landmarks);

  // Rolling buffer write
  const offset = state.writeIdx * POSE_FEATURE_DIM;
  state.frameBuffer.set(joints, offset);

  // Motion energy
  let motionEnergy = 0;
  if (state.previousJoints) {
    motionEnergy = computeMotionEnergy(joints, state.previousJoints);
  }

  const newState: MotorEngineState = {
    ...state,
    writeIdx: (state.writeIdx + 1) % FRAME_BUFFER_SIZE,
    frameCount: Math.min(state.frameCount + 1, FRAME_BUFFER_SIZE),
    motionEnergyAccumulator: state.motionEnergyAccumulator + motionEnergy,
    motionEnergyFrames: state.motionEnergyFrames + 1,
    previousJoints: joints,
  };

  const bufferReady = newState.frameCount >= FRAME_BUFFER_SIZE;
  return { newState, bufferReady };
}

/**
 * Run LSTM inference on the current frame buffer.
 * Call this when bufferReady === true.
 */
export async function runMotorInference(
  state: MotorEngineState
): Promise<{ motorRisk: number; stimmingDetected: boolean }> {
  if (!motorModel) {
    console.warn('[EngineB] Model not loaded, returning last score.');
    return {
      motorRisk: state.lastMotorRisk,
      stimmingDetected: state.lastMotorRisk > 0.5,
    };
  }

  // Build ordered tensor: reorder circular buffer so it's chronological
  const orderedBuffer = new Float32Array(FRAME_BUFFER_SIZE * POSE_FEATURE_DIM);
  const startIdx = state.frameCount >= FRAME_BUFFER_SIZE
    ? state.writeIdx   // circular buffer is full, oldest is at writeIdx
    : 0;

  for (let i = 0; i < FRAME_BUFFER_SIZE; i++) {
    const srcIdx = (startIdx + i) % FRAME_BUFFER_SIZE;
    const srcOff = srcIdx * POSE_FEATURE_DIM;
    const dstOff = i * POSE_FEATURE_DIM;
    orderedBuffer.set(state.frameBuffer.subarray(srcOff, srcOff + POSE_FEATURE_DIM), dstOff);
  }

  try {
    const outputs = motorModel.runSync([orderedBuffer]);
    const rawOutput = outputs[0] as Float32Array;
    const motorRisk = Math.min(1, Math.max(0, rawOutput[0]));
    return { motorRisk, stimmingDetected: motorRisk > 0.5 };
  } catch (err) {
    console.error('[EngineB] Inference error:', err);
    return { motorRisk: state.lastMotorRisk, stimmingDetected: false };
  }
}

/**
 * Build the final MotorAnalysis object.
 */
export function finalizeMotorAnalysis(
  state: MotorEngineState,
  motorRiskScore: number,
  stimmingDetected: boolean
): MotorAnalysis {
  const frames = Math.max(state.motionEnergyFrames, 1);
  const motionEnergy = state.motionEnergyAccumulator / frames;

  return {
    motorRiskScore: Math.min(1, Math.max(0, motorRiskScore)),
    stimmingDetected,
    motionEnergy: Math.min(1, motionEnergy * 10), // scale to 0-1
    bufferComplete: state.frameCount >= FRAME_BUFFER_SIZE,
  };
}