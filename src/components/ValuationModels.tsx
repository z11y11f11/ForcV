import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Calculator, CheckCircle2, AlertTriangle, ShieldCheck, Scale } from 'lucide-react';
import { ValuationSummary, StockData, ValuationVerdictResult } from '../types';
import { synthesizeValuationVerdict } from '../services/ai';

interface ValuationModelsProps {
  summary: ValuationSummary | null;
  stock: StockData | null;
  loading: boolean;
}

export function ValuationModels({ summary, stock, loading }: ValuationModelsProps) {
  const [growthRate, setGrowthRate] = useState<number>(5);
  const [discountRate, setDiscountRate] = useState<number>(10);
  const [terminalGrowthRate, setTerminalGrowthRate] = useState<number>(2);
  const [verdict, setVerdict] = useState<ValuationVerdictResult | null>(null);
  const [verdictLoading, setVerdictLoading] = useState(false);

  useEffect(() => {
    if (summary && !loading) {
      setVerdictLoading(true);
      synthesizeValuationVerdict(summary)
        .then(res => setVerdict(res))
        .catch(err => console.error("Verdict synthesis failed:", err))
        .finally(() => setVerdictLoading(false));
    }
  }, [summary, loading]);

  // DCF Calculation (simplified)
  const baseCashFlow = stock?.regularMarketPrice ? stock.regularMarketPrice / (summary?.trailingPE || 15) : 10;
  
  let dcfValue = 0;
  let yearCashFlows = [];

  if (baseCashFlow > 0) {
    let cf = baseCashFlow;
    for (let i = 1; i <= 5; i++) {
      cf = cf * (1 + (growthRate / 100));
      const discountedCf = cf / Math.pow(1 + (discountRate / 100), i);
      yearCashFlows.push(discountedCf);
      dcfValue += discountedCf;
    }
    
    // Terminal value
    const terminalValue = (cf * (1 + (terminalGrowthRate / 100))) / ((discountRate / 100) - (terminalGrowthRate / 100));
    const discountedTerminalValue = terminalValue / Math.pow(1 + (discountRate / 100), 5);
    
    // Handle edge cases
    if (discountRate <= terminalGrowthRate) {
       dcfValue = NaN; // Invalid
    } else {
       dcfValue += discountedTerminalValue;
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 rounded-xl p-6 text-white overflow-hidden relative">
          <DollarSign className="absolute -right-8 -bottom-8 w-40 h-40 text-white/[0.03] pointer-events-none" />
          <h3 className="text-sm font-bold text-white mb-4 relative z-10 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" /> Valuation Multiples
          </h3>
          
          <div className="grid grid-cols-2 gap-3 relative z-10">
            {loading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="bg-white/5 rounded-xl p-4 animate-pulse h-16 border border-white/5" />
              ))
            ) : summary ? (
              <>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-colors">
                  <div className="text-[10px] text-slate-400 mb-1 uppercase tracking-wider font-semibold">P/E Ratios</div>
                  <div className="text-xs font-medium text-slate-300">Trailing: <span className="text-white font-bold">{summary.trailingPE?.toFixed(1) || 'N/A'}</span></div>
                  <div className="text-xs font-medium text-slate-300 mt-0.5">Forward: <span className="text-white font-bold">{summary.forwardPE?.toFixed(1) || 'N/A'}</span></div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-colors">
                  <div className="text-[10px] text-slate-400 mb-1 uppercase tracking-wider font-semibold">P/B &amp; PEG</div>
                  <div className="text-xs font-medium text-slate-300">P/B: <span className="text-white font-bold">{summary.priceToBook?.toFixed(2) || 'N/A'}</span></div>
                  <div className="text-xs font-medium text-slate-300 mt-0.5">PEG: <span className="text-white font-bold">{summary.pegRatio?.toFixed(2) || 'N/A'}</span></div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-colors">
                  <div className="text-[10px] text-slate-400 mb-1 uppercase tracking-wider font-semibold">EV/EBITDA</div>
                  <div className="text-xl font-bold mt-1">{summary.enterpriseToEbitda?.toFixed(2) || 'N/A'}</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-colors">
                  <div className="text-[10px] text-slate-400 mb-1 uppercase tracking-wider font-semibold">ROE &amp; Growth</div>
                  <div className="text-xs font-medium text-slate-300">ROE: <span className="text-white font-bold">{summary.returnOnEquity ? (summary.returnOnEquity * 100).toFixed(1) + '%' : 'N/A'}</span></div>
                  <div className="text-xs font-medium text-slate-300 mt-0.5">Rev Gr: <span className="text-white font-bold">{summary.revenueGrowth ? (summary.revenueGrowth * 100).toFixed(1) + '%' : 'N/A'}</span></div>
                </div>
                <div className="col-span-2 bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-colors">
                  <div className="text-[10px] text-slate-400 mb-1 uppercase tracking-wider font-semibold">Dividend Model</div>
                  <div className="flex justify-between items-center mt-1">
                    <div>
                      <span className="text-xs text-slate-400">Yield: </span>
                      <span className="text-blue-400 font-bold">{(summary.dividendYield ? (summary.dividendYield * 100).toFixed(2) : '0.00')}%</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400">Payout: </span>
                      <span className="text-slate-200">{(summary.payoutRatio ? (summary.payoutRatio * 100).toFixed(2) : '0.00')}%</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400">EBITDA Margin: </span>
                      <span className="text-slate-200">{summary.ebitdaMargins ? (summary.ebitdaMargins * 100).toFixed(1) + '%' : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="col-span-2 py-4 text-center text-slate-500 text-xs italic">Valuation data unavailable.</div>
            )}
          </div>
        </div>

        <div className="bg-[#080a0f]/80 border border-slate-800/80 rounded-xl p-6 shadow-lg backdrop-blur-sm">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-indigo-400" /> DCF Calculator (Quant Agent)
          </h3>

          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-6 bg-slate-200 rounded w-1/2"></div>
              <div className="h-4 bg-slate-200 rounded w-3/4"></div>
              <div className="h-4 bg-slate-200 rounded w-full"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">Growth Rate (%)</label>
                  <input
                    type="number"
                    value={growthRate}
                    onChange={(e) => setGrowthRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-[#0a0d14] border border-slate-700 rounded-lg text-sm text-white focus:ring-1 focus:border-indigo-500 focus:ring-indigo-500 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">Discount Rate (%)</label>
                  <input
                    type="number"
                    value={discountRate}
                    onChange={(e) => setDiscountRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-[#0a0d14] border border-slate-700 rounded-lg text-sm text-white focus:ring-1 focus:border-indigo-500 focus:ring-indigo-500 transition-all outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">Terminal Growth Rate (%)</label>
                  <input
                    type="number"
                    value={terminalGrowthRate}
                    onChange={(e) => setTerminalGrowthRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-[#0a0d14] border border-slate-700 rounded-lg text-sm text-white focus:ring-1 focus:border-indigo-500 focus:ring-indigo-500 transition-all outline-none"
                  />
                </div>
              </div>
              
              <div className="pt-4 border-t border-slate-800/80">
                 <div className="flex justify-between items-end">
                   <span className="text-sm font-bold text-slate-400">Estimated Value</span>
                   <span className="text-2xl font-bold text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]">
                     {isNaN(dcfValue) ? "N/A" : `$${dcfValue.toFixed(2)}`}
                   </span>
                 </div>
                 <div className="flex justify-between items-end mt-1">
                   <span className="text-xs text-slate-500">Current Price</span>
                   <span className="text-sm font-bold text-slate-300 font-mono">
                     {stock?.regularMarketPrice ? `$${stock.regularMarketPrice.toFixed(2)}` : "N/A"}
                   </span>
                 </div>
              </div>
              <p className="text-[10px] text-slate-400 italic mt-2">
                Based on user assumptions, for reference only.
              </p>
            </div>
          )}
        </div>

        <div className="bg-[#080a0f]/80 border border-slate-800/80 rounded-xl p-6 shadow-lg backdrop-blur-sm">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-400" /> Wall Street Consensus
          </h3>

          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-12 bg-slate-200 rounded-xl" />
              <div className="h-16 bg-slate-200 rounded-xl" />
            </div>
          ) : summary ? (
            <div className="space-y-5">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-xs text-slate-500 mb-1 font-bold italic capitalize tracking-wide">{summary.recommendationKey?.replace(/_/g, ' ') || 'No Rating'}</div>
                  <div className="text-xl font-black text-white flex items-center gap-2 drop-shadow-md">
                    {summary.recommendationKey && (
                      <div className={`w-3 h-3 rounded-full ${
                        summary.recommendationKey.includes('buy') ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 
                        summary.recommendationKey.includes('sell') ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
                      }`} />
                    )}
                    {summary.recommendationKey?.toUpperCase().replace(/_/g, ' ') || 'N/A'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 mb-1 font-bold uppercase tracking-wider">Mean Target</div>
                  <div className="text-xl font-bold text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)] font-mono">${summary.targetMeanPrice?.toFixed(2) || 'N/A'}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col justify-center px-4 py-2 bg-[#0a0d14] border border-slate-800 rounded-xl shadow-inner">
                  <div className="text-[10px] text-slate-500 uppercase font-bold text-center mb-1 tracking-wider">Target Range</div>
                  <div className="text-xs font-bold text-slate-300 text-center font-mono">${summary.targetLowPrice?.toFixed(0)} - ${summary.targetHighPrice?.toFixed(0)}</div>
                </div>
                <div className="flex flex-col justify-center px-4 py-2 bg-[#0a0d14] border border-slate-800 rounded-xl text-center shadow-inner">
                  <div className="text-[10px] text-slate-500 uppercase font-bold mb-1 tracking-wider">Opinions</div>
                  <div className="text-xs font-bold text-slate-300">{summary.numberOfAnalystOpinions || 0} Analysts</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-slate-500 text-xs italic">Analyst data unavailable.</div>
          )}
        </div>
      </div>
      
      {/* Valuation Verdict Box */}
      {verdictLoading ? (
        <div className="w-full bg-[#080a0f]/50 p-6 rounded-xl animate-pulse border border-slate-800/50">
          <div className="h-6 bg-slate-800 rounded w-1/4 mb-3"></div>
          <div className="h-4 bg-slate-800 rounded w-full"></div>
          <div className="mt-2 text-xs text-blue-500 font-bold tracking-widest uppercase">CIO Agent synthesizing verdict...</div>
        </div>
      ) : verdict && (
        <div className={`w-full p-6 rounded-xl border flex flex-col md:flex-row md:items-center gap-6 shadow-xl backdrop-blur-sm ${
          verdict.overallVerdict === 'Undervalued' ? 'bg-emerald-950/20 border-emerald-500/30' :
          verdict.overallVerdict === 'Overvalued' ? 'bg-rose-950/20 border-rose-500/30' :
          'bg-indigo-950/20 border-indigo-500/30'
        }`}>
          <div className={`shrink-0 flex items-center justify-center p-4 rounded-full shadow-lg ${
            verdict.overallVerdict === 'Undervalued' ? 'bg-emerald-900/50 shadow-emerald-900/20' :
            verdict.overallVerdict === 'Overvalued' ? 'bg-rose-900/50 shadow-rose-900/20' :
            'bg-indigo-900/50 shadow-indigo-900/20'
          }`}>
            {verdict.overallVerdict === 'Undervalued' ? <ShieldCheck className="w-8 h-8 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" /> :
             verdict.overallVerdict === 'Overvalued' ? <AlertTriangle className="w-8 h-8 text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.8)]" /> :
             <Scale className="w-8 h-8 text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.8)]" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-white">CIO Agent Verdict</h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${
                verdict.confidenceLevel === 'High' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 ring-1 ring-blue-500/20' :
                verdict.confidenceLevel === 'Medium' ? 'bg-slate-800/80 text-slate-300 border-slate-700' :
                'bg-slate-900 text-slate-500 border-slate-800'
              }`}>
                {verdict.confidenceLevel} Confidence
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 mb-2">
              <span className={`text-xl font-black ${
                verdict.overallVerdict === 'Undervalued' ? 'text-emerald-400 drop-shadow-md' :
                verdict.overallVerdict === 'Overvalued' ? 'text-rose-400 drop-shadow-md' :
                'text-indigo-400 drop-shadow-md'
              }`}>
                {verdict.overallVerdict}
              </span>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed italic">
              "{verdict.keyReason}"
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
