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
  let box=$("#wkCal");if(!box){$("#wkMonth").insertAdjacentHTML("afterend",`<div class="card wkcal" id="wkCal"></div>`);box=$("#wkCal")}
  const mk=calM||monthOf(wkCur||today()),calc=calcShifts(),t=today(),ws=n(S().weekStart);
  const [y,m]=mk.split("-").map(Number),first=`${mk}-01`,dim=new Date(y,m,0).getDate();
  const lead=(parseD(first).getDay()-ws+7)%7,wkEnd=wkCur?addDays(wkCur,6):"";
  const byD={};for(const s of DB.shifts)if(monthOf(s.date)===mk){const c=calc[s.id]||{};const o=byD[s.date]??={h:0,hol:0,pto:0};o.h+=c.h||0;o.hol+=c.hol||0;o.pto+=c.pto||0}
  let h=`<div class="calh"><button type="button" class="btn" data-cm="-1">‹</button><b>📅 ${mLabel(mk)}</b><button type="button" class="btn" data-cm="1">›</button></div><div class="calg">`;
  for(let k=0;k<7;k++)h+=`<span class="cdw">${DOW[(ws+k)%7]}</span>`;
  for(let k=0;k<lead;k++)h+=`<span></span>`;
  for(let d=1;d<=dim;d++){
    const ds=`${mk}-${String(d).padStart(2,"0")}`,o=byD[ds],cls=["cd"];let st="",lab="";
    if(o){const tot=o.h+o.hol+o.pto;
      if(o.h>0){cls.push("w");st=`--a:${Math.round(18+Math.min(1,o.h/10)*62)}%`}
      else if(o.hol>0)cls.push("hol");else if(o.pto>0)cls.push("pto");
      if(o.h>0&&(o.hol||o.pto))cls.push("mix");
      lab=(tot%1?tot.toFixed(1):tot)+"h"}
    if(ds===t)cls.push("today");if(wkCur&&ds>=wkCur&&ds<=wkEnd)cls.push("cur");
    h+=`<button type="button" class="${cls.join(" ")}" data-cd="${ds}" style="${st}"><span class="n">${d}</span><span class="hh">${lab}</span></button>`;
  }
  h+=`</div><div class="calk"><span><i class="k w"></i>Ca làm (đậm = nhiều giờ)</span><span><i class="k hol"></i>Holiday</span><span><i class="k pto"></i>PTO</span></div>`;
  box.innerHTML=h;
}
$("#mod-work").addEventListener("click",e=>{
  const nav=e.target.closest("#wkCal [data-cm]");if(nav){calM=mShift(calM||monthOf(wkCur||today()),+nav.dataset.cm);return renderCal()}
  const c=e.target.closest("#wkCal [data-cd]");if(!c)return;
  calM=monthOf(c.dataset.cd);wkCur=weekStartOf(c.dataset.cd);renderWork();
  document.querySelector("#mod-work .mhead")?.scrollIntoView({behavior:"smooth",block:"start"});
});
{const rw=renderWork;renderWork=function(){const r=rw.apply(this,arguments);if(wkCur){calM=monthOf(wkCur);renderCal()}return r}}
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
  const row=r=>`<button type="button" class="eyr${r.items||r.ret?"":" z"}" data-eym="${r.mk}"${r.items||r.ret?"":" disabled"}><span class="m">T${+r.mk.slice(5)}</span><span class="pb"><i class="${r.profit<0?"neg":""}" style="width:${Math.abs(r.profit)/mx*100}%"></i></span><b class="${r.profit>=0?"pos":"neg"}">${r.items||r.ret?money(r.profit):"—"}</b>${r.items||r.ret?`<small>${r.orders} đơn · bán ${money(r.sale)} · phí ${money(r.fees)} · ship ${money(r.ship)} · vốn ${money(r.cost)}${r.ret?` · <span class="neg">${r.ret} trả hàng${r.refund?" "+money(r.refund):""}</span>`:""}</small>`:""}</button>`;
  return `<details class="ebyd"${ebYOpen?" open":""}><summary><span>📦 eBay cả năm ${ebY}</span><b class="${T.profit>=0?"pos":"neg"}">${money(T.profit)}</b><span class="chev">▾</span></summary>
  <div class="eyh"><button type="button" class="btn" data-ey="-1"${canP?"":" disabled"}>‹</button><b>${ebY}</b><button type="button" class="btn" data-ey="1"${canN?"":" disabled"}>›</button><button type="button" class="btn" id="eyCsv">⬇ Tải CSV</button></div>
  ${act.length?`<div class="eyl">${rows.map(row).join("")}</div>
  <div class="eyt"><div><span>Đơn</span><b>${T.orders}</b></div><div><span>Tiền bán</span><b>${money(T.sale)}</b></div><div><span>Phí eBay</span><b>−${money(T.fees)}</b></div><div><span>Ship bạn trả</span><b>−${money(T.ship)}</b></div><div><span>Vốn</span><b>−${money(T.cost)}</b></div><div class="big"><span>Lãi cả năm</span><b class="${T.profit>=0?"pos":"neg"}">${money(T.profit)}</b></div></div>
  <p class="muted eyn">TB mỗi tháng <b>${money(nm?T.profit/nm:0)}</b>${best&&best.profit>0?` · cao nhất <b>T${+best.mk.slice(5)}</b> (${money(best.profit)})`:""}${T.ret?` · ${T.ret} món trả hàng${T.refund?`, hoàn ${money(T.refund)}`:""} (không tính vào lãi)`:""}<br>Bấm một tháng để xem các đơn đã bán.</p>`
  :`<p class="muted">Năm ${ebY} chưa có đơn bán.</p>`}</details>`;
}
function ebYearCsv(){
  const {rows,T}=ebYear(ebY),f=v=>(Math.round(v*100)/100).toFixed(2);
  const L=[["Thang","So don","So mon","Tien ban","Phi eBay","Ship tra","Von","Lai","Tra hang","Tien hoan"].join(",")];
  for(const r of rows)L.push([r.mk,r.orders,r.items,f(r.sale),f(r.fees),f(r.ship),f(r.cost),f(r.profit),r.ret,f(r.refund)].join(","));
  L.push(["Tong "+ebY,T.orders,T.items,f(T.sale),f(T.fees),f(T.ship),f(T.cost),f(T.profit),T.ret,f(T.refund)].join(","));
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
