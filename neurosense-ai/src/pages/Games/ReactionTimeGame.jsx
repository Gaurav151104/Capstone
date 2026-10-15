/* eslint-disable react-hooks/purity */
import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Zap, 
  ArrowLeft, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Activity, 
  TrendingUp,
  Gamepad2,
  Monitor,
  ShieldCheck,
  Info
} from 'lucide-react';
import Card from '../../components/Card';
import { gameService } from '../../services/gameService';
import { measureDeviceAndRefreshRate } from '../../utils/cognitivePools';
import CognitiveConsentModal from '../../components/CognitiveConsentModal';

const NUM_PRACTICE_TRIALS = 5;
const NUM_TEST_TRIALS = 20;

export default function ReactionTimeGame() {
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
  const [consentOpen, setConsentOpen] = useState(false);
  const [serverError, setServerError] = useState('');

  const timeoutRef = useRef(null);
  const cueTimeRef = useRef(0);

  useEffect(() => {
    // Measure refresh rate and device specs upon load
    measureDeviceAndRefreshRate().then(info => setDeviceInfo(info));
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const initGameSession = async () => {
    const hasConsent = await gameService.getServerConsent();
    if (!hasConsent) {
      setConsentOpen(true);
      return;
    }

    try {
      setServerError('');
      const session = await gameService.fetchNextSessionItems('Reaction Time', {
        num_practice: NUM_PRACTICE_TRIALS,
        num_test: NUM_TEST_TRIALS
      });
      if (!session || !session.practiceIsis || !session.testIsis || session.practiceIsis.length < NUM_PRACTICE_TRIALS || session.testIsis.length < NUM_TEST_TRIALS) {
        throw new Error('Server did not supply required ISI timing sequence for Reaction Time protocol.');
      }
      setSessionInfo(session);
      setIsPractice(true);
      setTrialIndex(0);
      setPracticeTimes([]);
      setTestTimes([]);
      setFalseStarts(0);
      setLastReaction(0);
      setResultsSummary(null);
      setGameState('practice_intro');
    } catch (e) {
      console.error('Failed to init Reaction Time session:', e);
      setServerError(e.message || 'Server did not supply required ISI timing sequence. Session cannot start.');
      setGameState('error');
    }
  };

  const startNextTrial = () => {
    // Randomize ISI strictly from server-provided timing sequence (no client randomness)
    const isis = isPractice ? sessionInfo?.practiceIsis : sessionInfo?.testIsis;
    const isiMs = isis ? isis[trialIndex] : null;

    if (!isiMs) {
      setServerError('Server did not supply required ISI timing sequence for this trial. Session aborted.');
      setGameState('error');
      return;
    }

    setGameState('waiting');

    timeoutRef.current = setTimeout(() => {
      cueTimeRef.current = performance.now();
      setGameState('ready');
    }, isiMs);
  };

  const handleUserAction = () => {
    if (gameState === 'waiting') {
      // False start! Clicked before stimulus turned green
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

        if (nextIdx >= NUM_PRACTICE_TRIALS) {
          setGameState('practice_finished');
        } else {
          setGameState('trial_result');
        }
      } else {
        const updated = [...testTimes, elapsed];
        setTestTimes(updated);
        const nextIdx = trialIndex + 1;
        setTrialIndex(nextIdx);

        if (nextIdx >= NUM_TEST_TRIALS) {
          finishGame(updated, falseStarts);
        } else {
          setGameState('trial_result');
        }
      }
    }
  };

  const finishGame = async (allTestTimes, totalFalseStarts) => {
    // 1. Separate anticipations (<150ms) and lapses (>1000ms)
    const anticipations = allTestTimes.filter(t => t < 150).length;
    const lapses = allTestTimes.filter(t => t > 1000).length;

    // Filter valid test trials for primary latency/SD calculation (exclude anticipations)
    const validTrials = allTestTimes.filter(t => t >= 150);
    const timesForStats = validTrials.length > 0 ? validTrials : allTestTimes;

    // 2. Mean
    const sum = timesForStats.reduce((a, b) => a + b, 0);
    const mean = Math.round(sum / timesForStats.length);

    // 3. Median
    const sorted = [...timesForStats].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);

    // 4. Standard Deviation (Within-person variability)
    const variance = timesForStats.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / timesForStats.length;
    const stdDev = Math.round(Math.sqrt(variance));

    // 5. Standard score (0-100)
    let baseScore = Math.max(10, Math.min(100, Math.round(135 - (mean * 0.18))));
    const penalty = Math.min((totalFalseStarts * 3) + (lapses * 4), 25);
    const finalScore = Math.max(10, baseScore - penalty);

    // 6. Norm score evaluation
    const scoreReport = await gameService.scoreSession({
      reaction_time_mean_ms: mean,
      reaction_time_sd_ms: stdDev
    });

    const summary = {
      avgReactionTimeMs: mean,
      medianMs: median,
      variabilityMs: stdDev,
      lapses,
      anticipations,
      falseStarts: totalFalseStarts,
      score: finalScore,
      trials: allTestTimes,
      practiceTrials: practiceTimes,
      normZScore: scoreReport?.per_measure_z?.reaction_time_mean_ms
    };

    setResultsSummary(summary);
    setGameState('completed');

    // 7. Save session with device and refresh rate metadata
    await gameService.saveReactionTimeSession({
      ...summary,
      formId: sessionInfo?.formId || 'RT_PROTOCOL_1',
      sessionNumber: sessionInfo?.sessionNumber || 1,
      deviceInfo: deviceInfo || {},
      seed: sessionInfo?.seed
    });
  };

  const currentTotal = isPractice ? NUM_PRACTICE_TRIALS : NUM_TEST_TRIALS;
  const currentCount = isPractice ? practiceTimes.length : testTimes.length;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      <CognitiveConsentModal
        isOpen={consentOpen}
        onConsentGranted={() => {
          setConsentOpen(false);
          initGameSession();
        }}
        onCancel={() => setConsentOpen(false)}
      />

      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <Link
            to="/dashboard/games"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Zap className="h-6 w-6 text-amber-500" />
              Reaction Time & Attention Latency
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {sessionInfo ? `Protocol ${sessionInfo.formId} • Session #${sessionInfo.sessionNumber}` : 'Standardized visual psychomotor latency and attention variability protocol'}
            </p>
          </div>
        </div>

        {deviceInfo && (
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <Monitor className="h-3.5 w-3.5 text-primary-500" />
            <span>Display: {deviceInfo.refreshRateFps} Hz ({deviceInfo.frameDeltaMs}ms)</span>
          </div>
        )}
      </div>

      {/* Mandatory Provisional Norms Disclaimer */}
      <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 flex items-start gap-3">
        <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
          All cognitive screening measures (Word Recall, Image Recall, Reaction Time, and Memory Match) use provisional normative approximations. Screening aid only, not a medical diagnosis.
        </div>
      </div>

      {/* Intro Screen */}
      {gameState === 'intro' && (
        <Card className="p-8">
          <div className="max-w-xl mx-auto text-center space-y-6">
            <div className="h-20 w-20 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-900/50 shadow-sm">
              <Zap className="h-10 w-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                Clinical Visual Stimulus Response Protocol
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Wait for the screen to turn <strong className="text-rose-500">RED</strong>, then as soon as it turns <strong className="text-emerald-500">BRIGHT GREEN</strong>, tap or click as fast as possible.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-left">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
                <Clock className="h-4 w-4 text-primary-500 mx-auto mb-1" />
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">5 Practice + 20 Test</p>
                <p className="text-[10px] text-slate-500">ISI 1000–3000 ms</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
                <Activity className="h-4 w-4 text-teal-500 mx-auto mb-1" />
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Latency & Variability</p>
                <p className="text-[10px] text-slate-500">Mean, Median, SD</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
                <TrendingUp className="h-4 w-4 text-purple-500 mx-auto mb-1" />
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Attentional Lapses</p>
                <p className="text-[10px] text-slate-500">&gt;1000ms &amp; &lt;150ms</p>
              </div>
            </div>

            <button
              onClick={initGameSession}
              className="btn-primary text-base px-8 py-3 w-full sm:w-auto shadow-md"
            >
              Begin Protocol (5 Practice Trials)
            </button>
          </div>
        </Card>
      )}

      {/* Practice Intro Screen */}
      {gameState === 'practice_intro' && (
        <Card className="p-8 text-center space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Practice Phase (5 Trials)
          </span>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
            Familiarization Practice
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto">
            These 5 practice trials are not normed and will not count towards your final assessment latency. Get ready!
          </p>
          <button onClick={startNextTrial} className="btn-primary px-8 py-3">
            Start Practice Trial 1
          </button>
        </Card>
      )}

      {/* Interactive Click Zone (Waiting or Ready) */}
      {(gameState === 'waiting' || gameState === 'ready') && (
        <div
          onClick={handleUserAction}
          className={`h-[400px] rounded-3xl flex flex-col items-center justify-center cursor-pointer select-none transition-colors duration-150 p-6 text-center shadow-lg ${
            gameState === 'ready'
              ? 'bg-emerald-500 text-white animate-pulse'
              : 'bg-rose-500 dark:bg-rose-600 text-white'
          }`}
        >
          <div className="space-y-3">
            <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider bg-black/20 px-3 py-1 rounded-full inline-block">
              {isPractice ? 'Practice' : 'Test'} Trial {trialIndex + 1} of {currentTotal}
            </span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
              {gameState === 'ready' ? '⚡ TAP / CLICK NOW!' : '⏳ WAIT FOR GREEN...'}
            </h2>
            <p className="text-xs sm:text-sm opacity-90 max-w-sm mx-auto">
              {gameState === 'ready'
                ? 'Respond as fast as humanly possible!'
                : 'Do not click yet or an anticipation/false start will be recorded.'}
            </p>
          </div>
        </div>
      )}

      {/* Early Click / Anticipation warning */}
      {gameState === 'early_click' && (
        <div className="h-[400px] rounded-3xl bg-amber-500 text-white flex flex-col items-center justify-center p-6 text-center space-y-4 shadow-lg">
          <AlertTriangle className="h-16 w-16" />
          <h2 className="text-3xl sm:text-4xl font-extrabold">Anticipation / False Start!</h2>
          <p className="text-sm max-w-md opacity-95">
            You clicked before the green stimulus cue appeared. Wait until you visually perceive green.
          </p>
          <button
            onClick={startNextTrial}
            className="px-6 py-3 bg-white text-amber-800 font-bold rounded-xl shadow hover:bg-amber-50"
          >
            Resume Trial
          </button>
        </div>
      )}

      {/* Intermediate trial feedback */}
      {gameState === 'trial_result' && (
        <Card className="p-8 text-center space-y-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {isPractice ? 'Practice' : 'Test'} Trial {currentCount} of {currentTotal}
          </span>
          <div className="text-5xl font-black text-slate-800 dark:text-white">
            {lastReaction} <span className="text-xl font-normal text-slate-500">ms</span>
          </div>
          <p className="text-xs text-slate-500">
            {lastReaction < 250 ? 'Excellent reaction time reflex.' : lastReaction < 380 ? 'Good typical psychomotor latency.' : lastReaction > 1000 ? 'Lapse detected (>1000ms).' : 'Solid trial.'}
          </p>
          <button onClick={startNextTrial} className="btn-primary px-8 py-3">
            Next Trial ({trialIndex + 1}/{currentTotal})
          </button>
        </Card>
      )}

      {/* Practice Complete Screen */}
      {gameState === 'practice_finished' && (
        <Card className="p-8 text-center space-y-6">
          <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 mx-auto flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Practice Phase Complete</h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto">
            You have completed all 5 practice trials. The next 20 trials are official assessment trials used for clinical psychomotor norming.
          </p>
          <button
            onClick={() => {
              setIsPractice(false);
              setTrialIndex(0);
              startNextTrial();
            }}
            className="btn-primary px-8 py-3 text-base shadow-md"
          >
            Begin 20 Test Trials
          </button>
        </Card>
      )}

      {/* Completed Results Screen */}
      {gameState === 'completed' && resultsSummary && (
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2 pb-6 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white">
              Visual Latency Protocol Completed
            </h2>
            <p className="text-xs text-slate-500">
              Session #{sessionInfo?.sessionNumber || 1} • Protocol {sessionInfo?.formId || 'RT_1'} • 20 Normed Trials
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-center">
              <Clock className="h-5 w-5 text-primary-500 mx-auto mb-1" />
              <span className="text-[11px] text-slate-400 uppercase font-bold">Mean Latency</span>
              <p className="text-2xl font-extrabold text-slate-800 dark:text-white">
                {resultsSummary.avgReactionTimeMs} <span className="text-xs font-normal">ms</span>
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-center">
              <Activity className="h-5 w-5 text-teal-500 mx-auto mb-1" />
              <span className="text-[11px] text-slate-400 uppercase font-bold">Median Latency</span>
              <p className="text-2xl font-extrabold text-slate-800 dark:text-white">
                {resultsSummary.medianMs} <span className="text-xs font-normal">ms</span>
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-center">
              <TrendingUp className="h-5 w-5 text-purple-500 mx-auto mb-1" />
              <span className="text-[11px] text-slate-400 uppercase font-bold">Variability (SD)</span>
              <p className="text-2xl font-extrabold text-slate-800 dark:text-white">
                ± {resultsSummary.variabilityMs} <span className="text-xs font-normal">ms</span>
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-center">
              <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-1" />
              <span className="text-[11px] text-slate-400 uppercase font-bold">Lapses &amp; False</span>
              <p className="text-2xl font-extrabold text-slate-800 dark:text-white">
                {resultsSummary.lapses} <span className="text-xs font-normal text-slate-400">/ {resultsSummary.falseStarts}</span>
              </p>
            </div>
          </div>

          {resultsSummary.normZScore !== undefined && (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                NSHD Simple RT Norm z-Score: {resultsSummary.normZScore > 0 ? '+' : ''}{resultsSummary.normZScore} (Provisional)
              </span>
              <p className="text-slate-500 mt-0.5">
                Benchmark: MRC National Survey of Health and Development (Mean: 278.7ms, SD: 42.9ms).
              </p>
            </div>
          )}

          {/* Trial Grid Breakdown */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase text-slate-400">20 Test Trial Latency Sequence</span>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {resultsSummary.trials.map((ms, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded-lg text-center border text-xs font-semibold ${
                    ms > 1000
                      ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/40'
                      : ms < 150
                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/40'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <span className="block text-[9px] text-slate-400">T{idx + 1}</span>
                  {ms}ms
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
            <button onClick={initGameSession} className="btn-outline flex items-center gap-2 text-xs">
              <RotateCcw className="h-4 w-4" /> Start New Rotated Session
            </button>
            <Link to="/dashboard/games" className="btn-primary text-xs px-6 py-2.5">
              Back to Games Hub
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
