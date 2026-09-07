import React, { useState, useEffect } from 'react';
import { Brain, Play, RotateCcw, Check, X, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { gameService } from '../../services/gameService';
import { useApp } from '../../hooks/useApp';

const WORDS = [
  'APPLE', 'TRAIN', 'HOUSE', 'RIVER', 'BREAD', 
  'CLOUD', 'CHAIR', 'SMILE', 'CLOCK', 'BLOOM'
];

export default function WordRecall() {
  const { t } = useApp();
  const navigate = useNavigate();
  const [gameState, setGameState] = useState('idle'); // idle, showing, typing, finished
  const [wordsToShow, setWordsToShow] = useState([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [recalledWords, setRecalledWords] = useState([]);
  const [score, setScore] = useState(0);
  const [startTime, setStartTime] = useState(null);

  const startGame = () => {
    // Select 5 random words
    const shuffled = [...WORDS].sort(() => 0.5 - Math.random());
    setWordsToShow(shuffled.slice(0, 5));
    setGameState('showing');
    setCurrentWordIndex(0);
    setRecalledWords([]);
    setScore(0);
    setUserInput('');
  };

  useEffect(() => {
    let timer;
    if (gameState === 'showing') {
      timer = setTimeout(() => {
        if (currentWordIndex < wordsToShow.length - 1) {
          setCurrentWordIndex(prev => prev + 1);
        } else {
          setGameState('typing');
          setStartTime(Date.now());
        }
      }, 2000); // Show each word for 2 seconds
    }
    return () => clearTimeout(timer);
  }, [gameState, currentWordIndex, wordsToShow.length]);

  const handleSubmitWord = (e) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    const word = userInput.trim().toUpperCase();
    if (!recalledWords.includes(word)) {
      setRecalledWords(prev => [...prev, word]);
    }
    setUserInput('');
    
    // Check if finished (user submitted 5 words or clicked finish)
    if (recalledWords.length === 4) { // this is the 5th word
      finishGame([...recalledWords, word]);
    }
  };

  const finishGame = (finalWords = recalledWords) => {
    setGameState('finished');
    let correct = 0;
    finalWords.forEach(w => {
      if (wordsToShow.includes(w)) correct++;
    });
    setScore(correct);
    
    // Save metric
    const timeTaken = Date.now() - startTime;
    gameService.saveGameSession(t.word_recall, correct * 20, timeTaken);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <button 
        onClick={() => navigate('/dashboard/games')}
        className="flex items-center text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-medium w-fit"
      >
        <ArrowLeft className="h-4 w-4 mr-2" /> {t.back_to_games}
      </button>
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
        <div>
          <h2 className="text-xl font-bold flex items-center text-slate-800 dark:text-white">
            <Brain className="mr-2 h-6 w-6 text-purple-600 dark:text-purple-400" /> {t.word_recall_test}
          </h2>
          <p className="text-sm text-muted">{t.word_recall_sub}</p>
        </div>
        <button 
          onClick={startGame} 
          className="btn-primary flex items-center mt-4 sm:mt-0 px-6"
          disabled={gameState === 'showing'}
        >
          {gameState === 'idle' ? <Play className="h-4 w-4 mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
          {gameState === 'idle' ? t.begin_test : t.restart}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-96 flex flex-col transition-colors">
        {gameState === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900/50">
            <Brain className="h-16 w-16 text-slate-300 dark:text-slate-700 mb-4" />
            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">{t.short_term_linguistic}</h3>
            <p className="text-muted mt-2 max-w-md">
              {t.word_recall_instr}
            </p>
          </div>
        )}

        {gameState === 'showing' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-purple-50 dark:bg-purple-900/20 transition-colors">
            <p className="text-purple-500 dark:text-purple-400 font-medium tracking-widest mb-8 uppercase text-sm">{t.memorize_this_word}</p>
            <h1 className="text-5xl md:text-7xl font-bold text-purple-900 dark:text-purple-300 tracking-wider">
              {wordsToShow[currentWordIndex]}
            </h1>
            <div className="mt-12 flex space-x-2">
              {wordsToShow.map((_, i) => (
                <div key={i} className={`h-2 w-8 rounded-full transition-all duration-300 ${i === currentWordIndex ? 'bg-purple-600 dark:bg-purple-500 w-12' : 'bg-purple-200 dark:bg-purple-900'}`} />
              ))}
            </div>
          </div>
        )}

        {gameState === 'typing' && (
          <div className="flex-1 flex flex-col p-8 bg-white dark:bg-slate-900 animate-in slide-in-from-right-4 duration-300">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{t.recall_words}</h3>
            <p className="text-muted mb-6">{t.recall_words_instr}</p>
            
            <form onSubmit={handleSubmitWord} className="flex gap-4 mb-8">
              <input 
                type="text" 
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                className="flex-1 px-4 py-3 border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl focus:border-purple-500 outline-none text-lg uppercase text-slate-800 dark:text-white transition-all"
                placeholder={t.type_word_placeholder}
                autoFocus
              />
              <button type="submit" className="btn-primary px-8">{t.sign_in === 'Sign In' ? 'Submit' : 'सबमिट करा'}</button>
            </form>

            <div className="flex flex-wrap gap-3">
              {recalledWords.map((word, i) => (
                <div key={i} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg font-medium text-slate-700 dark:text-slate-200 tracking-wide border border-slate-200 dark:border-slate-700 animate-in zoom-in-75">
                  {word}
                </div>
              ))}
            </div>
            
            <div className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
               <span className="text-muted">{recalledWords.length} / 5 {t.words_entered}</span>
               <button onClick={() => finishGame()} className="text-purple-600 dark:text-purple-400 font-semibold hover:underline">{t.cant_remember}</button>
            </div>
          </div>
        )}

        {gameState === 'finished' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900 animate-in zoom-in-95 duration-300">
            <div className="h-24 w-24 rounded-full bg-white dark:bg-slate-800 border-4 border-purple-100 dark:border-purple-900/30 flex items-center justify-center mb-6 shadow-sm">
              <span className="text-4xl font-bold text-purple-600 dark:text-purple-400">{score}<span className="text-xl text-purple-400/60 dark:text-purple-500/40">/5</span></span>
            </div>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">{t.test_complete}</h3>
            
            <div className="w-full max-w-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-700 mb-8 transition-colors">
              {wordsToShow.map((word, i) => {
                const found = recalledWords.includes(word);
                return (
                  <div key={i} className="px-6 py-4 flex justify-between items-center">
                    <span className={`font-medium ${found ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-600'}`}>{word}</span>
                    {found ? <Check className="h-5 w-5 text-emerald-500" /> : <X className="h-5 w-5 text-red-400" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}