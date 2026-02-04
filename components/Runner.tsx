import React, { useState, useEffect } from 'react';
import { Play, ArrowLeft, RefreshCw, ChevronDown, ChevronRight, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { App, Component } from '../types/schema';
import { Button, Input, Textarea, Select, Badge } from './ui/Common';

interface ComponentRunnerState {
  inputValues: Record<string, string>;
  isLoading: boolean;
  result: any;
  status: 'idle' | 'success' | 'error';
  duration: number;
  isOpen: boolean;
  errorMsg?: string;
}

const Runner: React.FC = () => {
  const { id: appId } = useParams();
  const navigate = useNavigate();
  const { getAppById } = useAppStore();
  const [app, setApp] = useState<App | undefined>(undefined);
  const [isNotFound, setIsNotFound] = useState(false);
  const [compStates, setCompStates] = useState<Record<string, ComponentRunnerState>>({});

  useEffect(() => {
    if (appId) {
        const data = getAppById(appId);
        if (data) {
            setApp(data);
            setIsNotFound(false);
            // Initialize state for each component
            const initialStates: Record<string, ComponentRunnerState> = {};
            data.components.forEach((c, index) => {
                const defaults: Record<string, string> = {};
                c.inputFields.forEach(f => {
                    if(f.defaultValue) defaults[f.key] = f.defaultValue;
                });
                initialStates[c.id] = {
                    inputValues: defaults,
                    isLoading: false,
                    result: null,
                    status: 'idle',
                    duration: 0,
                    // Open the first component by default
                    isOpen: index === 0 
                };
            });
            setCompStates(initialStates);
        } else {
            setIsNotFound(true);
        }
    }
  }, [appId, getAppById]);

  // --- Helpers ---

  // 1. Resolve References: Replace {{compId.response}} with actual data
  const resolveReferences = (value: string, allStates: Record<string, ComponentRunnerState>): string => {
      const refRegex = /{{([a-zA-Z0-9-]+)\.response}}/g;
      
      // If the value is EXACTLY a reference (e.g. "{{id.response}}"), we might want to return an object/JSON
      // But for this simple version, we treat everything as string replacement.
      
      return value.replace(refRegex, (match, refId) => {
          const targetState = allStates[refId];
          
          if (!targetState) return match; // ID not found
          if (targetState.status !== 'success' || !targetState.result) {
              throw new Error(`Dependant step missing result: ${refId}`);
          }

          const res = targetState.result;
          // If result is object, try to stringify based on context, or just return [Object]
          // For chaining tasks, usually we pass IDs or specific string values. 
          // Current Limitation: Can only pass full JSON body or primitive strings.
          if (typeof res === 'object') {
              return JSON.stringify(res);
          }
          return String(res);
      });
  };

  // 2. Interpolate: Replace {{variable}} with local input values
  const interpolate = (template: string, values: Record<string, string>) => {
      let result = template;
      Object.keys(values).forEach(key => {
          const regex = new RegExp(`{{${key}}}`, 'g');
          result = result.replace(regex, values[key]);
      });
      return result;
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

  const toggleOpen = (compId: string) => {
      setCompStates(prev => ({
          ...prev,
          [compId]: { ...prev[compId], isOpen: !prev[compId].isOpen }
      }));
  };

  const executeComponent = async (component: Component) => {
      const state = compStates[component.id];
      const startTime = Date.now();
      
      setCompStates(prev => ({
          ...prev,
          [component.id]: { ...prev[component.id], isLoading: true, status: 'idle', result: null, errorMsg: undefined }
      }));

      try {
          // Step 1: Resolve Dependencies in Inputs
          // We create a "Resolved Inputs" object where chained references are filled
          const resolvedInputs: Record<string, string> = {};
          
          for (const [key, val] of Object.entries(state.inputValues)) {
              resolvedInputs[key] = resolveReferences(val, compStates);
          }

          // Step 2: Prepare Request
          const { url, method, headers, bodyTemplate, bodyType } = component.apiConfig;
          
          const finalUrl = interpolate(url, resolvedInputs);
          
          // Only process body if not GET
          let finalBody = undefined;
          if (method !== 'GET' && bodyType === 'json' && bodyTemplate) {
              const interpolatedBodyStr = interpolate(bodyTemplate, resolvedInputs);
              // Validate JSON
              try {
                  JSON.parse(interpolatedBodyStr); // Check validity
                  finalBody = interpolatedBodyStr;
              } catch (e) {
                  throw new Error("Constructed Request Body is not valid JSON.");
              }
          }

          const finalHeaders: Record<string, string> = {};
          headers.forEach(h => {
              if (h.key) finalHeaders[h.key] = interpolate(h.value, resolvedInputs);
          });

          // Step 3: Fetch
          const res = await fetch(finalUrl, {
                method,
                headers: finalHeaders,
                body: finalBody
            });
            
            let data;
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                data = await res.json();
            } else {
                data = await res.text();
            }

            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

            setCompStates(prev => ({
                ...prev,
                [component.id]: {
                    ...prev[component.id],
                    isLoading: false,
                    status: 'success',
                    result: data,
                    duration: Date.now() - startTime
                }
            }));

            // Auto-open next component if exists
            if (app) {
                const currentIndex = app.components.findIndex(c => c.id === component.id);
                if (currentIndex >= 0 && currentIndex < app.components.length - 1) {
                     const nextCompId = app.components[currentIndex + 1].id;
                     setCompStates(prev => ({
                        ...prev,
                        [nextCompId]: { ...prev[nextCompId], isOpen: true }
                     }));
                }
            }

      } catch (e: any) {
           setCompStates(prev => ({
                ...prev,
                [component.id]: {
                    ...prev[component.id],
                    isLoading: false,
                    status: 'error',
                    result: null,
                    errorMsg: e.message,
                    duration: Date.now() - startTime
                }
            }));
      }
  };

  // --- Render Error/Loading ---
  if (isNotFound) return (
        <div className="h-full flex flex-col items-center justify-center bg-background text-zinc-400 gap-4">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <h2 className="text-xl font-semibold text-white">App Not Found</h2>
            <Button onClick={() => navigate('/')} variant="secondary">Go Home</Button>
        </div>
     );

  if (!app) return (
          <div className="h-full flex flex-col items-center justify-center bg-background text-zinc-500 gap-3">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <p>Loading...</p>
          </div>
      );

  return (
    <div className="h-full flex flex-col bg-background animate-in fade-in duration-300">
         {/* Header */}
        <div className="border-b border-border bg-surface p-4 flex items-center justify-between shadow-sm sticky top-0 z-20">
            <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/')}>
                <ArrowLeft className="w-5 h-5 text-muted" />
            </Button>
            <div>
                <h2 className="font-bold text-lg text-white">{app.name}</h2>
                <div className="flex gap-2 items-center text-xs text-muted">
                   <span>Runner Mode</span>
                </div>
            </div>
            </div>
            <div className="flex gap-2">
                 <Button variant="secondary" onClick={() => navigate(`/builder/${app.id}`)}>
                    Edit App
                 </Button>
            </div>
        </div>

        <div className="flex-1 overflow-auto p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                {app.components.map((comp, index) => {
                    const state = compStates[comp.id];
                    if (!state) return null;

                    return (
                        <div key={comp.id} className="relative">
                            {/* Connector Line */}
                            {index < app.components.length - 1 && (
                                <div className="absolute left-8 top-full h-6 w-0.5 bg-zinc-800 -z-10" />
                            )}

                            <div className={`rounded-xl border transition-all duration-300 ${state.status === 'error' ? 'border-red-900/50' : state.isOpen ? 'border-zinc-700 bg-surface' : 'border-zinc-800 bg-surface/50'}`}>
                                {/* Component Header Bar */}
                                <div 
                                    className={`flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-800/80 transition-colors rounded-t-xl ${!state.isOpen ? 'rounded-b-xl' : ''}`}
                                    onClick={() => toggleOpen(comp.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono border ${state.status === 'success' ? 'bg-green-900/20 border-green-900 text-green-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                                            {state.status === 'success' ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-zinc-200">{comp.name}</span>
                                            <span className="text-xs text-zinc-500 font-mono">{comp.apiConfig.method} {comp.apiConfig.url}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {state.status === 'success' && <span className="text-xs text-green-500">{state.duration}ms</span>}
                                        {state.status === 'error' && <span className="text-xs text-red-400">Error</span>}
                                        {state.isOpen ? <ChevronDown className="w-5 h-5 text-muted"/> : <ChevronRight className="w-5 h-5 text-muted"/>}
                                    </div>
                                </div>

                                {/* Body */}
                                {state.isOpen && (
                                    <div className="p-6 border-t border-zinc-800/50 grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-top-1">
                                        {/* Left: Inputs */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-bold text-muted uppercase tracking-wider">Input Parameters</h4>
                                            </div>
                                            
                                            <div className="space-y-4">
                                                {comp.inputFields.map(field => (
                                                    <div key={field.id}>
                                                        {field.type === 'textarea' ? (
                                                            <Textarea 
                                                                label={field.label}
                                                                placeholder={field.placeholder}
                                                                value={state.inputValues[field.key] || ''}
                                                                onChange={e => handleInputChange(comp.id, field.key, e.target.value)}
                                                                className="bg-background"
                                                            />
                                                        ) : field.type === 'select' ? (
                                                            <Select 
                                                                label={field.label}
                                                                options={field.options || []}
                                                                value={state.inputValues[field.key] || ''}
                                                                onChange={e => handleInputChange(comp.id, field.key, e.target.value)}
                                                                className="bg-background"
                                                            />
                                                        ) : (
                                                            <Input 
                                                                label={field.label}
                                                                type={field.type === 'password' ? 'password' : 'text'}
                                                                placeholder={field.placeholder}
                                                                value={state.inputValues[field.key] || ''}
                                                                onChange={e => handleInputChange(comp.id, field.key, e.target.value)}
                                                                className="bg-background"
                                                            />
                                                        )}
                                                        {/* Preview Reference Value Hint */}
                                                        {state.inputValues[field.key]?.includes('{{') && (
                                                            <div className="mt-1 text-[10px] text-blue-400 truncate opacity-70">
                                                                Linked to: {state.inputValues[field.key]}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                                {comp.inputFields.length === 0 && <p className="text-zinc-600 text-sm italic py-2">No inputs required.</p>}
                                            </div>
                                            <div className="pt-4">
                                                <Button 
                                                    className="w-full" 
                                                    onClick={(e) => { e.stopPropagation(); executeComponent(comp); }}
                                                    disabled={state.isLoading}
                                                    icon={state.isLoading ? RefreshCw : Play}
                                                >
                                                    {state.isLoading ? 'Running...' : 'Run Component'}
                                                </Button>
                                                {state.errorMsg && (
                                                    <div className="mt-3 p-3 bg-red-900/20 border border-red-900/50 rounded-md flex items-start gap-2 text-red-300 text-xs break-all">
                                                        <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                                        {state.errorMsg}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right: Output */}
                                        <div className="flex flex-col min-h-[300px]">
                                            <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-4">Response Output</h4>
                                            <div className={`flex-1 rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs overflow-auto shadow-inner ${state.status === 'error' ? 'text-red-300' : 'text-zinc-300'}`}>
                                                {state.result ? (
                                                    <pre className="whitespace-pre-wrap break-all">
                                                        {typeof state.result === 'string' ? state.result : JSON.stringify(state.result, null, 2)}
                                                    </pre>
                                                ) : state.isLoading ? (
                                                    <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-2">
                                                        <RefreshCw className="w-5 h-5 animate-spin" />
                                                        <span>Waiting for response...</span>
                                                    </div>
                                                ) : (
                                                    <div className="h-full flex items-center justify-center text-zinc-700 italic">
                                                        Ready to execute.
                                                    </div>
                                                )}
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

export default Runner;