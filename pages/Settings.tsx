
import React, { useEffect } from 'react';
import { FolderOpen, Save, Database, HardDrive, FileText, CheckCircle2 } from 'lucide-react';
import { Button, Input, Card } from '../components/ui/Common';
import { useSettingsStore } from '../store/useSettingsStore';

// Helper to access backend methods
const getBackend = () => (window as any).go?.main?.App;

const SettingsPage: React.FC = () => {
  const { defaultSavePath, autoSaveResult, setDefaultSavePath, setAutoSaveResult, loadSettings } = useSettingsStore();

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSelectDirectory = async () => {
      const backend = getBackend();
      if (backend && backend.SelectDirectory) {
          try {
              const path = await backend.SelectDirectory();
              if (path) {
                  setDefaultSavePath(path);
              }
          } catch (e) {
              console.error("Failed to select directory", e);
          }
      } else {
          alert("Backend not connected or SelectDirectory not implemented.");
      }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto w-full animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">设置 (Settings)</h1>
        <p className="text-muted mt-1">管理应用偏好与数据存储。</p>
      </div>

      <div className="space-y-6">
        {/* Storage Settings */}
        <Card title="存储设置 (Storage)">
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">
                        本地默认保存目录 (Default Save Path)
                    </label>
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <Input 
                                value={defaultSavePath || '未设置 (Not Set)'} 
                                readOnly 
                                className="bg-zinc-950 font-mono text-zinc-300" 
                            />
                        </div>
                        <Button 
                            variant="secondary" 
                            onClick={handleSelectDirectory} 
                            icon={FolderOpen} 
                            className="shrink-0 whitespace-nowrap"
                        >
                            选择目录
                        </Button>
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">
                        用于存放运行结果生成的文件，包括视频、图片、音频、TXT、CSV、MD 等。
                    </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-zinc-800 rounded text-zinc-400">
                            <Save className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-zinc-200">自动保存结果 (Auto-Save Results)</h4>
                            <p className="text-xs text-zinc-500">开启后，运行产生的结果文件将自动保存到默认目录。关闭则需手动保存。</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={autoSaveResult}
                            onChange={(e) => setAutoSaveResult(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                </div>
            </div>
        </Card>

        {/* Database Tools */}
        <Card title="数据库管理 (Database Tools)">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg flex flex-col gap-4">
                    <div className="flex items-center gap-3 text-zinc-300">
                        <Database className="w-5 h-5" />
                        <span className="font-medium">本地数据库 (Local DB)</span>
                    </div>
                    <div className="text-xs text-zinc-500 space-y-1">
                        <p>Status: <span className="text-green-500">Active</span></p>
                        <p>Size: 1.2 MB</p>
                        <p>Records: 1,024</p>
                    </div>
                    <div className="flex gap-2 mt-auto">
                        <Button size="sm" variant="secondary" className="w-full text-xs">备份 (Backup)</Button>
                        <Button size="sm" variant="secondary" className="w-full text-xs">清理 (Optimize)</Button>
                    </div>
                </div>

                <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg flex flex-col gap-4">
                    <div className="flex items-center gap-3 text-zinc-300">
                        <HardDrive className="w-5 h-5" />
                        <span className="font-medium">文件缓存 (Cache)</span>
                    </div>
                    <div className="text-xs text-zinc-500 space-y-1">
                        <p>Images: 45 files</p>
                        <p>Temp: 12.5 MB</p>
                    </div>
                    <div className="flex gap-2 mt-auto">
                        <Button size="sm" variant="danger" className="w-full text-xs bg-red-900/20 hover:bg-red-900/40 border-red-900/50 text-red-400">清除缓存 (Clear)</Button>
                    </div>
                </div>
            </div>
            
            <div className="mt-4 p-3 bg-blue-900/10 border border-blue-900/30 rounded flex items-center gap-2 text-xs text-blue-300">
                 <CheckCircle2 className="w-4 h-4" />
                 <span>数据库连接正常，日志记录已启用。</span>
            </div>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;
