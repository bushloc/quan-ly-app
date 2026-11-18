"use strict";
/* ===== Tổng quan ===== */
let homeM=mKey(new Date());
const PAL=["#6366f1","#10b981","#f59e0b","#ef4444","#06b6d4","#a855f7","#ec4899","#84cc16"];
function monthStats(mk,calc){
  const sold=DB.items.filter(i=>i.status==="ban"&&monthOf(i.saleDate)===mk);
  const ebay=sold.reduce((a,i)=>a+profit(i),0);
  const ex=DB.expenses.filter(e=>monthOf(e.date)===mk);
  const chi=ex.filter(isChi).reduce((a,e)=>a+n(e.amount),0),thu=ex.filter(e=>e.type==="thu").reduce((a,e)=>a+n(e.amount),0);
  const fixed=ex.filter(e=>e.type==="co").reduce((a,e)=>a+n(e.amount),0);
  const sh=DB.shifts.filter(s=>monthOf(s.date)===mk);
  const pay=sh.reduce((a,s)=>a+(calc[s.id]?calc[s.id].pay:0),0),hrs=sh.reduce((a,s)=>a+(calc[s.id]?calc[s.id].h:0),0);
  // pay = lương TRƯỚC thuế theo ngày làm (đầu tháng tới cuối tháng); wage = lương THỰC NHẬN theo ngày nhận check, dùng cho Thu
  const w=wageOf(mk,calc);
  return {sold:sold.length,ebay,chi,thu,fixed,pay,hrs,wage:w.v,wageEst:w.est,net:ebay+w.v+thu-chi};
}
/* Lương thực nhận (sau thuế): mỗi check 1 bản ghi type "pay" trong expenses (id pay_<ngày bắt đầu kỳ>), nên 2 máy không đè nhau.
   Chưa nhập số thật thì ước tính = trước thuế × tỷ lệ học từ các check gần nhất đã nhập (lần đầu dùng % thuế trong Cài đặt).
   Check chưa tới ngày nhận mà chưa nhập thì chưa tính vào Thu. */
