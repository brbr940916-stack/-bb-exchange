const express = require("express");
const cors = require("cors");
const ccxt = require("ccxt");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const EXCHANGE_IDS = [
  "binance", "bybit", "okx", "kucoin",
  "kraken", "coinbase", "bitget", "gateio"
];

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
  const quote = String(req.query.quote || "USDT").toUpperCase();

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

      return {
        exchange: id,
        symbol,
        available: Boolean(bestAsk),
        bestAsk: bestAsk ? { price: bestAsk[0], amount: bestAsk[1] } : null,
        bestBid: bestBid ? { price: bestBid[0], amount: bestBid[1] } : null,
        timestamp: book.timestamp || Date.now(),
        source: "exchange order book",
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
    .sort((a, b) => a.bestAsk.price - b.bestAsk.price);

  res.json({
    asset,
    quote,
    symbol,
    updatedAt: new Date().toISOString(),
    methodology: "Sorted by top ask price. Trading fees, slippage, transfer costs and regional restrictions are not included.",
    results: available,
    unavailable: results.filter((item) => !item.available)
  });
});

app.get("/", (_req, res) => {
  res.type("text").send("BB Exchange API is running. Try /api/health or /api/compare?asset=BTC&quote=USDT");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`BB Exchange API listening on port ${PORT}`);
});
