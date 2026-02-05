
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, RefreshCw, Upload, FileCheck, History, X, Save, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { App, ParamUiType, ParamDefinition, Session } from '../../types/schema';
import { Button, Input, Textarea, Select, Badge } from '../ui/Common';
import { ResultRenderer } from './ResultRenderer';
import { executeApp } from '../../services/workflowEngine';
import { useSessionStore } from '../../store/useSessionStore';

interface PanelRunnerProps {
  app: App;
}

interface ComponentState {
  id: string;
  status: 'idle' | 'running' | 'success' | 'error';
  result: any;
  error?: string;
}

export const PanelRunner: React.FC<PanelRunnerProps> = ({ app }) => {
  const navigate = useNavigate();
  const { loadSessions, saveSession, getSessionsByApp } = useSessionStore();

  const [inputValues, setInputValues] = useState<Record<string, Record<string, string>>>({});
  const [compStates, setCompStates] = useState<Record<string, ComponentState>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState<any[]>([]); 
  const [showHistory, setShowHistory] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Constants
  const SESSION_ID = `panel_latest_${app.id}`;
  const SAVE_DELAY = 2000; 

  // 1. Load Session & Init
  useEffect(() => {
      const init = async () => {
          await loadSessions();
          
          // Try find existing state
          const sessions = getSessionsByApp(app.id, 'panel');
          const lastSession = sessions.find(s => s.id === SESSION_ID);

          const defaults: Record<string, Record<string, string>> = {};
          const states: Record<string, ComponentState> = {};

          app.components.forEach(comp => {
            defaults[comp.id] = {};
            // Restore from session if exists, otherwise defaults
            if (lastSession?.data?.inputs?.[comp.id]) {
                defaults[comp.id] = lastSession.data.inputs[comp.id];
            } else {
                comp.parameters.forEach(p => {
                    if (p.isVisible) {
                        if (p.uiType === 'boolean') {
                            defaults[comp.id][p.key] = p.value === 'true' ? 'true' : 'false';
                        } else {
                            defaults[comp.id][p.key] = p.value || '';
                        }
                    }
                });
            }
            states[comp.id] = { id: comp.id, status: 'idle', result: null };
          });
          
          setInputValues(defaults);
          setCompStates(states);
          setIsInitialized(true);
      };
      init();
  }, [app.id]);

  // 2. Custom Debounced Auto-Save
  const inputsRef = useRef(inputValues);
  useEffect(() => { inputsRef.current = inputValues; }, [inputValues]);

  useEffect(() => {
      if (!isInitialized) return;

      const timer = setTimeout(async () => {
          setIsSaving(true);
          const session: Session = {
              id: SESSION_ID,
              appId: app.id,
              name: 'Latest Panel State',
              type: 'panel',
              data: { inputs: inputsRef.current },
              updatedAt: Date.now()
          };
          await saveSession(session);
          setIsSaving(false);
      }, SAVE_DELAY);

      return () => clearTimeout(timer);
  }, [inputValues, isInitialized, app.id]);


  const handleInputChange = (compId: string, key: string, val: string) => {
      setInputValues(prev => ({
          ...prev,
          [compId]: { ...prev[compId], [key]: val }
      }));
  };

  const handleFileChange = (compId: string, key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = () => handleInputChange(compId, key, reader.result as string);
        reader.readAsDataURL(file);
    }
  };

  const runPipeline = async () => {
      setIsRunning(true);
      
      setCompStates(prev => {
          const next = { ...prev };
          app.components.forEach(c => {
             next[c.id] = { ...next[c.id], status: 'idle', error: undefined };
          });
          return next;
      });

      // Inject Context
      const context = {
          '$session_id': SESSION_ID,
          '$timestamp': Date.now().toString()
      };

      try {
          await executeApp(
              app.id, 
              inputValues,
              (compId, status, result, error) => {
                  setCompStates(prev => ({
                      ...prev,
                      [compId]: { id: compId, status, result, error }
                  }));
              },
              context
          );
      } catch (e) {
          console.error("Pipeline failed", e);
      } finally {
          setIsRunning(false);
      }
  };

  const activeResultCompId = [...app.components].reverse().find(c => compStates[c.id]?.status === 'success' || compStates[c.id]?.status === 'error')?.id;
  const activeState = activeResultCompId ? compStates[activeResultCompId] : null;

  useEffect(() => {
      if (!isRunning && activeState && activeState.status === 'success') {
          setHistory(prev => {
              if (prev[0]?.ts && Date.now() - prev[0].ts < 1000) return prev; 
              return [{ ts: Date.now(), result: activeState.result, status: 'success' }, ...prev];
          });
      }
  }, [isRunning, activeState]);

  if (!isInitialized) {
      return (
          <div className="flex h-full items-center justify-center text-zinc-500">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading State...
          </div>
      );
  }

  // Helper to render specific input types
  const renderInput = (comp: any, param: ParamDefinition) => {
      const val = inputValues[comp.id]?.[param.key] || '';

      switch (param.uiType) {
          case 'textarea':
              return (
                  <Textarea 
                      label={param.label}
                      placeholder={param.value}
                      value={val}
                      onChange={e => handleInputChange(comp.id, param.key, e.target.value)}
                  />
              );
          case 'select':
              return (
                  <Select 
                      label={param.label}
                      options={param.options || []}
                      value={val}
                      onChange={e => handleInputChange(comp.id, param.key, e.target.value)}
                  />
              );
          case 'radio':
              return (
                  <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-muted">{param.label}</label>
                      <div className="flex flex-wrap gap-4">
                          {(param.options || []).map((opt) => (
                              <label key={opt.value} className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer hover:text-white">
                                  <input 
                                    type="radio"
                                    name={`${comp.id}_${param.key}`}
                                    value={opt.value}
                                    checked={val === opt.value}
                                    onChange={e => handleInputChange(comp.id, param.key, e.target.value)}
                                    className="accent-primary w-4 h-4"
                                  />
                                  {opt.label}
                              </label>
                          ))}
                      </div>
                  </div>
              );
          case 'boolean': // Checkbox
              return (
                  <div className="flex items-center gap-3 mt-4">
                      <input 
                          type="checkbox"
                          id={`${comp.id}_${param.key}`}
                          checked={val === 'true'}
                          onChange={e => handleInputChange(comp.id, param.key, e.target.checked ? 'true' : 'false')}
                          className="w-5 h-5 accent-primary rounded cursor-pointer"
                      />
                      <label htmlFor={`${comp.id}_${param.key}`} className="text-sm font-medium text-zinc-200 cursor-pointer select-none">
                          {param.label}
                      </label>
                  </div>
              );
          case 'file':
              return (
                  <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-muted">{param.label}</label>
                      <label className="flex items-center justify-between w-full px-3 py-2 bg-background border border-border rounded-md cursor-pointer hover:border-zinc-600 transition-colors">
                            <div className="flex items-center gap-2 text-zinc-400 text-sm">
                                <Upload className="w-4 h-4" />
                                <span>{val ? '文件已选择 (File Selected)' : '上传文件 (Upload File)'}</span>
                            </div>
                            {val && <FileCheck className="w-4 h-4 text-green-500" />}
                            <input type="file" className="hidden" onChange={(e) => handleFileChange(comp.id, param.key, e)} />
                      </label>
                  </div>
              );
          case 'number':
              return (
                  <Input 
                      label={param.label}
                      type="number"
                      placeholder={param.value}
                      value={val}
                      onChange={e => handleInputChange(comp.id, param.key, e.target.value)}
                  />
              );
          case 'date':
              return (
                  <Input 
                      label={param.label}
                      type="date"
                      value={val}
                      onChange={e => handleInputChange(comp.id, param.key, e.target.value)}
                  />
              );
          case 'email':
              return (
                  <Input 
                      label={param.label}
                      type="email"
                      placeholder="user@example.com"
                      value={val}
                      onChange={e => handleInputChange(comp.id, param.key, e.target.value)}
                  />
              );
          case 'password':
              return (
                  <Input 
                      label={param.label}
                      type="password"
                      placeholder={param.value}
                      value={val}
                      onChange={e => handleInputChange(comp.id, param.key, e.target.value)}
                  />
              );
          default: // input / text
              return (
                  <Input 
                      label={param.label}
                      type="text"
                      placeholder={param.value}
                      value={val}
                      onChange={e => handleInputChange(comp.id, param.key, e.target.value)}
                  />
              );
      }
  };

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* Left Column: Control Panel */}
      <div className="w-[400px] xl:w-[450px] flex flex-col border-r border-border bg-surface/30 z-10 shrink-0">
          <div className="p-4 border-b border-border flex justify-between items-center gap-4">
              <div className="flex items-center gap-3 overflow-hidden">
                  <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="px-0 w-8 shrink-0 text-zinc-400 hover:text-white">
                      <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <div className="flex flex-col overflow-hidden">
                      <h2 className="text-lg font-bold text-white leading-tight truncate">{app.name}</h2>
                      <p className="text-xs text-zinc-500 truncate">{app.description}</p>
                  </div>
              </div>
              <div className={`shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors ${isSaving ? 'bg-blue-900/30 text-blue-400 border-blue-900' : 'bg-zinc-900 text-zinc-500 border-zinc-800'}`}>
                  {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  {isSaving ? 'Saving...' : 'Auto-Saved'}
              </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {app.components.map((comp, idx) => {
                  const visibleParams = comp.parameters.filter(p => p.isVisible);
                  if (visibleParams.length === 0) return null;

                  return (
                      <div key={comp.id} className="space-y-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
                              <span className="flex items-center justify-center w-5 h-5 rounded bg-zinc-800 text-xs text-zinc-500">{idx + 1}</span>
                              {comp.name}
                          </div>
                          
                          <div className="space-y-4 pl-2 border-l-2 border-zinc-800 ml-2">
                              {visibleParams.map(param => (
                                  <div key={param.id} className="pl-4">
                                      {renderInput(comp, param)}
                                  </div>
                              ))}
                          </div>
                      </div>
                  );
              })}
          </div>

          <div className="p-6 border-t border-border bg-surface/80 backdrop-blur-sm">
              <Button 
                size="lg" 
                className="w-full shadow-xl shadow-primary/20" 
                onClick={runPipeline}
                disabled={isRunning}
                icon={isRunning ? RefreshCw : Play}
              >
                  {isRunning ? '运行中...' : '运行应用 (Run)'}
              </Button>
          </div>
      </div>

      {/* Right Column: Preview */}
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-950 relative">
          <div className="h-14 border-b border-border flex items-center justify-between px-6 bg-zinc-900/50">
              <span className="text-sm font-medium text-zinc-400">执行结果 (Result)</span>
              <Button variant="ghost" size="sm" icon={History} onClick={() => setShowHistory(!showHistory)}>
                  History
              </Button>
          </div>

          <div className="flex-1 p-8 overflow-auto flex flex-col items-center">
               <div className="w-full h-full max-w-4xl bg-zinc-900/30 border border-zinc-800/50 rounded-2xl overflow-hidden shadow-2xl relative">
                   {activeState ? (
                       <ResultRenderer 
                          result={activeState.result} 
                          status={activeState.status} 
                          error={activeState.error} 
                       />
                   ) : (
                       <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-4">
                           <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                               <Play className="w-8 h-8 opacity-20" />
                           </div>
                           <p>配置左侧参数并点击运行。</p>
                       </div>
                   )}
                   
                   {/* Step Indicators */}
                   {isRunning && (
                       <div className="absolute bottom-6 right-6 flex gap-2">
                           {app.components.map(c => {
                               const st = compStates[c.id];
                               return (
                                   <div key={c.id} className={`w-3 h-3 rounded-full transition-all ${st.status === 'running' ? 'bg-primary animate-bounce' : st.status === 'success' ? 'bg-green-500' : st.status === 'error' ? 'bg-red-500' : 'bg-zinc-700'}`} title={c.name} />
                               );
                           })}
                       </div>
                   )}
               </div>
          </div>

          {/* History Sidebar */}
          {showHistory && (
              <div className="absolute right-0 top-14 bottom-0 w-80 bg-zinc-900 border-l border-zinc-800 shadow-2xl z-20 animate-in slide-in-from-right duration-200 flex flex-col">
                  <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                      <span className="font-bold text-sm">历史记录</span>
                      <button onClick={() => setShowHistory(false)}><X className="w-4 h-4 text-zinc-500 hover:text-white"/></button>
                  </div>
                  <div className="flex-1 overflow-auto p-4 space-y-4">
                      {history.length === 0 && <p className="text-zinc-600 text-xs text-center py-4">暂无历史。</p>}
                      {history.map((h, i) => (
                          <div key={i} className="p-3 rounded bg-zinc-950 border border-zinc-800 text-xs hover:border-zinc-600 transition-colors cursor-pointer">
                              <div className="flex justify-between text-zinc-500 mb-2">
                                  <span>{new Date(h.ts).toLocaleTimeString()}</span>
                                  <Badge variant="success">Success</Badge>
                              </div>
                              <div className="line-clamp-3 text-zinc-400 font-mono">
                                  {JSON.stringify(h.result)}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};
