"use client";

import { motion } from "framer-motion";
import { Copy, Monitor, AppWindow, Shield, Brain, Cog, Database, LayoutDashboard } from "lucide-react";

export default function ArchitectureDiagram() {
  return (
    <div className="glass-panel p-6 rounded-xl border border-white/5 h-full relative overflow-hidden flex flex-col">
      <h2 className="text-sm font-mono text-green-400 mb-6 uppercase tracking-wider">Architecture</h2>
      
      <div className="flex-1 w-full flex items-center justify-between text-xs font-mono text-zinc-400">
        
        {/* Data Sources */}
        <div className="flex flex-col gap-3 w-1/5">
          <div className="text-[10px] text-center mb-2">DATA SOURCES</div>
          <div className="border border-white/10 rounded p-2 flex items-center gap-2 bg-black/40"><Copy className="w-4 h-4"/> Clipboard</div>
          <div className="border border-white/10 rounded p-2 flex items-center gap-2 bg-black/40"><Monitor className="w-4 h-4"/> Screenshots</div>
          <div className="border border-white/10 rounded p-2 flex items-center gap-2 bg-black/40"><AppWindow className="w-4 h-4"/> Active Windows</div>
        </div>

        {/* Arrow */}
        <div className="flex-1 h-px border-t border-dashed border-zinc-700 relative">
           <motion.div 
             animate={{ x: ["0%", "100%"], opacity: [0, 1, 0] }}
             transition={{ repeat: Infinity, duration: 2 }}
             className="absolute top-[-3px] w-1.5 h-1.5 rounded-full bg-green-500"
           />
        </div>

        {/* Local Agent */}
        <div className="w-1/5 border border-green-500/30 bg-green-500/5 rounded-lg p-3 text-center">
          <Shield className="w-6 h-6 text-green-400 mx-auto mb-2" />
          <div className="text-green-400 font-bold mb-1">LOCAL AGENT</div>
          <div className="text-[9px] text-zinc-500 leading-tight">
            Real-time Capture<br/>OCR Extraction<br/>Context Collection
          </div>
        </div>

        {/* Arrow */}
        <div className="flex-1 h-px border-t border-dashed border-zinc-700 relative">
           <motion.div 
             animate={{ x: ["0%", "100%"], opacity: [0, 1, 0] }}
             transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
             className="absolute top-[-3px] w-1.5 h-1.5 rounded-full bg-cyan-500"
           />
        </div>

        {/* AI Engine */}
        <div className="w-1/5 border border-cyan-500/30 bg-cyan-500/5 rounded-lg p-3 text-center">
          <Brain className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
          <div className="text-cyan-400 font-bold mb-1 text-[10px]">AI ANALYSIS ENGINE</div>
          <div className="text-[9px] text-zinc-500 leading-tight">
            7B LLM (Ollama)<br/>Semantic Understanding<br/>Secret Detection
          </div>
        </div>

        {/* Arrow */}
        <div className="flex-1 h-px border-t border-dashed border-zinc-700 relative">
           <motion.div 
             animate={{ x: ["0%", "100%"], opacity: [0, 1, 0] }}
             transition={{ repeat: Infinity, duration: 2, delay: 1 }}
             className="absolute top-[-3px] w-1.5 h-1.5 rounded-full bg-orange-500"
           />
        </div>

        {/* Risk Engine */}
        <div className="w-1/5 border border-orange-500/30 bg-orange-500/5 rounded-lg p-3 text-center">
          <Cog className="w-6 h-6 text-orange-400 mx-auto mb-2" />
          <div className="text-orange-400 font-bold mb-1">RISK ENGINE</div>
          <div className="text-[9px] text-zinc-500 leading-tight">
            Risk Scoring<br/>Policy Matching
          </div>
        </div>

      </div>

      <div className="absolute bottom-4 right-4 flex gap-4 text-[10px] font-mono text-zinc-500">
        <div className="flex items-center gap-1"><Database className="w-3 h-3"/> Local Store</div>
        <div className="flex items-center gap-1 text-green-500"><LayoutDashboard className="w-3 h-3"/> Dashboard</div>
      </div>
    </div>
  );
}
