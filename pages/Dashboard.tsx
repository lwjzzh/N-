
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Box, Clock, RefreshCw, PenTool, Search, LayoutGrid, List, Pin, MessageSquare, MonitorPlay, PinOff } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Card, Badge, Button, Input, Modal } from '../components/ui/Common';
import { App, AppRunMode } from '../types/schema';

const Dashboard: React.FC = () => {
  const { apps, isLoading, loadApps, togglePinApp } = useAppStore();
  const navigate = useNavigate();

  // Local State
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedAppForRun, setSelectedAppForRun] = useState<App | null>(null);

  useEffect(() => {
    loadApps();
  }, []);

  // Filter and Sort
  const filteredApps = useMemo(() => {
      let result = apps;
      
      // Search
      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          result = result.filter(a => 
              a.name.toLowerCase().includes(q) || 
              a.description?.toLowerCase().includes(q)
          );
      }

      // Sort: Pinned first, then Newest first
      result = [...result].sort((a, b) => {
          if (a.isPinned !== b.isPinned) {
              return a.isPinned ? -1 : 1;
          }
          return b.updatedAt - a.updatedAt;
      });

      return result;
  }, [apps, searchQuery]);

  const handleAppClick = (app: App) => {
      setSelectedAppForRun(app);
  };

  const confirmRun = (mode: AppRunMode) => {
      if (selectedAppForRun) {
          navigate(`/run/${selectedAppForRun.id}?mode=${mode}`);
          setSelectedAppForRun(null);
      }
  };

  const handlePin = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      togglePinApp(id);
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
  };

  if (isLoading) {
      return (
          <div className="flex h-screen items-center justify-center text-zinc-500 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin" />
              正在加载应用...
          </div>
      );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto w-full animate-in fade-in duration-500 relative h-full flex flex-col">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">应用库 (App Library)</h1>
          <p className="text-muted mt-1">管理和运行您的自动化应用。</p>
        </div>
        
        <div className="flex items-center gap-3">
             <div className="relative w-64">
                 <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                 <input 
                    type="text" 
                    placeholder="搜索应用..." 
                    className="w-full h-10 pl-9 pr-3 rounded-md border border-zinc-800 bg-zinc-950/50 text-sm text-zinc-200 focus:outline-none focus:border-primary/50 transition-colors"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                 />
             </div>
             
             <div className="flex bg-zinc-900 border border-zinc-800 rounded-md p-0.5">
                 <button 
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-sm transition-colors ${viewMode === 'grid' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    title="网格视图"
                 >
                     <LayoutGrid className="w-4 h-4" />
                 </button>
                 <button 
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-sm transition-colors ${viewMode === 'list' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    title="列表视图"
                 >
                     <List className="w-4 h-4" />
                 </button>
             </div>
        </div>
      </div>

      {/* App List/Grid */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-10">
          {filteredApps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/30">
              <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                <Box className="w-8 h-8 text-zinc-500" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">{apps.length === 0 ? '暂无可用应用' : '未找到匹配应用'}</h3>
              <p className="text-zinc-500 mb-6 max-w-xs text-center">{apps.length === 0 ? '您还没有创建任何应用。' : '请尝试更换搜索关键词。'}</p>
              {apps.length === 0 && (
                <Button onClick={() => navigate('/apps')} variant="secondary" icon={PenTool}>
                    前往配置应用
                </Button>
              )}
            </div>
          ) : (
            <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-3"}>
              {filteredApps.map((app) => (
                viewMode === 'grid' ? (
                    // GRID ITEM
                    <Card key={app.id} className="group hover:border-zinc-600 hover:shadow-lg hover:shadow-primary/5 transition-all flex flex-col h-full relative overflow-hidden p-0 border-zinc-800 bg-zinc-900 cursor-pointer"
                        onClick={() => handleAppClick(app)}
                    >
                        <div className="absolute top-3 right-3 z-20">
                            <button 
                                onClick={(e) => handlePin(e, app.id)} 
                                className={`p-1.5 rounded-full backdrop-blur-sm transition-colors ${app.isPinned ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-900/50 text-zinc-600 hover:text-zinc-300'}`}
                                title={app.isPinned ? "取消置顶" : "置顶应用"}
                            >
                                {app.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                            </button>
                        </div>

                        <div className="flex-1 p-6">
                            <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                                        <Box className="w-6 h-6" />
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <Badge variant="default" className="text-[10px] bg-zinc-800 text-zinc-400 border-0">{app.runMode === 'chat' ? '对话模式' : '面板模式'}</Badge>
                                    </div>
                            </div>
                            
                            <h3 className="text-lg font-semibold text-zinc-100 mb-2 truncate group-hover:text-primary transition-colors">{app.name}</h3>
                            <p className="text-sm text-zinc-500 line-clamp-2 h-10 mb-2">
                                {app.description || "暂无描述..."}
                            </p>
                        </div>

                        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-between mt-auto">
                            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                <Clock className="w-3.5 h-3.5" />
                                {formatDate(app.updatedAt)}
                            </div>
                            
                            <div className="flex items-center gap-1 text-primary text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                                点击运行 <Play className="w-3 h-3 ml-1 fill-current" />
                            </div>
                        </div>
                    </Card>
                ) : (
                    // LIST ITEM
                    <div 
                        key={app.id} 
                        className="group flex items-center gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:border-zinc-700 cursor-pointer transition-all"
                        onClick={() => handleAppClick(app)}
                    >
                        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0 group-hover:text-primary transition-colors">
                            <Box className="w-5 h-5" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-zinc-200 truncate group-hover:text-primary transition-colors">{app.name}</h3>
                                {app.isPinned && <Pin className="w-3 h-3 text-blue-400 fill-current" />}
                            </div>
                            <p className="text-xs text-zinc-500 truncate">{app.description || "暂无描述..."}</p>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                            <Badge variant="outline" className="text-[10px]">{app.runMode === 'chat' ? '对话模式' : '面板模式'}</Badge>
                            <span className="text-xs text-zinc-600 font-mono hidden md:block">{formatDate(app.updatedAt)}</span>
                            
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={(e) => handlePin(e, app.id)} 
                                    className={`p-2 rounded hover:bg-zinc-700 transition-colors ${app.isPinned ? 'text-blue-400' : 'text-zinc-600 hover:text-zinc-300'}`}
                                >
                                    {app.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                                </button>
                                <Button size="sm" icon={Play} onClick={(e) => { e.stopPropagation(); handleAppClick(app); }}>运行</Button>
                            </div>
                        </div>
                    </div>
                )
              ))}
            </div>
          )}
      </div>

      {/* Run Mode Selection Modal */}
      <Modal
          isOpen={!!selectedAppForRun}
          onClose={() => setSelectedAppForRun(null)}
          title="选择运行模式"
          width="md"
      >
          <div className="flex flex-col gap-6 p-2">
             <div className="text-center">
                 <h3 className="text-lg font-bold text-white mb-2">{selectedAppForRun?.name}</h3>
                 <p className="text-sm text-zinc-400">请选择以哪种界面模式运行此应用。</p>
             </div>

             <div className="grid grid-cols-2 gap-4">
                 <button
                    className="flex flex-col items-center gap-3 p-6 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:border-primary/50 transition-all group"
                    onClick={() => confirmRun('panel')}
                 >
                     <div className="p-3 rounded-full bg-zinc-950 group-hover:bg-primary/10 text-zinc-400 group-hover:text-primary transition-colors">
                         <MonitorPlay className="w-8 h-8" />
                     </div>
                     <div className="text-center">
                         <div className="font-semibold text-zinc-200">传统面板 (Panel)</div>
                         <div className="text-xs text-zinc-500 mt-1">表单输入，直接查看结果。</div>
                     </div>
                 </button>

                 <button
                    className="flex flex-col items-center gap-3 p-6 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:border-primary/50 transition-all group"
                    onClick={() => confirmRun('chat')}
                 >
                     <div className="p-3 rounded-full bg-zinc-950 group-hover:bg-primary/10 text-zinc-400 group-hover:text-primary transition-colors">
                         <MessageSquare className="w-8 h-8" />
                     </div>
                     <div className="text-center">
                         <div className="font-semibold text-zinc-200">流式对话 (Chat)</div>
                         <div className="text-xs text-zinc-500 mt-1">类似 ChatGPT 的交互体验。</div>
                     </div>
                 </button>
             </div>
          </div>
      </Modal>

    </div>
  );
};

export default Dashboard;
