"use strict";
/* ===== Bán hàng eBay: tab theo bước, thẻ theo đơn, kho theo lô ===== */
let ebTab="kho",ebView="card";
try{ebTab=localStorage.getItem("ebTab")||"kho";ebView=localStorage.getItem("ebView")||"card"}catch(e){}
// có tracking = đã ship = Hoàn thành (trạng thái hãng chỉ hiện thêm trên thẻ)
function stageOf(i){
  if(i.status==="kho")return "kho";
  if(i.status==="tra")return "ret";
  return shipped(i)?"done":"ship";
}
const STG={ship:["📮 Cần ship","st-ship"],go:["🚚 Đang giao","st-go"],done:["✅ Hoàn thành","st-done"],ret:["↩ Trả hàng","st-ret"]};
// gom món đã bán theo Order ID (món không có Order ID là một đơn riêng)
function ordersOf(list){
  const m=new Map();
  // kit = 1 đơn kể cả khi chưa có Order ID
  for(const i of list){const k=okey(i.orderId)?"o:"+okey(i.orderId):i.kitId?"k:"+i.kitId:"i:"+i.id;(m.get(k)||m.set(k,[]).get(k)).push(i)}
  return [...m.values()].map(its=>{
    its.sort((a,b)=>String(a.serial).localeCompare(String(b.serial)));
    const f=its[0],sum=k=>its.reduce((a,i)=>a+k(i),0);
    const stages=its.map(stageOf),stage=["ret","ship","go","done"].find(s=>stages.includes(s))||stages[0];
    return {its,f,stage,date:its.map(i=>i.saleDate||"").sort().pop()||"",
      price:sum(i=>n(i.price)),fees:sum(i=>n(i.fees)),ship:sum(i=>i.status==="kho"?0:shipShare(i)),cost:sum(i=>n(i.cost)),charge:sum(i=>i.status==="kho"?0:chargeShare(i)),
      profit:sum(i=>profit(i)||0),refund:sum(i=>n(i.refund))};
  }).sort((a,b)=>b.date.localeCompare(a.date)||b.f.createdAt-a.f.createdAt);
}
const daysAgo=d=>d?Math.max(0,Math.round((parseD(today())-parseD(d))/864e5)):null;
const hit=(i,q,qs)=>!q||[i.name,i.pn,i.serial,i.orderId,i.buyer,i.tracking,i.notes].join(" ").toLowerCase().includes(q)||(qs&&[i.serial,i.tracking,i.orderId].some(v=>ns(v).includes(qs)));
function fillMonths(){
  const sel=$("#ebMonth"),v=sel.value,ms=[...new Set(items.filter(i=>i.status!=="kho"&&i.saleDate).map(i=>monthOf(i.saleDate)))].sort().reverse();
  sel.innerHTML=`<option value="">Tất cả thời gian</option>`+ms.map(m=>`<option value="${m}">${mLabel(m)}</option>`).join("");
  sel.value=ms.includes(v)?v:"";
}
function trkLine(i){
  const t=String(i.tracking||"").trim();if(!t)return "";const k=trackLink(t);
  return `<div class="tpill" title="Số tracking"><span class="ti">🚚</span><span class="no">${esc(t)}</span><button type="button" class="mini" data-copy="${esc(t)}">Copy</button><a href="${esc(k.u)}" class="btn tbtn" data-trk="${esc(k.u)}" title="Mở 17track trong trình duyệt">Track ↗</a></div>`;
}
// gom theo listing: mỗi kit là 1 đơn vị (giữ thứ tự), món lẻ là 1 đơn vị
function unitsOf(its){
  const seen=new Set(),out=[];
  for(const i of its){
    if(i.kitId){if(seen.has(i.kitId))continue;seen.add(i.kitId);const ks=its.filter(x=>x.kitId===i.kitId);if(ks.length>1){out.push({its:ks,f:ks[0],kit:true});continue}}
    out.push({its:[i],f:i,kit:false});
  }
  return out.map(u=>({...u,sum:k=>u.its.reduce((a,i)=>a+n(i[k]),0),serials:u.its.map(i=>i.serial||"?").join(" + ")}));
}
const ebOpen=new Set();
function shipCard(o){
  const f=o.f,key=o.its.map(i=>i.id).join(","),us=unitsOf(o.its),wait=daysAgo(f.saleDate),open=ebOpen.has(key);
  const qv=(k,v)=>esc(qDraft[key+"|"+k]??v);
  const pic=(o.its.find(i=>(i.photos||[]).length)||{}).photos;
  const nm=(f.name||"(chưa đặt tên)")+(us.length>1?` +${us.length-1} món`:"");
  const sub=[esc(f.buyer||""),f.saleDate?"bán "+fdate(f.saleDate+"T12:00:00"):"",wait!=null&&wait>=2?`<span class="late">chờ ${wait} ngày</span>`:""].filter(Boolean).join(" · ");
  const form=open?`<div class="oc-sf">
    <label class="q-trk">Tracking<input class="mono" data-q="tracking" value="${qv("tracking","")}" placeholder="Dán số tracking…" autocomplete="off"></label>
    <label>Order ID<input class="mono" data-q="orderId" value="${qv("orderId",f.orderId||"")}" autocomplete="off"></label>
    <label>Người mua<input data-q="buyer" value="${qv("buyer",f.buyer||"")}" placeholder="Tên người mua eBay" autocomplete="off" autocapitalize="off"></label>
    <div class="oc-q2">
      <label>Phí eBay<input data-q="fees" type="number" step="0.01" min="0" inputmode="decimal" value="${qv("fees",o.fees?o.fees.toFixed(2):"")}"></label>
      <label>Ship bạn trả<input data-q="ship" type="number" step="0.01" min="0" inputmode="decimal" value="${qv("ship",f.shipTotal||"")}"></label>
    </div>
    <button type="button" class="btn primary" data-savetrk>Lưu · chuyển sang Xong</button>
    <button type="button" class="oc-back" data-unsell>↶ Đưa về kho</button></div>`:"";
  return `<div class="oc oc-ship ${STG.ship[1]}${open?" open":""}" data-ord="${esc(key)}"><div class="oc-sh" data-toggle role="button" tabindex="0"><span class="u-ph">${pic?`<img class="thumb" src="${ph(pic[0])}" alt="">`:`<span class="lot-ic">📦</span>`}</span><span class="oc-sn"><b>${esc(nm)}</b><small>${sub}</small></span><span class="num">${money(o.price+o.charge)}</span><span class="chev">▾</span></div>${form}</div>`;
}
function orderCard(o){
  if(o.stage==="ship")return shipCard(o);
  const f=o.f,[lb,cl]=STG[o.stage],us=unitsOf(o.its);
  const head=`<div class="oc-h"><span class="tag ${cl}">${lb}</span><span class="muted">${f.saleDate?"bán "+fdate(f.saleDate+"T12:00:00"):""}</span><span style="flex:1"></span>${us.length>1?`<span class="muted">${us.length} món</span>`:""}<button type="button" class="mini" data-unsell title="Bấm nhầm? Đưa về kho">↶ Về kho</button></div>
  <div class="oc-kv"><div><span>Order ID</span>${f.orderId?`<b class="mono">#${esc(f.orderId)}</b>`:`<b class="muted">(không có)</b>`}</div><div><span>Người mua</span><b>${esc(f.buyer||"—")}</b></div>${o.stage==="done"?`<div class="kvt"><span>Tracking</span><div><input class="mono" data-q="tracking" data-done value="${esc(qDraft[o.its.map(i=>i.id).join(",")+"|tracking"]??(f.tracking||""))}" placeholder="Số tracking" autocomplete="off"><div class="trk-act">${f.tracking?`<button type="button" class="mini" data-copy="${esc(f.tracking)}">Copy</button><a href="${esc(trackLink(f.tracking).u)}" class="btn tbtn" data-trk="${esc(trackLink(f.tracking).u)}">Track ↗</a>`:""}</div></div></div>`:f.tracking?`<div class="kvt"><span>Tracking</span><div>${trkLine(f)}</div></div>`:""}</div>`;
  const rows=us.map(u=>{const i=u.f,pic=(u.its.find(x=>(x.photos||[]).length)||{}).photos;return `<div class="oc-i"${o.stage==="done"?"":` data-open="${i.id}"`}>${pic?`<img class="thumb sm" src="${ph(pic[0])}" alt="" data-zoom title="Xem ảnh lớn">`:""}<span class="oc-n" title="${esc(i.name||"")}"><b>${u.kit?`<span class="kit-tag">🔗 kit ${u.its.length} thanh</span> `:""}${esc(i.name||"(chưa đặt tên)")}</b><span class="mono muted">${esc(u.kit?u.serials:(i.serial||"thiếu serial"))}</span></span>${i.status==="tra"?`<span class="tag s-tra">trả ${u.sum("refund")?money(u.sum("refund")):""}</span>`:""}<span class="num">${money(u.sum("price"))}</span>${o.stage==="done"&&i.status==="ban"?`<button type="button" class="mini" data-ret="${i.id}" title="Ghi nhận ${u.kit?"cả kit":"món này"} bị trả lại">↩ Trả</button>`:""}${o.stage==="done"?`<button type="button" class="mini" data-rs="${i.id}" title="Restock: nhập thêm hàng giống ${u.kit?"kit":"món"} này">🔁</button>`:""}</div>`}).join("");
  // gọn: chỉ Bán và Lãi; bấm ▸ xem chi tiết
  const tot=`<details class="oc-t"><summary><span>Bán <b>${money(o.price+o.charge)}</b></span><span>Lãi <b class="${o.profit>=0?"pos":"neg"}">${money(o.profit)}</b></span></summary>
    <div><span>Giá bán</span><b>${money(o.price)}</b></div>${o.charge?`<div><span>Ship người mua trả</span><b>+${money(o.charge)}</b></div>`:""}<div><span>Phí eBay</span><b>−${money(o.fees)}</b></div><div><span>Ship bạn trả</span><b>−${money(o.ship)}</b></div><div><span>Vốn</span><b>−${money(o.cost)}</b></div></details>`;
  let foot="";
  const qv=(k,v)=>esc(qDraft[o.its.map(i=>i.id).join(",")+"|"+k]??v);
  if(o.stage==="ship")foot=`<div class="oc-f oc-q">
    <label>Order ID<input class="mono" data-q="orderId" value="${qv("orderId",f.orderId||"")}" autocomplete="off"></label>
    <label>Phí eBay<input data-q="fees" type="number" step="0.01" min="0" inputmode="decimal" value="${qv("fees",o.fees?o.fees.toFixed(2):"")}" title="Đang là phí gợi ý, sửa theo số eBay"></label>
    <label>Ship bạn trả<input data-q="ship" type="number" step="0.01" min="0" inputmode="decimal" value="${qv("ship",f.shipTotal||"")}"></label>
    <label class="q-trk">Tracking<input class="mono" data-q="tracking" value="${qv("tracking","")}" placeholder="Dán số tracking…" autocomplete="off"></label>
    <button type="button" class="btn primary" data-savetrk>Lưu</button></div>`;
  // tracking hiện ngay dưới tiêu đề thẻ (dễ thấy), kit dùng chung 1 tracking
  const trkRow="";
  if(o.stage==="ret")foot=`<div class="oc-f muted" style="font-size:12.5px">${us.filter(u=>u.f.status==="tra").map(u=>{const rs=u.its.map(i=>i.retSerial).filter(Boolean),ok=rs.every(r=>u.its.some(i=>ns(i.serial)===ns(r)));return `${esc(u.serials)}: hoàn ${money(u.sum("refund"))}${rs.length?` · serial nhận về <span class="mono">${rs.map(esc).join(" + ")}</span> ${ok?"<b class='pos'>khớp</b>":"<b class='neg'>KHÔNG khớp</b>"}`:""}`}).join("<br>")}</div>`;
  const okey=o.its.map(i=>i.id).join(","),inner=`${head}${trkRow}<div class="oc-b"><div class="oc-items">${rows}</div>${tot}</div>${foot}`;
  if(o.stage==="done"){const open=ebOpen.has(okey);
    return `<div class="oc oc-fold ${STG[o.stage][1]}${open?" open":""}" data-ord="${esc(okey)}"><div class="oc-sh" data-toggle role="button" tabindex="0"><span class="oc-sn"><b class="mono">${f.orderId?"#"+esc(f.orderId):"(không có Order ID)"}</b><span class="oc-meta">${f.buyer?`<span class="bu">${esc(f.buyer)}</span>`:""}${f.tracking?`<span class="tn mono">${esc(String(f.tracking).length>12?String(f.tracking).slice(0,4)+"…"+String(f.tracking).slice(-4):f.tracking)}</span><button type="button" class="mini" data-copy="${esc(f.tracking)}">Copy</button><a href="${esc(trackLink(f.tracking).u)}" class="mini trk" data-trk="${esc(trackLink(f.tracking).u)}">Track ↗</a>`:`<span class="muted">chưa có tracking</span>`}</span></span><span class="chev">▾</span></div>${open?`<div class="oc-ex">${inner}</div>`:""}</div>`}
  return `<div class="oc ${STG[o.stage][1]}" data-ord="${esc(okey)}">${inner}</div>`;
}
function orderTable(os){
  return `<div class="card tw" style="padding:0"><table class="ot"><thead><tr><th></th><th>Trạng thái</th><th>Order</th><th>Người mua</th><th>Món</th><th>Ngày bán</th><th>Tracking</th><th class="num">Bán</th><th class="num">Lãi</th></tr></thead><tbody>${os.map(o=>{const f=o.f;const pic=(o.its.find(x=>(x.photos||[]).length)||{}).photos;return `<tr data-open="${f.id}"><td>${pic?`<img class="thumb sm" src="${ph(pic[0])}" alt="" data-zoom>`:""}</td><td><span class="tag ${STG[o.stage][1]}">${STG[o.stage][0]}</span></td><td class="mono">${esc(f.orderId||"—")}</td><td>${esc(f.buyer||"")}</td><td>${unitsOf(o.its).map(u=>(u.kit?"🔗 ":"")+esc(u.f.name)).join("<br>")}</td><td>${f.saleDate?fdate(f.saleDate+"T12:00:00"):""}</td><td class="mono" style="font-size:12px">${f.tracking?`${esc(f.tracking)} <a href="${esc(trackLink(f.tracking).u)}" class="tlink" data-trk="${esc(trackLink(f.tracking).u)}">Track ↗</a>`:""}</td><td class="num">${money(o.price+o.charge)}</td><td class="num ${o.profit>=0?"pos":"neg"}">${money(o.profit)}</td></tr>`}).join("")}</tbody></table></div>`;
}
function render(){
  if(holdWhileTyping("ebay",$("#list"),render))return;
  fillMonths();
  const q=$("#q").value.trim().toLowerCase(),qs=ns(q),mon=$("#ebMonth").value;
  const sold=items.filter(i=>i.status!=="kho"),stock=items.filter(i=>i.status==="kho");
  // đếm trên tab (Cần ship luôn đếm hết, không theo tháng)
  if(!["kho","ship","done","ret"].includes(ebTab))ebTab="done";
  const allOrders=ordersOf(sold),cnt={kho:unitsOf(stock).length,ship:0,done:0,ret:0};
  for(const o of allOrders)cnt[o.stage]++;
  $$("#ebTabs [data-eb]").forEach(b=>{const i=b.querySelector("i");if(i){const c=cnt[b.dataset.eb];i.textContent=c||"";i.className=b.dataset.eb==="ship"&&c?"hot":""}});
  $$("#ebTabs [data-eb]").forEach(b=>{if(b.dataset.eb!=="check")b.classList.toggle("on",b.dataset.eb===ebTab&&!$("#tab-kho").classList.contains("hidden"))});
  $("#ebMonth").style.display=["kho","ship"].includes(ebTab)?"none":"";
  $$("#ebView button").forEach(b=>b.classList.toggle("on",b.dataset.v===ebView));
  let html="",empty="";
  if(ebTab==="kho"){
    // mỗi listing 1 dòng, cùng loại đứng cạnh nhau
    const fs2=stock.filter(i=>hit(i,q,qs)).sort((a,b)=>gkey(a).localeCompare(gkey(b))||a.createdAt-b.createdAt);
    const us2=unitsOf(fs2);
    html=us2.length?`<div class="urows">${us2.map(unitRow).join("")}</div>`:"";
    empty=stock.length?"Không có món nào khớp ô tìm.":"Kho đang trống. Bấm “+ Thêm hàng” để nhập hàng.";
    const su=unitsOf(stock),sk=su.filter(u=>u.kit).length,nl=su.filter(u=>n(u.f.listPrice)).length;
    const listed=su.reduce((a,u)=>a+n(u.f.listPrice),0);
    $("#sum").innerHTML=`<div>Trong kho<b>${su.length}</b><span style="font-size:12px">🏷️ Đang list ${nl} · Chưa list ${su.length-nl}${sk?` · ${sk} kit`:""}</span></div><div>Vốn<b>${money(stock.reduce((a,i)=>a+n(i.cost),0))}</b></div><div>Tổng giá list<b>${money(listed)}</b></div>`;
  }else{
    const os=allOrders.filter(o=>o.stage===ebTab&&(ebTab==="ship"||!mon||monthOf(o.date)===mon)&&o.its.some(i=>hit(i,q,qs)));
    if(ebTab==="ship")os.sort((a,b)=>a.date.localeCompare(b.date)); // đơn chờ lâu nhất lên đầu
    html=os.length?(ebView==="table"&&!matchMedia("(max-width:760px)").matches?orderTable(os):os.map(orderCard).join("")):"";
    empty={ship:"🎉 Không còn đơn nào cần ship.",done:"Chưa có đơn hoàn thành"+(mon?" trong "+mLabel(mon):"")+".",ret:"Không có hàng bị trả lại"+(mon?" trong "+mLabel(mon):"")+"."}[ebTab];
    const S=k=>os.reduce((a,o)=>a+o[k],0);
    $("#sum").innerHTML=ebTab==="ship"?`<div>Cần ship<b class="${os.length?"warn-t":""}">${os.length}</b></div><div>Tiền chờ<b>${money(S("price")+S("charge"))}</b></div><div>Chờ lâu nhất<b>${os.length?daysAgo(os[0].f.saleDate)+" ngày":"—"}</b></div>`
      :ebTab==="ret"?`<div>Đơn bị trả<b>${os.length}</b></div><div>Tiền đã hoàn<b class="neg">${money(S("refund"))}</b></div><div>Serial không khớp<b class="${os.some(o=>o.its.some(i=>i.retSerial&&ns(i.retSerial)!==ns(i.serial)))?"neg":""}">${os.reduce((a,o)=>a+o.its.filter(i=>i.retSerial&&ns(i.retSerial)!==ns(i.serial)).length,0)}</b></div>`
      :`<div>Đơn<b>${os.length}</b></div><div>Doanh thu<b>${money(S("price")+S("charge"))}</b></div><div>Lãi<b class="${S("profit")>=0?"pos":"neg"}">${money(S("profit"))}</b></div>`;
  }
  $("#list").innerHTML=html;
  $("#empty").style.display=html?"none":"block";$("#empty").textContent=empty;
}
// một bộ xử lý click cho cả danh sách
$("#list").addEventListener("click",async e=>{
  const t=e.target,a=t.closest("[data-trk]"),c=t.closest("[data-copy]");
  if(a){e.preventDefault();API.openUrl(a.dataset.trk);return}
  if(c){navigator.clipboard.writeText(c.dataset.copy).then(()=>{c.textContent="Đã copy";setTimeout(()=>c.textContent="Copy",1200)},()=>{});return}
  if(t.closest("input"))return;
  const z=t.closest("[data-zoom]");if(z){$("#viewer img").src=z.src;$("#viewer").showModal();return}
  const tg=t.closest("[data-toggle]");if(tg){const k=tg.closest("[data-ord]").dataset.ord;ebOpen.has(k)?ebOpen.delete(k):ebOpen.add(k);render();return}
  const ord=t.closest("[data-ord]"),lot=t.closest("[data-lot]"),ids=(ord||lot)?(ord||lot).dataset[ord?"ord":"lot"].split(","):[];
  if(t.closest("[data-qsell]")){
    const f=DB.items.find(i=>i.id===ids[0]),pin=lot.querySelector("[data-qprice]");
    if(!n(f&&f.listPrice)){if(!pin||!n(pin.value)){pin&&pin.focus();return}await quickSell(ids,n(pin.value));return}
    await quickSell(ids);return}
  // Cần ship: điền nhanh Order ID, phí, ship, tracking ngay trên thẻ
  if(t.closest("[data-savetrk]")){
    const a=document.activeElement;if(isField(a))a.blur();
    saveQuick(ord,["orderId","buyer","fees","ship","tracking"]);await reload();return}
  if(t.closest("[data-ret]")){openItem(t.closest("[data-ret]").dataset.ret);setStatus("tra");return}
  if(t.closest("[data-sell]")){openItem(ids[0]);setStatus("ban");F("price").focus();return}
  if(t.closest("[data-restock]")){restockFrom(items.find(i=>i.id===ids[0]));return}
  const rs=t.closest("[data-rs]");if(rs){restockFrom(items.find(i=>i.id===rs.dataset.rs));return}
  if(t.closest("[data-editlot]")){openLot(ids);return}
  if(t.closest("[data-unsell]")){if(await ask("Đưa đơn này về kho?"))await unsell(ids);return}
  const o=t.closest("[data-open]");if(o){openItem(o.dataset.open);return}
});
$("#list").addEventListener("keydown",e=>{
  if(e.key!=="Enter")return;
  if(e.target.matches("[data-toggle]")){e.preventDefault();e.target.click();return}
  if(e.target.matches("[data-q][data-done]")){e.target.blur();return}
  if(e.target.matches("[data-q]")){e.target.blur();e.target.closest("[data-ord]").querySelector("[data-savetrk]").click()}
  if(e.target.matches("[data-qprice]")){e.target.blur();e.target.closest("[data-lot]").querySelector("[data-qsell]").click()}
});
/* Cần ship: số đang gõ giữ trong qDraft (vẽ lại không làm mất); Order ID, phí, ship tự lưu khi rời ô.
   Tracking chỉ lưu khi bấm Lưu/Enter vì có tracking là đơn rời khỏi Cần ship */
