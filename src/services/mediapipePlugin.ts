/**
 * MEDIAPIPE VISION CAMERA PLUGIN
 * ─────────────────────────────────────────────────────────────────────────────
 * This file documents the NATIVE iOS plugin that must be implemented in Swift/ObjC
 * to bridge MediaPipe Tasks to react-native-vision-camera's Frame Processor API.
 *
 * FILE LOCATION IN XCODE PROJECT: ios/Plugins/MediapipePlugin.swift
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * INSTALLATION STEPS (do in Xcode after `npx expo run:ios`):
 *
 * 1. Add MediaPipe Tasks Vision to your Podfile:
 *    pod 'MediaPipeTasksVision', '~> 0.10.14'
 *
 * 2. Create ios/Plugins/MediapipePlugin.swift (see Swift template below)
 *
 * 3. Register the plugin in AppDelegate.mm or via VisionCamera's plugin registry
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SWIFT PLUGIN TEMPLATE (ios/Plugins/MediapipePlugin.swift):
 *
 * ```swift
 * import VisionCamera
 * import MediaPipeTasksVision
 * import UIKit
 *
 * @objc(MediapipePlugin)
 * public class MediapipePlugin: FrameProcessorPlugin {
 *   private var faceLandmarker: FaceLandmarker?
 *   private var poseLandmarker: PoseLandmarker?
 *
 *   public override init(proxy: VisionCameraProxyHolder, options: [AnyHashable: Any]! = [:]) {
 *     super.init(proxy: proxy, options: options)
 *
 *     // Face Landmark model (must be bundled: face_landmarker.task)
 *     let faceOptions = FaceLandmarkerOptions()
 *     faceOptions.baseOptions.modelAssetPath = Bundle.main.path(
 *       forResource: "face_landmarker", ofType: "task")!
 *     faceOptions.runningMode = .video
 *     faceOptions.numFaces = 1
 *     faceOptions.minFaceDetectionConfidence = 0.5
 *     faceOptions.outputFaceBlendshapes = false
 *     faceOptions.outputFacialTransformationMatrixes = false
 *     faceLandmarker = try? FaceLandmarker(options: faceOptions)
 *
 *     // Pose Landmark model (must be bundled: pose_landmarker_full.task)
 *     let poseOptions = PoseLandmarkerOptions()
 *     poseOptions.baseOptions.modelAssetPath = Bundle.main.path(
 *       forResource: "pose_landmarker_full", ofType: "task")!
 *     poseOptions.runningMode = .video
 *     poseOptions.numPoses = 1
 *     poseLandmarker = try? PoseLandmarker(options: poseOptions)
 *   }
 *
 *   public override func callback(_ frame: Frame, withArguments arguments: [AnyHashable: Any]?) -> Any? {
 *     let buffer = frame.buffer
 *     let timestamp = Int(frame.timestamp / 1_000_000) // ns → ms
 *
 *     var result: [String: Any] = [:]
 *
 *     // Face Mesh
 *     if let faceResult = try? faceLandmarker?.detect(videoFrame: MPImage(sampleBuffer: buffer)!,
 *                                                     timestampInMilliseconds: timestamp) {
 *       if let landmarks = faceResult.faceLandmarks.first {
 *         result["faceLandmarks"] = landmarks.map { ["x": $0.x, "y": $0.y, "z": $0.z] }
 *       }
 *     }
 *
 *     // Pose Estimation
 *     if let poseResult = try? poseLandmarker?.detect(videoFrame: MPImage(sampleBuffer: buffer)!,
 *                                                     timestampInMilliseconds: timestamp) {
 *       if let landmarks = poseResult.landmarks.first {
 *         result["poseLandmarks"] = landmarks.map { ["x": $0.x, "y": $0.y, "z": $0.z] }
 *       }
 *     }
 *
 *     // Optionally: crop face ROI to 224x224 and return as pixel array for Engine C
 *     // result["facePixels"] = cropAndResizeFace(buffer: buffer, faceLandmarks: ...) -> [Float]
 *
 *     return result
 *   }
 * }
 * ```
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REQUIRED TASK FILES (download from MediaPipe solutions):
 *   https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker#models
 *   → face_landmarker.task  (bundle in Xcode Resources)
 *   → pose_landmarker_full.task (or _lite.task for speed)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

// JS-side JS mock / type definition for the plugin result
export interface MediaPipePluginResult {
  faceLandmarks: Array<{ x: number; y: number; z: number }>;
  poseLandmarks: Array<{ x: number; y: number; z: number }>;
  facePixels?: number[];  // optional 224×224×3 float array
}

// The plugin name must match what's registered in Swift/ObjC
export const MEDIAPIPE_PLUGIN_NAME = 'mediapipeProcess';