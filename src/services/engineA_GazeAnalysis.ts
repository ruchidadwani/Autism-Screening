/**
 * ENGINE A: Visual Attention / Gaze Aversion
 *
 * Uses MediaPipe FaceMesh 3D landmarks to compute:
 *   1. Head Yaw via solvePnP-style heuristic (no OpenCV available on device;
 *      we replicate the geometry with cross-product math in JS/TS).
 *   2. Iris Deviation – normalised distance of iris centre from eye centre.
 *
 * Landmark indices follow MediaPipe 468-point face mesh.
 */

import { FaceMeshLandmark, GazeAnalysis } from '../utils/types';

// ── Key landmark indices ────────────────────────────────────────────────────
const LM = {
  // Nose tip & bridge
  NOSE_TIP: 1,
  NOSE_BRIDGE: 168,
  // Chin
  CHIN: 152,
  // Left eye corners (from subject's perspective)
  LEFT_EYE_INNER: 133,
  LEFT_EYE_OUTER: 33,
  LEFT_IRIS_CENTER: 468,   // requires iris refinement landmarks
  // Right eye corners
  RIGHT_EYE_INNER: 362,
  RIGHT_EYE_OUTER: 263,
  RIGHT_IRIS_CENTER: 473,
  // Cheekbones – used for facial plane
  LEFT_CHEEK: 234,
  RIGHT_CHEEK: 454,
} as const;

// ── Thresholds ──────────────────────────────────────────────────────────────
const YAW_AVERSION_THRESHOLD_DEG = 20;   // degrees
const IRIS_DEVIATION_THRESHOLD = 0.25;   // normalised 0-1

// ── Math helpers ─────────────────────────────────────────────────────────────

type Vec3 = { x: number; y: number; z: number };

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function norm(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function normalise(v: Vec3): Vec3 {
  const n = norm(v) || 1e-9;
  return { x: v.x / n, y: v.y / n, z: v.z / n };
}

/**
 * Estimate head yaw using the facial plane normal approach.
 * We construct two vectors in the face plane and compute their cross product
 * to get the face-forward normal, then read the yaw from the x-component.
 */
function estimateHeadYawDeg(lm: FaceMeshLandmark[]): number | null {
  if (lm.length < 455) return null;

  const leftCheek  = lm[LM.LEFT_CHEEK];
  const rightCheek = lm[LM.RIGHT_CHEEK];
  const noseTip    = lm[LM.NOSE_TIP];
  const chin       = lm[LM.CHIN];

  // Horizontal vector (left → right)
  const horizontal = sub(rightCheek, leftCheek);
  // Vertical vector (chin → nose)
  const vertical   = sub(noseTip, chin);

  // Face normal
  const faceNormal = normalise(cross(horizontal, vertical));

  // Yaw ≈ arctan2(normalX, normalZ)
  const yawRad = Math.atan2(faceNormal.x, faceNormal.z);
  return (yawRad * 180) / Math.PI;
}

/**
 * Compute normalised iris deviation for one eye.
 * Deviation = |iris_center - eye_midpoint| / eye_width
 */
function irisDeviation(
  iris: FaceMeshLandmark,
  innerCorner: FaceMeshLandmark,
  outerCorner: FaceMeshLandmark
): number {
  const midX = (innerCorner.x + outerCorner.x) / 2;
  const midY = (innerCorner.y + outerCorner.y) / 2;
  const eyeWidth = Math.sqrt(
    Math.pow(outerCorner.x - innerCorner.x, 2) +
    Math.pow(outerCorner.y - innerCorner.y, 2)
  );
  if (eyeWidth < 1e-6) return 0;
  const dx = iris.x - midX;
  const dy = iris.y - midY;
  return Math.sqrt(dx * dx + dy * dy) / eyeWidth;
}

// ── Public engine state ───────────────────────────────────────────────────────

interface GazeEngineState {
  totalFrames: number;
  aversionFrames: number;
  yawAccumulator: number;
  irisDeviationAccumulator: number;
}

export function createGazeEngine(): GazeEngineState {
  return {
    totalFrames: 0,
    aversionFrames: 0,
    yawAccumulator: 0,
    irisDeviationAccumulator: 0,
  };
}

/**
 * Process a single frame of face landmarks.
 * Call this on every camera frame that contains face mesh data.
 */
export function processGazeFrame(
  state: GazeEngineState,
  landmarks: FaceMeshLandmark[]
): GazeEngineState {
  if (!landmarks || landmarks.length < 10) {
    // No face detected – treat as aversion
    return {
      ...state,
      totalFrames: state.totalFrames + 1,
      aversionFrames: state.aversionFrames + 1,
    };
  }

  const yawDeg = estimateHeadYawDeg(landmarks);

  // Iris deviation (use both eyes if iris landmarks available, else skip)
  let avgIrisDev = 0;
  if (landmarks.length >= 474) {
    const leftDev = irisDeviation(
      landmarks[LM.LEFT_IRIS_CENTER],
      landmarks[LM.LEFT_EYE_INNER],
      landmarks[LM.LEFT_EYE_OUTER]
    );
    const rightDev = irisDeviation(
      landmarks[LM.RIGHT_IRIS_CENTER],
      landmarks[LM.RIGHT_EYE_INNER],
      landmarks[LM.RIGHT_EYE_OUTER]
    );
    avgIrisDev = (leftDev + rightDev) / 2;
  }

  const yawAversion = yawDeg !== null && Math.abs(yawDeg) > YAW_AVERSION_THRESHOLD_DEG;
  const irisAversion = avgIrisDev > IRIS_DEVIATION_THRESHOLD;
  const isAverting = yawAversion || irisAversion;

  return {
    totalFrames: state.totalFrames + 1,
    aversionFrames: state.aversionFrames + (isAverting ? 1 : 0),
    yawAccumulator: state.yawAccumulator + (yawDeg ?? 0),
    irisDeviationAccumulator: state.irisDeviationAccumulator + avgIrisDev,
  };
}

/**
 * Compute the final GazeAnalysis from accumulated state.
 */
export function finalizeGazeAnalysis(state: GazeEngineState): GazeAnalysis {
  const total = Math.max(state.totalFrames, 1);
  const gazeRiskScore = state.aversionFrames / total;

  return {
    gazeRiskScore: Math.min(1, Math.max(0, gazeRiskScore)),
    headYawMean: Math.abs(state.yawAccumulator / total),
    irisDeviationMean: state.irisDeviationAccumulator / total,
    aversionFrameCount: state.aversionFrames,
    totalFramesAnalyzed: state.totalFrames,
  };
}