"use strict";
/* ===== v1.9.30: kéo để đồng bộ, số trên biểu tượng app, biểu đồ chi, nhập nhanh, lịch tháng giờ làm ===== */
const unacc=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase();
const curMod=()=>{const d=$("main>div[id^=mod-]:not(.hidden)");return d?d.id.slice(4):"home"};

/* 2) Kéo xuống ở đầu trang để đồng bộ (điện thoại) */
(()=>{
  const ind=document.createElement("div");ind.id="ptr";document.body.appendChild(ind);
  let y0=null,x0=0,dy=0,busy=false;const TH=80;
  const top0=()=>(window.scrollY||document.documentElement.scrollTop||0)<=0;
  const can=()=>innerWidth<=760&&!busy&&!document.querySelector("dialog[open]")&&top0();
  const show=(t,p)=>{ind.textContent=t;ind.className="on"+(p?" "+p:"");};
  const hide=()=>{ind.className="";};
  addEventListener("touchstart",e=>{if(e.touches.length!==1||!can()){y0=null;return}y0=e.touches[0].clientY;x0=e.touches[0].clientX;dy=0},{passive:true});
  addEventListener("touchmove",e=>{
    if(y0==null)return;const t=e.touches[0];dy=t.clientY-y0;
    if(Math.abs(t.clientX-x0)>Math.abs(dy)||dy<0||!top0()){y0=null;hide();return}
    if(dy>12){show(dy>TH?"↻ Thả tay để đồng bộ":"↓ Kéo thêm để đồng bộ",dy>TH?"ready":"");ind.style.setProperty("--p",Math.min(1,dy/TH))}
  },{passive:true});
  addEventListener("touchend",async()=>{
    if(y0==null)return;y0=null;if(dy<=TH){hide();return}
    busy=true;show("Đang đồng bộ…","busy");typeof vibrate==="function"&&vibrate(10);
    let msg="✓ Đã cập nhật";
    try{if(typeof cget==="function"&&cget().on){await cloudSync();if(cloudErr)msg="⚠ "+cloudErr}else msg="✓ Đã làm mới (chưa bật đồng bộ cloud)"}catch(e){msg="⚠ Lỗi đồng bộ"}
    try{showMod(curMod())}catch(e){}
    show(msg,"done");setTimeout(()=>{hide();busy=false},1300);
  },{passive:true});
})();

/* 3) Số việc cần xử lý trên biểu tượng app (iPhone: cần mở từ màn hình chính + cho phép thông báo) */
function badgeCount(){
  if(typeof DB==="undefined"||!DB.items)return 0;
  const nowM=mKey(new Date());let c=ordersOf(DB.items.filter(i=>i.status!=="kho")).filter(o=>o.stage==="ship").length;
  for(const x of cards().filter(x=>x.name)){const [st]=cardState(x,nowM);if(st==="late"||st==="soon")c++}
  return c;
}
let lastBadge=-1;
function appBadge(force){
  if(!("setAppBadge" in navigator))return;
  if(S().appBadge===false){if(lastBadge!==0){lastBadge=0;navigator.clearAppBadge&&navigator.clearAppBadge().catch(()=>{})}return}
  const c=badgeCount();if(c===lastBadge&&!force)return;lastBadge=c;
  (c?navigator.setAppBadge(c):navigator.clearAppBadge()).catch(()=>{});
}
setInterval(()=>appBadge(),5000);
document.addEventListener("visibilitychange",()=>{if(document.hidden)appBadge(true)});
(()=>{
  const box=document.createElement("div");box.className="card";box.id="badgeSet";
  box.innerHTML=`<h3 style="margin-top:0">🔴 Số trên biểu tượng app</h3><p class="muted" style="margin:0 0 8px;font-size:13.5px">Hiện số việc cần xử lý (đơn cần ship + thẻ sắp/quá hạn) trên biểu tượng app ở màn hình chính.</p><div class="row"><button type="button" class="btn" id="badgeBtn"></button><span class="muted" id="badgeSt" style="font-size:13px"></span></div>`;
  $("#mod-set").appendChild(box);
  const ui=()=>{
    const sup="setAppBadge" in navigator,perm=typeof Notification!=="undefined"?Notification.permission:"none",on=S().appBadge!==false;
    const b=$("#badgeBtn"),st=$("#badgeSt");
    if(!sup){b.style.display="none";st.textContent="Máy/trình duyệt này chưa hỗ trợ. Trên iPhone: mở app từ biểu tượng màn hình chính (iOS 16.4 trở lên).";return}
    b.style.display="";
    if(perm==="default"){b.textContent="Bật";st.textContent="Cần cho phép thông báo một lần."}
    else if(perm==="denied"){b.style.display="none";st.textContent="Thông báo đang bị chặn. Vào Cài đặt iPhone › Thông báo › Quản Lý để bật lại."}
    else{b.textContent=on?"Tắt":"Bật";st.textContent=on?`Đang bật · hiện ${badgeCount()}`:"Đang tắt"}
  };
  $("#badgeBtn").onclick=async()=>{
    if(typeof Notification!=="undefined"&&Notification.permission==="default"){try{await Notification.requestPermission()}catch(e){}S().appBadge=true}
    else S().appBadge=S().appBadge===false;
    save();appBadge(true);ui();
  };
  const rs=renderSet;renderSet=function(){rs.apply(this,arguments);ui()};
})();

