import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingUp, TrendingDown, Minus,
  AlertTriangle, CheckCircle2, FileText,
  BarChart3, RefreshCcw, DollarSign,
  ChevronDown, Maximize2, Minimize2, Activity,
  PieChart, Sprout, Target, Download, Loader2
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { AnalysisResult, StockData, HistoricalBar, ValuationSummary, CrossAnalysisResult } from '../types';
import { ValuationModels } from './ValuationModels';
import { PeerComparison } from './PeerComparison';
import { crossAnalyze, synthesizeValuationVerdict } from '../services/ai';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

interface DashboardProps {
  data: Partial<AnalysisResult>;
  isLoading?: boolean;
  onReset: () => void;
  onError?: (msg: string) => void;
}

// ── Skeleton helpers ──────────────────────────────────────────────────────────
function SkeletonLine({ w = 'full' }: { w?: string }) {
  return <div className={`h-3.5 bg-slate-800 rounded animate-pulse w-${w}`} />;
}
function SkeletonCard() {
  return (
    <div className="h-24 bg-slate-800/60 rounded-xl animate-pulse" />
  );
}
function SkeletonSection({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-2">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonLine key={i} w={i % 3 === 2 ? '3/4' : 'full'} />
      ))}
    </div>
  );
}

export default function AnalysisDashboard({ data, isLoading = false, onReset, onError }: DashboardProps) {
  // ── Safe defaults ─────────────────────────────────────────────────────────
  const company   = data.company   ?? { name: '—', ticker: '', sector: '' };
  const metrics   = data.metrics   ?? [];
  const highlights = data.highlights ?? [];
  const risks     = data.risks     ?? [];
  const sentiment = data.sentiment ?? 'Neutral';
  const summary   = data.summary   ?? '';
  const competitors = data.competitors ?? [];

  const [stock, setStock] = useState<StockData | null>(null);
  const [history, setHistory] = useState<HistoricalBar[]>([]);
  const [valSummary, setValSummary] = useState<ValuationSummary | null>(null);
  const [crossAnalysis, setCrossAnalysis] = useState<CrossAnalysisResult | null>(null);
  const [loadingCrossAnalysis, setLoadingCrossAnalysis] = useState(false);
  const [resolvedTicker, setResolvedTicker] = useState<string>('');
  const [loadingStock, setLoadingStock] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const [sections, setSections] = useState({
    metrics: true,
    history: true,
    valuation: true,
    summary: true,
    insights: true,
    esg: true,
    competitors: false
  });

  const dashboardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const exportPDF = async (exportAll = false) => {
    if (!dashboardRef.current) return;
    setIsExporting(true);

    let originalState = { ...sections };
    if (exportAll) {
      setAllSections(true);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    try {
      const pdf = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const addDarkBackground = () => {
        pdf.setFillColor(5, 8, 16);
        pdf.rect(0, 0, pdfWidth, pageHeight, 'F');
      };
      addDarkBackground();

      let currentY = 10;
      let firstPage = true;

      const elements = Array.from(dashboardRef.current.querySelectorAll('.pdf-section'));

      for (const el of elements) {
        const imgData = await toPng(el as HTMLElement, {
          pixelRatio: 2,
          backgroundColor: '#050810',
          skipFonts: true,
        });

        const imgProps = pdf.getImageProperties(imgData);
        const height = (imgProps.height * (pdfWidth - 20)) / imgProps.width;

        if (currentY + height > pageHeight && !firstPage) {
          pdf.addPage();
          addDarkBackground();
          currentY = 10;
        }

        if (height > pageHeight) {
          let yOffset = 0;
          let firstSlice = true;
          while (yOffset < height) {
            if (!firstSlice) {
              pdf.addPage();
              addDarkBackground();
              currentY = 10;
            }
            pdf.addImage(imgData, 'PNG', 10, currentY - yOffset, pdfWidth - 20, height);
            yOffset += (pageHeight - currentY - 10);
            currentY = 10;
            firstSlice = false;
          }
        } else {
          pdf.addImage(imgData, 'PNG', 10, currentY, pdfWidth - 20, height);
          currentY += height + 10;
        }
        firstPage = false;
      }

      pdf.save(`${company.ticker || 'Analysis'}_Report.pdf`);
    } catch (err) {
      console.error("PDF Export failed", err);
      onError?.("Failed to generate PDF report.");
    } finally {
      if (exportAll) setSections(originalState);
      setIsExporting(false);
    }
  };

  const toggleSection = (key: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (isOpen: boolean) => {
    setSections({ metrics: isOpen, history: isOpen, valuation: isOpen, summary: isOpen, insights: isOpen, esg: isOpen, competitors: isOpen });
  };

  const allExpanded = Object.values(sections).every(Boolean);

  useEffect(() => {
    const resolveAndFetch = async () => {
      if (!company.ticker) return;

      // Pre-clean: strip display noise like "1810 (HKD) / 81810 (CNY)" → "1810"
      // The Yahoo search API will then resolve to the proper symbol (e.g. "1810.HK")
      const rawTicker = company.ticker.trim();
      let finalTicker = rawTicker.split(/[\s\/\(（]/)[0].trim() || rawTicker;

      try {
        const searchRes = await fetch(`/api/search/${encodeURIComponent(finalTicker)}`);
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.quotes && searchData.quotes.length > 0) {
            finalTicker = searchData.quotes[0].symbol;
          }
        }
      } catch (e) {
        console.warn("Search resolution fallback", e);
      }

      setResolvedTicker(finalTicker);
      await Promise.allSettled([
        fetchStock(finalTicker),
        fetchHistory(finalTicker),
        fetchSummary(finalTicker)
      ]);
    };

    resolveAndFetch();
  }, [company.ticker]);

  useEffect(() => {
    if (valSummary && stock && !loadingStock && !loadingSummary && !crossAnalysis && !loadingCrossAnalysis && data.company) {
      setLoadingCrossAnalysis(true);
      crossAnalyze(data as AnalysisResult, {
        price: stock.regularMarketPrice,
        summary: valSummary
      }).then(res => setCrossAnalysis(res))
        .catch(err => console.error("Cross analysis failed", err))
        .finally(() => setLoadingCrossAnalysis(false));
    }
  }, [valSummary, stock, loadingStock, loadingSummary, data, crossAnalysis, loadingCrossAnalysis]);

  const fetchSummary = async (ticker: string) => {
    setLoadingSummary(true);
    try {
      const response = await fetch(`/api/stock/${ticker}/summary`);
      if (response.ok) {
        const raw = await response.json();
        const stats = raw.defaultKeyStatistics || {};
        const financial = raw.financialData || {};
        const detail = raw.summaryDetail || {};
        setValSummary({
          trailingPE: detail.trailingPE || stats.trailingPE,
          forwardPE: detail.forwardPE || stats.forwardPE,
          priceToBook: stats.priceToBook,
          pegRatio: stats.pegRatio,
          enterpriseToEbitda: stats.enterpriseToEbitda,
          dividendYield: detail.dividendYield,
          payoutRatio: stats.payoutRatio,
          ebitdaMargins: financial.ebitdaMargins,
          returnOnEquity: financial.returnOnEquity,
          revenueGrowth: financial.revenueGrowth,
          recommendationKey: financial.recommendationKey,
          targetMeanPrice: financial.targetMeanPrice,
          targetHighPrice: financial.targetHighPrice,
          targetLowPrice: financial.targetLowPrice,
          numberOfAnalystOpinions: financial.numberOfAnalystOpinions,
          recommendationTrend: raw.recommendationTrend?.trend || [],
        });
      }
    } catch (err) {
      console.error('Failed to fetch summary', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchHistory = async (ticker: string) => {
    setLoadingHistory(true);
    try {
      const response = await fetch(`/api/stock/${ticker}/history`);
      if (response.ok) {
        const rawData: any[] = await response.json();
        const sorted = rawData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const calculateMA = (data: any[], index: number, period: number) => {
          if (index < period - 1) return undefined;
          let sum = 0, count = 0;
          for (let i = 0; i < period; i++) {
            const closeVal = data[index - i]?.close;
            if (closeVal != null) { sum += closeVal; count++; }
          }
          return count === period ? parseFloat((sum / period).toFixed(2)) : undefined;
        };

        const processed = sorted.map((d, i, arr) => ({
          date: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          fullDate: new Date(d.date).toLocaleDateString(),
          close: d.close != null ? parseFloat(d.close.toFixed(2)) : null,
          ma20: calculateMA(arr, i, 20),
          ma50: calculateMA(arr, i, 50),
          ma200: calculateMA(arr, i, 200),
        })).filter(d => d.close !== null);

        setHistory(processed.slice(-250) as any);
      }
    } catch (err) {
      console.error('Failed to fetch history', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchStock = async (ticker: string) => {
    setLoadingStock(true);
    try {
      const response = await fetch(`/api/stock/${ticker}`);
      if (response.ok) {
        const quote = await response.json();
        setStock(quote);
      }
    } catch (err) {
      console.error('Failed to fetch stock', err);
    } finally {
      setLoadingStock(false);
    }
  };

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const item = { hidden: { y: 20, opacity: 0 }, show: { y: 0, opacity: 1 } };

  const getSentimentColor = (s: string) => {
    switch (s.toLowerCase()) {
      case 'positive': return 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30';
      case 'negative': return 'bg-rose-950/40 text-rose-400 border-rose-500/30';
      default:         return 'bg-slate-800/40 text-slate-400 border-slate-700';
    }
  };

  return (
    <motion.div ref={dashboardRef} variants={container} initial="hidden" animate="show" className="space-y-6 max-w-6xl mx-auto pb-20">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="pdf-section flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#080a0f]/80 backdrop-blur-md p-6 rounded-2xl shadow-[0_0_30px_rgba(37,99,235,0.05)] border border-slate-800/80">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center text-blue-400 font-bold text-xl shadow-[0_0_15px_rgba(37,99,235,0.2)]">
            {company.name.charAt(0) || '?'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white leading-tight font-display tracking-tight">
                {company.name}
              </h1>
              {data.isHistorical && (
                <span className="bg-amber-950/40 border border-amber-500/30 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded ml-2 uppercase tracking-widest">
                  Historical Report
                </span>
              )}
              {isLoading && (
                <span className="flex items-center gap-1.5 bg-blue-950/40 border border-blue-500/30 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded ml-2 uppercase tracking-widest">
                  <Loader2 className="w-3 h-3 animate-spin" /> Agents running…
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 text-slate-400 rounded text-xs font-mono font-bold tracking-wider">
                {resolvedTicker || company.ticker}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${getSentimentColor(sentiment)}`}>
                {sentiment} Sentiment
              </span>
              {data.reportDate && (
                <span className="text-[10px] text-slate-500 font-bold tracking-wider uppercase ml-1">
                  Date: {data.reportDate}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {stock && (
            <div className="flex flex-col items-end px-4 py-2 bg-[#0a0d14] rounded-xl border border-slate-800 shadow-inner">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Market Price</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-white font-mono">
                  {stock.currency === 'USD' ? '$' : ''}{stock.regularMarketPrice?.toFixed(2)}
                </span>
                <span className={`text-sm font-bold flex items-center ${(stock.regularMarketChangePercent || 0) >= 0 ? 'text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]' : 'text-rose-400 drop-shadow-[0_0_5px_rgba(251,113,133,0.5)]'}`}>
                  {(stock.regularMarketChangePercent || 0) >= 0
                    ? <TrendingUp className="w-4 h-4 mr-1" />
                    : <TrendingDown className="w-4 h-4 mr-1" />}
                  {Math.abs(stock.regularMarketChangePercent || 0).toFixed(2)}%
                </span>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1 items-center justify-center pr-1">
            <button onClick={() => exportPDF(false)} disabled={isExporting || isLoading} className="px-4 py-2 flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] font-bold text-sm tracking-wide">
              {isExporting ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export PDF
            </button>
            <button onClick={() => exportPDF(true)} disabled={isExporting || isLoading} className="text-[10px] uppercase font-bold tracking-widest text-slate-500 hover:text-blue-400 transition-colors whitespace-nowrap disabled:opacity-40">
              Export All Sections
            </button>
          </div>
          <button onClick={onReset} className="p-2.5 text-slate-400 hover:text-white border border-slate-800 hover:bg-slate-800 bg-[#0a0d14] rounded-xl transition-colors shrink-0">
            <RefreshCcw className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── 30-Second Summary Card ────────────────────────────────────────── */}
      <div className="pdf-section bg-gradient-to-r from-slate-900 to-indigo-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Activity className="w-32 h-32" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            <div className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-1">CIO Agent Summary</div>
            <h2 className="text-xl font-bold mb-2">{company.name} ({resolvedTicker || company.ticker})</h2>
            {summary ? (
              <p className="text-indigo-100 text-sm leading-relaxed max-w-2xl">
                {summary.split('.')[0]}.
              </p>
            ) : (
              <div className="space-y-2 max-w-2xl">
                <SkeletonLine />
                <SkeletonLine w="3/4" />
              </div>
            )}
          </div>
          <div className="flex gap-4 shrink-0">
            {/* Financial Health heuristic */}
            {(() => {
              const growthMetric = metrics.find(m => m.label.toLowerCase().includes('growth') || m.label.toLowerCase().includes('revenue'));
              const isGrowthUp = growthMetric?.trend === 'up';
              const isSentimentPos = sentiment === 'Positive';
              let health = 'Yellow';
              if (isSentimentPos && isGrowthUp) health = 'Green';
              if (sentiment === 'Negative' || growthMetric?.trend === 'down') health = 'Red';
              return (
                <div className="bg-white/10 backdrop-blur border border-white/20 rounded-xl p-4 flex flex-col items-center justify-center min-w-[120px]">
                  <div className="text-[10px] text-white/70 uppercase tracking-wider font-bold mb-2">Financial Health</div>
                  {isLoading && !metrics.length ? (
                    <div className="w-8 h-4 bg-white/20 rounded animate-pulse" />
                  ) : (
                    <div className={`flex items-center gap-2 font-bold ${health === 'Green' ? 'text-emerald-400' : health === 'Red' ? 'text-rose-400' : 'text-amber-400'}`}>
                      <div className={`w-3 h-3 rounded-full ${health === 'Green' ? 'bg-emerald-400' : health === 'Red' ? 'bg-rose-400' : 'bg-amber-400'}`} />
                      {health}
                    </div>
                  )}
                </div>
              );
            })()}
            {/* Valuation vs analyst price target */}
            {(() => {
              // This card compares current price to analyst consensus target price.
              // It is NOT the same as multiple-based valuation (EV/EBITDA, PEG) shown by CIOAgent.
              let valMsg = "Fair";
              let valSub = "vs target";
              let valColor = "text-amber-400";
              if (valSummary?.targetMeanPrice && stock?.regularMarketPrice) {
                const diff = (valSummary.targetMeanPrice - stock.regularMarketPrice) / stock.regularMarketPrice;
                if (diff > 0.15)  { valMsg = "Below Target"; valColor = "text-emerald-400"; }
                else if (diff < -0.15) { valMsg = "Above Target"; valColor = "text-rose-400"; }
                else { valMsg = "Near Target"; }
              } else if (valSummary?.trailingPE) {
                valSub = "by P/E";
                if (valSummary.trailingPE < 15)  { valMsg = "Cheap P/E"; valColor = "text-emerald-400"; }
                else if (valSummary.trailingPE > 30) { valMsg = "Rich P/E"; valColor = "text-rose-400"; }
              }
              return (
                <div className="bg-white/10 backdrop-blur border border-white/20 rounded-xl p-4 flex flex-col items-center justify-center min-w-[130px]">
                  <div className="text-[10px] text-white/70 uppercase tracking-wider font-bold mb-1">Price vs Analysts</div>
                  {loadingSummary ? (
                    <div className="w-16 h-4 bg-white/20 rounded animate-pulse" />
                  ) : (
                    <>
                      <div className={`font-bold text-sm ${valColor}`}>
                        {valSummary ? valMsg : '—'}
                      </div>
                      {valSummary?.targetMeanPrice && stock?.regularMarketPrice && (
                        <div className="text-[10px] text-white/50 mt-1">
                          Target ${valSummary.targetMeanPrice.toFixed(2)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
        {crossAnalysis && (
          <div className="relative z-10 mt-4 pt-4 border-t border-white/10 flex items-start gap-3">
            <Target className="w-5 h-5 text-indigo-300 shrink-0 mt-0.5" />
            <p className="text-sm text-indigo-50 leading-relaxed font-medium">
              <span className="text-white font-bold opacity-80 mr-2">Investment Verdict:</span>
              {crossAnalysis.investmentVerdict}
            </p>
          </div>
        )}
      </div>

      {/* ── Key Performance Indicators ───────────────────────────────────── */}
      <div className="pdf-section">
        <CollapsibleSection title="Key Performance Indicators" icon={<Activity className="w-5 h-5 text-blue-500" />} isOpen={sections.metrics} onToggle={() => toggleSection('metrics')}>
          {isLoading && !metrics.length ? (
            <div className="space-y-4">
              <div className="h-4 w-40 bg-slate-800 rounded animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            </div>
          ) : metrics.length > 0 ? (
            <MetricsGrouped metrics={metrics} />
          ) : (
            <p className="text-slate-500 text-sm italic">No metrics available.</p>
          )}
        </CollapsibleSection>
      </div>

      {/* ── Valuation Models ─────────────────────────────────────────────── */}
      <div className="pdf-section">
        <CollapsibleSection title="Valuation Models & Market Analytics" icon={<TrendingUp className="w-5 h-5 text-emerald-500" />} isOpen={sections.valuation} onToggle={() => toggleSection('valuation')}>
          <ValuationModels summary={valSummary} stock={stock} loading={loadingSummary} />
        </CollapsibleSection>
      </div>

      {/* ── Executive Summary ─────────────────────────────────────────────── */}
      <div className="pdf-section">
        <CollapsibleSection title="Executive Summary & Context" icon={<FileText className="w-5 h-5 text-purple-500" />} isOpen={sections.summary} onToggle={() => toggleSection('summary')}>
          {isLoading && !summary ? (
            <SkeletonSection rows={5} />
          ) : summary ? (
            <div className="p-6 bg-[#0a0d14]/80 border border-slate-800/80 rounded-xl text-slate-300 leading-relaxed shadow-inner">
              {summary}
            </div>
          ) : (
            <p className="text-slate-500 text-sm italic">Summary not yet available.</p>
          )}
        </CollapsibleSection>
      </div>

      {/* ── Strategic Insights & Risks ────────────────────────────────────── */}
      {(isLoading || highlights.length > 0 || risks.length > 0) && (
        <div className="pdf-section">
          <CollapsibleSection title="Strategic Insights & Risks (Fundamental Agent)" icon={<AlertTriangle className="w-5 h-5 text-amber-500" />} isOpen={sections.insights} onToggle={() => toggleSection('insights')}>
            {isLoading && !highlights.length && !risks.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-emerald-950/10 rounded-xl border border-emerald-900/30">
                  <div className="h-4 w-40 bg-emerald-900/40 rounded mb-4 animate-pulse" />
                  <SkeletonSection rows={4} />
                </div>
                <div className="p-6 bg-rose-950/10 rounded-xl border border-rose-900/30">
                  <div className="h-4 w-32 bg-rose-900/40 rounded mb-4 animate-pulse" />
                  <SkeletonSection rows={4} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {highlights.length > 0 && (
                  <div className="p-6 bg-emerald-950/20 rounded-xl border border-emerald-900/50 shadow-lg">
                    <h3 className="text-sm font-bold text-emerald-400 mb-4 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Investment Highlights
                    </h3>
                    <ul className="space-y-3">
                      {highlights.map((h, i) => (
                        <li key={i} className="text-sm leading-relaxed text-slate-300">
                          <span className="mr-2 font-black text-emerald-500 tracking-wider font-mono">{i + 1}.</span>{h}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {risks.length > 0 && (
                  <div className="p-6 bg-rose-950/20 rounded-xl border border-rose-900/50 shadow-lg">
                    <h3 className="text-sm font-bold text-rose-400 mb-4 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-500" /> Key Risks
                    </h3>
                    <ul className="space-y-3">
                      {risks.map((r, i) => (
                        <li key={i} className="text-sm leading-relaxed text-slate-300">
                          <span className="mr-2 font-black text-rose-500 tracking-wider font-mono">{i + 1}.</span>{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CollapsibleSection>
        </div>
      )}

      {/* ── ESG Summary ──────────────────────────────────────────────────── */}
      {(isLoading || data.esgSummary) && (
        <div className="pdf-section">
          <CollapsibleSection title="ESG Profile (Fundamental Agent)" icon={<Sprout className="w-5 h-5 text-emerald-500" />} isOpen={sections.esg} onToggle={() => toggleSection('esg')}>
            {isLoading && !data.esgSummary ? (
              <SkeletonSection rows={6} />
            ) : data.esgSummary ? (
              <div className="p-6 bg-emerald-950/10 border border-emerald-900/30 rounded-xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                  {['Environmental', 'Social', 'Governance'].map(pillar => (
                    <div key={pillar} className="flex items-center gap-2 px-3 py-2 bg-emerald-950/30 border border-emerald-800/40 rounded-lg">
                      <Sprout className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">{pillar}</span>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{data.esgSummary}</p>
              </div>
            ) : null}
          </CollapsibleSection>
        </div>
      )}

      {/* ── Peer Comparison ───────────────────────────────────────────────── */}
      {(isLoading || competitors.length > 0) && (
        <div className="pdf-section">
          <CollapsibleSection title="Peer Comparison (Peer Agent)" icon={<Target className="w-5 h-5 text-indigo-500" />} isOpen={sections.competitors} onToggle={() => toggleSection('competitors')}>
            {isLoading && !competitors.length ? (
              <SkeletonSection rows={6} />
            ) : competitors.length > 0 ? (
              <PeerComparison competitors={competitors} currentTicker={resolvedTicker || company.ticker} />
            ) : null}
          </CollapsibleSection>
        </div>
      )}

      {/* ── Cross Analysis & Signals ──────────────────────────────────────── */}
      {crossAnalysis && (
        <div className="pdf-section">
          <CollapsibleSection title="Cross Analysis & Signals (CIO Agent)" icon={<Target className="w-5 h-5 text-fuchsia-500" />} isOpen={true} onToggle={() => {}}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-[#080a0f]/80 border border-blue-900/40 rounded-xl flex flex-col justify-center items-center shadow-[0_0_20px_rgba(37,99,235,0.1)]">
                <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Fund/Quant Alignment</div>
                <div className="text-5xl font-black text-white drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">
                  {crossAnalysis.alignmentScore ?? 'N/A'}
                </div>
              </div>
              <div className="md:col-span-2">
                <h4 className="font-bold text-sm text-slate-300 mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-fuchsia-400" /> Divergence Signals
                </h4>
                <ul className="space-y-2">
                  {crossAnalysis.divergenceSignals.map((sig, i) => (
                    <li key={i} className="p-3 text-sm rounded-lg border bg-[#0a0d14]/80 border-slate-800 text-slate-300 shadow-inner flex gap-3 items-start">
                      <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-500 mt-2 shrink-0 animate-pulse" />
                      <span className="leading-relaxed">{sig}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CollapsibleSection>
        </div>
      )}

    </motion.div>
  );
}

// ── Metric categorisation helpers ────────────────────────────────────────────

const VALUATION_KEYS = ['p/e', 'pe ratio', 'forward p/e', 'price-to-book', 'p/b', 'peg', 'ev/ebitda', 'price to book'];
const PROFITABILITY_KEYS = ['margin', 'roe', 'return on equity', 'revenue growth', 'earnings growth', 'debt-to-equity', 'debt to equity', 'free cash flow', 'fcf', 'dividend'];
// everything else (revenue, net income, market cap, eps, …) falls into "market overview"

function metricSubGroup(label: string): 'valuation' | 'profitability' | 'overview' {
  const l = label.toLowerCase();
  if (VALUATION_KEYS.some(k => l.includes(k))) return 'valuation';
  if (PROFITABILITY_KEYS.some(k => l.includes(k))) return 'profitability';
  return 'overview';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
  if (trend === 'down') return <TrendingDown className="w-3.5 h-3.5 text-rose-400" />;
  return <Minus className="w-3.5 h-3.5 text-slate-500" />;
}

function MetricRow({ metric }: { metric: any }) {
  const trendBg = metric.trend === 'up' ? 'text-emerald-400' : metric.trend === 'down' ? 'text-rose-400' : 'text-slate-500';
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-800/60 last:border-0 group">
      <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">{metric.label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-bold font-mono ${trendBg}`}>{metric.value}</span>
        <TrendIcon trend={metric.trend} />
      </div>
    </div>
  );
}

function MetricPanel({ title, accent, metrics }: { title: string; accent: string; metrics: any[] }) {
  if (!metrics.length) return null;
  return (
    <div className={`rounded-xl border ${accent} bg-[#0a0d14]/60 p-4`}>
      <div className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${accent.includes('emerald') ? 'text-emerald-400' : accent.includes('blue') ? 'text-blue-400' : accent.includes('amber') ? 'text-amber-400' : 'text-indigo-400'}`}>
        {title}
      </div>
      {metrics.map((m, i) => <MetricRow key={i} metric={m} />)}
    </div>
  );
}

function MetricsGrouped({ metrics }: { metrics: any[] }) {
  const fundamental = metrics.filter(m => m.source === 'fundamental');
  const market = metrics.filter(m => m.source === 'market' || !m.source);

  const valuation    = market.filter(m => metricSubGroup(m.label) === 'valuation');
  const profitability = market.filter(m => metricSubGroup(m.label) === 'profitability');
  const overview     = market.filter(m => metricSubGroup(m.label) === 'overview');

  // Detect reporting currency from fundamental metric values
  const allFundamentalText = fundamental.map(m => m.value).join(' ');
  const reportCurrency =
    /RMB|rmb|人民币/.test(allFundamentalText) ? 'CNY / RMB' :
    /CNY|cny/.test(allFundamentalText)         ? 'CNY' :
    /USD|\$/.test(allFundamentalText)           ? 'USD' :
    /EUR|€/.test(allFundamentalText)            ? 'EUR' :
    /GBP|£/.test(allFundamentalText)            ? 'GBP' :
    null;

  return (
    <div className="space-y-5">
      {/* ── Section A: From Annual Report ─────────────────────────────── */}
      {fundamental.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="w-1 h-4 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">From Annual Report</span>
            <span className="text-[10px] text-slate-600">· FundamentalAgent</span>
            {reportCurrency && (
              <span className="ml-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/40 border border-amber-700/40 text-amber-400 uppercase tracking-wider">
                Reported in {reportCurrency}
              </span>
            )}
            {reportCurrency && reportCurrency.includes('CNY') && (
              <span className="text-[10px] text-slate-600 italic">
                · Chinese companies file financial statements in CNY regardless of listing currency
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fundamental.map((m, i) => (
              <div key={i} className="bg-[#080a0f]/80 p-4 rounded-xl border border-emerald-900/30 group hover:border-emerald-500/30 transition-colors">
                <div className="flex justify-between items-start mb-1.5">
                  <span className="text-xs font-semibold text-slate-400">{m.label}</span>
                  <TrendIcon trend={m.trend} />
                </div>
                <div className="text-xl font-black text-white font-mono tracking-tight group-hover:text-emerald-400 transition-colors">
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Section B + C: Market Data ────────────────────────────────── */}
      {market.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full bg-blue-500" />
            <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Live Market Data</span>
            <span className="text-[10px] text-slate-600 ml-1">· QuantAgent · HKD</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {overview.length > 0 && (
              <MetricPanel title="Market Overview" accent="border-blue-900/40" metrics={overview} />
            )}
            {valuation.length > 0 && (
              <MetricPanel title="Valuation Multiples" accent="border-amber-900/40" metrics={valuation} />
            )}
            {profitability.length > 0 && (
              <MetricPanel title="Profitability & Balance" accent="border-indigo-900/40" metrics={profitability} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CollapsibleSection({ title, icon, children, isOpen, onToggle, containerClassName = "" }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  containerClassName?: string;
}) {
  return (
    <div className="bg-[#080a0f]/80 backdrop-blur-sm rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-slate-800/80 overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-5 hover:bg-[#0a0d14] transition-colors focus:outline-none">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-blue-500/10 rounded-lg ring-1 ring-blue-500/20">
            {icon}
          </div>
          <h2 className="text-lg font-bold text-white font-display tracking-wide">{title}</h2>
        </div>
        <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && <div className={`p-6 pt-0 ${containerClassName}`}>{children}</div>}
    </div>
  );
}
