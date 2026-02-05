
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, Box, Clock, RefreshCw, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Button, Card, Badge, Modal } from '../components/ui/Common';
import { useToast } from '../components/ui/Toast';

const AppManager: React.FC = () => {
  const { apps, isLoading, loadApps, deleteApp, addApp } = useAppStore();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    loadApps();
  }, []);

  const handleCreate = async () => {
      const newAppId = crypto.randomUUID();
      await addApp({
          id: newAppId,
          name: '未命名应用 (Untitled)',
          description: '',
          icon: 'Box',
          runMode: 'panel',
          components: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          layoutConfig: { direction: 'vertical', gap: 4 }
      });
      addToast('应用已创建 (App Created)', 'success');
      navigate(`/builder/${newAppId}`);
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    if (deleteTargetId) {
      await deleteApp(deleteTargetId);
      addToast('应用已删除', 'success');
      setDeleteTargetId(null);
    }
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
    <div className="p-8 max-w-7xl mx-auto w-full animate-in fade-in duration-500 relative">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">配置应用 (App Config)</h1>
          <p className="text-muted mt-1">创建、编辑或删除您的工作流应用。</p>
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
          <p className="text-zinc-500 mb-6 max-w-xs text-center">点击上方按钮创建您的第一个应用。</p>
          <Button onClick={handleCreate} variant="secondary">
            创建应用
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {apps.map((app) => (
            <Card key={app.id} className="group hover:border-zinc-600 transition-all flex flex-col h-full relative overflow-hidden p-0 border-zinc-800 bg-zinc-900">
               <div className="flex-1 p-6">
                   <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                            <Box className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <Badge variant="outline" className="bg-zinc-950/50">{app.components.length} 步骤</Badge>
                            <Badge variant="default" className="text-[10px] bg-zinc-800 text-zinc-400 border-0">{app.runMode === 'chat' ? '对话模式' : '面板模式'}</Badge>
                        </div>
                   </div>
                   
                   <h3 className="text-lg font-semibold text-zinc-100 mb-2 truncate">{app.name}</h3>
                   <p className="text-sm text-zinc-500 line-clamp-2 h-10 mb-2">
                     {app.description || "暂无描述..."}
                   </p>
               </div>

               <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-between mt-auto relative z-10">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500" title="Last Modified">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDate(app.updatedAt)}
                  </div>
                  
                  <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => handleEdit(e, app.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 hover:text-white rounded-md transition-colors text-xs font-medium text-zinc-400"
                        title="编辑应用"
                      >
                          <Edit className="w-3.5 h-3.5" /> 编辑
                      </button>
                      <button 
                        onClick={(e) => handleDeleteClick(e, app.id)}
                        className="p-1.5 hover:bg-red-900/20 hover:text-red-400 rounded-md transition-colors text-zinc-500"
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

      {/* Delete Modal */}
      <Modal 
          isOpen={!!deleteTargetId} 
          onClose={() => setDeleteTargetId(null)}
          title="确认删除"
          width="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleteTargetId(null)}>
                取消 (Cancel)
              </Button>
              <Button variant="danger" onClick={confirmDelete}>
                确认删除 (Delete)
              </Button>
            </>
          }
      >
          <div className="flex flex-col gap-4">
             <div className="flex items-center gap-3 text-red-400">
               <AlertTriangle className="w-10 h-10" />
               <p className="text-sm text-zinc-300">
                 您确定要删除此应用吗？该操作将永久移除所有配置和历史记录，且<span className="text-red-400 font-bold">无法撤销</span>。
               </p>
            </div>
          </div>
      </Modal>
    </div>
  );
};

export default AppManager;