/* 7) Biểu đồ tròn chi theo danh mục + bấm để xem chi tiết */
let pieSel=null;
function spCatData(){
  const by={},ids={};
  for(const e of expOf(spM))if(isChi(e)){const k=e.type==="co"?"📌 Chi cố định":e.cat||"Khác";by[k]=(by[k]||0)+n(e.amount);(ids[k]??=[]).push(e)}
  return {rows:Object.entries(by).filter(r=>r[1]>0).sort((a,b)=>b[1]-a[1]),ids};
}
const pieCol=i=>i<7?`var(--s${i+1})`:"var(--s0)";
function pieSvg(rows){
  const tot=rows.reduce((a,r)=>a+r[1],0),R=52,C=2*Math.PI*R,gap=rows.length>1?2:0;let off=0;
  const segs=rows.map(([k,v],i)=>{const L=v/tot*C,d=Math.max(.01,L-gap),s=`<circle class="pseg${pieSel&&pieSel!==k?" dim":""}${pieSel===k?" sel":""}" data-pk="${esc(k)}" r="${R}" cx="70" cy="70" stroke="${pieCol(i)}" stroke-dasharray="${d} ${C-d}" stroke-dashoffset="${-off}"><title>${esc(k)}: ${money(v)} (${Math.round(v/tot*100)}%)</title></circle>`;off+=L;return s}).join("");
  const sel=pieSel&&rows.find(r=>r[0]===pieSel);
  return `<svg viewBox="0 0 140 140" class="pie" role="img" aria-label="Chi theo danh mục"><g transform="rotate(-90 70 70)">${segs}</g><text x="70" y="64" class="pl">${sel?esc(sel[0].replace(/^📌 /,"").slice(0,14)):"Tổng chi"}</text><text x="70" y="84" class="pv">${money(sel?sel[1]:tot).replace(/\.\d\d$/,"")}</text></svg>`;
}
function pieDetail(ids){
  if(!pieSel||!ids[pieSel])return"";
  const arr=ids[pieSel].slice().sort((a,b)=>b.date.localeCompare(a.date));
  return `<div class="piedet"><div class="pdh"><b>${esc(pieSel)}</b><span class="muted">${arr.length} khoản</span><button type="button" class="mini" data-pclose>✕</button></div>${arr.map(e=>`<div class="pdr" data-pex="${e.id}"><span class="d">${dm(e.date)}</span><span class="t">${esc(e.note||e.cat||"")}</span><b>${money(n(e.amount))}</b></div>`).join("")}</div>`;
}
function renderPie(){
  const body=$("#spCatBody");if(!body)return;
  const {rows,ids}=spCatData();if(pieSel&&!ids[pieSel])pieSel=null;
  $("#spPie")?.remove();
  if(!rows.length)return;
  body.insertAdjacentHTML("afterbegin",`<div id="spPie"><div class="pwrap">${pieSvg(rows)}</div><p class="muted phint">Bấm vào một phần (hoặc một dòng bên dưới) để xem các khoản.</p>${pieDetail(ids)}</div>`);
  // chấm màu + bấm được cho các dòng Chi
  const keys=rows.map(r=>r[0]);if($("#spCatBody .pdot"))return;
  for(const r of [...$("#spCatBody").children]){if(r.matches(".spcr.tot"))break;if(!r.matches(".spcr"))continue;const k=r.querySelector(".k")?.textContent,i=keys.indexOf(k);if(i<0)continue;r.dataset.pk=k;r.classList.add("pick");r.classList.toggle("sel",pieSel===k);r.querySelector(".k").insertAdjacentHTML("afterbegin",`<i class="pdot" style="background:${pieCol(i)}"></i>`)}
}
$("#spCatBody").addEventListener("click",e=>{
  const ex=e.target.closest("[data-pex]");if(ex)return openExpense(ex.dataset.pex);
  if(e.target.closest("[data-pclose]")){pieSel=null;return renderSpend()}
  const p=e.target.closest("[data-pk]");if(!p)return;
  pieSel=pieSel===p.dataset.pk?null:p.dataset.pk;renderSpend();
  if(pieSel)setTimeout(()=>$("#spPie .piedet")?.scrollIntoView({behavior:"smooth",block:"nearest"}),50);
});
$("#spCat summary").textContent="📊 Biểu đồ & chi tiết theo danh mục";

/* 8) Nhập nhanh một dòng: "15 ăn trưa", "+200 bán đồ" */
const QK=[
  ["Ăn uống",["an","uong","an trua","an sang","an toi","com","pho","bun","banh mi","cafe","ca phe","coffee","tra sua","nha hang","do an","di cho","cho","grocery","groceries","pizza","starbucks","mcdonald","mcdonalds","hmart","lunch","dinner","breakfast","food"]],
  ["Xăng",["xang","gas","do xang","uber","lyft","parking","gui xe","toll","sua xe","rua xe","thay nhot","oil change","bus","xe"]],
  ["Hoá đơn",["dien","nuoc","tien dien","tien nuoc","internet","wifi","phone","dien thoai","bill","hoa don","bao hiem","insurance","cable"]],
  ["Nhà",["thue nha","tien nha","rent","nha"]],
  ["Sức khoẻ",["thuoc","bac si","doctor","pharmacy","cvs","walgreens","kham","nha khoa","dentist","gym","vitamin"]],
  ["Giải trí",["phim","movie","netflix","spotify","youtube","game","du lich","di choi","karaoke","nhau"]],
  ["Mua sắm",["walmart","target","amazon","costco","sam","mua","ao","quan","giay","shop","shopping","tjmaxx","ross"]],
];
const QPAIRS=QK.flatMap(([c,ws])=>ws.map(w=>[w,c])).sort((a,b)=>b[0].length-a[0].length);
function qCat(note){
  const t=" "+unacc(note).replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim()+" ";if(t.trim()==="")return null;
  // 1) đã từng ghi chú y hệt → dùng lại danh mục cũ
  const old=DB.expenses.slice().reverse().find(e=>e.note&&unacc(e.note).trim()===t.trim()&&DB.cats.includes(e.cat));if(old)return old.cat;
  for(const [w,c] of QPAIRS)if(t.includes(" "+w+" ")){const m=DB.cats.find(x=>unacc(x).startsWith(unacc(c)));if(m)return m}
  return null;
}
function qParse(s){
  const toks=String(s||"").trim().split(/\s+/).filter(Boolean);let amt=null,plus=false,rest=[];
  for(const t of toks){
    const m=amt==null&&t.match(/^([+-]?)\$?(\d{1,3}(?:,\d{3})+|\d+)(?:[.,](\d{1,2}))?\$?$/);
    if(m){amt=parseFloat(m[2].replace(/,/g,"")+(m[3]?"."+m[3]:""));plus=m[1]==="+";continue}
    rest.push(t);
  }
  const note=rest.join(" "),u=unacc(note);
  const type=plus||/^(thu|luong|hoan tien|refund)\b/.test(u)?"thu":"chi";
  return {amt,note,type,cat:qCat(note)};
}
(()=>{
  const f=$("#spForm");
  f.insertAdjacentHTML("afterbegin",`<div class="qwrap"><input name="quick" class="qin" placeholder="⚡ Nhập nhanh: 15 ăn trưa · +200 bán đồ" autocomplete="off" enterkeyhint="done"><div class="qprev muted" id="qPrev"></div></div>`);
  const q=f.quick,pv=$("#qPrev");
  q.addEventListener("input",()=>{
    const v=q.value.trim();if(!v){pv.textContent="";return}
    const r=qParse(v);
    if(r.amt==null||!(r.amt>0)){pv.innerHTML=`Gõ số tiền trước, vd. <b>15 ăn trưa</b>`;return}
    f.amount.value=r.amt;f.type.value=r.type;if(r.cat)f.cat.value=r.cat;f.note.value=r.note;spChips();
    pv.innerHTML=`→ <b class="${r.type==="thu"?"pos":""}">${r.type==="thu"?"Thu":"Chi"} ${money(r.amt)}</b> · ${esc(f.cat.value)}${r.note?` · “${esc(r.note)}”`:""} <span>· Enter để lưu</span>`;
  });
  f.addEventListener("submit",()=>{q.value="";pv.textContent=""});
})();

