import { OrchestratorAgent, AgentEvent } from "../agents/Orchestrator";
import { AnalysisResult, CrossAnalysisResult, ValuationSummary, ValuationVerdictResult } from "../types";
import { CIOAgent } from "../agents/CIOAgent";

// Maintain a single entry point for analysis that truly leverages the multi-agent system autonomously.
export async function runMasterAnalysis(
  input: { ticker?: string; file?: File; options: string[]; userRequest?: string },
  onEvent: (event: AgentEvent) => void
): Promise<AnalysisResult> {
  return await OrchestratorAgent.runMasterAnalysis(input, onEvent);
}

// Preserve for backward compatibility in smaller dashboard components that might call this dynamically
export async function synthesizeValuationVerdict(valuationData: ValuationSummary): Promise<ValuationVerdictResult> {
  return await OrchestratorAgent.synthesizeValuation(valuationData);
}

export async function crossAnalyze(reportAnalysis: AnalysisResult, marketData: any): Promise<CrossAnalysisResult> {
  return await CIOAgent.crossAnalyze(reportAnalysis, marketData);
}

export async function resolveYahooTickersWithAI(query: string): Promise<string> {
  return await OrchestratorAgent.resolvePeerTicker(query);
}

// Mode B: PDF-first analysis — FundamentalAgent extracts ticker from report,
// then QuantAgent + PeerAgent run automatically, CIOAgent cross-analyses.
export async function runParallelAnalysis(
  file: File,
  options: string[],
  onEvent: (event: AgentEvent) => void
): Promise<AnalysisResult> {
  return await OrchestratorAgent.runParallelAnalysis(file, options, onEvent);
}

export type { AgentEvent };
