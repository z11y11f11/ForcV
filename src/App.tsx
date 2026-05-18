import React, { useState } from 'react';
import { Shield, LayoutDashboard, FileText, Bell, Settings, Search, AlertCircle, Bot, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AnalysisResult } from './types';
import AnalysisDashboard from './components/AnalysisDashboard';
import Uploader from './components/Uploader';
import { runMasterAnalysis } from './services/ai';

export default function App() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [agentProgress, setAgentProgress] = useState<{agent: string, status: string} | null>(null);

  const handleAgentEvent = (evt: { agent: string, status: string }) => {
    setAgentProgress(evt);
  };

  return (
    <div className="flex-1 flex bg-[#02040a] text-slate-300 font-sans overflow-hidden h-screen w-full">
      {/* Sidebar - Visual only for V1 structure */}
      <aside className="w-64 border-r border-slate-800/50 bg-[#080a0f] flex flex-col hidden lg:flex">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 flex items-center justify-center p-1.5 bg-blue-600 rounded-lg shadow-[0_0_15px_rgba(37,99,235,0.4)] text-white">
              <Shield className="w-full h-full" />
            </div>
            <div>
              <div className="text-xl font-bold font-display tracking-tight text-white leading-none">FinAgent</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Multi-Agent System</div>
            </div>
          </div>

          <nav className="space-y-1">
            <NavItem icon={<LayoutDashboard className="w-4 h-4" />} label="Dashboard" active />
            <NavItem icon={<FileText className="w-4 h-4" />} label="Reports" />
            <NavItem icon={<Bell className="w-4 h-4" />} label="Alerts" />
            <div className="pt-4 pb-2 px-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest">System</div>
            <NavItem icon={<Settings className="w-4 h-4" />} label="Settings" />
          </nav>
        </div>
        
        <div className="mt-auto p-4 bg-[#0a0d14] border-t border-slate-800">
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span>Orchestrator Active</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-gradient-to-br from-[#050810] to-[#02040a] relative overflow-hidden h-full">
        <header className="h-16 border-b border-slate-800/50 bg-black/20 backdrop-blur-md flex items-center justify-between px-8 z-10 shrink-0">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const ticker = (formData.get('ticker') as string).trim();
              if (ticker) {
                // Reject natural language input — ticker symbols don't contain spaces
                // and are typically short alphanumeric strings (e.g. AAPL, 1810.HK, BRK.B)
                if (/\s/.test(ticker) || ticker.length > 20) {
                  setError('This field is for ticker symbols only (e.g. AAPL, 1810.HK). Use the "Orchestrator Request" chatbox below for natural language queries.');
                  return;
                }
                setError(null);
                setIsAnalyzing(true);
                setAnalysis(null);
                setAgentProgress(null);

                try {
                  const aiResult = await runMasterAnalysis(
                     { ticker, options: ['highlights', 'risks', 'esg', 'competitors'] },
                     handleAgentEvent
                  );
                  setAnalysis(aiResult);
                } catch (err: any) {
                  setError(err.message || 'Failed to search ticker');
                } finally {
                  setIsAnalyzing(false);
                  setAgentProgress(null);
                }
              }
            }}>
              <input 
                name="ticker"
                type="text" 
                placeholder="Submit ticker to Orchestrator (e.g. AAPL)..." 
                className="w-full pl-10 pr-4 py-2 bg-slate-800/30 border border-slate-800 rounded-lg text-sm text-slate-200 focus:bg-slate-800/80 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all outline-none placeholder-slate-500/70"
              />
            </form>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => window.location.reload()}
              className="text-sm font-medium text-slate-400 hover:text-white flex items-center gap-2 mr-4 transition-colors"
              title="Refresh Page"
            >
              🔄 Refresh Page
            </button>
            <div className="w-8 h-8 rounded-full border border-slate-700 bg-slate-800/50 flex items-center justify-center text-xs font-bold text-slate-400">
              ME
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 relative">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="fixed bottom-6 left-6 z-50 max-w-md p-4 bg-rose-950/80 border border-rose-900/50 shadow-[0_0_30px_rgba(225,29,72,0.2)] backdrop-blur-md rounded-xl flex items-start gap-3 text-rose-200"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
                <p className="text-sm font-medium leading-relaxed">{error}</p>
                <button 
                  onClick={() => setError(null)}
                  className="ml-auto text-xs font-bold hover:text-white hover:underline whitespace-nowrap shrink-0 mt-0.5"
                >
                  Dismiss
                </button>
              </motion.div>
            )}

            {isAnalyzing && agentProgress && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg mb-8"
              >
                 <div className="bg-slate-900/80 backdrop-blur-lg border border-indigo-500/30 rounded-xl p-4 shadow-[0_0_40px_rgba(99,102,241,0.2)] flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                       <Bot className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                       <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                         <Zap className="w-3 h-3 animate-pulse" />
                         {agentProgress.agent}
                       </div>
                       <div className="text-sm text-slate-200 truncate mt-1">{agentProgress.status}</div>
                    </div>
                 </div>
              </motion.div>
            )}

            {!analysis ? (
              <motion.section
                key="uploader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center pt-8"
              >
                <div className="text-center w-full max-w-2xl mx-auto">
                  <div className="mb-12">
                     <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold mb-6">
                        <Bot className="w-3 h-3" />
                        AUTONOMOUS MULTI-AGENT SWARM
                     </div>
                    <h2 className="text-4xl font-bold font-display text-white mb-4 shadow-blue-500/20 tracking-tight">
                      Master Orchestrator
                    </h2>
                    <p className="text-slate-400 max-w-lg mx-auto">
                      Provide a symbol or financial document. The Orchestration Agent will automatically dispatch Fundamental, Quant, Peer, and CIO agents to synthesize a complete report.
                    </p>
                  </div>
                  
                  <div className={isAnalyzing ? 'opacity-50 pointer-events-none transition-opacity' : 'w-full'}>
                    <Uploader 
                      onUploadStarted={() => {
                        setError(null);
                        setIsAnalyzing(true);
                      }}
                      onAnalysisComplete={(res) => {
                        setAnalysis(res);
                        setIsAnalyzing(false);
                      }}
                      onError={(msg) => {
                        setError(msg);
                        setIsAnalyzing(false);
                      }}
                      onAgentEvent={handleAgentEvent}
                    />
                  </div>
                </div>
              </motion.section>
            ) : (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <AnalysisDashboard 
                  data={analysis} 
                  onReset={() => setAnalysis(null)} 
                  onError={(msg) => setError(msg)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <button className={`
      w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
      ${active ? 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}
    `}>
      {icon}
      {label}
    </button>
  );
}