/* 9) Lịch tháng ở trang Giờ làm */
let calM=null;
function renderCal(){
  const box=$("#wkCal");if(!box)return;
  const mk=calM||monthOf(today()),calc=calcShifts(),t=today(),ws=n(S().weekStart);
  const [y,m]=mk.split("-").map(Number),first=`${mk}-01`,dim=new Date(y,m,0).getDate(),last=`${mk}-${String(dim).padStart(2,"0")}`;
  const lead=(parseD(first).getDay()-ws+7)%7,wk0=weekStartOf(t),wkEnd=addDays(wk0,6);
  const byD={};for(const s of DB.shifts){const c=calc[s.id]||{};const o=byD[s.date]??={h:0,ot:0,hol:0,pto:0};o.h+=c.h||0;o.ot+=c.ot||0;o.hol+=c.hol||0;o.pto+=c.pto||0}
  // ngày nhận check trong tháng
  const pays=new Map(),ratio=netRatio(calc);{let k=Math.floor((dayDiff(first,payStart())-PAY_LAG)/14)-1;for(let i=0;i<5;i++,k++){const pp=payPeriod(k);if(pp.pay>=first&&pp.pay<=last)pays.set(pp.pay,payNet(pp,calc,ratio))}}
  const f1=v=>{v=+(+v).toFixed(1);return v%1?v.toFixed(1):String(v)},lim=n(S().otAfter)||40;
  const payLab=p=>p.v>0?(p.v>=1000?"$"+(p.v/1000).toFixed(1).replace(/\.0$/,"")+"k":"$"+Math.round(p.v))+(p.est?"":" ✓"):"Lương";
  let h=`<div class="calh"><button type="button" class="btn" data-cm="-1" aria-label="Tháng trước">‹</button><b>${mLabel(mk)}</b><button type="button" class="btn" data-cm="1" aria-label="Tháng sau">›</button></div><div class="wcw">`;
  for(let k=0;k<7;k++)h+=`<span>${DOW[(ws+k)%7]}</span>`;
  h+=`</div>`;
  // mỗi tuần một thẻ; tổng tuần tính cả 7 ngày (kể cả ngày thuộc tháng bên cạnh), khớp cách tính OT
  for(let w0=addDays(first,-lead);w0<=last;w0=addDays(w0,7)){
    const we=addDays(w0,6),W={h:0,ot:0,hol:0,pto:0};
    for(let k=0;k<7;k++){const o=byD[addDays(w0,k)];if(o){W.h+=o.h;W.ot+=o.ot;W.hol+=o.hol;W.pto+=o.pto}}
    // đầu thẻ: tổng giờ được trả = thường + OT + Holiday + PTO; thanh chia màu, vạch ở mốc OT
    const rg=W.h-W.ot,tot=W.h+W.hol+W.pto,sc=Math.max(lim,tot),pc=v=>(v/sc*100).toFixed(2)+"%";
    const seg=[["rg",rg,"thường"],["ot",W.ot,"OT"],["hol",W.hol,"Holiday"],["pto",W.pto,"PTO"]].filter(x=>x[1]>0.001);
    h+=`<div class="wk${W.ot>0?" r":""}${w0===wk0?" now":""}"><div class="wkt"><span class="rg">${dm(w0)} – ${dm(we)}</span><b>${f1(tot)}<small>h</small></b></div><div class="wkb">${seg.map(x=>`<i class="${x[0]}" style="width:${pc(x[1])}"></i>`).join("")}<u style="left:${pc(lim)}" title="${lim}h"></u></div>${seg.length?`<div class="wks">${seg.map((x,k)=>`${k?`<s>+</s>`:""}<span class="${x[0]}"><i></i>${f1(x[1])} ${x[2]}</span>`).join("")}</div>`:""}<div class="wkg">`;
    for(let k=0;k<7;k++){const ds=addDays(w0,k);
      if(ds<first||ds>last){h+=`<span></span>`;continue}
      const o=byD[ds]||{h:0,ot:0,hol:0,pto:0},tot=o.h+o.hol+o.pto,pay=pays.get(ds);
      const ty=o.ot>0?"ot":o.h>0?"w":o.hol>0?"hol":o.pto>0?"pto":ds<t?"off":"fut";
      const sub=o.ot>0?`+${f1(o.ot)} OT`:o.h>0&&o.hol?"+Holiday":o.h>0&&o.pto?"+PTO":ty==="hol"?"Holiday":ty==="pto"?"PTO":"";
      h+=`<button type="button" class="dc ${ty}${ds===t?" td":""}${pay?" pay":""}" data-cd="${ds}" title="${pay?`Ngày nhận check · ${pay.est?"ước tính ":""}${money(pay.v)}`:""}">${pay?`<i class="pm">${payLab(pay)}</i>`:""}<span class="n">${+ds.slice(8)}</span><span class="p">${tot?f1(tot):ty==="fut"?"·":""}</span><span class="o">${sub}</span></button>`}
    h+=`</div></div>`}
  h+=`<div class="calk"><span><i class="k w"></i>Ca làm</span><span><i class="k ot"></i>OT</span><span><i class="k hol"></i>Holiday</span><span><i class="k pto"></i>PTO</span><span><i class="k pay"></i>Lương</span></div>`;
  box.innerHTML=h;
  renderMonthChecks(mk,calc);
}
$("#mod-work").addEventListener("click",e=>{
  const nav=e.target.closest("#wkCal [data-cm]");if(nav){calM=mShift(calM||monthOf(today()),+nav.dataset.cm);return renderWork()}
  const c=e.target.closest("#wkCal [data-cd]");if(!c)return;
  const d=c.dataset.cd;
  if(c.classList.contains("pay"))return openPay(d);
  const ss=DB.shifts.filter(s=>s.date===d).sort((a,b)=>(isLeave(a)-isLeave(b))||String(a.start).localeCompare(String(b.start)));
  ss.length?openShift(ss[0].id):openShift(null,d);
});
{const rw=renderWork;renderWork=function(){if(!calM)calM=monthOf(today());const r=rw.apply(this,arguments);renderCal();return r}}
{const rs=renderSpend;renderSpend=function(){const r=rs.apply(this,arguments);renderPie();return r}}

