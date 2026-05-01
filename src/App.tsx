/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Book, 
  Trophy, 
  History, 
  CheckCircle2, 
  Volume2, 
  Trash2, 
  RefreshCw,
  X,
  Languages,
  ArrowRightLeft,
  Circle
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { UserWord, LearningStats, WordDefinition } from './types';

// --- Gemini Config ---
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function getWordDefinition(word: string): Promise<WordDefinition> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Definition, phonetic, example sentence for: "${word}". Output in JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          phonetic: { type: Type.STRING },
          meaning: { type: Type.STRING, description: "Short Chinese meaning" },
          example: { type: Type.STRING, description: "One English example sentence with translation" },
          mnemonic: { type: Type.STRING, description: "Short mnemonic device" }
        },
        required: ["word", "meaning", "example"]
      }
    }
  });
  return JSON.parse(response.text.trim()) as WordDefinition;
}

// --- Utils ---
const speakUK = (text: string) => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const ukVoice = voices.find(v => v.lang === 'en-GB' || v.lang.includes('GB')) || voices.find(v => v.lang.startsWith('en'));
  if (ukVoice) utterance.voice = ukVoice;
  utterance.lang = 'en-GB';
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
};

// Ebbinghaus intervals in hours
const INTERVALS = [0, 0.1, 0.5, 12, 24, 48, 96, 168, 360, 720];

const getNextReview = (currentIntervalIndex: number, success: boolean) => {
  const now = Date.now();
  const index = success ? Math.min(currentIntervalIndex + 1, INTERVALS.length - 1) : 1;
  const hours = INTERVALS[index];
  return {
    intervalIndex: index,
    nextReview: now + hours * 60 * 60 * 1000,
    status: (index > 7 ? 'mastered' : 'learning') as 'mastered' | 'learning'
  };
};

// --- Components ---

const ProgressBar = ({ value, max }: { value: number; max: number }) => (
  <div className="h-1.5 w-full bg-indigo-50 rounded-full overflow-hidden">
    <motion.div 
      initial={{ width: 0 }}
      animate={{ width: `${(value / (max || 1)) * 100}%` }}
      className="h-full bg-indigo-500 rounded-full"
    />
  </div>
);

const WordCard = ({ 
  word, 
  onReview, 
  onDelete 
}: { 
  word: UserWord & { intervalIndex: number }; 
  onReview: (id: string, success: boolean) => void;
  onDelete: (id: string) => void;
}) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    speakUK(word.word);
  };

  return (
    <div 
      className="relative h-60 w-full perspective-1000 cursor-pointer"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <motion.div 
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 200, damping: 20 }}
        className="w-full h-full relative preserve-3d"
      >
        {/* Front */}
        <div className="absolute inset-0 backface-hidden bg-white border-2 border-slate-100 rounded-3xl p-6 flex flex-col items-center justify-center shadow-sm hover:shadow-md transition-shadow">
          <div className="flex flex-col items-center gap-2">
            <h3 className="text-3xl font-black text-slate-800 tracking-tight text-center">{word.word}</h3>
            <button onClick={handleAudio} className="p-2 hover:bg-indigo-50 rounded-full text-indigo-500 transition-colors">
              <Volume2 className="w-6 h-6" />
            </button>
          </div>
          {word.phonetic && <p className="mt-2 text-slate-400 font-mono text-sm">{word.phonetic}</p>}
          <div className="absolute bottom-4 text-[10px] text-slate-300 font-black tracking-[0.2em] uppercase">
            点击翻转
          </div>
        </div>

        {/* Back */}
        <div className="absolute inset-0 backface-hidden bg-indigo-600 border-2 border-indigo-500 rounded-3xl p-6 flex flex-col rotate-y-180 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-start mb-4">
            <button onClick={handleAudio} className="text-indigo-200 hover:text-white p-1">
              <Volume2 className="w-5 h-5" />
            </button>
            <button 
              onClick={() => onDelete(word.id)}
              className="p-1.5 text-indigo-300 hover:text-red-300 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-1">
            <div className="space-y-1">
              <p className="text-indigo-200 font-black text-[10px] uppercase tracking-wider">释义</p>
              <p className="text-white font-bold text-lg leading-tight">{word.meaning}</p>
            </div>
            <div className="space-y-1">
              <p className="text-indigo-200 font-black text-[10px] uppercase tracking-wider">例句</p>
              <p className="text-indigo-50 italic text-sm leading-relaxed">{word.example}</p>
            </div>
          </div>

          <div className="flex gap-2.5 mt-4 pt-4 border-t border-white/10">
            <button 
              onClick={() => onReview(word.id, false)}
              className="flex-1 py-3 text-xs font-black rounded-2xl bg-white/10 text-white hover:bg-white/20 transition-all border border-white/10"
            >
              不认识
            </button>
            <button 
              onClick={() => onReview(word.id, true)}
              className="flex-[1.5] py-3 text-xs font-black rounded-2xl bg-white text-indigo-600 shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
            >
              已记住
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// --- App ---