const qDraft={};
function saveQuick(ord,keys){
  const key=ord.dataset.ord,g=k=>{const x=ord.querySelector(`[data-q="${k}"]`);return x?x.value.trim():""};
  const its=key.split(",").map(id=>DB.items.find(i=>i.id===id)).filter(i=>i&&i.status==="ban"),now=Date.now();
  for(const k of keys){
    const v=g(k),fsplit=k==="fees"&&v!==""?splitC(v,its.length):null;
    its.forEach((i,j)=>{if(k==="orderId")i.orderId=v;if(k==="buyer")i.buyer=v;if(k==="tracking")i.tracking=v;if(fsplit)i.fees=fsplit[j];if(k==="ship"){i.shipTotal=v;i.shipN=its.length}i.updatedAt=now});
    delete qDraft[key+"|"+k];
  }
  save();
}
$("#list").addEventListener("input",e=>{const x=e.target;if(!x.matches("[data-q]"))return;qDraft[x.closest("[data-ord]").dataset.ord+"|"+x.dataset.q]=x.value});
$("#list").addEventListener("change",e=>{const x=e.target;if(!x.matches("[data-q]")||(x.dataset.q==="tracking"&&!x.hasAttribute("data-done")))return;
  saveQuick(x.closest("[data-ord]"),[x.dataset.q]);
  setTimeout(reload,400)}); // chờ chút để cú bấm nút Lưu kịp tới; render tự hoãn nếu đang sang ô khác trong danh sách
