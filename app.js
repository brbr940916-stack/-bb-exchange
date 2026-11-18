const API_BASE="https://bb-exchange-api.onrender.com";
const search=document.querySelector("#search"),asset=document.querySelector("#asset"),quote=document.querySelector("#quote"),refresh=document.querySelector("#refresh"),empty=document.querySelector(".empty"),sideNote=document.querySelector(".side-note"),statusLabel=document.querySelector(".snapshot > label span");
let requestNumber=0;
function money(v,currency="KRW"){if(!Number.isFinite(Number(v)))return"—";return new Intl.NumberFormat("ko-KR",{style:"currency",currency,maximumFractionDigits:currency==="KRW"?0:6}).format(Number(v));}
function status(t){if(sideNote)sideNote.textContent="● "+t;if(statusLabel)statusLabel.textContent=t;}
function msg(title,detail){empty.innerHTML="";const h=document.createElement("h3");h.textContent=title;const p=document.createElement("p");p.textContent=detail;empty.append(h,p);}
function table(headers,rows){const t=document.createElement("table");t.className="market-table";const hd=document.createElement("thead"),hr=document.createElement("tr");headers.forEach(x=>{const th=document.createElement("th");th.textContent=x;hr.append(th);});hd.append(hr);const bd=document.createElement("tbody");rows.forEach(x=>bd.append(x));t.append(hd,bd);return t;}
function cell(tr,value,cls){const td=document.createElement("td");td.textContent=value??"—";if(cls)td.className=cls;tr.append(td);}
function renderCex(d){empty.innerHTML="";const s=document.createElement("div");s.className="results-summary";s.textContent=d.symbol+" · "+d.results.length+"개 거래소 응답 · "+new Date(d.updatedAt).toLocaleString("ko-KR");empty.append(s);
if(!d.results.length){const p=document.createElement("p");p.textContent="현재 조회 가능한 국내 거래소가 없습니다.";empty.append(p);}
const rows=d.results.map(x=>{const tr=document.createElement("tr");cell(tr,x.exchangeName||x.exchange);cell(tr,x.bestAsk?money(x.bestAsk.price):"—","price-cell");cell(tr,x.takerFeeRate!==null&&x.takerFeeRate!==undefined?(x.takerFeeRate*100).toFixed(3)+"%":"확인 불가");cell(tr,x.feeAdjustedAsk!==null&&x.feeAdjustedAsk!==undefined?money(x.feeAdjustedAsk):"수수료 확인 불가");cell(tr,x.bestBid?money(x.bestBid.price):"—");return tr;});
if(rows.length)empty.append(table(["거래소","매도 1호가","공개 체결 수수료","수수료 반영 예상가","매수 1호가"],rows));
const n=document.createElement("p");n.className="data-note";n.textContent=d.methodology||"※ 공개된 기본 체결 수수료를 반영한 참고 예상가입니다. 회원 등급별 할인, 주문 수량에 따른 호가 변동 및 입출금 비용은 반영되지 않습니다.";empty.append(n);if(d.unavailable?.length){const u=document.createElement("p");u.className="data-note";u.textContent="조회 불가: "+d.unavailable.map(x=>(x.exchangeName||x.exchange)+" ("+(x.reason||"응답 없음")+")").join(" · ");empty.append(u);}}
async function load(){const id=++requestNumber,symbol=asset.value,q=quote.value;status("국내 거래소 시세 조회 중");refresh.disabled=true;refresh.textContent="조회 중…";msg("국내 거래소 시세를 조회하고 있습니다.","업비트, 빗썸, 코인원 공개 데이터에 연결하는 중입니다.");
try{const response=await fetch(API_BASE+"/api/compare?asset="+encodeURIComponent(symbol)+"&quote="+encodeURIComponent(q));if(!response.ok)throw new Error("시세 조회 요청에 실패했습니다. (오류 "+response.status+")");const data=await response.json();if(id!==requestNumber)return;renderCex(data);status(data.results?.length?"국내 거래소 "+data.results.length+"곳 시세 수신":"거래 가능한 국내 시세 없음");
const btc=document.querySelector(".tiles article:first-child strong");if(symbol==="BTC"&&data.results?.[0]?.bestAsk&&btc)btc.textContent=money(data.results[0].bestAsk.price);
}catch(e){if(id!==requestNumber)return;msg("시세 데이터를 불러오지 못했습니다.",e.message+" 잠시 후 다시 시도해 주세요.");status("데이터 연결 오류");}
finally{if(id===requestNumber){refresh.disabled=false;refresh.textContent="새로고침";}}}

