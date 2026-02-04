import React from 'react';
import { Plus, ArrowDown, Box, Settings2, Trash2, GripVertical } from 'lucide-react';
import { Component } from '../../types/schema';
import { Button, Card, Badge } from '../ui/Common';

interface AppAssemblerProps {
  components: Component[];
  onAddComponent: () => void;
  onEditComponent: (id: string) => void;
  onDeleteComponent: (id: string) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void; // Placeholder for future D&D
}

export const AppAssembler: React.FC<AppAssemblerProps> = ({ 
  components, 
  onAddComponent, 
  onEditComponent, 
  onDeleteComponent 
}) => {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8 animate-in fade-in duration-300">
      
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">应用流程编排 (Assembly)</h2>
        <p className="text-zinc-400">定义应用的执行流。组件将按照以下顺序依次执行。</p>
      </div>

      <div className="relative space-y-2">
        {/* Timeline Line */}
        {components.length > 0 && (
             <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-zinc-800 z-0"></div>
        )}

        {components.map((comp, index) => (
          <div key={comp.id} className="relative z-10">
            <div className="flex items-center gap-4 group">
               {/* Step Number / Icon */}
               <div className="w-16 h-16 flex flex-col items-center justify-center shrink-0 rounded-2xl bg-surface border border-zinc-800 shadow-sm z-10">
                   <span className="text-xs font-mono text-zinc-500 mb-1">STEP</span>
                   <span className="text-xl font-bold text-zinc-200">{index + 1}</span>
               </div>

               {/* Card */}
               <div 
                 className="flex-1 bg-zinc-900/50 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 transition-all cursor-pointer group"
                 onClick={() => onEditComponent(comp.id)}
               >
                 <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-zinc-950 rounded-md">
                            <Box className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-zinc-200">{comp.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[10px] font-mono">{comp.apiConfig.method}</Badge>
                                <span className="text-xs text-zinc-500 truncate max-w-[200px]">{comp.apiConfig.url}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={(e) => { e.stopPropagation(); onEditComponent(comp.id); }}
                            className="h-8 w-8 p-0"
                            title="配置组件"
                        >
                            <Settings2 className="w-4 h-4" />
                        </Button>
                         <Button 
                            variant="danger" 
                            size="sm" 
                            onClick={(e) => { e.stopPropagation(); onDeleteComponent(comp.id); }}
                            className="h-8 w-8 p-0 bg-red-900/20 hover:bg-red-900/40 text-red-400 border-red-900/50"
                            title="删除步骤"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                 </div>

                 {/* Input/Output Summary */}
                 <div className="mt-4 pt-4 border-t border-zinc-800/50 flex gap-6 text-xs">
                    <div className="flex-1">
                        <span className="text-zinc-500 uppercase tracking-wider font-semibold">输入参数 (Inputs)</span>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                            {comp.inputFields.length > 0 ? (
                                comp.inputFields.map(f => (
                                    <span key={f.id} className="bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded border border-zinc-700">
                                        {f.key}
                                    </span>
                                ))
                            ) : (
                                <span className="text-zinc-600 italic">无</span>
                            )}
                        </div>
                    </div>
                 </div>
               </div>
            </div>

            {/* Arrow Connector */}
            {index < components.length - 1 && (
                <div className="pl-16 ml-[-9px] py-2 flex justify-center">
                    <ArrowDown className="w-5 h-5 text-zinc-700" />
                </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Button */}
      <div className="relative z-10 flex justify-center pt-4">
        <Button 
            onClick={onAddComponent} 
            className="rounded-full h-12 px-6 shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
            icon={Plus}
        >
            添加下一个步骤 (Next Step)
        </Button>
      </div>
    </div>
  );
};