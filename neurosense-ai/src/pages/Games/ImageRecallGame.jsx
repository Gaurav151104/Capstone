import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Play, RotateCcw, ArrowLeft, CheckCircle2, ShieldCheck, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { gameService } from '../../services/gameService';
import { useApp } from '../../hooks/useApp';
import CognitiveConsentModal from '../../components/CognitiveConsentModal';
import { generateImageSequence } from '../../utils/cognitivePools';

export default function ImageRecallGame() {
  const { t } = useApp();
  const navigate = useNavigate();

  // States: 'idle' | 'memorizing' | 'recalling' | 'finished'
  const [gameState, setGameState] = useState('idle');
  const [difficulty, setDifficulty] = useState('medium'); // easy: 4, medium: 5, hard: 6
  const [sessionInfo, setSessionInfo] = useState(null);
  const [sequence, setSequence] = useState([]);
  const [selectedChoices, setSelectedChoices] = useState([]);
  const [availableChoices, setAvailableChoices] = useState([]);
  const [countdown, setCountdown] = useState(5);
  const [score, setScore] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [normZScore, setNormZScore] = useState(null);

  const initGameSession = async () => {
    try {
      const hasConsent = await gameService.getServerConsent();
      if (!hasConsent) {
        setConsentOpen(true);
        return;
      }
    } catch (e) {
      // Continue if offline
    }

    const spanLength = difficulty === 'easy' ? 4 : (difficulty === 'hard' ? 6 : 5);
    let session = null;

    try {
      session = await gameService.fetchNextSessionItems('Image Recall', { difficulty });
    } catch (e) {
      console.warn('Backend Image Recall sync unavailable, generating local randomized sequence:', e);
    }

    if (!session || !session.sequence || session.sequence.length === 0) {
      session = generateImageSequence(spanLength, 12);
    }

    setSessionInfo(session);
    const seq = session.sequence || [];
    setSequence(seq);
    
    // Available choices with distractors
    const choices = session.availableChoices || session.available_choices || (session.sessionSubset ? session.sessionSubset : seq);
    setAvailableChoices(choices);

    setCountdown(seq.length <= 4 ? 4 : (seq.length >= 6 ? 7 : 5));
    setSelectedChoices([]);
    setScore(0);
    setGameState('memorizing');
  };

  useEffect(() => {
    let timer;
    if (gameState === 'memorizing') {
      if (countdown > 0) {
        timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      } else {
        setGameState('recalling');
        setStartTime(Date.now());
      }
    }
    return () => clearTimeout(timer);
  }, [countdown, gameState]);

  const handleSelectSymbol = (item) => {
    if (selectedChoices.length < sequence.length) {
      setSelectedChoices(prev => [...prev, item]);
    }
  };

  const handleRemoveChoice = (index) => {
    setSelectedChoices(prev => prev.filter((_, idx) => idx !== index));
  };

  const submitAnswers = async () => {
    if (gameState !== 'recalling') return;

    // Check in-order and item-level matches
    let inOrderMatches = 0;
    selectedChoices.forEach((item, idx) => {
      if (idx < sequence.length && item.id === sequence[idx].id) {
        inOrderMatches++;
      }
    });

    const totalSpan = sequence.length;
    const finalScore = Math.round((inOrderMatches / totalSpan) * 100);
    setScore(inOrderMatches);
    setGameState('finished');

    const timeTaken = Date.now() - (startTime || Date.now());

    // Save session items and form ID
    gameService.saveGameSession('Image Recall', finalScore, timeTaken, {
      formId: sessionInfo?.formId || `SEQ_${difficulty.toUpperCase()}`,
      sessionNumber: sessionInfo?.sessionNumber || 1,
      itemIds: sequence.map(s => s.name),
      seed: sessionInfo?.seed,
      inOrderMatches,
      spanLength: totalSpan
    });

    // Score against Corsi block tapping normative data (forward span)
    const normReport = await gameService.scoreSession({
      image_recall_forward_span: inOrderMatches
    });

    if (normReport?.per_measure_z?.image_recall_forward_span !== undefined) {
      setNormZScore(normReport.per_measure_z.image_recall_forward_span);
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

      <button 
        onClick={() => navigate('/dashboard/games')}
        className="flex items-center text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors mb-6 font-medium w-fit"
      >
        <ArrowLeft className="h-4 w-4 mr-2" /> {t.back_to_games || 'Back to Games'}
      </button>

      <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex-shrink-0 mb-4 z-10 transition-colors">
        <div>
          <h2 className="text-xl font-bold flex items-center text-slate-800 dark:text-white">
            <ImageIcon className="mr-2 h-6 w-6 text-orange-500" /> Image & Symbol Recall
          </h2>
          <p className="text-xs text-muted">
            {sessionInfo ? `Form ${sessionInfo.formId} • Session #${sessionInfo.sessionNumber}` : 'Constrained random visual sequences from 24 psychometric symbols'}
          </p>
        </div>
        
        <div className="flex items-center space-x-3 mt-2 sm:mt-0">
          {gameState === 'idle' && (
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-xs font-semibold outline-none"
            >
              <option value="easy">Easy (4 symbols)</option>
              <option value="medium">Standard (5 symbols)</option>
              <option value="hard">Hard (6 symbols)</option>
            </select>
          )}

          <button 
            onClick={initGameSession} 
            className="btn-primary flex items-center py-1.5 px-4 text-xs"
            disabled={gameState === 'memorizing'}
          >
            {gameState === 'idle' ? <Play className="h-3.5 w-3.5 mr-1.5" /> : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
            {gameState === 'idle' ? 'Start Test' : 'New Sequence'}
          </button>
        </div>
      </div>

      {/* Provisional Norms Notice */}
      <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 rounded-xl p-3.5 flex items-center text-xs font-medium shadow-sm mb-4">
        <Info className="h-4 w-4 mr-2.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <p>All cognitive screening measures (Word Recall, Image Recall, Reaction Time, and Memory Match) use provisional normative approximations. Screening aid only, not a medical diagnosis.</p>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-6 overflow-y-auto transition-colors">
        {gameState === 'idle' && (
          <div className="text-center max-w-md animate-in zoom-in-95 duration-300">
            <ImageIcon className="h-16 w-16 text-orange-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Visuospatial Span Challenge</h3>
            <p className="text-muted text-sm mb-4 leading-relaxed">
              Study the randomized symbol sequence without immediate repeats or adjacent runs. Then recall the items in their exact order of presentation.
            </p>
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 mb-6">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Dynamic 24-symbol pool • Unique sequence per session
            </div>
            <button onClick={initGameSession} className="btn-primary px-8 text-base">
              Begin Assessment
            </button>
          </div>
        )}

        {gameState === 'memorizing' && (
          <div className="w-full flex flex-col items-center animate-in fade-in duration-300">
            <span className="text-xs uppercase font-bold tracking-widest text-orange-600 dark:text-orange-400 mb-2">
              Memorize In Order
            </span>
            <div className="w-14 h-14 rounded-full border-4 border-orange-100 dark:border-orange-900/30 flex items-center justify-center mb-6 shadow-sm relative">
              <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">{countdown}</span>
            </div>
            
            <div className="flex justify-center gap-3 sm:gap-4 flex-wrap max-w-xl">
              {sequence.map((img, i) => (
                <div key={i} className="aspect-square w-20 sm:w-24 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border-2 border-orange-200 dark:border-orange-800 flex flex-col items-center justify-center shadow-md animate-in zoom-in-95">
                  <span className="text-4xl sm:text-5xl mb-1">{img.emoji}</span>
                  <span className="text-[10px] uppercase font-bold text-slate-400">#{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {gameState === 'recalling' && (
          <div className="w-full max-w-xl flex flex-col items-center animate-in slide-in-from-right-4 duration-300">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Select Symbols In Order</h3>
            <p className="text-xs text-muted mb-4">Click symbols below to fill slots 1 through {sequence.length}</p>

            {/* Target Slots */}
            <div className="flex justify-center gap-2 mb-6 w-full">
              {Array.from({ length: sequence.length }).map((_, idx) => {
                const filled = selectedChoices[idx];
                return (
                  <div
                    key={idx}
                    onClick={() => filled && handleRemoveChoice(idx)}
                    className={`aspect-square w-16 sm:w-20 rounded-xl border-2 flex flex-col items-center justify-center transition-all cursor-pointer ${
                      filled
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30 shadow-sm'
                        : 'border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30'
                    }`}
                  >
                    {filled ? (
                      <>
                        <span className="text-3xl">{filled.emoji}</span>
                        <span className="text-[9px] font-bold text-orange-600 dark:text-orange-400 uppercase">
                          Slot {idx + 1}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400 font-semibold">{idx + 1}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Candidate options palette */}
            <div className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 mb-6">
              <span className="text-xs uppercase font-bold text-slate-500 block mb-3 text-center">
                Available Symbols
              </span>
              <div className="flex justify-center gap-3 flex-wrap">
                {availableChoices.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectSymbol(item)}
                    disabled={selectedChoices.length >= sequence.length}
                    className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-orange-400 dark:hover:border-orange-500 hover:scale-105 transition-all text-3xl shadow-sm disabled:opacity-40"
                  >
                    {item.emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between w-full items-center">
              <button 
                onClick={() => setSelectedChoices([])} 
                className="text-xs text-slate-500 hover:underline"
              >
                Clear all
              </button>
              <button
                onClick={submitAnswers}
                disabled={selectedChoices.length === 0}
                className="btn-primary py-2.5 px-6 text-sm bg-orange-500 hover:bg-orange-600 disabled:opacity-40"
              >
                Submit Answers ({selectedChoices.length}/{sequence.length})
              </button>
            </div>
          </div>
        )}

        {gameState === 'finished' && (
          <div className="text-center animate-in zoom-in-95 duration-300 max-w-md">
            <div className="inline-flex h-20 w-20 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border-4 border-emerald-100 dark:border-emerald-900/40 items-center justify-center mb-4 shadow-sm">
              <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {score}/{sequence.length}
              </span>
            </div>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">
              Visual Span Assessment Complete
            </h3>
            <p className="text-xs text-muted mb-4">
              Session #{sessionInfo?.sessionNumber || 1} • Sequence Form {sessionInfo?.formId || 'SEQ_1'}
            </p>

            {normZScore !== null && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs mb-6">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  Corsi Standardized Norm z-Score: {normZScore > 0 ? '+' : ''}{normZScore}
                </span>
                <p className="text-slate-500 mt-0.5">
                  Mobile Corsi Block Tapping Norm (Ham et al., 2026: Mean 5.16, SD 1.17)
                </p>
              </div>
            )}

            <button onClick={initGameSession} className="btn-primary px-8 text-sm">
              Start Next Rotated Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
