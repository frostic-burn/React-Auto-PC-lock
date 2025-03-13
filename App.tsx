import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import { Settings, Eye, User, AlertTriangle, Lock, Minimize } from 'lucide-react';

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [userPresent, setUserPresent] = useState(false);
  const [eyesOnScreen, setEyesOnScreen] = useState(false);
  const [inactivityTimer, setInactivityTimer] = useState(10);
  const [warningTimer, setWarningTimer] = useState(5);
  const [action, setAction] = useState<'Lock' | 'Minimize'>('Lock');
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    let detector: any;
    let animationFrame: number;
    let lastActivity = Date.now();
    let warningTimeout: NodeJS.Timeout;

    const setupCamera = async () => {
      if (!videoRef.current) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      // Load face detection model with runtime configuration
      await tf.setBackend('webgl');
      detector = await faceLandmarksDetection.createDetector(
        faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
        {
          runtime: 'tfjs',
          refineLandmarks: true,
          maxFaces: 1
        }
      );
    };

    const detectFace = async () => {
      if (!videoRef.current || !detector || !isRunning) return;

      const predictions = await detector.estimateFaces(videoRef.current);
      
      const newUserPresent = predictions.length > 0;
      setUserPresent(newUserPresent);

      if (newUserPresent) {
        const face = predictions[0];
        // Check if eyes are visible and looking forward
        const leftEye = face.keypoints.filter((kp: any) => kp.name?.includes('leftEye'));
        const rightEye = face.keypoints.filter((kp: any) => kp.name?.includes('rightEye'));
        
        setEyesOnScreen(leftEye.length > 0 && rightEye.length > 0);
      } else {
        setEyesOnScreen(false);
      }

      // Check inactivity
      const now = Date.now();
      if (!newUserPresent && !isDismissed && now - lastActivity > inactivityTimer * 1000) {
        if (!showWarning) {
          setShowWarning(true);
          setCountdown(warningTimer);
          warningTimeout = setTimeout(() => {
            if (!isDismissed) {
              performAction();
            }
            setShowWarning(false);
          }, warningTimer * 1000);
        }
      }

      animationFrame = requestAnimationFrame(detectFace);
    };

    const handleActivity = () => {
      lastActivity = Date.now();
      setIsDismissed(false);
      if (showWarning) {
        setShowWarning(false);
        clearTimeout(warningTimeout);
      }
    };

    if (isRunning) {
      setupCamera();
      window.addEventListener('mousemove', handleActivity);
      window.addEventListener('keydown', handleActivity);
      window.addEventListener('click', handleActivity);
    }

    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
      cancelAnimationFrame(animationFrame);
      clearTimeout(warningTimeout);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, [isRunning, inactivityTimer, warningTimer, isDismissed, showWarning]);

  const performAction = () => {
    if (action === 'Minimize') {
      window.minimize?.(); // This may not work in all browsers
    } else {
      // Lock screen functionality would need to be implemented by the system
      alert('Screen would be locked (not available in web version)');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Video Feed */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Eye className="w-6 h-6" />
            Video Feed
          </h2>
          <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
            />
          </div>
        </div>

        {/* Controls and Status */}
        <div className="space-y-6">
          {/* Status Panel */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <User className="w-6 h-6" />
              Status
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>User Present:</span>
                <span className={`font-semibold ${userPresent ? 'text-green-600' : 'text-red-600'}`}>
                  {userPresent ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Eyes on Screen:</span>
                <span className={`font-semibold ${eyesOnScreen ? 'text-green-600' : 'text-red-600'}`}>
                  {eyesOnScreen ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          {/* Settings Panel */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Settings className="w-6 h-6" />
              Settings
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Inactivity Timer (seconds)
                </label>
                <input
                  type="number"
                  min="5"
                  max="300"
                  value={inactivityTimer}
                  onChange={(e) => setInactivityTimer(Number(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Warning Timer (seconds)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={warningTimer}
                  onChange={(e) => setWarningTimer(Number(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Action on Inactivity
                </label>
                <div className="mt-2 space-y-2">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      checked={action === 'Lock'}
                      onChange={() => setAction('Lock')}
                      className="form-radio"
                    />
                    <span className="ml-2">Lock Screen</span>
                  </label>
                  <br />
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      checked={action === 'Minimize'}
                      onChange={() => setAction('Minimize')}
                      className="form-radio"
                    />
                    <span className="ml-2">Minimize Windows</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Control Button */}
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white ${
              isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isRunning ? 'Stop Detection' : 'Start Detection'}
          </button>
        </div>
      </div>

      {/* Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
              <h3 className="text-2xl font-bold">Security Warning</h3>
            </div>
            <p className="mb-4">Kindly secure your device.</p>
            <p className="text-lg font-semibold mb-6">
              Auto-{action.toLowerCase()} in {countdown} seconds
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setIsDismissed(true);
                  setShowWarning(false);
                }}
                className="flex-1 py-2 px-4 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
              >
                Dismiss
              </button>
              <button
                onClick={() => setShowWarning(false)}
                className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;