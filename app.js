const API_BASE = "https://bb-exchange-api.onrender.com";

const search = document.querySelector("#search");
const asset = document.querySelector("#asset");
const kind = document.querySelector("#kind");
const quote = document.querySelector("#quote");
const message = document.querySelector("#message");
const refresh = document.querySelector("#refresh");
const empty = document.querySelector(".empty");
const sideNote = document.querySelector(".side-note");
const statusLabel = document.querySelector(".snapshot > label span");

let lastResults = [];
let requestNumber = 0;

function fmtPrice(value) {
  if (!Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(Number(value));
}
function exchangeName(id) {
  return ({binance:"Binance",bybit:"Bybit",okx:"OKX",kucoin:"KuCoin",kraken:"Kraken",coinbase:"Coinbase",bitget:"Bitget",gateio:"Gate.io"})[id] || id;
}
function setStatus(text) {
  if (sideNote) sideNote.textContent = "● " + text;
  if (statusLabel) statusLabel.textContent = text;
}
function showMessage(title, detail) {
  empty.innerHTML = "";
  const h = document.createElement("h3");
  h.id = "message";
  h.textContent = title;
  const p = document.createElement("p");
  p.textContent = detail;
  empty.append(h, p);
}
function renderRows(data) {
  empty.innerHTML = "";
  const summary = document.createElement("div");
  summary.className = "results-summary";
  summary.textContent = data.results.length
    ? `${data.symbol} · ${data.results.length}개 거래소 응답 · ${new Date(data.updatedAt).toLocaleString("ko-KR")}`
    : `${data.symbol} · 현재 조회 가능한 거래소가 없습니다.`;
  empty.append(summary);

  if (!data.results.length) {
    const p = document.createElement("p");
    p.textContent = "거래소 API 응답 또는 해당 거래쌍 상장 여부를 확인해 주세요.";
    empty.append(p);
    return;
  }

  const table = document.createElement("table");
  table.className = "market-table";
  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>거래소</th><th>최저 매도호가</th><th>매수호가</th><th>상태</th></tr>";
  const tbody = document.createElement("tbody");
  data.results.forEach(row => {
    const tr = document.createElement("tr");
    const cells = [
      exchangeName(row.exchange),
      row.bestAsk ? fmtPrice(row.bestAsk.price) : "—",
      row.bestBid ? fmtPrice(row.bestBid.price) : "—",
      row.bestAsk ? "실시간 응답" : "데이터 없음"
    ];
    cells.forEach((value, i) => {
      const td = document.createElement("td");
      td.textContent = value;
      if (i === 1) td.className = "price-cell";
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(thead, tbody);
  empty.append(table);

  const note = document.createElement("p");
  note.className = "data-note";
  note.textContent = "※ 공개 오더북의 최우선 매도호가 기준입니다. 거래 수수료·슬리피지·출금 비용은 포함되지 않아 실제 체결 총비용과 다를 수 있습니다.";
  empty.append(note);
}

async function loadPrices() {
  const currentRequest = ++requestNumber;
  const symbol = asset.value;
  const quoteValue = quote ? quote.value : "USDT";
  setStatus("시세 조회 중");
  refresh.disabled = true;
  refresh.textContent = "조회 중…";
  showMessage("거래소 시세를 조회하고 있습니다.", "공개 거래소 API에 연결하는 중입니다. 첫 요청은 다소 오래 걸릴 수 있습니다.");

  try {
    const response = await fetch(`${API_BASE}/api/compare?asset=${encodeURIComponent(symbol)}&quote=${encodeURIComponent(quoteValue)}`);
    if (!response.ok) throw new Error(`API 응답 오류 (${response.status})`);
    const data = await response.json();
    if (currentRequest !== requestNumber) return;
    lastResults = data.results || [];
    renderRows(data);
    setStatus("시세 연결됨");
    const btcTile = document.querySelector(".tiles article:first-child strong");
    if (btcTile && symbol === "BTC" && lastResults[0]?.bestAsk) btcTile.textContent = fmtPrice(lastResults[0].bestAsk.price);
  } catch (error) {
    if (currentRequest !== requestNumber) return;
    showMessage("시세 데이터를 불러오지 못했습니다.", `${error.message}. 백엔드 배포 상태와 거래소 API 접근을 확인해 주세요.`);
    setStatus("연결 오류");
  } finally {
    if (currentRequest === requestNumber) {
      refresh.disabled = false;
      refresh.textContent = "새로고침";
    }
  }
}

asset.addEventListener("change", loadPrices);
if (quote) quote.addEventListener("change", loadPrices);
kind.addEventListener("change", () => {
  if (kind.value === "dex") {
    showMessage("DEX 데이터는 아직 연결되지 않았습니다.", "DEX는 중앙화 거래소 오더북과 다른 온체인 유동성 풀 데이터를 별도로 연동해야 합니다.");
  } else {
    loadPrices();
  }
});
refresh.addEventListener("click", loadPrices);
search.addEventListener("input", () => {
  const term = search.value.trim().toUpperCase();
  if (!term) return;
  const supported = ["BTC","ETH","SOL","XRP","BNB"];
  const match = supported.find(s => s === term);
  if (match) {
    asset.value = match;
    loadPrices();
  }
});
document.addEventListener("keydown", e => {
  if (e.key === "/" && !["INPUT","TEXTAREA"].includes(document.activeElement.tagName)) {
    e.preventDefault();
    search.focus();
  }
});
loadPrices();
