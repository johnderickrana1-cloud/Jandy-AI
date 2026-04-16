/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Paperclip, 
  X, 
  FileText, 
  Image as ImageIcon, 
  Loader2, 
  Terminal,
  Cpu,
  Zap,
  Menu,
  History,
  Plus,
  Trash2,
  ChevronLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { chatWithJandy, chatWithJandyStream } from '@/lib/gemini';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  files?: AttachedFile[];
}

interface AttachedFile {
  name: string;
  type: string;
  data: string; // base64
  preview?: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
}

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load sessions from localStorage
  useEffect(() => {
    const savedSessions = localStorage.getItem('jandy_ai_sessions');
    if (savedSessions) {
      const parsed = JSON.parse(savedSessions);
      setSessions(parsed);
      if (parsed.length > 0) {
        setCurrentSessionId(parsed[0].id);
      } else {
        createNewSession();
      }
    } else {
      createNewSession();
    }
  }, []);

  // Save sessions to localStorage
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('jandy_ai_sessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const messages = currentSession?.messages || [];

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'Bagong Chat',
      messages: [
        {
          id: '1',
          role: 'model',
          text: 'Kumusta! Ako si Jandy AI. Handa akong tumulong sa iyong mga katanungan o sa pag-edit ng iyong mga files. Ano ang maipaglilingkod ko sa iyo ngayon?'
        }
      ],
      timestamp: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setIsSidebarOpen(false);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    if (currentSessionId === id) {
      if (updated.length > 0) {
        setCurrentSessionId(updated[0].id);
      } else {
        createNewSession();
      }
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: AttachedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const base64 = await fileToBase64(file);
      newFiles.push({
        name: file.name,
        type: file.type,
        data: base64,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      });
    }
    setAttachedFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!input.trim() && attachedFiles.length === 0) return;
    if (!currentSessionId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      files: attachedFiles.length > 0 ? [...attachedFiles] : undefined
    };

    // Update current session with user message
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        const updatedMessages = [...s.messages, userMessage];
        // Update title if it's the first user message
        const newTitle = s.title === 'Bagong Chat' ? input.slice(0, 30) + (input.length > 30 ? '...' : '') : s.title;
        return { ...s, messages: updatedMessages, title: newTitle };
      }
      return s;
    }));

    setInput('');
    setAttachedFiles([]);
    setIsTyping(true);

    try {
      const history = messages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));

      const currentParts: any[] = [{ text: userMessage.text }];
      if (userMessage.files) {
        userMessage.files.forEach(file => {
          currentParts.push({
            inlineData: {
              mimeType: file.type,
              data: file.data
            }
          });
        });
      }

      // Create a placeholder for the model message
      const modelMessageId = (Date.now() + 1).toString();
      const modelMessage: Message = {
        id: modelMessageId,
        role: 'model',
        text: ''
      };

      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          return { ...s, messages: [...s.messages, modelMessage] };
        }
        return s;
      }));

      const stream = await chatWithJandyStream([...history, { role: 'user', parts: currentParts }]);
      
      let fullText = '';
      let isFirstChunk = true;

      for await (const chunk of stream) {
        if (isFirstChunk) {
          setIsTyping(false); // Hide loader only when the first chunk arrives
          isFirstChunk = false;
        }
        
        const chunkText = chunk.text || '';
        if (chunkText) {
          fullText += chunkText;
          setSessions(prev => prev.map(s => {
            if (s.id === currentSessionId) {
              return {
                ...s,
                messages: s.messages.map(m => 
                  m.id === modelMessageId ? { ...m, text: fullText } : m
                )
              };
            }
            return s;
          }));
        }
      }

      if (!fullText) {
        setSessions(prev => prev.map(s => {
          if (s.id === currentSessionId) {
            return {
              ...s,
              messages: s.messages.map(m => 
                m.id === modelMessageId ? { ...m, text: 'Paumanhin, nagkaroon ng error sa aking system.' } : m
              )
            };
          }
          return s;
        }));
      }
    } catch (error) {
      console.error(error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: 'Error connecting to Jandy AI. Please check your connection.'
      };
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          return { ...s, messages: [...s.messages, errorMessage] };
        }
        return s;
      }));
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background selection:bg-neon-blue selection:text-black overflow-hidden">
      {/* Header */}
      <header className="h-16 md:h-20 flex items-center justify-between px-4 md:px-10 bg-black/80 border-b-2 border-neon-blue glow-blue shrink-0 z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="md:hidden text-neon-blue p-2 hover:bg-neon-blue/10 rounded-lg"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="font-mono text-xl md:text-[28px] font-black tracking-[2px] md:tracking-[4px] text-neon-blue text-glow-blue uppercase truncate">
            JANDY // AI
          </div>
        </div>
        <div className="hidden sm:block text-[10px] tracking-[2px] px-3 py-1 border border-neon-red text-neon-red uppercase">
          Neural Engine: Active
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar / History Drawer */}
        <aside className={cn(
          "absolute inset-y-0 left-0 z-40 w-72 bg-black/95 border-r border-border-blue transition-transform duration-300 ease-in-out md:relative md:translate-x-0 flex flex-col",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="p-4 flex flex-col h-full gap-6">
            <Button 
              onClick={createNewSession}
              className="w-full bg-neon-blue/10 border border-neon-blue text-neon-blue hover:bg-neon-blue/20 flex items-center gap-2 rounded-none"
            >
              <Plus className="w-4 h-4" />
              <span>BAGONG CHAT</span>
            </Button>

            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
              <div className="flex items-center gap-2 text-[11px] text-neon-blue uppercase tracking-[2px] opacity-80">
                <History className="w-4 h-4" />
                <span>Chat History</span>
              </div>
              
              <ScrollArea className="flex-1">
                <div className="space-y-2 pr-2">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => {
                        setCurrentSessionId(session.id);
                        setIsSidebarOpen(false);
                      }}
                      className={cn(
                        "group p-3 border cursor-pointer transition-all flex items-center justify-between",
                        currentSessionId === session.id 
                          ? "bg-neon-blue/10 border-neon-blue text-neon-blue" 
                          : "bg-glass border-transparent hover:border-border-blue text-muted-foreground"
                      )}
                    >
                      <div className="flex flex-col gap-1 overflow-hidden">
                        <span className="text-xs font-mono truncate">{session.title}</span>
                        <span className="text-[9px] opacity-40">{new Date(session.timestamp).toLocaleDateString()}</span>
                      </div>
                      <button 
                        onClick={(e) => deleteSession(session.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-neon-red transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="pt-4 border-t border-border-blue/30">
              <div className="text-[11px] text-neon-blue uppercase tracking-[2px] mb-3 opacity-80">Interface Config</div>
              <div className="text-[10px] opacity-60 font-mono space-y-1">
                <div>[X] Tagalog_NLP_v4.2</div>
                <div>[X] Stealth_Bypass_ON</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col min-w-0 relative">
          <ScrollArea className="flex-1 p-4 md:p-10" ref={scrollRef}>
            <div className="max-w-3xl mx-auto flex flex-col gap-6">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      "max-w-[90%] md:max-w-[75%] p-4 md:p-5 relative text-sm md:text-[14px] leading-[1.5]",
                      msg.role === 'user' 
                        ? "self-end bg-neon-red/10 border-r-3 border-neon-red text-right" 
                        : "self-start bg-neon-blue/10 border-l-3 border-neon-blue"
                    )}
                  >
                    <span className={cn(
                      "font-mono text-[9px] mb-1 block",
                      msg.role === 'user' ? "text-neon-red" : "text-neon-blue"
                    )}>
                      {msg.role === 'user' ? 'USER_INPUT' : 'JANDY_SYSTEM'}
                    </span>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    
                    {msg.files && (
                      <div className={cn(
                        "mt-3 flex flex-wrap gap-2",
                        msg.role === 'user' ? "justify-end" : "justify-start"
                      )}>
                        {msg.files.map((file, i) => (
                          <div key={i} className="bg-black/40 p-2 border border-white/10 flex items-center gap-2 text-[10px]">
                            {file.preview ? (
                              <img src={file.preview} alt="preview" className="w-6 h-6 object-cover" />
                            ) : (
                              <FileText className="w-3 h-3 text-neon-blue" />
                            )}
                            <span className="truncate max-w-[80px]">{file.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {isTyping && (
                <div className="flex items-center gap-2 text-neon-blue/60 font-mono text-[10px] uppercase tracking-widest">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Processing Data...</span>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer / Input Area */}
          <footer className="p-4 md:px-10 md:pb-8 flex flex-col gap-4 max-w-4xl mx-auto w-full">
            {/* File Previews Overlay */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-black/80 border border-border-blue">
                {attachedFiles.map((file, i) => (
                  <div key={i} className="relative group bg-glass border border-border-blue p-2 flex items-center gap-2 text-[10px]">
                    {file.preview ? (
                      <img src={file.preview} alt="preview" className="w-8 h-8 object-cover" />
                    ) : (
                      <FileText className="w-4 h-4 text-neon-blue" />
                    )}
                    <span className="truncate max-w-[100px]">{file.name}</span>
                    <button 
                      onClick={() => removeFile(i)}
                      className="absolute -top-2 -right-2 bg-neon-red text-white rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 md:gap-4">
              <div className="flex-1 relative min-h-[50px] border border-border-blue bg-black/50 flex items-center px-4 input-accent">
                <div className="hidden sm:block absolute -top-6 left-0 text-[10px] text-[#00ff66] font-mono">
                  ● UNDETECTABLE MODE: 100% STEALTH
                </div>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Mag-type dito..."
                  className="w-full bg-transparent border-none focus:ring-0 resize-none text-[13px] font-mono text-neon-blue placeholder:text-border-blue outline-none py-3"
                  rows={1}
                />
              </div>

              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-[50px] h-[50px] border border-neon-red flex items-center justify-center text-neon-red hover:bg-neon-red/10 transition-colors shrink-0"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              <button 
                onClick={handleSend}
                disabled={!input.trim() && attachedFiles.length === 0}
                className="w-[50px] h-[50px] bg-neon-blue border border-neon-blue flex items-center justify-center text-black hover:bg-neon-blue/80 transition-colors shrink-0"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
