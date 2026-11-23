"use strict";
/* ===== Giờ đi làm ===== */
const hhmm=d=>String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
const weekStartOf=s=>{const d=parseD(s),diff=(d.getDay()-n(S().weekStart)+7)%7;return addDays(s,-diff)};
/* Ngày Holiday / PTO: kind "hol"/"pto", số giờ trong hrs (mặc định 8). Trả lương thường, không bao giờ thành tăng ca;
   mặc định cũng không cộng vào mốc tăng ca của giờ làm thật (Cài đặt → leaveOt để đổi) */
const isLeave=sh=>sh.kind==="hol"||sh.kind==="pto";
const LV={hol:"🎉 Holiday",pto:"🌴 PTO"};
function shiftHours(sh){
  if(isLeave(sh))return Math.max(0,n(sh.hrs));
  if(!sh.start||!sh.end)return 0;
  const [a,b]=sh.start.split(":").map(Number),[c,d]=sh.end.split(":").map(Number);
  let m=(c*60+d)-(a*60+b);if(m<0)m+=1440;m-=n(sh.brk);return Math.max(0,m)/60;
}
function calcShifts(){
  const res={},byWeek={},lim=n(S().otAfter),w=n(S().wage),mult=n(S().otMult)||1.5;
  for(const sh of DB.shifts)(byWeek[weekStartOf(sh.date)]??=[]).push(sh);
  for(const wk in byWeek){
    const arr=byWeek[wk].slice().sort((a,b)=>(a.date+(a.start||"")).localeCompare(b.date+(b.start||"")));let cum=0;
    for(const sh of arr){
      const h=shiftHours(sh);
      // h: giờ làm thật (giờ nghỉ có lương để riêng ở hol/pto)
      if(isLeave(sh)){if(S().leaveOt)cum+=h;res[sh.id]={h:0,reg:0,ot:0,hol:sh.kind==="hol"?h:0,pto:sh.kind==="pto"?h:0,pay:h*w};continue}
      const reg=Math.max(0,Math.min(h,lim-cum)),ot=h-reg;cum+=h;res[sh.id]={h,reg,ot,hol:0,pto:0,pay:reg*w+ot*w*mult}}
  }
  return res;
}
const Z0=()=>({h:0,reg:0,ot:0,hol:0,pto:0,pay:0,n:0});
const addC=(a,c)=>{c=c||{};for(const k of ["h","reg","ot","hol","pto","pay"])a[k]+=c[k]||0;a.n++;return a};
const leaveTxt=c=>(c.hol?` + <b>${fh(c.hol)} giờ Holiday</b>`:"")+(c.pto?` + <b>${fh(c.pto)} giờ PTO</b>`:"");
let wkCur=null;
const fh=h=>h.toFixed(2);
const lunch=()=>{const v=parseFloat(S().lunch);return isFinite(v)&&v>=0?v:30};
// thanh giờ tuần: xanh khi còn xa, vàng khi còn ≤5 giờ tới ngưỡng, đỏ khi tăng ca
const hrBarCls=(tot,lim)=>tot>lim?"over":tot>=lim-5?"warn":"go";
const dm=s=>{const d=parseD(s);return d.getDate()+"/"+(d.getMonth()+1)};
let ckOpen=false;
$("#wkCheck").addEventListener("toggle",e=>{if(e.target.matches("details.ckfold"))ckOpen=e.target.open},true);
function renderWork(){
  if(holdWhileTyping("work",$("#mod-work"),renderWork))return;
  if(!wkCur)wkCur=weekStartOf(today());
  const calc=calcShifts(),we=addDays(wkCur,6),t=today();
  $("#wkLabel").textContent=`${DOW[parseD(wkCur).getDay()]} ${dm(wkCur)} – ${DOW[parseD(we).getDay()]} ${dm(we)}/${parseD(we).getFullYear()}`;
  const list=DB.shifts.filter(s=>s.date>=wkCur&&s.date<=we).sort((a,b)=>(a.date+(a.start||"")).localeCompare(b.date+(b.start||"")));
  const sum=list.reduce((a,s)=>addC(a,calc[s.id]),Z0()),nw=list.filter(s=>!isLeave(s)).length;
  const lim=n(S().otAfter)||40,toOt=sum.h+(S().leaveOt?sum.hol+sum.pto:0),pct=Math.min(100,toOt/lim*100),left=lim-toOt;
  $("#wkSum").innerHTML=
    `<div class="card"><div class="lb">Tổng giờ tuần</div><div class="v">${fh(sum.h)} <span class="sub">/ ${lim} giờ</span>${sum.hol?` <span class="lvtag hol">+${fh(sum.hol)} Holiday</span>`:""}${sum.pto?` <span class="lvtag pto">+${fh(sum.pto)} PTO</span>`:""}</div><div class="bar ${hrBarCls(toOt,lim)}"><i style="width:${pct}%"></i></div><div class="sub">${left>0?`Còn ${fh(left)} giờ tới tăng ca`:"Đã vượt ngưỡng tăng ca"}${sum.hol||sum.pto?`<br>${S().leaveOt?"PTO/Holiday có tính vào mốc OT":"PTO/Holiday có lương, không tính vào mốc OT"}`:""}</div></div>`+
    `<div class="card pay"><div class="lb">Tiền công ước tính</div><div class="v">${money(sum.pay)}</div><div class="sub">Regular ${fh(sum.reg)} · OT ${fh(sum.ot)}${sum.hol?` · Holiday ${fh(sum.hol)}`:""}${sum.pto?` · PTO ${fh(sum.pto)}`:""} giờ<br>Trước thuế · ${nw} ca</div></div>`+
    `<div class="card ${sum.ot>0?"ot1":"ot0"}"><div class="lb">Tăng ca</div><div class="v">${sum.ot>0?fh(sum.ot)+" giờ":"—"}</div><div class="sub">${sum.ot>0?`Tính ×${n(S().otMult)||1.5} lương`:"Chưa có tăng ca"}</div></div>`;
  let h="";
  for(let k=0;k<7;k++){
    const d=addDays(wkCur,k),ds=list.filter(s=>s.date===d),isT=d===t,fut=d>t;
    const dc=ds.reduce((a,s)=>addC(a,calc[s.id]),Z0()),dh=dc.h+dc.hol+dc.pto,dp=dc.pay,dot=dc.ot;
    const head=`<div class="dh2"><span>${DOW[parseD(d).getDay()]} ${dm(d)}</span>${isT?`<span class="pill">Hôm nay</span>`:ds.length?`<button class="addb" data-add="${d}" title="Thêm ca">+</button>`:""}</div>`;
    const trow=s=>isLeave(s)
      ?`<div class="tr lv ${s.kind}" data-sh="${s.id}" title="${esc(s.note||"Sửa")}">${LV[s.kind]} ${fh(shiftHours(s)).replace(/\.00$/,"")}h${s.note?` · ${esc(s.note)}`:""}</div>`
      :`<div class="tr" data-sh="${s.id}" title="${esc(s.note||"Sửa ca")}">${esc(s.start)}–${esc(s.end)}${n(s.brk)?` · nghỉ ${n(s.brk)}′`:""}</div>`;
    h+=ds.length
      ?`<div class="day${isT?" today":""}${ds.some(isLeave)?" lvday":""}" data-day="${d}">${head}<div class="h">${fh(dh)} <small>giờ</small></div><span class="dbar${dot>0?" ot":""}"><i style="width:${Math.min(100,dh/10*100)}%"></i></span>${ds.map(trow).join("")}${dot>0?`<span class="otg">+${fh(dot)}h tăng ca</span>`:""}<div class="p">${money(dp)}</div></div>`
      :`<div class="day empty${isT?" today":fut?" future":""}" data-day="${d}">${head}<div class="plus">${isT?"+ Thêm ca":fut?"+":"Nghỉ"}</div></div>`;
  }
  $("#wkDays").innerHTML=h;
  const {cur:ckc,next:ckn}=checkFor(wkCur),ckp=ckc||ckn,ckq=ckp?payNet(ckp,calc,netRatio(calc)):null;
  $("#wkCheck").innerHTML=`<details class="ckfold"${ckOpen?" open":""}><summary><span>💵 Check ${ckp?dowl(ckp.pay)+" "+dmy(ckp.pay):""}</span><b>${ckp?money(periodSum(ckp,calc).pay):"—"}<small> trước thuế</small></b>${ckq?`<span class="net">thực nhận ${ckq.est?"~":""}${money(ckq.v)}</span>`:""}</summary>`+checkHtml(wkCur,calc)+payListHtml(calc)+`</details>`;
  bindPayList(calc);
  $$("#wkDays .day").forEach(el=>el.onclick=e=>{
    const sh=e.target.closest("[data-sh]"),add=e.target.closest("[data-add]");
    if(add)return openShift(null,add.dataset.add);
    if(sh)return openShift(sh.dataset.sh);
    const first=el.querySelector("[data-sh]");first?openShift(first.dataset.sh):openShift(null,el.dataset.day);
  });
  const mk=monthOf(wkCur),ms=DB.shifts.filter(s=>monthOf(s.date)===mk);
  const m=ms.reduce((a,s)=>addC(a,calc[s.id]),Z0());
  $("#wkMonth").innerHTML=`${mLabel(mk)}: <b>${ms.filter(s=>!isLeave(s)).length}</b> ca · <b>${fh(m.h)}</b> giờ làm · tăng ca <b>${fh(m.ot)}</b> giờ${m.hol?` · Holiday <b>${fh(m.hol)}</b> giờ`:""}${m.pto?` · PTO <b>${fh(m.pto)}</b> giờ`:""} · tiền công <b class="pos">${money(m.pay)}</b>`;
  renderClock();
}
function renderClock(){
  const b=$("#clockBtn"),i=$("#clockInfo"),c=$("#clockCard");
  c.classList.toggle("on",!!DB.clock);$("#clockAtWrap").classList.toggle("hidden",!!DB.clock);
  if(DB.clock){
    const st=new Date(DB.clock.start),sec=Math.max(0,Math.floor((Date.now()-st)/1000));
    const hm=Math.floor(sec/3600)+":"+String(Math.floor(sec/60)%60).padStart(2,"0")+":"+String(sec%60).padStart(2,"0");
    i.innerHTML=`<span class="st"><span class="dot"></span><b class="tm">${hm}</b></span><span class="since">${Date.now()<st?`chờ tới ${hhmm(st)}`:`vào ${hhmm(st)}`} · trừ nghỉ ${lunch()}′</span>`;
    b.textContent="⏹ Clock Out";b.className="btn clockbtn stop";
  }else{
    i.innerHTML=`<span class="st"><span class="dot"></span>Chưa vào ca</span>`;
    b.textContent="▶ Clock In";b.className="btn clockbtn go";
  }
}
setInterval(()=>{if(DB.clock&&!$("#mod-work").classList.contains("hidden"))renderClock()},1000);
$("#clockBtn").onclick=()=>{
  if(!DB.clock){
    // giờ vào lấy từ ô "Giờ vào" (mặc định 07:00) của hôm nay, không phải giờ bấm
    const [hh,mm]=($("#clockAt").value||"07:00").split(":").map(Number),st=new Date();st.setHours(hh,mm,0,0);
    DB.clock={start:st.getTime()};save();renderWork();return}
  const st=new Date(DB.clock.start),en=new Date(Math.max(Date.now(),DB.clock.start)); // Clock Out trước giờ vào thì không thành ca qua đêm
  DB.shifts.push({id:uid(),date:ymd(st),start:hhmm(st),end:hhmm(en),brk:lunch(),note:""});
  DB.clock=null;save();wkCur=weekStartOf(ymd(st));renderWork();
};
$("#wkPrev").onclick=()=>{wkCur=addDays(wkCur,-7);renderWork()};
$("#wkNext").onclick=()=>{wkCur=addDays(wkCur,7);renderWork()};
let shCur=null;
function shKindUI(){
  const f=$("#shForm"),k=f.kind.value,lv=k==="hol"||k==="pto";
  $$("#shForm .kw").forEach(x=>x.classList.toggle("hidden",lv));$$("#shForm .kl").forEach(x=>x.classList.toggle("hidden",!lv));
  f.start.required=f.end.required=!lv;f.hrs.required=lv;
  f.note.placeholder=k==="hol"?"Tên ngày lễ (vd. Thanksgiving)":k==="pto"?"Lý do (tuỳ chọn)":"";
  $("#shTitle").textContent=(shCur?"Sửa ":"Thêm ")+(lv?LV[k]:"ca làm");
}
$$("#shForm [name=kind]").forEach(r=>r.onchange=shKindUI);
function openShift(id,date,kind){
  shCur=id?DB.shifts.find(s=>s.id===id):null;
  const f=$("#shForm"),s=shCur||{date:date||today(),start:"",end:"",brk:lunch(),note:"",kind:kind||"work",hrs:8};
  f.date.value=s.date;f.start.value=s.start||"";f.end.value=s.end||"";f.brk.value=n(s.brk);f.note.value=s.note||"";
  f.kind.value=isLeave(s)?s.kind:"work";f.hrs.value=isLeave(s)?n(s.hrs):8;
  shKindUI();$("#shDel").style.display=shCur?"":"none";$("#shDlg").showModal();
}
$("#shForm").onsubmit=e=>{
  e.preventDefault();const f=e.target,k=f.kind.value;
  const v=k==="hol"||k==="pto"
    ?{date:f.date.value,kind:k,hrs:Math.min(24,Math.max(0,n(f.hrs.value))),start:"",end:"",brk:0,note:f.note.value.trim()}
    :{date:f.date.value,kind:"work",start:f.start.value,end:f.end.value,brk:n(f.brk.value),note:f.note.value.trim()};
  if(shCur)shCur=DB.shifts.find(s=>s.id===shCur.id)||(DB.shifts.push(shCur),shCur); // đồng bộ có thể đã thay object lúc đang mở
  if(shCur){Object.assign(shCur,v);if(v.kind==="work")delete shCur.hrs}else DB.shifts.push({id:uid(),...v});
  save();$("#shDlg").close();wkCur=weekStartOf(v.date);renderWork();
};
$("#shDel").onclick=()=>{if(shCur){delUndo("shifts",shCur,"Đã xoá ca",renderWork);$("#shDlg").close()}};