/* eBay cả năm theo tháng (Tổng quan) */
let ebY=null,ebYOpen=false;
function ebYear(yr){
  const ms=Array.from({length:12},(_,i)=>`${yr}-${String(i+1).padStart(2,"0")}`);
  const rows=ms.map(mk=>{
    const sold=DB.items.filter(i=>i.status==="ban"&&monthOf(i.saleDate)===mk),ret=DB.items.filter(i=>i.status==="tra"&&monthOf(i.saleDate)===mk);
    const s=k=>sold.reduce((a,i)=>a+k(i),0);
    return {mk,orders:ordersOf(sold).length,items:sold.length,sale:s(i=>n(i.price)+chargeShare(i)),fees:s(i=>n(i.fees)),ship:s(shipShare),cost:s(i=>n(i.cost)),profit:s(i=>profit(i)||0),ret:ret.length,refund:ret.reduce((a,i)=>a+n(i.refund),0)};
  });
  const T=rows.reduce((a,r)=>{for(const k in r)if(k!=="mk")a[k]=(a[k]||0)+r[k];return a},{});
  return {rows,T};
}
function ebYearHtml(){
  const yrs=[...new Set(DB.items.filter(i=>i.status!=="kho"&&i.saleDate).map(i=>+i.saleDate.slice(0,4)))].sort(),cy=new Date().getFullYear();
  if(!ebY)ebY=cy;
  const {rows,T}=ebYear(ebY),now=mKey(new Date()),act=rows.filter(r=>r.items||r.ret);
  const mx=Math.max(1,...rows.map(r=>Math.abs(r.profit))),best=act.length?act.reduce((a,r)=>r.profit>a.profit?r:a):null;
  const nm=act.length?rows.filter(r=>r.mk<=now||r.items).length:0;
  const canP=yrs.some(y=>y<ebY),canN=ebY<Math.max(cy,...yrs);
  const row=r=>`<button type="button" class="eyr${r.items||r.ret?"":" z"}" data-eym="${r.mk}"${r.items||r.ret?"":" disabled"}><span class="m">T${+r.mk.slice(5)}</span><span class="pb"><i class="${r.profit<0?"neg":""}" style="width:${Math.abs(r.profit)/mx*100}%"></i></span><b class="${r.profit>=0?"pos":"neg"}">${r.items||r.ret?money(r.profit):"—"}</b>${r.items||r.ret?`<small>${r.orders} đơn · bán ${money(r.sale)} · phí ${money(r.fees)} · ship ${money(r.ship)} · vốn ${money(r.cost)}</small>`:""}</button>`;
  return `<details class="ebyd"${ebYOpen?" open":""}><summary><span>📦 eBay cả năm ${ebY}</span><b class="${T.profit>=0?"pos":"neg"}">${money(T.profit)}</b><span class="chev">▾</span></summary>
  <div class="eyh"><button type="button" class="btn" data-ey="-1"${canP?"":" disabled"}>‹</button><b>${ebY}</b><button type="button" class="btn" data-ey="1"${canN?"":" disabled"}>›</button><button type="button" class="btn" id="eyCsv">⬇ Tải CSV</button></div>
  ${act.length?`<div class="eyl">${rows.map(row).join("")}</div>
  <div class="eyt"><div><span>Đơn</span><b>${T.orders}</b></div><div><span>Tiền bán</span><b>${money(T.sale)}</b></div><div><span>Phí eBay</span><b>−${money(T.fees)}</b></div><div><span>Ship bạn trả</span><b>−${money(T.ship)}</b></div><div><span>Vốn</span><b>−${money(T.cost)}</b></div><div class="big"><span>Lãi cả năm</span><b class="${T.profit>=0?"pos":"neg"}">${money(T.profit)}</b></div></div>
  <p class="muted eyn">TB mỗi tháng <b>${money(nm?T.profit/nm:0)}</b>${best&&best.profit>0?` · cao nhất <b>T${+best.mk.slice(5)}</b> (${money(best.profit)})`:""}<br>Bấm một tháng để xem các đơn đã bán.</p>`
  :`<p class="muted">Năm ${ebY} chưa có đơn bán.</p>`}</details>`;
}
function ebYearCsv(){
  const {rows,T}=ebYear(ebY),f=v=>(Math.round(v*100)/100).toFixed(2);
  const L=[["Thang","So don","So mon","Tien ban","Phi eBay","Ship tra","Von","Lai"].join(",")];
  for(const r of rows)L.push([r.mk,r.orders,r.items,f(r.sale),f(r.fees),f(r.ship),f(r.cost),f(r.profit)].join(","));
  L.push(["Tong "+ebY,T.orders,T.items,f(T.sale),f(T.fees),f(T.ship),f(T.cost),f(T.profit)].join(","));
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["﻿"+L.join("\r\n")],{type:"text/csv"}));a.download=`ebay-${ebY}.csv`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);
}
(()=>{
  $("#homeYear").insertAdjacentHTML("afterend",`<div class="card hsec" id="homeEbY"></div>`);
  const box=$("#homeEbY");
  box.addEventListener("toggle",e=>{if(e.target.matches("details.ebyd"))ebYOpen=e.target.open},true);
  box.addEventListener("click",e=>{
    const y=e.target.closest("[data-ey]");if(y){ebY+=+y.dataset.ey;box.innerHTML=ebYearHtml();return}
    if(e.target.closest("#eyCsv"))return ebYearCsv();
    const m=e.target.closest("[data-eym]");if(!m)return;
    $("#q").value="";showMod("ebay");$("#ebMonth").value=m.dataset.eym;$('#ebTabs [data-eb="done"]').click();scrollTo({top:0});
  });
  const rh=renderHome;renderHome=function(){const r=rh.apply(this,arguments);box.innerHTML=ebYearHtml();return r};
})();

/* Khung Check: bấm ngày lương trên lịch để xem kỳ và nhập số thực nhận thật */
let pcCur=null;
function openPay(payDate){
  const k=Math.round((dayDiff(payDate,payStart())-PAY_LAG)/14),pp=payPeriod(k);if(pp.pay!==payDate)return;
  pcCur=pp;const calc=calcShifts(),c=periodSum(pp,calc),e=payRec(pp),has=payHas(e),est=c.pay*netRatio(calc);
  $("#pcTitle").textContent=`💵 Check ${dowl(pp.pay)} ${dmy(pp.pay)}`;
  $("#pcInfo").innerHTML=`<div class="pci"><div><span>Kỳ lương</span><b>${dmy(pp.st)} – ${dmy(pp.en)}</b></div><div><span>Giờ thường</span><b>${fh(c.reg)}</b></div><div><span>Giờ OT</span><b class="${c.ot>0?"neg":""}">${fh(c.ot)}</b></div>${c.hol?`<div><span>Holiday</span><b>${fh(c.hol)}</b></div>`:""}${c.pto?`<div><span>PTO</span><b>${fh(c.pto)}</b></div>`:""}<div><span>Trước thuế</span><b>${money(c.pay)}</b></div><div><span>${has?"Đã nhập":"Ước tính thực nhận"}</span><b class="pos">${has?money(n(e.amount)):"~"+money(est)}</b></div></div>`;
  const f=$("#pcForm");f.net.value=has?e.amount:"";f.net.placeholder=est.toFixed(2);
  $("#pcClear").style.display=has?"":"none";
  $("#pcShift").textContent=DB.shifts.some(s=>s.date===payDate)?"✏️ Sửa ca ngày này":"+ Thêm ca ngày này";
  $("#pcDlg").showModal();
}
function pcSave(v){
  const pp=pcCur;if(!pp)return;let e=payRec(pp);
  if(!e){if(v==="")return;e={id:"pay_"+pp.st,type:"pay",st:pp.st,date:pp.pay,cat:"💵 Lương",note:"Check lương",amount:""};DB.expenses.push(e)}
  e.amount=v===""?"":n(v);e.gross=periodSum(pp,calcShifts()).pay;save();
}
$("#pcForm").onsubmit=ev=>{ev.preventDefault();pcSave($("#pcForm").net.value.trim());$("#pcDlg").close();renderWork();typeof toast==="function"&&toast("Đã lưu số thực nhận")};
$("#pcClear").onclick=()=>{pcSave("");$("#pcDlg").close();renderWork()};
$("#pcShift").onclick=()=>{const d=pcCur&&pcCur.pay;$("#pcDlg").close();if(!d)return;const ss=DB.shifts.filter(s=>s.date===d).sort((a,b)=>(isLeave(a)-isLeave(b))||String(a.start).localeCompare(String(b.start)));ss.length?openShift(ss[0].id):openShift(null,d)};

