"use strict";
/* ===== Lương cả năm (Giờ làm) + trang "Hôm nay" siêu gọn ===== */

// 8) Lương năm tới hôm nay: trước thuế theo ngày làm, thực nhận theo ngày nhận check, OT, PTO/Holiday; so với cùng kỳ năm trước
function yearPay(yr,calc,until){
  const w=n(S().wage),mult=n(S().otMult)||1.5,r={h:0,ot:0,otPay:0,hol:0,pto:0,gross:0,net:0,netEst:false,shifts:0};
  for(const s of DB.shifts){
    if(!s.date||s.date.slice(0,4)!==yr||s.date>until)continue;const c=calc[s.id];if(!c)continue;
    r.h+=c.h;r.ot+=c.ot;r.otPay+=c.ot*w*mult;r.hol+=c.hol;r.pto+=c.pto;r.gross+=c.pay;if(!isLeave(s))r.shifts++;
  }
  const lastM=until.slice(0,4)===yr?+until.slice(5,7):12;
  for(let m=1;m<=lastM;m++){const x=wageOf(yr+"-"+String(m).padStart(2,"0"),calc);r.net+=x.v;if(x.est&&x.v>0)r.netEst=true}
  return r;
}
function yearCard(){
  const t=today(),yr=t.slice(0,4),calc=calcShifts(),cur=yearPay(yr,calc,t);
  const py=String(+yr-1),prev=yearPay(py,calc,py+t.slice(4)),hasPrev=prev.gross>0;
  // nhịp tính từ ca đầu tiên trong năm (bắt đầu ghi giữa năm thì không bị kéo thấp), phần còn lại của năm theo nhịp đó
  const f0=DB.shifts.filter(s=>s.date&&s.date.slice(0,4)===yr&&s.date<=t).map(s=>s.date).sort()[0]||t;
  const days=Math.max(7,dayDiff(t,f0)+1),rest=Math.max(0,dayDiff(yr+"-12-31",t));
  const proj=cur.gross+cur.gross/days*rest,projNet=cur.net+cur.net/days*rest,diff=cur.gross-prev.gross;
  const row=(k,v,cls="")=>`<div><span>${k}</span><b class="${cls}">${v}</b></div>`;
  return `<details class="card ypay" id="yPay"${yOpen?" open":""}><summary><span>💰 Lương năm ${yr} tới nay</span><b class="pos">${money(cur.gross)}</b><span class="chev">▾</span></summary>
    <div class="ygrid">${row("Trước thuế",money(cur.gross),"pos")}${row(`Thực nhận${cur.netEst?" (~)":""}`,money(cur.net),"pos")}${row("Giờ làm",fh(cur.h)+"h")}${row("Tăng ca",`${fh(cur.ot)}h · ${money(cur.otPay)}`,cur.ot>0?"neg":"")}${row("Holiday / PTO",`${fh(cur.hol)}h / ${fh(cur.pto)}h`)}${row("Số ca",cur.shifts)}</div>
    <div class="yproj">📈 Giữ nhịp từ ${dmy(f0)} tới nay thì cả năm ≈ <b>${money(proj)}</b> trước thuế · <b>${money(projNet)}</b> thực nhận</div>
    ${hasPrev?`<div class="yprev">So với cùng kỳ ${py} (${money(prev.gross)}): <b class="${diff>=0?"pos":"neg"}">${diff>=0?"▲":"▼"} ${money(Math.abs(diff))}</b>${prev.gross?` (${diff>=0?"+":""}${Math.round(diff/prev.gross*100)}%)`:""} · giờ làm ${fh(prev.h)}h → ${fh(cur.h)}h</div>`:`<div class="yprev muted">Chưa có dữ liệu năm ${py} để so sánh.</div>`}
    <div class="muted ynote">Trước thuế tính theo ngày làm; thực nhận theo ngày nhận check (số nhập ở Check lương, chưa nhập thì ước tính).</div></details>`;
}
let yOpen=false;
{
  const rw=renderWork;
  renderWork=function(){
    rw.apply(this,arguments);
    let el=$("#yPayWrap");if(!el){$("#wkMonth").insertAdjacentHTML("afterend",'<div id="yPayWrap"></div>');el=$("#yPayWrap")}
    el.innerHTML=yearCard();
    $("#yPay").addEventListener("toggle",e=>{yOpen=e.target.open});
  };
}

