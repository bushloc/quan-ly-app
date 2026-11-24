"use strict";
/* ===== Chi tiêu & Budget ===== */
let spM=mKey(new Date());
function expOf(mk){return DB.expenses.filter(e=>monthOf(e.date)===mk)}
/* Chi cố định: Cài đặt giữ 1 danh sách MẪU cố định (tên + nhóm) trong S().fixed, áp cho mọi tháng.
   Mỗi tháng chỉ lưu bản ghi type "co" khi có số tiền hoặc bấm Trả; id theo mẫu + tháng nên 2 máy không tạo trùng.
   Chưa ghi thì số tiền gợi ý = lần gần nhất trước đó (chữ mờ), bấm Trả là lấy số gợi ý.
   Trả thẻ tín dụng: type "the", chỉ để theo dõi, KHÔNG cộng vào chi (các món mua bằng thẻ đã ghi rồi, cộng nữa là trùng). */
const FIXED_CAT="📌 Cố định"; // giá trị cat đã lưu trong dữ liệu cũ, không hiện ra
const isChi=e=>e.type==="chi"||e.type==="co";
const fixedOf=mk=>DB.expenses.filter(e=>e.type==="co"&&monthOf(e.date)===mk).sort((a,b)=>(a.ord||0)-(b.ord||0));
/* 6 nhóm chi cố định, mỗi nhóm 1 màu (dùng ở Chi tiêu, Tổng quan, biểu đồ). Khoản cũ chưa có fxCat: đoán theo tên, không đoán được → Utilities */
const FXC=[["ins","Insurance","#3b82f6"],["sub","Subscription","#a855f7"],["rent","Rent/Mortgage","#f97316"],["car","Car Payment","#ec4899"],["util","Utilities","#06b6d4"],["loan","Loan/Credit","#a0785a"]];
const FXM=Object.fromEntries(FXC.map(([k,l,c])=>[k,{l,c}]));
const fxGuess=s=>{s=String(s||"").toLowerCase();return /insur|bảo hiểm|geico|allstate|progressive|state farm/.test(s)?"ins":/netflix|spotify|hulu|disney|youtube|prime|subscri|icloud|apple|gym|chatgpt|claude|adobe|xbox|playstation/.test(s)?"sub":/rent|mortgage|thuê|tiền nhà/.test(s)?"rent":/\bcar\b|xe|auto|toyota|honda|tesla/.test(s)?"car":/loan|credit|vay|nợ|student/.test(s)?"loan":"util"};
const fxCatOf=e=>FXM[e.fxCat]?e.fxCat:fxGuess(e.note);
// đã trả: bật/tắt bằng nút; khoản cũ chưa có cờ thì có số tiền = đã trả
const fxPaid=e=>e.paid!=null?!!e.paid:String(e.amount)!=="";
const fxLinked=(t,e)=>e.tplId===t.id||(!e.tplId&&e.note===t.name);
// danh sách mẫu; dữ liệu v1.6 (mỗi tháng 1 danh sách) chuyển 1 lần từ tháng gần nhất có khoản.
// id theo tên nên phone và máy tính tự chuyển ra cùng 1 mẫu, không bị đôi.
function fxTpl(){
  if(Array.isArray(S().fixed))return S().fixed;
  const cos=DB.expenses.filter(e=>e.type==="co"&&e.note),ms=[...new Set(cos.map(e=>monthOf(e.date)))].sort(),now=mKey(new Date());
  const src=ms.filter(m=>m<=now).pop()||ms[0],seen=new Set();
  S().fixed=(src?fixedOf(src):[]).filter(e=>e.note&&!seen.has(e.note)&&seen.add(e.note)).map(e=>({id:"n:"+e.note,name:e.note,fxCat:fxCatOf(e),from:monthOf(cos.filter(x=>x.note===e.note).map(x=>x.date).sort()[0])}));
  save();return S().fixed;
}
// số gợi ý: lần ghi gần nhất trước tháng mk
const fxSug=(t,mk)=>{const e=DB.expenses.filter(e=>e.type==="co"&&monthOf(e.date)<mk&&String(e.amount)!==""&&fxLinked(t,e)).sort((a,b)=>b.date.localeCompare(a.date))[0];return e?n(e.amount):""};
// 1 nguồn duy nhất cho Chi tiêu, Tổng quan và nhắc việc: mỗi mẫu 1 dòng (kèm bản ghi tháng đó nếu có) + khoản cũ không còn mẫu
function fxRows(mk){
  const recs=fixedOf(mk),used=new Set(),rows=[];
  fxTpl().forEach((t,i)=>{
    const e=recs.find(x=>!used.has(x)&&fxLinked(t,x));
    if(!e&&t.from&&mk<t.from)return; // tháng trước khi có khoản này
    if(e)used.add(e);
    rows.push({t,e,i,name:t.name||"(chưa đặt tên)",cat:FXM[t.fxCat]?t.fxCat:fxGuess(t.name),amt:e?e.amount:"",paid:e?fxPaid(e):false,sug:e&&String(e.amount)!==""?"":fxSug(t,mk)});
  });
  for(const e of recs)if(!used.has(e))rows.push({t:null,e,i:999,name:e.note||"(chưa đặt tên)",cat:fxCatOf(e),amt:e.amount,paid:fxPaid(e),sug:""});
  const o=Object.fromEntries(FXC.map(([k],i)=>[k,i]));
  return rows.sort((a,b)=>o[a.cat]-o[b.cat]||a.i-b.i);
}
// bản ghi của 1 dòng trong tháng mk (tạo khi cần)
function fxRec(row,mk){
  if(row.e){const e=DB.expenses.find(x=>x.id===row.e.id);if(e)return e} // tìm lại: đồng bộ có thể đã thay object
  const t=row.t,id="co_"+t.id+"_"+mk;let e=DB.expenses.find(x=>x.id===id);
  if(!e){e={id,date:mk+"-01",type:"co",cat:FIXED_CAT,note:t.name,tplId:t.id,fxCat:row.cat,amount:"",paid:false,ord:row.i+1};DB.expenses.push(e)}
  return e;
}
/* Chi tiêu: mỗi khoản 1 dòng: chấm màu nhóm · tên · số tiền (gợi ý mờ) · nút Trả. Thêm, đổi tên, đổi nhóm, xoá: Cài đặt → Chi cố định */
const foldOpen=new Set();
function foldCard(card,key){
  const rows=[...card.querySelectorAll("[data-fx],[data-cc]")];if(!rows.length)return;
  const all=rows.every(r=>r.matches(".paid")||r.querySelector('[aria-pressed="true"]'));
  const head=card.querySelector(".chd");if(!head)return;
  let body=card.querySelector(".cbody");
  if(!body){body=document.createElement("div");body.className="cbody";[...card.children].forEach(c=>{if(c!==head)body.appendChild(c)});card.appendChild(body)}
  const can=all||key==="fx";
  card.classList.toggle("foldable",can);card.classList.toggle("folded",can&&!foldOpen.has(key));
  head.onclick=can?e=>{if(e.target.closest("[data-fxall]"))return;foldOpen.has(key)?foldOpen.delete(key):foldOpen.add(key);card.classList.toggle("folded")}:null;
  const m=head.querySelector(".muted");if(m&&all&&!m.dataset.ok){m.dataset.ok=1;m.insertAdjacentHTML("beforeend",' <span class="okc">✓</span>')}
}
function renderFixed(){
  const rows=fxRows(spM),tot=rows.reduce((a,r)=>a+n(r.amt),0),paidN=rows.filter(r=>r.paid).length;
  $("#fxCard").innerHTML=`<div class="chd"><h3>Chi cố định</h3><span class="muted">${rows.length?`Đã trả ${paidN}/${rows.length} · `:""}<b>${money(tot)}</b></span></div>`+
    (rows.length?`<div class="bar thin"><i style="width:${paidN/rows.length*100}%"></i></div>`+rows.map((r,k)=>`<div class="lrow fxrow${r.paid?" paid":""}" data-fx="${k}" style="--g:${FXM[r.cat].c}"><span class="fxN" title="${FXM[r.cat].l}"><i class="gdot"></i>${esc(r.name)}</span><input class="fxAmt" type="number" step="0.01" min="0" inputmode="decimal" value="${esc(r.amt)}" placeholder="${r.sug!==""?n(r.sug).toFixed(2):"0.00"}" aria-label="Số tiền ${esc(r.name)}"><button type="button" class="pt${r.paid?" on":""}" data-fxpaid aria-pressed="${r.paid}">${r.paid?"Đã trả":"Trả"}</button></div>`).join("")
      :emptyBox("Chưa có khoản cố định","🏠","+ Thêm khoản","fx","Tiền nhà, điện nước, bảo hiểm… mỗi tháng bấm Trả là xong.").replace('class="emp"','class="emp sm"'))+
    `<p class="hint">Số mờ là gợi ý theo tháng trước, bấm Trả là lấy số đó. Thêm, đổi tên, đổi nhóm ở <a href="#" id="fxGo">Cài đặt</a>.</p>`;
  $$("#fxCard [data-fx]").forEach(el=>{
    const row=rows[+el.dataset.fx],inp=el.querySelector(".fxAmt");
    inp.oninput=inp.onchange=ev=>{const v=ev.target.value,e=fxRec(row,spM);e.amount=v===""?"":n(v);save();if(ev.type==="change")renderSpend()};
    // theo đúng nút đang thấy (không lật 2 lần khi ô số vừa lưu xong); chưa nhập số thì lấy số gợi ý
    el.querySelector("[data-fxpaid]").onclick=b=>{const e=fxRec(row,spM),pay=b.currentTarget.getAttribute("aria-pressed")!=="true";
      if(pay&&String(e.amount)==="")e.amount=inp.value!==""?n(inp.value):row.sug;
      e.paid=pay;save();renderSpend()};
  });
  $("#fxGo").onclick=e=>{e.preventDefault();showMod("set");$("#fxSet").scrollIntoView({block:"start"})};
}
// Cài đặt → Chi cố định: danh sách mẫu (tên + nhóm), dùng cho mọi tháng
function renderFixedSet(){
  const ts=fxTpl(),sel=k=>`<select class="fxCatSel" aria-label="Nhóm">${FXC.map(([v,l])=>`<option value="${v}"${v===k?" selected":""}>${l}</option>`).join("")}</select>`;
  $("#fxSetList").innerHTML=ts.map(t=>{const k=FXM[t.fxCat]?t.fxCat:"util";return `<div class="lrow fxsrow" data-fxs="${esc(t.id)}" style="--g:${FXM[k].c}"><i class="gdot"></i><input class="fxName" value="${esc(t.name||"")}" placeholder="Tên (vd. Rent)" aria-label="Tên khoản">${sel(k)}<button type="button" class="mini" data-fxdel title="Xoá khoản" aria-label="Xoá khoản">✕</button></div>`}).join("")||`<p class="muted" style="margin:6px 0">Chưa có khoản nào.</p>`;
  $$("#fxSetList [data-fxs]").forEach(r=>{
    const id=r.dataset.fxs,t=()=>fxTpl().find(x=>x.id===id)||{};
    // đổi tên: gắn các tháng đã ghi theo tên cũ vào mẫu trước, để không rời khỏi mẫu
    r.querySelector(".fxName").oninput=r.querySelector(".fxName").onchange=ev=>{const x=t();for(const e of DB.expenses)if(e.type==="co"&&!e.tplId&&e.note===x.name)e.tplId=x.id;x.name=ev.target.value.trim();for(const e of DB.expenses)if(e.type==="co"&&e.tplId===x.id)e.note=x.name;save()};
    r.querySelector(".fxCatSel").onchange=ev=>{const x=t(),k=ev.target.value;for(const e of DB.expenses)if(e.type==="co"&&fxLinked(x,e))e.fxCat=k;x.fxCat=k;r.style.setProperty("--g",FXM[k].c);save()};
    r.querySelector("[data-fxdel]").onclick=async()=>{const x=t();if(await ask(`Xoá “${x.name||"khoản này"}” khỏi chi cố định?\n(Các tháng đã trả vẫn giữ.)`)){
      const now=mKey(new Date());DB.expenses=DB.expenses.filter(e=>!(e.type==="co"&&fxLinked(x,e)&&monthOf(e.date)>=now&&!fxPaid(e)));
      S().fixed=fxTpl().filter(y=>y.id!==id);save();renderFixedSet()}};
  });
}
$("#fxsAdd").onclick=()=>{fxTpl().push({id:uid(),name:"",fxCat:"util",from:mKey(new Date())});save();renderFixedSet();const r=$$("#fxSetList .fxName");r[r.length-1].focus()};
const cards=()=>Array.isArray(S().cards)?S().cards:(S().cards=[]);
const daysIn=mk=>{const [y,m]=mk.split("-").map(Number);return new Date(y,m,0).getDate()};
// thông tin thẻ (tên, 4 số cuối, due) chỉ sửa trong Cài đặt; Chi tiêu chỉ ghi nhận đã trả
const dueDay=c=>n(c.due)||1;
const dueOf=(c,mk)=>mk+"-"+String(Math.min(Math.max(1,dueDay(c,mk)),daysIn(mk))).padStart(2,"0");
const cardPay=(c,mk)=>DB.expenses.find(e=>e.type==="the"&&e.cardId===c.id&&e.month===mk);
// trạng thái 1 thẻ trong 1 tháng: đã trả / quá hạn / sắp due (≤3 ngày) / chưa tới
function cardState(c,mk){
  const p=cardPay(c,mk);if(p&&p.paid)return ["paid","✓ Đã trả"];
  const d=Math.round((parseD(dueOf(c,mk))-parseD(today()))/864e5);
  return d<0?["late",`Quá due ${-d} ngày`]:d<=3?["soon",d===0?"Due hôm nay":`Còn ${d} ngày`]:["",`Còn ${d} ngày`];
}
function renderCards(){
  const cs=cards().filter(c=>c.name);
  const paidN=cs.filter(c=>(cardPay(c,spM)||{}).paid).length;
  $("#ccCard").innerHTML=`<div class="chd"><h3>Trả thẻ tín dụng</h3>${cs.length?`<span class="muted">Đã trả ${paidN}/${cs.length}</span>`:""}</div>`+
    // chưa trả lên trên (gần due trước), đã trả xuống dưới
    (cs.length?cs.map(c=>({c,p:cardPay(c,spM)||{}})).sort((a,b)=>(!!a.p.paid-!!b.p.paid)||dueOf(a.c,spM).localeCompare(dueOf(b.c,spM))).map(({c,p})=>{const [st,lb]=cardState(c,spM),due=dueOf(c,spM);
      // nút "Đã trả / Chưa trả" bật tắt được; điền số tiền cũng tự thành đã trả
      return `<div class="ccrow ${st}" data-cc="${esc(c.id)}"><div class="ccchk"><span><b>${esc(c.name)}</b>${c.last4?` <span class="mono muted">••${esc(c.last4)}</span>`:""}<br>`+
        (p.paid?`<span class="ccpaid">Đã trả${p.date?` · ${fdate(p.date+"T12:00:00")}`:""}</span>`
          :`<span class="ccdue">Due ${fdate(due+"T12:00:00")} · ${lb}</span>`)+`</span></div>`+
        `<button type="button" class="pt${p.paid?" on":""}" data-ccpaid aria-pressed="${!!p.paid}">${p.paid?"Đã trả":"Trả"}</button></div>`}).join("")
      +`<p class="hint">Chỉ nhắc ngày Due, không tính vào chi/thu. Sửa tên, 4 số cuối, due ở <a href="#" id="ccGo">Cài đặt</a>.</p>`
      :emptyBox("Chưa có thẻ tín dụng","💳","+ Thêm thẻ","cc","Thêm thẻ để app nhắc ngày Due mỗi tháng.").replace('class="emp"','class="emp sm"'));
  if($("#ccGo"))$("#ccGo").onclick=e=>{e.preventDefault();showMod("set");$("#cardSet").scrollIntoView({block:"start"})};
  $$("#ccCard [data-cc]").forEach(r=>{
    const c=cs.find(x=>x.id===r.dataset.cc);
    const rec=()=>{let p=cardPay(c,spM);if(!p){p={id:"the_"+c.id+"_"+spM,type:"the",cardId:c.id,month:spM,note:c.name,cat:"💳 Trả thẻ",paid:false,amount:"",date:""};DB.expenses.push(p)}return p};
    // bấm lại để về chưa trả (giữ số tiền đã nhập)
    r.querySelector("[data-ccpaid]").onclick=b=>{const p=rec();p.paid=b.currentTarget.getAttribute("aria-pressed")!=="true"; /* theo nút đang thấy, không lật 2 lần khi ô số vừa tự đánh dấu đã trả */p.note=c.name;p.date=p.paid?(p.date||today()):"";save();renderSpend()};
  });
}
// Cài đặt → thẻ tín dụng
function renderCardSet(){
  $("#ccList").innerHTML=cards().map(c=>`<div class="ccset" data-ccs="${esc(c.id)}"><label>Tên thẻ<input data-k="name" value="${esc(c.name||"")}" placeholder="vd. Chase Freedom"></label><label>4 số cuối<input data-k="last4" value="${esc(c.last4||"")}" inputmode="numeric" maxlength="4" placeholder="tuỳ chọn"></label><label>Due ngày<input data-k="due" type="number" min="1" max="31" value="${esc(c.due||"")}" placeholder="1–31"></label><label>Ghi chú<input data-k="note" value="${esc(c.note||"")}" placeholder="vd. autopay"></label><button type="button" class="btn danger" data-ccdel title="Xoá thẻ">✕</button></div>`).join("")||`<p class="muted">Chưa có thẻ nào.</p>`;
  $$("#ccList [data-ccs]").forEach(r=>{
    const id=r.dataset.ccs;
    // tìm lại thẻ mỗi lần lưu: đồng bộ cloud có thể đã thay cả object cài đặt, sửa vào object cũ là mất
    const live=()=>{let c=cards().find(x=>x.id===id);if(!c){c={id,name:"",last4:"",due:"",note:""};cards().push(c)}return c};
    const val=(i,done)=>{let v=i.value.trim();if(i.dataset.k==="last4")v=v.replace(/\D/g,"").slice(-4);if(i.dataset.k==="due")v=v?Math.min(31,Math.max(1,Math.round(n(v))||1)):"";if(done)i.value=v;return v};
    // lưu ngay khi gõ (phone có thể đóng app mà không rời ô), rời ô thì làm gọn số
    r.querySelectorAll("input[data-k]").forEach(i=>{i.oninput=()=>{live()[i.dataset.k]=val(i);save()};i.onchange=()=>{live()[i.dataset.k]=val(i,true);save()}});
    r.querySelector("[data-ccdel]").onclick=async()=>{const c=live();if(await ask(`Xoá thẻ “${c.name||"(chưa đặt tên)"}”?\nCác lần đã trả vẫn giữ trong dữ liệu.`)){S().cards=cards().filter(x=>x.id!==id);save();renderCardSet()}};
  });
}
$("#ccAdd").onclick=()=>{cards().push({id:uid(),name:"",last4:"",due:"",note:""});save();renderCardSet();const r=$$("#ccList [data-k=name]");r[r.length-1].focus()};
function budgetBars(mk){
  const spent={};for(const e of expOf(mk))if(e.type==="chi")spent[e.cat]=(spent[e.cat]||0)+n(e.amount);
  const rows=Object.keys(DB.budgets).filter(c=>n(DB.budgets[c])>0);
  const others=Object.keys(spent).filter(c=>!(n(DB.budgets[c])>0));
  let h="";
  for(const c of rows){
    const lim=n(DB.budgets[c]),sp=spent[c]||0,p=Math.min(100,sp/lim*100);
    const cm=mKey(new Date()),dim=new Date(+mk.slice(0,4),+mk.slice(5),0).getDate(),dn=new Date().getDate(),left=dim-dn+1,pace=mk===cm&&sp<=lim&&p>dn/dim*100+15;
    h+=`<div class="row" style="justify-content:space-between"><span>${esc(c)}</span><span class="${sp>lim?"neg":""}">${money(sp)} / ${money(lim)} <span class="muted">(còn ${money(lim-sp)})</span></span></div><div class="bar ${sp>lim?"over":p>85||pace?"warn":""}"><i style="width:${p}%"></i></div>${mk===cm&&sp<lim?`<div class="perday ${pace?"warn":""}">≈ ${money((lim-sp)/left)}/ngày · ${left} ngày còn lại${pace?" · đang chi nhanh hơn dự kiến":""}</div>`:""}`;
  }
  if(others.length)h+=`<div class="muted" style="font-size:13px">Chưa đặt hạn mức: ${others.map(c=>`${esc(c)} ${money(spent[c])}`).join(" · ")}</div>`;
  return h;
}
function fillCats(sel,val){
  sel.innerHTML=DB.cats.map(c=>`<option>${esc(c)}</option>`).join("");
  if(val&&!DB.cats.includes(val))sel.insertAdjacentHTML("beforeend",`<option>${esc(val)}</option>`);
  if(val)sel.value=val;
}
function renderSpend(){
  if(holdWhileTyping("spend",$("#mod-spend"),renderSpend))return;
  $("#spMonth").textContent=mLabel(spM);
  const all=expOf(spM),list=all.filter(e=>e.type==="chi"||e.type==="thu"); // cố định + trả thẻ hiện ở 2 ô riêng
  const ms=monthStats(spM,calcShifts()),chi=all.filter(isChi).reduce((a,e)=>a+n(e.amount),0),thu=ms.ebay+ms.wage+list.filter(e=>e.type==="thu").reduce((a,e)=>a+n(e.amount),0);
  renderFixed();renderCards();foldCard($("#fxCard"),"fx");foldCard($("#ccCard"),"cc");
  const lim=Object.values(DB.budgets).reduce((a,v)=>a+n(v),0);
  const budSpent=Object.keys(DB.budgets).filter(c=>n(DB.budgets[c])>0).reduce((a,c)=>a+list.filter(e=>e.type==="chi"&&e.cat===c).reduce((x,e)=>x+n(e.amount),0),0);
  $("#spSum").innerHTML=`<div>Tổng chi<b>${money(chi)}</b></div><div>Tổng thu<b>${money(thu)}</b><small class="sub2">gồm lương &amp; eBay</small></div><div>Thu − chi<b class="${thu-chi>=0?"pos":"neg"}">${money(thu-chi)}</b></div>`+(lim>0?`<div>Ngân sách còn lại<b class="${lim-budSpent>=0?"pos":"neg"}">${money(lim-budSpent)}</b></div>`:"");
  // bảng tóm tắt theo danh mục (gập trong thẻ tổng). Trả thẻ không tính; chi cố định gộp 1 dòng
  {
    const by={},cnt={},inc={};let top=0;
    for(const e of all){
      if(isChi(e)){const k=e.type==="co"?"📌 Chi cố định":e.cat||"Khác";by[k]=(by[k]||0)+n(e.amount);cnt[k]=(cnt[k]||0)+1}
      else if(e.type==="thu"){const k=e.cat||"Khác";inc[k]=(inc[k]||0)+n(e.amount)}
    }
    const rows=Object.entries(by).filter(r=>r[1]>0).sort((a,b)=>b[1]-a[1]);top=rows.reduce((a,r)=>a+r[1],0);
    const tr=([k,v])=>`<div class="spcr"><span class="k">${esc(k)}</span><span class="c">${cnt[k]} khoản</span><span class="p">${top?Math.round(v/top*100):0}%</span><b class="a">${money(v)}</b><span class="bar thin"><i style="width:${top?v/top*100:0}%"></i></span></div>`;
    const irows=[...(ms.wage>0?[[`💵 Lương${ms.wageEst?" (ước tính)":""}`,ms.wage]]:[]),...(ms.ebay>0?[["📦 Lãi eBay",ms.ebay]]:[]),...Object.entries(inc).filter(r=>r[1]>0).sort((a,b)=>b[1]-a[1])];
    $("#spCatBody").innerHTML=(rows.length?`<div class="spch">Chi</div>${rows.map(tr).join("")}<div class="spcr tot"><span class="k">Tổng chi</span><b class="a neg">${money(top)}</b></div>`:`<p class="muted" style="margin:6px 0">Tháng này chưa có khoản chi.</p>`)+
      (irows.length?`<div class="spch">Thu</div>${irows.map(([k,v])=>`<div class="spcr"><span class="k">${esc(k)}</span><b class="a pos">${money(v)}</b></div>`).join("")}<div class="spcr tot"><span class="k">Tổng thu</span><b class="a pos">${money(irows.reduce((a,r)=>a+r[1],0))}</b></div>`:"");
  }
  const f=$("#spForm");
  if(!f.date.value)f.date.value=today();
  fillCats(f.cat,f.cat.value);
  $("#spBars").innerHTML=budgetBars(spM)||emptyBox("Chưa đặt ngân sách","🎯","","","Bấm “Chỉnh ngân sách” để đặt mức chi mỗi danh mục.").replace('class="emp"','class="emp sm"');
  const byDay={};for(const e of list)(byDay[e.date]??=[]).push(e);
  const days=Object.keys(byDay).sort().reverse();
  $("#spList").innerHTML=days.length?days.map(d=>{
    const arr=byDay[d],dt=arr.filter(e=>e.type==="chi").reduce((a,e)=>a+n(e.amount),0);
    return `<div class="daygrp"><span>${DOW[parseD(d).getDay()]} ${d}</span><span>${dt?"chi "+money(dt):""}</span></div>`+
      arr.map(e=>`<div class="exrow" data-ex="${e.id}"><span class="tag s-kho">${esc(e.cat)}</span><span>${esc(e.note||"")}</span><span class="a ${e.type==="thu"?"pos":""}">${e.type==="thu"?"+":"-"}${money(n(e.amount))}</span></div>`).join("");
  }).join(""):emptyBox("Tháng này chưa có khoản nào","🧾","+ Ghi khoản đầu tiên","spend","Ghi chi tiêu hoặc tiền thu để biết cuối tháng còn lại bao nhiêu.");
  $$("#spList [data-ex]").forEach(r=>r.onclick=()=>openExpense(r.dataset.ex));
}
$("#spPrev").onclick=()=>{spM=mShift(spM,-1);renderSpend()};
$("#spNext").onclick=()=>{spM=mShift(spM,1);renderSpend()};
$("#spForm").onsubmit=e=>{
  e.preventDefault();const f=e.target;
  DB.expenses.push({id:uid(),date:f.date.value||today(),type:f.type.value,amount:n(f.amount.value),cat:f.cat.value,note:f.note.value.trim()});
  save();spM=monthOf(f.date.value||today());f.amount.value="";f.note.value="";renderSpend();f.amount.focus();
};
let exCur=null;
function openExpense(id){
  exCur=DB.expenses.find(e=>e.id===id);if(!exCur)return;
  const f=$("#exForm");f.date.value=exCur.date;f.type.value=exCur.type;f.amount.value=exCur.amount;f.note.value=exCur.note||"";
  fillCats(f.cat,exCur.cat);$("#exDlg").showModal();
}
$("#exForm").onsubmit=e=>{
  e.preventDefault();const f=e.target;
  exCur=DB.expenses.find(x=>x.id===exCur.id)||(DB.expenses.push(exCur),exCur); // đồng bộ có thể đã thay object lúc đang mở
  Object.assign(exCur,{date:f.date.value,type:f.type.value,amount:n(f.amount.value),cat:f.cat.value,note:f.note.value.trim()});
  save();$("#exDlg").close();renderSpend();
};
$("#exDel").onclick=()=>{if(exCur){delUndo("expenses",exCur,"Đã xoá khoản chi",renderSpend);$("#exDlg").close()}};
// ngân sách
function bgRow(name,limit,locked){
  return `<div class="row" style="margin-bottom:8px" data-bgrow><input class="bgName" value="${esc(name)}" ${locked?"readonly":""} placeholder="Tên danh mục" style="flex:1"><input class="bgLim" type="number" min="0" step="1" value="${limit??""}" placeholder="$/tháng" style="width:110px"><button type="button" class="btn danger" data-bgdel>✕</button></div>`;
}
$("#spBudgetEdit").onclick=()=>{
  $("#bgList").innerHTML=DB.cats.map(c=>bgRow(c,DB.budgets[c]||"",true)).join("");
  bindBgDel();$("#bgDlg").showModal();
};
function bindBgDel(){$$("#bgList [data-bgdel]").forEach(b=>b.onclick=async()=>{
  const row=b.closest("[data-bgrow]"),name=row.querySelector(".bgName").value.trim();
  if(name&&DB.expenses.some(e=>e.cat===name)){await say(`Danh mục “${name}” đã có khoản chi nên không xoá được.`);return}
  row.remove();
})}
$("#bgAdd").onclick=()=>{$("#bgList").insertAdjacentHTML("beforeend",bgRow("","",false));bindBgDel();const r=$$("#bgList .bgName");r[r.length-1].focus()};
$("#bgForm").onsubmit=e=>{
  e.preventDefault();const cats=[],bud={};
  $$("#bgList [data-bgrow]").forEach(r=>{const nm=r.querySelector(".bgName").value.trim();if(!nm||cats.includes(nm))return;cats.push(nm);const l=n(r.querySelector(".bgLim").value);if(l>0)bud[nm]=l});
  DB.cats=cats;DB.budgets=bud;save();$("#bgDlg").close();renderSpend();
};
