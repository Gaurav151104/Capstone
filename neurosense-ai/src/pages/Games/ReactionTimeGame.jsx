/* eslint-disable react-hooks/purity */
import React, { useState, useRef, useEffect } from 'react';
import { 
  Zap, 
  ArrowLeft, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Activity, 
  TrendingUp,
  LayoutDashboard,
  ShieldCheck,
  Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/Card';
import { gameService } from '../../services/gameService';
import { 
  measureDeviceAndRefreshRate, 
  generateReactionTimeISIs, 
  calculateReactionTimeStats 
} from '../../utils/cognitivePools';
import CognitiveConsentModal from '../../components/CognitiveConsentModal';
import { COGNITIVE_ASSESSMENT_CONFIG } from '../../config/cognitiveConfig';

export default function ReactionTimeGame() {
  const navigate = useNavigate();

  // Game states: 'intro' | 'practice_intro' | 'waiting' | 'ready' | 'trial_result' | 'early_click' | 'practice_finished' | 'completed'
  const [gameState, setGameState] = useState('intro');
  const [sessionInfo, setSessionInfo] = useState(null);
  const [isPractice, setIsPractice] = useState(true);
  const [trialIndex, setTrialIndex] = useState(0);

  const [practiceTimes, setPracticeTimes] = useState([]);
  const [testTimes, setTestTimes] = useState([]);
  const [falseStarts, setFalseStarts] = useState(0);
  const [lastReaction, setLastReaction] = useState(0);
  const [resultsSummary, setResultsSummary] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [normZScore, setNormZScore] = useState(null);

  const timeoutRef = useRef(null);
  const cueTimeRef = useRef(0);
  const hasSavedRef = useRef(false);

  const numPractice = COGNITIVE_ASSESSMENT_CONFIG.reactionTime.numPracticeTrials || 3;
  const numTest = COGNITIVE_ASSESSMENT_CONFIG.reactionTime.numTestTrials || 10;

  useEffect(() => {
    measureDeviceAndRefreshRate().then(info => setDeviceInfo(info));
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const initGameSession = async () => {
    if (isStarting) return;
    setIsStarting(true);
    hasSavedRef.current = false;

    // Check consent status
    const hasConsent = await gameService.getServerConsent();
    if (!hasConsent) {
      setConsentOpen(true);
      setIsStarting(false);
      return;
    }

    try {
      let session = null;
      try {
        session = await gameService.fetchNextSessionItems('Reaction Time', {
          num_practice: numPractice,
          num_test: numTest
        });
      } catch (e) {
        console.warn('Backend ISI sync unavailable, generating local randomized delay sequence:', e);
      }

      const minDelay = COGNITIVE_ASSESSMENT_CONFIG.reactionTime.minDelayMs || 1500;
      const maxDelay = COGNITIVE_ASSESSMENT_CONFIG.reactionTime.maxDelayMs || 3500;

      if (!session || !session.testIsis || session.testIsis.length < numTest) {
        session = {
          game: 'Reaction Time',
          formId: 'RT_PROTOCOL_1',
          practiceIsis: generateReactionTimeISIs(numPractice, minDelay, maxDelay),
          testIsis: generateReactionTimeISIs(numTest, minDelay, maxDelay),
          sessionId: `sess_rt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        };
      }

      setSessionInfo(session);
      setIsPractice(true);
      setTrialIndex(0);
      setPracticeTimes([]);
      setTestTimes([]);
      setFalseStarts(0);
      setLastReaction(0);
      setResultsSummary(null);
      setNormZScore(null);
      setGameState('practice_intro');
    } catch (e) {
      console.error('Failed to init Reaction Time session:', e);
    } finally {
      setIsStarting(false);
    }
  };

  const startNextTrial = () => {
    const isis = isPractice ? sessionInfo?.practiceIsis : sessionInfo?.testIsis;
    const fallbackDelay = Math.round(1500 + Math.random() * 2000);
    const isiMs = (isis && isis[trialIndex]) ? isis[trialIndex] : fallbackDelay;

    setGameState('waiting');

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      cueTimeRef.current = performance.now();
      setGameState('ready');
    }, isiMs);
  };

  const handleUserAction = () => {
    if (gameState === 'waiting') {
      // Premature click before stimulus turned green!
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setFalseStarts(prev => prev + 1);
      setGameState('early_click');
    } else if (gameState === 'ready') {
      const clickTime = performance.now();
      const rawElapsed = Math.round(clickTime - cueTimeRef.current);
      const elapsed = Math.max(10, rawElapsed);

      setLastReaction(elapsed);

      if (isPractice) {
        const updated = [...practiceTimes, elapsed];
        setPracticeTimes(updated);
        const nextIdx = trialIndex + 1;
        setTrialIndex(nextIdx);

        if (nextIdx >= numPractice) {
          setGameState('practice_finished');
        } else {
          setGameState('trial_result');
        }
      } else {
        const updated = [...testTimes, elapsed];
        setTestTimes(updated);
        const nextIdx = trialIndex + 1;
        setTrialIndex(nextIdx);

        if (nextIdx >= numTest) {
          finishGame(updated, falseStarts);
        } else {
          setGameState('trial_result');
        }
      }
    }
  };

  const finishGame = async (finalTestTimes, totalFalseStarts) => {
    if (hasSavedRef.current) return;
    hasSavedRef.current = true;

    setGameState('completed');

    const stats = calculateReactionTimeStats(
      finalTestTimes,
      COGNITIVE_ASSESSMENT_CONFIG.reactionTime.prematureClickThresholdMs || 150,
      COGNITIVE_ASSESSMENT_CONFIG.reactionTime.lapseThresholdMs || 1000
    );

    // Score calculation: baseline 250ms = 100%, 500ms = 50%
    const score = Math.max(10, Math.min(100, Math.round(100 - ((stats.meanMs - 220) * 0.25) - (totalFalseStarts * 5))));

    const summary = {
      ...stats,
      score,
      falseStarts: totalFalseStarts,
      trialsCount: finalTestTimes.length
    };
    setResultsSummary(summary);

    const sessionId = sessionInfo?.sessionId || `sess_rt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Save session to server and local storage
    await gameService.saveReactionTimeSession({
      sessionId,
      avgReactionTimeMs: stats.meanMs,
      variabilityMs: stats.variabilityMs,
      falseStarts: totalFalseStarts,
      trials: finalTestTimes,
      score,
      medianMs: stats.medianMs,
      lapses: stats.lapses,
      anticipations: stats.anticipations,
      formId: sessionInfo?.formId || 'RT_PROTOCOL_1',
      deviceInfo: deviceInfo || {}
    });

    // Score against normative UK Biobank simple visual reaction time distribution
    const normReport = await gameService.scoreSession({
      reaction_time_mean_ms: stats.meanMs,
      reaction_time_sd_ms: stats.variabilityMs
    });

    if (normReport?.per_measure_z?.reaction_time_mean_ms !== undefined) {
      setNormZScore(normReport.per_measure_z.reaction_time_mean_ms);
    }
  };

  const startFormalTest = () => {
    setIsPractice(false);
    setTrialIndex(0);
    setTestTimes([]);
    startNextTrial();
  };

  const currentTotal = isPractice ? numPractice : numTest;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto overflow-hidden animate-in fade-in duration-500">
      <CognitiveConsentModal
        isOpen={consentOpen}
        onConsentGranted={() => {
          setConsentOpen(false);
          initGameSession();
        }}
        onCancel={() => setConsentOpen(false)}
      />

      {/* Top Header & Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button 
          onClick={() => navigate('/dashboard/games')}
          className="flex items-center text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-medium text-sm"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Games
        </button>

        <span className="text-xs text-slate-400 font-medium">
          Simple Visual Reaction Time (SRT) Protocol
        </span>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex-shrink-0 mb-4 z-10 transition-colors duration-200">
        <div>
          <h2 className="text-xl font-bold flex items-center text-slate-800 dark:text-white">
            <Zap className="mr-2 h-6 w-6 text-amber-500" /> Reaction Time
          </h2>
          <p className="text-xs text-muted">
            {isPractice ? `Practice Phase • Trial ${trialIndex + 1} of ${numPractice}` : `Formal Assessment • Trial ${trialIndex + 1} of ${numTest}`}
          </p>
        </div>
        
        <div className="flex items-center space-x-3 mt-3 sm:mt-0">
          {falseStarts > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg">
              False Starts: {falseStarts}
            </span>
          )}

          <button 
            onClick={initGameSession} 
            disabled={isStarting}
            className="btn-primary flex items-center py-1.5 px-4 text-xs disabled:opacity-50"
          >
            {gameState !== 'intro' ? <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> : <Zap className="h-3.5 w-3.5 mr-1.5" />}
            {isStarting ? 'Starting...' : (gameState !== 'intro' ? 'Restart Protocol' : 'Start Test')}
          </button>
        </div>
      </div>

      {/* Main Interactive Stimulus Canvas */}
      <div className="flex-1 min-h-0 flex items-center justify-center relative">
        {/* Intro */}
        {gameState === 'intro' && (
          <div className="w-full h-full max-h-96 flex flex-col items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center rounded-2xl shadow-sm transition-colors">
            <div className="h-16 w-16 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-500 flex items-center justify-center mb-4">
              <Zap className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">
              Simple Visual Reaction Time (SRT)
            </h3>
            <p className="text-muted mt-2 text-xs sm:text-sm max-w-md leading-relaxed">
              When the screen turns <strong className="text-emerald-600 dark:text-emerald-400">GREEN</strong>, tap or click anywhere as fast as you can. Do not click early while the screen is red.
            </p>
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 mt-4 text-xs text-slate-600 dark:text-slate-300 max-w-md flex items-center gap-2 text-left">
              <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
              <span>Includes 3 practice trials followed by 10 calibrated test trials with variable 1.5–3.5s foreperiods.</span>
            </div>
            <button 
              onClick={initGameSession} 
              disabled={isStarting}
              className="btn-primary px-8 py-2.5 mt-6 text-sm flex items-center"
            >
              <Zap className="h-4 w-4 mr-2" />
              {isStarting ? 'Calibrating...' : 'Begin Protocol'}
            </button>
          </div>
        )}

        {/* Practice Intro */}
        {gameState === 'practice_intro' && (
          <div className="w-full h-full max-h-96 flex flex-col items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center rounded-2xl shadow-sm space-y-4">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-widest bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-full">
              Familiarization Phase
            </span>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">
              Practice Trials ({numPractice} trials)
            </h3>
            <p className="text-muted text-xs sm:text-sm max-w-md leading-relaxed">
              Let's do {numPractice} quick practice trials so you can get used to the timing. These will not count towards your formal score.
            </p>
            <button onClick={startNextTrial} className="btn-primary px-8 py-2.5 text-sm">
              Start Practice 1 of {numPractice}
            </button>
          </div>
        )}

        {/* Waiting State (Red Screen) */}
        {gameState === 'waiting' && (
          <div 
            onClick={handleUserAction}
            className="w-full h-full rounded-2xl bg-rose-600 hover:bg-rose-700 flex flex-col items-center justify-center text-white cursor-pointer select-none p-6 text-center transition-colors shadow-inner"
          >
            <Clock className="h-16 w-16 mb-4 animate-pulse opacity-80" />
            <h3 className="text-3xl font-extrabold tracking-wide">WAIT FOR GREEN...</h3>
            <p className="text-sm opacity-90 mt-2">Do not tap yet!</p>
            <span className="text-xs opacity-75 mt-4">
              Trial {trialIndex + 1} of {currentTotal} {isPractice ? '(Practice)' : ''}
            </span>
          </div>
        )}

        {/* Ready State (Green Screen) */}
        {gameState === 'ready' && (
          <div 
            onClick={handleUserAction}
            className="w-full h-full rounded-2xl bg-emerald-500 hover:bg-emerald-600 flex flex-col items-center justify-center text-white cursor-pointer select-none p-6 text-center transition-colors animate-in zoom-in-95 duration-100 shadow-2xl"
          >
            <Zap className="h-20 w-20 mb-4 animate-bounce" />
            <h3 className="text-4xl sm:text-5xl font-black tracking-wider">TAP NOW!</h3>
            <span className="text-xs opacity-80 mt-4 font-semibold">Click or tap anywhere!</span>
          </div>
        )}

        {/* Premature / Early Click */}
        {gameState === 'early_click' && (
          <div className="w-full h-full max-h-96 flex flex-col items-center justify-center bg-rose-50 dark:bg-rose-950/20 rounded-2xl border-2 border-rose-200 dark:border-rose-900/40 p-8 text-center space-y-4">
            <AlertTriangle className="h-14 w-14 text-rose-500" />
            <h3 className="text-2xl font-bold text-rose-700 dark:text-rose-400">Too Early!</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-sm">
              You clicked before the stimulus turned green. Premature clicks count as a false start. Wait until the color changes.
            </p>
            <button onClick={startNextTrial} className="btn-primary bg-rose-600 hover:bg-rose-700 px-8 py-2 text-sm">
              Retry Trial
            </button>
          </div>
        )}

        {/* Single Trial Result */}
        {gameState === 'trial_result' && (
          <div className="w-full h-full max-h-96 flex flex-col items-center justify-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-4">
            <span className="text-xs text-muted uppercase font-bold">
              Trial {trialIndex} of {currentTotal} {isPractice ? '(Practice)' : ''}
            </span>
            <div className="text-5xl font-black text-slate-800 dark:text-white">
              {lastReaction} <span className="text-2xl text-slate-400 font-normal">ms</span>
            </div>
            <p className="text-xs text-slate-500">
              {lastReaction < 200 ? '⚡ Outstanding reaction speed!' : lastReaction < 350 ? '✓ Good, steady response.' : 'Tap as soon as green appears.'}
            </p>
            <button onClick={startNextTrial} className="btn-primary px-8 py-2 text-sm">
              Next Trial ({trialIndex + 1}/{currentTotal})
            </button>
          </div>
        )}

        {/* Practice Finished */}
        {gameState === 'practice_finished' && (
          <div className="w-full h-full max-h-96 flex flex-col items-center justify-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-4">
            <CheckCircle2 className="h-14 w-14 text-emerald-500" />
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white">
              Practice Completed!
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-sm leading-relaxed">
              You are ready for the formal test. There will be {numTest} trials with randomized delays. Stay focused on the center.
            </p>
            <button onClick={startFormalTest} className="btn-primary px-8 py-2.5 text-sm">
              Begin Formal Test (1 of {numTest})
            </button>
          </div>
        )}

        {/* Final Completion Summary */}
        {gameState === 'completed' && resultsSummary && (
          <div className="w-full h-full max-h-96 flex flex-col items-center justify-center bg-emerald-50/70 dark:bg-emerald-950/20 rounded-2xl border-2 border-emerald-100 dark:border-emerald-900/40 p-6 text-center transition-colors">
            <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h3 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mb-1">
              Assessment Completed!
            </h3>

            <div className="grid grid-cols-3 gap-3 my-3 max-w-md w-full">
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-muted uppercase font-bold">Mean RT</span>
                <p className="text-lg font-extrabold text-slate-800 dark:text-white">
                  {resultsSummary.meanMs} <span className="text-xs font-normal">ms</span>
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-muted uppercase font-bold">Variability (SD)</span>
                <p className="text-lg font-extrabold text-slate-800 dark:text-white">
                  ±{resultsSummary.variabilityMs} <span className="text-xs font-normal">ms</span>
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-muted uppercase font-bold">False Starts</span>
                <p className="text-lg font-extrabold text-rose-600 dark:text-rose-400">
                  {resultsSummary.falseStarts}
                </p>
              </div>
            </div>

            {normZScore !== null && (
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Normative SRT z-Score: {normZScore > 0 ? '+' : ''}{normZScore} (Provisional UK Biobank Norm)
              </p>
            )}

            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-2 max-w-md text-center">
              <Info className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span>Provisional visual reaction time screening. Individual trial latencies saved securely.</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
              <button onClick={initGameSession} className="btn-primary px-6 py-2 text-xs flex items-center">
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Retest / Next Session
              </button>
              <button 
                onClick={() => navigate('/dashboard')} 
                className="btn-outline px-6 py-2 text-xs flex items-center bg-white dark:bg-slate-900"
              >
                <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" /> Return to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
