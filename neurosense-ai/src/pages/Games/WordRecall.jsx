/* eslint-disable react-hooks/purity */
import React, { useState, useEffect, useRef } from 'react';
import { Brain, Play, RotateCcw, Check, X, ArrowLeft, Clock, ShieldCheck, Info, CheckCircle2, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { gameService } from '../../services/gameService';
import { useApp } from '../../hooks/useApp';
import CognitiveConsentModal from '../../components/CognitiveConsentModal';
import { selectWordForm, generateDynamicWordList } from '../../utils/cognitivePools';
import { COGNITIVE_ASSESSMENT_CONFIG } from '../../config/cognitiveConfig';

export default function WordRecall() {
  const { t } = useApp();
  const navigate = useNavigate();

  // States: 'idle' | 'showing' | 'immediate_recall' | 'distractor_phase' | 'delayed_recall' | 'finished'
  const [gameState, setGameState] = useState('idle');
  const [sessionInfo, setSessionInfo] = useState(null);
  const [wordsToShow, setWordsToShow] = useState([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [immediateRecalled, setImmediateRecalled] = useState([]);
  const [delayedRecalled, setDelayedRecalled] = useState([]);
  const [distractorCountdown, setDistractorCountdown] = useState(15);
  const [distractorAnswer, setDistractorAnswer] = useState('');
  const [distractorMath, setDistractorMath] = useState({ a: 100, b: 7 });
  const [startTime, setStartTime] = useState(null);
  const [recallDurationSec, setRecallDurationSec] = useState(0);
  const [inputFeedback, setInputFeedback] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [normResults, setNormResults] = useState(null);
  const [finalScores, setFinalScores] = useState({ immediateCorrect: 0, delayedCorrect: 0, compositeScore: 0 });

  const hasSavedRef = useRef(false);

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
        session = await gameService.fetchNextSessionItems('Word Recall', {
          count: COGNITIVE_ASSESSMENT_CONFIG.wordRecall.presentationCount
        });
      } catch (e) {
        console.warn('Backend stimuli sync unavailable, selecting randomized form locally:', e);
      }

      if (!session || !session.words || session.words.length === 0) {
        session = selectWordForm([], COGNITIVE_ASSESSMENT_CONFIG.wordRecall.presentationCount);
      }

      setSessionInfo(session);
      setWordsToShow(session.words || []);
      setCurrentWordIndex(0);
      setImmediateRecalled([]);
      setDelayedRecalled([]);
      setUserInput('');
      setInputFeedback('');
      setNormResults(null);

      // Random math subtraction for distractor task (e.g. 100 - 7 = 93)
      setDistractorMath({
        a: 80 + Math.floor(Math.random() * 20),
        b: 3 + Math.floor(Math.random() * 5)
      });
      setDistractorAnswer('');

      setGameState('showing');
    } catch (e) {
      console.error('Failed to initialize Word Recall session:', e);
    } finally {
      setIsStarting(false);
    }
  };

  // Timer for displaying words sequentially (2.0 seconds per word)
  useEffect(() => {
    let timer;
    if (gameState === 'showing' && wordsToShow.length > 0) {
      const exposureMs = COGNITIVE_ASSESSMENT_CONFIG.wordRecall.exposureDurationPerWordMs || 2000;
      timer = setTimeout(() => {
        if (currentWordIndex < wordsToShow.length - 1) {
          setCurrentWordIndex(prev => prev + 1);
        } else {
          setGameState('immediate_recall');
          setStartTime(Date.now());
        }
      }, exposureMs);
    }
    return () => clearTimeout(timer);
  }, [gameState, currentWordIndex, wordsToShow.length]);

  // Distractor interference countdown (15s)
  useEffect(() => {
    let timer;
    if (gameState === 'distractor_phase') {
      if (distractorCountdown > 0) {
        timer = setTimeout(() => setDistractorCountdown(c => c - 1), 1000);
      } else {
        setGameState('delayed_recall');
        setStartTime(Date.now());
      }
    }
    return () => clearTimeout(timer);
  }, [gameState, distractorCountdown]);

  const handleImmediateSubmit = (e) => {
    e.preventDefault();
    const clean = userInput.trim().toUpperCase();
    if (!clean) return;

    if (immediateRecalled.includes(clean)) {
      setInputFeedback(`"${clean}" was already entered.`);
      setTimeout(() => setInputFeedback(''), 1800);
      setUserInput('');
      return;
    }

    const updated = [...immediateRecalled, clean];
    setImmediateRecalled(updated);
    setUserInput('');
    setInputFeedback('');

    if (updated.length >= wordsToShow.length) {
      startDistractorPhase();
    }
  };

  const startDistractorPhase = () => {
    setDistractorCountdown(COGNITIVE_ASSESSMENT_CONFIG.wordRecall.distractorDurationSeconds || 15);
    setGameState('distractor_phase');
  };

  const handleDelayedSubmit = (e) => {
    e.preventDefault();
    const clean = userInput.trim().toUpperCase();
    if (!clean) return;

    if (delayedRecalled.includes(clean)) {
      setInputFeedback(`"${clean}" was already entered.`);
      setTimeout(() => setInputFeedback(''), 1800);
      setUserInput('');
      return;
    }

    const updated = [...delayedRecalled, clean];
    setDelayedRecalled(updated);
    setUserInput('');
    setInputFeedback('');

    if (updated.length >= wordsToShow.length) {
      finishBothPhases(immediateRecalled, updated);
    }
  };

  const finishBothPhases = async (finalImmediate = immediateRecalled, finalDelayed = delayedRecalled) => {
    if (hasSavedRef.current) return;
    hasSavedRef.current = true;

    setGameState('finished');

    let immediateCorrect = 0;
    wordsToShow.forEach(w => {
      if (finalImmediate.includes(w)) immediateCorrect++;
    });

    let delayedCorrect = 0;
    wordsToShow.forEach(w => {
      if (finalDelayed.includes(w)) delayedCorrect++;
    });

    const totalWords = wordsToShow.length || 10;
    const immediateProp = immediateCorrect / totalWords;
    const delayedProp = delayedCorrect / totalWords;
    const compositeScore = Math.round(((immediateProp * 0.4) + (delayedProp * 0.6)) * 100);

    const timeTakenMs = Date.now() - (startTime || Date.now());
    setRecallDurationSec(Math.round(timeTakenMs / 1000));
    setFinalScores({ immediateCorrect, delayedCorrect, compositeScore });

    const sessionId = sessionInfo?.sessionId || `sess_wr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Save session to server and local storage
    await gameService.saveGameSession('Word Recall', compositeScore, timeTakenMs, {
      sessionId,
      formId: sessionInfo?.formId || 'FORM_A',
      sessionNumber: sessionInfo?.sessionNumber || 1,
      itemIds: wordsToShow,
      rawResponses: {
        immediateRecalled: finalImmediate,
        delayedRecalled: finalDelayed
      },
      immediateCorrect,
      delayedCorrect,
      totalWords,
      seed: sessionInfo?.seed
    });

    // Score against normative distributions
    const normReport = await gameService.scoreSession({
      word_recall_immediate_count: immediateCorrect,
      word_recall_immediate_total: totalWords,
      word_recall_delayed_count: delayedCorrect,
      word_recall_delayed_total: totalWords
    });

    if (normReport) {
      setNormResults(normReport);
    }
  };

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
          <ArrowLeft className="h-4 w-4 mr-2" /> {t.back_to_games || 'Back to Games'}
        </button>

        <span className="text-xs text-slate-400 font-medium">
          Verbal Episodic Memory & Delayed Recall
        </span>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex-shrink-0 mb-4 z-10 transition-colors duration-200">
        <div>
          <h2 className="text-xl font-bold flex items-center text-slate-800 dark:text-white">
            <Brain className="mr-2 h-6 w-6 text-purple-600 dark:text-purple-400" /> {t.word_recall || 'Word Recall'}
          </h2>
          <p className="text-xs text-muted">
            {sessionInfo ? `${sessionInfo.formName || sessionInfo.formId} • Session #${sessionInfo.sessionNumber || 1}` : 'Standardized 10-word verbal retention and delayed recall protocol'}
          </p>
        </div>
        
        <div className="flex items-center space-x-3 mt-3 sm:mt-0">
          {gameState === 'showing' && (
            <div className="text-xs font-semibold px-3 py-1 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 rounded-lg">
              Word {currentWordIndex + 1} of {wordsToShow.length}
            </div>
          )}

          {gameState === 'immediate_recall' && (
            <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg">
              Immediate Recall ({immediateRecalled.length}/{wordsToShow.length})
            </span>
          )}

          {gameState === 'distractor_phase' && (
            <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-lg">
              Interference Phase: {distractorCountdown}s
            </span>
          )}

          {gameState === 'delayed_recall' && (
            <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-lg">
              Delayed Recall ({delayedRecalled.length}/{wordsToShow.length})
            </span>
          )}

          <button 
            onClick={initGameSession} 
            disabled={isStarting || gameState === 'showing'}
            className="btn-primary flex items-center py-1.5 px-4 text-xs disabled:opacity-50"
          >
            {gameState !== 'idle' ? <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
            {isStarting ? 'Starting...' : (gameState !== 'idle' ? 'New Word List' : 'Start Test')}
          </button>
        </div>
      </div>

      {/* Main Stage */}
      <div className="flex-1 min-h-0 flex items-center justify-center relative">
        {/* State: Idle / Intro */}
        {gameState === 'idle' && (
          <div className="w-full h-full max-h-96 flex flex-col items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center rounded-2xl shadow-sm transition-colors">
            <div className="h-16 w-16 rounded-2xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4">
              <Brain className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">
              Verbal List-Learning & Delayed Recall
            </h3>
            <p className="text-muted mt-2 text-xs sm:text-sm max-w-md leading-relaxed">
              10 words will be shown on screen one by one. Read each word carefully. After presentation, enter all words you remember, complete a short mental distractor task, and recall the words again.
            </p>
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 mt-4 text-xs text-slate-600 dark:text-slate-300 max-w-md flex items-center gap-2 text-left">
              <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
              <span>Rotates 8 matched parallel forms (Forms A-H) across sessions to prevent repeated list familiarity.</span>
            </div>
            <button 
              onClick={initGameSession} 
              disabled={isStarting}
              className="btn-primary px-8 py-2.5 mt-6 text-sm flex items-center"
            >
              <Play className="h-4 w-4 mr-2" />
              {isStarting ? 'Preparing Session...' : 'Begin Assessment'}
            </button>
          </div>
        )}

        {/* State: Showing Words */}
        {gameState === 'showing' && wordsToShow.length > 0 && (
          <div className="w-full flex flex-col items-center justify-center space-y-6">
            <span className="text-xs uppercase font-bold tracking-widest text-slate-400">
              Word {currentWordIndex + 1} of {wordsToShow.length}
            </span>
            <div className="w-72 h-36 bg-gradient-to-br from-purple-50 to-white dark:from-slate-900 dark:to-slate-800 rounded-3xl border-2 border-purple-200 dark:border-purple-800/80 shadow-lg flex items-center justify-center">
              <span className="text-4xl font-extrabold tracking-wider text-purple-700 dark:text-purple-300 animate-in zoom-in-75 duration-300 select-none">
                {wordsToShow[currentWordIndex]}
              </span>
            </div>
            <p className="text-xs text-slate-500">Read and remember this word</p>
          </div>
        )}

        {/* State: Immediate Recall */}
        {gameState === 'immediate_recall' && (
          <div className="w-full max-w-md flex flex-col items-center space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Immediate Word Recall</h3>
              <p className="text-xs text-muted">Type the words you remember from the list (order does not matter):</p>
            </div>

            <form onSubmit={handleImmediateSubmit} className="w-full flex gap-2">
              <input 
                type="text" 
                value={userInput} 
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Type a word and press Enter..."
                autoFocus
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium uppercase outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button type="submit" className="btn-primary py-2.5 px-5 text-sm">Add</button>
            </form>

            {inputFeedback && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">{inputFeedback}</p>
            )}

            {/* Recalled Badges */}
            <div className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 min-h-[5rem] flex flex-wrap gap-2 items-start">
              {immediateRecalled.length === 0 ? (
                <span className="text-xs text-slate-400 italic">No words entered yet. Type above to add.</span>
              ) : (
                immediateRecalled.map((word, idx) => (
                  <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200">
                    {word}
                  </span>
                ))
              )}
            </div>

            <button 
              onClick={startDistractorPhase}
              className="btn-outline w-full py-2 text-xs font-semibold mt-2"
            >
              Done with Immediate Recall ({immediateRecalled.length} entered) → Proceed
            </button>
          </div>
        )}

        {/* State: Distractor Interference Task */}
        {gameState === 'distractor_phase' && (
          <div className="w-full max-w-md flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
            <Clock className="h-8 w-8 text-amber-500 animate-pulse" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Interference Distractor Phase</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              To test delayed memory consolidation, calculate this simple mental subtraction:
            </p>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 py-2">
              {distractorMath.a} - {distractorMath.b} = ?
            </div>
            <input 
              type="text" 
              value={distractorAnswer}
              onChange={(e) => setDistractorAnswer(e.target.value)}
              placeholder="Mental check answer..."
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-center text-sm font-bold w-48 outline-none"
            />
            <p className="text-xs font-semibold text-slate-500">
              Continuing to delayed recall in: <span className="text-amber-600 font-bold">{distractorCountdown}s</span>
            </p>
            <button
              onClick={() => {
                setGameState('delayed_recall');
                setStartTime(Date.now());
              }}
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline pt-2 font-medium"
            >
              Skip countdown →
            </button>
          </div>
        )}

        {/* State: Delayed Recall */}
        {gameState === 'delayed_recall' && (
          <div className="w-full max-w-md flex flex-col items-center space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Delayed Word Recall</h3>
              <p className="text-xs text-muted">Without looking back, enter all words you remember from the initial list:</p>
            </div>

            <form onSubmit={handleDelayedSubmit} className="w-full flex gap-2">
              <input 
                type="text" 
                value={userInput} 
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Type a word and press Enter..."
                autoFocus
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium uppercase outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button type="submit" className="btn-primary py-2.5 px-5 text-sm bg-emerald-600 hover:bg-emerald-700">Add</button>
            </form>

            {inputFeedback && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">{inputFeedback}</p>
            )}

            {/* Recalled Badges */}
            <div className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 min-h-[5rem] flex flex-wrap gap-2 items-start">
              {delayedRecalled.length === 0 ? (
                <span className="text-xs text-slate-400 italic">No words entered yet. Type above to add.</span>
              ) : (
                delayedRecalled.map((word, idx) => (
                  <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200">
                    {word}
                  </span>
                ))
              )}
            </div>

            <button 
              onClick={() => finishBothPhases(immediateRecalled, delayedRecalled)}
              className="btn-primary w-full py-2.5 text-sm bg-emerald-600 hover:bg-emerald-700"
            >
              Complete Assessment ({delayedRecalled.length} words entered)
            </button>
          </div>
        )}

        {/* State: Finished */}
        {gameState === 'finished' && (
          <div className="w-full h-full max-h-96 flex flex-col items-center justify-center bg-emerald-50/70 dark:bg-emerald-950/20 rounded-2xl border-2 border-emerald-100 dark:border-emerald-900/40 p-6 text-center transition-colors">
            <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mb-1">
              Assessment Completed!
            </h3>
            
            <div className="grid grid-cols-2 gap-4 my-3 max-w-xs w-full">
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-muted uppercase font-bold">Immediate Recall</span>
                <p className="text-lg font-extrabold text-slate-800 dark:text-white">
                  {finalScores.immediateCorrect} / {wordsToShow.length}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-muted uppercase font-bold">Delayed Recall</span>
                <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                  {finalScores.delayedCorrect} / {wordsToShow.length}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              Composite Verbal Retention Score: <strong>{finalScores.compositeScore}%</strong> in {recallDurationSec}s
            </p>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-3 max-w-md text-center">
              <Info className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span>Provisional verbal memory screening metric. Session saved to your cognitive history.</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
              <button onClick={initGameSession} className="btn-primary px-6 py-2 text-xs flex items-center">
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Play Next Rotated Session
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