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
assert.match(html, /aria-live="polite"/, "실시간 상태 안내는 보조기기에 전달되어야 합니다.");
assert.match(html, /aria-label="코인 이름 또는 심볼 검색"/, "검색 입력에 접근 가능한 이름이 있어야 합니다.");
assert.match(html, /rel="manifest" href="\/site\.webmanifest"/, "모바일 설치용 웹 앱 매니페스트를 연결해야 합니다.");
assert.match(frontend, /serviceWorker\.register\("\/sw\.js"\)/, "HTTPS 환경에서 오프라인 앱 셸을 등록해야 합니다.");
const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "site.webmanifest"), "utf8"));
assert.equal(manifest.lang, "ko-KR", "모바일 앱 언어는 한국어여야 합니다.");
assert.equal(manifest.display, "standalone", "모바일 앱은 독립 실행 화면으로 표시해야 합니다.");
assert.ok(manifest.icons?.some(icon => icon.src === "/icon.svg"), "앱 아이콘을 매니페스트에 등록해야 합니다.");
assert.ok(fs.existsSync(path.join(root, "icon.svg")), "앱 아이콘 파일이 있어야 합니다.");
assert.match(serviceWorker, /request\.mode !== "navigate"/, "서비스 워커는 앱 화면과 정적 파일만 캐시해야 합니다.");
assert.doesNotMatch(serviceWorker, /\/api\//, "서비스 워커가 API 응답을 캐시하면 안 됩니다.");
for (const exchange of ["upbit", "bithumb", "coinone"]) {
  assert.ok(backend.includes(exchange), exchange + " 연동 코드가 있어야 합니다.");
}
for (const route of ["/api/health", "/api/compare", "/api/history", "/api/rankings", "/ws/market"]) {
  assert.ok(backend.includes(route), route + " 경로가 있어야 합니다.");
}
assert.match(backend, /quote !== "KRW"/, "비교 API는 KRW 이외 통화를 거부해야 합니다.");
assert.match(backend, /market\.spot !== true/, "거래량 순위는 현물 시장만 집계해야 합니다.");
assert.match(backend, /market\.taker !== null && market\.taker !== undefined/, "공개 수수료 누락값을 0%로 처리하면 안 됩니다.");
assert.match(backend, /메시지 처리 실패:/, "실시간 스트림 메시지 처리 오류를 진단해야 합니다.");
assert.match(backend, /구독 요청 실패:/, "실시간 스트림 구독 오류를 진단해야 합니다.");
assert.match(backend, /lastMessageAgeMs: messageAgeMs/, "실시간 메시지 수신 시각을 진단해야 합니다.");
assert.match(backend, /hasRecentMessage:/, "최근 메시지 수신 여부를 상태 API에 제공해야 합니다.");
assert.match(backend, /90초 동안 거래소 메시지가 없어/, "정체된 실시간 연결은 자동 재연결해야 합니다.");
assert.match(backend, /socket\.on\("pong"/, "WebSocket PONG 프레임을 연결 생존 신호로 처리해야 합니다.");
assert.match(backend, /socket\.on\("ping"/, "WebSocket PING 프레임을 연결 생존 신호로 처리해야 합니다.");
assert.match(backend, /socket\.terminate\(\);\s*return;/, "구독 요청 실패 시 잘못된 연결을 재시도해야 합니다.");
assert.match(backend, /코인원 구독\/스트림 오류:/, "코인원 구독 오류를 감지해야 합니다.");
assert.match(backend, /item\.error && typeof item\.error === "object"/, "업비트·빗썸 등 거래소의 JSON 오류 응답을 진단해야 합니다.");
assert.match(backend, /스트림 오류:/, "거래소별 스트림 오류를 상태 API에 기록해야 합니다.");
assert.match(frontend, /age>=0&&age<30000/, "미래 시각을 실시간 수신으로 오인하면 안 됩니다.");
assert.match(frontend, /disconnectMarketSocket\(\)/, "화면 비활성화 시 브라우저 소켓을 닫아야 합니다.");
assert.match(frontend, /BITCOIN.*BTC.*ETHEREUM.*ETH.*SOLANA.*SOL.*RIPPLE.*XRP.*DOGECOIN.*DOGE/, "영문 코인 이름 검색 별칭을 지원해야 합니다.");

console.log("BB 거래소 정적 검증 통과");
