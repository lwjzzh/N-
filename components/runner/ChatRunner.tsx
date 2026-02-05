
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, User, Bot, Loader2, Sparkles, X, File as FileIcon, Plus, MessageSquare, Trash2, Menu, Edit2, Check, ArrowLeft, Pin, PinOff, ArrowUp, Film, Image as ImageIcon } from 'lucide-react';
import { App, Session } from '../../types/schema';
import { Button } from '../ui/Common';
import { executeApp } from '../../services/workflowEngine';
import { ResultRenderer } from './ResultRenderer';
import { useSessionStore } from '../../store/useSessionStore';
import { useToast } from '../ui/Toast';

interface ChatRunnerProps {
  app: App;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: any;
  attachment?: { name: string; data: string; type: 'image' | 'file' | 'video' };
  isError?: boolean;
}

export const ChatRunner: React.FC<ChatRunnerProps> = ({ app }) => {
  const navigate = useNavigate();
  const { loadSessions, saveSession, deleteSession, togglePinSession, getSessionsByApp } = useSessionStore();
  const { addToast } = useToast();
  
  // State
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [attachment, setAttachment] = useState<{ name: string; data: string; type: 'image' | 'file' | 'video' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  // Rename State
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  // Load Sessions on mount
  useEffect(() => {
      loadSessions();
  }, []);

  const allSessions = getSessionsByApp(app.id, 'chat');
  
  // Split sessions for UI (Pinned vs Others)
  const pinnedSessions = useMemo(() => allSessions.filter(s => s.isPinned), [allSessions]);
  const otherSessions = useMemo(() => allSessions.filter(s => !s.isPinned), [allSessions]);

  // Switch Session
  useEffect(() => {
      if (activeSessionId) {
          const sess = allSessions.find(s => s.id === activeSessionId);
          if (sess) {
              setMessages(sess.data.messages || []);
          }
      } else if (allSessions.length === 0 && !activeSessionId) {
          // Initialize default welcome if no sessions exist
          setMessages([{ id: 'init', role: 'assistant', content: `Hello! I am ${app.name}. How can I help you?` }]);
      }
  }, [activeSessionId, app.id]); 

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, attachment, activeSessionId, isProcessing]);

  // Auto-resize textarea
  useEffect(() => {
    if (textInputRef.current) {
        // Reset height to auto to correctly calculate scrollHeight for shrinking content
        textInputRef.current.style.height = 'auto'; 
        // Set new height based on content, capped at 200px
        const newHeight = Math.min(textInputRef.current.scrollHeight, 200);
        textInputRef.current.style.height = `${newHeight}px`;
    }
  }, [inputValue]);

  const handleNewChat = () => {
      setActiveSessionId(null);
      setMessages([{ id: 'init', role: 'assistant', content: `Hello! I am ${app.name}. How can I help you?` }]);
      setInputValue('');
      setAttachment(null);
      
      if (window.innerWidth < 768) setShowSidebar(false);
      
      setTimeout(() => {
          textInputRef.current?.focus();
      }, 100);
  };

  const handleSelectSession = (id: string) => {
      if (editingSessionId) return; 
      setActiveSessionId(id);
      if (window.innerWidth < 768) setShowSidebar(false);
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
      e.preventDefault(); 
      e.stopPropagation(); 
      
      if(window.confirm("确认删除此对话？")) {
          await deleteSession(id);
          addToast('对话已删除', 'success');
          if (activeSessionId === id) handleNewChat();
      }
  };

  const handleTogglePin = async (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      await togglePinSession(id);
  };

  const startRenaming = (e: React.MouseEvent, session: Session) => {
      e.preventDefault();
      e.stopPropagation();
      setEditingSessionId(session.id);
      setEditNameValue(session.name);
  };

  const saveRename = async (e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      if (editingSessionId) {
          const session = allSessions.find(s => s.id === editingSessionId);
          if (session && editNameValue.trim()) {
              await saveSession({ ...session, name: editNameValue.trim() });
          }
          setEditingSessionId(null);
      }
  };

  const persistCurrentSession = async (currentMsgs: Message[], knownSessionId: string | null): Promise<string> => {
      let sessId = knownSessionId;
      
      if (!sessId) {
          sessId = crypto.randomUUID();
          setActiveSessionId(sessId); 
      }

      let sessName = "New Chat";
      const existing = allSessions.find(s => s.id === sessId);
      if (existing) {
          sessName = existing.name;
      } else {
          const firstUserMsg = currentMsgs.find(m => m.role === 'user');
          if (firstUserMsg && typeof firstUserMsg.content === 'string') {
              sessName = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '');
          }
      }

      const session: Session = {
          id: sessId,
          appId: app.id,
          name: sessName,
          type: 'chat',
          data: { messages: currentMsgs },
          updatedAt: Date.now(),
          isPinned: existing?.isPinned || false
      };
      
      await saveSession(session);
      return sessId;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = () => {
              const dataStr = reader.result as string;
              const isImage = file.type.startsWith('image/');
              const isVideo = file.type.startsWith('video/');
              
              setAttachment({
                  name: file.name,
                  data: dataStr,
                  type: isImage ? 'image' : isVideo ? 'video' : 'file'
              });
          };
          reader.readAsDataURL(file);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
      if ((!inputValue.trim() && !attachment) || isProcessing) return;

      const userText = inputValue;
      const currentAttachment = attachment;
      
      setInputValue('');
      setAttachment(null);
      
      // 1. Add User Message locally
      const newUserMsg: Message = { 
          id: crypto.randomUUID(), 
          role: 'user', 
          content: userText, 
          attachment: currentAttachment || undefined 
      };
      const messagesWithUser = [...messages, newUserMsg];
      setMessages(messagesWithUser);
      
      // 2. Persist (and get stable ID to prevent duplicates)
      const currentStableId = await persistCurrentSession(messagesWithUser, activeSessionId);
      
      setIsProcessing(true);

      // 3. Create Placeholder Bot Message
      const botMsgId = crypto.randomUUID();
      const botPlaceholder: Message = { id: botMsgId, role: 'assistant', content: '' };
      setMessages(prev => [...prev, botPlaceholder]);

      try {
          const structuredInputs: Record<string, Record<string, any>> = {};
          
          app.components.forEach((comp, idx) => {
              structuredInputs[comp.id] = {};
              if (idx === 0) {
                  let textAssigned = false;
                  let fileAssigned = false;
                  comp.parameters.forEach(p => {
                      if (!p.isVisible) return;
                      if ((p.uiType === 'input' || p.uiType === 'textarea') && !textAssigned && userText) {
                          structuredInputs[comp.id][p.key] = userText;
                          textAssigned = true;
                      }
                      if (p.uiType === 'file' && !fileAssigned && currentAttachment) {
                          structuredInputs[comp.id][p.key] = currentAttachment.data;
                          fileAssigned = true;
                      }
                  });
              }
          });

          // History Logic
          const historyArray = messages.filter(m => !m.isError && m.id !== 'init').map(m => ({
              role: m.role,
              content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
          }));

          const currentMsgObj = { 
              role: 'user', 
              content: userText 
          };

          const fullContextArray = [...historyArray, currentMsgObj];

          const context: Record<string, any> = {
              '$session_id': currentStableId,
              '$user_role': 'user',
              '$timestamp': Date.now().toString(),
              '$history': historyArray, 
              '$messages': fullContextArray 
          };

          let finalContent = "";

          await executeApp(app.id, structuredInputs, (compId, status, result, error) => {
              if (status === 'error') throw new Error(error);
              
              if (status === 'running' && typeof result === 'string') {
                  // STREAMING UPDATE
                  finalContent = result;
                  setMessages(prev => prev.map(m => 
                      m.id === botMsgId ? { ...m, content: result } : m
                  ));
              }

              if (status === 'success') {
                  // FINAL RESULT
                  finalContent = result;
                  setMessages(prev => prev.map(m => 
                      m.id === botMsgId ? { ...m, content: result } : m
                  ));
              }
          }, context);

          // Final persist after stream/execution complete
          // Re-fetch latest messages state implicitly via the closure context logic or rebuilding
          // Actually, we must rely on what we just built.
          const finalMsgs = [...messagesWithUser, { id: botMsgId, role: 'assistant' as const, content: finalContent }];
          await persistCurrentSession(finalMsgs, currentStableId);

      } catch (e: any) {
          // Remove placeholder, add error
          setMessages(prev => {
              const filtered = prev.filter(m => m.id !== botMsgId);
              return [...filtered, { id: crypto.randomUUID(), role: 'assistant', content: e.message, isError: true }];
          });
      } finally {
          setIsProcessing(false);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
      }
  };

  // Helper function to render Session Item
  const renderSessionItem = (sess: Session) => (
    <div 
        key={sess.id}
        onClick={() => handleSelectSession(sess.id)}
        className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer text-sm transition-all duration-200 border border-transparent mx-2 mb-1 relative ${activeSessionId === sess.id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200'}`}
    >
        {editingSessionId === sess.id ? (
            <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
                <input 
                    autoFocus
                    className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-primary"
                    value={editNameValue}
                    onChange={e => setEditNameValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveRename()}
                    onBlur={() => saveRename()}
                />
                <button onClick={(e) => saveRename(e)} className="p-1 hover:text-green-400"><Check className="w-3 h-3"/></button>
            </div>
        ) : (
            <>
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <div className="shrink-0">
                         {sess.isPinned ? <Pin className="w-3.5 h-3.5 text-blue-400" /> : <MessageSquare className="w-4 h-4 opacity-70" />}
                    </div>
                    <span className="truncate">{sess.name || 'Untitled Chat'}</span>
                </div>
                
                {/* Action Buttons - Fixed interaction issues with pointer-events */}
                <div className="flex items-center gap-0.5 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity bg-zinc-800/95 rounded-l-md ml-2 pl-1 absolute right-2 top-1/2 -translate-y-1/2 shadow-[-4px_0_8px_rgba(0,0,0,0.5)] z-20">
                    {!sess.isPinned && (
                        <button 
                            onClick={(e) => handleTogglePin(e, sess.id)}
                            className="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-zinc-700 rounded transition-colors"
                            title="置顶"
                        >
                            <Pin className="w-3.5 h-3.5" />
                        </button>
                    )}
                     {sess.isPinned && (
                        <button 
                            onClick={(e) => handleTogglePin(e, sess.id)}
                            className="p-1.5 text-blue-400 hover:text-zinc-400 hover:bg-zinc-700 rounded transition-colors"
                            title="取消置顶"
                        >
                            <PinOff className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button 
                        onClick={(e) => startRenaming(e, sess)}
                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors"
                        title="重命名"
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                        onClick={(e) => handleDeleteSession(e, sess.id)}
                        className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors"
                        title="删除"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </>
        )}
    </div>
  );

  return (
    <div className="flex h-full bg-zinc-950 overflow-hidden relative">
      
      {/* Sidebar Toggle (Mobile) */}
      <button 
        className="md:hidden absolute top-4 left-4 z-50 p-2 bg-zinc-800 rounded-md text-white shadow-lg"
        onClick={() => setShowSidebar(!showSidebar)}
      >
          <Menu className="w-4 h-4" />
      </button>

      {/* History Sidebar */}
      <div className={`w-[260px] bg-black border-r border-zinc-800 flex flex-col transition-all duration-300 absolute md:relative z-40 h-full ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          {/* Sidebar Header: Back & New Chat */}
          <div className="p-3 mb-2 flex flex-col gap-2">
              <div className="flex items-center justify-between px-2 mb-2">
                 <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => navigate('/')} 
                    className="text-zinc-400 hover:text-white px-2"
                 >
                     <ArrowLeft className="w-4 h-4 mr-2" /> 退出
                 </Button>
                 <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-primary" />
                 </div>
              </div>

              <Button 
                onClick={handleNewChat} 
                className="w-full justify-between bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 group" 
                size="md"
              >
                 <span className="flex items-center">
                    <Plus className="w-4 h-4 mr-2" /> 新对话
                 </span>
                 <Edit2 className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50" />
              </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pb-4">
              {/* Active "New Chat" Indicator (Implicit) */}
              {!activeSessionId && allSessions.length > 0 && (
                  <div className="mx-2 px-3 py-2 text-xs font-medium text-primary bg-primary/10 rounded-lg flex items-center gap-2 animate-in fade-in border border-primary/20">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>正在进行新对话...</span>
                  </div>
              )}

              {/* Pinned Sessions */}
              {pinnedSessions.length > 0 && (
                  <div>
                      <div className="px-5 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                          置顶 (Pinned)
                      </div>
                      {pinnedSessions.map(sess => renderSessionItem(sess))}
                  </div>
              )}

              {/* Recent Sessions */}
              {otherSessions.length > 0 && (
                  <div>
                      <div className="px-5 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                          {pinnedSessions.length > 0 ? '其他 (Others)' : '最近 (Recent)'}
                      </div>
                      {otherSessions.map(sess => renderSessionItem(sess))}
                  </div>
              )}

              {allSessions.length === 0 && !activeSessionId && (
                  <div className="text-center py-10 flex flex-col items-center gap-2 opacity-50">
                      <MessageSquare className="w-8 h-8 text-zinc-600" />
                      <span className="text-xs text-zinc-500">无历史记录</span>
                  </div>
              )}
          </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-zinc-950 relative min-w-0">
          {/* Header */}
          <div className="h-14 flex items-center justify-between px-6 bg-transparent shrink-0 z-10">
              <div className="flex items-center gap-2 cursor-pointer hover:bg-zinc-900/50 py-1 px-2 rounded-lg transition-colors">
                  <span className="font-semibold text-zinc-200 text-base">{app.name}</span>
                  <span className="text-xs text-zinc-500 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">GPT-Style</span>
              </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth" ref={scrollRef}>
              <div className="max-w-3xl mx-auto space-y-8 pb-4">
                  {messages.map((msg) => (
                      <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm border ${msg.role === 'user' ? 'bg-zinc-800 border-zinc-700' : msg.isError ? 'bg-red-900/20 text-red-400 border-red-900/30' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>
                              {msg.role === 'user' ? <User className="w-4 h-4 text-zinc-400" /> : <Sparkles className="w-4 h-4" />}
                          </div>
                          
                          <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                              <div className={`rounded-2xl px-5 py-3 shadow-sm text-sm leading-7 ${
                                  msg.role === 'user' 
                                  ? 'bg-zinc-800 text-zinc-100' 
                                  : msg.isError 
                                    ? 'bg-red-950/20 border border-red-900/50 text-red-200'
                                    : 'bg-transparent text-zinc-300 w-full' 
                              }`}>
                                  {msg.role === 'user' ? (
                                      <div className="flex flex-col gap-2">
                                          {msg.attachment && (
                                              <div className="rounded-lg overflow-hidden border border-zinc-600 bg-zinc-900 max-w-[240px]">
                                                  {msg.attachment.type === 'image' ? (
                                                      <img src={msg.attachment.data} alt="attachment" className="w-full h-auto object-cover max-h-[200px]" />
                                                  ) : msg.attachment.type === 'video' ? (
                                                      <div className="relative">
                                                         <video src={msg.attachment.data} controls className="w-full h-auto max-h-[200px]" />
                                                         <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white flex items-center gap-1 pointer-events-none">
                                                             <Film className="w-3 h-3" /> Video
                                                         </div>
                                                      </div>
                                                  ) : (
                                                      <div className="p-3 flex items-center gap-2 text-xs text-zinc-300">
                                                          <FileIcon className="w-4 h-4 shrink-0" />
                                                          <span className="truncate">{msg.attachment.name}</span>
                                                      </div>
                                                  )}
                                              </div>
                                          )}
                                          {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
                                      </div>
                                  ) : (
                                      <div className="min-w-[300px]">
                                          <ResultRenderer result={msg.content} status={msg.isError ? 'error' : 'success'} />
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>
                  ))}
                  
                  {isProcessing && (
                      <div className="flex gap-4">
                          <div className="w-8 h-8 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center shrink-0 border border-green-500/20">
                              <Loader2 className="w-4 h-4 animate-spin" />
                          </div>
                          <div className="flex items-center gap-1 mt-2 p-2">
                              <span className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                              <span className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                              <span className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          </div>
                      </div>
                  )}
              </div>
          </div>

          {/* Input Area (1:1 ChatGPT Style with Auto-resize) */}
          <div className="shrink-0 p-4 pb-6 bg-zinc-950 z-20">
              <div className="max-w-3xl mx-auto flex flex-col items-center">
                {/* Main Input Container - bg-[#2f2f2f], rounded-[26px], items-end for multiline support */}
                <div className="w-full relative flex items-end gap-3 bg-[#2f2f2f] rounded-[26px] p-2 pl-3 shadow-lg transition-colors focus-within:bg-[#383838]">
                    
                    {/* Left Icon (Attachment) - Circular + Button Style */}
                    <div className="shrink-0 mb-1">
                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                        <button 
                            className="w-8 h-8 rounded-full bg-zinc-800/50 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition-colors border border-transparent" 
                            onClick={() => fileInputRef.current?.click()}
                            title="添加附件"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Input Field & Attachments Display */}
                    <div className="flex-1 flex flex-col min-w-0 py-2">
                        {attachment && (
                            <div className="flex items-center gap-3 p-2 mb-2 bg-zinc-800/80 rounded-xl border border-zinc-700/50 w-fit animate-in zoom-in-95 backdrop-blur-sm">
                                <div className="p-1.5 bg-zinc-700 rounded-lg">
                                    {attachment.type === 'image' ? <ImageIcon className="w-4 h-4 text-zinc-300"/> : attachment.type === 'video' ? <Film className="w-4 h-4 text-zinc-300"/> : <FileIcon className="w-4 h-4 text-zinc-300"/>}
                                </div>
                                <span className="text-xs text-zinc-200 max-w-[180px] truncate font-medium">{attachment.name}</span>
                                <button onClick={() => setAttachment(null)} className="ml-1 p-1 hover:bg-zinc-700 rounded-full transition-colors"><X className="w-3.5 h-3.5 text-zinc-400 hover:text-white" /></button>
                            </div>
                        )}
                        <textarea
                                ref={textInputRef}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="有问题，尽管问"
                                rows={1}
                                className="w-full min-h-[24px] max-h-[200px] resize-none bg-transparent border-0 focus:ring-0 p-0 text-[16px] leading-relaxed placeholder:text-zinc-500 text-zinc-100 custom-scrollbar focus:outline-none"
                                style={{ boxShadow: 'none' }}
                        />
                    </div>

                    {/* Right Icon (Send) - Circular, White when active */}
                    <div className="shrink-0 mb-1 mr-1">
                        <button 
                            disabled={(!inputValue.trim() && !attachment) || isProcessing} 
                            onClick={handleSend} 
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                                (inputValue.trim() || attachment) && !isProcessing
                                    ? 'bg-white text-black shadow-md scale-100 hover:bg-zinc-200' 
                                    : 'bg-[#676767] text-[#2f2f2f] cursor-not-allowed'
                            }`}
                        >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin text-white"/> : <ArrowUp className="w-5 h-5" strokeWidth={3} />}
                        </button>
                    </div>
                </div>

                {/* Disclaimer */}
                <div className="mt-3 text-center">
                     <span className="text-[11px] text-zinc-500">OmniFlow can make mistakes. Consider checking important information.</span>
                </div>
              </div>
          </div>
      </div>
    </div>
  );
};