/* Thẻ Check theo tháng của lịch: mỗi check nhận trong tháng 1 dòng, bấm để nhập số thật */
function renderMonthChecks(mk,calc){
  const box=$("#wkCheck");if(!box)return;
  const first=`${mk}-01`,ratio=netRatio(calc),rows=[];
  let k=Math.floor((dayDiff(first,payStart())-PAY_LAG)/14)-1;
  for(let i=0;i<5;i++,k++){const pp=payPeriod(k);if(monthOf(pp.pay)===mk)rows.push(pp)}
  let tot=0,anyEst=false;
  const body=rows.map(pp=>{const q=payNet(pp,calc,ratio);tot+=q.v;if(q.est)anyEst=true;
    return `<button type="button" class="mcr${q.est?"":" got"}" data-pay="${pp.pay}"><span class="d">${dowl(pp.pay)} ${dmy(pp.pay)}</span><span class="k">kỳ ${dmy(pp.st)}–${dmy(pp.en)}</span><b class="${q.est?"est":"pos"}">${q.est&&!q.v?"—":(q.est?"~":"")+money(q.v)+(q.est?"":" ✓")}</b></button>`}).join("");
  box.innerHTML=`<div class="mch"><span>💵 Check ${mLabel(mk).toLowerCase()}</span><b class="pos">${rows.length&&tot>0?(anyEst?"~":"")+money(tot):"—"}</b></div>${body||`<p class="muted" style="margin:4px 0 0">Không có check trong tháng này.</p>`}`;
}
$("#wkCheck").addEventListener("click",e=>{const r=e.target.closest("[data-pay]");if(r)openPay(r.dataset.pay)});

/* Cài đặt: chia nhóm, mỗi mục thu gọn, bấm tiêu đề mới mở (mở 1 mục 1 lúc) */
(()=>{
  const box=$("#mod-set");if(!box)return;
  const cards=[...box.querySelectorAll(":scope>.card")],ttl=c=>(c.querySelector("h3")||{}).textContent||"";
  const G=[["Lương & chi tiêu",["Lương","Chi cố định","Thẻ tín dụng"]],["eBay",["Phí eBay"]],["Dữ liệu",["Đồng bộ","Sao lưu"]],["Ứng dụng",["Giao diện","Số trên biểu tượng"]]];
  const used=new Set(),anchor=$("#appVer");
  for(const [g,ks] of G){
    const hd=document.createElement("div");hd.className="setgrp";hd.textContent=g;
    box.insertBefore(hd,anchor);
    for(const k of ks){const c=cards.find(x=>!used.has(x)&&ttl(x).includes(k));if(c){used.add(c);box.insertBefore(c,anchor)}}
  }
  for(const c of cards)if(!used.has(c))box.insertBefore(c,anchor); // mục khác (nếu có) cuối nhóm Ứng dụng
  for(const c of cards){const h=c.querySelector("h3");if(!h)continue;c.classList.add("acc");h.classList.add("acch");h.setAttribute("role","button");h.tabIndex=0;h.insertAdjacentHTML("beforeend",'<span class="accs"></span><span class="accv">›</span>')}
  const tog=c=>{const o=!c.classList.contains("open");cards.forEach(x=>x.classList.remove("open"));if(o){c.classList.add("open");setTimeout(()=>c.scrollIntoView({block:"start",behavior:"smooth"}),30)}};
  box.addEventListener("click",e=>{const h=e.target.closest(".acch");if(h)tog(h.closest(".acc"))});
  box.addEventListener("keydown",e=>{const h=e.target.closest(".acch");if(h&&(e.key==="Enter"||e.key===" ")){e.preventDefault();tog(h.closest(".acc"))}});
  // nút "đi tới cài đặt" ở trang khác: mở luôn mục đó
  window.openSet=id=>{const c=$("#"+id);if(c&&!c.classList.contains("open"))tog(c)};
  document.addEventListener("click",e=>{const b=e.target.closest("#fxGo,#ccGo");if(b)setTimeout(()=>openSet(b.id==="fxGo"?"fxSet":"cardSet"),0)});
  // tóm tắt giá trị hiện tại cạnh tiêu đề
  const sums=()=>{
    const put=(k,t)=>{const c=cards.find(x=>ttl(x).includes(k));if(c){const s=c.querySelector(".accs");if(s)s.textContent=t||""}};
    try{put("Lương",`$${n(S().wage)}/h · OT sau ${n(S().otAfter)||40}h`)}catch(e){}
    try{put("Chi cố định",`${fxTpl().length} khoản`)}catch(e){}
    try{put("Thẻ tín dụng",`${cards_().length} thẻ`)}catch(e){}
    try{const t=($("#cloudSt")||{}).textContent||"";put("Đồng bộ",/Đã kết nối/.test(t)?"Đã kết nối":"Chưa kết nối")}catch(e){}
    try{put("Phí eBay",$("#pct")&&$("#pct").value?$("#pct").value+"%":"")}catch(e){}
    try{put("Giao diện",S().theme==="light"?"Sáng":S().theme==="dark"?"Tối":"Tự động")}catch(e){}
    try{put("Số trên biểu tượng",S().appBadge?"Bật":"Tắt")}catch(e){}
  };
  const cards_=()=>Array.isArray(S().cards)?S().cards:[];
  const rs=renderSet;renderSet=function(){const r=rs.apply(this,arguments);sums();return r};
  sums();
})();

/* Tổng kết tháng: 10 ngày đầu tháng mới hiện thẻ tổng kết tháng trước ở Tổng quan; bấm ✕ để ẩn */
function recapHtml(mk){
  const calc=calcShifts(),s=monthStats(mk,calc),p=monthStats(mShift(mk,-1),calc),pm=mShift(mk,-1);
  const inc=x=>x.ebay+x.wage+x.thu,cmp=(a,b,good)=>{if(!b)return "";const d=Math.round((a-b)/Math.abs(b)*100);if(!d)return `<small class="rc">=</small>`;const up=d>0,ok=good?up:!up;return `<small class="rc ${ok?"up":"dn"}">${up?"▲":"▼"}${Math.abs(d)}%</small>`};
  // chi theo danh mục (top 3)
  const by=new Map();for(const e of DB.expenses)if(isChi(e)&&monthOf(e.date)===mk){const k=e.type==="co"?"Chi cố định":(e.cat||"Khác");by.set(k,(by.get(k)||0)+n(e.amount))}
  const top=[...by].sort((a,b)=>b[1]-a[1]).slice(0,3);
  // món lãi nhất
  const best=DB.items.filter(i=>i.status==="ban"&&monthOf(i.saleDate)===mk).sort((a,b)=>profit(b)-profit(a))[0];
  const ot=DB.shifts.filter(x=>monthOf(x.date)===mk).reduce((a,x)=>a+((calc[x.id]||{}).ot||0),0);
  const save=s.net,rate=inc(s)>0?Math.round(save/inc(s)*100):0;
  const row=(l,v,c,sub="")=>`<div class="rr"><span>${l}${sub?`<small>${sub}</small>`:""}</span><b class="${v<0?"neg":""}">${money(v)}</b>${c}</div>`;
  return `<div class="card recap" id="homeRecap"><button type="button" class="rx" data-rx aria-label="Ẩn">✕</button>
    <div class="rh">Tổng kết ${mLabel(mk).toLowerCase()}</div>
    <div class="rbig"><span>Để dành được</span><b class="${save>=0?"pos":"neg"}">${money(save)}</b>${cmp(save,p.net,true)}<em>${inc(s)>0?`${rate}% thu nhập`:""}</em></div>
    <div class="rrows">
      ${row("Lương thực nhận",s.wage,cmp(s.wage,p.wage,true),s.hrs?`${+s.hrs.toFixed(1)} giờ${ot?` · ${+ot.toFixed(1)} giờ OT`:""}`:"")}
      ${row("Lãi eBay",s.ebay,cmp(s.ebay,p.ebay,true),s.sold?`${s.sold} món`:"")}
      ${s.thu?row("Thu khác",s.thu,cmp(s.thu,p.thu,true)):""}
      ${row("Chi tiêu",-s.chi,cmp(s.chi,p.chi,false))}
    </div>
    ${top.length?`<div class="rtop"><div class="rl">Chi nhiều nhất</div>${top.map(([k,v])=>`<div><span>${esc(k)}</span><b>${money(v)}</b></div>`).join("")}</div>`:""}
    ${best&&profit(best)>0?`<div class="rbest">Món lãi nhất: <b>${esc(best.name||"")}</b> <span class="pos">+${money(profit(best))}</span></div>`:""}
    <div class="rfoot">so với ${mLabel(pm).toLowerCase()}</div></div>`;
}
{
  const rh=renderHome;renderHome=function(){const r=rh.apply(this,arguments);
    const old=$("#homeRecap");if(old)old.remove();
    const t=today(),pm=mShift(monthOf(t),-1),day=+t.slice(8);
    const show=window.RECAP_FORCE||(day<=10&&S().recapSeen!==pm);
    if(show)$("#homeTodo").insertAdjacentHTML("beforebegin",recapHtml(pm));
    return r};
  document.addEventListener("click",e=>{if(e.target.closest("[data-rx]")){S().recapSeen=mShift(monthOf(today()),-1);save();const c=$("#homeRecap");c&&c.remove()}});
}