async function loadSnapshot(){
 const assets=["BTC","ETH","SOL"];
 const cards=document.querySelectorAll(".tiles article");
 await Promise.all(assets.map(async(symbol,index)=>{
  try{
   const response=await fetch(API_BASE+"/api/compare?asset="+symbol+"&quote=KRW");
   if(!response.ok)throw new Error("조회 실패");
   const data=await response.json();
   const best=data.results?.filter(x=>x.bestAsk?.price).sort((a,b)=>a.bestAsk.price-b.bestAsk.price)[0];
   if(best&&cards[index]){
    cards[index].querySelector("strong").textContent=money(best.bestAsk.price);
    cards[index].querySelector("p").textContent="최저 매도 1호가 · "+(best.exchangeName||best.exchange);
   }else if(cards[index])cards[index].querySelector("p").textContent="현재 거래 가능한 원화 시장 없음";
  }catch(_error){if(cards[index])cards[index].querySelector("p").textContent="시세 조회 대기";}
 }));
}

let historyRequest=0;
async function loadHistory(){
 const id=++historyRequest;
 const chart=document.querySelector("#price-chart");
 const chartStatus=document.querySelector("#chart-status");
 if(!chart)return;
 if(chartStatus)chartStatus.textContent="가격 이력 조회 중";
 chart.textContent="최근 24시간 가격 데이터를 불러오고 있습니다.";
 try{
  const response=await fetch(API_BASE+"/api/history?asset="+encodeURIComponent(asset.value)+"&quote=KRW");
  if(!response.ok)throw new Error("차트 조회 요청에 실패했습니다.");
  const data=await response.json();
  if(id!==historyRequest)return;
  const series=data.results.filter(x=>x.candles?.length);
  if(!series.length)throw new Error("표시할 가격 이력이 없습니다.");
  drawHistory(chart,series);
  if(chartStatus)chartStatus.textContent="최근 24시간 · "+series.length+"개 거래소";
 }catch(error){
  if(id!==historyRequest)return;
  chart.textContent="가격 추이를 불러오지 못했습니다. "+error.message;
  if(chartStatus)chartStatus.textContent="차트 데이터 없음";
 }
}
function drawHistory(container,series){
 const ns="http://www.w3.org/2000/svg";
 const width=760,height=270,left=70,right=18,top=18,bottom=34;
 const values=series.flatMap(s=>s.candles.map(c=>Number(c.close)).filter(v=>Number.isFinite(v)&&v>0));
 if(!values.length){container.textContent="표시할 수 있는 가격 데이터가 없습니다.";return;}
 const min=Math.min(...values),max=Math.max(...values),range=max-min||Math.max(max*.01,1);
 const low=min-range*.08,high=max+range*.08;
 const allTimes=series.flatMap(s=>s.candles.map(c=>c.timestamp));
 const minTime=Math.min(...allTimes),maxTime=Math.max(...allTimes);
 const x=t=>left+(maxTime===minTime?0:(t-minTime)/(maxTime-minTime))*(width-left-right);
 const y=v=>top+(high-v)/(high-low)*(height-top-bottom);
 const svg=document.createElementNS(ns,"svg");
 svg.setAttribute("viewBox",`0 0 ${width} ${height}`);
 svg.setAttribute("role","presentation");
 svg.setAttribute("class","history-svg");
 for(let i=0;i<5;i++){
  const yy=top+i*(height-top-bottom)/4;
  const line=document.createElementNS(ns,"line");line.setAttribute("x1",left);line.setAttribute("x2",width-right);line.setAttribute("y1",yy);line.setAttribute("y2",yy);line.setAttribute("class","chart-grid");svg.append(line);
  const label=document.createElementNS(ns,"text");label.setAttribute("x",left-10);label.setAttribute("y",yy+4);label.setAttribute("text-anchor","end");label.setAttribute("class","chart-axis");label.textContent=money(high-i*(high-low)/4);svg.append(label);
 }
 const palette=["#d5b56a","#78a9d1","#b58ad8"];
 for(let i=0;i<3;i++){const t=minTime+(maxTime-minTime)*i/2;const label=document.createElementNS(ns,"text");label.setAttribute("x",x(t));label.setAttribute("y",height-8);label.setAttribute("text-anchor",i===0?"start":i===2?"end":"middle");label.setAttribute("class","chart-axis");label.textContent=new Date(t).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"});svg.append(label);}
 series.forEach((item,index)=>{
  const points=item.candles.filter(c=>Number.isFinite(Number(c.close))).map(c=>`${x(c.timestamp)},${y(Number(c.close))}`).join(" ");
  const line=document.createElementNS(ns,"polyline");line.setAttribute("points",points);line.setAttribute("class","chart-line");line.setAttribute("stroke",palette[index%palette.length]);svg.append(line);
  const last=item.candles[item.candles.length-1];
  if(last){const dot=document.createElementNS(ns,"circle");dot.setAttribute("cx",x(last.timestamp));dot.setAttribute("cy",y(Number(last.close)));dot.setAttribute("r","3.5");dot.setAttribute("fill",palette[index%palette.length]);svg.append(dot);}
 });
 const legend=document.createElement("div");legend.className="chart-legend";
 series.forEach((item,index)=>{const entry=document.createElement("span");const mark=document.createElement("i");mark.style.background=palette[index%palette.length];entry.append(mark,document.createTextNode(item.name));legend.append(entry);});
 container.replaceChildren(svg,legend);
}

const rankingPanel=document.querySelector("#ranking-panel");let rankingsLoaded=false;
async function loadRankings(force=false){if(!rankingPanel||(rankingsLoaded&&!force))return;rankingPanel.innerHTML="<p>국내 거래소의 24시간 원화 현물 거래량을 조회하고 있습니다.</p>";
try{const response=await fetch(API_BASE+"/api/rankings?quote=KRW");if(!response.ok)throw new Error("순위 조회 요청에 실패했습니다. (오류 "+response.status+")");const data=await response.json();const summary=document.createElement("div");summary.className="results-summary";summary.textContent="원화 현물 시장 · "+new Date(data.updatedAt).toLocaleString("ko-KR");
const rows=data.results.map(x=>{const tr=document.createElement("tr");cell(tr,String(x.rank).padStart(2,"0"));cell(tr,x.name);cell(tr,money(x.quoteVolume24h),"price-cell");cell(tr,String(x.marketsCount)+"개");return tr;});rankingPanel.innerHTML="";rankingPanel.append(summary);if(rows.length){rankingPanel.append(table(["순위","국내 거래소","24시간 거래량","거래 종목 수"],rows));}else{const emptyRank=document.createElement("p");emptyRank.textContent="현재 거래량 데이터를 제공하는 국내 거래소가 없습니다.";rankingPanel.append(emptyRank);}if(data.unavailable?.length){const unavailable=document.createElement("p");unavailable.className="data-note";unavailable.textContent="조회 불가: "+data.unavailable.map(x=>x.name+" ("+(x.reason||"응답 없음")+")").join(" · ");rankingPanel.append(unavailable);}
const note=document.createElement("p");note.className="data-note";note.textContent=data.rankingBasis;rankingPanel.append(note);rankingsLoaded=true;
}catch(error){rankingPanel.innerHTML="";const p=document.createElement("p");p.textContent="거래량 순위를 불러오지 못했습니다: "+error.message;rankingPanel.append(p);}}
document.querySelector('a[href="#rank"]')?.addEventListener("click",loadRankings);
asset.addEventListener("change",()=>{load();loadHistory();});quote.addEventListener("change",()=>{load();loadHistory();});refresh.addEventListener("click",()=>{load();loadSnapshot();loadHistory();loadRankings(true);});
search.addEventListener("input",()=>{const v=search.value.trim().toUpperCase();const aliases={"비트코인":"BTC","이더리움":"ETH","솔라나":"SOL","리플":"XRP","엑스알피":"XRP","도지코인":"DOGE"};const symbol=aliases[v]||v;if(["BTC","ETH","SOL","XRP","DOGE"].includes(symbol)){asset.value=symbol;load();loadHistory();}});
document.addEventListener("keydown",e=>{if(e.key==="/"&&!(["INPUT","TEXTAREA"].includes(document.activeElement.tagName))){e.preventDefault();search.focus();}});
load();
loadSnapshot();
loadHistory();
loadRankings();

// 화면이 열려 있을 때만 자동 갱신해 불필요한 API 호출을 줄입니다.
let lastSlowRefresh = Date.now();
setInterval(() => {
 if (document.visibilityState !== "visible") return;
 load();
 loadSnapshot();
 if (Date.now() - lastSlowRefresh >= 60000) {
  loadHistory();
  loadRankings(true);
  lastSlowRefresh = Date.now();
 }
}, 30000);
document.addEventListener("visibilitychange", () => {
 if (document.visibilityState === "visible") {
  load();
  loadSnapshot();
 }
});
