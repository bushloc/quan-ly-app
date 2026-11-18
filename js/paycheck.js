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
function checkHtml(ref,calc){
  const {cur,next}=checkFor(ref),t=today();
  let h="";
  if(cur){const c=periodSum(cur,calc);
    h+=`<div class="ck"><div><div class="ckd">${cur.pay<t?"Đã nhận":"Nhận"} <b>${dowl(cur.pay)} ${dmy(cur.pay)}</b> · cho kỳ <b>${dmy(cur.st)} – ${dmy(cur.en)}</b></div><div class="ckv">${money(c.pay)}</div></div><div class="ckd" style="text-align:right">${c.reg.toFixed(2)} giờ thường${c.ot>0?` + <b class="neg">${c.ot.toFixed(2)} giờ tăng ca</b>`:""}${leaveTxt(c)}<br>${c.n} ca · trước thuế</div></div>`;
  }else h+=`<div class="ckv none">Tuần này không có check</div>`;
  if(next){const c=periodSum(next,calc),done=next.en<t;
    h+=`<div class="cknext">Check kế tiếp: <b>${dowl(next.pay)} ${dmy(next.pay)}</b> · kỳ ${dmy(next.st)} – ${dmy(next.en)} · ${done?"":"tạm tính "}<b class="pos">${money(c.pay)}</b> (${c.h.toFixed(2)} giờ làm${c.hol+c.pto?` + ${(c.hol+c.pto).toFixed(2)} giờ Holiday/PTO`:""})</div>`;
  }
  return h;
}

// Các check gần đây: mỗi dòng có ô "Thực nhận" (số trên paystub). Chưa nhập thì ô để số ước tính mờ.
function payListHtml(calc){
  const t=today(),ratio=netRatio(calc);let kN=Math.floor((dayDiff(t,payStart())-PAY_LAG)/14)-1;
  while(payPeriod(kN).pay<t)kN++; // check kế tiếp (chưa tới ngày nhận)
  const rows=[];for(let k=kN;k>=kN-6;k--)rows.push(payPeriod(k));
  const body=rows.map(pp=>{const g=periodSum(pp,calc).pay,e=payRec(pp),has=payHas(e),est=g*ratio,fut=pp.pay>=t&&!has;
    if(!has&&!g&&!fut)return "";
    return `<div class="plrow${has?" got":""}${fut?" fut":""}" data-pp="${pp.st}"><span class="pld"><b>${dowl(pp.pay)} ${dmy(pp.pay)}</b> <span class="muted">kỳ ${dmy(pp.st)}–${dmy(pp.en)}</span></span><span class="plg">${money(g)} <small>trước thuế</small></span><span class="fxD">$</span><input class="plNet" type="number" step="0.01" min="0" inputmode="decimal" value="${has?esc(e.amount):""}" placeholder="${est.toFixed(2)}" aria-label="Thực nhận check ${dmy(pp.pay)}"></div>`}).join("");
  return `<div class="pl"><div class="pl-h"><b>Thực nhận từng check</b><span class="muted">gõ số trên paystub · số mờ là ước tính</span></div>${body}</div>`;
}
function bindPayList(calc){
  $$("#wkCheck [data-pp]").forEach(r=>{
    const st=r.dataset.pp,pp={st,en:addDays(st,13),pay:addDays(st,PAY_LAG)},inp=r.querySelector(".plNet");
    const rec=()=>{let e=payRec(pp);if(!e){e={id:"pay_"+st,type:"pay",st,date:pp.pay,cat:"💵 Lương",note:"Check lương",amount:""};DB.expenses.push(e)}return e};
    // lưu ngay khi gõ; vẽ lại (cập nhật tổng) khi rời ô
    inp.oninput=inp.onchange=ev=>{const e=rec(),v=ev.target.value;e.amount=v===""?"":n(v);e.gross=periodSum(pp,calc).pay;save();if(ev.type==="change")renderWork()};
  });
}