/* Sửa cả lô bằng chính form "Thêm hàng": serial mỗi dòng 1 cái (thêm dòng = thêm, xoá dòng = xoá), tick kit = ghép theo cặp */
let lotEdit=null;
const LOT_KEEP=["pn","cost","listPrice","shipMode","shipCharge","test","notes"];
function openLot(ids){
  const its=ids.map(id=>DB.items.find(i=>i.id===id)).filter(i=>i&&i.status==="kho");if(!its.length)return;
  const ord=[],seen=new Set();
  for(const i of its){if(seen.has(i.id))continue;(i.kitId?its.filter(x=>x.kitId===i.kitId):[i]).forEach(x=>{seen.add(x.id);ord.push(x)})}
  openItem(null);
  const f0=ord[0],kitOn=ord.length>1&&ord.every(i=>i.kitId),same=k=>ord.every(i=>String(i[k]??"")===String(f0[k]??""));
  F("name").value=f0.name||"";
  ["pn","listPrice","shipMode","shipCharge","test","notes"].forEach(k=>F(k).value=same(k)?(f0[k]??""):"");
  let costSame=same("cost"),cost=f0.cost??"";
  if(kitOn){const t=[...new Set(ord.map(i=>i.kitId))].map(k=>ord.filter(i=>i.kitId===k).reduce((a,i)=>a+n(i.cost),0).toFixed(2));costSame=t.every(x=>x===t[0]);cost=t[0]}
  F("cost").value=costSame?cost:"";
  F("kit").checked=kitOn;
  F("serials").value=ord.filter(i=>i.serial).map(i=>i.serial).join("\n");
  lotEdit={ord,init:{},same:{}};
  LOT_KEEP.forEach(k=>{lotEdit.init[k]=F(k).value;lotEdit.same[k]=k==="cost"?costSame:same(k)});
  $("#form").classList.add("lot-mode");
  const blank=ord.filter(i=>!i.serial).length;
  $("#title").textContent=`✏️ Sửa lô · ${ord.length} cái${blank?` (${blank} chưa có serial, giữ nguyên)`:""}`;
  shipModeUI();qtySync();kitTags();
  $("#moreF").open=!!(F("test").value||F("notes").value);
}
async function saveLot(){
  const {out:lines,dup}=serialLines(),name=F("name").value.trim();
  if(!name){F("name").focus();return}
  if(dup.length&&!await ask(`Bỏ serial gõ trùng: ${dup.join(", ")}?`))return;
  const ord=lotEdit.ord,withS=ord.filter(i=>i.serial),byKey=new Map(withS.map(i=>[ns(i.serial),i])),keys=new Set(lines.map(ns));
  const del=withS.filter(i=>!keys.has(ns(i.serial))),add=lines.filter(s=>!byKey.has(ns(s)));
  for(const s of add){const d=items.find(i=>ns(i.serial)===ns(s));if(d&&!await ask(`Serial ${s} đã có ở "${d.name}". Vẫn lưu?`))return}
  if(del.length&&!await ask(`Xoá ${del.length} cái khỏi kho: ${del.map(i=>i.serial).join(", ")}?`))return;
  const now=Date.now(),kitOn=F("kit").checked,v=k=>F(k).value.trim();
  DB.items=DB.items.filter(i=>!del.some(d=>d.id===i.id));
  const fin=[];
  for(const s of lines){const old=byKey.get(ns(s));let it=old&&DB.items.find(x=>x.id===old.id);
    if(!it){it={id:uid(),createdAt:now+fin.length,status:"kho",photos:[],serial:s};DB.items.push(it)}
    fin.push(it)}
  ord.filter(i=>!i.serial).forEach(i=>{const it=DB.items.find(x=>x.id===i.id);if(it)fin.push(it)});
  // ô không đổi và vốn dĩ mỗi cái khác nhau → giữ giá trị riêng của từng cái
  const keep=k=>F(k).value===lotEdit.init[k]&&!lotEdit.same[k];
  for(const it of fin){it.name=name;it.updatedAt=now;
    for(const k of LOT_KEEP)if(k!=="cost"&&!keep(k))it[k]=k==="shipMode"?F(k).value:v(k)}
  for(let p=0;p*(kitOn?KIT:1)<fin.length;p++){
    const g=kitOn?fin.slice(p*KIT,p*KIT+KIT):[fin[p]],kid=kitOn&&g.length>1?uid():null;
    g.forEach((it,j)=>{if(kid)it.kitId=kid;else delete it.kitId;if(!keep("cost")&&v("cost")!=="")it.cost=kitOn?splitC(v("cost"),KIT)[j]:n(v("cost")).toFixed(2)})}
  save();$("#dlg").close();await reload();
}
/* Về kho: huỷ bán/trả bấm nhầm (cả đơn, kit đi cùng); có Hoàn tác ngay sau đó */
const SALE_F=["price","orderId","buyer","tracking","carrier","trk","deliveredAt","fees","shipTotal","shipN","saleDate","packPhotos","refund","retSerial","retDate"];
let undoSnap=null;
const snap=ids=>ids.map(id=>JSON.parse(JSON.stringify(DB.items.find(i=>i.id===id)||null))).filter(Boolean);
function showUndo(msg){
  const bar=$("#undoBar");bar.classList.remove("hidden");
  bar.innerHTML=`${msg} <button type="button" class="mini" id="undoBtn">↶ Hoàn tác</button>`;
  clearTimeout(bar._t);bar._t=setTimeout(()=>bar.classList.add("hidden"),20000);
  $("#undoBtn").onclick=async()=>{if(!undoSnap)return;for(const o of undoSnap){const k=DB.items.findIndex(i=>i.id===o.id);if(k>=0)DB.items[k]=o}undoSnap=null;save();await reload();bar.textContent="Đã hoàn tác.";bar._t=setTimeout(()=>bar.classList.add("hidden"),4000)};
}
async function unsell(ids){
  undoSnap=snap(ids);
  for(const id of ids){const i=DB.items.find(x=>x.id===id);if(!i)continue;i.status="kho";SALE_F.forEach(f=>delete i[f]);i.updatedAt=Date.now()}
  save();await reload();showUndo(`Đã đưa ${ids.length} cái về kho.`);
}
/* Bán 1 chạm: giá bán = giá list (kit = giá cả kit), phí gợi ý, ngày bán hôm nay → vào Cần ship ngay */
async function quickSell(ids,price){
  const its=ids.map(id=>DB.items.find(i=>i.id===id)).filter(i=>i&&i.status==="kho");if(!its.length)return;
  const f=its[0],k=its.length,total=n(price!=null?price:f.listPrice),charge=f.shipMode==="buyer"?n(f.shipCharge):0;
  undoSnap=snap(its.map(i=>i.id));
  const ps=splitC(total.toFixed(2),k),fs=splitC(String(calcFee(total+charge)),k),now=Date.now();
  its.forEach((i,j)=>{Object.assign(i,{status:"ban",price:ps[j],fees:fs[j],saleDate:today(),shipN:k,updatedAt:now})});
  save();await reload();showUndo(`Đã bán ${esc(f.name||"")} ${money(total)} → 📮 Cần ship.`);
}
// mỗi listing trong kho là 1 dòng: tên + serial, giá list to, ✏️ và 💰 Bán
function unitRow(u){
  const f=u.f,lp=n(f.listPrice);
  const pic=(u.its.find(i=>(i.photos||[]).length)||{}).photos;
  const ship=f.shipMode==="buyer"?(n(f.shipCharge)?`+ ship ${money(n(f.shipCharge))}`:"+ ship người mua trả"):"Free ship";
  return `<div class="urow" data-lot="${esc(u.its.map(i=>i.id).join(","))}">
    <div class="u-ph">${pic?`<img class="thumb" src="${ph(pic[0])}" alt="" data-zoom title="Xem ảnh lớn">`:`<span class="lot-ic">📦</span>`}</div>
    <div class="u-n" data-open="${f.id}" title="${esc(f.name||"")}"><b>${u.kit?`<span class="kit-tag">🔗 kit</span> `:""}${esc(f.name||"(chưa đặt tên)")}</b><span class="mono muted">${esc(u.serials)}${f.test?` · ${esc(f.test)}`:""}</span><span class="muted">vốn ${money(u.sum("cost"))}</span></div>
    <div class="u-p">${lp?`<b class="lst-big">${money(lp)}</b><span>🏷️ ${ship}</span>`:`<span class="muted">Chưa list</span>`}</div>
    <div class="row ib">${lp?"":`<input class="mono" data-qprice type="number" step="0.01" min="0" inputmode="decimal" placeholder="Giá bán $">`}<button type="button" class="btn" data-open="${f.id}" title="Sửa">✏️</button><button type="button" class="btn primary" data-qsell title="Bán: chuyển vào Cần ship">💰 Bán</button></div>
  </div>`;
}
$$("#ebView button").forEach(b=>b.onclick=()=>{ebView=b.dataset.v;try{localStorage.setItem("ebView",ebView)}catch(e){}render()});
$("#ebMonth").onchange=render;
// menu ⋯ đóng khi bấm ra ngoài
document.addEventListener("click",e=>{const m=$("#ebMore");if(m.open&&!m.contains(e.target))m.open=false});

