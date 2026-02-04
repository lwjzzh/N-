import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Play, Box, Layout, RefreshCw, AlertCircle, Layers, Settings, Code } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { App, Component } from '../types/schema';
import { Button, Input, Textarea, Card } from '../components/ui/Common';
import { ApiConfigPanel } from '../components/builder/ApiConfigPanel';
import { UiMapper } from '../components/builder/UiMapper';
import { AppAssembler } from '../components/builder/AppAssembler';
import { PresetGallery } from '../components/builder/PresetGallery';

const BuilderPage: React.FC = () => {
  const { id: appId } = useParams();
  const navigate = useNavigate();
  const { getAppById, updateApp, addComponent, updateComponent, deleteComponent } = useAppStore();
  
  // --- Global State ---
  const [app, setApp] = useState<App | undefined>(undefined);
  const [isNotFound, setIsNotFound] = useState(false);
  
  // --- UI State ---
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'inputs' | 'api'>('api');
  const [showPresetGallery, setShowPresetGallery] = useState(false);

  // --- Derived State ---
  const activeComponent = useMemo(() => 
    app?.components.find(c => c.id === selectedComponentId), 
  [app, selectedComponentId]);

  // Calculate previous components for linking logic
  const previousComponents = useMemo(() => {
    if (!app || !activeComponent) return [];
    const index = app.components.findIndex(c => c.id === activeComponent.id);
    return index > 0 ? app.components.slice(0, index) : [];
  }, [app, activeComponent]);

  const detectedVariables = useMemo(() => {
      if (!activeComponent) return [];
      const { apiConfig } = activeComponent;
      const text = `${apiConfig.url} ${JSON.stringify(apiConfig.headers)} ${apiConfig.bodyTemplate || ''}`;
      const regex = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
      const matches = new Set<string>();
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.add(match[1]);
      }
      return Array.from(matches);
  }, [activeComponent?.apiConfig]);

  // --- Effects ---
  useEffect(() => {
    if (appId) {
      const data = getAppById(appId);
      if (data) {
        setApp(data);
        setIsNotFound(false);
      } else {
        setIsNotFound(true);
      }
    }
  }, [appId, getAppById]); 

  // --- Handlers ---
  const handleAppUpdate = (field: keyof App, value: any) => {
      if (!app) return;
      updateApp(app.id, { [field]: value });
      setApp(prev => prev ? ({ ...prev, [field]: value }) : undefined);
  };

  const handleAddComponent = (component: Component) => {
      if (!app) return;
      addComponent(app.id, component);
      setApp(prev => prev ? ({ ...prev, components: [...prev.components, component] }) : undefined);
      setShowPresetGallery(false);
      // Automatically select the new component
      setSelectedComponentId(component.id);
      setActiveTab('api');
  };

  const handleDeleteComponent = (id: string) => {
      if (!app) return;
      if(window.confirm("确定要删除这个步骤吗？\nAre you sure you want to delete this step?")) {
        deleteComponent(app.id, id);
        setApp(prev => prev ? ({ ...prev, components: prev.components.filter(c => c.id !== id) }) : undefined);
        if (selectedComponentId === id) setSelectedComponentId(null);
      }
  };

  const handleUpdateComponent = (id: string, updates: Partial<Component>) => {
      if (!app) return;
      updateComponent(app.id, id, updates);
      setApp(prev => {
          if (!prev) return undefined;
          return {
              ...prev,
              components: prev.components.map(c => c.id === id ? { ...c, ...updates } : c)
          };
      });
  };

  // --- Render Loading / Error ---
  if (isNotFound) {
      return (
          <div className="h-full flex flex-col items-center justify-center bg-background text-zinc-400 gap-4">
              <AlertCircle className="w-12 h-12 text-red-500" />
              <h2 className="text-xl font-semibold text-white">未找到应用 (App Not Found)</h2>
              <Button onClick={() => navigate('/')} variant="secondary">返回首页</Button>
          </div>
      );
  }

  if (!app) {
      return (
          <div className="h-full flex flex-col items-center justify-center bg-background text-zinc-500 gap-3">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <p>正在加载...</p>
          </div>
      );
  }

  return (
    <div className="h-full flex flex-col bg-background animate-in fade-in duration-300">
      
      {/* Top Bar */}
      <div className="border-b border-border bg-surface p-4 flex items-center justify-between sticky top-0 z-20 h-16">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5 text-muted" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg">{app.name}</h2>
                <button 
                    onClick={() => setSelectedComponentId(null)} // Go to settings/assembly view
                    className="text-xs text-muted hover:text-primary underline decoration-dotted"
                >
                    (编辑信息)
                </button>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className={`px-1.5 rounded ${!selectedComponentId ? 'bg-zinc-700 text-white' : ''}`}>应用编排</span>
              <span>/</span>
              <span className={`px-1.5 rounded ${selectedComponentId ? 'bg-zinc-700 text-white' : ''}`}>
                 {activeComponent ? activeComponent.name : '选择组件'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
             <Button variant="secondary" icon={Play} onClick={() => navigate(`/run/${app.id}`)}>
                运行应用
             </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Sidebar: Navigation & Component List */}
        <div className="w-64 border-r border-border bg-zinc-950/50 flex flex-col overflow-hidden">
             {/* App Level */}
             <div 
                className={`p-4 border-b border-border cursor-pointer transition-colors ${!selectedComponentId ? 'bg-primary/10 border-primary/20' : 'hover:bg-zinc-900'}`}
                onClick={() => setSelectedComponentId(null)}
             >
                 <div className="flex items-center gap-2 font-semibold text-sm text-zinc-200">
                    <Layout className="w-4 h-4" />
                    应用编排 (Overview)
                 </div>
                 <div className="text-xs text-zinc-500 mt-1 pl-6">
                    {app.components.length} 个步骤
                 </div>
             </div>

             {/* Components List */}
             <div className="flex-1 overflow-y-auto p-2 space-y-1">
                 <div className="px-2 py-2 text-xs font-medium text-muted uppercase tracking-wider">执行流程 (Pipeline)</div>
                 {app.components.map((comp, idx) => (
                    <div 
                        key={comp.id}
                        onClick={() => setSelectedComponentId(comp.id)}
                        className={`group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors ${selectedComponentId === comp.id ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}`}
                    >
                        <div className="flex items-center gap-3 overflow-hidden">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-900 border border-zinc-700 text-[10px] font-mono shrink-0">
                                {idx + 1}
                            </span>
                            <span className="truncate text-sm font-medium">{comp.name}</span>
                        </div>
                    </div>
                 ))}
                 
                 <div className="pt-2 px-2">
                     <Button 
                        variant="secondary" 
                        className="w-full text-xs border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-300" 
                        onClick={() => { setSelectedComponentId(null); setShowPresetGallery(true); }}
                     >
                        + 添加步骤 (Add Step)
                     </Button>
                 </div>
             </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-background relative">
            
            {/* Modal: Preset Gallery */}
            {showPresetGallery && (
                <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-8">
                    <div className="bg-surface border border-border shadow-2xl rounded-2xl p-6 max-w-4xl w-full max-h-full overflow-y-auto">
                        <PresetGallery 
                            onSelect={handleAddComponent} 
                            onCancel={() => setShowPresetGallery(false)} 
                        />
                    </div>
                </div>
            )}

            {/* View: App Assembly (Overview) */}
            {!selectedComponentId && !showPresetGallery && (
                <div className="flex-1 overflow-y-auto">
                    <div className="p-6 border-b border-border bg-zinc-900/30">
                        <div className="max-w-3xl mx-auto space-y-4">
                            <Input 
                                label="应用名称 (App Name)"
                                value={app.name} 
                                onChange={(e) => handleAppUpdate('name', e.target.value)}
                                className="text-lg font-bold bg-transparent border-zinc-800 focus:bg-zinc-950"
                            />
                            <Textarea 
                                label="描述 (Description)"
                                value={app.description} 
                                onChange={(e) => handleAppUpdate('description', e.target.value)}
                                className="bg-transparent border-zinc-800 focus:bg-zinc-950 min-h-[80px]"
                            />
                        </div>
                    </div>
                    <AppAssembler 
                        components={app.components}
                        onAddComponent={() => setShowPresetGallery(true)}
                        onEditComponent={(id) => setSelectedComponentId(id)}
                        onDeleteComponent={handleDeleteComponent}
                    />
                </div>
            )}

            {/* View: Component Editor */}
            {selectedComponentId && activeComponent && (
                <div className="flex-1 flex flex-col h-full">
                    {/* Tabs */}
                    <div className="flex border-b border-border bg-surface px-4 shrink-0">
                        <button 
                            onClick={() => setActiveTab('api')}
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'api' ? 'border-primary text-white' : 'border-transparent text-muted hover:text-zinc-300'}`}
                        >
                            <Code className="w-4 h-4" /> 1. API 配置
                        </button>
                        <button 
                            onClick={() => setActiveTab('inputs')}
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'inputs' ? 'border-primary text-white' : 'border-transparent text-muted hover:text-zinc-300'}`}
                        >
                            <Layers className="w-4 h-4" /> 2. 界面 & 参数映射
                        </button>
                        <button 
                            onClick={() => setActiveTab('general')}
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'general' ? 'border-primary text-white' : 'border-transparent text-muted hover:text-zinc-300'}`}
                        >
                            <Settings className="w-4 h-4" /> 组件设置
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 bg-zinc-950/30">
                        <div className="max-w-5xl mx-auto space-y-6 pb-20">
                            
                            {/* API CONFIG */}
                            {activeTab === 'api' && (
                                <ApiConfigPanel 
                                    component={activeComponent}
                                    onUpdate={(updates) => handleUpdateComponent(activeComponent.id, { apiConfig: { ...activeComponent.apiConfig, ...updates } })}
                                />
                            )}

                            {/* UI MAPPER */}
                            {activeTab === 'inputs' && (
                                <UiMapper 
                                    component={activeComponent}
                                    detectedVariables={detectedVariables}
                                    onUpdate={(fields) => handleUpdateComponent(activeComponent.id, { inputFields: fields })}
                                    previousComponents={previousComponents}
                                />
                            )}

                            {/* GENERAL */}
                            {activeTab === 'general' && (
                                <Card title="组件基础设置 (Settings)" className="animate-in slide-in-from-right-2 duration-200">
                                    <div className="grid gap-4">
                                        <Input 
                                            label="组件名称"
                                            value={activeComponent.name}
                                            onChange={(e) => handleUpdateComponent(activeComponent.id, { name: e.target.value })}
                                        />
                                        <Textarea 
                                            label="组件描述"
                                            value={activeComponent.description || ''}
                                            onChange={(e) => handleUpdateComponent(activeComponent.id, { description: e.target.value })}
                                        />
                                        <div className="p-4 rounded-lg bg-red-900/10 border border-red-900/30 flex items-center justify-between">
                                            <span className="text-sm text-red-300">危险操作</span>
                                            <Button variant="danger" size="sm" onClick={() => handleDeleteComponent(activeComponent.id)}>
                                                删除组件
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default BuilderPage;