/* Giao diện: thanh tab nổi kiểu iOS (viên trượt theo tab), chuyển tab trượt theo hướng, số tiền đếm lên khi mở tab */
{
  const still=()=>matchMedia("(prefers-reduced-motion: reduce)").matches,mob=()=>matchMedia("(max-width:760px)").matches;
  const side=$("#side"),pill=document.createElement("i");pill.className="tpill";side.appendChild(pill);
  const MODS=["home","ebay","spend","work","set"],cur=()=>(($$("#side button.on")[0]||{}).dataset||{}).mod||"home";
  let pillOn=false;
  function movePill(){const b=$("#side button.on");if(!b||!mob()){pill.style.opacity=0;return}
    if(!pillOn){pill.style.transition="none";requestAnimationFrame(()=>pill.style.transition="")}pillOn=true;
    pill.style.opacity=1;pill.style.width=b.offsetWidth+"px";pill.style.transform=`translateX(${b.offsetLeft}px)`}
  addEventListener("resize",movePill);
  // số tiền đếm lên (chỉ khi vừa mở tab, không chạy lúc đang gõ)
  const RX=/^(-?)\$([\d,]+\.\d{2})$/;
  window.countMoney=function(root){
    if(still()||!root)return;const els=[];
    for(const el of root.querySelectorAll("b,.v,strong,.big,.amt")){
      if(els.length>=40)break;if(el.children.length||el.closest("[data-count],input,.emp"))continue;
      const t=el.textContent.trim(),m=t.match(RX);if(!m)continue;const v=+m[2].replace(/,/g,"");if(!v)continue;
      const r=el.getBoundingClientRect();if(!r.width||r.top>innerHeight)continue;els.push([el,t,v*(m[1]?-1:1)]);
    }
    if(!els.length)return;const t0=performance.now(),D=650;
    const step=t=>{const p=Math.min(1,Math.max(0,(t-t0)/D)),e=1-Math.pow(1-p,3);
      for(const [el,t,v] of els)if(el.isConnected)el.textContent=p<1?money(v*e):t;
      if(p<1)requestAnimationFrame(step)};
    requestAnimationFrame(step);
  };
  const slide=(el,dir)=>{if(!el||still()||!dir)return;el.style.animation="none";
    el.animate([{opacity:0,transform:`translateX(${dir*28}px)`},{opacity:1,transform:"none"}],{duration:280,easing:"cubic-bezier(.2,.8,.2,1)"})};
  const sm=showMod;showMod=function(m){
    const from=cur(),r=sm.apply(this,arguments);movePill();
    if(from!==m){const d=Math.sign(MODS.indexOf(m)-MODS.indexOf(from)),el=$("#mod-"+m);slide(el,d);setTimeout(()=>countMoney($("#mod-"+m)),30)}
    return r};
  $$("#side button").forEach(b=>b.onclick=()=>showMod(b.dataset.mod));
  // tab con của eBay: trượt theo hướng + đếm số
  const EB=["kho","ship","go","done"];
  $$("#ebTabs [data-eb]").forEach(b=>b.addEventListener("click",()=>{
    const d=Math.sign(EB.indexOf(b.dataset.eb)-EB.indexOf(window.__ebPrev||ebTab));window.__ebPrev=b.dataset.eb;
    if(d){slide($("#sum"),d);slide($("#list"),d);slide($("#empty"),d);setTimeout(()=>countMoney($("#sum")),30)}
  },true));
  requestAnimationFrame(movePill);setTimeout(movePill,300);
}

/* ===== Ghi khoản nhanh: bảng trượt lên (bàn phím số riêng, danh mục có icon, Chi/Thu, ngày),
   gợi ý nơi mua, mẫu 1 chạm, lặp lại khoản trước, hoàn tác ===== */
const CATIC=[["an uong","🍜"],["an","🍜"],["cho","🛒"],["grocer","🛒"],["xang","⛽"],["di lai","🚗"],["hoa don","🧾"],["nha","🏠"],["thue","🏠"],["mua sam","🛍️"],["suc khoe","💊"],["giai tri","🎬"],["con","🧸"],["gia dinh","👪"],["qua","🎁"],["luong","💵"],["thu","💵"],["khac","📦"]];
function catIc(c){const u=unacc(c);for(const [k,i] of CATIC)if(u.startsWith(k)||u.includes(" "+k))return i;return "🏷️"}
function catOrder(type){const since=addDays(today(),-90),cnt={};
  for(const e of DB.expenses)if(e.type===type&&e.date>=since)cnt[e.cat]=(cnt[e.cat]||0)+1;
  return [...new Set([...Object.keys(cnt).filter(c=>DB.cats.includes(c)).sort((a,b)=>cnt[b]-cnt[a]),...DB.cats])]}
// nơi mua / ghi chú đã dùng: gom theo chữ không dấu, nhớ danh mục hay đi kèm
function noteBook(){const m=new Map();
  for(const e of DB.expenses){const t=(e.note||"").trim();if(!t)continue;const k=unacc(t);const o=m.get(k)||{note:t,n:0,cats:{},last:""};
    o.n++;o.cats[e.cat]=(o.cats[e.cat]||0)+1;if(e.date>=o.last){o.last=e.date;o.note=t;o.type=e.type}m.set(k,o)}
  return [...m.values()].map(o=>({...o,cat:Object.keys(o.cats).sort((a,b)=>o.cats[b]-o.cats[a])[0]}));}
