import { Type } from "@google/genai";
import { runGenerativeAI } from "./LLMProvider";
import { AnalysisResult } from "../types";

export class QuantAgent {
  /**
   * Fully autonomous method that fetches its own data and analyzes it.
   */
  static async runAutonomousAnalysis(ticker: string, options: string[], onProgress?: (msg: string) => void): Promise<Partial<AnalysisResult>> {
    onProgress?.(`QuantAgent: Identifying symbol for ${ticker}...`);
    
    let finalTicker = ticker.toUpperCase();
    try {
      const searchRes = await fetch(`/api/search/${encodeURIComponent(ticker)}`);
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.quotes && searchData.quotes.length > 0) {
          finalTicker = searchData.quotes[0].symbol;
        } else if (ticker.match(/[\u3400-\u9FBF]/)) {
           throw new Error(`Could not resolve company name "${ticker}" to a stock symbol.`);
        }
      }
    } catch (e: any) {
      if (e.message?.includes('Could not resolve')) throw e;
    }

    onProgress?.(`QuantAgent: Fetching real-time market data for ${finalTicker}...`);
    const res = await fetch(`/api/stock/${encodeURIComponent(finalTicker)}/summary`);
    if (!res.ok) {
        const text = await res.text();
        if (text.includes('Cookie check') || text.includes('goog-auth')) {
          throw new Error('Preview environment interrupted the request. Please click "Open in New Tab".');
        }
        throw new Error(`QuantAgent failed to fetch market data (symbol might be invalid).`);
    }
    const marketData = await res.json();
    
    onProgress?.(`QuantAgent: Analyzing market structures and quantitative trends...`);
    return await this.processMarketData(finalTicker, marketData, options);
  }

  /**
   * Processes raw market JSON data (e.g. from Yahoo Finance API) to find quantitative trends
   * and synthesize a market-data based summary.
   */
  static async processMarketData(ticker: string, marketData: any, options: string[]): Promise<Partial<AnalysisResult>> {
    console.log("QuantAgent: Analyzing market data for " + ticker);
    
    let requestedSections = "Extract the company name, ticker, and a general summary.";
    const schemaProperties: any = {
      company: {
        type: Type.OBJECT,
        required: ["name", "ticker"],
        properties: { name: { type: Type.STRING }, ticker: { type: Type.STRING } }
      },
      summary: { type: Type.STRING },
      sentiment: { type: Type.STRING, enum: ["Positive", "Neutral", "Negative"] },
      metrics: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          required: ["label", "value", "trend"],
          properties: {
            label: { type: Type.STRING },
            value: { type: Type.STRING },
            trend: { type: Type.STRING, enum: ["up", "down", "flat"] }
          }
        }
      }
    };

    const requiredFields = ["company", "summary", "sentiment", "metrics"];

    // Always extract detailed valuation metrics for the KPI grid
    requestedSections += `
      In the 'metrics' array, include ALL of the following as separate entries (use "N/A" if unavailable):
      - Revenue (most recent annual or TTM)
      - Revenue Growth YoY (%)
      - Net Income / Earnings
      - EPS (Earnings Per Share, trailing)
      - Trailing P/E Ratio
      - Forward P/E Ratio
      - Price-to-Book (P/B) Ratio
      - PEG Ratio
      - EV/EBITDA
      - EBITDA Margin (%)
      - Return on Equity (ROE %)
      - Debt-to-Equity Ratio
      - Free Cash Flow
      - Dividend Yield (%)
      - Market Cap
      Use 'up' trend for positive values vs sector average, 'down' for concerning values, 'flat' for neutral.
    `;
    
    // Add optional requests if the caller asks for it directly from quant
    if (options.includes("highlights")) {
      schemaProperties.highlights = { type: Type.ARRAY, items: { type: Type.STRING } };
      requiredFields.push("highlights");
    }
    if (options.includes("risks")) {
      schemaProperties.risks = { type: Type.ARRAY, items: { type: Type.STRING } };
      requiredFields.push("risks");
    }
    
    const prompt = `
      You are an expert quantitative financial analyst. Analyze the following market data and provide a structured analysis.
      ${requestedSections}
      
      Market Data for ${ticker}:
      ${JSON.stringify(marketData, null, 2).substring(0, 40000)}
  
      IMPORTANT: Add the following disclaimer to the end of the 'summary' field: "Analysis based on market data only — upload annual report for deeper insights."
    `;
  
    const parsed = await runGenerativeAI(prompt, schemaProperties, requiredFields);
    if (!parsed.summary.includes("Analysis based on market data only")) {
      parsed.summary += "\\n\\nAnalysis based on market data only — upload annual report for deeper insights.";
    }
    return parsed;
  }
}
