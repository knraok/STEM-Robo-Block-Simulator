
import React, { useState } from 'react';
import { Block, BlockType } from '../types';
import { MOTION_METADATA } from '../constants';
import { Layers, Activity, Settings2, Trash2, Plus, Radar } from 'lucide-react';

interface BlockCodingProps {
  blocks: Block[];
  onAddBlock: (type: BlockType, parentId?: string) => void;
  onRemoveBlock: (id: string) => void;
  onUpdateBlock: (id: string, updates: Partial<Block>) => void;
  activeBlockId: string | null;
  isRunning: boolean;
}

const BlockCoding: React.FC<BlockCodingProps> = ({ 
  blocks, onAddBlock, onRemoveBlock, onUpdateBlock, activeBlockId, isRunning 
}) => {
  const [activeTab, setActiveTab] = useState<'motion' | 'control' | 'action' | 'sensor'>('motion');

  const renderBlock = (block: Block, depth: number = 0) => {
    const meta = MOTION_METADATA[block.type];
    const isActive = activeBlockId === block.id;
    
    return (
      <div key={block.id} style={{ marginLeft: `${depth * 20}px` }}
        className={`group relative flex flex-col p-3 rounded-2xl border-2 transition-all animate-block mb-2
          ${isActive ? 'border-emerald-400 bg-emerald-900/20 scale-[1.02] z-10 shadow-lg' : 'border-slate-800 bg-slate-900 hover:border-slate-700'}
          ${isRunning && !isActive ? 'opacity-40 grayscale pointer-events-none' : ''}
        `}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`w-8 h-8 ${meta.color} rounded-xl flex items-center justify-center text-white font-bold shadow-lg`}>{meta.icon}</span>
            <span className="font-black text-[10px] uppercase tracking-tighter">{meta.label}</span>
          </div>
          {!isRunning && <button onClick={() => onRemoveBlock(block.id)} className="text-slate-600 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>}
        </div>

        <div className="space-y-3">
          {block.type === BlockType.ULTRASONIC ? (
            <div className="flex flex-col gap-2 bg-slate-950 p-2 rounded-xl border border-sky-500/20">
              <div className="flex justify-between text-[10px] font-black uppercase text-sky-400">
                <span>THRESHOLD</span>
                <span>{block.threshold} cm</span>
              </div>
              <input type="range" min="5" max="100" step="5" disabled={isRunning} value={block.threshold || 20}
                onChange={(e) => onUpdateBlock(block.id, { threshold: parseInt(e.target.value) })}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none accent-sky-500" />
            </div>
          ) : block.type === BlockType.REPEAT ? (
            <div className="flex items-center gap-3 bg-slate-950 p-2 rounded-xl">
              <span className="text-[10px] font-black text-orange-400 uppercase">Times</span>
              <input type="number" min="1" max="10" disabled={isRunning} value={block.iterations || 1}
                onChange={(e) => onUpdateBlock(block.id, { iterations: parseInt(e.target.value) || 1 })}
                className="w-full bg-transparent text-xs font-bold text-center border-none focus:outline-none" />
              <button onClick={() => onAddBlock(BlockType.FORWARD, block.id)} className="text-orange-400 hover:scale-110 transition-all"><Plus className="w-4 h-4" /></button>
            </div>
          ) : (block.type === BlockType.LED || block.type === BlockType.BUZZER) ? (
            <button disabled={isRunning} onClick={() => onUpdateBlock(block.id, { state: !block.state })}
              className={`w-full py-2 rounded-xl font-black text-[10px] tracking-widest transition-all ${block.state ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
              {block.state ? 'ACTIVATE' : 'DEACTIVATE'}
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[8px] font-black text-slate-500 uppercase">Duration</span>
                <input type="number" min="0.5" max="10" step="0.5" disabled={isRunning} value={block.duration}
                  onChange={(e) => onUpdateBlock(block.id, { duration: parseFloat(e.target.value) })}
                  className="w-full bg-slate-950 rounded-lg px-2 py-1 text-xs font-mono text-emerald-400 border border-slate-800" />
              </div>
              <div className="space-y-1">
                <span className="text-[8px] font-black text-slate-500 uppercase">Speed %</span>
                <input type="number" min="10" max="100" step="10" disabled={isRunning} value={block.speed}
                  onChange={(e) => onUpdateBlock(block.id, { speed: parseInt(e.target.value) })}
                  className="w-full bg-slate-950 rounded-lg px-2 py-1 text-xs font-mono text-emerald-400 border border-slate-800" />
              </div>
            </div>
          )}
        </div>

        {block.type === BlockType.REPEAT && block.children && (
          <div className="mt-4 pl-4 border-l-2 border-orange-500/20 space-y-2">
            {block.children.map(child => renderBlock(child, 0))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl">
      <div className="flex border-b border-slate-800 p-2 gap-1">
        {[
          { id: 'motion', icon: Activity, label: 'Motion', color: 'text-blue-400' },
          { id: 'sensor', icon: Radar, label: 'Sensors', color: 'text-sky-400' },
          { id: 'control', icon: Layers, label: 'Control', color: 'text-orange-400' },
          { id: 'action', icon: Settings2, label: 'Action', color: 'text-amber-400' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex flex-col items-center py-3 rounded-2xl transition-all ${activeTab === tab.id ? 'bg-white/5 ' + tab.color : 'text-slate-600 hover:text-slate-400'}`}>
            <tab.icon className="w-5 h-5 mb-1" />
            <span className="text-[8px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="p-4 bg-slate-950/50 flex gap-2 overflow-x-auto custom-scrollbar no-scrollbar">
        {Object.entries(MOTION_METADATA).filter(([_, m]) => m.category === activeTab).map(([type, meta]) => (
          <button key={type} onClick={() => onAddBlock(type as BlockType)} disabled={isRunning}
            className={`${meta.color} text-white px-4 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-30`}>
            <span className="text-sm">{meta.icon}</span>
            <span className="text-[9px] font-black uppercase tracking-tighter">{meta.label}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 p-6 overflow-y-auto space-y-2 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] custom-scrollbar">
        {blocks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-20 text-center">
            <Radar className="w-16 h-16 mb-4 animate-pulse" />
            <p className="font-black uppercase tracking-widest text-xs">Awaiting Program...</p>
          </div>
        ) : blocks.map(block => renderBlock(block))}
      </div>
    </div>
  );
};

export default BlockCoding;
