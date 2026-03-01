/**
 * ENGINE C: Facial Phenotyping (MobileNetV2 CNN)
 *
 * Processes a normalised face image tensor [1, 224, 224, 3] and returns
 * an ASD facial risk probability via face_risk_model.tflite.
 */

import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
import { FacialAnalysis, FaceMeshLandmark } from '../utils/types';

// ── Constants ─────────────────────────────────────────────────────────────────
const INPUT_HEIGHT = 224;
const INPUT_WIDTH  = 224;
const INPUT_CHANNELS = 3;
const INPUT_SIZE = INPUT_HEIGHT * INPUT_WIDTH * INPUT_CHANNELS;

// Run inference every N frames to reduce CPU load (facial traits don't change rapidly)
const INFERENCE_INTERVAL_FRAMES = 30;

// ── Model singleton ───────────────────────────────────────────────────────────
let faceModel: TensorflowModel | null = null;

export async function loadFaceModel(): Promise<void> {
  if (faceModel) return;
  try {
    faceModel = await loadTensorflowModel(
      require('../../models/face_risk_model.tflite'),
      'core-ml'
    );
    console.log('[EngineC] Face model loaded on Neural Engine.');
  } catch (err) {
    console.error('[EngineC] Failed to load face model:', err);
    throw err;
  }
}

export function disposeFaceModel(): void {
  faceModel = null;
}

// ── Engine State ──────────────────────────────────────────────────────────────

export interface FaceEngineState {
  frameCounter: number;
  lastFaceRisk: number;
  lastConfidence: number;
  inferenceCount: number;
  riskAccumulator: number;
}

export function createFaceEngine(): FaceEngineState {
  return {
    frameCounter: 0,
    lastFaceRisk: 0,
    lastConfidence: 0,
    inferenceCount: 0,
    riskAccumulator: 0,
  };
}

/**
 * MobileNetV2 preprocessing:
 * Normalise pixel values from [0, 255] to [-1, 1].
 */
function mobilenetPreprocess(pixelData: Uint8ClampedArray | Float32Array): Float32Array {
  const tensor = new Float32Array(INPUT_SIZE);
  const inputLength = Math.min(pixelData.length, INPUT_SIZE);
  for (let i = 0; i < inputLength; i++) {
    // pixelData may already be 0-255 uint8 or 0-1 float
    const pixel = pixelData[i] > 1 ? pixelData[i] / 255.0 : pixelData[i];
    tensor[i] = (pixel - 0.5) * 2.0;  // [0,1] → [-1,1]
  }
  return tensor;
}

/**
 * Crop and normalise face region from the full frame.
 * In production this would use the face bounding box from MediaPipe.
 * Here we accept a pre-cropped face image already at 224x224.
 */
function prepareFaceTensor(faceImageData: Float32Array): Float32Array {
  if (faceImageData.length === INPUT_SIZE) {
    // Already correctly sized and normalised
    return mobilenetPreprocess(faceImageData);
  }
  // Fallback: zero tensor (face not detected)
  return new Float32Array(INPUT_SIZE);
}

/**
 * Determine whether to run inference this frame.
 */
export function shouldRunFaceInference(state: FaceEngineState): boolean {
  return state.frameCounter % INFERENCE_INTERVAL_FRAMES === 0;
}

/**
 * Tick the frame counter.
 */
export function tickFaceEngine(state: FaceEngineState): FaceEngineState {
  return { ...state, frameCounter: state.frameCounter + 1 };
}

/**
 * Run CNN inference for facial phenotyping.
 * @param faceImageData Float32Array of size 224*224*3, values in [0,1] or [0,255]
 */
export async function runFaceInference(
  state: FaceEngineState,
  faceImageData: Float32Array
): Promise<FaceEngineState> {
  if (!faceModel) {
    console.warn('[EngineC] Model not loaded.');
    return state;
  }

  const tensor = prepareFaceTensor(faceImageData);

  try {
    const outputs = faceModel.runSync([tensor]);
    const rawOutput = outputs[0] as Float32Array;

    // Model outputs [risk_probability] or [benign_prob, risk_prob]
    let faceRisk: number;
    let confidence: number;

    if (rawOutput.length === 1) {
      faceRisk   = rawOutput[0];
      confidence = Math.abs(faceRisk - 0.5) * 2;  // Distance from decision boundary
    } else {
      // Two-class softmax output
      faceRisk   = rawOutput[1];                   // Index 1 = ASD class
      confidence = Math.max(rawOutput[0], rawOutput[1]);
    }

    faceRisk = Math.min(1, Math.max(0, faceRisk));

    return {
      ...state,
      lastFaceRisk: faceRisk,
      lastConfidence: confidence,
      inferenceCount: state.inferenceCount + 1,
      riskAccumulator: state.riskAccumulator + faceRisk,
    };
  } catch (err) {
    console.error('[EngineC] Inference error:', err);
    return state;
  }
}

/**
 * Build the final FacialAnalysis from accumulated state.
 */
export function finalizeFacialAnalysis(
  state: FaceEngineState,
  faceDetected: boolean
): FacialAnalysis {
  const avgRisk = state.inferenceCount > 0
    ? state.riskAccumulator / state.inferenceCount
    : 0;

  return {
    faceRiskScore: Math.min(1, Math.max(0, avgRisk)),
    confidence: state.lastConfidence,
    faceDetected,
  };
}