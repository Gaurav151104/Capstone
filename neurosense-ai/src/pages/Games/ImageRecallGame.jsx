/* eslint-disable react-hooks/purity */
import React, { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, Play, RotateCcw, ArrowLeft, CheckCircle2, ShieldCheck, Info, LayoutDashboard, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { gameService } from '../../services/gameService';
import { useApp } from '../../hooks/useApp';
import CognitiveConsentModal from '../../components/CognitiveConsentModal';
import { generateConstrainedImageSequence } from '../../utils/cognitivePools';
import { COGNITIVE_ASSESSMENT_CONFIG } from '../../config/cognitiveConfig';

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
  const [recallDurationSec, setRecallDurationSec] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [normZScore, setNormZScore] = useState(null);

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

    const spanConfig = COGNITIVE_ASSESSMENT_CONFIG.imageRecall.difficulties[difficulty] || 
                       COGNITIVE_ASSESSMENT_CONFIG.imageRecall.difficulties.medium;
    const spanLength = spanConfig.spanLength;

    let session = null;
    try {
      session = await gameService.fetchNextSessionItems('Image Recall', { difficulty });
    } catch (e) {
      console.warn('Backend stimuli sync unavailable, generating dynamic visual sequence locally:', e);
    }

    if (!session || !session.sequence || session.sequence.length === 0) {
      session = generateConstrainedImageSequence(spanLength, COGNITIVE_ASSESSMENT_CONFIG.imageRecall.availableChoiceCount || 12);
    }

    setSessionInfo(session);
    const seq = session.sequence || [];
    setSequence(seq);

    const choices = session.availableChoices || session.available_choices || seq;
    setAvailableChoices(choices);

    setCountdown(spanConfig.countdownSeconds || 5);
    setSelectedChoices([]);
    setScore(0);
    setNormZScore(null);
    setGameState('memorizing');
    setIsStarting(false);
  };

  // Exposure phase timer
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
    if (gameState !== 'recalling') return;
    if (selectedChoices.length < sequence.length) {
      setSelectedChoices(prev => [...prev, item]);
    }
  };

  const handleRemoveChoice = (index) => {
    if (gameState !== 'recalling') return;
    setSelectedChoices(prev => prev.filter((_, idx) => idx !== index));
  };

  const submitAnswers = async () => {
    if (gameState !== 'recalling' || hasSavedRef.current) return;
    hasSavedRef.current = true;

    // Check in-order and item-level matches
    let inOrderMatches = 0;
    selectedChoices.forEach((item, idx) => {
      if (idx < sequence.length && item.id === sequence[idx].id) {
        inOrderMatches++;
      }
    });

    const totalSpan = sequence.length || 5;
    const finalScore = Math.round((inOrderMatches / totalSpan) * 100);
    const timeTakenMs = Date.now() - (startTime || Date.now());
    setRecallDurationSec(Math.round(timeTakenMs / 1000));
    setScore(inOrderMatches);
    setGameState('finished');

    const sessionId = sessionInfo?.sessionId || `sess_img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Save session with session ID and metrics
    await gameService.saveGameSession('Image Recall', finalScore, timeTakenMs, {
      sessionId,
      formId: sessionInfo?.formId || `SEQ_${difficulty.toUpperCase()}`,
      sessionNumber: sessionInfo?.sessionNumber || 1,
      itemIds: sequence.map(s => s.name || s.emoji),
      rawResponses: selectedChoices.map(c => c.name || c.emoji),
      seed: sessionInfo?.seed,
      inOrderMatches,
      spanLength: totalSpan,
      difficulty
    });

    // Score against Corsi block tapping normative data
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

      {/* Top Header & Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button 
          onClick={() => navigate('/dashboard/games')}
          className="flex items-center text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-medium text-sm"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> {t.back_to_games || 'Back to Games'}
        </button>

        <span className="text-xs text-slate-400 font-medium">
          Visuospatial Working Memory Forward Span
        </span>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex-shrink-0 mb-4 z-10 transition-colors duration-200">
        <div>
          <h2 className="text-xl font-bold flex items-center text-slate-800 dark:text-white">
            <ImageIcon className="mr-2 h-6 w-6 text-orange-500" /> {t.image_recall || 'Image Recall'}
          </h2>
          <p className="text-xs text-muted">
            {sessionInfo ? `Form ${sessionInfo.formId || 'SEQ'} • Session #${sessionInfo.sessionNumber || 1}` : 'Sequential visuospatial symbol retention and recall'}
          </p>
        </div>
        
        <div className="flex items-center space-x-4 mt-3 sm:mt-0">
          {gameState === 'idle' && (
            <select 
              value={difficulty} 
              onChange={(e) => setDifficulty(e.target.value)}
              disabled={isStarting}
              className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            >
              <option value="easy">{COGNITIVE_ASSESSMENT_CONFIG.imageRecall.difficulties.easy.label}</option>
              <option value="medium">{COGNITIVE_ASSESSMENT_CONFIG.imageRecall.difficulties.medium.label}</option>
              <option value="hard">{COGNITIVE_ASSESSMENT_CONFIG.imageRecall.difficulties.hard.label}</option>
            </select>
          )}

          {gameState === 'memorizing' && (
            <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 px-3 py-1 rounded-lg text-xs font-semibold">
              <span>Memorize Sequence:</span>
              <span className="text-base font-bold">{countdown}s</span>
            </div>
          )}

          {gameState === 'recalling' && (
            <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Selected: <strong className="text-primary-600 dark:text-primary-400">{selectedChoices.length}</strong> of {sequence.length}
            </div>
          )}

          <button 
            onClick={initGameSession} 
            disabled={isStarting || gameState === 'memorizing'}
            className="btn-primary flex items-center py-1.5 px-4 text-xs disabled:opacity-50"
          >
            {gameState !== 'idle' ? <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
            {isStarting ? 'Starting...' : (gameState !== 'idle' ? 'New Sequence' : 'Start Test')}
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 min-h-0 flex items-center justify-center relative">
        {/* State: Idle / Intro */}
        {gameState === 'idle' && (
          <div className="w-full h-full max-h-96 flex flex-col items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center rounded-2xl shadow-sm transition-colors">
            <div className="h-16 w-16 rounded-2xl bg-orange-50 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400 flex items-center justify-center mb-4">
              <ImageIcon className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">
              Visual Sequence Forward Span Test
            </h3>
            <p className="text-muted mt-2 text-xs sm:text-sm max-w-md leading-relaxed">
              You will be shown a randomized sequence of visual symbols for 5 seconds. Remember their exact order, then reconstruct the sequence from the choice pool.
            </p>
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 mt-4 text-xs text-slate-600 dark:text-slate-300 max-w-md flex items-center gap-2 text-left">
              <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
              <span>Drawn from 40 distinct visual symbols with randomized distractors per session.</span>
            </div>
            <button 
              onClick={initGameSession} 
              disabled={isStarting}
              className="btn-primary px-8 py-2.5 mt-6 text-sm flex items-center"
            >
              <Play className="h-4 w-4 mr-2" />
              {isStarting ? 'Preparing...' : 'Begin Assessment'}
            </button>
          </div>
        )}

        {/* State: Memorizing */}
        {gameState === 'memorizing' && (
          <div className="w-full flex flex-col items-center justify-center space-y-6">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Memorize this sequence in order:
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner">
              {sequence.map((item, idx) => (
                <div key={idx} className="flex flex-col items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400">#{idx + 1}</span>
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white dark:bg-slate-800 rounded-2xl border-2 border-orange-300 dark:border-orange-600 flex items-center justify-center text-3xl sm:text-4xl shadow-md animate-in zoom-in-50 duration-300">
                    {item.emoji}
                  </div>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 capitalize">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* State: Recalling */}
        {gameState === 'recalling' && (
          <div className="w-full flex flex-col items-center justify-between space-y-6 max-w-xl">
            {/* Selected Sequence Slots */}
            <div className="w-full bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 text-center">
                Your Recalled Sequence (Click symbol to remove)
              </p>
              <div className="flex items-center justify-center gap-3 min-h-[5rem]">
                {Array.from({ length: sequence.length }).map((_, idx) => {
                  const item = selectedChoices[idx];
                  return (
                    <div 
                      key={idx}
                      onClick={() => item && handleRemoveChoice(idx)}
                      className={`
                        w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center text-2xl sm:text-3xl transition-all relative
                        ${item 
                          ? 'bg-white dark:bg-slate-800 border-2 border-primary-500 shadow-sm cursor-pointer hover:border-rose-400' 
                          : 'border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/20'
                        }
                      `}
                    >
                      {item ? (
                        <>
                          {item.emoji}
                          <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px]">
                            <X className="h-3 w-3" />
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 font-bold">{idx + 1}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Candidate Choices Pool */}
            <div className="w-full">
              <p className="text-xs font-medium text-slate-500 mb-2 text-center">
                Click symbols to place them in sequence:
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
                {availableChoices.map((item, idx) => {
                  const isSelected = selectedChoices.some(c => c.id === item.id);
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={isSelected || selectedChoices.length >= sequence.length}
                      onClick={() => handleSelectSymbol(item)}
                      className={`
                        p-3 rounded-xl border flex flex-col items-center justify-center transition-all select-none
                        ${isSelected 
                          ? 'opacity-30 border-slate-200 dark:border-slate-800 cursor-not-allowed bg-slate-100 dark:bg-slate-800' 
                          : 'bg-white dark:bg-slate-800 hover:border-primary-400 hover:shadow-sm border-slate-200 dark:border-slate-700 cursor-pointer active:scale-95'
                        }
                      `}
                    >
                      <span className="text-2xl sm:text-3xl">{item.emoji}</span>
                      <span className="text-[10px] text-slate-500 mt-1 truncate max-w-full capitalize">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit Action */}
            <button
              onClick={submitAnswers}
              disabled={selectedChoices.length === 0}
              className="btn-primary w-full py-2.5 text-sm disabled:opacity-40"
            >
              Submit Recalled Sequence ({selectedChoices.length}/{sequence.length})
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
            <p className="text-emerald-800 dark:text-emerald-300 text-sm">
              Correctly placed {score} of {sequence.length} items in sequential order in {recallDurationSec}s.
            </p>
            {normZScore !== null && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 font-medium">
                Normative Forward Span z-Score: {normZScore > 0 ? '+' : ''}{normZScore} (Provisional Corsi Approximation)
              </p>
            )}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-3 max-w-md text-center">
              <Info className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span>Provisional screening measure. Responses recorded in your longitudinal progress history.</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
              <button onClick={initGameSession} className="btn-primary px-6 py-2 text-xs flex items-center">
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Try Next Rotated Session
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
