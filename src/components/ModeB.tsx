import React, { useState, useRef, useCallback } from 'react';
import { Upload, CheckCircle2, X, Bot, Zap, FileSearch } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { runParallelAnalysis, AgentEvent } from '../services/ai';
import AnalysisDashboard from './AnalysisDashboard';
import { AnalysisResult } from '../types';

function mergePartial(acc: Partial<AnalysisResult>, incoming: Partial<AnalysisResult>): Partial<AnalysisResult> {
  const merged = { ...acc, ...incoming };
  if (acc.metrics && incoming.metrics) {
    const seen = new Set(acc.metrics.map(m => m.label));
    merged.metrics = [...acc.metrics, ...incoming.metrics.filter(m => !seen.has(m.label))];
  }
  if (acc.highlights && incoming.highlights) {
    const seen = new Set(acc.highlights.map(h => h.trim()));
    merged.highlights = [...acc.highlights, ...incoming.highlights.filter(h => !seen.has(h.trim()))];
  }
  if (acc.risks && incoming.risks) {
    const seen = new Set(acc.risks.map(r => r.trim()));
    merged.risks = [...acc.risks, ...incoming.risks.filter(r => !seen.has(r.trim()))];
  }
  return merged;
}

export default function ModeB() {
  const [file, setFile] = useState<File | null>(null);
  const [partialData, setPartialData] = useState<Partial<AnalysisResult>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentEvent | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showDashboard = !!partialData.company;

  const handleFile = (f: File) => {
    if (f.type !== 'application/pdf') { setError('Please upload a PDF file.'); return; }
    if (f.size > 20 * 1024 * 1024) { setError('File too large (max 20 MB).'); return; }
    setFile(f);
    setError(null);
  };

  const handleEvent = useCallback((evt: AgentEvent) => {
    setAgentStatus(evt);
    if (evt.partial) {
      setPartialData(prev => mergePartial(prev, evt.partial!));
    }
  }, []);

  const handleRun = async () => {
    if (!file) { setError('Please upload a PDF report.'); return; }
    setError(null);
    setIsAnalyzing(true);
    setPartialData({});

    try {
      const final = await runParallelAnalysis(
        file, ['highlights', 'risks', 'esg', 'competitors'], handleEvent
      );
      setPartialData(prev => mergePartial(prev, final));
    } catch (err: any) {
      setError(err.message || 'Analysis failed.');
    } finally {
      setIsAnalyzing(false);
      setAgentStatus(null);
    }
  };

  if (showDashboard) {
    return (
      <div className="flex-1 overflow-y-auto p-8">
        <AnalysisDashboard
          data={partialData}
          isLoading={isAnalyzing}
          onReset={() => { setPartialData({}); setFile(null); setError(null); }}
          onError={(msg) => setError(msg)}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-4 uppercase tracking-widest">
            <Zap className="w-3 h-3" /> Mode B — Report Analysis
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Upload Financial Report</h2>
          <p className="text-slate-400 text-sm leading-relaxed max-w-lg mx-auto">
            Upload any annual report, earnings release, or research PDF.
            FundamentalAgent reads the document and <span className="text-emerald-400 font-semibold">automatically extracts the ticker</span>.
            QuantAgent then fetches live market data. CIOAgent cross-analyses both.
            <br />
            <span className="text-emerald-400/70">No ticker entry needed — the report is the single source of truth.</span>
          </p>
        </div>

        <div className="space-y-4">
          {/* PDF upload */}
          <div className="bg-[#080a0f]/80 border border-slate-800 rounded-xl p-5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3">
              Financial Report PDF
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            {file ? (
              <div className="flex items-center gap-3 p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{file.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB · ticker will be extracted automatically</div>
                </div>
                <button
                  onClick={() => setFile(null)}
                  disabled={isAnalyzing}
                  className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => {
                  e.preventDefault();
                  setIsDragging(false);
                  const f = e.dataTransfer.files[0];
                  if (f) handleFile(f);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center gap-4 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                  isDragging
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/20'
                }`}
              >
                <FileSearch className="w-8 h-8 text-slate-500 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-slate-300">Drop PDF here or click to browse</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Annual reports, earnings releases, research (max 20 MB)
                    <br />
                    <span className="text-emerald-500/70">Ticker is extracted automatically from the document</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleRun}
            disabled={!file || isAnalyzing}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all text-sm tracking-wide"
          >
            {isAnalyzing ? 'Analysing Report…' : 'Analyse Report'}
          </button>

          {error && <p className="text-rose-400 text-sm">{error}</p>}
        </div>

        {/* Agent status */}
        <AnimatePresence>
          {isAnalyzing && agentStatus && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-6 flex items-center gap-4 bg-slate-900/80 border border-emerald-500/20 rounded-xl px-5 py-4"
            >
              <Bot className="w-5 h-5 text-emerald-400 shrink-0 animate-pulse" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">{agentStatus.agent}</div>
                <div className="text-sm text-slate-200 mt-0.5 truncate">{agentStatus.status}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pipeline legend */}
        {!isAnalyzing && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-700"
          >
            {['FundamentalAgent', '→ ticker', '→', 'QuantAgent', '∥', 'PeerAgent', '→', 'CIOAgent'].map((item, i) => (
              <span key={i} className={['→ ticker', '→', '∥'].includes(item)
                ? 'text-slate-600 font-bold'
                : 'px-2.5 py-1 bg-slate-900/80 border border-slate-800 rounded-lg text-slate-500'}>
                {item}
              </span>
            ))}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
