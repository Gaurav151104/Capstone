import React, { useState, useEffect } from 'react';
import { Brain, Play, RotateCcw, Check, X, ArrowLeft, Clock, ShieldCheck, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { gameService } from '../../services/gameService';
import { useApp } from '../../hooks/useApp';
import CognitiveConsentModal from '../../components/CognitiveConsentModal';

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
  const [distractorUserInput, setDistractorUserInput] = useState('');
  const [distractorRecalled, setDistractorRecractor] = useState([]);
  const [distractorCountdown, setDistractorCountdown] = useState(15);
  const [startTime, setStartTime] = useState(null);
  const [normResults, setNormResults] = useState(null);
  const [consentOpen, setConsentOpen] = useState(false);

  const initGameSession = async () => {
    // Check consent on server
    const hasConsent = await gameService.getServerConsent();
    if (!hasConsent) {
      setConsentOpen(true);
      return;
    }

    try {
      const session = await gameService.fetchNextSessionItems('Word Recall');
      setSessionInfo(session);
      setWordsToShow(session.words || []);
      setGameState('showing');
      setCurrentWordIndex(0);
      setImmediateRecalled([]);
      setDelayedRecalled([]);
      setDistractorRecractor([]);
      setUserInput('');
      setStartTime(Date.now());
    } catch (e) {
      console.error('Failed to initialize session:', e);
    }
  };

  // Timer for displaying words sequentially (1.8 seconds per word)
  useEffect(() => {
    let timer;
    if (gameState === 'showing') {
      timer = setTimeout(() => {
        if (currentWordIndex < wordsToShow.length - 1) {
          setCurrentWordIndex(prev => prev + 1);
        } else {
          setGameState('immediate_recall');
          setStartTime(Date.now());
        }
      }, 1800);
    }
    return () => clearTimeout(timer);
  }, [gameState, currentWordIndex, wordsToShow.length]);

  // Timer for distractor interference interval (15s count down)
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

    if (!immediateRecalled.includes(clean)) {
      const updated = [...immediateRecalled, clean];
      setImmediateRecalled(updated);
      if (updated.length >= wordsToShow.length) {
        startDistractorPhase(updated);
      }
    }
    setUserInput('');
  };

  const startDistractorPhase = (immRecalled = immediateRecalled) => {
    setDistractorCountdown(15);
    setGameState('distractor_phase');
  };

  const handleDelayedSubmit = (e) => {
    e.preventDefault();
    const clean = userInput.trim().toUpperCase();
    if (!clean) return;

    if (!delayedRecalled.includes(clean)) {
      const updated = [...delayedRecalled, clean];
      setDelayedRecalled(updated);
      if (updated.length >= wordsToShow.length) {
        finishBothPhases(immediateRecalled, updated);
      }
    }
    setUserInput('');
  };

  const finishBothPhases = async (finalImmediate = immediateRecalled, finalDelayed = delayedRecalled) => {
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

    const timeTaken = Date.now() - (startTime || Date.now());

    // Save session with form_id and session_number
    gameService.saveGameSession('Word Recall', compositeScore, timeTaken, {
      formId: sessionInfo?.formId || 'FORM_A',
      sessionNumber: sessionInfo?.sessionNumber || 1,
      itemIds: wordsToShow,
      seed: sessionInfo?.seed,
      immediateRecalled: finalImmediate,
      delayedRecalled: finalDelayed,
      immediateCorrect,
      delayedCorrect
    });

    // Score against clinical norms
    const scoreReport = await gameService.scoreSession({
      word_recall_immediate_count: immediateCorrect,
      word_recall_immediate_total: totalWords,
      word_recall_delayed_count: delayedCorrect,
      word_recall_delayed_total: totalWords
    });

    if (scoreReport) {
      setNormResults(scoreReport);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <CognitiveConsentModal
        isOpen={consentOpen}
        onConsentGranted={() => {
          setConsentOpen(false);
          initGameSession();
        }}
        onCancel={() => setConsentOpen(false)}
      />

      <button 
        onClick={() => navigate('/dashboard/games')}
        className="flex items-center text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-medium w-fit"
      >
        <ArrowLeft className="h-4 w-4 mr-2" /> {t.back_to_games || 'Back to Games'}
      </button>

      <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
        <div>
          <h2 className="text-xl font-bold flex items-center text-slate-800 dark:text-white">
            <Brain className="mr-2 h-6 w-6 text-purple-600 dark:text-purple-400" /> 
            Verbal Word Recall (Immediate + Delayed)
          </h2>
          <p className="text-sm text-muted">
            {sessionInfo ? `Form ${sessionInfo.formId} • Session #${sessionInfo.sessionNumber}` : 'Standardized 10-word verbal encoding and delayed retrieval test'}
          </p>
        </div>
        <button 
          onClick={initGameSession} 
          className="btn-primary flex items-center mt-4 sm:mt-0 px-6"
          disabled={gameState === 'showing' || gameState === 'distractor_phase'}
        >
          {gameState === 'idle' ? <Play className="h-4 w-4 mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
          {gameState === 'idle' ? (t.begin_test || 'Begin Test') : (t.restart || 'New Session')}
        </button>
      </div>

      {/* Provisional Norms Notice */}
      <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 rounded-xl p-3.5 flex items-center text-xs font-medium shadow-sm mb-4">
        <Info className="h-4 w-4 mr-2.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <p>All cognitive screening measures (Word Recall, Image Recall, Reaction Time, and Memory Match) use provisional normative approximations. Screening aid only, not a medical diagnosis.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[420px] flex flex-col transition-colors">
        {gameState === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900/50">
            <Brain className="h-16 w-16 text-purple-500 dark:text-purple-400 mb-4" />
            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">
              Immediate & Delayed Verbal Memory Test
            </h3>
            <p className="text-muted mt-2 max-w-lg leading-relaxed">
              You will view 10 matched words presented sequentially. First, you will recall as many as you can immediately. After a brief distractor challenge, you will be asked to recall them again.
            </p>
            <div className="flex items-center gap-2 mt-4 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              8 Parallel Matched Forms • Zero consecutive form repeats
            </div>
            <button onClick={initGameSession} className="btn-primary px-8 mt-6">
              Start Assessment
            </button>
          </div>
        )}

        {gameState === 'showing' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-purple-50 dark:bg-purple-900/20 transition-colors">
            <span className="text-xs uppercase font-bold tracking-widest text-purple-600 dark:text-purple-400 mb-4">
              Memorize Word {currentWordIndex + 1} of {wordsToShow.length}
            </span>
            <h1 className="text-5xl md:text-7xl font-black text-purple-900 dark:text-purple-200 tracking-wider animate-in zoom-in-90 duration-200">
              {wordsToShow[currentWordIndex]}
            </h1>
            <div className="mt-12 flex space-x-1.5">
              {wordsToShow.map((_, i) => (
                <div 
                  key={i} 
                  className={`h-2 rounded-full transition-all duration-300 ${i === currentWordIndex ? 'bg-purple-600 dark:bg-purple-400 w-8' : 'bg-purple-200 dark:bg-purple-800 w-4'}`} 
                />
              ))}
            </div>
          </div>
        )}

        {gameState === 'immediate_recall' && (
          <div className="flex-1 flex flex-col p-8 bg-white dark:bg-slate-900 animate-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-center mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Phase 1 of 2</span>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Immediate Recall</h3>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-semibold">
                {immediateRecalled.length} / {wordsToShow.length} recalled
              </span>
            </div>
            <p className="text-muted text-sm mb-6">Type any words you remember from the list and press Enter.</p>
            
            <form onSubmit={handleImmediateSubmit} className="flex gap-4 mb-6">
              <input 
                type="text" 
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                className="flex-1 px-4 py-3 border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl focus:border-purple-500 outline-none text-lg uppercase text-slate-800 dark:text-white transition-all"
                placeholder="Type word and press Enter..."
                autoFocus
              />
              <button type="submit" className="btn-primary px-8">Submit</button>
            </form>

            <div className="flex flex-wrap gap-2.5">
              {immediateRecalled.map((word, i) => (
                <div key={i} className="px-4 py-2 bg-purple-50 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 font-semibold rounded-xl border border-purple-200 dark:border-purple-800">
                  {word}
                </div>
              ))}
            </div>

            <div className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <span className="text-xs text-muted">Order does not matter</span>
              <button onClick={() => startDistractorPhase()} className="btn-outline text-xs px-4 py-2">
                Continue to Distractor Phase →
              </button>
            </div>
          </div>
        )}

        {gameState === 'distractor_phase' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-amber-50/50 dark:bg-amber-950/20 text-center animate-in fade-in duration-300">
            <Clock className="h-12 w-12 text-amber-500 mb-3 animate-spin" />
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Interference Distractor Phase</h3>
            <p className="text-muted text-sm max-w-md mt-1">
              Count down mentally or read the distractor words below to clear working memory before testing delayed retrieval.
            </p>
            <div className="text-4xl font-black text-amber-600 dark:text-amber-400 my-4">
              {distractorCountdown}s
            </div>
            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-900/50 max-w-sm w-full">
              <span className="text-xs uppercase font-bold text-slate-400 block mb-2">Unrelated Distractors</span>
              <div className="flex justify-center gap-2 flex-wrap">
                {(sessionInfo?.distractorWords || ['LEMON', 'TRUCK', 'CABIN', 'OCEAN', 'FLOUR']).map((w, idx) => (
                  <span key={idx} className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-xs rounded text-slate-700 dark:text-slate-300">
                    {w}
                  </span>
                ))}
              </div>
            </div>
            <button 
              onClick={() => {
                setGameState('delayed_recall');
                setStartTime(Date.now());
              }} 
              className="mt-6 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline"
            >
              Skip countdown
            </button>
          </div>
        )}

        {gameState === 'delayed_recall' && (
          <div className="flex-1 flex flex-col p-8 bg-white dark:bg-slate-900 animate-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-center mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Phase 2 of 2</span>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Delayed Recall</h3>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 font-semibold">
                {delayedRecalled.length} / {wordsToShow.length} recalled
              </span>
            </div>
            <p className="text-muted text-sm mb-6">Type the words from the ORIGINAL 10-word list that you can still remember.</p>
            
            <form onSubmit={handleDelayedSubmit} className="flex gap-4 mb-6">
              <input 
                type="text" 
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                className="flex-1 px-4 py-3 border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl focus:border-rose-500 outline-none text-lg uppercase text-slate-800 dark:text-white transition-all"
                placeholder="Type word and press Enter..."
                autoFocus
              />
              <button type="submit" className="btn-primary px-8 bg-rose-600 hover:bg-rose-700">Submit</button>
            </form>

            <div className="flex flex-wrap gap-2.5">
              {delayedRecalled.map((word, i) => (
                <div key={i} className="px-4 py-2 bg-rose-50 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200 font-semibold rounded-xl border border-rose-200 dark:border-rose-800">
                  {word}
                </div>
              ))}
            </div>

            <div className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <span className="text-xs text-muted">Do not include distractor words</span>
              <button onClick={() => finishBothPhases()} className="btn-primary text-xs px-5 py-2.5">
                Complete Assessment →
              </button>
            </div>
          </div>
        )}

        {gameState === 'finished' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900 animate-in zoom-in-95 duration-300">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Verbal Recall Assessment Complete</h3>
            <p className="text-xs text-muted mb-6">
              Session #{sessionInfo?.sessionNumber || 1} • Parallel Form {sessionInfo?.formId || 'A'}
            </p>

            <div className="grid grid-cols-2 gap-4 w-full max-w-md mb-6">
              <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                <span className="text-xs text-muted uppercase font-bold block mb-1">Immediate Recall</span>
                <span className="text-3xl font-extrabold text-purple-600 dark:text-purple-400">
                  {wordsToShow.filter(w => immediateRecalled.includes(w)).length} / {wordsToShow.length}
                </span>
                {normResults?.per_measure_z?.word_recall_immediate !== undefined && (
                  <span className="block text-[11px] text-slate-500 mt-1">
                    z-score: {normResults.per_measure_z.word_recall_immediate > 0 ? '+' : ''}{normResults.per_measure_z.word_recall_immediate}
                  </span>
                )}
              </div>

              <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                <span className="text-xs text-muted uppercase font-bold block mb-1">Delayed Recall</span>
                <span className="text-3xl font-extrabold text-rose-600 dark:text-rose-400">
                  {wordsToShow.filter(w => delayedRecalled.includes(w)).length} / {wordsToShow.length}
                </span>
                {normResults?.per_measure_z?.word_recall_delayed !== undefined && (
                  <span className="block text-[11px] text-slate-500 mt-1">
                    z-score: {normResults.per_measure_z.word_recall_delayed > 0 ? '+' : ''}{normResults.per_measure_z.word_recall_delayed}
                  </span>
                )}
              </div>
            </div>

            <div className="w-full max-w-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-700 mb-6">
              {wordsToShow.map((word, i) => {
                const inImm = immediateRecalled.includes(word);
                const inDel = delayedRecalled.includes(word);
                return (
                  <div key={i} className="px-4 py-2.5 flex justify-between items-center text-sm">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{word}</span>
                    <div className="flex gap-4 text-xs font-medium">
                      <span className={inImm ? 'text-emerald-600 flex items-center gap-1' : 'text-slate-400 flex items-center gap-1'}>
                        {inImm ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />} Imm
                      </span>
                      <span className={inDel ? 'text-emerald-600 flex items-center gap-1' : 'text-slate-400 flex items-center gap-1'}>
                        {inDel ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />} Del
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={initGameSession} className="btn-primary px-8">
              Start Next Rotated Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
}