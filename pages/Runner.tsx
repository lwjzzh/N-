import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, RefreshCw, Layers, Zap, ChevronDown, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { App, Component } from '../types/schema';
import { Button, Input, Textarea, Select, Badge } from '../components/ui/Common';
import { ResultRenderer } from '../components/runner/ResultRenderer';
import { proxyRequest } from '../services/storage';

interface ComponentRunnerState {
  inputValues: Record<string, string>;
  status: 'idle' | 'running' | 'success' | 'error';
  result: any;
  error?: string;
  duration?: number;
  isOpen: boolean;
}

const RunnerPage: React.FC = () => {
  const { id: appId } = useParams();
  const navigate = useNavigate();
  const { apps, loadApps } = useAppStore();
  
  const [app, setApp] = useState<App | undefined>(undefined);
  const [compStates, setCompStates] = useState<Record<string, ComponentRunnerState>>({});
  const [isReady, setIsReady] = useState(false);

  // Ensure apps are loaded
  useEffect(() => {
     if (apps.length === 0) {
         loadApps();
     }
  }, [loadApps, apps.length]);

  // Initialize App Data
  useEffect(() => {
    if (appId && apps.length > 0) {
        const data = apps.find(a => a.id === appId);
        if (data) {
            setApp(data);
            const initialStates: Record<string, ComponentRunnerState> = {};
            data.components.forEach((c, idx) => {
                const defaults: Record<string, string> = {};
                c.inputFields.forEach(f => {
                    defaults[f.key] = f.defaultValue || '';
                });
                initialStates[c.id] = {
                    inputValues: defaults,
                    status: 'idle',
                    result: null,
                    isOpen: idx === 0 
                };
            });
            setCompStates(initialStates);
            setIsReady(true);
        }
    }
  }, [appId, apps]);

  const updateState = (compId: string, updates: Partial<ComponentRunnerState>) => {
      setCompStates(prev => ({
          ...prev,
          [compId]: { ...prev[compId], ...updates }
      }));
  };

  const resolveVariable = (value: string): string => {
      return value.replace(/{{([a-zA-Z0-9-]+)\.response}}/g, (match, refId) => {
          const targetState = compStates[refId];
          if (!targetState || targetState.status !== 'success') {
              return match; 
          }
          if (typeof targetState.result === 'object') {
              return JSON.stringify(targetState.result);
          }
          return String(targetState.result);
      });
  };

  const interpolate = (template: string, localInputs: Record<string, string>): string => {
      if (!template) return '';
      let res = template;
      Object.entries(localInputs).forEach(([key, val]) => {
          const resolvedVal = resolveVariable(val); 
          res = res.replace(new RegExp(`{{${key}}}`, 'g'), resolvedVal);
      });
      res = resolveVariable(res);
      return res;
  };

  const executeComponent = async (component: Component) => {
      const state = compStates[component.id];
      const startTime = Date.now();
      
      updateState(component.id, { status: 'running', error: undefined, result: null });

      try {
          const resolvedInputs = { ...state.inputValues };
          const { url, method, headers, bodyTemplate, bodyType } = component.apiConfig;

          const finalUrl = interpolate(url, resolvedInputs);
          const finalHeaders: Record<string, string> = {};
          headers.forEach(h => {
              if (h.key) finalHeaders[h.key] = interpolate(h.value, resolvedInputs);
          });

          let finalBody = "";
          if (method !== 'GET' && bodyType === 'json' && bodyTemplate) {
              finalBody = interpolate(bodyTemplate, resolvedInputs);
              try {
                  JSON.parse(finalBody); // Validate JSON format
              } catch (e) {
                   throw new Error("请求体 JSON 格式无效。请检查模版或变量值。");
              }
          }

          // Call Wails Backend Proxy
          const response = await proxyRequest(method, finalUrl, finalHeaders, finalBody);

          if (!response.success) {
              throw new Error(response.error || `HTTP ${response.status} Error`);
          }

          // Process Body
          let data = response.body;
          // Try parse JSON
          try {
             if (data && (data.startsWith('{') || data.startsWith('['))) {
                 data = JSON.parse(data);
             }
          } catch(e) {
             // Keep as string
          }

          if (response.status >= 400) {
              throw new Error(`HTTP ${response.status}: ${response.statusText} - ${typeof data === 'string' ? data : JSON.stringify(data)}`);
          }
              
          updateState(component.id, { 
              status: 'success', 
              result: data, 
              duration: Date.now() - startTime 
          });

          // Auto-next
          if (app) {
              const idx = app.components.findIndex(c => c.id === component.id);
              if (idx >= 0 && idx < app.components.length - 1) {
                  updateState(app.components[idx + 1].id, { isOpen: true });
              }
          }

      } catch (e: any) {
          updateState(component.id, { 
              status: 'error', 
              error: e.message, 
              duration: Date.now() - startTime 
          });
      }
  };

  const handleInputChange = (compId: string, key: string, value: string) => {
      setCompStates(prev => ({
          ...prev,
          [compId]: {
              ...prev[compId],
              inputValues: { ...prev[compId].inputValues, [key]: value }
          }
      }));
  };

  if (!isReady || !app) return <div className="h-screen flex items-center justify-center text-zinc-500 bg-background"><RefreshCw className="animate-spin mr-2"/> 正在加载...</div>;

  return (
    <div className="h-full flex flex-col bg-background animate-in fade-in duration-300">
      
      <div className="h-16 border-b border-border bg-surface px-6 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/')}>
             <ArrowLeft className="w-5 h-5 text-muted" />
          </Button>
          <div>
             <h1 className="text-lg font-bold text-zinc-100">{app.name}</h1>
             <div className="flex items-center gap-2 text-xs text-muted">
                <span className="flex items-center gap-1"><Layers className="w-3 h-3"/> 执行模式 (Runner)</span>
             </div>
          </div>
        </div>
        <div>
            <Button variant="secondary" onClick={() => navigate(`/builder/${app.id}`)}>编辑应用</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
            {app.components.map((comp, index) => {
                const state = compStates[comp.id];
                if (!state) return null;

                return (
                    <div key={comp.id} className="relative pl-8">
                        <div className="absolute left-[11px] top-8 bottom-[-32px] w-0.5 bg-zinc-800 last:bottom-0"></div>
                        <div className={`absolute left-0 top-6 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-background z-10 transition-colors ${state.status === 'success' ? 'border-green-500 text-green-500' : state.status === 'running' ? 'border-primary text-primary' : state.status === 'error' ? 'border-red-500 text-red-500' : 'border-zinc-700 text-zinc-700'}`}>
                            {state.status === 'success' ? <CheckCircle2 className="w-4 h-4" /> : 
                             state.status === 'running' ? <Zap className="w-3 h-3 animate-pulse" /> :
                             <span className="text-[10px] font-mono font-bold">{index + 1}</span>}
                        </div>

                        <div className={`rounded-xl border transition-all duration-300 overflow-hidden ${state.isOpen ? 'bg-surface border-zinc-700 shadow-lg' : 'bg-surface/50 border-zinc-800'}`}>
                            <div 
                                className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors"
                                onClick={() => updateState(comp.id, { isOpen: !state.isOpen })}
                            >
                                <div>
                                    <h3 className="font-semibold text-zinc-200">{comp.name}</h3>
                                    <p className="text-xs text-zinc-500 truncate mt-0.5">{comp.apiConfig.method} {comp.apiConfig.url}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {state.status === 'success' && <Badge variant="success">已完成</Badge>}
                                    {state.status === 'error' && <Badge variant="error">失败</Badge>}
                                    {state.isOpen ? <ChevronDown className="w-5 h-5 text-muted"/> : <ChevronRight className="w-5 h-5 text-muted"/>}
                                </div>
                            </div>

                            {state.isOpen && (
                                <div className="border-t border-zinc-800 p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-top-2">
                                    <div className="lg:col-span-5 space-y-5">
                                        <div>
                                            <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">输入参数 (Parameters)</h4>
                                            <div className="space-y-4">
                                                {comp.inputFields.length === 0 && (
                                                    <div className="text-sm text-zinc-600 italic">无需输入参数。</div>
                                                )}
                                                {comp.inputFields.map(field => (
                                                    <div key={field.id}>
                                                        {field.type === 'textarea' ? (
                                                            <Textarea 
                                                                label={field.label} 
                                                                placeholder={field.placeholder}
                                                                value={state.inputValues[field.key] || ''}
                                                                onChange={e => handleInputChange(comp.id, field.key, e.target.value)}
                                                            />
                                                        ) : field.type === 'select' ? (
                                                            <Select 
                                                                label={field.label}
                                                                options={field.options || []}
                                                                value={state.inputValues[field.key] || ''}
                                                                onChange={e => handleInputChange(comp.id, field.key, e.target.value)}
                                                            />
                                                        ) : (
                                                            <Input 
                                                                label={field.label}
                                                                type={field.type === 'password' ? 'password' : 'text'}
                                                                placeholder={field.placeholder}
                                                                value={state.inputValues[field.key] || ''}
                                                                onChange={e => handleInputChange(comp.id, field.key, e.target.value)}
                                                            />
                                                        )}
                                                        {state.inputValues[field.key]?.includes('{{') && (
                                                            <div className="mt-1 text-[10px] text-blue-400 opacity-80 truncate">
                                                                动态引用: {state.inputValues[field.key]}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        <Button 
                                            className="w-full" 
                                            size="lg"
                                            onClick={() => executeComponent(comp)}
                                            disabled={state.status === 'running'}
                                            icon={state.status === 'running' ? RefreshCw : Play}
                                        >
                                            {state.status === 'running' ? '运行中...' : '运行组件'}
                                        </Button>
                                        
                                        {state.status === 'error' && state.error && (
                                            <div className="mt-3 p-3 bg-red-900/20 border border-red-900/50 rounded-md flex items-start gap-2 text-red-300 text-xs break-all">
                                                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                                {state.error}
                                            </div>
                                        )}
                                    </div>

                                    <div className="lg:col-span-7 flex flex-col min-h-[300px]">
                                        <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">响应结果 (Output)</h4>
                                        <div className="flex-1 overflow-hidden rounded-lg">
                                            <ResultRenderer 
                                                result={state.result} 
                                                status={state.status} 
                                                error={state.error} 
                                                duration={state.duration}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
};

export default RunnerPage;