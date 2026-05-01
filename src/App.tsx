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
  Circle, 
  ArrowRight,
  Flame,
  Volume2,
  Trash2,
  RefreshCw,
  MoreVertical,
  X,
  Languages
} from 'lucide-react';
import { UserWord, LearningStats, WordDefinition } from './types';
import { getWordDefinition, extractWordsFromText } from './lib/gemini';

// --- Components ---

const ProgressBar = ({ value, max, color = "bg-indigo-500" }: { value: number, max: number, color?: string }) => (
  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
    <motion.div 
      initial={{ width: 0 }}
      animate={{ width: `${(value / max) * 100}%` }}
      className={`h-full ${color}`}
    />
  </div>
);

const speakWord = (text: string) => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const ukVoice = voices.find(v => v.lang === 'en-GB' || v.lang.includes('GB')) || voices.find(v => v.lang.startsWith('en'));
  if (ukVoice) utterance.voice = ukVoice;
  utterance.lang = 'en-GB';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
};

// --- Utils ---

const calculateNextReview = (word: UserWord, mastery: 'again' | 'mastered'): Partial<UserWord> => {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  
  if (mastery === 'again') {
    return {
      status: 'learning',
      interval: 0,
      nextReview: now + 5 * 60 * 1000, // 5 minutes later
    };
  } else {
    let nextInterval = 1;
    if (word.interval === 0) nextInterval = 1;
    else if (word.interval === 1) nextInterval = 6;
    else nextInterval = Math.round(word.interval * word.easeFactor);
    
    // Cap interval or transition to mastered if it survives long intervals
    const newStatus = nextInterval > 30 ? 'mastered' : 'learning';
    
    return {
      status: newStatus,
      interval: nextInterval,
      lastReviewed: now,
      nextReview: now + nextInterval * dayMs,
    };
  }
};

