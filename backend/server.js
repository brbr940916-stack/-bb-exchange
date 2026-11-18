const express = require("express");
const cors = require("cors");
const ccxt = require("ccxt");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const EXCHANGE_IDS = ["upbit", "bithumb", "coinone"];
const EXCHANGE_INFO = {
  upbit: { name: "업비트" },
  bithumb: { name: "빗썸" },
  coinone: { name: "코인원" }
};
const instances = new Map();

function getExchange(id) {
  if (!ccxt[id]) throw new Error("지원하지 않는 거래소입니다.");
  if (!instances.has(id)) {
    instances.set(id, new ccxt[id]({ enableRateLimit: true, timeout: 12000 }));
  }
  return instances.get(id);
}

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "BB 거래소 API",
    marketData: "국내 거래소 공개 원화 현물 시세",
    exchanges: EXCHANGE_IDS.map(id => ({ id, name: EXCHANGE_INFO[id].name }))
  });
});

app.get("/api/exchanges", (_req, res) => {
  res.json({ exchanges: EXCHANGE_IDS.map(id => ({ id, name: EXCHANGE_INFO[id].name })) });
});

app.get("/api/compare", async (req, res) => {
  const asset = String(req.query.asset || "BTC").toUpperCase();
  const quote = String(req.query.quote || "KRW").toUpperCase();
  if (!/^[A-Z0-9]{2,15}$/.test(asset) || quote !== "KRW") {
    return res.status(400).json({ error: "국내 거래소 비교는 올바른 가상자산 심볼과 KRW 기준만 지원합니다." });
  }

  const symbol = `${asset}/KRW`;
  const results = await Promise.all(EXCHANGE_IDS.map(async id => {
    try {
      const exchange = getExchange(id);
      await exchange.loadMarkets();
      if (!exchange.markets[symbol]) {
        return { exchange: id, exchangeName: EXCHANGE_INFO[id].name, symbol, available: false, reason: "해당 원화 거래 시장이 없습니다." };
      }
      const book = await exchange.fetchOrderBook(symbol, 20);
      const bestAsk = book.asks?.[0];
      const bestBid = book.bids?.[0];
      const market = exchange.markets[symbol];
      const fee = Number(market.taker);
      const takerFeeRate = Number.isFinite(fee) && fee >= 0 ? fee : null;
      const feeAdjustedAsk = bestAsk && takerFeeRate !== null ? bestAsk[0] * (1 + takerFeeRate) : null;
      return {
        exchange: id, exchangeName: EXCHANGE_INFO[id].name, symbol,
        available: Boolean(bestAsk),
        bestAsk: bestAsk ? { price: bestAsk[0], amount: bestAsk[1] } : null,
        bestBid: bestBid ? { price: bestBid[0], amount: bestBid[1] } : null,
        takerFeeRate, feeAdjustedAsk, feeEstimateAvailable: feeAdjustedAsk !== null,
        timestamp: book.timestamp || Date.now(),
        source: "국내 거래소 공개 호가 및 시장 정보"
      };
    } catch (error) {
      return {
        exchange: id, exchangeName: EXCHANGE_INFO[id].name, symbol, available: false,
        reason: String(error.message || "시세 데이터를 불러올 수 없습니다.").slice(0, 180)
      };
    }
  }));

  const available = results.filter(item => item.available && item.bestAsk).sort((a, b) => {
    if (a.feeAdjustedAsk !== null && b.feeAdjustedAsk !== null) return a.feeAdjustedAsk - b.feeAdjustedAsk;
    if (a.feeAdjustedAsk !== null) return -1;
    if (b.feeAdjustedAsk !== null) return 1;
    return a.bestAsk.price - b.bestAsk.price;
  });

  res.json({
    asset, quote, symbol, updatedAt: new Date().toISOString(),
    methodology: "공개 기본 체결 수수료를 확인할 수 있는 거래소는 이를 반영한 예상가 기준으로 정렬합니다. 수수료를 확인할 수 없는 거래소는 뒤에 표시하며, 실제 수수료는 회원 등급과 이벤트에 따라 다를 수 있습니다. 슬리피지와 입출금 비용은 포함하지 않습니다.",
    results: available,
    unavailable: results.filter(item => !item.available)
  });
});

app.get("/api/history", async (req, res) => {
  const asset = String(req.query.asset || "BTC").toUpperCase();
  const quote = String(req.query.quote || "KRW").toUpperCase();
  if (!/^[A-Z0-9]{2,15}$/.test(asset) || quote !== "KRW") {
    return res.status(400).json({ error: "가격 차트는 올바른 가상자산 심볼과 KRW 기준만 지원합니다." });
  }
  const symbol = `${asset}/KRW`;
  const results = await Promise.all(EXCHANGE_IDS.map(async id => {
    try {
      const exchange = getExchange(id);
      await exchange.loadMarkets();
      if (!exchange.markets[symbol]) {
        return { exchange: id, name: EXCHANGE_INFO[id].name, available: false, reason: "해당 원화 거래 시장이 없습니다." };
      }
      const candles = await exchange.fetchOHLCV(symbol, "1h", undefined, 24);
      return {
        exchange: id,
        name: EXCHANGE_INFO[id].name,
        available: Array.isArray(candles) && candles.length > 0,
        candles: (candles || []).map(([timestamp, open, high, low, close, volume]) => ({
          timestamp, open, high, low, close, volume
        }))
      };
    } catch (error) {
      return {
        exchange: id, name: EXCHANGE_INFO[id].name, available: false,
        reason: String(error.message || "가격 이력을 불러올 수 없습니다.").slice(0, 160)
      };
    }
  }));
  res.json({
    asset, quote, interval: "1h", updatedAt: new Date().toISOString(),
    methodology: "각 국내 거래소가 제공하는 최근 1시간 봉 최대 24개의 종가입니다. 거래소별 데이터 제공 범위와 갱신 시각이 다를 수 있습니다.",
    results: results.filter(item => item.available),
    unavailable: results.filter(item => !item.available)
  });
});

app.get("/api/rankings", async (req, res) => {
  const quote = String(req.query.quote || "KRW").toUpperCase();
  if (quote !== "KRW") {
    return res.status(400).json({ error: "국내 거래소 순위는 KRW 기준만 지원합니다." });
  }

  const results = await Promise.all(EXCHANGE_IDS.map(async id => {
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
      return {
        exchange: id, name: EXCHANGE_INFO[id].name, quote,
        quoteVolume24h: quoteVolume24h || null, marketsCount,
        available: quoteVolume24h > 0, source: "국내 거래소 공개 시세",
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        exchange: id, name: EXCHANGE_INFO[id].name, quote,
        quoteVolume24h: null, marketsCount: 0, available: false,
        reason: String(error.message || "거래량 데이터를 불러올 수 없습니다.").slice(0, 160)
      };
    }
  }));

  const ranked = results.filter(item => item.available)
    .sort((a, b) => b.quoteVolume24h - a.quoteVolume24h)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  res.json({
    quote, updatedAt: new Date().toISOString(),
    rankingBasis: "업비트·빗썸·코인원이 공개한 24시간 원화(KRW) 현물 거래량을 합산한 참고 순위입니다. 거래소별 집계 방식이 다를 수 있으며 외부에서 독립적으로 검증한 수치는 아닙니다.",
    results: ranked, unavailable: results.filter(item => !item.available)
  });
});

app.get("/", (_req, res) => {
  res.type("text").send("BB 거래소 API가 실행 중입니다. /api/health 또는 /api/compare?asset=BTC&quote=KRW 를 확인하세요.");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`BB 거래소 API listening on port ${PORT}`);
});
