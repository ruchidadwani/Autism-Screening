/**
 * FUSION ENGINE: DSM-5 Weighted Late Fusion
 *
 * Combines outputs from all three engines into a single Final Risk Score.
 *
 * Formula (DSM-5 priority weighted):
 *   FinalRisk = 0.4 × GazeRisk + 0.4 × MotorRisk + 0.2 × FaceRisk
 *
 * Clinical threshold: FinalRisk > 0.5 → "High Risk / Clinical Review Recommended"
 */

import {
  GazeAnalysis,
  MotorAnalysis,
  FacialAnalysis,
  ScreeningResult,
  FUSION_WEIGHTS,
  RISK_THRESHOLD,
} from '../utils/types';

// ── Fusion Math ───────────────────────────────────────────────────────────────

export function computeFusedRiskScore(
  gaze: GazeAnalysis,
  motor: MotorAnalysis,
  facial: FacialAnalysis
): number {
  const score =
    FUSION_WEIGHTS.gaze  * gaze.gazeRiskScore +
    FUSION_WEIGHTS.motor * motor.motorRiskScore +
    FUSION_WEIGHTS.face  * facial.faceRiskScore;

  return Math.min(1, Math.max(0, score));
}

// ── Risk Level Classification ─────────────────────────────────────────────────

export type RiskLevel = 'low' | 'moderate' | 'high';

export function classifyRiskLevel(score: number): RiskLevel {
  if (score >= RISK_THRESHOLD)  return 'high';
  if (score >= 0.3)             return 'moderate';
  return 'low';
}

export function getRiskRecommendation(level: RiskLevel, score: number): string {
  const scoreStr = (score * 100).toFixed(0);

  switch (level) {
    case 'high':
      return (
        `Risk Score: ${scoreStr}% — This screening suggests elevated behavioral markers ` +
        `consistent with ASD risk criteria. A formal clinical evaluation by a licensed ` +
        `developmental pediatrician or child psychologist is strongly recommended. ` +
        `Early intervention significantly improves outcomes.`
      );
    case 'moderate':
      return (
        `Risk Score: ${scoreStr}% — Some behavioral patterns warrant monitoring. ` +
        `Consider discussing developmental milestones with your pediatrician at your ` +
        `next scheduled visit. This screening is not a diagnosis.`
      );
    case 'low':
      return (
        `Risk Score: ${scoreStr}% — No significant behavioral markers detected in this ` +
        `session. Continue routine developmental monitoring. Screening should be repeated ` +
        `periodically as part of well-child care.`
      );
  }
}

// ── Confidence Estimation ─────────────────────────────────────────────────────

/**
 * Estimate overall result confidence based on data quality:
 * - How many frames did Engine A analyze?
 * - Did Engine B fill its 100-frame buffer?
 * - Did Engine C run inference?
 */
export function estimateConfidence(
  gaze: GazeAnalysis,
  motor: MotorAnalysis,
  facial: FacialAnalysis,
  sessionDurationSeconds: number
): number {
  // Gaze: need at least 200 frames
  const gazeFactor = Math.min(1, gaze.totalFramesAnalyzed / 200);

  // Motor: buffer completion is binary
  const motorFactor = motor.bufferComplete ? 1.0 : motor.motorRiskScore > 0 ? 0.5 : 0.2;

  // Face: confidence from CNN output
  const faceFactor = facial.faceDetected ? facial.confidence : 0.5;

  // Duration factor (full 3 min = 1.0)
  const durationFactor = Math.min(1, sessionDurationSeconds / 180);

  return Math.round(
    ((gazeFactor * 0.35) + (motorFactor * 0.35) + (faceFactor * 0.1) + (durationFactor * 0.2)) * 100
  );
}

// ── Final Result Builder ──────────────────────────────────────────────────────

export function buildScreeningResult(
  gaze: GazeAnalysis,
  motor: MotorAnalysis,
  facial: FacialAnalysis,
  sessionDurationSeconds: number
): ScreeningResult {
  const finalRiskScore = computeFusedRiskScore(gaze, motor, facial);
  const riskLevel = classifyRiskLevel(finalRiskScore);
  const recommendation = getRiskRecommendation(riskLevel, finalRiskScore);

  return {
    finalRiskScore,
    riskLevel,
    recommendation,
    gaze,
    motor,
    facial,
    sessionDurationSeconds,
    timestamp: new Date().toISOString(),
    sessionId: Math.random().toString(36).substring(2, 11).toUpperCase(),
  };
}