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
  Gamepad2
} from 'lucide-react';
import Card from '../../components/Card';
import DisclaimerNote from '../../components/DisclaimerNote';
import { gameService } from '../../services/gameService';

const TOTAL_TRIALS = 8;

export default function ReactionTimeGame() {
  // Game states: 'intro' | 'waiting' | 'ready' | 'trial_result' | 'early_click' | 'completed'
  const [gameState, setGameState] = useState('intro');
  const [currentTrial, setCurrentTrial] = useState(1);
  const [reactionTimes, setReactionTimes] = useState([]);
  const [falseStarts, setFalseStarts] = useState(0);
  const [lastReaction, setLastReaction] = useState(0);
  const [resultsSummary, setResultsSummary] = useState(null);

  const timeoutRef = useRef(null);
  const cueTimeRef = useRef(0);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const startNextTrial = () => {
    setGameState('waiting');

    // Randomized delay between 1500ms and 4200ms
    const randomDelay = Math.floor(Math.random() * 2700) + 1500;

    timeoutRef.current = setTimeout(() => {
      cueTimeRef.current = performance.now();
      setGameState('ready');
    }, randomDelay);
  };

  const handleUserAction = () => {
    if (gameState === 'waiting') {
      // False start! Clicked too early
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setFalseStarts((prev) => prev + 1);
      setGameState('early_click');
    } else if (gameState === 'ready') {
      // Valid reaction
      const clickTime = performance.now();
      const elapsed = Math.round(clickTime - cueTimeRef.current);

      // Guard against client glitch / impossible values
      const validElapsed = Math.max(10, elapsed);

      const updated = [...reactionTimes, validElapsed];
      setReactionTimes(updated);
      setLastReaction(validElapsed);

      if (updated.length >= TOTAL_TRIALS) {
        finishGame(updated, falseStarts);
      } else {
        setGameState('trial_result');
      }
    }
  };

  const finishGame = async (allTimes, totalFalseStarts) => {
    // 1. Calculate Average Reaction Time
    const sum = allTimes.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / allTimes.length);

    // 2. Calculate Variability (Standard Deviation)
    const variance = allTimes.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / allTimes.length;
    const stdDev = Math.round(Math.sqrt(variance));

    // 3. Compute 0-100 score
    // Normal healthy adult visual reaction time is 220ms-350ms
    let baseScore = Math.max(10, Math.min(100, Math.round(135 - (avg * 0.18))));
    const falseStartPenalty = Math.min(totalFalseStarts * 4, 20);
    const finalScore = Math.max(10, baseScore - falseStartPenalty);

    // 4. Non-diagnostic band
    let band = 'Optimal Speed & Focus Band';
    let bandColor = 'text-emerald-600 dark:text-emerald-400';
    let bandBg = 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800';
    let bandDesc = 'Quick stimulus response and consistent attention across repeated trials.';

    if (avg > 480 || totalFalseStarts >= 3) {
      band = 'Extended Latency & Variability Band';
      bandColor = 'text-amber-600 dark:text-amber-400';
      bandBg = 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800';
      bandDesc = 'Extended reaction times or heightened variability noted across trials. Continuing attention exercises and regular tracking advised.';
    } else if (avg > 350) {
      band = 'Typical Processing Speed Band';
      bandColor = 'text-blue-600 dark:text-blue-400';
      bandBg = 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800';
      bandDesc = 'Response latencies within standard cognitive and psychomotor processing parameters.';
    }

    const summary = {
      avgReactionTimeMs: avg,
      variabilityMs: stdDev,
      falseStarts: totalFalseStarts,
      score: finalScore,
      band,
      bandColor,
      bandBg,
      bandDesc,
      trials: allTimes
    };

    setResultsSummary(summary);
    setGameState('completed');

    // Save session
    await gameService.saveReactionTimeSession(summary);
  };

  const handleReset = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setCurrentTrial(1);
    setReactionTimes([]);
    setFalseStarts(0);
    setLastReaction(0);
    setResultsSummary(null);
    setGameState('intro');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Navigation */}
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
              Reaction Time & Attention Test
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Measure visual stimulus response latency, stability, and focus consistency
            </p>
          </div>
        </div>
      </div>

      {/* Persistent Non-Diagnostic Disclaimer */}
      <DisclaimerNote compact />

      {/* Screen 1: Intro */}
      {gameState === 'intro' && (
        <Card className="p-8">
          <div className="max-w-xl mx-auto text-center space-y-6">
            <div className="h-20 w-20 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-900/50 shadow-sm">
              <Zap className="h-10 w-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                Stimulus Response Assessment
              </h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                When the trial starts, the box will turn <strong>red</strong> with a waiting message.
                As soon as it turns <span className="text-emerald-600 font-bold">bright green</span>, click or tap anywhere on the screen as fast as you can!
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-left">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
                <Clock className="h-4 w-4 text-primary-500 mx-auto mb-1" />
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">8 Trials</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Repeated measures</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
                <Activity className="h-4 w-4 text-teal-500 mx-auto mb-1" />
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Latency</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Speed in milliseconds</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
                <TrendingUp className="h-4 w-4 text-purple-500 mx-auto mb-1" />
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Stability</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Variability & attention</p>
              </div>
            </div>

            <button
              onClick={startNextTrial}
              className="btn-primary text-base px-8 py-3 w-full sm:w-auto shadow-md hover:shadow-lg transition-all"
            >
              Start Trial 1 of {TOTAL_TRIALS}
            </button>
          </div>
        </Card>
      )}

      {/* Screen 2: Interactive Click Zone (Waiting or Ready) */}
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
              Trial {reactionTimes.length + 1} of {TOTAL_TRIALS}
            </span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
              {gameState === 'ready' ? '⚡ TAP / CLICK NOW!' : '⏳ WAIT FOR GREEN...'}
            </h2>
            <p className="text-sm sm:text-base opacity-90 max-w-sm mx-auto">
              {gameState === 'ready'
                ? 'Click as quickly as possible!'
                : 'Do not click yet or a false start will be recorded.'}
            </p>
          </div>
        </div>
      )}

      {/* Screen 3: False start warning */}
      {gameState === 'early_click' && (
        <div className="h-[400px] rounded-3xl bg-amber-500 text-white flex flex-col items-center justify-center p-6 text-center space-y-4 shadow-lg">
          <AlertTriangle className="h-16 w-16" />
          <h2 className="text-3xl sm:text-4xl font-extrabold">Too Early!</h2>
          <p className="text-sm sm:text-base max-w-md opacity-95">
            You clicked before the screen turned green. Take a breath and wait for the green cue.
          </p>
          <button
            onClick={startNextTrial}
            className="px-6 py-3 bg-white text-amber-700 font-bold rounded-xl shadow hover:bg-amber-50 transition-colors"
          >
            Try Trial Again
          </button>
        </div>
      )}

      {/* Screen 4: Intermediate trial result */}
      {gameState === 'trial_result' && (
        <Card className="p-8 text-center space-y-6">
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Trial {reactionTimes.length} of {TOTAL_TRIALS} Completed
            </span>
            <div className="text-5xl font-extrabold text-slate-800 dark:text-white">
              {lastReaction} <span className="text-2xl font-normal text-slate-500">ms</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {lastReaction < 280 ? 'Lightning fast reflex!' : lastReaction < 380 ? 'Solid response time.' : 'Good trial.'}
            </p>
          </div>

          {/* Mini progress dots */}
          <div className="flex justify-center items-center gap-2">
            {Array.from({ length: TOTAL_TRIALS }).map((_, i) => (
              <div
                key={i}
                className={`h-3 w-3 rounded-full transition-all ${
                  i < reactionTimes.length
                    ? 'bg-emerald-500 scale-110'
                    : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => {
              setCurrentTrial((prev) => prev + 1);
              startNextTrial();
            }}
            className="btn-primary text-base px-8 py-3 w-full sm:w-auto shadow-md"
          >
            Next Trial ({currentTrial + 1}/{TOTAL_TRIALS})
          </button>
        </Card>
      )}

      {/* Screen 5: Completed / Detailed Results */}
      {gameState === 'completed' && resultsSummary && (
        <div className="space-y-6">
          <Card className="p-6 sm:p-8">
            <div className="space-y-6">
              {/* Header */}
              <div className="text-center space-y-2 pb-6 border-b border-slate-100 dark:border-slate-800">
                <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white">
                  Reaction & Attention Complete
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Visual stimulus responses compiled across all 8 trials
                </p>
              </div>

              {/* Score Banner */}
              <div className={`p-6 rounded-2xl border ${resultsSummary.bandBg} text-center space-y-2`}>
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                  Average Response Latency
                </span>
                <div className="text-5xl font-black text-slate-900 dark:text-white">
                  {resultsSummary.avgReactionTimeMs} <span className="text-2xl font-normal text-slate-500">ms</span>
                </div>
                <div className={`text-base font-bold ${resultsSummary.bandColor}`}>
                  {resultsSummary.band} (Score: {resultsSummary.score}/100)
                </div>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 max-w-lg mx-auto">
                  {resultsSummary.bandDesc}
                </p>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-center">
                  <Clock className="h-5 w-5 text-primary-500 mx-auto mb-1" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">Average Latency</span>
                  <p className="text-xl font-bold text-slate-800 dark:text-white">
                    {resultsSummary.avgReactionTimeMs} ms
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-center">
                  <Activity className="h-5 w-5 text-purple-500 mx-auto mb-1" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">Variability (Std Dev)</span>
                  <p className="text-xl font-bold text-slate-800 dark:text-white">
                    ± {resultsSummary.variabilityMs} ms
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-center">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">Early Clicks</span>
                  <p className="text-xl font-bold text-slate-800 dark:text-white">
                    {resultsSummary.falseStarts}
                  </p>
                </div>
              </div>

              {/* Trial History Bar Chart preview */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Individual Trial Breakdown
                </h4>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {resultsSummary.trials.map((time, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-center border border-slate-200 dark:border-slate-700"
                    >
                      <span className="block text-[10px] text-slate-400 font-medium">T{idx + 1}</span>
                      <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">{time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Full Disclaimer */}
              <DisclaimerNote />

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleReset}
                  className="btn-outline w-full sm:w-auto flex items-center justify-center space-x-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Play Again</span>
                </button>

                <div className="flex space-x-3 w-full sm:w-auto">
                  <Link
                    to="/dashboard/games"
                    className="btn-primary w-full sm:w-auto text-center flex items-center justify-center gap-2"
                  >
                    <Gamepad2 className="h-4 w-4" />
                    <span>Back to Games</span>
                  </Link>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
