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
const fh=h=>h.toFixed(2);
const lunch=()=>{const v=parseFloat(S().lunch);return isFinite(v)&&v>=0?v:30};
// thanh giờ tuần: xanh khi còn xa, vàng khi còn ≤5 giờ tới ngưỡng, đỏ khi tăng ca
const hrBarCls=(tot,lim)=>tot>lim?"over":tot>=lim-5?"warn":"go";
const dm=s=>{const d=parseD(s);return d.getDate()+"/"+(d.getMonth()+1)};
// trang Giờ làm theo tháng đang xem trên lịch (calM); OT vẫn tính theo tuần
function renderWork(){
  if(holdWhileTyping("work",$("#mod-work"),renderWork))return;
  const t=today();
  const calc=calcShifts(),mk=(typeof calM!=="undefined"&&calM)||monthOf(t),lim=n(S().otAfter)||40;
  const ms=DB.shifts.filter(s=>monthOf(s.date)===mk),m=ms.reduce((a,s)=>addC(a,calc[s.id]),Z0()),nw=ms.filter(s=>!isLeave(s)).length;
  // dòng "Tuần này": chỉ khi lịch đang ở tháng hiện tại
  if(mk===monthOf(t)){
    const w0=weekStartOf(t),w1=addDays(w0,6),w=DB.shifts.filter(s=>s.date>=w0&&s.date<=w1).reduce((a,s)=>addC(a,calc[s.id]),Z0());
    const toOt=w.h+(S().leaveOt?w.hol+w.pto:0),left=lim-toOt;
    $("#wkLine").innerHTML=`<span>Tuần này: <b>${fh(toOt).replace(/\.00$/,"")}</b> / ${lim} giờ</span><span class="bar ${hrBarCls(toOt,lim)}"><i style="width:${Math.min(100,toOt/lim*100)}%"></i></span><span class="${left>0?"":"neg"}">${left>0?`còn ${fh(left).replace(/\.00$/,"")}h tới OT`:`+${fh(w.ot)}h OT`}</span>`;
    $("#wkLine").style.display="";
  }else $("#wkLine").style.display="none";
  // tổng kết giờ tháng: tách Regular / OT / PTO-Holiday, mỗi phần có giờ + tiền
  {const w=n(S().wage),mult=n(S().otMult)||1.5,lv=m.hol+m.pto,tot=m.h+lv,pc=x=>tot?(x/tot*100).toFixed(2)+"%":"0",
    col=(c,l,h,pay,sub)=>`<div class="ms-c ${c}"><span><i></i>${l}</span><b>${fh(h).replace(/\.00$/,"")}<small> giờ</small></b><em>${money(pay)}</em>${sub?`<small>${sub}</small>`:""}</div>`;
   $("#wkSum").innerHTML=`<div class="card msum"><div class="ms-h"><div><div class="lb">Giờ làm ${mLabel(mk).toLowerCase()}</div><div class="v">${fh(tot).replace(/\.00$/,"")} <span class="sub">giờ · ${nw} ca</span></div></div><div class="ms-p"><div class="lb">Tiền công</div><b>${money(m.pay)}</b><span class="sub">trước thuế</span></div></div>
    <div class="ms-bar">${m.reg?`<i class="brg" style="width:${pc(m.reg)}"></i>`:""}${m.ot?`<i class="bot" style="width:${pc(m.ot)}"></i>`:""}${m.hol?`<i class="bhl" style="width:${pc(m.hol)}"></i>`:""}${m.pto?`<i class="bpt" style="width:${pc(m.pto)}"></i>`:""}</div>
    <div class="ms-cols">${col("rg","Regular",m.reg,m.reg*w)}${col("ot","OT",m.ot,m.ot*w*mult,`×${mult}`)}${col("lv","PTO/Holiday",lv,lv*w,lv?[m.pto?`PTO ${fh(m.pto).replace(/\.00$/,"")}`:"",m.hol?`Holiday ${fh(m.hol).replace(/\.00$/,"")}`:""].filter(Boolean).join(" · "):"")}</div></div>`;}
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
// mỗi ngày chỉ 1 ca làm: ca mới (Clock Out hoặc thêm tay) đè lên ca cũ cùng ngày; Holiday/PTO giữ nguyên
function putWork(v,cur){
  const same=DB.shifts.filter(s=>s.date===v.date&&!isLeave(s)&&s!==cur);
  const t=cur||same.shift(),rep=cur?same.length>0:!!t;
  if(t){Object.assign(t,v);delete t.hrs}else DB.shifts.push({id:uid(),note:"",...v});
  for(const s of same){const i=DB.shifts.indexOf(s);if(i>=0)DB.shifts.splice(i,1)}
  return rep;
}
$("#clockBtn").onclick=()=>{
  if(!DB.clock){
    // giờ vào lấy từ ô "Giờ vào" (mặc định 07:00) của hôm nay, không phải giờ bấm
    const [hh,mm]=($("#clockAt").value||"07:00").split(":").map(Number),st=new Date();st.setHours(hh,mm,0,0);
    DB.clock={start:st.getTime()};save();renderWork();return}
  const st=new Date(DB.clock.start),en=new Date(Math.max(Date.now(),DB.clock.start)); // Clock Out trước giờ vào thì không thành ca qua đêm
  const rep=putWork({date:ymd(st),kind:"work",start:hhmm(st),end:hhmm(en),brk:lunch()});
  DB.clock=null;save();calM=monthOf(ymd(st));renderWork();if(rep)toast("Đã thay ca cũ trong ngày bằng ca mới");
};
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
  let rep=false;
  if(v.kind==="work")rep=putWork(v,shCur);
  else if(shCur)Object.assign(shCur,v);else DB.shifts.push({id:uid(),...v});
  save();if(rep)toast("Đã thay ca cũ trong ngày bằng ca này");$("#shDlg").close();calM=monthOf(v.date);renderWork();
};
$("#shDel").onclick=()=>{if(shCur){delUndo("shifts",shCur,"Đã xoá ca",renderWork);$("#shDlg").close()}};
