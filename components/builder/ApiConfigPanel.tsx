import React, { useMemo } from 'react';
import { Plus, Trash, Zap, Code, FileJson } from 'lucide-react';
import { Component, ApiHeader } from '../../types/schema';
import { Button, Input, Textarea, Select, Card, Badge } from '../ui/Common';

interface ApiConfigPanelProps {
  component: Component;
  onUpdate: (updates: Partial<Component['apiConfig']>) => void;
}

export const ApiConfigPanel: React.FC<ApiConfigPanelProps> = ({ component, onUpdate }) => {
  const { apiConfig } = component;

  // --- Helpers for Updates ---
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

  // --- Variable Detection Logic ---
  const detectedVariables = useMemo(() => {
    const text = `${apiConfig.url} ${JSON.stringify(apiConfig.headers)} ${apiConfig.bodyTemplate || ''}`;
    const regex = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
    const matches = new Set<string>();
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.add(match[1]);
    }
    return Array.from(matches);
  }, [apiConfig]);

  return (
    <div className="space-y-6 animate-in slide-in-from-right-2 duration-200">
      {/* Endpoint Configuration */}
      <Card title="端点配置 (Endpoint)">
        <div className="flex gap-4 mb-4">
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
                placeholder="https://api.example.com/v1/resource/{{id}}"
            />
          </div>
        </div>
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
                <Button variant="ghost" onClick={() => removeHeader(h.id)} className="text-zinc-500 hover:text-red-400 mb-[2px]">
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
        <div className="mb-4 w-48">
            <Select 
                label="Body 类型"
                options={[{label: 'JSON (application/json)', value: 'json'}, {label: '无 (None)', value: 'none'}]}
                value={apiConfig.bodyType}
                onChange={(e) => onUpdate({ bodyType: e.target.value as any })}
            />
        </div>
        
        {apiConfig.bodyType === 'json' && (
            <div className="space-y-2">
                <div className="relative">
                    <Textarea 
                        className="font-mono min-h-[200px] text-xs leading-relaxed bg-zinc-950 border-zinc-800 focus:ring-primary/50"
                        value={apiConfig.bodyTemplate || ''}
                        onChange={(e) => onUpdate({ bodyTemplate: e.target.value })}
                        placeholder="{&#10;  &quot;key&quot;: &quot;{{value}}&quot;&#10;}"
                        spellCheck={false}
                    />
                    <div className="absolute top-2 right-2 text-zinc-600 pointer-events-none">
                        <FileJson className="w-5 h-5" />
                    </div>
                </div>
                
                {/* Detected Variables Display */}
                <div className="bg-zinc-900/50 rounded-md p-3 border border-zinc-800 flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs text-zinc-400 shrink-0">
                        <Zap className="w-3.5 h-3.5" />
                        <span>自动检测到的变量:</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {detectedVariables.length > 0 ? (
                            detectedVariables.map(v => (
                                <Badge key={v} variant="default" className="font-mono text-[10px] px-1.5 py-0.5">
                                    {v}
                                </Badge>
                            ))
                        ) : (
                            <span className="text-xs text-zinc-600 italic">未检测到变量。在上方使用 {"{{name}}"} 格式定义变量。</span>
                        )}
                    </div>
                </div>
            </div>
        )}
      </Card>
    </div>
  );
};