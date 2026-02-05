import React from 'react';
import { Bot, Zap, Globe, Cpu, CheckCircle2 } from 'lucide-react';
import { Component } from '../../types/schema';
import { Card, Button } from '../ui/Common';

interface PresetGalleryProps {
  onSelect: (component: Component) => void;
  onCancel: () => void;
}

const PRESETS: Partial<Component>[] = [
  {
    name: '空白请求 (Empty Request)',
    description: '从头开始创建一个空白的 GET 请求。',
    apiConfig: {
      method: 'GET',
      url: '',
      headers: [],
      bodyType: 'none',
    },
    parameters: []
  },
  {
    name: 'OpenAI Chat',
    description: '使用 GPT-3.5 或 GPT-4 模型生成文本。',
    apiConfig: {
      method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      headers: [
        { id: 'h1', key: 'Content-Type', value: 'application/json' },
        { id: 'h2', key: 'Authorization', value: 'Bearer {{api_key}}' }
      ],
      bodyType: 'json',
      bodyTemplate: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "{{prompt}}" }]
      }, null, 2)
    },
    parameters: [
      { id: 'p1', key: 'api_key', label: 'OpenAI API Key', uiType: 'password', required: true, value: '', isVisible: true },
      { id: 'p2', key: 'prompt', label: '提示词 (Prompt)', uiType: 'textarea', required: true, value: 'Hello, AI!', isVisible: true }
    ]
  },
  {
    name: 'n8n Webhook',
    description: '触发 n8n 自动化工作流。',
    apiConfig: {
      method: 'POST',
      url: 'https://n8n.example.com/webhook/{{webhook_id}}',
      headers: [
        { id: 'h1', key: 'Content-Type', value: 'application/json' }
      ],
      bodyType: 'json',
      bodyTemplate: JSON.stringify({
        data: "{{payload}}",
        timestamp: "{{timestamp}}"
      }, null, 2)
    },
    parameters: [
      { id: 'n1', key: 'webhook_id', label: 'Webhook UUID', uiType: 'input', required: true, value: '', isVisible: true },
      { id: 'n2', key: 'payload', label: '数据载荷 (Payload)', uiType: 'textarea', value: '', isVisible: true }
    ]
  },
  {
    name: 'RunningHub Task',
    description: '向 RunningHub API 提交任务。',
    apiConfig: {
      method: 'POST',
      url: 'https://www.runninghub.cn/task/create',
      headers: [
        { id: 'h1', key: 'Content-Type', value: 'application/json' },
        { id: 'h2', key: 'Authorization', value: 'Bearer {{token}}' }
      ],
      bodyType: 'json',
      bodyTemplate: JSON.stringify({
        taskName: "{{task_name}}",
        params: {}
      }, null, 2)
    },
    parameters: [
      { id: 'r1', key: 'token', label: 'RunningHub Token', uiType: 'password', value: '', isVisible: true },
      { id: 'r2', key: 'task_name', label: '任务名称', uiType: 'input', value: '', isVisible: true }
    ]
  }
];

export const PresetGallery: React.FC<PresetGalleryProps> = ({ onSelect, onCancel }) => {
  const handleSelect = (preset: Partial<Component>) => {
    const component: Component = {
      id: crypto.randomUUID(),
      name: preset.name || 'New Component',
      description: preset.description || '',
      apiConfig: preset.apiConfig!,
      parameters: preset.parameters?.map(f => ({ ...f, id: crypto.randomUUID() })) || []
    };
    onSelect(component);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
           <h3 className="text-lg font-semibold text-white">选择组件模版</h3>
           <p className="text-sm text-zinc-400">选择一个预设来快速配置您的 API 请求。</p>
        </div>
        <Button variant="ghost" onClick={onCancel}>取消</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PRESETS.map((preset, idx) => (
          <div 
            key={idx}
            className="group relative flex flex-col p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:border-zinc-700 cursor-pointer transition-all"
            onClick={() => handleSelect(preset)}
          >
            <div className="flex items-start justify-between mb-3">
               <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-primary group-hover:text-white group-hover:border-primary/50 transition-colors">
                  {idx === 0 ? <Cpu className="w-5 h-5"/> : idx === 1 ? <Bot className="w-5 h-5"/> : idx === 2 ? <Zap className="w-5 h-5"/> : <Globe className="w-5 h-5"/>}
               </div>
               <CheckCircle2 className="w-5 h-5 text-zinc-800 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
            </div>
            
            <h4 className="font-medium text-zinc-200 mb-1">{preset.name}</h4>
            <p className="text-xs text-zinc-500 leading-relaxed">{preset.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
