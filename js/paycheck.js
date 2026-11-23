"use strict";
/* ===== Check lương: kỳ 2 tuần, check nhận T5 của tuần sau khi kỳ kết thúc ===== */
const dayDiff=(a,b)=>Math.round((parseD(a)-parseD(b))/864e5);
const payStart=()=>/^\d{4}-\d{2}-\d{2}$/.test(S().payStart||"")?S().payStart:"2026-11-01";
const PAY_LAG=18; // ngày bắt đầu kỳ + 18 = thứ 5 sau khi kỳ 14 ngày kết thúc
function payPeriod(k){const st=addDays(payStart(),14*k);return {st,en:addDays(st,13),pay:addDays(st,PAY_LAG)}}
function periodSum(pp,calc){
  const ss=DB.shifts.filter(s=>s.date>=pp.st&&s.date<=pp.en),r=ss.reduce((a,s)=>addC(a,calc[s.id]),Z0());
  r.n=ss.filter(s=>!isLeave(s)).length;return r;
}
// kỳ có ngày nhận check rơi vào tuần chứa ref (hoặc null), và kỳ nhận check kế tiếp sau tuần đó
function checkFor(ref){
  const ws=weekStartOf(ref),we=addDays(ws,6),k0=Math.floor((dayDiff(ws,payStart())-PAY_LAG)/14);
  let cur=null,next=null;
  for(let k=k0-1;k<=k0+2;k++){const pp=payPeriod(k);if(pp.pay>=ws&&pp.pay<=we)cur=pp;else if(pp.pay>we&&!next)next=pp}
  return {cur,next};
}
const dmy=s=>{const d=parseD(s);return d.getDate()+"/"+(d.getMonth()+1)};
const dowl=s=>["CN","T2","T3","T4","T5","T6","T7"][parseD(s).getDay()];