const taxPct=()=>{const v=parseFloat(S().taxPct);return isFinite(v)&&v>=0&&v<100?v:20};
const payRec=pp=>DB.expenses.find(e=>e.type==="pay"&&e.id==="pay_"+pp.st);
const payHas=e=>e&&String(e.amount)!==""&&n(e.amount)>=0;
function netRatio(calc){
  let g=0,nn=0;
  const rs=DB.expenses.filter(e=>e.type==="pay"&&payHas(e)&&n(e.amount)>0).sort((a,b)=>b.st.localeCompare(a.st)).slice(0,6);
  for(const e of rs){const gr=n(e.gross)>0?n(e.gross):periodSum({st:e.st,en:addDays(e.st,13)},calc).pay;if(gr>0){g+=gr;nn+=n(e.amount)}}
  return g>0?Math.min(1,nn/g):1-taxPct()/100;
}
function payNet(pp,calc,ratio){
  const e=payRec(pp);
  if(payHas(e))return {v:n(e.amount),est:false};
  return {v:periodSum(pp,calc).pay*ratio,est:true};
}
function wageOf(mk,calc){
  const ratio=netRatio(calc),t=today(),k0=Math.floor(dayDiff(mk+"-01",payStart())/14);
  let v=0,est=false;
  for(let k=k0-3;k<=k0+4;k++){
    const pp=payPeriod(k);if(monthOf(pp.pay)!==mk)continue;
    const p=payNet(pp,calc,ratio);
    if(!p.est||pp.pay<=t){v+=p.v;if(p.est&&p.v>0)est=true}
  }
  return {v,est};
}
function countUp(root){
  const still=matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.querySelectorAll("[data-count]").forEach(el=>{
    const to=+el.dataset.count;el.textContent=money(to);if(still||!to)return;
    const t0=performance.now(),D=800,step=t=>{const p=Math.min(1,Math.max(0,(t-t0)/D)); /* t của khung đầu có thể < t0 */el.textContent=money(to*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(step)};
    requestAnimationFrame(step);
  });
}
function barChart(mks,stats,cur){
  // thu gộp 1 cột (lãi eBay + tiền công + thu khác), chi màu đỏ; 12 tháng của năm, tháng chưa tới để trống
  const W=600,H=220,base=186,top=14,inc=stats.map(s=>s.ebay+s.wage+s.thu),chi=stats.map(s=>s.chi);
  const mx=Math.max(1,...inc,...chi),gw=W/mks.length,bw=Math.min(30,gw/3.2),sc=v=>Math.max(0,v)/mx*(base-top);
  let g="";for(let k=1;k<=3;k++){const y=base-(base-top)*k/3;g+=`<line class="grid" x1="0" x2="${W}" y1="${y}" y2="${y}"/>`}
  mks.forEach((mk,i)=>{
    const cx=gw*i+gw/2,hi=sc(inc[i]),hc=sc(chi[i]),dly=(i*0.04).toFixed(2);
    if(mk===cur)g+=`<rect class="sel" x="${gw*i+2}" y="${top-6}" width="${gw-4}" height="${base-top+36}" rx="8"/>`;
    g+=`<rect class="gr" x="${cx-bw-1}" y="${base-hi}" width="${bw}" height="${hi}" rx="4" fill="var(--ok)" style="animation-delay:${dly}s"><title>${mLabel(mk)} · thu ${money(inc[i])}</title></rect>`;
    g+=`<rect class="gr" x="${cx+1}" y="${base-hc}" width="${bw}" height="${hc}" rx="4" fill="var(--bad)" style="animation-delay:${dly}s"><title>${mLabel(mk)} · chi ${money(chi[i])}</title></rect>`;
    g+=`<text x="${cx}" y="${base+24}" text-anchor="middle" class="${mk===cur?"cur":""}">T${+mk.slice(5)}</text>`;
    g+=`<rect class="hit" data-m="${mk}" x="${gw*i}" y="0" width="${gw}" height="${H}" fill="transparent"><title>${mLabel(mk)}</title></rect>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Thu và chi 12 tháng">${g}<line class="grid" x1="0" x2="${W}" y1="${base}" y2="${base}"/></svg><div class="lgd"><span><i style="background:var(--ok)"></i>Thu</span><span><i style="background:var(--bad)"></i>Chi</span><span class="muted">· chạm một tháng để xem chi tiết</span></div>`+(()=>{const i=mks.indexOf(cur),s=stats[i];if(!s)return "";const th=inc[i],cc=chi[i],net=th-cc;return `<div class="cdet"><b>${mLabel(cur)}</b><div><span>Thu</span><b class="pos">${money(th)}</b></div><div><span>Chi</span><b class="neg">${money(cc)}</b></div><div><span>Còn lại</span><b class="${net>=0?"pos":"neg"}">${money(net)}</b></div><small>eBay ${money(s.ebay)} · Lương ${money(s.wage)} · Thu khác ${money(s.thu)}</small></div>`})();
}
function donut(mk,inc){
  // vòng ngoài: chi theo danh mục (khoản cố định theo 6 nhóm, đúng màu nhóm); vòng trong: thu gộp.
  // 2 vòng cùng thước đo: bên nào lớn hơn là trọn vòng, nên nhìn là thấy thu đủ bù chi hay không
  const by={},fxCol={};for(const e of DB.expenses)if(isChi(e)&&monthOf(e.date)===mk){let c=e.cat;if(e.type==="co"){const g=FXM[fxCatOf(e)];c=g.l;fxCol[c]=g.c}by[c]=(by[c]||0)+n(e.amount)}
  let arr=Object.entries(by).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);const tot=arr.reduce((a,x)=>a+x[1],0);inc=Math.max(0,inc||0);
  if(!tot&&!inc)return `<p class="muted" style="margin:0">${mLabel(mk)} chưa có thu hay chi.</p>`;
  if(arr.length>6){const rest=arr.slice(5).reduce((a,x)=>a+x[1],0);arr=arr.slice(0,5).concat([["Khác (gộp)",rest]])}
  const col=c=>{if(fxCol[c])return fxCol[c];const k=DB.cats.indexOf(c);return PAL[(k<0?PAL.length-1:k)%PAL.length]};
  const mx=Math.max(tot,inc),R=51,C=2*Math.PI*R,r=39,c2=2*Math.PI*r;let acc=0,segs="";
  for(const [c,v] of arr){const len=v/mx*C;segs+=`<circle r="${R}" cx="60" cy="60" fill="none" stroke="${col(c)}" stroke-width="10" stroke-dasharray="${len.toFixed(2)} ${(C-len).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}"><title>${esc(c)}: ${money(v)}</title></circle>`;acc+=len}
  const il=inc/mx*c2,net=inc-tot;
  segs+=`<circle r="${r}" cx="60" cy="60" fill="none" stroke="var(--line)" stroke-width="6"/><circle r="${r}" cx="60" cy="60" fill="none" stroke="var(--ok)" stroke-width="6" stroke-dasharray="${il.toFixed(2)} ${(c2-il).toFixed(2)}"><title>Thu: ${money(inc)}</title></circle>`;
  return `<div class="donut"><svg viewBox="0 0 120 120" role="img" aria-label="Thu và chi theo danh mục"><g transform="rotate(-90 60 60)">${segs}</g><text x="60" y="61" text-anchor="middle" class="ctr ${net>=0?"pos":"neg"}">${money(net)}</text><text x="60" y="73" text-anchor="middle" class="ctr2">thu − chi</text></svg>`+
    `<ul><li class="dthu"><i style="background:var(--ok);border-radius:50%"></i><span>Thu</span><span>${money(inc)}</span></li>${arr.map(([c,v])=>`<li><i style="background:${col(c)}"></i><span>${esc(c)}</span><span>${money(v)} <span class="muted" style="font-weight:400">${(v/tot*100).toFixed(0)}%</span></span></li>`).join("")}${tot?`<li class="dtot"><i></i><span>Tổng chi</span><span>${money(tot)}</span></li>`:""}</ul></div>`;
}
// Tổng kết năm: 3 số lớn + bảng T1–T12 (Thu · Chi · Còn lại) + dòng cả năm
let yrOpen=false;
function yearSummary(yr,mks,stats,cur){
  const now=mKey(new Date()),inc=s=>s.ebay+s.wage+s.thu,has=(m,s)=>m<=now||inc(s)||s.chi;
  const T=stats.reduce((a,s)=>({i:a.i+inc(s),c:a.c+s.chi,g:a.g+s.pay}),{i:0,c:0,g:0}),nm=mks.filter((m,i)=>m<=now&&has(m,stats[i])).length||1;
  const mY=v=>(v<0?"-$":"$")+Math.round(Math.abs(v)).toLocaleString("en-US"),cell=v=>`<td class="num">${mY(v)}</td>`;
  return `<h3>Tổng kết năm ${yr}</h3><div class="ysum"><div><span>Tổng thu</span><b class="pos">${money(T.i)}</b></div><div><span>Tổng chi</span><b class="neg">${money(T.c)}</b></div><div><span>Còn lại</span><b class="${T.i-T.c>=0?"pos":"neg"}">${money(T.i-T.c)}</b></div></div>`+
    `<details class="ydet"${yrOpen?" open":""}><summary>Xem bảng 12 tháng</summary><table class="ytab"><thead><tr><th>Tháng <small>· lương trước thuế</small></th><th class="num">Thu</th><th class="num">Chi</th><th class="num">Còn lại</th></tr></thead><tbody>`+
    mks.map((m,i)=>{const s=stats[i],net=inc(s)-s.chi;return has(m,s)
      ?`<tr class="${m===cur?"cur":""}"><td>T${+m.slice(5)}${s.pay?`<small class="gr">lương ${mY(s.pay)}</small>`:""}</td>${cell(inc(s))}${cell(s.chi)}<td class="num ${net>=0?"pos":"neg"}">${mY(net)}</td></tr>`
      :`<tr class="fut"><td>T${+m.slice(5)}</td><td class="num">—</td><td class="num">—</td><td class="num">—</td></tr>`}).join("")+
    `</tbody><tfoot><tr><td>Cả năm<small class="gr">lương ${mY(T.g)}</small></td>${cell(T.i)}${cell(T.c)}<td class="num ${T.i-T.c>=0?"pos":"neg"}">${mY(T.i-T.c)}</td></tr><tr class="avg"><td>TB/tháng<small class="gr">lương ${mY(T.g/nm)}</small></td>${cell(T.i/nm)}${cell(T.c/nm)}${cell((T.i-T.c)/nm)}</tr></tfoot></table></details>`;
}
function renderHome(){
  const mk=homeM,t=today(),calc=calcShifts();
  // cả năm của tháng đang xem (T1–T12): dùng cho biểu đồ cột và bảng tổng kết năm
  const yr=mk.slice(0,4),mks=Array.from({length:12},(_,i)=>yr+"-"+String(i+1).padStart(2,"0")),stats=mks.map(m=>monthStats(m,calc)),s=stats[+mk.slice(5)-1];
  $("#homeTitle").textContent="Tổng quan";
  $("#hmLabel").textContent=mLabel(mk);
  // 1) việc cần làm ngay (luôn theo hôm nay, không theo tháng đang xem)
  const todo=[],nowM=mKey(new Date());
  const ship=ordersOf(DB.items.filter(i=>i.status!=="kho")).filter(o=>o.stage==="ship");
  if(ship.length){const w=Math.max(0,...ship.map(o=>daysAgo(o.f.saleDate)||0));todo.push([w>=2?"bad":"go","📮",`${ship.length} đơn cần ship`,w?`chờ ${w} ngày`:"hôm nay","ebay:ship"])}
  for(const c of cards().filter(c=>c.name)){const [st,lb]=cardState(c,nowM);if(st==="late"||st==="soon")todo.push([st==="late"?"bad":"warn","💳",`Trả thẻ ${c.name}`,lb,"spend"])}
  // cùng nguồn fxRows với tab Chi tiêu: bấm Trả ở đó là hết nhắc ở đây
  const fxTodo=fxRows(nowM).filter(r=>!r.paid).length;
  if(fxTodo)todo.push(["warn","",`${fxTodo} khoản cố định chưa trả`,mLabel(nowM),"spend"]);
  if(DB.clock)todo.push(["go","⏱","Đang trong ca",`từ ${hhmm(new Date(DB.clock.start))}`,"work"]);
  const rank={bad:0,warn:1,go:2};todo.sort((a,b)=>rank[a[0]]-rank[b[0]]); // quá hạn lên đầu
  $("#homeTodo").innerHTML=todo.length?todo.map(([cl,ic,t1,s,go])=>`<button type="button" class="tdo ${cl}" data-todo="${go}"><i class="tdot"></i><b>${esc(t1)}</b><span class="s">${esc(s)}</span></button>`).join(""):`<div class="todo-ok">✓ Không có việc gấp</div>`;
  $$("#homeTodo [data-todo]").forEach(b=>b.onclick=()=>{const [m,tab]=b.dataset.todo.split(":");if(tab){ebTab=tab;try{localStorage.setItem("ebTab",tab)}catch(e){}}showMod(m)});
  // 2) số chính: mỗi thẻ 1 con số + nhãn ngắn + 1 dòng phụ
  const {cur,next}=checkFor(t),ck=cur&&cur.pay>=t?cur:next,ckS=ck?periodSum(ck,calc):null,ckN=ck?payNet(ck,calc,netRatio(calc)):null;
  const wk=weekStartOf(t),we=addDays(wk,6),wc=DB.shifts.filter(x=>x.date>=wk&&x.date<=we).reduce((a,x)=>addC(a,calc[x.id]),Z0());
  const lim=n(S().otAfter)||40,toOt=wc.h+(S().leaveOt?wc.hol+wc.pto:0);
  const box=(cls,lb,v,vcls,sub,i,extra="")=>`<div class="card hcard-in ${cls}" style="animation-delay:${i*0.06}s"><div><div class="lb">${lb}</div><div class="kv ${vcls}"${typeof v==="number"?` data-count="${v}"`:""}>${typeof v==="number"?money(v):v}</div>${extra}<div class="sub">${sub}</div></div></div>`;
  $("#homeHero").innerHTML=
    box("main",`Còn lại · ${mLabel(mk)}`,s.net,s.net>=0?"pos":"neg",`Thu <b>${money(s.ebay+s.wage+s.thu)}</b> · Chi <b>${money(s.chi)}</b><br><span class="muted">Lương tháng: trước thuế <b>${money(s.pay)}</b> · thực nhận <b>${s.wageEst?"~":""}${money(s.wage)}</b></span>`,0)+
    box("chkc",ckN&&ckN.est?"Check kế tiếp · ước tính":"Check kế tiếp",ckN?ckN.v:"—","pos",ck?`${dowl(ck.pay)} ${dmy(ck.pay)} · trước thuế ${money(ckS.pay)}`:"",1)+
    box("","Lãi eBay",s.ebay,s.ebay>=0?"pos":"neg",`${s.sold} món đã bán`,2);
  $("#homeHours").innerHTML=`<span class="hl">⏱ Giờ tuần này</span><b>${fh(wc.h)}<small> / ${lim}</small></b><span class="hbar bar ${hrBarCls(toOt,lim)}"><i style="width:${Math.min(100,toOt/lim*100)}%"></i></span><span class="hs">${wc.ot>0?`<b class="neg">+${fh(wc.ot)}h OT</b>`:`còn ${fh(Math.max(0,lim-toOt))}h tới OT`}</span>`;
  countUp($("#homeHero"));
  // chi cố định theo 6 nhóm, đúng màu nhóm
  const fxm=fxRows(mk),fxT=fxm.reduce((a,r)=>a+n(r.amt),0),fxG=FXC.map(([k,l,c])=>({l,c,v:fxm.filter(r=>r.cat===k).reduce((a,r)=>a+n(r.amt),0)}));
  $("#homeFixed").innerHTML=fxm.length?`<div class="kvs"><b class="big">${money(fxT)}</b> <span class="muted">· đã trả ${fxm.filter(r=>r.paid).length}/${fxm.length}</span></div>`+
    `<div class="fxstack">${fxG.filter(g=>g.v>0).map(g=>`<i style="width:${g.v/(fxT||1)*100}%;background:${g.c}" title="${g.l}: ${money(g.v)}"></i>`).join("")}</div>`+
    `<div class="fxleg">${fxG.filter(g=>g.v>0).map(g=>`<div><i style="background:${g.c}"></i>${g.l}<b>${money(g.v)}</b></div>`).join("")}</div>`
    :`<span class="muted">${mLabel(mk)} chưa có khoản cố định.</span>`;
  $("#homeChartTitle").textContent="Thu & chi · năm "+yr;
  $("#homeChart").innerHTML=barChart(mks,stats,mk);
  $("#homeDonutTitle").textContent="Thu & chi theo danh mục · "+mLabel(mk);
  $("#homeDonut").innerHTML=donut(mk,s.ebay+s.wage+s.thu);
  $("#homeYear").innerHTML=yearSummary(yr,mks,stats,mk);
  $("#homeBudgetTitle").textContent="Ngân sách · "+mLabel(mk);
  $("#homeBudget").innerHTML=budgetBars(mk)||`<span class="muted">Chưa đặt ngân sách. Vào “Chi tiêu” để đặt.</span>`;
}
$("#homeYear").addEventListener("toggle",e=>{if(e.target.matches("details.ydet"))yrOpen=e.target.open},true);
$("#homeChart").addEventListener("click",e=>{const h=e.target.closest("[data-m]");if(h){homeM=h.dataset.m;renderHome()}});
$("#hmPrev").onclick=()=>{homeM=mShift(homeM,-1);renderHome()};
$("#hmNext").onclick=()=>{homeM=mShift(homeM,1);renderHome()};
