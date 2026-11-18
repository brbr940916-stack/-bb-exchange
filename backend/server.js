const express = require("express");
const cors = require("cors");
const ccxt = require("ccxt");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const EXCHANGE_IDS = ["upbit", "bithumb", "coinone", "korbit"];

const EXCHANGE_INFO = {
  upbit: { name: "업비트" },
  bithumb: { name: "빗썸" },
  coinone: { name: "코인원" },
  korbit: { name: "코빗" }
};

const instances = new Map();

function getExchange(id) {
  if (!ccxt[id]) throw new Error(`Unsupported exchange: ${id}`);
  if (!instances.has(id)) {
    instances.set(id, new ccxt[id]({
      enableRateLimit: true,
      timeout: 12000
    }));
  }
  return instances.get(id);
}

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "BB Exchange API",
    marketData: "public exchange APIs",
    exchanges: EXCHANGE_IDS
  });
});

app.get("/api/exchanges", (_req, res) => {
  res.json({ exchanges: EXCHANGE_IDS });
});

app.get("/api/compare", async (req, res) => {
  const asset = String(req.query.asset || "BTC").toUpperCase();
  const quote = String(req.query.quote || "KRW").toUpperCase();

  if (!/^[A-Z0-9]{2,15}$/.test(asset) || !/^[A-Z0-9]{2,15}$/.test(quote)) {
    return res.status(400).json({ error: "Invalid asset or quote symbol." });
  }

  const symbol = `${asset}/${quote}`;
  const results = await Promise.all(EXCHANGE_IDS.map(async (id) => {
    try {
      const exchange = getExchange(id);
      await exchange.loadMarkets();
      if (!exchange.markets[symbol]) {
        return { exchange: id, symbol, available: false, reason: "Market pair not listed" };
      }
      const book = await exchange.fetchOrderBook(symbol, 20);
      const bestAsk = book.asks?.[0];
      const bestBid = book.bids?.[0];
      const market = exchange.markets[symbol];
      const takerFeeRate = Number.isFinite(Number(market.taker)) ? Number(market.taker) : null;
      const feeAdjustedAsk = bestAsk && takerFeeRate !== null ? bestAsk[0] * (1 + takerFeeRate) : null;

      return {
        exchange: id,
        symbol,
        available: Boolean(bestAsk),
        bestAsk: bestAsk ? { price: bestAsk[0], amount: bestAsk[1] } : null,
        bestBid: bestBid ? { price: bestBid[0], amount: bestBid[1] } : null,
        takerFeeRate,
        feeAdjustedAsk,
        feeEstimateAvailable: feeAdjustedAsk !== null,
        timestamp: book.timestamp || Date.now(),
        source: "exchange order book + public market metadata",
        feeIncluded: false
      };
    } catch (error) {
      return {
        exchange: id,
        symbol,
        available: false,
        reason: String(error.message || "Market data unavailable").slice(0, 180)
      };
    }
  }));

  const available = results
    .filter((item) => item.available && item.bestAsk)
    .sort((a, b) => {
      if (a.feeAdjustedAsk !== null && b.feeAdjustedAsk !== null) return a.feeAdjustedAsk - b.feeAdjustedAsk;
      return a.bestAsk.price - b.bestAsk.price;
    });

  res.json({
    asset,
    quote,
    symbol,
    updatedAt: new Date().toISOString(),
    methodology: "Sorted by estimated ask price including public market taker fee when available. Fees may differ by account tier, promotions and jurisdiction. Slippage, fiat conversion, transfer costs and regional restrictions are not included.",
    results: available,
    unavailable: results.filter((item) => !item.available)
  });
});


app.get("/api/rankings", async (req, res) => {
  const quote = String(req.query.quote || "USDT").toUpperCase();
  if (!["USDT", "USD", "USDC"].includes(quote)) {
    return res.status(400).json({ error: "Supported ranking quote currencies: USDT, USD, USDC." });
  }

  const results = await Promise.all(EXCHANGE_IDS.map(async (id) => {
    try {
      const exchange = getExchange(id);
      await exchange.loadMarkets();
      const tickers = await exchange.fetchTickers();
      let quoteVolume24h = 0;
      let marketsCount = 0;
      for (const [symbol, ticker] of Object.entries(tickers)) {
        const market = exchange.markets[symbol];
        if (!market || market.spot !== true || market.quote !== quote) continue;
        const volume = Number(ticker.quoteVolume);
        if (Number.isFinite(volume) && volume > 0) {
          quoteVolume24h += volume;
          marketsCount += 1;
        }
      }
      const info = EXCHANGE_INFO[id];
      return {
        exchange: id, name: info.name, quote,
        quoteVolume24h: quoteVolume24h || null, marketsCount,
        available: quoteVolume24h > 0, source: "public exchange tickers",
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      const info = EXCHANGE_INFO[id];
      return {
        exchange: id, name: info.name, quote, quoteVolume24h: null,
        marketsCount: 0, available: false,
        reason: String(error.message || "Volume data unavailable").slice(0, 160)
      };
    }
  }));

  const ranked = results.filter(item => item.available)
    .sort((a, b) => b.quoteVolume24h - a.quoteVolume24h)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  res.json({
    quote, updatedAt: new Date().toISOString(),
    rankingBasis: "국내 거래소가 공개한 24시간 원화(KRW) 현물 거래량을 합산한 참고 순위입니다. 거래소별 집계 방식이 다를 수 있으며 외부에서 독립적으로 검증한 수치는 아닙니다.",
    results: ranked, unavailable: results.filter(item => !item.available)
  });
});

app.get("/api/dex", async (req, res) => {
  const asset = String(req.query.asset || "BTC").trim().toUpperCase();
  if (!/^[A-Z0-9]{2,15}$/.test(asset)) {
    return res.status(400).json({ error: "Invalid asset symbol." });
  }

  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(asset)}`, {
      headers: { "accept": "application/json" },
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error(`DEX data provider returned HTTP ${response.status}`);
    const payload = await response.json();
    const pairs = (payload.pairs || [])
      .filter(pair => String(pair.baseToken?.symbol || "").toUpperCase() === asset)
      .map(pair => ({
        chain: pair.chainId || null,
        dex: pair.dexId || null,
        pairAddress: pair.pairAddress || null,
        baseSymbol: pair.baseToken?.symbol || asset,
        quoteSymbol: pair.quoteToken?.symbol || null,
        priceUsd: Number(pair.priceUsd) || null,
        liquidityUsd: Number(pair.liquidity?.usd) || 0,
        volume24hUsd: Number(pair.volume?.h24) || 0,
        priceChange24h: Number(pair.priceChange?.h24) || null,
        url: pair.url || null,
        source: "DexScreener"
      }))
      .sort((a, b) => b.liquidityUsd - a.liquidityUsd)
      .slice(0, 30);

    res.json({
      asset,
      provider: "DexScreener",
      updatedAt: new Date().toISOString(),
      methodology: "Exact base-token symbol match; sorted by reported USD pool liquidity. Symbols can be shared by unrelated tokens; verify token contract and chain before trading.",
      results: pairs
    });
  } catch (error) {
    res.status(502).json({
      error: "DEX market data unavailable",
      detail: String(error.message || "Provider request failed").slice(0, 180)
    });
  }
});

app.get("/", (_req, res) => {
  res.type("text").send("BB Exchange API is running. Try /api/health or /api/compare?asset=BTC&quote=KRW");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`BB Exchange API listening on port ${PORT}`);
});