const WordCard = ({ 
  word, 
  onReview, 
  onDelete 
}: { 
  word: UserWord, 
  onReview: (id: string, mastery: 'again' | 'mastered') => void,
  onDelete: (id: string) => void
}) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    speakWord(word.word);
  };

  const toggleFlip = () => setIsFlipped(!isFlipped);

  return (
    <div className="relative group perspective-1000 h-64 cursor-pointer" onClick={toggleFlip}>
      <motion.div 
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
        className="w-full h-full relative preserve-3d"
      >
        {/* Front */}
        <div className="absolute inset-0 backface-hidden bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center justify-center shadow-xs group-hover:shadow-md transition-shadow">
          <div className="flex flex-col items-center gap-2 mb-2">
            <h3 className="text-2xl font-bold text-gray-900 text-center break-all">{word.word}</h3>
            <button 
              onClick={handleSpeak}
              className="p-1.5 hover:bg-gray-100 rounded-full text-indigo-500 transition-colors"
            >
              <Volume2 className="w-5 h-5" />
            </button>
          </div>
          {word.phonetic && <p className="text-gray-400 font-mono text-xs mb-4">{word.phonetic}</p>}
          <div className="text-[10px] text-gray-300 font-medium uppercase tracking-widest">
            点击翻转
          </div>
        </div>

        {/* Back */}
        <div 
          className="absolute inset-0 backface-hidden bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex flex-col rotate-y-180 shadow-xs"
        >
          <div className="flex justify-between items-start mb-2">
            <button 
              onClick={handleSpeak} 
              className="text-indigo-400 hover:text-indigo-600 p-1"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(word.id); }}
              className="p-1 hover:bg-indigo-100 rounded-full text-indigo-300 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            <div>
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">释义</p>
              <p className="text-gray-800 font-medium text-xs leading-snug">{word.meaning}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">例句</p>
              <p className="text-gray-600 italic text-[11px] leading-tight">{word.example}</p>
            </div>
          </div>

          <div className="flex gap-1.5 mt-3 pt-3 border-t border-indigo-100">
            <button 
              onClick={(e) => { e.stopPropagation(); onReview(word.id, 'again'); }}
              className="flex-1 py-2 text-[10px] font-bold rounded-lg border bg-white text-orange-600 border-orange-100 hover:bg-orange-50 transition-all"
            >
              不熟
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onReview(word.id, 'mastered'); }}
              className="flex-1 py-2 text-[10px] font-bold rounded-lg border bg-green-500 text-white border-transparent hover:bg-green-600 transition-all shadow-sm"
            >
              掌握
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [words, setWords] = useState<UserWord[]>(() => {
    const saved = localStorage.getItem('vocab_words');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [newWord, setNewWord] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'study' | 'list' | 'stats'>('study');
  const [error, setError] = useState<string | null>(null);
  const [pendingWords, setPendingWords] = useState<string[]>([]);
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());

  useEffect(() => {
    localStorage.setItem('vocab_words', JSON.stringify(words));
  }, [words]);

  const stats = useMemo<LearningStats>(() => ({
    totalWords: words.length,
    masteredWords: words.filter(w => w.status === 'mastered').length,
    learningWords: words.filter(w => w.status === 'learning').length,
    streak: 0, 
  }), [words]);

  const handleAddWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    const input = newWord.trim();
    const isSentence = input.includes(' ') || input.length > 20 || input.includes('\n');

    try {
      if (isSentence) {
        const extracted = await extractWordsFromText(input);
        const uniqueNew = extracted.filter(w => 
          !words.some(existing => existing.word.toLowerCase() === w.toLowerCase())
        );
        if (uniqueNew.length > 0) {
          setPendingWords(uniqueNew);
          setSelectedWords(new Set(uniqueNew));
        } else {
          setError('未识别到新单词或单词全部已存在');
        }
      } else {
        if (words.some(w => w.word.toLowerCase() === input.toLowerCase())) {
          setError('单词已在列表中');
        } else {
          const def = await getWordDefinition(input);
          const wordObj: UserWord = {
            ...def,
            id: Math.random().toString(36).substr(2, 9),
            status: 'new',
            addedAt: Date.now(),
            nextReview: Date.now(), // Due immediately
            easeFactor: 2.5,
            interval: 0,
          };
          setWords(prev => [wordObj, ...prev]);
          setNewWord('');
          speakWord(wordObj.word);
        }
      }
    } catch (err) {
      setError('处理失败，请检查网络或重试');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmBulkAdd = async () => {
    setIsLoading(true);
    const toAdd = Array.from(selectedWords);
    setPendingWords([]);
    
    try {
      const results = await Promise.all(
        toAdd.map(async (w) => {
          try {
            return await getWordDefinition(w);
          } catch (e) {
            return null;
          }
        })
      );

      const newWords: UserWord[] = results
        .filter((r): r is WordDefinition => r !== null)
        .map(def => ({
          ...def,
          id: Math.random().toString(36).substr(2, 9),
          status: 'new',
          addedAt: Date.now(),
          nextReview: Date.now(),
          easeFactor: 2.5,
          interval: 0,
        }));

      setWords(prev => [...newWords, ...prev]);
      setNewWord('');
    } catch (err) {
      setError('批量添加部分失败');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelectedWord = (w: string) => {
    const next = new Set(selectedWords);
    if (next.has(w)) next.delete(w);
    else next.add(w);
    setSelectedWords(next);
  };

  const handleReview = (id: string, mastery: 'again' | 'mastered') => {
    setWords(prev => prev.map(w => {
      if (w.id === id) {
        const updates = calculateNextReview(w, mastery);
        return { ...w, ...updates };
      }
      return w;
    }));
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个单词吗？')) {
      setWords(prev => prev.filter(w => w.id !== id));
    }
  };

  // Ebbinghaus logic: Filter words where nextReview <= now
  // Also shuffle to make the "random" element
  const studySessionWords = useMemo(() => {
    const now = Date.now();
    const due = words.filter(w => !w.nextReview || w.nextReview <= now || w.status === 'new');
    return due.sort(() => Math.random() - 0.5).slice(0, 6);
  }, [words, activeTab]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Dynamic Max Width based on tab */}
      <div className={`mx-auto px-4 pt-8 pb-32 transition-all duration-500 ${activeTab === 'study' ? 'max-w-6xl' : 'max-w-xl'}`}>
        
        {/* Header */}
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-lg">AI</span>
              背单词
            </h1>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Ebbinghaus Spaced Repetition</p>
          </div>
          <div className="flex bg-white rounded-full p-1.5 shadow-sm border border-gray-100">
            <button 
              onClick={() => setActiveTab('study')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'study' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Book className="w-4 h-4" /> 学习复习
            </button>
            <button 
              onClick={() => setActiveTab('list')}
              className={`p-2 px-3 rounded-full transition-all ${activeTab === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <History className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setActiveTab('stats')}
              className={`p-2 px-3 rounded-full transition-all ${activeTab === 'stats' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Trophy className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Global Nav-like Search in List mode would be here, but common search is better */}
        {activeTab !== 'study' && (
          <section className="mb-8 max-w-xl mx-auto">
            <form onSubmit={handleAddWord} className="relative group">
              <textarea 
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                placeholder="添加单个单词或复制文章段落..."
                rows={newWord.includes('\n') || newWord.length > 50 ? 3 : 1}
                className="w-full bg-white border border-gray-200 rounded-2xl py-4 pl-12 pr-4 shadow-xs focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition-all placeholder:text-gray-400 font-medium resize-none shadow-sm"
              />
              <Search className="absolute left-4 top-5 w-5 h-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
              <button 
                type="submit"
                disabled={isLoading || !newWord.trim()}
                className="absolute right-2 top-2 bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 active:scale-95 disabled:opacity-50 transition-all"
              >
                {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              </button>
            </form>
            {error && <p className="text-red-500 text-xs mt-2 ml-4 font-medium">{error}</p>}
          </section>
        )}

        {/* Bulk Selection Overlay */}
        <AnimatePresence>
          {pendingWords.length > 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-indigo-900/10 backdrop-blur-md"
            >
              <motion.div 
                initial={{ y: 20, scale: 0.95 }}
                animate={{ y: 0, scale: 1 }}
                className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl flex flex-col max-h-[85vh]"
              >
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-2xl font-black">发现新词汇</h3>
                    <p className="text-sm text-gray-400 font-medium">勾选你想开始学习的单词</p>
                  </div>
                  <button onClick={() => setPendingWords([])} className="p-2 hover:bg-gray-100 rounded-full">
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2.5 mb-8">
                  {pendingWords.map(word => (
                    <button 
                      key={word}
                      onClick={() => toggleSelectedWord(word)}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                        selectedWords.has(word) 
                        ? 'border-indigo-600 bg-indigo-50/30 text-indigo-900 pointer-events-auto' 
                        : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                        selectedWords.has(word) ? 'bg-indigo-600 border-indigo-600 shadow-indigo-100' : 'border-gray-200'
                      }`}>
                        {selectedWords.has(word) && <CheckCircle2 className="w-4 h-4 text-white" />}
                      </div>
                      <span className="font-bold text-lg">{word}</span>
                    </button>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setPendingWords([])}
                    className="flex-1 py-4 font-bold text-gray-400 bg-gray-50 rounded-2xl hover:bg-gray-100"
                  >
                    再想想
                  </button>
                  <button 
                    onClick={confirmBulkAdd}
                    disabled={selectedWords.size === 0 || isLoading}
                    className="flex-[2] py-4 font-black text-white bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    确认加入 ({selectedWords.size})
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Area */}
        <main>
          {activeTab === 'study' && (
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-black text-gray-900">今日复习</h2>
                  <p className="text-gray-400 text-sm font-medium">按艾宾浩斯曲线为你匹配了最需要复习的词汇</p>
                </div>
                {activeTab === 'study' && (
                  <div className="flex bg-white p-2 rounded-2xl border border-gray-100 shadow-sm gap-4">
                    <div className="flex items-center gap-2 px-2">
                       <Circle className="w-3 h-3 text-indigo-500 fill-indigo-500" />
                       <span className="text-xs font-bold text-gray-600">{words.filter(w => w.status !== 'mastered').length} 待复习</span>
                    </div>
                    <button 
                      onClick={() => speakWord(studySessionWords.map(w => w.word).join(', '))}
                      className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                      批量朗读
                    </button>
                  </div>
                )}
              </div>

              {/* 3x3 Grid Layout */}
              <AnimatePresence mode="popLayout">
                {studySessionWords.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-[40px] p-24 text-center border-4 border-dashed border-gray-50 flex flex-col items-center"
                  >
                    <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
                      <CheckCircle2 className="w-12 h-12 text-green-500" />
                    </div>
                    <h3 className="text-3xl font-black mb-2">清空啦！</h3>
                    <p className="text-gray-400 font-medium mb-8">目前所有单词都处于科学记忆周期内，休息一下吧</p>
                    <button 
                      onClick={() => setActiveTab('list')}
                      className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-indigo-100 hover:scale-105 transition-transform"
                    >
                      去词库转转
                    </button>
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {studySessionWords.map((word) => (
                      <motion.div 
                        key={word.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                      >
                        <WordCard 
                          word={word} 
                          onReview={handleReview} 
                          onDelete={handleDelete}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
              
              {studySessionWords.length > 0 && (
                <div className="text-center pt-8">
                  <p className="text-gray-300 text-xs font-black uppercase tracking-[0.2em]">高效学习建议：每次复习 6 个单词效果最佳</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'list' && (
            <div className="max-w-xl mx-auto space-y-4">
              <div className="flex justify-between items-center mb-4 px-2">
                <h2 className="text-xl font-black">我的私人词库库</h2>
                <span className="text-xs font-mono text-gray-400 bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100">{words.length} WORDS</span>
              </div>
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                {words.length === 0 ? (
                  <div className="p-20 text-center text-gray-300 font-medium">空空如也，快去添加单词吧</div>
                ) : (
                  words.map(word => (
                    <div key={word.id} className="p-5 flex items-center justify-between group hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full shadow-sm ${
                          word.status === 'mastered' ? 'bg-green-500' : 
                          word.status === 'learning' ? 'bg-indigo-500' : 'bg-gray-200'
                        }`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-black text-gray-900 text-lg">{word.word}</p>
                            <button onClick={() => speakWord(word.word)} className="text-gray-300 hover:text-indigo-500">
                              <Volume2 className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-xs text-gray-400 font-medium truncate max-w-[240px] uppercase tracking-tighter">{word.meaning}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleDelete(word.id)} className="opacity-0 group-hover:opacity-100 p-2 text-gray-300 hover:text-red-500 transition-all">
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
            <div className="max-w-xl mx-auto space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm overflow-hidden relative">
                  <div className="absolute -right-4 -top-4 w-20 h-20 bg-orange-50 rounded-full blur-2xl opacity-50" />
                  <Flame className="w-8 h-8 text-orange-500 mb-4" />
                  <p className="text-4xl font-black">{stats.streak}</p>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mt-1">坚持天数</p>
                </div>
                <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm overflow-hidden relative">
                  <div className="absolute -right-4 -top-4 w-20 h-20 bg-yellow-50 rounded-full blur-2xl opacity-50" />
                  <Trophy className="w-8 h-8 text-yellow-500 mb-4" />
                  <p className="text-4xl font-black">{stats.masteredWords}</p>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mt-1">永久掌握</p>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm space-y-8">
                <div>
                  <div className="flex justify-between items-end mb-4">
                    <p className="text-lg font-black text-gray-800">学习进度</p>
                    <p className="text-2xl font-black text-indigo-600">{Math.round((stats.masteredWords / (stats.totalWords || 1)) * 100)}%</p>
                  </div>
                  <ProgressBar value={stats.masteredWords} max={stats.totalWords || 1} color="bg-indigo-600" />
                </div>
                
                <div className="pt-8 border-t border-gray-50 flex justify-around text-center">
                  <div>
                    <p className="text-2xl font-black">{stats.totalWords}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">词库总量</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-indigo-500">{stats.learningWords}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">记忆中</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-green-500">{stats.masteredWords}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">已攻克</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Global Styles */}
        <style dangerouslySetInnerHTML={{ __html: `
          .perspective-1000 { perspective: 1000px; }
          .preserve-3d { transform-style: preserve-3d; }
          .backface-hidden { backface-visibility: hidden; }
          .rotate-y-180 { transform: rotateY(180deg); }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
        `}} />
      </div>
    </div>
  );
}