function noteSug(q,type){const u=unacc(q.trim());let a=noteBook().filter(o=>(o.type||"chi")===type);
  if(u)a=a.filter(o=>{const k=unacc(o.note);return k!==u&&(k.startsWith(u)||k.includes(" "+u))});
  return a.sort((x,y)=>y.n-x.n||y.last.localeCompare(x.last)).slice(0,5)}
// mẫu: cùng danh mục + số tiền + nơi mua, ghi ≥2 lần trong 120 ngày
function qaTemplates(){const since=addDays(today(),-120),m=new Map();
  for(const e of DB.expenses){if(e.type!=="chi"||e.date<since)continue;const k=e.cat+"|"+n(e.amount)+"|"+unacc(e.note||"");const o=m.get(k)||{cat:e.cat,amount:n(e.amount),note:(e.note||"").trim(),n:0,last:""};o.n++;if(e.date>=o.last)o.last=e.date;m.set(k,o)}
  return [...m.values()].filter(o=>o.n>=2).sort((a,b)=>b.n-a.n||b.last.localeCompare(a.last)).slice(0,4)}
function addExpense(x,label){
  const e={id:uid(),date:x.date||today(),type:x.type||"chi",amount:n(x.amount),cat:x.cat,note:(x.note||"").trim()};
  DB.expenses.push(e);save();if(typeof spM!=="undefined")spM=monthOf(e.date);
  const re=()=>{const m=curMod();if(m==="spend")renderSpend();else if(m==="home")renderHome();else if(typeof renderToday==="function"&&m==="today")renderToday()};re();
  toast(`${label||"Đã thêm"} ${e.type==="thu"?"+":""}${money(e.amount)} · ${e.cat}${e.note?" · "+e.note:""}`,()=>{const i=DB.expenses.findIndex(y=>y.id===e.id);if(i>=0){DB.expenses.splice(i,1);save();re()}});
  return e}
function qaShort(){const box=$("#qaShort");if(!box)return;
  const t=qaTemplates(),last=DB.expenses[DB.expenses.length-1];
  const chip=(o,k,lab)=>`<button type="button" class="qsc" data-qt="${k}"><span>${catIc(o.cat)}</span><b>${money(o.amount)}</b><em>${esc(lab||o.note||o.cat)}</em></button>`;
  box.innerHTML=(last?chip(last,"last","↻ "+(last.note||last.cat)):"")+t.filter(o=>!last||!(o.cat===last.cat&&o.amount===n(last.amount)&&unacc(o.note)===unacc(last.note||""))).map((o,i)=>chip(o,i)).join("");
  box.classList.toggle("hidden",!box.innerHTML);box._t=t;box._last=last}
document.addEventListener("click",e=>{const b=e.target.closest("[data-qt]");if(!b)return;const box=b.closest(".qashort");
  const k=b.dataset.qt,o=k==="last"?box._last:box._t[+k];if(!o)return;
  addExpense({type:k==="last"?o.type:"chi",amount:o.amount,cat:o.cat,note:o.note,date:today()},k==="last"?"Đã ghi lại":"Đã thêm");
  if(box.id==="qaSheetShort")qaClose()});

