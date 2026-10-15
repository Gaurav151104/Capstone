import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Gamepad2, Image as ImageIcon, Brain, ArrowRight, Info, ArrowLeft, Zap } from 'lucide-react';
import Card from '../../components/Card';
import { gameService } from '../../services/gameService';
import { useApp } from '../../hooks/useApp';

export default function Games() {
  const { t } = useApp();
  const [hasPlayed] = useState(() => gameService.hasPlayedGames());

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-500">
      <Link 
        to="/dashboard"
        className="flex items-center text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-medium"
      >
        <ArrowLeft className="h-4 w-4 mr-2" /> {t.back_to_dashboard}
      </Link>
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center">
          <Gamepad2 className="mr-2 h-6 w-6 text-primary-600 dark:text-primary-400" /> {t.games}
        </h2>
        <p className="text-slate-500 dark:text-slate-400">{t.games_subtitle || 'Scientifically designed cognitive screening and brain training exercises.'}</p>
      </div>

      {/* Provisional Norms Notice */}
      <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 rounded-xl p-3.5 flex items-center text-xs font-medium shadow-sm">
        <Info className="h-4 w-4 mr-2.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <p>All cognitive screening measures (Word Recall, Image Recall, Reaction Time, and Memory Match) use provisional normative approximations. Screening aid only, not a medical diagnosis.</p>
      </div>

      {!hasPlayed && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/30 text-blue-800 dark:text-blue-300 rounded-xl p-4 flex items-center shadow-sm">
          <Info className="h-5 w-5 mr-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <p className="font-medium text-sm">{t.games_subtitle || 'Complete assessments to build your cognitive profile.'}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:border-blue-200 dark:hover:border-blue-800 transition-all hover:shadow-md flex flex-col h-full cursor-pointer group">
          <div className="h-16 w-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-6 align-middle">
            <Gamepad2 className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{t.memory_match}</h3>
          <p className="text-slate-600 dark:text-slate-400 flex-1 text-sm">
            {t.memory_desc || 'Match card pairs to evaluate short-term working memory and pattern recall.'}
          </p>
          <Link to="/dashboard/games/memory" className="btn-primary mt-6 group-hover:bg-primary-700 w-full flex items-center justify-center text-sm">
            {t.start_game || 'Play Now'} <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Card>

        <Card className="hover:border-orange-200 dark:hover:border-orange-800 transition-all hover:shadow-md flex flex-col h-full cursor-pointer group">
          <div className="h-16 w-16 rounded-2xl bg-orange-50 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400 flex items-center justify-center mb-6 align-middle">
            <ImageIcon className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{t.image_recall}</h3>
          <p className="text-slate-600 dark:text-slate-400 flex-1 text-sm">
            {t.image_recall_desc || 'Remember a sequence of visual symbols and recall them accurately in order.'}
          </p>
          <Link to="/dashboard/games/image-recall" className="btn-primary mt-6 group-hover:bg-primary-700 w-full flex items-center justify-center text-sm">
            {t.start_game || 'Play Now'} <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Card>

        <Card className="hover:border-purple-200 dark:hover:border-purple-800 transition-all hover:shadow-md flex flex-col h-full cursor-pointer group">
          <div className="h-16 w-16 rounded-2xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-6 align-middle">
            <Brain className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{t.word_recall}</h3>
          <p className="text-slate-600 dark:text-slate-400 flex-1 text-sm">
            {t.word_recall_desc || 'Read a set of words, retain them in verbal memory, and recall as many as possible.'}
          </p>
          <Link to="/dashboard/games/recall" className="btn-primary mt-6 group-hover:bg-primary-700 w-full flex items-center justify-center text-sm">
            {t.start_game || 'Play Now'} <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Card>

        <Card className="hover:border-amber-200 dark:hover:border-amber-800 transition-all hover:shadow-md flex flex-col h-full cursor-pointer group">
          <div className="h-16 w-16 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400 flex items-center justify-center mb-6 align-middle">
            <Zap className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{t.reaction_time || 'Reaction Time'}</h3>
          <p className="text-slate-600 dark:text-slate-400 flex-1 text-sm">
            {t.reaction_game_desc || 'Measure visual stimulus response latency, focus consistency, and attention stability.'}
          </p>
          <Link to="/dashboard/games/reaction-time" className="btn-primary mt-6 group-hover:bg-primary-700 w-full flex items-center justify-center text-sm">
            {t.start_game || 'Play Now'} <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Card>

      </div>
    </div>
  );
}