export default function App() {
  const [words, setWords] = useState<(UserWord & { intervalIndex: number })[]>(() => {
    const saved = localStorage.getItem('vocab_v2');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [newWord, setNewWord] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'study' | 'list' | 'stats'>('study');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('vocab_v2', JSON.stringify(words));
  }, [words]);

  useEffect(() => {
    const handleVoiceLoad = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener('voiceschanged', handleVoiceLoad);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', handleVoiceLoad);
  }, []);

  const stats = useMemo(() => ({
    total: words.length,
    learning: words.filter(w => w.status === 'learning' || w.status === 'new').length,
    mastered: words.filter(w => w.status === 'mastered').length,
  }), [words]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = newWord.trim();
    if (!input || isLoading) return;

    if (words.some(w => w.word.toLowerCase() === input.toLowerCase())) {
      setError('词库中已存在');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const def = await getWordDefinition(input);
      const wordObj: UserWord & { intervalIndex: number } = {
        ...def,
        id: Math.random().toString(36).substr(2, 9),
        status: 'new',
        addedAt: Date.now(),
        nextReview: Date.now(),
        intervalIndex: 0,
        easeFactor: 2.5,
        interval: 0,
      };
      setWords(prev => [wordObj, ...prev]);
      setNewWord('');
      speakUK(wordObj.word);
    } catch (err) {
      setError('处理失败，请检查网络或 Key 配置');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReview = (id: string, success: boolean) => {
    setWords(prev => prev.map(w => {
      if (w.id === id) {
        const next = getNextReview(w.intervalIndex, success);
        return { ...w, ...next };
      }
      return w;
    }));
  };

  const handleDelete = (id: string) => {
    if (window.confirm('确定删除这个词吗？')) {
      setWords(prev => prev.filter(w => w.id !== id));
    }
  };

  const studyDue = useMemo(() => {
    const now = Date.now();
    const due = words.filter(w => !w.nextReview || w.nextReview <= now || w.status === 'new');
    return due.sort(() => Math.random() - 0.5).slice(0, 6);
  }, [words, activeTab]);

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-900 font-sans selection:bg-indigo-100">
      <div className={`mx-auto px-4 pt-8 pb-32 transition-all duration-500 ${activeTab === 'study' ? 'max-w-6xl' : 'max-w-xl'}`}>
        
        <header className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center justify-center md:justify-start gap-2">
              <span className="bg-indigo-600 text-white px-2 rounded-xl">AI</span>
              背单词
            </h1>
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mt-2 text-center md:text-left">UK Accent • Spaced Repetition</p>
          </div>

          <div className="flex bg-slate-100/50 p-1.5 rounded-3xl border border-slate-100 shadow-inner">
            <button 
              onClick={() => setActiveTab('study')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl font-bold text-sm transition-all ${activeTab === 'study' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Book className="w-4 h-4" /> 复习
            </button>
            <button 
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl font-bold text-sm transition-all ${activeTab === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <History className="w-4 h-4" /> 词库
            </button>
            <button 
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl font-bold text-sm transition-all ${activeTab === 'stats' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Trophy className="w-4 h-4" /> 统计
            </button>
          </div>
        </header>

        {activeTab !== 'stats' && (
          <div className="max-w-xl mx-auto mb-12">
            <form onSubmit={handleAdd} className="relative group">
              <input 
                type="text"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                placeholder="输入单词，如: Ephemeral"
                className="w-full bg-white border-2 border-slate-100 rounded-[32px] py-6 pl-14 pr-20 shadow-xl shadow-slate-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all placeholder:text-slate-300 font-bold"
              />
              <Plus className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
              <button 
                type="submit"
                disabled={isLoading || !newWord.trim()}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-900 text-white p-3.5 rounded-2xl hover:bg-slate-800 disabled:opacity-30 active:scale-95 transition-all"
              >
                {isLoading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <ArrowRightLeft className="w-6 h-6" />}
              </button>
            </form>
            {error && <p className="text-red-500 text-xs mt-3 ml-6 font-bold uppercase tracking-tight">{error}</p>}
          </div>
        )}

        <main className="min-h-[400px]">
          {activeTab === 'study' && (
            <div className="space-y-10">
              <div className="flex items-center justify-between px-2 text-center md:text-left">
                <h2 className="text-3xl font-black text-slate-900">今日探索</h2>
                <div className="px-4 py-2 bg-indigo-50 rounded-2xl border border-indigo-100 font-bold text-indigo-600 text-sm">
                  {words.filter(w => !w.nextReview || w.nextReview <= Date.now()).length} 词待复习
                </div>
              </div>

              <AnimatePresence mode="popLayout">
                {studyDue.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-[48px] border-2 border-slate-50 p-24 text-center shadow-sm flex flex-col items-center"
                  >
                    <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-8 shadow-inner">
                      <CheckCircle2 className="w-12 h-12 text-green-500" />
                    </div>
                    <h3 className="text-3xl font-black text-slate-800 mb-2">清空啦！</h3>
                    <p className="text-slate-400 font-medium">所有的单词都已按计划归入短期或长期记忆</p>
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {studyDue.map(word => (
                      <motion.div 
                        key={word.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                      >
                        <WordCard word={word} onReview={handleReview} onDelete={handleDelete} />
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </div>
          )}

          {activeTab === 'list' && (
            <div className="max-w-xl mx-auto space-y-4">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-slate-900">词汇归档</h2>
                <span className="bg-slate-100 text-slate-400 text-[10px] font-black px-4 py-1.5 rounded-full tracking-widest">{words.length} WORDS</span>
              </div>
              <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
                {words.length === 0 ? (
                  <div className="p-20 text-center text-slate-300 font-bold">暂无单词，开始添加吧</div>
                ) : (
                  words.map(w => (
                    <div key={w.id} className="p-6 flex items-center justify-between group hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-5">
                        <div className={`w-3 h-3 rounded-full ${
                          w.status === 'mastered' ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.3)]' : 
                          w.status === 'learning' ? 'bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.3)]' : 'bg-slate-200'
                        }`} />
                        <div>
                          <p className="text-xl font-black text-slate-800 tracking-tight">{w.word}</p>
                          <p className="text-xs font-bold text-slate-400 mt-0.5 truncate max-w-[280px]">{w.meaning}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                         <button onClick={() => speakUK(w.word)} className="p-2 text-slate-300 hover:text-indigo-500 transition-colors">
                           <Volume2 className="w-5 h-5" />
                         </button>
                        <button onClick={() => handleDelete(w.id)} className="p-2 text-slate-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="max-w-xl mx-auto space-y-10">
              <div className="grid grid-cols-2 gap-8">
                <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm relative">
                  <Book className="w-10 h-10 text-indigo-500 mb-6" />
                  <p className="text-5xl font-black text-slate-900 leading-none mb-2">{stats.learning}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">学习进度中</p>
                </div>
                <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm relative">
                  <Trophy className="w-10 h-10 text-yellow-500 mb-6" />
                  <p className="text-5xl font-black text-slate-900 leading-none mb-2">{stats.mastered}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">永久掌握词</p>
                </div>
              </div>

              <div className="bg-slate-900 p-10 rounded-[56px] text-white shadow-2xl">
                <div className="flex justify-between items-end mb-8 text-center md:text-left">
                  <div>
                     <h3 className="text-2xl font-black">记忆总览</h3>
                     <p className="text-slate-500 text-xs font-bold mt-1 uppercase tracking-wider text-center md:text-left">Success Rate & Memory Retention</p>
                  </div>
                  <span className="text-4xl font-black text-indigo-400 tracking-tighter">
                    {Math.round((stats.mastered / (stats.total || 1)) * 100)}%
                  </span>
                </div>
                
                <div className="space-y-10">
                  <div>
                    <ProgressBar value={stats.mastered} max={stats.total} />
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center pt-4">
                    <div>
                      <p className="text-2xl font-black">{stats.total}</p>
                      <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest mt-1">词库总数</p>
                    </div>
                    <div className="flex items-center justify-center">
                       <div className="w-px h-8 bg-slate-800" />
                    </div>
                    <div>
                      <p className="text-2xl font-black text-green-400">{stats.mastered}</p>
                      <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest mt-1">进入长效期</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #F1F5F9; border-radius: 10px; }
      `}} />
    </div>
  );
}
