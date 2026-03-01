// ─────────────────────────────────────────────────────────────────────────────
// Navigation Types
// ─────────────────────────────────────────────────────────────────────────────
export type RootStackParamList = {
  Welcome: undefined;
  Consent: undefined;
  Setup: undefined;
  Recording: undefined;
  Results: { result: ScreeningResult };
};

// ─────────────────────────────────────────────────────────────────────────────
// Engine Output Types
// ─────────────────────────────────────────────────────────────────────────────

/** Output from Engine A: Visual Attention / Gaze Aversion */
export interface GazeAnalysis {
  gazeRiskScore: number;          // 0.0 – 1.0: fraction of frames with aversion
  headYawMean: number;            // Mean absolute yaw in degrees
  irisDeviationMean: number;      // Mean normalised iris deviation
  aversionFrameCount: number;
  totalFramesAnalyzed: number;
}

/** Per-frame landmark data for pose (Engine B) */
export interface PoseLandmarks {
  frameIndex: number;
  joints: Float32Array;           // 24 joints × 3 coords = 72 floats
  timestamp: number;
}

/** Output from Engine B: Motor Biometrics & Stimming */
export interface MotorAnalysis {
  motorRiskScore: number;         // 0.0 – 1.0 from LSTM
  stimmingDetected: boolean;
  motionEnergy: number;           // Normalized kinematic energy
  bufferComplete: boolean;
}

/** Output from Engine C: Facial Phenotyping */
export interface FacialAnalysis {
  faceRiskScore: number;          // 0.0 – 1.0 from CNN
  confidence: number;
  faceDetected: boolean;
}

/** Final fused result */
export interface ScreeningResult {
  finalRiskScore: number;         // Weighted fusion output
  riskLevel: 'low' | 'moderate' | 'high';
  recommendation: string;
  gaze: GazeAnalysis;
  motor: MotorAnalysis;
  facial: FacialAnalysis;
  sessionDurationSeconds: number;
  timestamp: string;
  sessionId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Frame Processor Types
// ─────────────────────────────────────────────────────────────────────────────
export interface FaceMeshLandmark {
  x: number;
  y: number;
  z: number;
}

export interface FrameProcessorResult {
  faceLandmarks?: FaceMeshLandmark[];
  poseLandmarks?: FaceMeshLandmark[];
  faceImageData?: Float32Array;   // [224*224*3] normalised for Engine C
}

// ─────────────────────────────────────────────────────────────────────────────
// Session State
// ─────────────────────────────────────────────────────────────────────────────
export interface SessionState {
  isRecording: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  framesProcessed: number;
  currentGazeScore: number;
  currentMotorScore: number;
  currentFaceScore: number;
  engineStatus: {
    gazeReady: boolean;
    motorReady: boolean;
    faceReady: boolean;
  };
}

export const SESSION_DURATION_SECONDS = 180; // 3 minutes
export const FRAME_BUFFER_SIZE = 100;
export const POSE_JOINT_COUNT = 24;
export const POSE_FEATURE_DIM = POSE_JOINT_COUNT * 3; // 72

// DSM-5 based fusion weights
export const FUSION_WEIGHTS = {
  gaze: 0.4,
  motor: 0.4,
  face: 0.2,
} as const;

export const RISK_THRESHOLD = 0.5;