// 13) Trang "Hôm nay": ca/clock, giờ tuần, check kế tiếp, việc cần làm, chi hôm nay + ghi nhanh
{
  document.querySelector("main").insertAdjacentHTML("beforeend",'<div id="mod-today" class="hidden"><div class="tdh"><h2 class="pg">Hôm nay</h2><button type="button" class="btn" id="tdBack">Tổng quan ›</button></div><div id="tdBody"></div></div>');
  $("#tdBack").onclick=()=>showMod("home");
  const sm=showMod;let first=true;
  showMod=function(m){
    if(first){first=false;let st="";try{st=location.hash}catch(e){}if(m==="home"&&(st==="#today"||S().startPage==="today"))m="today"}
    sm.call(this,m);
    if(m==="today"){$$("#side button").forEach(b=>b.classList.remove("on"));renderToday()}
  };
}
function renderToday(){
  const b=$("#tdBody");if(!b||$("#mod-today").classList.contains("hidden"))return;
  if(holdWhileTyping("today",b,renderToday))return;
  const t=today(),calc=calcShifts(),d=new Date(),dow=["Chủ nhật","Thứ Hai","Thứ Ba","Thứ Tư","Thứ Năm","Thứ Sáu","Thứ Bảy"][d.getDay()];
  const ts=DB.shifts.filter(s=>s.date===t),tc=ts.reduce((a,s)=>addC(a,calc[s.id]),Z0());
  const wk=weekStartOf(t),wc=DB.shifts.filter(x=>x.date>=wk&&x.date<=addDays(wk,6)).reduce((a,x)=>addC(a,calc[x.id]),Z0());
  const lim=n(S().otAfter)||40,toOt=wc.h+(S().leaveOt?wc.hol+wc.pto:0);
  const {cur,next}=checkFor(t),ck=cur&&cur.pay>=t?cur:next,ckN=ck?payNet(ck,calc,netRatio(calc)):null;
  const ship=ordersOf(DB.items.filter(i=>i.status!=="kho")).filter(o=>o.stage==="ship").length;
  const nowM=mKey(d),cds=cards().filter(c=>c.name).map(c=>[c,cardState(c,nowM)]).filter(([,s])=>s[0]==="late"||s[0]==="soon");
  const fx=fxRows(nowM).filter(r=>!r.paid).length;
  const spent=DB.expenses.filter(e=>e.type==="chi"&&e.date===t),sp=spent.reduce((a,e)=>a+n(e.amount),0);
  let clk;
  if(DB.clock){const s=Math.max(0,Math.floor((Date.now()-DB.clock.start)/1000));clk=`<div class="tdclk on"><div><span class="lb">Đang trong ca từ ${hhmm(new Date(DB.clock.start))}</span><b id="tdT">${[Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(x=>String(x).padStart(2,"0")).join(":")}</b></div><button type="button" class="btn clockbtn stop" id="tdClk">⏹ Clock Out</button></div>`}
  else clk=`<div class="tdclk"><div><span class="lb">${ts.length?`Hôm nay đã có ${fh(tc.h+tc.hol+tc.pto)}h`:"Chưa vào ca"}</span><label class="tdin">Giờ vào<input type="time" id="tdAt" value="${esc($("#clockAt").value||"07:00")}"></label></div><button type="button" class="btn clockbtn go" id="tdClk">▶ Clock In</button></div>`;
  const todo=[...(ship?[["bad","📮",`${ship} đơn cần ship`,"ebay"]]:[]),...cds.map(([c,s])=>[s[0]==="late"?"bad":"warn","💳",`${c.name} · ${s[1]}`,"spend"]),...(fx?[["warn","📌",`${fx} khoản cố định chưa trả`,"spend"]]:[])];
  b.innerHTML=`<div class="tdsub">${dow} ${d.getDate()}/${d.getMonth()+1}</div>
    <div class="card">${clk}</div>
    <div class="tdgrid">
      <button type="button" class="card tdk" data-tgo="work"><span class="lb">Giờ tuần này</span><b>${fh(wc.h)}<small>/${lim}</small></b>${wc.hol+wc.pto>0?`<span class="lvtag pto">+${fh(wc.hol+wc.pto)} PTO/Hol</span>`:""}<span class="bar thin ${hrBarCls(toOt,lim)}"><i style="width:${Math.min(100,toOt/lim*100)}%"></i></span></button>
      <button type="button" class="card tdk" data-tgo="work"><span class="lb">Check kế tiếp</span><b class="pos">${ckN?(ckN.est?"~":"")+money(ckN.v):"—"}</b><span class="sub">${ck?`${dowl(ck.pay)} ${dmy(ck.pay)}`:""}</span></button>
    </div>
    <div class="card"><h3>Việc cần làm</h3>${todo.length?todo.map(([c,ic,txt,go])=>`<button type="button" class="tdo ${c}" data-tgo="${go}"><i class="tdot"></i><b>${ic} ${esc(txt)}</b></button>`).join(""):`<div class="todo-ok">✓ Không có việc gấp</div>`}</div>
    <div class="card"><div class="chd"><h3>Chi hôm nay</h3><b class="${sp?"neg":"muted"}">${money(sp)}</b></div>
      ${spent.map(e=>`<div class="tdx"><span>${esc(e.note||e.cat)}</span><span class="muted">${esc(e.cat)}</span><b>-${money(n(e.amount))}</b></div>`).join("")}
      <form id="tdAdd" class="tdadd" autocomplete="off"><input name="amount" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Số tiền" required><select name="cat">${DB.cats.map(c=>`<option>${esc(c)}</option>`).join("")}</select><input name="note" placeholder="Ghi chú"><button class="btn primary">+ Ghi</button></form></div>`;
  let lc="";try{lc=localStorage.getItem("lastCat")||""}catch(e){}
  const f=$("#tdAdd");if(lc&&DB.cats.includes(lc))f.cat.value=lc;
  f.onsubmit=e=>{e.preventDefault();DB.expenses.push({id:uid(),date:today(),type:"chi",amount:n(f.amount.value),cat:f.cat.value,note:f.note.value.trim()});try{localStorage.setItem("lastCat",f.cat.value)}catch(x){}save();renderToday();toast("Đã ghi khoản chi")};
  $("#tdClk").onclick=()=>{if(!DB.clock&&$("#tdAt"))$("#clockAt").value=$("#tdAt").value;$("#clockBtn").click();renderToday()};
  $$("#tdBody [data-tgo]").forEach(x=>x.onclick=()=>{if(x.dataset.tgo==="ebay"){ebTab="ship";try{localStorage.setItem("ebTab","ship")}catch(e){}}showMod(x.dataset.tgo)});
}
setInterval(()=>{const el=$("#tdT");if(el&&DB.clock){const s=Math.max(0,Math.floor((Date.now()-DB.clock.start)/1000));el.textContent=[Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(x=>String(x).padStart(2,"0")).join(":")}},1000);
// lối vào: bấm lời chào ở Tổng quan; Cài đặt chọn trang mở đầu
document.addEventListener("click",e=>{if(e.target.closest("#greet"))showMod("today")});
{
  const lab=$("#stTheme").closest("label");
  lab.insertAdjacentHTML("beforebegin",'<label style="max-width:260px;margin-bottom:0">Mở app ở<select id="stStart"><option value="">Tổng quan</option><option value="today">Hôm nay (gọn)</option></select></label>');
  $("#stStart").onchange=e=>{S().startPage=e.target.value;save()};
  const rs=renderSet;renderSet=function(){rs.apply(this,arguments);$("#stStart").value=S().startPage||""};
}
