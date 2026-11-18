# BB Exchange
글로벌 가상자산 거래소 가격 비교 웹사이트 스타터.

## 포함 기능
- 블랙 + 은은한 골드 반응형 디자인
- 코인 검색 입력, 자산 및 CEX/DEX 필터 UI
- 가격 비교, 국가별 거래소 순위, DEX 섹션
- 실제 API 연결 전까지 가격은 `—`로 표시 (가짜 시세 없음)

## 아직 구현해야 할 것
- CEX 실시간 호가/거래 수수료 API
- DEX 풀 가격/유동성/거래량/슬리피지 API
- 국가별 거래소 접근 가능 여부 및 순위 검증
- 서버 API, 계정, 관심목록

## 미리보기
`index.html`을 브라우저에서 엽니다.

## GitHub 업로드
저장소에서 Add file → Upload files를 누르고 이 폴더의 파일 4개를 업로드한 뒤 Commit changes를 누릅니다.

## Render 배포
New + → Static Site → GitHub 저장소 연결. Build Command는 비워 두고 Publish Directory는 `.`로 설정한 뒤 Deploy합니다.

주의: 현재 파일은 프런트엔드 스타터이며 실시간 거래소 가격은 아직 제공하지 않습니다.
