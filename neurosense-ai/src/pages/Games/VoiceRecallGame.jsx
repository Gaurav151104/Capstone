import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Mic, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  Sparkles, 
  RotateCcw, 
  FileText, 
  Eye, 
  Volume2,
  Clock,
  Waves,
  Shuffle,
  ShieldCheck
} from 'lucide-react';
import Card from '../../components/Card';
import VoiceRecorder from '../../components/VoiceRecorder';
import DisclaimerNote from '../../components/DisclaimerNote';
import { speechService } from '../../services/speechService';
import { gameService } from '../../services/gameService';

// ---------------------------------------------------------------------------
// Dynamic Stimulus Bank: Multiple Scenes, Passages & Fluency Categories
// ---------------------------------------------------------------------------

const SCENE_STIMULI = [
  {
    id: 'kitchen_cookie_theft',
    title: 'The Kitchen & Cookie Theft Scene',
    setting: 'Indoor Home Kitchen',
    description: 'Look at the kitchen illustration. Describe everything you see happening in detail.',
    prompt: 'Mention who is there, what each person is doing, what is happening at the sink, and what might happen next.',
    svgType: 'cookie_theft'
  },
  {
    id: 'park_picnic',
    title: 'Sunny Afternoon in the Park',
    setting: 'Outdoor Recreation Park',
    description: 'Observe this vibrant park scene. Describe the various activities taking place across the grass and sky.',
    prompt: 'Mention the dog and frisbee, the family on the blanket, the kite in the tree, and the child on the swing.',
    svgType: 'park_picnic'
  },
  {
    id: 'morning_rush',
    title: 'Morning Rush & The Cluttered Living Room',
    setting: 'Living Room at 8:55 AM',
    description: 'Notice the hurried atmosphere in this room. Describe the cause-and-effect events occurring.',
    prompt: 'Mention what the man is searching for, what the cat is doing to the vase, the coffee pot, and the time on the clock.',
    svgType: 'morning_rush'
  },
  {
    id: 'farmers_market',
    title: 'Bustling Weekend Farmers Market',
    setting: 'Open-Air Market Square',
    description: 'Take in the busy market stalls. Describe the interaction between the vendors, items for sale, and shoppers.',
    prompt: 'Mention the fruit scale, the rolling cart, the shopper with the checklist, and the items on the market counter.',
    svgType: 'farmers_market'
  }
];

const PASSAGE_STIMULI = [
  {
    id: 'grandfather',
    title: 'The Grandfather Passage',
    origin: 'Clinical Phonetic Standard',
    text: 'You wish to know all about my grandfather. Well, he is nearly ninety-three years old; he dresses himself in an ancient black frock coat, usually lent with several buttons missing. A long beard clings to his chin, giving those who observe him a well-turned impression of the statues of long ago.'
  },
  {
    id: 'rainbow',
    title: 'The Rainbow Passage',
    origin: 'Speech Prosody & Intonation Benchmark',
    text: 'When the sunlight strikes raindrops in the air, they act as a prism and form a rainbow. The rainbow is a division of white light into many beautiful colors. These take the shape of a long round arch, with its path high above, and its two ends apparently beyond the horizon.'
  },
  {
    id: 'north_wind',
    title: 'The North Wind and the Sun',
    origin: 'International Phonetic Association',
    text: 'The North Wind and the Sun were disputing which was the stronger, when a traveler came along wrapped in a warm cloak. They agreed that the one who first succeeded in making the traveler take his cloak off should be considered stronger than the other.'
  },
  {
    id: 'harbor_dawn',
    title: 'The Harbor at Dawn',
    origin: 'Acoustic Continuity & Breathing Flow',
    text: 'At the break of dawn, the coastal harbor awakens with the low rhythmic drone of fishing boats heading out into the open bay. Gentle ocean waves lap against the weathered wooden docks, while seagulls glide quietly through the cool morning mist.'
  }
];

