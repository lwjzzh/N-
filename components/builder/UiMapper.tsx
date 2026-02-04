import React, { useState } from 'react';
import { Plus, Trash, AlertCircle, Wand2, ArrowRight, Link as LinkIcon, X } from 'lucide-react';
import { Component, UIField } from '../../types/schema';
import { Button, Input, Textarea, Select, Card, Badge } from '../ui/Common';

interface UiMapperProps {
  component: Component;
  onUpdate: (fields: UIField[]) => void;
  detectedVariables: string[];
  previousComponents?: Component[]; // New prop for linking
}

export const UiMapper: React.FC<UiMapperProps> = ({ component, onUpdate, detectedVariables, previousComponents = [] }) => {
  const { inputFields } = component;
  const [activeLinkFieldId, setActiveLinkFieldId] = useState<string | null>(null);

  // --- Actions ---
  const addField = (key: string = '') => {
    const newField: UIField = {
      id: crypto.randomUUID(),
      key: key || `var_${inputFields.length + 1}`,
      label: key ? key.charAt(0).toUpperCase() + key.slice(1) : '新字段',
      type: 'string',
    };
    onUpdate([...inputFields, newField]);
  };

  const removeField = (id: string) => {
    onUpdate(inputFields.filter(i => i.id !== id));
  };

  const updateField = (id: string, field: keyof UIField, value: any) => {
    onUpdate(inputFields.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  // Find variables that don't have a corresponding UI field
  const unmappedVariables = detectedVariables.filter(v => !inputFields.find(f => f.key === v));

  const handleAutoGenerate = () => {
      const newFields = unmappedVariables.map(v => ({
          id: crypto.randomUUID(),
          key: v,
          label: v.charAt(0).toUpperCase() + v.slice(1),
          type: 'string' as const
      }));
      onUpdate([...inputFields, ...newFields]);
  };

  const handleLinkVariable = (fieldId: string, sourceCompName: string, sourceCompId: string) => {
      // Logic to insert reference syntax. e.g. {{step_id.response}}
      // For this MVP, we just append a placeholder string.
      const ref = `{{${sourceCompId}.response}}`; 
      const field = inputFields.find(f => f.id === fieldId);
      if(field) {
          const currentVal = field.defaultValue || '';
          updateField(fieldId, 'defaultValue', currentVal ? currentVal + ' ' + ref : ref);
      }
      setActiveLinkFieldId(null);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-2 duration-200">
      {/* Auto-Generate Section */}
      {unmappedVariables.length > 0 && (
          <div className="rounded-lg border border-blue-900/30 bg-blue-900/10 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-900/20 rounded-full text-blue-400">
                    <Wand2 className="w-5 h-5" />
                  </div>
                  <div>
                      <h4 className="text-sm font-medium text-blue-200">发现 {unmappedVariables.length} 个未映射变量</h4>
                      <p className="text-xs text-blue-300/60 mt-0.5">
                          {unmappedVariables.join(', ')}
                      </p>
                  </div>
              </div>
              <Button size="sm" onClick={handleAutoGenerate} className="bg-blue-600 hover:bg-blue-500 border-none text-white">
                  自动生成输入框
              </Button>
          </div>
      )}

      <div className="flex justify-between items-center mb-2">
         <h3 className="text-lg font-medium">UI 输入映射 (Input Fields)</h3>
         <Button size="sm" icon={Plus} onClick={() => addField()}>添加手动字段</Button>
      </div>

      {inputFields.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/30 text-zinc-500 text-sm">
             <div className="mb-2">暂无输入字段。</div>
             <div className="text-xs text-zinc-600">这些字段将显示在运行界面，供用户输入参数。</div>
          </div>
      )}

      <div className="space-y-4">
        {inputFields.map((field) => {
            const isLinked = detectedVariables.includes(field.key);
            return (
                <Card key={field.id} className={`relative transition-colors ${isLinked ? 'border-zinc-800' : 'border-yellow-900/30 bg-yellow-900/5'}`}>
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                         {!isLinked && (
                             <div className="flex items-center gap-1.5 text-xs text-yellow-500 px-2 py-1 bg-yellow-900/20 rounded">
                                 <AlertCircle className="w-3 h-3" />
                                 <span>未使用变量</span>
                             </div>
                         )}
                         {isLinked && (
                             <div className="flex items-center gap-1.5 text-xs text-green-500 px-2 py-1 bg-green-900/20 rounded">
                                 <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                 <span>已关联</span>
                             </div>
                         )}
                        <button onClick={() => removeField(field.id)} className="text-zinc-500 hover:text-red-400 p-1 hover:bg-red-900/20 rounded transition-colors">
                            <Trash className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        {/* Key & Label */}
                        <div className="md:col-span-5 space-y-4">
                            <Input 
                                label="变量 Key (对应 {{key}})"
                                value={field.key}
                                onChange={(e) => updateField(field.id, 'key', e.target.value)}
                                className={`font-mono ${isLinked ? 'text-green-400' : 'text-yellow-400'}`}
                                placeholder="variable_name"
                            />
                            <Input 
                                label="显示标签 (Label)"
                                value={field.label}
                                onChange={(e) => updateField(field.id, 'label', e.target.value)}
                                placeholder="用户看到的标题"
                            />
                        </div>

                        {/* Type & Config */}
                        <div className="md:col-span-7 space-y-4">
                             <div className="grid grid-cols-2 gap-4">
                                <Select 
                                    label="输入框类型"
                                    options={[
                                        { label: '单行文本 (Text)', value: 'string' },
                                        { label: '数字 (Number)', value: 'number' },
                                        { label: '多行文本 (Textarea)', value: 'textarea' },
                                        { label: '密码框 (Password)', value: 'password' },
                                        { label: '下拉选择 (Select)', value: 'select' },
                                    ]}
                                    value={field.type}
                                    onChange={(e) => updateField(field.id, 'type', e.target.value)}
                                />
                                
                                {/* Default Value with Linker */}
                                <div className="relative">
                                    <Input 
                                        label="默认值 / 引用前序结果"
                                        value={field.defaultValue || ''}
                                        onChange={(e) => updateField(field.id, 'defaultValue', e.target.value)}
                                        placeholder="静态值 或 {{引用}}"
                                    />
                                    {/* Link Trigger */}
                                    {previousComponents.length > 0 && (
                                        <div className="absolute top-7 right-2">
                                            <button 
                                                className={`p-1 rounded hover:bg-zinc-700 ${activeLinkFieldId === field.id ? 'text-primary' : 'text-zinc-500'}`}
                                                onClick={() => setActiveLinkFieldId(activeLinkFieldId === field.id ? null : field.id)}
                                                title="引用前一步骤的结果"
                                            >
                                                <LinkIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}

                                    {/* Link Popover */}
                                    {activeLinkFieldId === field.id && (
                                        <div className="absolute top-full right-0 mt-2 w-64 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden animate-in zoom-in-95 duration-200">
                                            <div className="flex items-center justify-between p-2 border-b border-zinc-800 bg-zinc-950">
                                                <span className="text-xs font-semibold text-zinc-400">插入引用</span>
                                                <button onClick={() => setActiveLinkFieldId(null)}><X className="w-3 h-3 text-zinc-500"/></button>
                                            </div>
                                            <div className="max-h-48 overflow-y-auto p-1">
                                                {previousComponents.map(pc => (
                                                    <button 
                                                        key={pc.id}
                                                        className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 rounded flex items-center gap-2 group"
                                                        onClick={() => handleLinkVariable(field.id, pc.name, pc.id)}
                                                    >
                                                        <span className="w-5 h-5 flex items-center justify-center bg-zinc-800 rounded text-zinc-400 group-hover:bg-zinc-700 font-mono text-[10px]">
                                                            ID
                                                        </span>
                                                        <div className="flex flex-col">
                                                            <span className="text-zinc-200">{pc.name}</span>
                                                            <span className="text-[10px] text-zinc-500">Output Response</span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                             </div>
                             
                             <div className="grid grid-cols-2 gap-4">
                                <Input 
                                    label="占位提示 (Placeholder)"
                                    value={field.placeholder || ''}
                                    onChange={(e) => updateField(field.id, 'placeholder', e.target.value)}
                                />
                                {field.type === 'select' ? (
                                    <Input 
                                        label="选项 (逗号分隔)"
                                        value={field.options?.map(o => o.value).join(',') || ''}
                                        onChange={(e) => {
                                            const opts = e.target.value.split(',').map(s => s.trim()).filter(Boolean).map(s => ({ label: s, value: s }));
                                            updateField(field.id, 'options', opts);
                                        }}
                                        placeholder="GPT-4, Claude-3, Gemini"
                                    />
                                ) : (
                                    <div className="opacity-0 pointer-events-none">
                                        <Input label="Hidden" disabled />
                                    </div>
                                )}
                             </div>
                        </div>
                    </div>
                </Card>
            );
        })}
      </div>
    </div>
  );
};