{
  document.body.insertAdjacentHTML("beforeend",`<div id="qaSheet" class="qas hidden" aria-hidden="true"><div class="qas-bd" data-qax></div>
  <div class="qas-p" role="dialog" aria-label="Ghi khoản">
    <div class="qas-g"></div>
    <div class="qas-top"><div class="qas-seg"><button type="button" data-qty="chi" class="on">Chi</button><button type="button" data-qty="thu">Thu</button></div><button type="button" class="qas-x" data-qax aria-label="Đóng">✕</button></div>
    <div class="qas-amt" id="qaAmt"><span>$</span><b>0</b></div>
    <div class="qas-note"><input id="qaNote" placeholder="Nơi mua / ghi chú (tuỳ chọn)" autocomplete="off" enterkeyhint="done"><div class="qas-sug" id="qaSug"></div></div>
    <div class="qashort qas-short" id="qaSheetShort"></div>
    <div class="qas-cats" id="qaCats"></div>
    <div class="qas-days" id="qaDays"><button type="button" data-qd="0" class="on">Hôm nay</button><button type="button" data-qd="-1">Hôm qua</button><label class="qas-dp"><span id="qaDpL">📅 Ngày khác</span><input type="date" id="qaDate"></label></div>
    <div class="qas-kp" id="qaKp">${["1","2","3","4","5","6","7","8","9",".","0","⌫"].map(k=>`<button type="button" data-qk="${k}">${k}</button>`).join("")}</div>
    <button type="button" class="btn primary qas-save" id="qaSave" disabled>Lưu</button>
  </div></div>`);
  const sh=$("#qaSheet"),st={type:"chi",amt:"",cat:"",date:today(),catHand:false};
  const amtV=()=>parseFloat(st.amt||"0")||0;
  function paint(){
    $$("#qaSheet [data-qty]").forEach(b=>b.classList.toggle("on",b.dataset.qty===st.type));
    sh.classList.toggle("thu",st.type==="thu");
    const a=st.amt||"0",[i,d]=a.split(".");$("#qaAmt b").textContent=(+i).toLocaleString("en-US")+(d!==undefined?"."+d:"");
    const cats=catOrder(st.type);if(!st.cat||!DB.cats.includes(st.cat))st.cat=cats[0]||"Khác";
    $("#qaCats").innerHTML=cats.map(c=>`<button type="button" data-qc="${esc(c)}" class="${c===st.cat?"on":""}"><span>${catIc(c)}</span><em>${esc(c)}</em></button>`).join("");
    const t=today(),y=addDays(t,-1);$$("#qaDays [data-qd]").forEach(b=>b.classList.toggle("on",addDays(t,+b.dataset.qd)===st.date));
    const other=st.date!==t&&st.date!==y;$(".qas-dp").classList.toggle("on",other);$("#qaDpL").textContent=other?"📅 "+dm(st.date):"📅 Ngày khác";
    const v=amtV();$("#qaSave").disabled=!(v>0);$("#qaSave").textContent=v>0?`Lưu ${st.type==="thu"?"+":""}${money(v)} · ${st.cat}`:"Nhập số tiền";
    sug();
  }
  function sug(){const q=$("#qaNote").value,a=noteSug(q,st.type);
    $("#qaSug").innerHTML=a.map((o,i)=>`<button type="button" data-qs="${i}"><span>${catIc(o.cat)}</span>${esc(o.note)}</button>`).join("");$("#qaSug")._a=a;
    const sbox=$("#qaSheetShort");if(st.type==="chi"&&!st.amt&&!q){qaShortInto(sbox)}else sbox.innerHTML="";sbox.classList.toggle("hidden",!sbox.innerHTML)}
  function qaShortInto(box){const t=qaTemplates();box._t=t;box._last=null;box.innerHTML=t.map((o,i)=>`<button type="button" class="qsc" data-qt="${i}"><span>${catIc(o.cat)}</span><b>${money(o.amount)}</b><em>${esc(o.note||o.cat)}</em></button>`).join("")}
  window.qaOpen=(type)=>{st.type=type||"chi";st.amt="";st.cat="";st.catHand=false;st.date=today();$("#qaNote").value="";
    try{const c=localStorage.getItem("lastCat");if(c&&DB.cats.includes(c)&&st.type==="chi")st.cat=c}catch(e){}
    if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
    sh.classList.remove("hidden");sh.setAttribute("aria-hidden","false");requestAnimationFrame(()=>sh.classList.add("on"));document.documentElement.classList.add("qa-lock");paint()};
  window.qaClose=()=>{sh.classList.remove("on");sh.setAttribute("aria-hidden","true");document.documentElement.classList.remove("qa-lock");$("#qaNote").blur();setTimeout(()=>sh.classList.add("hidden"),220)};
  sh.addEventListener("click",e=>{
    if(e.target.closest("[data-qax]")){qaClose();return}
    const ty=e.target.closest("[data-qty]");if(ty){st.type=ty.dataset.qty;st.cat="";st.catHand=false;paint();return}
    const k=e.target.closest("[data-qk]");if(k){const v=k.dataset.qk;let a=st.amt;
      if(v==="⌫")a=a.slice(0,-1);else if(v==="."){if(!a.includes("."))a=(a||"0")+"."}
      else{const [i,d]=a.split(".");if(d!==undefined){if(d.length<2)a+=v}else if(i.length<7)a=(a==="0"?"":a)+v}
      st.amt=a;navigator.vibrate&&navigator.vibrate(6);paint();return}
    const c=e.target.closest("[data-qc]");if(c){st.cat=c.dataset.qc;st.catHand=true;try{if(st.type==="chi")localStorage.setItem("lastCat",st.cat)}catch(x){}paint();return}
    const d=e.target.closest("[data-qd]");if(d){st.date=addDays(today(),+d.dataset.qd);paint();return}
    const s=e.target.closest("[data-qs]");if(s){const o=$("#qaSug")._a[+s.dataset.qs];if(o){$("#qaNote").value=o.note;if(DB.cats.includes(o.cat)){st.cat=o.cat;st.catHand=true}$("#qaNote").blur();paint()}return}
  });
  $("#qaNote").addEventListener("input",()=>{if(!st.catHand){const c=qCat($("#qaNote").value);if(c)st.cat=c}paint()});
  $("#qaNote").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();$("#qaNote").blur()}});
  $("#qaDate").addEventListener("change",()=>{if($("#qaDate").value){st.date=$("#qaDate").value;paint()}});
  $("#qaSave").onclick=()=>{const v=amtV();if(!(v>0))return;addExpense({type:st.type,amount:v,cat:st.cat,note:$("#qaNote").value,date:st.date});qaClose()};
  // bàn phím máy tính
  addEventListener("keydown",e=>{if(sh.classList.contains("hidden")||e.target===$("#qaNote"))return;
    if(e.key==="Escape"){qaClose();return}if(e.key==="Enter"){$("#qaSave").click();return}
    const m={Backspace:"⌫",",":".",".":"."};const k=/^\d$/.test(e.key)?e.key:m[e.key];if(k){e.preventDefault();const b=$(`#qaKp [data-qk="${k}"]`);b&&b.click()}});
  // vuốt xuống để đóng
  {let y0=null;const p=$(".qas-p");p.addEventListener("touchstart",e=>{if(e.target.closest("#qaNote,.qas-cats,.qas-sug,.qashort"))return;y0=e.touches[0].clientY},{passive:true});
   p.addEventListener("touchmove",e=>{if(y0==null)return;const d=e.touches[0].clientY-y0;if(d>0)p.style.transform=`translateY(${d}px)`},{passive:true});
   p.addEventListener("touchend",e=>{if(y0==null)return;const d=(e.changedTouches[0].clientY-y0);y0=null;p.style.transform="";if(d>90)qaClose()},{passive:true})}

  // các lối vào: nút + ở Thu & Chi, menu + ở Tổng quan, nút "+ Ghi khoản", trạng thái trống
  $("#qaOpen").onclick=()=>qaOpen();
  const fab=$("#fab"),ofc=fab.onclick;fab.onclick=e=>{if(fab.dataset.m==="spend"){qaOpen();return}return ofc.call(fab,e)};
  document.addEventListener("click",e=>{const b=e.target.closest('[data-fm="spend"],[data-emp="spend"]');if(!b)return;e.stopImmediatePropagation();
    const fm=$("#fabMenu");if(fm){fm.classList.add("hidden");fab.classList.remove("open")}qaOpen()},true);
  // form cũ: thêm xong cũng có Hoàn tác
  $("#spForm").addEventListener("submit",()=>{setTimeout(()=>{const e=DB.expenses[DB.expenses.length-1];if(!e)return;
    toast(`Đã thêm ${e.type==="thu"?"+":""}${money(n(e.amount))} · ${e.cat}${e.note?" · "+e.note:""}`,()=>{const i=DB.expenses.findIndex(y=>y.id===e.id);if(i>=0){DB.expenses.splice(i,1);save();renderSpend()}})},0)});
  const rs=renderSpend;renderSpend=function(){const r=rs.apply(this,arguments);qaShort();return r};
}

/* eBay: tổng kết tháng luôn nằm trên cùng (mọi tab). Tính mọi đơn bán trong tháng (cả chưa ship / đang giao). */
function ebTopRender(){
  const box=$("#ebTop");if(!box)return;
  const sel=$("#ebMonth")&&$("#ebMonth").value,mk=ebTab==="done"&&sel?sel:monthOf(today()),pm=mShift(mk,-1);
  const os=ordersOf(items.filter(i=>i.status!=="kho"));
  const st=k=>{const a=os.filter(o=>monthOf(o.date)===k);return {n:a.length,rev:a.reduce((x,o)=>x+o.price+o.charge,0),pf:a.reduce((x,o)=>x+o.profit,0)}};
  const c=st(mk),p=st(pm);
  const cmp=(a,b)=>{if(!b)return `<small class="cmp">T${+pm.slice(5)}: —</small>`;const d=Math.round((a-b)/Math.abs(b)*100);return d?`<small class="cmp ${d>0?"up":"dn"}">${d>0?"▲":"▼"}${Math.abs(d)}%</small>`:`<small class="cmp">=</small>`};
  box.innerHTML=`<div class="ebt-h"><b>${mLabel(mk)}</b><span>so với T${+pm.slice(5)} ›</span></div>
   <div class="ebt-g"><div><span>Đơn bán</span><b>${c.n}</b>${cmp(c.n,p.n)}</div><div><span>Tiền bán</span><b>${money(c.rev)}</b>${cmp(c.rev,p.rev)}</div><div class="pf"><span>Lãi</span><b class="${c.pf>=0?"pos":"neg"}">${money(c.pf)}</b>${cmp(c.pf,p.pf)}</div></div>`;
  $("#sum").classList.toggle("hidden",ebTab==="done");
}
{const r0=render;render=function(){const r=r0.apply(this,arguments);try{ebTopRender()}catch(e){}return r}}
$("#ebTop").addEventListener("click",()=>{if(ebTab!=="done"){$("#ebMonth").value=monthOf(today());$('#ebTabs [data-eb="done"]').click()}});
