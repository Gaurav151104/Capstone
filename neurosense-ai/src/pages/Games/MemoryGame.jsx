/* eslint-disable react-hooks/purity */
import React, { useState } from 'react';
import { Gamepad2, Play, RotateCcw, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { gameService } from '../../services/gameService';
import { useApp } from '../../hooks/useApp';

const ALL_CARDS = ['🧠', '🧬', '💊', '🩺', '🔬', '🏥', '🚑', '👨‍⚕️', '🍎', '🚗'];

export default function MemoryGame() {
  const { t } = useApp();
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [solved, setSolved] = useState([]);
  const [moves, setMoves] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [won, setWon] = useState(false);
  const [startTime, setStartTime] = useState(null);
  
  // Grid size selection: 'small' = 4x3 (12 cards/6 pairs), 'large' = 4x4 (16 cards/8 pairs)
  const [gridSize, setGridSize] = useState('small'); 

  const generateCards = (size) => {
    const pairCount = size === 'small' ? 6 : 8;
    const selectedEmojis = ALL_CARDS.slice(0, pairCount);
    const duplicated = [...selectedEmojis, ...selectedEmojis];
    return duplicated.sort(() => Math.random() - 0.5).map((emoji, index) => ({ id: index, emoji }));
  };

  const startGame = () => {
    setCards(generateCards(gridSize));
    setFlipped([]);
    setSolved([]);
    setMoves(0);
    setIsPlaying(true);
    setWon(false);
    setStartTime(Date.now());
  };

  const handleCardClick = (index) => {
    if (!isPlaying || flipped.length >= 2 || flipped.includes(index) || solved.includes(index)) return;

    if (flipped.length === 1) {
      const firstIndex = flipped[0];
      setFlipped([firstIndex, index]);
      const currentMoves = moves + 1;
      setMoves(currentMoves);

      const match = cards[firstIndex].emoji === cards[index].emoji;
      if (match) {
        const nextSolved = [...solved, firstIndex, index];
        setSolved(nextSolved);
        setFlipped([]);
        if (nextSolved.length === cards.length && nextSolved.length > 0) {
          setWon(true);
          setIsPlaying(false);
          const timeTakenMs = Date.now() - startTime;
          const finalScore = Math.max(100 - (currentMoves * 2), 10);
          gameService.saveGameSession(`${t.memory_match} (${gridSize === 'small' ? '4x3' : '4x4'})`, finalScore, timeTakenMs);
        }
      } else {
        setTimeout(() => {
          setFlipped([]);
        }, 1000);
      }
    } else {
      setFlipped([index]);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto overflow-hidden animate-in fade-in duration-500">
      <button 
        onClick={() => navigate('/dashboard/games')}
        className="flex items-center text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors mb-6 font-medium w-fit"
      >
        <ArrowLeft className="h-4 w-4 mr-2" /> {t.back_to_games}
      </button>
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex-shrink-0 mb-4 z-10 transition-colors duration-200">
        <div>
          <h2 className="text-xl font-bold flex items-center text-slate-800 dark:text-white">
            <Gamepad2 className="mr-2 h-6 w-6 text-primary-600 dark:text-primary-400" /> {t.memory_match}
          </h2>
          <p className="text-sm text-muted hidden sm:block">{t.find_matching_pairs}</p>
        </div>
        
        <div className="flex items-center space-x-4 mt-2 sm:mt-0">
          {!isPlaying && !won && (
            <select 
              value={gridSize} 
              onChange={(e) => setGridSize(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            >
              <option value="small">{t.grid_small}</option>
              <option value="large">{t.grid_large}</option>
            </select>
          )}

          {isPlaying && (
            <div className="text-right">
              <p className="text-xs text-muted font-medium">{t.moves.toUpperCase()}</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white leading-none">{moves}</p>
            </div>
          )}

          <button 
            onClick={startGame} 
            className="btn-primary flex items-center py-1.5 px-4 text-sm"
          >
            {isPlaying || won ? <RotateCcw className="h-4 w-4 mr-1.5" /> : <Play className="h-4 w-4 mr-1.5" />}
            {isPlaying || won ? t.restart : t.start}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center relative">
        {!isPlaying && !won && (
           <div className="w-full h-full max-h-72 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 p-6 text-center rounded-2xl transition-colors">
              <Gamepad2 className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
              <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">{t.test_your_memory}</h3>
              <p className="text-muted mt-2 text-sm max-w-sm">
                {t.memory_game_instr}
              </p>
           </div>
        )}

        {won && (
           <div className="w-full h-full max-h-72 flex flex-col items-center justify-center bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border-2 border-emerald-100 dark:border-emerald-900/30 p-6 text-center transition-colors">
              <h3 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mb-2">{t.excellent_work}</h3>
              <p className="text-emerald-600 dark:text-emerald-300">{t.completed_in_moves.replace('{moves}', moves)}</p>
              <p className="text-emerald-500 dark:text-emerald-500/70 text-sm mt-1">{t.saved_to_profile}</p>
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