const F=k=>$("#form").elements[k];
const FLD=["name","pn","serial","cost","test","notes","price","orderId","buyer","tracking","fees","shipTotal","refund","retSerial","listPrice","shipMode","shipCharge"];
const chargeNow=()=>F("shipMode").value==="buyer"?n(F("shipCharge").value):0;
function shipModeUI(){$("#chargeLbl").classList.toggle("hidden",F("shipMode").value!=="buyer")}
F("shipMode").addEventListener("change",()=>{shipModeUI();upd()});F("shipCharge").addEventListener("input",()=>upd());
function openItem(id){
  cur=id?items.find(i=>i.id===id):null;
  lotEdit=null;$("#form").classList.remove("lot-mode");
  const s=cur||{status:"kho"};
  FLD.forEach(k=>F(k).value=s[k]??"");
  photos=[...(s.photos||[])];packPhotos=[...(s.packPhotos||[])];drawPacks();ordHint(false);
  $("#title").textContent=cur?"Sửa món hàng":"Thêm hàng";
  $("#del").style.display=cur?"":"none";$("#restock").style.display=cur?"":"none";
  F("qty").value=1;F("serials").value="";F("kit").checked=false;
  $("#qtyLbl").classList.toggle("hidden",!!cur);$("#kitLbl").classList.toggle("hidden",!!cur);
  // kit: các ô tiền hiện tổng của cả kit, khi lưu app chia đều lại cho từng thanh
  const kit=kitOf(cur);
  if(kit.length>1)KIT_F.forEach(k=>{F(k).value=kit.some(i=>i[k]!==""&&i[k]!=null)?kit.reduce((a,i)=>a+n(i[k]),0).toFixed(2):""});
  // phí đã lưu đúng bằng phí gợi ý thì vẫn coi là tự điền (đổi giá sẽ tính lại); khác thì là số đã sửa tay
  {const p=n(F("price").value),sug=calcFee(p+chargeNow());F("fees").dataset.auto=F("fees").value!==""&&p&&Math.abs(n(F("fees").value)-sug)<0.005?F("fees").value:""}
  $("#kitNote").classList.toggle("hidden",kit.length<2);
  $("#kitNote").innerHTML=kit.length>1?`🔗 <b>Kit ${kit.length} thanh</b>: ${kit.map(i=>`<button type="button" class="kit-s mono${i.id===cur.id?" on":""}" data-kitopen="${i.id}" title="Sửa serial, test, ảnh của thanh này">${esc(i.serial||"?")}${i.test?` <span class="muted">(${esc(i.test)})</span>`:""}</button>`).join(" + ")}`:"";
  kitTags();renderKitTools();shipModeUI();
  $("#moreF").open=!!(s.test||s.notes||(s.photos||[]).length);$("#packF").open=!!(s.packPhotos||[]).length;
  // thêm mới: luôn dùng ô nhiều dòng; sửa món: một ô serial
  $("#snsLbl").classList.toggle("hidden",!!cur);$("#serialLbl").classList.toggle("hidden",!cur);qtySync();
  setStatus(s.status);
  drawPhotos();
  if(!$("#dlg").open)$("#dlg").showModal();
}
function setStatus(st){
  // bán: giá bán tự điền = giá list (sửa được khi bán theo offer)
  if(st==="ban"&&!F("price").value&&F("listPrice").value){F("price").value=F("listPrice").value;autoFee()}
  status=st;
  $("#stTag").className="tag s-"+st;$("#stTag").textContent=ST[st];
  $("#saleBox").classList.toggle("hidden",st==="kho");
  $("#retBox").classList.toggle("hidden",st!=="tra");
  const b=[];
  if(st==="kho")b.push(["ban","💰 Đánh dấu đã bán"]);
  if(st==="ban")b.push(["tra","↩ Bị trả lại"],["kho","↶ Về kho"]);
  if(st==="tra")b.push(["kho","↶ Về kho"],["ban","Quay lại: đã bán"]);
  $("#stBtns").innerHTML=b.map(([k,l])=>`<button type="button" class="btn" data-st="${k}">${l}</button>`).join("");
  renderMates();
  $$("[data-st]").forEach(x=>x.onclick=()=>{
    const to=x.dataset.st;
    if(to==="tra"&&!F("refund").value)F("refund").value=F("price").value;
    setStatus(to);if(to==="ban")F("price").focus();
  });
  upd();
}
const gkey=i=>((i.name||"")+"|"+(i.pn||"")).toLowerCase().trim();
function renderMates(){
  const box=$("#mates");
  // kit bán theo cả cặp nên không có danh sách tick; món lẻ không được tick thanh thuộc kit
  const mates=cur&&!cur.kitId&&cur.status==="kho"&&status==="ban"?items.filter(i=>i.id!==cur.id&&!i.kitId&&i.status==="kho"&&gkey(i)===gkey(cur)):[];
  box.classList.toggle("hidden",!mates.length);
  box.innerHTML=mates.length?`<div class="muted" style="font-size:13px">Bán cùng đơn thêm (tick serial đã bán):</div>`+mates.map(m=>`<label style="display:flex;gap:8px;align-items:center;margin:4px 0;color:var(--text)"><input type="checkbox" data-mate="${m.id}" style="width:auto;margin:0"><span class="mono">${esc(m.serial||"(chưa có serial)")}</span></label>`).join(""):"";
}
// serial nhiều dòng: bỏ dòng trống và serial trùng (so như lúc kiểm tra trả hàng)
function serialLines(){
  const seen=new Set(),out=[],dup=[];
  for(const x of F("serials").value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)){const k=ns(x);if(seen.has(k)){dup.push(x);continue}seen.add(k);out.push(x)}
  return {out,dup};
}
// có serial thì số lượng = số dòng; chưa có serial thì dùng ô Số lượng
function qtySync(){
  const {out,dup}=serialLines(),q=F("qty"),kitOn=!cur&&F("kit").checked;
  q.disabled=out.length>0;if(out.length)q.value=kitOn?Math.ceil(out.length/KIT):out.length;
  $("#qtyNote").textContent=out.length?`(tự đếm: ${out.length} serial${kitOn?` = ${Math.floor(out.length/KIT)} kit${out.length%KIT?" + 1 thanh lẻ":""}`:""}${dup.length?`, bỏ ${dup.length} dòng trùng`:""})`:kitOn?"(số kit, dùng khi chưa có serial)":"(dùng khi chưa có serial)";
}
F("serials").addEventListener("input",()=>{qtySync();upd()});
F("kit").addEventListener("change",()=>{qtySync();kitTags();upd()});
/* Tách kit (kit chỉ tạo ở Thêm hàng): bỏ kitId, không đổi tiền của từng thanh */
async function setKit(ids,kitId){
  for(const id of ids){const i=DB.items.find(x=>x.id===id);if(!i)continue;if(kitId)i.kitId=kitId;else delete i.kitId;i.updatedAt=Date.now()}
  save();await reload();
}
function renderKitTools(){
  const box=$("#kitTools"),kit=kitOf(cur);
  if(!cur){box.classList.add("hidden");box.innerHTML="";return}
  box.innerHTML=kit.length>1?`<button type="button" class="btn" id="kitSplit" title="Tách thành món lẻ (tiền giữ nguyên)">✂️ Tách kit</button>`:"";
  box.classList.toggle("hidden",!box.innerHTML);
  const sp=$("#kitSplit");
  if(sp)sp.onclick=async()=>{if(!await ask("Tách kit này thành món lẻ?"))return;const id=cur.id;await setKit(kit.map(i=>i.id),null);openItem(id)};
}
$("#kitNote").addEventListener("click",e=>{const b=e.target.closest("[data-kitopen]");if(b&&b.dataset.kitopen!==(cur&&cur.id))openItem(b.dataset.kitopen)});
