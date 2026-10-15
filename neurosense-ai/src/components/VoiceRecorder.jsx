import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, RotateCcw, AlertCircle, Loader2 } from 'lucide-react';

export default function VoiceRecorder({ onRecordingComplete, isProcessing = false, maxDurationSec = 60 }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [permissionError, setPermissionError] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      cancelAnimationFrame(animationFrameRef.current);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    setPermissionError(null);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Setup audio analyzer for live visual soundwaves
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        const audioCtx = new AudioCtxClass();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateLevel = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
          animationFrameRef.current = requestAnimationFrame(updateLevel);
        };
        updateLevel();
      }

      // MediaRecorder initialization
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else {
          mimeType = '';
        }
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/wav' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);

        // Stop all microphone tracks to turn off the hardware mic light
        stream.getTracks().forEach((track) => track.stop());
        cancelAnimationFrame(animationFrameRef.current);
        setAudioLevel(0);
      };

      recorder.start(250); // Collect slice every 250ms
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev + 1 >= maxDurationSec) {
            stopRecording();
            return maxDurationSec;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      setPermissionError(
        'Microphone access was denied or not found. You can allow permissions in your browser or click "Use Sample Voice" below to test the biomarker model.'
      );
    }
  };

  const handleUseDemoSample = () => {
    setPermissionError(null);
    const sampleRate = 16000;
    const durationSec = 3.5;
    const numSamples = Math.floor(sampleRate * durationSec);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    // Realistic modulated speech audio tone
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const burstEnvelope = (t < 0.9 || (t > 1.3 && t < 2.4) || t > 2.7) ? 0.9 : 0.05;
      const f0 = 175 + 15 * Math.sin(2 * Math.PI * 2.5 * t);
      const sampleVal = Math.sin(2 * Math.PI * f0 * t) * 0.45 + Math.sin(2 * Math.PI * (f0 * 2) * t) * 0.2;
      const s = Math.max(-1, Math.min(1, sampleVal * burstEnvelope));
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    const blob = new Blob([buffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    setAudioBlob(blob);
    setAudioUrl(url);
    setRecordingTime(4);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    clearInterval(timerRef.current);
    setIsRecording(false);
  };

  const handleReset = () => {
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordingTime(0);
    setAudioLevel(0);
  };

  const handleSubmit = () => {
    if (audioBlob && onRecordingComplete) {
      onRecordingComplete(audioBlob);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-6 border border-slate-200 dark:border-slate-700/60 shadow-sm transition-colors">
      {permissionError && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm flex items-start">
          <AlertCircle className="h-5 w-5 mr-2.5 flex-shrink-0 mt-0.5" />
          <span>{permissionError}</span>
        </div>
      )}

      {/* Recording Visualization / Timer Display */}
      <div className="flex flex-col items-center justify-center py-6">
        {isRecording ? (
          <div className="relative flex items-center justify-center mb-4">
            <div
              className="absolute h-28 w-28 rounded-full bg-red-500/20 dark:bg-red-500/30 animate-ping"
              style={{ transform: `scale(${1 + audioLevel / 100})` }}
            />
            <div
              className="h-20 w-20 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg transition-transform duration-100"
              style={{ transform: `scale(${1 + (audioLevel / 200)})` }}
            >
              <Mic className="h-10 w-10 animate-pulse" />
            </div>
          </div>
        ) : audioBlob ? (
          <div className="h-20 w-20 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-sm border border-emerald-200 dark:border-emerald-800">
            <Play className="h-9 w-9 ml-1" />
          </div>
        ) : (
          <div className="h-20 w-20 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center mb-4 shadow-sm border border-primary-200 dark:border-primary-800">
            <Mic className="h-10 w-10" />
          </div>
        )}

        {/* Live Timer */}
        <div className="text-3xl font-mono font-bold text-slate-800 dark:text-white mb-2">
          {formatTime(recordingTime)}
        </div>

        {/* Status Hint */}
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 text-center max-w-sm">
          {isRecording
            ? 'Listening... Speak naturally and describe the scene in continuous detail.'
            : audioBlob
            ? 'Audio recorded. You can listen back below or submit for AI biomarker analysis.'
            : 'Press "Start Recording" when you are ready to begin speaking.'}
        </p>

        {/* Sound Bars Graphic while Recording */}
        {isRecording && (
          <div className="flex items-center justify-center space-x-1.5 mt-4 h-8">
            {[0.4, 0.8, 0.6, 1.0, 0.7, 0.5, 0.9, 0.3].map((factor, idx) => {
              const height = Math.max(6, Math.round(audioLevel * factor * 0.35));
              return (
                <div
                  key={idx}
                  className="w-1.5 bg-red-500 dark:bg-red-400 rounded-full transition-all duration-75"
                  style={{ height: `${height}px` }}
                />
              );
            })}
          </div>
        )}

        {/* Playback Audio Element */}
        {audioUrl && !isRecording && (
          <div className="w-full max-w-md mt-5">
            <audio src={audioUrl} controls className="w-full h-10 rounded-lg" />
          </div>
        )}
      </div>

      {/* Control Actions */}
      <div className="flex items-center justify-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-700/60">
        {!isRecording && !audioBlob && (
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <button
              onClick={startRecording}
              disabled={isProcessing}
              className="btn-primary px-6 py-2.5 flex items-center shadow-md font-medium text-sm"
            >
              <Mic className="h-4 w-4 mr-2" /> Start Recording
            </button>
            <button
              type="button"
              onClick={handleUseDemoSample}
              disabled={isProcessing}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors text-xs font-semibold"
            >
              Use Sample Voice (Test)
            </button>
          </div>
        )}

        {isRecording && (
          <button
            onClick={stopRecording}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center shadow-md font-medium text-sm"
          >
            <Square className="h-4 w-4 mr-2 fill-current" /> Stop Recording
          </button>
        )}

        {audioBlob && !isRecording && (
          <>
            <button
              onClick={handleReset}
              disabled={isProcessing}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors flex items-center text-sm font-medium"
            >
              <RotateCcw className="h-4 w-4 mr-2" /> Re-record
            </button>

            <button
              onClick={handleSubmit}
              disabled={isProcessing}
              className="btn-primary px-6 py-2.5 flex items-center shadow-md font-medium text-sm disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing Biomarkers...
                </>
              ) : (
                'Analyze Speech Biomarkers'
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
