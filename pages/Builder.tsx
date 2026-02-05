
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, Play, Box, Layout, RefreshCw, AlertCircle, Layers, Settings, Code, MonitorPlay, MessageSquare, AlertTriangle } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { App, Component } from '../types/schema';
import { Button, Input, Textarea, Card, Select, Modal } from '../components/ui/Common';
import { ApiConfigPanel } from '../components/builder/ApiConfigPanel';
import { UiMapper } from '../components/builder/UiMapper';
import { AppAssembler } from '../components/builder/AppAssembler';
import { PresetGallery } from '../components/builder/PresetGallery';
import { useToast } from '../components/ui/Toast';

const BuilderPage: React.FC = () => {
  const { id: appId } = useParams();
  const navigate = useNavigate();
  const { getAppById, updateApp, addComponent, updateComponent, deleteComponent } = useAppStore();
  const { addToast } = useToast();
  
  // --- Global State ---
  const [app, setApp] = useState<App | undefined>(undefined);
  const [isNotFound, setIsNotFound] = useState(false);
  
  // --- UI State ---
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'inputs' | 'api'>('api');
  const [showPresetGallery, setShowPresetGallery] = useState(false);
  const [deleteComponentId, setDeleteComponentId] = useState<string | null>(null);

  // --- Debounce Refs ---
  // Stores pending updates to prevent overwriting when typing fast in multiple fields
  const appUpdatesRef = useRef<Partial<App>>({});
  // Fix: Use ReturnType<typeof setTimeout> for browser compatibility (returns number)
  const appUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const compUpdatesRef = useRef<Record<string, Partial<Component>>>({});
  // Fix: Use ReturnType<typeof setTimeout>
  const compUpdateTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // --- Derived State ---
  const activeComponent = useMemo(() => 
    app?.components.find(c => c.id === selectedComponentId), 
  [app, selectedComponentId]);

  const previousComponents = useMemo(() => {
    if (!app || !activeComponent) return [];
    const index = app.components.findIndex(c => c.id === activeComponent.id);
    return index > 0 ? app.components.slice(0, index) : [];
  }, [app, activeComponent]);

  const detectedVariables = useMemo(() => {
      if (!activeComponent) return [];
      const { apiConfig } = activeComponent;
      const text = `${apiConfig.url} ${JSON.stringify(apiConfig.headers)} ${apiConfig.bodyTemplate || ''}`;
      // Updated Regex to include $ for system variables
      const regex = /{{\s*([a-zA-Z0-9_$]+)\s*}}/g;
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

  // Cleanup timeouts on unmount
  useEffect(() => {
      return () => {
          if (appUpdateTimeoutRef.current) clearTimeout(appUpdateTimeoutRef.current);
          Object.values(compUpdateTimeoutsRef.current).forEach(t => clearTimeout(t));
      };
  }, []);

  // --- Handlers ---

  // 1. Debounced App Update (Name, Description, RunMode)
  const handleAppUpdate = (field: keyof App, value: any) => {
      if (!app) return;
      
      // Update UI Immediately
      setApp(prev => prev ? ({ ...prev, [field]: value }) : undefined);

      // Accumulate changes
      appUpdatesRef.current = { ...appUpdatesRef.current, [field]: value };

      // Debounce Save
      if (appUpdateTimeoutRef.current) clearTimeout(appUpdateTimeoutRef.current);
      
      appUpdateTimeoutRef.current = setTimeout(() => {
          if (Object.keys(appUpdatesRef.current).length > 0) {
              updateApp(app.id, appUpdatesRef.current);
              appUpdatesRef.current = {}; // Reset pending
          }
      }, 800); // 800ms delay
  };

  // 2. Debounced Component Update
  const handleUpdateComponent = (id: string, updates: Partial<Component>) => {
      if (!app) return;

      // Update UI Immediately
      setApp(prev => {
          if (!prev) return undefined;
          return {
              ...prev,
              components: prev.components.map(c => c.id === id ? { ...c, ...updates } : c)
          };
      });

      // Accumulate changes per component ID
      compUpdatesRef.current[id] = { ...(compUpdatesRef.current[id] || {}), ...updates };

      // Debounce Save per component
      if (compUpdateTimeoutsRef.current[id]) clearTimeout(compUpdateTimeoutsRef.current[id]);

      compUpdateTimeoutsRef.current[id] = setTimeout(() => {
          if (compUpdatesRef.current[id]) {
              updateComponent(app.id, id, compUpdatesRef.current[id]);
              delete compUpdatesRef.current[id];
          }
          delete compUpdateTimeoutsRef.current[id];
      }, 1000); // 1s delay for complex component updates
  };

  const handleAddComponent = (component: Component) => {
      if (!app) return;
      addComponent(app.id, component);
      setApp(prev => prev ? ({ ...prev, components: [...prev.components, component] }) : undefined);
      setShowPresetGallery(false);
      setSelectedComponentId(component.id);
      setActiveTab('api');
      addToast('组件已添加', 'success');
  };

  const confirmDeleteComponent = () => {
      if (!app || !deleteComponentId) return;
      deleteComponent(app.id, deleteComponentId);
      setApp(prev => prev ? ({ ...prev, components: prev.components.filter(c => c.id !== deleteComponentId) }) : undefined);
      if (selectedComponentId === deleteComponentId) setSelectedComponentId(null);
      setDeleteComponentId(null);
      addToast('组件已删除', 'success');
  };

  const handleMoveComponent = (id: string, direction: 'up' | 'down') => {
      if (!app) return;
      const index = app.components.findIndex(c => c.id === id);
      if (index === -1) return;
      
      const newComponents = [...app.components];
      if (direction === 'up' && index > 0) {
          [newComponents[index - 1], newComponents[index]] = [newComponents[index], newComponents[index - 1]];
      } else if (direction === 'down' && index < newComponents.length - 1) {
          [newComponents[index], newComponents[index + 1]] = [newComponents[index + 1], newComponents[index]];
      } else {
          return;
      }
      
      // Update local state immediately
      setApp({ ...app, components: newComponents });
      
      // Force immediate save for structural changes
      updateApp(app.id, { components: newComponents });
  };

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
          <div className="flex flex-col">
             <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg leading-tight">{app.name}</h2>
                <button 
                    onClick={() => setSelectedComponentId(null)} 
                    className="text-xs text-muted hover:text-primary underline decoration-dotted"
                >
                    (设置)
                </button>
            </div>
            {selectedComponentId ? (
                <div className="flex items-center gap-1 text-xs text-zinc-500">
                     <span>编辑组件:</span>
                     <span className="text-zinc-300 font-medium">{activeComponent?.name}</span>
                </div>
            ) : (
                <div className="flex items-center gap-1 text-xs text-zinc-500">
                    <Layout className="w-3 h-3" />
                    <span>全局设置</span>
                </div>
            )}
          </div>
        </div>

        {/* Top Bar Actions */}
        <div className="flex items-center gap-4">
             {/* Run Mode Toggle */}
             <div className="flex items-center bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                <button
                    onClick={() => handleAppUpdate('runMode', 'panel')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${app.runMode === 'panel' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    title="传统面板模式"
                >
                    <MonitorPlay className="w-3.5 h-3.5" />
                    Panel
                </button>
                <button
                    onClick={() => handleAppUpdate('runMode', 'chat')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${app.runMode === 'chat' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    title="对话流模式"
                >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Chat
                </button>
             </div>

             <div className="h-6 w-px bg-zinc-800"></div>

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
                        onDeleteComponent={(id) => setDeleteComponentId(id)}
                        onMoveComponent={handleMoveComponent}
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
                            <Layers className="w-4 h-4" /> 2. 参数 & UI 映射
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
                                    onUpdate={(params) => handleUpdateComponent(activeComponent.id, { parameters: params })}
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
                                            <Button variant="danger" size="sm" onClick={() => setDeleteComponentId(activeComponent.id)}>
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

      {/* Delete Component Modal */}
      <Modal 
          isOpen={!!deleteComponentId} 
          onClose={() => setDeleteComponentId(null)} 
          title="删除步骤" 
          width="sm"
          footer={
             <>
                 <Button variant="ghost" onClick={() => setDeleteComponentId(null)}>取消</Button>
                 <Button variant="danger" onClick={confirmDeleteComponent}>确认删除</Button>
             </>
          }
      >
          <div className="flex items-start gap-4 text-red-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <p className="text-sm text-zinc-300 mt-1">
                  确定要删除此步骤吗？此操作将移除该组件及其所有配置，可能会影响后续依赖此步骤的流程。
              </p>
          </div>
      </Modal>
    </div>
  );
};

export default BuilderPage;
