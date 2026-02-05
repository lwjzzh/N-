
import React, { useMemo, useState, KeyboardEvent } from 'react';
import { Plus, Trash, Zap, Code, FileJson, PlayCircle, XCircle, CheckCircle2, Loader2, ListPlus } from 'lucide-react';
import { Component, ApiHeader } from '../../types/schema';
import { Button, Input, Textarea, Select, Card, Badge } from '../ui/Common';
import { proxyRequest } from '../../services/storage';
import { useToast } from '../ui/Toast';

interface ApiConfigPanelProps {
  component: Component;
  onUpdate: (updates: Partial<Component['apiConfig']>) => void;
}

interface FormDataEntry {
    id: string;
    key: string;
    value: string;
}

export const ApiConfigPanel: React.FC<ApiConfigPanelProps> = ({ component, onUpdate }) => {
  const { apiConfig, parameters } = component;
  const { addToast } = useToast();
  const [isTesting, setIsTesting] = useState(false);
  const [testResponse, setTestResponse] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const formDataEntries: FormDataEntry[] = useMemo(() => {
      if (apiConfig.bodyType !== 'form-data' || !apiConfig.bodyTemplate) return [];
      try {
          const parsed = JSON.parse(apiConfig.bodyTemplate);
          return Array.isArray(parsed) ? parsed : [];
      } catch {
          return [];
      }
  }, [apiConfig.bodyType, apiConfig.bodyTemplate]);

  // --- Updates ---
  const updateHeader = (id: string, field: keyof ApiHeader, value: string) => {
    const newHeaders = apiConfig.headers.map(h => h.id === id ? { ...h, [field]: value } : h);
    onUpdate({ headers: newHeaders });
  };

  const addHeader = () => {
    const newHeaders = [...apiConfig.headers, { id: crypto.randomUUID(), key: '', value: '' }];
    onUpdate({ headers: newHeaders });
  };

  const removeHeader = (id: string) => {
    const newHeaders = apiConfig.headers.filter(h => h.id !== id);
    onUpdate({ headers: newHeaders });
  };

  const updateFormData = (newEntries: FormDataEntry[]) => {
      onUpdate({ bodyTemplate: JSON.stringify(newEntries) });
  };

  const addFormEntry = () => {
      updateFormData([...formDataEntries, { id: crypto.randomUUID(), key: '', value: '' }]);
  };

  const updateFormEntry = (id: string, field: 'key' | 'value', val: string) => {
      updateFormData(formDataEntries.map(e => e.id === id ? { ...e, [field]: val } : e));
  };

  const removeFormEntry = (id: string) => {
      updateFormData(formDataEntries.filter(e => e.id !== id));
  };

  const detectedVariables = useMemo(() => {
    const text = `${apiConfig.url} ${JSON.stringify(apiConfig.headers)} ${apiConfig.bodyTemplate || ''}`;
    // Updated Regex to include $ for system variables
    const regex = /{{\s*([a-zA-Z0-9_$]+)\s*}}/g;
    const matches = new Set<string>();
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.add(match[1]);
    }
    return Array.from(matches);
  }, [apiConfig]);

  // --- Test ---
  const handleTest = async () => {
      setIsTesting(true);
      setTestResponse(null);
      setTestError(null);

      try {
          // 1. Prepare Mock Context for System Variables
          const mockSystemContext: Record<string, any> = {
              '$session_id': 'test-session-uuid-1234',
              '$user_role': 'user',
              '$timestamp': Date.now().toString(),
              '$history': [
                  { role: "assistant", content: "Hello! This is a mock history message." }
              ],
              '$messages': [
                  { role: "assistant", content: "Hello! This is a mock history message." },
                  { role: "user", content: "This is a mock current user message." }
              ]
          };

          // 2. Merge User Parameters
          const testInputs: Record<string, any> = { ...mockSystemContext };
          parameters.forEach(p => {
              testInputs[p.key] = p.value || ''; 
          });

          // Define Interpolation Logic (Replicated from workflowEngine for local UI testing)
          const interpolateString = (tmpl: string) => {
             if (!tmpl) return '';
             let res = tmpl;
             Object.entries(testInputs).forEach(([k, v]) => {
                 const safeKey = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                 const regex = new RegExp(`{{\\s*${safeKey}\\s*}}`, 'g');
                 // For string interpolation, stringify objects
                 const replacement = (typeof v === 'object' && v !== null) ? JSON.stringify(v) : String(v ?? '');
                 res = res.replace(regex, replacement);
             });
             return res;
          };

          const interpolateJSON = (tmpl: string) => {
             try {
                 const root = JSON.parse(tmpl);
                 const walk = (node: any): any => {
                    if (typeof node === 'string') {
                        // Exact match for object injection
                        const exactMatch = node.match(/^\s*{{\s*([a-zA-Z0-9-_$]+)\s*}}\s*$/);
                        if (exactMatch) {
                            const key = exactMatch[1];
                            if (testInputs[key] !== undefined) return testInputs[key];
                        }
                        return interpolateString(node);
                    } else if (Array.isArray(node)) {
                        return node.map(walk);
                    } else if (node !== null && typeof node === 'object') {
                        const newObj: any = {};
                        for (const key in node) newObj[key] = walk(node[key]);
                        return newObj;
                    }
                    return node;
                 };
                 return JSON.stringify(walk(root));
             } catch {
                 return interpolateString(tmpl);
             }
          };

          const finalUrl = interpolateString(apiConfig.url);
          const finalHeaders: Record<string, string> = {};
          apiConfig.headers.forEach(h => {
              if (h.key) finalHeaders[h.key] = interpolateString(h.value);
          });
          
          let finalBody = "";
          
          if (apiConfig.method !== 'GET') {
              if (apiConfig.bodyType === 'json' && apiConfig.bodyTemplate) {
                  finalBody = interpolateJSON(apiConfig.bodyTemplate);
              } else if (apiConfig.bodyType === 'form-data') {
                  const entries = formDataEntries.map(e => ({
                      key: e.key,
                      value: interpolateString(e.value)
                  }));
                  finalBody = JSON.stringify(entries);
                  finalHeaders['Content-Type'] = 'multipart/form-data';
              }
          }

          const res = await proxyRequest(apiConfig.method, finalUrl, finalHeaders, finalBody);
          
          if (!res.success) {
              throw new Error(res.error || `HTTP ${res.status} Error`);
          }

          let bodyData = res.body;
          try {
             // FIX: Add trim() to handle whitespace before JSON
             if (bodyData && (bodyData.trim().startsWith('{') || bodyData.trim().startsWith('['))) {
                 bodyData = JSON.parse(bodyData);
             }
          } catch(e) {}

          setTestResponse({
              status: res.status,
              statusText: res.statusText,
              headers: res.headers,
              body: bodyData
          });
          addToast("请求执行成功", "success");

      } catch (e: any) {
          setTestError(e.message);
          addToast("请求执行失败", "error");
      } finally {
          setIsTesting(false);
      }
  };

  // --- Handlers for Textarea ---
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
          e.preventDefault();
          const target = e.target as HTMLTextAreaElement;
          const start = target.selectionStart;
          const end = target.selectionEnd;
          const value = target.value;
          target.value = value.substring(0, start) + '  ' + value.substring(end);
          target.selectionStart = target.selectionEnd = start + 2;
          onUpdate({ bodyTemplate: target.value });
      }
  };

  const handleFormatJSON = () => {
      try {
          const parsed = JSON.parse(apiConfig.bodyTemplate || '{}');
          onUpdate({ bodyTemplate: JSON.stringify(parsed, null, 2) });
          addToast("JSON 已格式化", "success");
      } catch (e) {
          addToast("无效的 JSON 格式", "error");
      }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-2 duration-200">
      {/* Endpoint Configuration */}
      <Card title="端点配置 (Endpoint)">
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex gap-4">
            <div className="w-32 shrink-0">
                <Select 
                    label="请求方法"
                    options={['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m => ({ label: m, value: m }))}
                    value={apiConfig.method}
                    onChange={(e) => onUpdate({ method: e.target.value as any })}
                />
            </div>
            <div className="flex-1">
                 <Input 
                    label="URL 地址 (支持 {{变量名}} 插值)"
                    value={apiConfig.url}
                    onChange={(e) => onUpdate({ url: e.target.value })}
                    className="font-mono text-blue-400"
                    placeholder="https://api.example.com/upload"
                />
            </div>
          </div>

          <div className="flex items-center justify-between bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
               <div className="flex items-center gap-3">
                   <div className="p-2 bg-zinc-800 rounded text-zinc-400">
                       <Zap className="w-4 h-4" />
                   </div>
                   <div>
                       <h4 className="text-sm font-medium text-zinc-200">流式响应 (Streaming Response)</h4>
                       <p className="text-[10px] text-zinc-500">
                           启用后，将尝试实时显示响应内容（适用于 SSE/OpenAI Stream）。
                       </p>
                   </div>
               </div>
               <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={apiConfig.stream || false}
                        onChange={(e) => onUpdate({ stream: e.target.checked })}
                    />
                    <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
               </label>
          </div>

          <div className="flex justify-end">
             <Button 
                onClick={handleTest} 
                variant="secondary" 
                className="h-9 text-xs px-3 whitespace-nowrap min-w-[6rem]"
                disabled={isTesting}
            >
                {isTesting ? <Loader2 className="w-3 h-3 animate-spin"/> : <><PlayCircle className="w-3 h-3 mr-2"/> 测试请求</>}
             </Button>
          </div>
        </div>

        {/* Test Result Area */}
        {(testResponse || testError) && (
            <div className="mt-4 p-4 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono overflow-hidden animate-in slide-in-from-top-2">
                <div className="flex items-center justify-between mb-2 border-b border-zinc-800 pb-2">
                    <span className="font-bold text-zinc-400 uppercase tracking-wider">Test Result</span>
                    <button onClick={() => { setTestResponse(null); setTestError(null); }} className="text-zinc-500 hover:text-white"><XCircle className="w-4 h-4"/></button>
                </div>
                {testError ? (
                    <div className="text-red-400 p-2">{testError}</div>
                ) : (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Badge variant={testResponse.status < 400 ? 'success' : 'error'}>
                                {testResponse.status} {testResponse.statusText}
                            </Badge>
                        </div>
                        <div className="max-h-[300px] overflow-auto text-blue-300 custom-scrollbar bg-black/20 p-2 rounded">
                            <pre>{typeof testResponse.body === 'string' ? testResponse.body : JSON.stringify(testResponse.body, null, 2)}</pre>
                        </div>
                    </div>
                )}
            </div>
        )}
      </Card>

      {/* Headers Configuration */}
      <Card title="请求头 (Headers)">
        {apiConfig.headers.length === 0 && (
            <div className="text-sm text-zinc-500 mb-4 italic">暂无 Headers 配置。</div>
        )}
        {apiConfig.headers.map(h => (
            <div key={h.id} className="flex gap-3 mb-2 items-end">
                <div className="flex-1">
                    <Input placeholder="Key (例如: Authorization)" value={h.key} onChange={(e) => updateHeader(h.id, 'key', e.target.value)} />
                </div>
                <div className="flex-1">
                    <Input placeholder="Value (例如: Bearer {{token}})" value={h.value} onChange={(e) => updateHeader(h.id, 'value', e.target.value)} />
                </div>
                <Button variant="ghost" onClick={() => removeHeader(h.id)} className="text-zinc-500 hover:text-red-400 mb-[1px]">
                    <Trash className="w-4 h-4" />
                </Button>
            </div>
        ))}
        <div className="mt-4">
            <Button size="sm" variant="secondary" onClick={addHeader} icon={Plus}>添加 Header</Button>
        </div>
      </Card>

      {/* Body Configuration */}
      <Card title="请求体 (Body)">
        <div className="mb-4 w-56">
            <Select 
                label="Body 类型"
                options={[
                    {label: 'JSON (application/json)', value: 'json'}, 
                    {label: 'Form Data (multipart/form-data)', value: 'form-data'},
                    {label: '无 (None)', value: 'none'}
                ]}
                value={apiConfig.bodyType}
                onChange={(e) => onUpdate({ bodyType: e.target.value as any })}
            />
        </div>
        
        {/* JSON EDITOR */}
        {apiConfig.bodyType === 'json' && (
            <div className="space-y-2 group">
                <div className="relative">
                    <div className="absolute top-2 right-2 z-10 opacity-50 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button 
                            onClick={handleFormatJSON}
                            className="p-1.5 bg-zinc-800 rounded hover:bg-zinc-700 text-xs text-zinc-300 border border-zinc-700"
                            title="Format JSON"
                        >
                            Format
                        </button>
                    </div>
                    <Textarea 
                        className="font-mono min-h-[300px] text-xs leading-relaxed bg-zinc-950 border-zinc-800 focus:ring-primary/50 text-blue-300 selection:bg-blue-900/50"
                        value={apiConfig.bodyTemplate || ''}
                        onChange={(e) => onUpdate({ bodyTemplate: e.target.value })}
                        onKeyDown={handleKeyDown}
                        placeholder="{&#10;  &quot;key&quot;: &quot;{{value}}&quot;&#10;}"
                        spellCheck={false}
                    />
                    <div className="absolute bottom-2 right-2 text-zinc-700 pointer-events-none text-[10px]">
                        <FileJson className="w-4 h-4 inline-block mr-1" />
                        JSON Editor
                    </div>
                </div>
            </div>
        )}

        {/* FORM DATA EDITOR */}
        {apiConfig.bodyType === 'form-data' && (
            <div className="space-y-4">
                <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800 space-y-3">
                    <div className="grid grid-cols-12 gap-3 text-xs font-semibold text-zinc-500 mb-1 px-1">
                        <div className="col-span-4">Field Name (Key)</div>
                        <div className="col-span-7">Value (Text or {"{{file_var}}"})</div>
                        <div className="col-span-1"></div>
                    </div>
                    {formDataEntries.length === 0 && (
                        <div className="text-center py-4 text-zinc-600 text-sm italic">
                            暂无表单字段。
                        </div>
                    )}
                    {formDataEntries.map(entry => (
                        <div key={entry.id} className="grid grid-cols-12 gap-3 items-center">
                             <div className="col-span-4">
                                 <Input 
                                    placeholder="file" 
                                    value={entry.key} 
                                    onChange={e => updateFormEntry(entry.id, 'key', e.target.value)}
                                 />
                             </div>
                             <div className="col-span-7">
                                 <Input 
                                    placeholder="{{file_input}}" 
                                    value={entry.value} 
                                    onChange={e => updateFormEntry(entry.id, 'value', e.target.value)}
                                    className="font-mono text-blue-300"
                                 />
                             </div>
                             <div className="col-span-1 text-right">
                                 <Button variant="ghost" size="sm" onClick={() => removeFormEntry(entry.id)} className="text-zinc-500 hover:text-red-400">
                                     <Trash className="w-4 h-4" />
                                 </Button>
                             </div>
                        </div>
                    ))}
                    <div className="pt-2">
                        <Button size="sm" variant="secondary" onClick={addFormEntry} icon={ListPlus}>
                            添加字段
                        </Button>
                    </div>
                </div>
                <div className="text-xs text-zinc-500">
                    提示：如果是上传文件，请在 Value 中使用 <code>{"{{variable}}"}</code> 引用文件类型的参数。
                </div>
            </div>
        )}

        {/* Detected Variables Display */}
        {(apiConfig.bodyType === 'json' || apiConfig.bodyType === 'form-data') && (
             <div className="bg-zinc-900/50 rounded-md p-3 border border-zinc-800 flex items-center gap-3 mt-4">
                <div className="flex items-center gap-2 text-xs text-zinc-400 shrink-0">
                    <Zap className="w-3.5 h-3.5" />
                    <span>自动检测到的变量:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    {detectedVariables.length > 0 ? (
                        detectedVariables.map(v => (
                            <Badge 
                                key={v} 
                                variant={v.startsWith('$') ? 'success' : 'default'} 
                                className="font-mono text-[10px] px-1.5 py-0.5"
                            >
                                {v}
                            </Badge>
                        ))
                    ) : (
                        <span className="text-xs text-zinc-600 italic">未检测到变量。</span>
                    )}
                </div>
            </div>
        )}

      </Card>
    </div>
  );
};
