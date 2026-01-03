
import React, { useState, useEffect } from 'react';
import { Block, MotionMode } from '../types';
import { MOTION_METADATA } from '../constants';

interface BlockCodingProps {
  blocks: Block[];
  onAddBlock: (type: MotionMode) => void;
  onRemoveBlock: (index: number) => void;
  onUpdateBlock: (index: number, updates: Partial<Block>) => void;
  activeBlockIndex: number | null;
  isRunning: boolean;
}

const BlockCoding: React.FC<BlockCodingProps> = ({ 
  blocks, 
  onAddBlock, 
  onRemoveBlock, 
  onUpdateBlock,
  activeBlockIndex,
  isRunning
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval: any;
    if (isRunning && activeBlockIndex !== null) {
      const activeBlock = blocks[activeBlockIndex];
      const startTime = Date.now();
      const duration = activeBlock.duration * 1000;
      
      setProgress(0);
      interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const p = Math.min(100, (elapsed / duration) * 100);
        setProgress(p);
        if (p >= 100) clearInterval(interval);
      }, 50);
    } else {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [isRunning, activeBlockIndex, blocks]);

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
      {/* Toolbox */}
      <div className="p-4 border-b border-slate-800 bg-slate-800/50">
        <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">Motion Blocks</h3>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(MOTION_METADATA).map(([type, meta]) => (
            <button
              key={type}
              onClick={() => onAddBlock(type as MotionMode)}
              disabled={isRunning}
              className={`${meta.color} hover:brightness-110 disabled:opacity-50 disabled:grayscale text-white p-2 rounded-lg flex items-center gap-2 transition-all active:scale-95 text-xs font-semibold`}
            >
              <span className="text-lg">{meta.icon}</span>
              {meta.label}
            </button>
          ))}
        </div>
      </div>

      {/* Workspace */}
      <div className="flex-1 p-4 overflow-y-auto space-y-2 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] custom-scrollbar">
        {blocks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-8 space-y-4">
            <div className="w-16 h-16 border-2 border-dashed border-slate-700 rounded-full flex items-center justify-center text-2xl">
              +
            </div>
            <p className="text-sm italic">Click a block on the top to start building your robot's mission!</p>
          </div>
        ) : (
          blocks.map((block, index) => {
            const meta = MOTION_METADATA[block.type];
            const isActive = activeBlockIndex === index;
            
            return (
              <div 
                key={block.id}
                className={`group relative flex flex-col p-3 rounded-xl border-2 transition-all animate-block overflow-hidden
                  ${isActive ? 'border-emerald-400 bg-emerald-900/20 scale-105 z-10' : 'border-slate-700 bg-slate-800 hover:border-slate-500'}
                  ${isRunning && !isActive ? 'opacity-50 pointer-events-none' : ''}
                `}
              >
                {/* Progress Bar Background */}
                {isActive && (
                  <div 
                    className="absolute inset-0 bg-emerald-400/10 transition-all duration-75 origin-left" 
                    style={{ transform: `scaleX(${progress / 100})` }}
                  />
                )}

                <div className="relative z-10 flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-8 h-8 ${meta.color} rounded flex items-center justify-center text-white font-bold`}>
                      {meta.icon}
                    </span>
                    <span className="font-bold text-sm">{meta.label}</span>
                  </div>
                  {!isRunning && (
                    <button 
                      onClick={() => onRemoveBlock(index)}
                      className="text-slate-500 hover:text-rose-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                  )}
                </div>
                
                <div className="relative z-10 flex items-center gap-4 text-[11px] font-mono text-slate-400">
                  <div className="flex-1">
                    <label className="block mb-1">Duration: {block.duration}s</label>
                    <input 
                      type="range" 
                      min="0.5" max="5" step="0.5" 
                      disabled={isRunning}
                      value={block.duration}
                      onChange={(e) => onUpdateBlock(index, { duration: parseFloat(e.target.value) })}
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-30"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block mb-1">Speed: {block.speed}%</label>
                    <input 
                      type="range" 
                      min="10" max="100" step="10" 
                      disabled={isRunning}
                      value={block.speed}
                      onChange={(e) => onUpdateBlock(index, { speed: parseInt(e.target.value) })}
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-30"
                    />
                  </div>
                </div>

                {isActive && (
                  <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BlockCoding;