const FLUENCY_STIMULI = [
  {
    id: 'animals',
    title: 'Animals & Wildlife',
    example: 'Dog, Elephant, Dolphin, Tiger, Falcon, Kangaroo...',
    instruction: 'Name as many different wild and domestic animals as you can in 30 seconds.'
  },
  {
    id: 'groceries',
    title: 'Supermarket & Kitchen Foods',
    example: 'Apples, Milk, Bread, Carrots, Rice, Cheese, Tomatoes...',
    instruction: 'Name as many grocery items, vegetables, and kitchen foods as you can in 30 seconds.'
  },
  {
    id: 'vehicles',
    title: 'Vehicles & Modes of Travel',
    example: 'Airplane, Bicycle, Submarine, Helicopter, Train, Scooter...',
    instruction: 'Name as many different modes of transportation and vehicles as you can in 30 seconds.'
  },
  {
    id: 'places',
    title: 'World Cities & Countries',
    example: 'Tokyo, Canada, Paris, Brazil, Cairo, London, Australia...',
    instruction: 'Name as many countries and global cities as you can think of in 30 seconds.'
  }
];

const TASK_CATEGORIES = [
  {
    id: 'picture_description',
    name: 'Picture Description Challenge',
    category: 'Spontaneous Narrative',
    badge: 'Clinical Gold Standard',
    suggestedDuration: '30–45 sec'
  },
  {
    id: 'category_fluency',
    name: 'Rapid Category Verbal Fluency',
    category: 'Lexical Retrieval',
    badge: 'Semantic Memory',
    suggestedDuration: '30 sec'
  },
  {
    id: 'passage_reading',
    name: 'Clinical Reading Passage',
    category: 'Phonetic Articulation',
    badge: 'Speech Cadence',
    suggestedDuration: '25–40 sec'
  }
];

