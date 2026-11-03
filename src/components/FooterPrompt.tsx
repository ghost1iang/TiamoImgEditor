import React from 'react';
import { MousePointer2, Send, Loader2, Bug } from 'lucide-react';
import { ImageEditorCore } from '../core/useImageEditorCore';

interface FooterPromptProps {
  core: ImageEditorCore;
  className?: string;
}

export const FooterPrompt: React.FC<FooterPromptProps> = ({ core, className = "" }) => {
  const {
    currentImage,
    prompt,
    setPrompt,
    isLoading,
    handleEditClick,
    errorMessage,
  } = core;

  return (
    <div className={`mt-auto bg-white/80 backdrop-blur-md border-t border-slate-200 p-2 shrink-0 z-30 ${className}`}>
      <div className="max-w-xl mx-auto flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative group">
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-500 opacity-40">
              <MousePointer2 size={12} />
            </div>
            <input 
              type="text" 
              value={prompt} 
              onChange={(e) => setPrompt(e.target.value)} 
              onKeyPress={(e) => e.key === 'Enter' && handleEditClick()} 
              disabled={!currentImage || isLoading} 
              placeholder="输入 AI 指令..." 
              className="w-full h-8 bg-[#f1f5f9] border-2 border-transparent focus:bg-white focus:border-indigo-500/20 pl-8 pr-3 outline-none transition-all font-semibold text-[10px] text-slate-700 rounded-xl" 
            />
          </div>
          <button 
            onClick={handleEditClick} 
            disabled={!currentImage || isLoading || !prompt.trim()} 
            className="h-8 px-5 bg-slate-900 text-white flex items-center gap-2 font-black hover:bg-slate-800 disabled:bg-slate-300 transition-all text-[10px] shrink-0 shadow-lg active:scale-95 rounded-xl"
          >
            {isLoading ? <Loader2 size={10} className="animate-spin" /> : <span>重构</span>}
            {!isLoading && <Send size={10} />}
          </button>
        </div>
        {errorMessage && (
          <div className="flex items-start gap-1.5 p-1.5 bg-red-50 border border-red-100 rounded-lg animate-in slide-in-from-bottom-1">
            <Bug size={10} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-[9px] text-red-600 font-bold leading-tight break-all">错误: {errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
};
