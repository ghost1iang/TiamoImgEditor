import React, { useState } from 'react';
import { History, Trash2, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { ImageEditorCore } from '../core/useImageEditorCore';

interface SidebarProps {
  core: ImageEditorCore;
}

export const Sidebar: React.FC<SidebarProps> = ({ core }) => {
  const {
    sidebarOpen,
    setSidebarOpen,
    history,
    setHistory,
    setCurrentImage,
    activeRecord,
    setActiveRecord,
    setPrompt,
    resetWand,
    setDisplaySize,
    setPanOffset,
  } = core;

  // 记录每个历史缩略图的自然像素尺寸 { w, h }
  const [dimensions, setDimensions] = useState<Record<number, { w: number; h: number }>>({});

  const handleImageLoad = (id: number, img: HTMLImageElement) => {
    if (img.naturalWidth && img.naturalHeight) {
      setDimensions(prev => {
        if (prev[id]?.w === img.naturalWidth && prev[id]?.h === img.naturalHeight) return prev;
        return { ...prev, [id]: { w: img.naturalWidth, h: img.naturalHeight } };
      });
    }
  };

  return (
    <>
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 bg-white border-r border-slate-200 flex flex-col relative overflow-hidden shadow-sm shrink-0`}>
        <div className="p-2 border-b border-slate-100 flex justify-between items-center whitespace-nowrap text-xs leading-none">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-indigo-50 text-indigo-600 font-black rounded">
              <History size={14} />
            </div>
            <span className="font-bold text-slate-700">编辑历史</span>
          </div>
          <button 
            onClick={() => {
              setHistory([]); 
              setCurrentImage(null); 
              setActiveRecord(null); 
              setPrompt(""); 
              resetWand();
            }} 
            className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors rounded"
            title="清空历史"
          >
            <Trash2 size={12} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2 no-scrollbar">
          {history.map((item) => {
            const dim = dimensions[item.id] || (item.width && item.height ? { w: item.width, h: item.height } : null);
            return (
              <div 
                key={item.id} 
                onClick={() => { 
                  setCurrentImage(item.url); 
                  setActiveRecord(item); 
                  if (item.displaySize) {
                    setDisplaySize(item.displaySize);
                  } else {
                    setDisplaySize(null);
                  }
                  if (item.panOffset) {
                    setPanOffset(item.panOffset);
                  }
                }} 
                className={`group cursor-pointer border-2 p-1.5 transition-all duration-200 rounded-xl ${activeRecord?.id === item.id ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' : 'border-transparent hover:bg-slate-50'}`}
              >
                <div className="relative aspect-[4/3] overflow-hidden mb-1 bg-slate-100 border border-slate-200 shadow-inner rounded-lg leading-[0]">
                  <img 
                    src={item.url} 
                    alt="History" 
                    className="w-full h-full object-cover" 
                    onLoad={(e) => handleImageLoad(item.id, e.currentTarget)}
                  />
                  <div className="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <RotateCcw size={16} className="text-indigo-600" />
                  </div>
                </div>
                {/* 底部：左边文件说明，右边图片像素值 WxH */}
                <div className="px-0.5 flex items-center justify-between gap-1 text-[9px] leading-tight">
                  <span className="truncate font-medium text-slate-500 italic" title={item.prompt}>
                    "{item.prompt}"
                  </span>
                  {dim && (
                    <span className="shrink-0 font-mono text-[8.5px] font-semibold text-slate-400 bg-slate-100 px-1 py-0.5 rounded border border-slate-200/50">
                      {dim.w}x{dim.h}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 侧边栏底部状态栏：左边当前文件说明，右边当前图片像素值 WxH */}
        {activeRecord && (
          <div className="p-2 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
            <span className="truncate max-w-[130px] font-medium text-slate-600" title={activeRecord.prompt}>
              {activeRecord.prompt}
            </span>
            {(() => {
              const activeDim = dimensions[activeRecord.id] || (activeRecord.width && activeRecord.height ? { w: activeRecord.width, h: activeRecord.height } : null);
              if (!activeDim) return null;
              return (
                <span className="shrink-0 font-mono text-[9px] font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs">
                  {activeDim.w}x{activeDim.h}
                </span>
              );
            })()}
          </div>
        )}
      </aside>

      {/* 展开/收起按钮 */}
      <button 
        onClick={() => setSidebarOpen(!sidebarOpen)} 
        className="absolute left-0 top-1/2 -translate-y-1/2 z-40 bg-white border border-slate-200 shadow-sm p-1 text-slate-400 hover:text-indigo-600 transition-colors rounded-r-lg"
      >
        {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>
    </>
  );
};