export default function VoiceRecallGame() {
  const [selectedTaskCategory, setSelectedTaskCategory] = useState(TASK_CATEGORIES[0]);
  
  // Dynamic Stimulus Index State
  const [sceneIndex, setSceneIndex] = useState(0);
  const [passageIndex, setPassageIndex] = useState(0);
  const [fluencyIndex, setFluencyIndex] = useState(0);

  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);

  const currentScene = SCENE_STIMULI[sceneIndex];
  const currentPassage = PASSAGE_STIMULI[passageIndex];
  const currentFluency = FLUENCY_STIMULI[fluencyIndex];

  const handleNextScene = () => {
    setSceneIndex((prev) => (prev + 1) % SCENE_STIMULI.length);
  };

  const handleNextPassage = () => {
    setPassageIndex((prev) => (prev + 1) % PASSAGE_STIMULI.length);
  };

  const handleNextFluency = () => {
    setFluencyIndex((prev) => (prev + 1) % FLUENCY_STIMULI.length);
  };

  const handleRecordingComplete = async (audioBlob) => {
    setIsProcessing(true);
    setError(null);

    const taskMeta = selectedTaskCategory.id === 'picture_description'
      ? currentScene.title
      : selectedTaskCategory.id === 'passage_reading'
      ? currentPassage.title
      : currentFluency.title;

    try {
      const result = await speechService.processAudio(audioBlob, selectedTaskCategory.id);
      setAnalysisResult(result);

      // Log session to cognitive progression record
      const cognitiveScore = result.prediction === 'Healthy Control' 
        ? Math.min(100, Math.round(result.probabilityHealthy * 0.9 + 10))
        : Math.max(35, Math.round(result.probabilityHealthy * 0.8));

      gameService.saveGameLog({
        gameType: 'Voice Biomarker Screening',
        score: cognitiveScore,
        maxScore: 100,
        metadata: {
          taskCategory: selectedTaskCategory.name,
          stimulusTitle: taskMeta,
          prediction: result.prediction,
          riskLevel: result.riskLevel,
          confidenceScore: result.confidenceScore
        }
      });
    } catch (err) {
      console.error('Speech assessment processing failed:', err);
      setError('Acoustic processing encountered an issue. Please ensure your microphone is connected and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setAnalysisResult(null);
    setError(null);
  };

  const isDementiaDetected = analysisResult?.prediction === 'Dementia Detected';

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/dashboard/games"
            className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Cognitive Games
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white flex items-center">
            <Mic className="h-7 w-7 text-primary-600 dark:text-primary-400 mr-2.5" />
            Voice Biomarker Screening & Verbal Challenge
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            Machine Learning acoustic analysis extracting 34 vocal biomarkers including speech pauses, fundamental pitch, and MFCC cadence.
          </p>
        </div>
      </div>

      <DisclaimerNote compact />

      {/* Task Mode Selector Tabs */}
      {!analysisResult && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TASK_CATEGORIES.map((cat) => {
            const isSelected = selectedTaskCategory.id === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedTaskCategory(cat);
                  setError(null);
                }}
                className={`p-4 rounded-xl text-left border transition-all ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50/70 dark:bg-primary-950/40 shadow-sm ring-1 ring-primary-500'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300">
                    {cat.badge}
                  </span>
                  <span className="text-xs text-slate-400 flex items-center">
                    <Clock className="h-3 w-3 mr-1" /> {cat.suggestedDuration}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">{cat.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{cat.category}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Active Challenge Card */}
      {!analysisResult ? (
        <Card className="overflow-hidden border border-slate-200 dark:border-slate-800">
          <div className="p-6 space-y-6">
            
            {/* Mode 1: Dynamic Picture Description Scenes */}
            {selectedTaskCategory.id === 'picture_description' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                        {currentScene.setting}
                      </span>
                      <span className="text-xs text-slate-400">
                        (Image {sceneIndex + 1} of {SCENE_STIMULI.length})
                      </span>
                    </div>
                    <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white mt-0.5">
                      {currentScene.title}
                    </h2>
                  </div>
                  
                  {/* Dynamic Stimulus Switcher Button */}
                  <button
                    onClick={handleNextScene}
                    className="inline-flex items-center text-xs font-semibold px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-primary-50 dark:hover:bg-primary-900/40 text-slate-700 dark:text-slate-200 hover:text-primary-600 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                  >
                    <Shuffle className="h-3.5 w-3.5 mr-1.5" /> Next Picture Scene
                  </button>
                </div>

                {/* SVG Visual Scene Rendering */}
                <div className="bg-slate-900 rounded-2xl p-4 text-center border border-slate-800 shadow-inner relative overflow-hidden">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2 px-2">
                    <span className="flex items-center font-medium">
                      <Eye className="h-3.5 w-3.5 mr-1 text-primary-400" /> Visual Stimulus: {currentScene.title}
                    </span>
                    <span className="text-primary-400 font-medium">Observe and describe aloud</span>
                  </div>

                  <div className="w-full max-w-xl mx-auto rounded-xl bg-slate-800 p-4 border border-slate-700/80">
                    {/* Scene 1: Kitchen Cookie Theft */}
                    {currentScene.svgType === 'cookie_theft' && (
                      <svg viewBox="0 0 600 300" className="w-full h-auto rounded-lg shadow" fill="none">
                        <rect width="600" height="300" fill="#0f172a" />
                        <line x1="0" y1="240" x2="600" y2="240" stroke="#334155" strokeWidth="3" />
                        <rect x="40" y="40" width="110" height="85" rx="8" fill="#1e293b" stroke="#60a5fa" strokeWidth="2" />
                        <line x1="95" y1="40" x2="95" y2="125" stroke="#60a5fa" strokeWidth="2" />
                        <line x1="40" y1="82" x2="150" y2="82" stroke="#60a5fa" strokeWidth="2" />
                        <circle cx="120" cy="65" r="14" fill="#facc15" opacity="0.8" />
                        <rect x="40" y="150" width="160" height="90" rx="4" fill="#334155" stroke="#475569" strokeWidth="2" />
                        <path d="M120 145 Q120 125 105 125 T90 145" stroke="#94a3b8" strokeWidth="4" fill="none" />
                        <path d="M60 150 Q100 160 140 150 Q170 165 150 175 Q110 180 60 170 Z" fill="#38bdf8" opacity="0.8" />
                        <path d="M70 175 C 70 215, 50 230, 40 240" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                        <ellipse cx="55" cy="245" rx="35" ry="8" fill="#0284c7" opacity="0.7" />
                        <text x="50" y="270" fill="#7dd3fc" fontSize="10" fontFamily="sans-serif">Overflowing Sink</text>
                        <circle cx="230" cy="110" r="17" fill="#fbcfe8" />
                        <rect x="215" y="128" width="30" height="60" rx="6" fill="#ec4899" />
                        <circle cx="185" cy="155" r="9" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
                        <text x="195" y="85" fill="#f472b6" fontSize="10" fontFamily="sans-serif">Mother Drying Dishes</text>
                        <rect x="420" y="40" width="130" height="85" rx="4" fill="#334155" stroke="#475569" strokeWidth="2" />
                        <rect x="455" y="65" width="35" height="40" rx="6" fill="#f59e0b" stroke="#d97706" strokeWidth="2" />
                        <text x="458" y="88" fill="#78350f" fontSize="7" fontWeight="bold" fontFamily="sans-serif">COOKIES</text>
                        <line x1="465" y1="185" x2="500" y2="170" stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" />
                        <line x1="470" y1="185" x2="450" y2="240" stroke="#ef4444" strokeWidth="4" />
                        <line x1="495" y1="170" x2="485" y2="240" stroke="#ef4444" strokeWidth="4" />
                        <text x="420" y="260" fill="#f87171" fontSize="10" fontFamily="sans-serif">Tilting Stool Falling</text>
                        <circle cx="490" cy="110" r="16" fill="#fed7aa" />
                        <rect x="475" y="128" width="28" height="48" rx="5" fill="#3b82f6" />
                        <line x1="485" y1="130" x2="470" y2="90" stroke="#fed7aa" strokeWidth="5" strokeLinecap="round" />
                        <text x="465" y="28" fill="#60a5fa" fontSize="10" fontFamily="sans-serif">Boy in Cookie Jar</text>
                        <circle cx="375" cy="150" r="14" fill="#fed7aa" />
                        <rect x="363" y="165" width="24" height="40" rx="4" fill="#a855f7" />
                        <line x1="380" y1="170" x2="430" y2="148" stroke="#fed7aa" strokeWidth="4" strokeLinecap="round" />
                        <text x="330" y="135" fill="#c084fc" fontSize="10" fontFamily="sans-serif">Girl Reaching Up</text>
                      </svg>
                    )}

                    {/* Scene 2: Park Picnic & Frisbee */}
                    {currentScene.svgType === 'park_picnic' && (
                      <svg viewBox="0 0 600 300" className="w-full h-auto rounded-lg shadow" fill="none">
                        <rect width="600" height="300" fill="#064e3b" />
                        <rect x="0" y="0" width="600" height="150" fill="#0284c7" opacity="0.4" />
                        <circle cx="520" cy="45" r="22" fill="#facc15" />
                        {/* Tree with stuck kite */}
                        <rect x="70" y="70" width="20" height="170" fill="#78350f" />
                        <circle cx="80" cy="70" r="55" fill="#15803d" />
                        <polygon points="100,50 120,40 115,65 95,70" fill="#ef4444" stroke="#f87171" strokeWidth="2" />
                        <path d="M105 60 Q130 90 120 120" stroke="#f8fafc" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
                        <text x="35" y="145" fill="#fca5a5" fontSize="10" fontFamily="sans-serif">Kite Caught in Tree</text>
                        {/* Picnic Blanket */}
                        <polygon points="220,180 340,180 360,240 200,240" fill="#dc2626" />
                        <rect x="260" y="190" width="35" height="25" rx="3" fill="#d97706" />
                        <circle cx="240" cy="170" r="14" fill="#fed7aa" />
                        <rect x="230" y="185" width="20" height="35" fill="#0284c7" />
                        <text x="210" y="260" fill="#fca5a5" fontSize="10" fontFamily="sans-serif">Family Picnic on Blanket</text>
                        {/* Frisbee & Dog */}
                        <ellipse cx="440" cy="120" rx="20" ry="5" fill="#ef4444" />
                        <text x="420" y="105" fill="#f87171" fontSize="10" fontFamily="sans-serif">Flying Red Frisbee</text>
                        <ellipse cx="450" cy="200" rx="25" ry="15" fill="#b45309" />
                        <circle cx="475" cy="180" r="10" fill="#b45309" />
                        <line x1="440" y1="210" x2="430" y2="235" stroke="#b45309" strokeWidth="4" />
                        <line x1="460" y1="210" x2="470" y2="235" stroke="#b45309" strokeWidth="4" />
                        <text x="430" y="255" fill="#fde68a" fontSize="10" fontFamily="sans-serif">Puppy Jumping</text>
                      </svg>
                    )}

                    {/* Scene 3: Morning Rush in Living Room */}
                    {currentScene.svgType === 'morning_rush' && (
                      <svg viewBox="0 0 600 300" className="w-full h-auto rounded-lg shadow" fill="none">
                        <rect width="600" height="300" fill="#1e1b4b" />
                        <line x1="0" y1="230" x2="600" y2="230" stroke="#312e81" strokeWidth="3" />
                        {/* Wall Clock showing 8:55 */}
                        <circle cx="280" cy="65" r="28" fill="#f8fafc" stroke="#6366f1" strokeWidth="3" />
                        <line x1="280" y1="65" x2="280" y2="45" stroke="#0f172a" strokeWidth="3" />
                        <line x1="280" y1="65" x2="260" y2="65" stroke="#ef4444" strokeWidth="2.5" />
                        <text x="240" y="110" fill="#a5b4fc" fontSize="10" fontFamily="sans-serif">Clock at 8:55 AM (Running Late)</text>
                        {/* Sofa & Searching Man */}
                        <rect x="40" y="160" width="180" height="70" rx="8" fill="#4338ca" />
                        <circle cx="240" cy="190" r="15" fill="#fed7aa" />
                        <line x1="240" y1="195" x2="210" y2="225" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" />
                        <text x="170" y="255" fill="#93c5fd" fontSize="10" fontFamily="sans-serif">Searching Under Sofa for Keys</text>
                        {/* Table, Tipped Vase & Cat */}
                        <rect x="360" y="160" width="160" height="20" fill="#78350f" />
                        <line x1="380" y1="180" x2="380" y2="230" stroke="#78350f" strokeWidth="4" />
                        <line x1="500" y1="180" x2="500" y2="230" stroke="#78350f" strokeWidth="4" />
                        {/* Tilted vase spilling water */}
                        <path d="M420 155 Q445 140 450 160" stroke="#38bdf8" strokeWidth="8" strokeLinecap="round" />
                        <ellipse cx="470" cy="165" rx="20" ry="5" fill="#0284c7" opacity="0.8" />
                        <text x="400" y="130" fill="#38bdf8" fontSize="10" fontFamily="sans-serif">Vase Tipped Spilling Water</text>
                        {/* Cat */}
                        <ellipse cx="370" cy="145" rx="18" ry="12" fill="#ea580c" />
                        <circle cx="355" cy="138" r="8" fill="#ea580c" />
                        <text x="335" y="120" fill="#fdba74" fontSize="10" fontFamily="sans-serif">Cat on Counter</text>
                      </svg>
                    )}

                    {/* Scene 4: Farmers Market */}
                    {currentScene.svgType === 'farmers_market' && (
                      <svg viewBox="0 0 600 300" className="w-full h-auto rounded-lg shadow" fill="none">
                        <rect width="600" height="300" fill="#14532d" />
                        <line x1="0" y1="230" x2="600" y2="230" stroke="#166534" strokeWidth="3" />
                        {/* Canopy */}
                        <polygon points="50,40 550,40 520,90 80,90" fill="#b91c1c" />
                        <text x="210" y="70" fill="#fef2f2" fontSize="14" fontWeight="bold" fontFamily="sans-serif">FRESH PRODUCE MARKET</text>
                        {/* Stall Counter */}
                        <rect x="80" y="140" width="220" height="90" fill="#78350f" />
                        {/* Hanging Brass Scale */}
                        <line x1="160" y1="90" x2="160" y2="125" stroke="#facc15" strokeWidth="2" />
                        <line x1="130" y1="125" x2="190" y2="125" stroke="#facc15" strokeWidth="3" />
                        <circle cx="140" cy="140" r="10" fill="#ef4444" />
                        <circle cx="180" cy="140" r="10" fill="#84cc16" />
                        <text x="115" y="170" fill="#fde047" fontSize="10" fontFamily="sans-serif">Weighing Apples on Scale</text>
                        {/* Rolling shopping cart */}
                        <rect x="360" y="160" width="60" height="40" rx="3" fill="none" stroke="#94a3b8" strokeWidth="3" />
                        <circle cx="375" cy="210" r="7" fill="#64748b" />
                        <circle cx="410" cy="210" r="7" fill="#64748b" />
                        <path d="M430 200 Q460 205 480 200" stroke="#f87171" strokeDasharray="3 3" strokeWidth="2" fill="none" />
                        <text x="340" y="235" fill="#fca5a5" fontSize="10" fontFamily="sans-serif">Cart Rolling Downhill</text>
                        {/* Shopper with Checklist */}
                        <circle cx="510" cy="130" r="16" fill="#fed7aa" />
                        <rect x="495" y="148" width="30" height="55" rx="5" fill="#0284c7" />
                        <rect x="475" y="155" width="18" height="25" rx="2" fill="#f8fafc" stroke="#0f172a" strokeWidth="1" />
                        <text x="460" y="120" fill="#7dd3fc" fontSize="10" fontFamily="sans-serif">Shopper with List</text>
                      </svg>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 mt-3 max-w-lg mx-auto leading-relaxed">
                    <b>Prompt:</b> "{currentScene.prompt}"
                  </p>
                </div>
              </div>
            )}

            {/* Mode 2: Dynamic Category Verbal Fluency */}
            {selectedTaskCategory.id === 'category_fluency' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      Semantic Category Retrieval ({fluencyIndex + 1} of {FLUENCY_STIMULI.length})
                    </span>
                    <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white mt-0.5">
                      {currentFluency.title}
                    </h2>
                  </div>

                  <button
                    onClick={handleNextFluency}
                    className="inline-flex items-center text-xs font-semibold px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-900/40 text-slate-700 dark:text-slate-200 hover:text-amber-600 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                  >
                    <Shuffle className="h-3.5 w-3.5 mr-1.5" /> Next Category
                  </button>
                </div>

                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 p-6 rounded-2xl border border-amber-200 dark:border-amber-800 text-center">
                  <Sparkles className="h-10 w-10 text-amber-500 mx-auto mb-2" />
                  <h3 className="text-xl font-bold text-amber-900 dark:text-amber-200 mb-1">
                    {currentFluency.instruction}
                  </h3>
                  <p className="text-sm text-amber-800 dark:text-amber-300 max-w-md mx-auto mt-2">
                    Examples: <i>{currentFluency.example}</i>
                  </p>
                  <span className="inline-block mt-3 text-xs bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 px-3 py-1 rounded-full font-medium">
                    Speak continuously for 30 seconds without repeating words
                  </span>
                </div>
              </div>
            )}

            {/* Mode 3: Dynamic Clinical Reading Passages */}
            {selectedTaskCategory.id === 'passage_reading' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                        {currentPassage.origin}
                      </span>
                      <span className="text-xs text-slate-400">
                        (Passage {passageIndex + 1} of {PASSAGE_STIMULI.length})
                      </span>
                    </div>
                    <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white mt-0.5">
                      {currentPassage.title}
                    </h2>
                  </div>

                  <button
                    onClick={handleNextPassage}
                    className="inline-flex items-center text-xs font-semibold px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-primary-50 dark:hover:bg-primary-900/40 text-slate-700 dark:text-slate-200 hover:text-primary-600 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                  >
                    <Shuffle className="h-3.5 w-3.5 mr-1.5" /> Next Passage
                  </button>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/80 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center text-xs font-semibold text-primary-600 dark:text-primary-400 mb-2">
                    <FileText className="h-4 w-4 mr-1.5" /> Clinical Standard Reading Passage
                  </div>
                  <p className="text-base text-slate-800 dark:text-slate-100 font-serif leading-relaxed italic border-l-4 border-primary-500 pl-4 py-2 bg-white dark:bg-slate-900/60 rounded-r-lg">
                    "{currentPassage.text}"
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    Instruction: Press "Start Recording" and read the passage above at your normal speaking speed.
                  </p>
                </div>
              </div>
            )}

            {/* Prominent Privacy & Deletion Notice */}
            <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3.5 flex items-start text-xs text-emerald-800 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4 mr-2.5 flex-shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <b className="font-semibold">Zero Audio Storage Guarantee:</b> Your voice recording is processed in temporary RAM and permanently deleted immediately after acoustic feature extraction. Raw voice audio is never stored on disk or saved in databases.
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* In-Browser Voice Recording Component */}
            <div className="pt-2">
              <VoiceRecorder
                onRecordingComplete={handleRecordingComplete}
                isProcessing={isProcessing}
                maxDurationSec={60}
              />
            </div>
          </div>
        </Card>
      ) : (
        /* Results View (Once AI Inference is Complete) */
        <div className="space-y-6 animate-in zoom-in-95 duration-300">
          <Card className="overflow-hidden border border-slate-200 dark:border-slate-800">
            {/* Header Banner */}
            <div
              className={`p-6 border-b ${
                isDementiaDetected
                  ? 'bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-red-500/10 border-red-200 dark:border-red-900/40'
                  : 'bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border-emerald-200 dark:border-emerald-900/40'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start space-x-3.5">
                  <div
                    className={`h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                      isDementiaDetected
                        ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                        : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {isDementiaDetected ? (
                      <AlertTriangle className="h-7 w-7" />
                    ) : (
                      <CheckCircle2 className="h-7 w-7" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Acoustic ML Model Verdict
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                          isDementiaDetected
                            ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                            : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {analysisResult.prediction}
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">
                      {isDementiaDetected
                        ? 'Elevated Acoustic Risk Indicators Detected'
                        : 'Normative Healthy Acoustic Biomarkers'}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Session ID: {analysisResult.id} &nbsp;|&nbsp; Audio file deleted immediately after inference.
                    </p>
                  </div>
                </div>

                <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 pt-3 md:pt-0 border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Model Confidence</span>
                  <span className="text-2xl font-extrabold text-slate-800 dark:text-white">
                    {analysisResult.confidenceScore}
                  </span>
                </div>
              </div>
            </div>

            {/* Probability Gauges & Explanation */}
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  Statistical Class Probability Distribution
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center">
                        <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-500" /> Healthy Control
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {analysisResult.probabilityHealthy}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-700"
                        style={{ width: `${analysisResult.probabilityHealthy}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-1.5 text-red-500" /> Dementia Indicator
                      </span>
                      <span className="font-mono font-bold text-red-600 dark:text-red-400">
                        {analysisResult.probabilityDementia}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-red-500 h-full rounded-full transition-all duration-700"
                        style={{ width: `${analysisResult.probabilityDementia}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Biomarker Metrics Grid */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center">
                  <Waves className="h-4 w-4 mr-1.5 text-primary-500" /> Extracted Acoustic Biomarkers (Librosa Pipeline)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Pause Count</span>
                    <p className="text-xl font-bold text-slate-800 dark:text-white mt-1">
                      {analysisResult.metrics?.pauseCount ?? 0}
                    </p>
                    <span className="text-[11px] text-slate-400">Hesitation episodes</span>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Avg Pause Duration</span>
                    <p className="text-xl font-bold text-slate-800 dark:text-white mt-1">
                      {analysisResult.metrics?.pauseMeanSec ?? 0}s
                    </p>
                    <span className="text-[11px] text-slate-400">Per silence segment</span>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Speech Flow Ratio</span>
                    <p className="text-xl font-bold text-slate-800 dark:text-white mt-1">
                      {analysisResult.metrics?.speechRatioPct ?? 0}%
                    </p>
                    <span className="text-[11px] text-slate-400">Active vocalization</span>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Pitch Mean (F0)</span>
                    <p className="text-xl font-bold text-slate-800 dark:text-white mt-1">
                      {analysisResult.metrics?.pitchMeanHz ?? 0} Hz
                    </p>
                    <span className="text-[11px] text-slate-400">Fundamental pitch</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={handleReset}
                  className="px-5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium transition-colors flex items-center"
                >
                  <RotateCcw className="h-4 w-4 mr-2" /> Try Another Stimulus
                </button>

                <div className="flex space-x-3">
                  <Link
                    to="/dashboard/progress"
                    className="btn-outline px-4 py-2.5 text-sm flex items-center"
                  >
                    <TrendingUp className="h-4 w-4 mr-2" /> View Longitudinal Trends
                  </Link>

                  <Link
                    to="/dashboard/games"
                    className="btn-primary px-5 py-2.5 text-sm flex items-center"
                  >
                    Continue to Games
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
