/* eslint-disable react-hooks/purity */
import React, { useState, useRef } from 'react';
import { Gamepad2, Play, RotateCcw, ArrowLeft, ShieldCheck, Info, CheckCircle2, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { gameService } from '../../services/gameService';
import { useApp } from '../../hooks/useApp';
import CognitiveConsentModal from '../../components/CognitiveConsentModal';
import { generateMemoryMatchCards } from '../../utils/cognitivePools';
import { COGNITIVE_ASSESSMENT_CONFIG } from '../../config/cognitiveConfig';

export default function MemoryGame() {
  const { t } = useApp();
  const navigate = useNavigate();

  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [solved, setSolved] = useState([]);
  const [moves, setMoves] = useState(0);
  const [errors, setErrors] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [won, setWon] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTimeSec, setElapsedTimeSec] = useState(0);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [gridSize, setGridSize] = useState('small'); // 'small' = 4x3 (6 pairs), 'large' = 4x4 (8 pairs)
  const [normZScore, setNormZScore] = useState(null);
  const [consentOpen, setConsentOpen] = useState(false);

  const hasSavedRef = useRef(false);
  const timerIntervalRef = useRef(null);

  const startGame = async () => {
    if (isStarting) return;
    setIsStarting(true);
    hasSavedRef.current = false;

    // Check consent status (server + local cache)
    const hasConsent = await gameService.getServerConsent();
    if (!hasConsent) {
      setConsentOpen(true);
      setIsStarting(false);
      return;
    }

    try {
      const isLarge = gridSize === 'large';
      const pairCount = isLarge ? 8 : 6;
      let session = null;

      try {
        session = await gameService.fetchNextSessionItems('Memory Match', { gridSize, pairCount });
      } catch (err) {
        console.warn('Backend stimuli unavailable, generating randomized cards locally:', err);
      }

      // Fallback to dynamic local generator if server payload is empty or invalid
      if (!session || !session.cards || session.cards.length === 0) {
        session = generateMemoryMatchCards(pairCount);
        session.gridSize = gridSize;
      }

      setSessionInfo(session);
      setCards(session.cards || []);
      setFlipped([]);
      setSolved([]);
      setMoves(0);
      setErrors(0);
      setWon(false);
      setNormZScore(null);
      setIsPlaying(true);

      const now = Date.now();
      setStartTime(now);
      setElapsedTimeSec(0);

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setElapsedTimeSec(Math.round((Date.now() - now) / 1000));
      }, 1000);

    } catch (e) {
      console.error('Failed to start Memory Match session:', e);
    } finally {
      setIsStarting(false);
    }
  };

  const handleCardClick = (index) => {
    if (!isPlaying || flipped.length >= 2 || flipped.includes(index) || solved.includes(index)) return;

    if (flipped.length === 1) {
      const firstIndex = flipped[0];
      setFlipped([firstIndex, index]);
      const currentMoves = moves + 1;
      setMoves(currentMoves);

      const match = cards[firstIndex].pairId === cards[index].pairId;
      if (match) {
        const nextSolved = [...solved, firstIndex, index];
        setSolved(nextSolved);
        setFlipped([]);

        if (nextSolved.length === cards.length && nextSolved.length > 0) {
          handleVictory(currentMoves, errors);
        }
      } else {
        const nextErrors = errors + 1;
        setErrors(nextErrors);
        setTimeout(() => {
          setFlipped([]);
        }, COGNITIVE_ASSESSMENT_CONFIG.memoryMatch.cardFlipDelayMs || 900);
      }
    } else {
      setFlipped([index]);
    }
  };

  const handleVictory = async (finalMoves, finalErrors) => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setWon(true);
    setIsPlaying(false);

    if (hasSavedRef.current) return;
    hasSavedRef.current = true;

    const timeTakenMs = Date.now() - (startTime || Date.now());
    const finalScore = Math.max(10, Math.min(100, 100 - (finalErrors * 5)));
    const gameTitle = `Memory Match (${gridSize === 'small' ? '4x3' : '4x4'})`;

    // Persist session with unique session identifier
    const sessionId = sessionInfo?.sessionId || `sess_mm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await gameService.saveGameSession(gameTitle, finalScore, timeTakenMs, {
      sessionId,
      formId: sessionInfo?.formId || `GRID_${gridSize.toUpperCase()}`,
      sessionNumber: sessionInfo?.sessionNumber || 1,
      errors: finalErrors,
      moves: finalMoves,
      itemIds: sessionInfo?.selectedIcons || [],
      seed: sessionInfo?.seed,
      gridSize
    });

    // Score against log1p-transformed normative distribution
    const normReport = await gameService.scoreSession({
      memory_match_errors: finalErrors
    });

    if (normReport?.per_measure_z?.memory_match_errors !== undefined) {
      setNormZScore(normReport.per_measure_z.memory_match_errors);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto overflow-hidden animate-in fade-in duration-500">
      <CognitiveConsentModal
        isOpen={consentOpen}
        onConsentGranted={() => {
          setConsentOpen(false);
          startGame();
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
          Evidence-Based Paired Associate Matching
        </span>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex-shrink-0 mb-4 z-10 transition-colors duration-200">
        <div>
          <h2 className="text-xl font-bold flex items-center text-slate-800 dark:text-white">
            <Gamepad2 className="mr-2 h-6 w-6 text-primary-600 dark:text-primary-400" /> {t.memory_match || 'Memory Match'}
          </h2>
          <p className="text-xs text-muted">
            {sessionInfo ? `Form ${sessionInfo.formId} • Session #${sessionInfo.sessionNumber || 1}` : 'Cryptographically randomized pair matching drawn from 48 distinct icons'}
          </p>
        </div>
        
        <div className="flex items-center space-x-4 mt-3 sm:mt-0">
          {!isPlaying && !won && (
            <select 
              value={gridSize} 
              onChange={(e) => setGridSize(e.target.value)}
              disabled={isStarting}
              className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            >
              <option value="small">{COGNITIVE_ASSESSMENT_CONFIG.memoryMatch.grids.small.label}</option>
              <option value="large">{COGNITIVE_ASSESSMENT_CONFIG.memoryMatch.grids.large.label}</option>
            </select>
          )}

          {isPlaying && (
            <div className="flex items-center space-x-4 text-right">
              <div>
                <p className="text-[10px] text-muted font-bold uppercase">Time</p>
                <p className="text-base font-bold text-slate-700 dark:text-slate-200 leading-none">{elapsedTimeSec}s</p>
              </div>
              <div>
                <p className="text-[10px] text-muted font-bold uppercase">Errors</p>
                <p className="text-base font-bold text-rose-600 dark:text-rose-400 leading-none">{errors}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted font-bold uppercase">Moves</p>
                <p className="text-base font-bold text-slate-800 dark:text-white leading-none">{moves}</p>
              </div>
            </div>
          )}

          <button 
            onClick={startGame} 
            disabled={isStarting}
            className="btn-primary flex items-center py-1.5 px-4 text-xs disabled:opacity-50"
          >
            {isPlaying || won ? <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
            {isStarting ? 'Loading...' : (isPlaying || won ? (t.restart || 'New Session') : (t.start || 'Start Game'))}
          </button>
        </div>
      </div>

      {/* Main Playing Area */}
      <div className="flex-1 min-h-0 flex items-center justify-center relative">
        {/* Intro Screen */}
        {!isPlaying && !won && (
          <div className="w-full h-full max-h-96 flex flex-col items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center rounded-2xl shadow-sm transition-colors">
            <div className="h-16 w-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
              <Gamepad2 className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">
              Short-Term Working Memory Pairs
            </h3>
            <p className="text-muted mt-2 text-xs sm:text-sm max-w-md leading-relaxed">
              Uncover matching card pairs by flipping two cards at a time. Minimize mismatches and complete the grid in as few moves as possible.
            </p>
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 mt-4 text-xs text-slate-600 dark:text-slate-300 max-w-md flex items-center gap-2 text-left">
              <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
              <span>Drawn dynamically from 48 distinct symbols with cryptographic shuffling. Every session presents novel pairings.</span>
            </div>
            <button 
              onClick={startGame} 
              disabled={isStarting}
              className="btn-primary px-8 py-2.5 mt-6 text-sm flex items-center"
            >
              <Play className="h-4 w-4 mr-2" />
              {isStarting ? 'Preparing Session...' : 'Begin Assessment'}
            </button>
          </div>
        )}

        {/* Completion Screen */}
        {won && (
          <div className="w-full h-full max-h-96 flex flex-col items-center justify-center bg-emerald-50/70 dark:bg-emerald-950/20 rounded-2xl border-2 border-emerald-100 dark:border-emerald-900/40 p-6 text-center transition-colors">
            <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mb-1">
              Assessment Completed!
            </h3>
            <p className="text-emerald-800 dark:text-emerald-300 text-sm">
              Completed in {elapsedTimeSec} seconds with {moves} moves and {errors} error mismatch{errors === 1 ? '' : 'es'}.
            </p>
            {normZScore !== null && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 font-medium">
                Normative Error z-Score: {normZScore > 0 ? '+' : ''}{normZScore} (Provisional Approximation)
              </p>
            )}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-3 max-w-md text-center">
              <Info className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span>Provisional normative screening measure. Session results saved to your clinical history.</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
              <button onClick={startGame} className="btn-primary px-6 py-2 text-xs flex items-center">
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

        {/* Active Game Cards Grid */}
        {isPlaying && (
          <div className={`grid w-full h-full p-2 gap-2 sm:gap-3 
            ${gridSize === 'small' ? 'grid-cols-4 grid-rows-3' : 'grid-cols-4 grid-rows-4'}`}
          >
            {cards.map((card, index) => {
              const isFlipped = flipped.includes(index) || solved.includes(index);
              const isSolvedCard = solved.includes(index);

              return (
                <button
                  type="button"
                  key={card.id || index}
                  onClick={() => handleCardClick(index)}
                  disabled={isSolvedCard || flipped.length >= 2}
                  className={`
                    transition-all duration-200 transform rounded-xl flex items-center justify-center text-3xl sm:text-4xl select-none
                    ${isSolvedCard 
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-700 opacity-90' 
                      : isFlipped 
                        ? 'bg-white dark:bg-slate-800 shadow-md border-2 border-primary-500' 
                        : 'bg-primary-500 hover:bg-primary-600 dark:bg-primary-600 dark:hover:bg-primary-500 shadow-sm cursor-pointer'
                    }
                  `}
                >
                  {isFlipped ? card.emoji : ''}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}