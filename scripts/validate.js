const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const assert = require("node:assert/strict");

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const frontend = fs.readFileSync(path.join(root, "app.js"), "utf8");
const backend = fs.readFileSync(path.join(root, "backend/server.js"), "utf8");

assert.match(html, /<html lang="ko">/, "페이지는 한국어로 제공되어야 합니다.");
assert.match(html, /id="asset"/, "자산 선택기가 있어야 합니다.");
assert.match(html, /<option>KRW<\/option>/, "기준 통화는 KRW여야 합니다.");
assert.match(html, /id="stream-health"/, "실시간 수신 상태 영역이 있어야 합니다.");
for (const exchange of ["upbit", "bithumb", "coinone"]) {
  assert.ok(backend.includes(exchange), exchange + " 연동 코드가 있어야 합니다.");
}
for (const route of ["/api/health", "/api/compare", "/api/history", "/api/rankings", "/ws/market"]) {
  assert.ok(backend.includes(route), route + " 경로가 있어야 합니다.");
}
assert.match(backend, /quote !== "KRW"/, "비교 API는 KRW 이외 통화를 거부해야 합니다.");
assert.match(backend, /market\.spot !== true/, "거래량 순위는 현물 시장만 집계해야 합니다.");
assert.match(backend, /market\.taker !== null && market\.taker !== undefined/, "공개 수수료 누락값을 0%로 처리하면 안 됩니다.");
assert.match(frontend, /age>=0&&age<30000/, "미래 시각을 실시간 수신으로 오인하면 안 됩니다.");
assert.match(frontend, /disconnectMarketSocket\(\)/, "화면 비활성화 시 브라우저 소켓을 닫아야 합니다.");

console.log("BB 거래소 정적 검증 통과");
