/* eslint-disable react-hooks/purity */
import React, { useState } from 'react';
import { Gamepad2, Play, RotateCcw, ArrowLeft, ShieldCheck, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { gameService } from '../../services/gameService';
import { useApp } from '../../hooks/useApp';
import CognitiveConsentModal from '../../components/CognitiveConsentModal';

export default function MemoryGame() {
  const { t } = useApp();
  const navigate = useNavigate();

  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [solved, setSolved] = useState([]);
  const [moves, setMoves] = useState(0);
  const [errors, setErrors] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [won, setWon] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [gridSize, setGridSize] = useState('small'); // 'small' = 4x3 (6 pairs), 'large' = 4x4 (8 pairs)
  const [normZScore, setNormZScore] = useState(null);
  const [consentOpen, setConsentOpen] = useState(false);

  const startGame = async () => {
    const hasConsent = await gameService.getServerConsent();
    if (!hasConsent) {
      setConsentOpen(true);
      return;
    }

    try {
      const session = await gameService.fetchNextSessionItems('Memory Match', { gridSize });
      setSessionInfo(session);
      setCards(session.cards || []);
      setFlipped([]);
      setSolved([]);
      setMoves(0);
      setErrors(0);
      setIsPlaying(true);
      setWon(false);
      setNormZScore(null);
      setStartTime(Date.now());
    } catch (e) {
      console.error('Failed to start Memory Match session:', e);
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
        setErrors(prev => prev + 1);
        setTimeout(() => {
          setFlipped([]);
        }, 1000);
      }
    } else {
      setFlipped([index]);
    }
  };

  const handleVictory = async (finalMoves, finalErrors) => {
    setWon(true);
    setIsPlaying(false);
    const timeTakenMs = Date.now() - (startTime || Date.now());

    // Score based on moves efficiency
    const finalScore = Math.max(10, Math.min(100, 100 - (finalErrors * 6)));
    const gameTitle = `${t.memory_match || 'Memory Match'} (${gridSize === 'small' ? '4x3' : '4x4'})`;

    // Save session with session_number, form_id, and errors
    gameService.saveGameSession(gameTitle, finalScore, timeTakenMs, {
      formId: sessionInfo?.formId || `GRID_${gridSize.toUpperCase()}`,
      sessionNumber: sessionInfo?.sessionNumber || 1,
      errors: finalErrors,
      moves: finalMoves,
      itemIds: sessionInfo?.selectedIcons || [],
      seed: sessionInfo?.seed
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

      <button 
        onClick={() => navigate('/dashboard/games')}
        className="flex items-center text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors mb-6 font-medium w-fit"
      >
        <ArrowLeft className="h-4 w-4 mr-2" /> {t.back_to_games || 'Back to Games'}
      </button>

      <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex-shrink-0 mb-4 z-10 transition-colors duration-200">
        <div>
          <h2 className="text-xl font-bold flex items-center text-slate-800 dark:text-white">
            <Gamepad2 className="mr-2 h-6 w-6 text-primary-600 dark:text-primary-400" /> {t.memory_match || 'Memory Match'}
          </h2>
          <p className="text-xs text-muted">
            {sessionInfo ? `Form ${sessionInfo.formId} • Session #${sessionInfo.sessionNumber}` : 'Cryptographically shuffled pair matching drawn from 36 distinct icons'}
          </p>
        </div>
        
        <div className="flex items-center space-x-4 mt-2 sm:mt-0">
          {!isPlaying && !won && (
            <select 
              value={gridSize} 
              onChange={(e) => setGridSize(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            >
              <option value="small">{t.grid_small || 'Small (4x3 - 6 pairs)'}</option>
              <option value="large">{t.grid_large || 'Standard (4x4 - 8 pairs)'}</option>
            </select>
          )}

          {isPlaying && (
            <div className="flex items-center space-x-4 text-right">
              <div>
                <p className="text-[10px] text-muted font-bold uppercase">Errors</p>
                <p className="text-lg font-bold text-rose-600 dark:text-rose-400 leading-none">{errors}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted font-bold uppercase">Moves</p>
                <p className="text-lg font-bold text-slate-800 dark:text-white leading-none">{moves}</p>
              </div>
            </div>
          )}

          <button 
            onClick={startGame} 
            className="btn-primary flex items-center py-1.5 px-4 text-xs"
          >
            {isPlaying || won ? <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
            {isPlaying || won ? (t.restart || 'New Subset') : (t.start || 'Start Game')}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center relative">
        {!isPlaying && !won && (
          <div className="w-full h-full max-h-80 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 p-6 text-center rounded-2xl transition-colors">
            <Gamepad2 className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">
              Short-Term Working Memory Pairs
            </h3>
            <p className="text-muted mt-2 text-xs max-w-sm leading-relaxed">
              Drawn from a pool of 36 distinct symbols and shuffled with crypto-grade Fisher-Yates. Uncover matching pairs with minimal errors.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-4">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Provisional UK Biobank norms with log1p error adjustment
            </div>
            <button onClick={startGame} className="btn-primary px-8 mt-4 text-sm">
              Begin Assessment
            </button>
          </div>
        )}

        {won && (
          <div className="w-full h-full max-h-80 flex flex-col items-center justify-center bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border-2 border-emerald-100 dark:border-emerald-900/40 p-6 text-center transition-colors">
            <h3 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mb-1">
              Assessment Completed!
            </h3>
            <p className="text-emerald-800 dark:text-emerald-300 text-sm">
              Completed in {moves} moves with {errors} error mismatch{errors === 1 ? '' : 'es'}.
            </p>
            {normZScore !== null && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 font-medium">
                Normative log1p Error z-Score: {normZScore > 0 ? '+' : ''}{normZScore} (Provisional)
              </p>
            )}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-3">
              <Info className="h-3.5 w-3.5 text-amber-500" />
              All cognitive screening measures (Word Recall, Image Recall, Reaction Time, and Memory Match) use provisional normative approximations. Screening aid only, not a medical diagnosis.
            </div>
            <button onClick={startGame} className="btn-primary px-8 mt-4 text-xs">
              Play Next Rotated Session
            </button>
          </div>
        )}

        {isPlaying && (
          <div className={`grid w-full h-full p-2 gap-2 sm:gap-3 
            ${gridSize === 'small' ? 'grid-cols-4 grid-rows-3' : 'grid-cols-4 grid-rows-4'}`}
          >
            {cards.map((card, index) => {
              const isFlipped = flipped.includes(index) || solved.includes(index);
              return (
                <div 
                  key={card.id}
                  onClick={() => handleCardClick(index)}
                  className={`
                    cursor-pointer transition-all duration-300 transform perspective-1000 w-full h-full min-h-0
                    ${isFlipped ? 'rotate-y-180 bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700' : 'bg-primary-500 hover:bg-primary-600 shadow-sm rounded-xl'} 
                    flex items-center justify-center text-3xl sm:text-4xl rounded-xl
                  `}
                >
                  {isFlipped ? card.emoji : ''}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}