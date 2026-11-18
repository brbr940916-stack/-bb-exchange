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
assert.match(backend, /app\.disable\("x-powered-by"\)/, "Express 서버 정보 노출을 비활성화해야 합니다.");
assert.match(backend, /X-Content-Type-Options/, "MIME 스니핑 방지 헤더를 제공해야 합니다.");
assert.match(backend, /X-Frame-Options/, "외부 프레임 삽입을 차단해야 합니다.");
assert.match(backend, /Permissions-Policy/, "불필요한 브라우저 권한을 비활성화해야 합니다.");
assert.match(backend, /express\.json\(\{ limit: "16kb" \}\)/, "JSON 요청 본문 크기를 제한해야 합니다.");
assert.match(backend, /allowedBrowserOrigins\.has\(origin\)/, "브라우저 CORS 허용 출처를 제한해야 합니다.");
assert.match(backend, /methods: \["GET", "HEAD"\]/, "브라우저 CORS는 읽기 전용 요청만 허용해야 합니다.");
assert.match(backend, /\["GET", "HEAD", "OPTIONS"\]\.includes\(req\.method\)/, "API는 상태 변경 HTTP 메서드를 거부해야 합니다.");
assert.match(backend, /maxAge: 600/, "CORS 사전 요청 결과를 제한된 시간만 캐시해야 합니다.");

assert.match(backend, /request\.headers\.origin/, "브라우저 WebSocket 출처를 검증해야 합니다.");
assert.match(backend, /quote !== "KRW"/, "비교 API는 KRW 이외 통화를 거부해야 합니다.");
assert.match(backend, /market\.spot !== true/, "거래량 순위는 현물 시장만 집계해야 합니다.");
assert.match(backend, /market\.taker !== null && market\.taker !== undefined/, "공개 수수료 누락값을 0%로 처리하면 안 됩니다.");
assert.match(backend, /메시지 처리 실패:/, "실시간 스트림 메시지 처리 오류를 진단해야 합니다.");
assert.match(backend, /구독 요청 실패:/, "실시간 스트림 구독 오류를 진단해야 합니다.");
assert.match(backend, /lastMessageAgeMs: messageAgeMs/, "실시간 메시지 수신 시각을 진단해야 합니다.");
assert.match(backend, /hasRecentMessage:/, "최근 메시지 수신 여부를 상태 API에 제공해야 합니다.");
assert.match(backend, /maxPayload: 1024/, "브라우저 WebSocket 입력 크기를 제한해야 합니다.");
assert.match(backend, /perMessageDeflate: false/, "불필요한 WebSocket 압축을 비활성화해야 합니다.");
assert.match(backend, /updateTimestamp < now - 120000 \|\| updateTimestamp > now \+ 5000/, "오래되거나 미래 시각인 호가를 실시간 데이터로 노출하면 안 됩니다.");
assert.match(backend, /snapshotAge >= 0 && snapshotAge < 30000/, "브라우저 연결 시 오래된 호가 스냅샷을 전송하면 안 됩니다.");
assert.match(backend, /browserClients\.delete\(client\);\s*client\.terminate\(\);/, "브라우저 WebSocket 전송 오류 연결을 정리해야 합니다.");

assert.match(backend, /90초 동안 거래소 메시지가 없어/, "정체된 실시간 연결은 자동 재연결해야 합니다.");
assert.match(backend, /socket\.on\("pong"/, "WebSocket PONG 프레임을 연결 생존 신호로 처리해야 합니다.");
assert.match(backend, /socket\.on\("ping"/, "WebSocket PING 프레임을 연결 생존 신호로 처리해야 합니다.");
assert.match(backend, /socket\.terminate\(\);\s*return;/, "구독 요청 실패 시 잘못된 연결을 재시도해야 합니다.");
assert.match(backend, /코인원 구독\/스트림 오류:/, "코인원 구독 오류를 감지해야 합니다.");
assert.match(backend, /item\.error && typeof item\.error === "object"/, "업비트·빗썸 등 거래소의 JSON 오류 응답을 진단해야 합니다.");
assert.match(backend, /스트림 오류:/, "거래소별 스트림 오류를 상태 API에 기록해야 합니다.");
assert.match(backend, /state = "error";\s*streamStatus\[exchangeId\]\.lastError[\s\S]*?socket\.terminate\(\);/, "거래소 프로토콜 오류가 나면 연결을 재시작해야 합니다.");
assert.match(backend, /lastUpdateAt = new Date\(update\.timestamp\)\.toISOString\(\);\s*streamStatus\[exchangeId\]\.state = "connected";\s*streamStatus\[exchangeId\]\.lastError = null;/, "정상 호가 수신 후에만 스트림 오류 상태를 해제해야 합니다.");

assert.match(frontend, /age>=0&&age<30000/, "미래 시각을 실시간 수신으로 오인하면 안 됩니다.");
assert.match(frontend, /disconnectMarketSocket\(\)/, "화면 비활성화 시 브라우저 소켓을 닫아야 합니다.");
assert.match(frontend, /BITCOIN.*BTC.*ETHEREUM.*ETH.*SOLANA.*SOL.*RIPPLE.*XRP.*DOGECOIN.*DOGE/, "영문 코인 이름 검색 별칭을 지원해야 합니다.");

console.log("BB 거래소 정적 검증 통과");
