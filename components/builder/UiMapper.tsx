
import React, { useState } from 'react';
import { Plus, Trash, AlertCircle, Wand2, Link as LinkIcon, X, Eye, EyeOff } from 'lucide-react';
import { Component, ParamDefinition, ParamUiType } from '../../types/schema';
import { Button, Input, Select, Card } from '../ui/Common';

interface UiMapperProps {
  component: Component;
  onUpdate: (params: ParamDefinition[]) => void;
  detectedVariables: string[];
  previousComponents?: Component[];
}

export const UiMapper: React.FC<UiMapperProps> = ({ component, onUpdate, detectedVariables, previousComponents = [] }) => {
  const { parameters } = component;
  const [activeLinkFieldId, setActiveLinkFieldId] = useState<string | null>(null);

  // --- Actions ---
  const addParam = (key: string = '') => {
    const newParam: ParamDefinition = {
      id: crypto.randomUUID(),
      key: key || `var_${parameters.length + 1}`,
      label: key ? key.charAt(0).toUpperCase() + key.slice(1) : '新参数',
      uiType: 'input',
      value: '',
      isVisible: true,
    };
    onUpdate([...parameters, newParam]);
  };

  const removeParam = (id: string) => {
    onUpdate(parameters.filter(i => i.id !== id));
  };

  const updateParam = (id: string, field: keyof ParamDefinition, value: any) => {
    onUpdate(parameters.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  // Find variables that don't have a corresponding UI field
  // Filter out system variables starting with $ (e.g., $session_id)
  const unmappedVariables = detectedVariables.filter(v => 
      !parameters.find(f => f.key === v) && !v.startsWith('$')
  );

  const handleAutoGenerate = () => {
      const newParams: ParamDefinition[] = unmappedVariables.map(v => ({
          id: crypto.randomUUID(),
          key: v,
          label: v.charAt(0).toUpperCase() + v.slice(1),
          uiType: 'input',
          value: '',
          isVisible: true
      }));
      onUpdate([...parameters, ...newParams]);
  };

  const handleLinkVariable = (paramId: string, sourceCompName: string, sourceCompId: string) => {
      const ref = `{{${sourceCompId}.response}}`; 
      const param = parameters.find(f => f.id === paramId);
      if(param) {
          const currentVal = param.value || '';
          updateParam(paramId, 'value', currentVal ? currentVal + ' ' + ref : ref);
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
                  自动生成参数
              </Button>
          </div>
      )}

      <div className="flex justify-between items-center mb-2">
         <h3 className="text-lg font-medium">参数与 UI 映射 (Parameters)</h3>
         <Button size="sm" icon={Plus} onClick={() => addParam()}>添加手动参数</Button>
      </div>

      {parameters.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/30 text-zinc-500 text-sm">
             <div className="mb-2">暂无参数配置。</div>
             <div className="text-xs text-zinc-600">定义参数后，可以在运行界面输入或设置固定值。</div>
          </div>
      )}

      <div className="space-y-4">
        {parameters.map((param) => {
            const isLinked = detectedVariables.includes(param.key);
            return (
                <Card key={param.id} className={`relative transition-colors ${isLinked ? 'border-zinc-800' : 'border-yellow-900/30 bg-yellow-900/5'}`}>
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
                        <button onClick={() => removeParam(param.id)} className="text-zinc-500 hover:text-red-400 p-1 hover:bg-red-900/20 rounded transition-colors">
                            <Trash className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        {/* Key & Label */}
                        <div className="md:col-span-5 space-y-4">
                            <Input 
                                label="变量 Key (对应 {{key}})"
                                value={param.key}
                                onChange={(e) => updateParam(param.id, 'key', e.target.value)}
                                className={`font-mono ${isLinked ? 'text-green-400' : 'text-yellow-400'}`}
                                placeholder="variable_name"
                            />
                            <Input 
                                label="显示标签 (Label)"
                                value={param.label}
                                onChange={(e) => updateParam(param.id, 'label', e.target.value)}
                                placeholder="用户看到的标题"
                            />
                        </div>

                        {/* Config */}
                        <div className="md:col-span-7 space-y-4">
                             <div className="grid grid-cols-12 gap-4">
                                <div className="col-span-4">
                                    <Select 
                                        label="控件类型"
                                        options={[
                                            { label: '文本 (Input)', value: 'input' },
                                            { label: '多行文本 (Textarea)', value: 'textarea' },
                                            { label: '数字 (Number)', value: 'number' },
                                            { label: '日期 (Date)', value: 'date' },
                                            { label: '邮箱 (Email)', value: 'email' },
                                            { label: '密码 (Password)', value: 'password' },
                                            { label: '复选框 (Checkbox)', value: 'boolean' },
                                            { label: '下拉选择 (Select)', value: 'select' },
                                            { label: '单选 (Radio)', value: 'radio' },
                                            { label: '文件/二进制 (File)', value: 'file' },
                                        ]}
                                        value={param.uiType}
                                        onChange={(e) => updateParam(param.id, 'uiType', e.target.value as ParamUiType)}
                                    />
                                </div>
                                <div className="col-span-3">
                                    <label className="text-sm font-medium text-muted block mb-1.5">可见性</label>
                                    <button 
                                        onClick={() => updateParam(param.id, 'isVisible', !param.isVisible)}
                                        className={`flex items-center justify-center w-full h-10 rounded-md border text-sm font-medium transition-colors ${param.isVisible ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700' : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-400'}`}
                                        title={param.isVisible ? "用户可见 (User Input)" : "隐藏 (Fixed/System)"}
                                    >
                                        {param.isVisible ? (
                                            <><Eye className="w-4 h-4 mr-2" /> 显示</>
                                        ) : (
                                            <><EyeOff className="w-4 h-4 mr-2" /> 隐藏</>
                                        )}
                                    </button>
                                </div>
                                
                                {/* Value / Default with Linker */}
                                <div className="col-span-5 relative">
                                    {param.uiType === 'boolean' ? (
                                        <Select 
                                            label="默认状态 (Default)"
                                            options={[
                                                { label: '未选中 (False)', value: 'false' },
                                                { label: '选中 (True)', value: 'true' }
                                            ]}
                                            value={param.value || 'false'}
                                            onChange={(e) => updateParam(param.id, 'value', e.target.value)}
                                        />
                                    ) : (
                                        <Input 
                                            label={param.isVisible ? "默认值 (Default)" : "固定值 (Fixed)"}
                                            value={param.value || ''}
                                            onChange={(e) => updateParam(param.id, 'value', e.target.value)}
                                            placeholder={param.isVisible ? "用户可修改..." : "系统固定值..."}
                                        />
                                    )}
                                    
                                    {/* Link Trigger - Only show for text-based inputs where interpolation makes sense easily */}
                                    {previousComponents.length > 0 && param.uiType !== 'boolean' && (
                                        <div className="absolute top-7 right-2">
                                            <button 
                                                className={`p-1 rounded hover:bg-zinc-700 ${activeLinkFieldId === param.id ? 'text-primary' : 'text-zinc-500'}`}
                                                onClick={() => setActiveLinkFieldId(activeLinkFieldId === param.id ? null : param.id)}
                                                title="引用前一步骤的结果"
                                            >
                                                <LinkIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}

                                    {/* Link Popover */}
                                    {activeLinkFieldId === param.id && (
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
                                                        onClick={() => handleLinkVariable(param.id, pc.name, pc.id)}
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
                             
                             {/* Options input for Select AND Radio */}
                             {(param.uiType === 'select' || param.uiType === 'radio') && (
                                <Input 
                                    label="选项 (逗号分隔)"
                                    defaultValue={param.options?.map(o => o.value).join(',') || ''}
                                    onBlur={(e) => {
                                        // Use onBlur to allow typing commas without immediate parsing/splitting
                                        const val = e.target.value;
                                        if (val !== param.options?.map(o => o.value).join(',')) {
                                            const opts = val.split(',').map(s => s.trim()).filter(Boolean).map(s => ({ label: s, value: s }));
                                            updateParam(param.id, 'options', opts);
                                        }
                                    }}
                                    placeholder="选项1, 选项2, 选项3"
                                    className="border-dashed focus:border-solid border-zinc-700 focus:border-primary"
                                />
                             )}
                        </div>
                    </div>
                </Card>
            );
        })}
      </div>
    </div>
  );
};
