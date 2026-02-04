import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, Edit, Trash2, Box, Clock, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Button, Card, Badge } from '../components/ui/Common';

const Dashboard: React.FC = () => {
  const { apps, isLoading, loadApps, deleteApp, addApp } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadApps();
  }, []);

  const handleCreate = async () => {
      const newAppId = crypto.randomUUID();
      await addApp({
          id: newAppId,
          name: '未命名应用 (Untitled)',
          description: '',
          components: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          layoutConfig: { direction: 'vertical', gap: 4 }
      });
      navigate(`/builder/${newAppId}`);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    // Critical: Stop event from bubbling up to the Card's onClick
    e.preventDefault();
    e.stopPropagation();
    
    if (window.confirm('确定要删除这个应用吗？此操作无法撤销。\nAre you sure you want to delete this app?')) {
      await deleteApp(id);
    }
  };

  const handleRun = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      navigate(`/run/${id}`);
  };

  const handleEdit = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      navigate(`/builder/${id}`);
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
    <div className="p-8 max-w-7xl mx-auto w-full animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">仪表盘 (Dashboard)</h1>
          <p className="text-muted mt-1">管理您的 API 自动化工作流与应用。</p>
        </div>
        <Button onClick={handleCreate} icon={Plus}>
          创建新应用
        </Button>
      </div>

      {apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/30">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
            <Box className="w-8 h-8 text-zinc-500" />
          </div>
          <h3 className="text-xl font-medium text-white mb-2">暂无应用</h3>
          <p className="text-zinc-500 mb-6 max-w-xs text-center">通过创建您的第一个组件化 API 工作流来开始使用。</p>
          <Button onClick={handleCreate} variant="secondary">
            创建应用
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {apps.map((app) => (
            <Card key={app.id} className="group hover:border-zinc-600 transition-all flex flex-col h-full relative overflow-hidden p-0 border-zinc-800 bg-zinc-900">
               {/* Clickable Area: Main Body Only */}
               <div 
                  className="flex-1 p-6 cursor-pointer"
                  onClick={() => navigate(`/builder/${app.id}`)}
               >
                   <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                            <Box className="w-5 h-5" />
                        </div>
                        <Badge variant="outline" className="bg-zinc-950/50">{app.components.length} 步骤</Badge>
                   </div>
                   
                   <h3 className="text-lg font-semibold text-zinc-100 mb-2 truncate">{app.name}</h3>
                   <p className="text-sm text-zinc-500 line-clamp-2 h-10 mb-2">
                     {app.description || "暂无描述..."}
                   </p>
               </div>

               {/* Footer / Actions - Increased Z-Index to ensure clickability */}
               <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-between mt-auto relative z-10">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500" title="Last Modified">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDate(app.updatedAt)}
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => handleRun(e, app.id)}
                        className="p-2 hover:bg-primary/10 hover:text-primary rounded-md transition-colors cursor-pointer"
                        title="运行应用"
                      >
                          <Play className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => handleEdit(e, app.id)}
                        className="p-2 hover:bg-zinc-800 hover:text-white rounded-md transition-colors cursor-pointer"
                        title="编辑应用"
                      >
                          <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => handleDelete(e, app.id)}
                        className="p-2 hover:bg-red-900/20 hover:text-red-400 rounded-md transition-colors cursor-pointer"
                        title="删除应用"
                      >
                          <Trash2 className="w-4 h-4" />
                      </button>
                  </div>
               </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;