import React, { useState, useMemo } from 'react';
import { FileJson, Eye, Image as ImageIcon, Film, Music, Copy, Check, Terminal, FileText } from 'lucide-react';

interface ResultRendererProps {
  result: any;
  status: 'idle' | 'running' | 'success' | 'error';
  error?: string;
  duration?: number;
}

// --- Helper: Media Detection ---
const getMediaFromObject = (obj: any): { type: 'image' | 'video' | 'audio', url: string }[] => {
  if (!obj) return [];
  const media: { type: 'image' | 'video' | 'audio', url: string }[] = [];
  
  // Recursively search for media keys
  const traverse = (item: any, depth = 0) => {
    if (depth > 10 || !item) return; // Prevent infinite recursion
    
    if (typeof item === 'string') {
        // Basic extension check
        if (item.match(/\.(jpeg|jpg|gif|png|webp|bmp)($|\?)/i) || item.startsWith('data:image')) {
            media.push({ type: 'image', url: item });
        } else if (item.match(/\.(mp4|webm|ogg|mov)($|\?)/i)) {
            media.push({ type: 'video', url: item });
        } else if (item.match(/\.(mp3|wav|m4a)($|\?)/i)) {
            media.push({ type: 'audio', url: item });
        }
        return;
    }

    if (typeof item === 'object') {
      // Prioritize explicit keys common in AI APIs
      if (item.image_url) media.push({ type: 'image', url: item.image_url });
      if (item.video_url) media.push({ type: 'video', url: item.video_url });
      if (item.audio_url) media.push({ type: 'audio', url: item.audio_url });
      if (item.url && typeof item.url === 'string') {
         // Check if the generic 'url' field looks like media
         traverse(item.url, depth + 1);
      }
      
      // Traverse all values
      Object.values(item).forEach(val => traverse(val, depth + 1));
    }
  };

  traverse(obj);
  // Deduplicate by URL
  return media.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
};

// --- Helper: Text Extraction ---
// Safely extracts readable text from complex JSON responses (like OpenAI choices)
const getTextContent = (obj: any): string => {
    if (obj === null || obj === undefined) return '';
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
    
    // Recursive strategy for common patterns
    if (obj.content && typeof obj.content === 'string') return obj.content;
    if (obj.text && typeof obj.text === 'string') return obj.text;
    if (obj.message && typeof obj.message === 'string') return obj.message;
    if (obj.message?.content) return getTextContent(obj.message.content);
    
    // Array of choices/candidates (LLM style)
    if (obj.choices && Array.isArray(obj.choices)) {
        return obj.choices.map((c: any) => getTextContent(c.message || c.text || c)).join('\n\n');
    }
    
    // Fallback: Valid JSON string
    try {
        return JSON.stringify(obj, null, 2);
    } catch (e) {
        return '[Circular/Invalid Object]';
    }
};

export const ResultRenderer: React.FC<ResultRendererProps> = ({ result, status, error, duration }) => {
  const [viewMode, setViewMode] = useState<'preview' | 'json'>('preview');
  const [copied, setCopied] = useState(false);

  const mediaItems = useMemo(() => status === 'success' && result ? getMediaFromObject(result) : [], [result, status]);
  const textContent = useMemo(() => status === 'success' && result ? getTextContent(result) : '', [result, status]);

  const handleCopy = () => {
    const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === 'idle') {
    return (
      <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-zinc-600 border-2 border-dashed border-zinc-800 rounded-lg bg-zinc-900/20">
        <Terminal className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">就绪 (Ready)</p>
      </div>
    );
  }

  if (status === 'error') {
     return (
        <div className="rounded-lg border border-red-900/50 bg-red-950/10 p-4 text-red-200 text-sm font-mono overflow-auto h-full">
            <div className="flex items-center gap-2 mb-2 text-red-400 font-bold uppercase tracking-wider text-xs">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                执行失败 (Failed)
            </div>
            {error || 'Unknown error occurred'}
        </div>
     );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden shadow-sm">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/50 border-b border-zinc-800 shrink-0">
         <div className="flex gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
             <button 
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${viewMode === 'preview' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
             >
                <Eye className="w-3.5 h-3.5" /> 预览
             </button>
             <button 
                onClick={() => setViewMode('json')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${viewMode === 'json' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
             >
                <FileJson className="w-3.5 h-3.5" /> JSON
             </button>
         </div>

         <div className="flex items-center gap-3">
             {status === 'running' && (
                 <span className="flex items-center gap-1.5 text-xs text-blue-400 animate-pulse">
                     <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                     处理中...
                 </span>
             )}
             {status === 'success' && duration && (
                 <span className="text-[10px] text-zinc-500 font-mono">{duration}ms</span>
             )}
             <button 
                onClick={handleCopy}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
                title="复制结果"
             >
                 {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
             </button>
         </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-4 custom-scrollbar relative">
         {viewMode === 'preview' ? (
             <div className="space-y-6">
                 {/* Text Content */}
                 {textContent ? (
                     <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap font-sans text-zinc-300 leading-relaxed">
                         {textContent}
                         {status === 'running' && <span className="inline-block w-1.5 h-4 ml-0.5 align-middle bg-primary animate-pulse"/>}
                     </div>
                 ) : (
                     <div className="flex flex-col items-center justify-center h-32 text-zinc-600">
                        <FileText className="w-8 h-8 mb-2 opacity-20" />
                        <span className="text-xs">无文本内容</span>
                     </div>
                 )}

                 {/* Media Grid */}
                 {mediaItems.length > 0 && (
                     <div className="grid grid-cols-2 gap-4 mt-4 border-t border-zinc-800 pt-4">
                         {mediaItems.map((media, idx) => (
                             <div key={idx} className="relative group rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900">
                                 {media.type === 'image' && (
                                     <div className="relative aspect-video flex items-center justify-center bg-black/40">
                                         <img src={media.url} alt="Result" className="max-w-full max-h-full object-contain" />
                                         <div className="absolute top-2 left-2 bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[10px] text-white flex items-center gap-1">
                                             <ImageIcon className="w-3 h-3" /> Image
                                         </div>
                                     </div>
                                 )}
                                 {media.type === 'video' && (
                                     <div className="relative aspect-video bg-black">
                                        <video src={media.url} controls className="w-full h-full" />
                                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[10px] text-white flex items-center gap-1 pointer-events-none">
                                             <Film className="w-3 h-3" /> Video
                                         </div>
                                     </div>
                                 )}
                                 {media.type === 'audio' && (
                                     <div className="p-4 flex items-center gap-3">
                                         <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                                             <Music className="w-4 h-4" />
                                         </div>
                                         <audio src={media.url} controls className="h-8 w-full max-w-[200px]" />
                                     </div>
                                 )}
                             </div>
                         ))}
                     </div>
                 )}
             </div>
         ) : (
             <pre className="font-mono text-xs text-blue-300 whitespace-pre-wrap break-all">
                {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
             </pre>
         )}
      </div>
    </div>
  );
};