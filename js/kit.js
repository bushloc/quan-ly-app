"use strict";
/* ===== Kit RAM: 2 thanh bán chung 1 listing (cùng kitId) ===== */
const KIT=2,KIT_F=["cost","price","fees","refund"];
const kitOf=i=>i&&i.kitId?items.filter(x=>x.kitId===i.kitId):[];
const kitN=()=>cur?Math.max(1,kitOf(cur).length):1;
// chia tổng theo xu cho đều mà vẫn cộng lại đúng tổng
function splitC(v,k){
  if(v===""||v==null)return Array(k).fill("");
  const c=Math.round(n(v)*100),b=Math.floor(c/k),r=c-b*k;
  return Array.from({length:k},(_,j)=>((b+(j<r?1:0))/100).toFixed(2));
}
function kitTags(){const on=(cur&&kitOf(cur).length>1)||(!cur&&F("kit").checked);$$("#form .kit-tag").forEach(t=>t.classList.toggle("hidden",!on))}
const okey=v=>String(v||"").trim().toLowerCase();
function orderMates(){
  const o=okey(F("orderId").value);
  return o?items.filter(i=>(!cur||i.id!==cur.id)&&i.status!=="kho"&&okey(i.orderId)===o):[];
}
function groupN(){
  const oth=orderMates().filter(i=>!(cur&&cur.kitId&&i.kitId===cur.kitId)).length; // thanh cùng kit đã tính trong kitN
  if(!cur){const L=serialLines().out.length,q=Math.max(1,Math.floor(n(F("qty").value)));return (L||(F("kit").checked?q*KIT:q))+oth}
  if(cur.status==="kho")return kitN()+$$("#mates [data-mate]:checked").length+oth;
  return kitN()+oth;
}
document.addEventListener("change",e=>{if(e.target.matches&&e.target.matches("#mates [data-mate]"))upd()});
function ordHint(fill){
  const oth=orderMates(),h=$("#ordHint");
  h.classList.toggle("hidden",!oth.length);
  if(!oth.length){h.innerHTML="";return}
  if(fill){
    const m=oth[0];
    if(!F("buyer").value)F("buyer").value=m.buyer||"";
    if(!F("tracking").value)F("tracking").value=m.tracking||"";
    if(!F("shipTotal").value&&m.shipTotal)F("shipTotal").value=m.shipTotal;
    if(!packPhotos.length&&(m.packPhotos||[]).length){packPhotos=[...m.packPhotos];drawPacks()}
  }
  h.innerHTML=`🔗 Order ID này đã có ${oth.length} cái khác (${oth.map(i=>esc(i.serial||i.name)).join(", ")}). App gộp thành <b>một đơn</b>: dùng chung người mua, tracking, ảnh đóng gói và chia đều tiền ship.`;
}
F("orderId").addEventListener("input",()=>{ordHint(true);upd()});
function upd(){
  const p=n(F("price").value),f=n(F("fees").value),c=n(F("cost").value);
  const gn=groupN(),kn=kitN(),sh=n(F("shipTotal").value)/gn*kn,ch=chargeNow()/gn*kn,lai=p+ch-f-sh-c;
  $("#profit").innerHTML=status==="ban"?`Lãi${kn>1?" cả kit":""}: <b class="${lai>=0?"pos":"neg"}">${money(lai)}</b> <span class="muted">(bán${ch?` + ship người mua ${money(ch)}`:""} − phí − ship${gn>kn?` ${money(sh)}`:""} − vốn)</span>`:"";
  // kit: serial nhận về khớp với bất kỳ thanh nào trong kit
  const sold=kn>1?kitOf(cur).map(i=>i.serial||""):[F("serial").value],b=ns(F("retSerial").value);
  $("#match").innerHTML=!b?"":sold.some(x=>ns(x)===b)?`<div class="result ok" style="padding:8px;margin:0">✅ Serial khớp</div>`:`<div class="result bad" style="padding:8px;margin:0">❌ Serial KHÔNG khớp (đã bán: ${sold.map(esc).join(" + ")})</div>`;
}
// phí gợi ý theo giá (eBay tính phí trên cả tiền ship người mua trả); đã sửa tay theo số eBay thì không ghi đè nữa
const feeAutoOk=()=>{const v=F("fees").value.trim();return v===""||F("fees").dataset.auto===v};
function autoFee(){if(!feeAutoOk())return;const v=calcFee(n(F("price").value)+chargeNow());F("fees").value=v?v.toFixed(2):"";F("fees").dataset.auto=F("fees").value}
F("price").addEventListener("input",()=>{autoFee();upd()});
["fees","shipTotal","cost","serial","retSerial"].forEach(k=>F(k).addEventListener("input",upd));
$$("[data-close]").forEach(b=>b.onclick=()=>$("#dlg").close());

function drawPhotos(){
  $("#photos").innerHTML=photos.map((d,i)=>`<div class="photo"><img src="${ph(d)}" data-v="${i}" alt=""><button type="button" data-x="${i}">✕</button></div>`).join("")+`<div class="add" id="add">+ ảnh</div>`;
  $$("#photos [data-v]").forEach(im=>im.onclick=()=>{$("#viewer img").src=im.src;$("#viewer").showModal()});
  $$("#photos [data-x]").forEach(b=>b.onclick=()=>{photos.splice(+b.dataset.x,1);drawPhotos()});
  const a=$("#add");a.onclick=()=>$("#pin").click();
  a.ondragover=e=>{e.preventDefault();a.classList.add("over")};a.ondragleave=()=>a.classList.remove("over");
  a.ondrop=e=>{e.preventDefault();a.classList.remove("over");addFiles(e.dataTransfer.files)};
}
function drawPacks(){
  $("#packs").innerHTML=packPhotos.map((d,i)=>`<div class="photo"><img src="${ph(d)}" data-pv="${i}" alt=""><button type="button" data-px="${i}">✕</button></div>`).join("")+`<div class="add" id="addp">+ ảnh</div>`;
  $$("#packs [data-pv]").forEach(im=>im.onclick=()=>{$("#viewer img").src=im.src;$("#viewer").showModal()});
  $$("#packs [data-px]").forEach(b=>b.onclick=()=>{packPhotos.splice(+b.dataset.px,1);drawPacks()});
  const a=$("#addp");a.onclick=()=>$("#pin2").click();
  a.ondragover=e=>{e.preventDefault();a.classList.add("over")};a.ondragleave=()=>a.classList.remove("over");
  a.ondrop=e=>{e.preventDefault();a.classList.remove("over");addFiles(e.dataTransfer.files,true)};
}
$("#viewer").onclick=()=>$("#viewer").close();
$("#pin").onchange=e=>{addFiles(e.target.files);e.target.value=""};
$("#pin2").onchange=e=>{addFiles(e.target.files,true);e.target.value=""};
document.addEventListener("paste",e=>{if(!$("#dlg").open)return;const f=[...(e.clipboardData?.items||[])].filter(i=>i.type.startsWith("image/")).map(i=>i.getAsFile());if(f.length){e.preventDefault();addFiles(f,!!(document.activeElement&&document.activeElement.closest&&document.activeElement.closest("#saleBox")))}});
async function addFiles(list,pack){const arr=pack?packPhotos:photos;for(const f of list)if(f.type.startsWith("image/"))arr.push(await shrink(f));pack?drawPacks():drawPhotos()}
function shrink(file){return new Promise((res,rej)=>{const u=URL.createObjectURL(file),im=new Image();
  im.onload=()=>{const s=Math.min(1,1400/Math.max(im.width,im.height)),c=document.createElement("canvas");c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext("2d").drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);res(c.toDataURL("image/jpeg",.85))};
  im.onerror=()=>rej();im.src=u})}

$("#form").onsubmit=async e=>{
  e.preventDefault();
  if(lotEdit){await saveLot();return}
  const now=Date.now(), isNew=!cur;
  const {out:lines,dup}=isNew?serialLines():{out:[],dup:[]};
  if(dup.length&&!await ask(`Bỏ ${dup.length} serial bị gõ trùng: ${dup.join(", ")}. Lưu ${lines.length} món còn lại?`))return;
  const kitOn=isNew&&F("kit").checked,qn=Math.max(1,Math.floor(n(F("qty").value)));
  const N=isNew?(lines.length||(kitOn?qn*KIT:qn)):1;
  if(kitOn&&N%KIT&&!await ask(`Số thanh lẻ (${N}): thanh cuối sẽ là món lẻ, không thuộc kit. Vẫn lưu?`))return;
  const kitIds=kitOn?Array.from({length:Math.ceil(N/KIT)},()=>uid()):[];
  const serials=isNew?Array.from({length:N},(_,k)=>lines[k]||""):[F("serial").value.trim()];
  for(const sn of serials){const k=ns(sn);if(!k)continue;const d=items.find(i=>i!==cur&&ns(i.serial)===k);if(d&&!await ask(`Serial ${sn} đã có ở món "${d.name}". Vẫn lưu?`))return}
  if(serials.some(x=>!x)&&!await ask(N>1?"Một số cái chưa có serial (có thể điền sau). Không có serial thì không đối chiếu được khi trả hàng. Vẫn lưu?":"Chưa có serial thì không đối chiếu được khi bị trả hàng. Vẫn lưu?"))return;
  const saved=[];
  for(let j=0;j<N;j++){
    const it=cur?{...cur}:{id:uid(),createdAt:now+j};
    FLD.forEach(f=>it[f]=F(f).value.trim());
    it.serial=serials[j];
    if(kitOn){ // tiền nhập là của cả kit: chia cho từng thanh trong cặp
      const p=Math.floor(j/KIT),size=Math.min(KIT,N-p*KIT);
      if(size>1)it.kitId=kitIds[p];
      KIT_F.forEach(k=>{if(it[k]!==undefined)it[k]=splitC(it[k],KIT)[j%KIT]});
    }
    it.status=status;it.photos=photos;it.updatedAt=now;
    if(status==="kho")delete it.packPhotos;else it.packPhotos=packPhotos;
    if(status==="ban"&&!it.saleDate)it.saleDate=today();
    if(status==="tra"&&!it.retDate)it.retDate=today();
    if(status!=="kho")it.shipN=groupN();
    if(status==="kho")["price","orderId","buyer","tracking","carrier","trk","deliveredAt","fees","shipTotal","shipN","saleDate"].forEach(f=>delete it[f]);
    if(status!=="tra")["refund","retSerial","retDate"].forEach(f=>delete it[f]);
    await put(it);saved.push(it);
  }
  // kit: thanh còn lại theo đúng trạng thái/đơn; tiền của cả kit chia đều (cộng lại đúng tổng)
  const kitNow=kitOf(cur);
  if(cur&&kitNow.length>1){
    const a=saved[0],k=kitNow.length,sp=Object.fromEntries(KIT_F.map(f=>[f,splitC(a[f],k)]));
    const SH=["status","orderId","buyer","tracking","carrier","shipTotal","shipN","saleDate","retDate","packPhotos","name","pn","trk","listPrice","shipMode","shipCharge"];
    for(let j=0;j<k;j++){
      const m=kitNow[j],x=m.id===a.id?{...a}:{...m};
      if(m.id!==a.id){for(const f of SH){if(a[f]!==undefined)x[f]=a[f];else delete x[f]}x.updatedAt=now}
      KIT_F.forEach(f=>{if(a[f]===undefined)delete x[f];else x[f]=sp[f][j]});
      if(x.status!=="tra")delete x.retSerial;
      await put(x);
    }
  }
  if(cur&&status==="ban"){
    for(const cb of $$("#mates [data-mate]:checked")){
      const m=items.find(i=>i.id===cb.dataset.mate);if(!m)continue;
      const a=saved[0];
      await put({...m,status:"ban",price:a.price,orderId:a.orderId,buyer:a.buyer,tracking:a.tracking,fees:a.fees,shipTotal:a.shipTotal,shipN:a.shipN,shipMode:a.shipMode,shipCharge:a.shipCharge,saleDate:a.saleDate,packPhotos:a.packPhotos,updatedAt:now});
    }
  }
  if(status!=="kho"&&saved[0].orderId){
    const src=saved[0],o=okey(src.orderId);
    const fresh=(await all()).filter(i=>i.status!=="kho"&&okey(i.orderId)===o);
    if(fresh.length>1){
      const total=src.shipTotal||(fresh.find(i=>i.shipTotal)||{}).shipTotal||"";
      const buyer=src.buyer||(fresh.find(i=>i.buyer)||{}).buyer||"";
      const tsrc=src.tracking?src:(fresh.find(i=>i.tracking)||{}),trk=tsrc.tracking||"",carrier=tsrc.carrier||"";
      const pk=(src.packPhotos&&src.packPhotos.length)?src.packPhotos:((fresh.find(i=>(i.packPhotos||[]).length)||{}).packPhotos||[]);
      const msrc=src.shipMode?src:(fresh.find(i=>i.shipMode)||{}),shipMode=msrc.shipMode||"",shipCharge=msrc.shipCharge||"";
      for(const m of fresh)await put({...m,shipTotal:total,shipN:fresh.length,buyer,tracking:trk,carrier,packPhotos:pk,shipMode,shipCharge});
    }
  }
  $("#dlg").close();await reload();
};
// Restock: mở form Thêm hàng điền sẵn từ món này; cùng tên + P/N nên tự gom chung lô (gkey)
// Restock: mở form Thêm hàng điền sẵn từ một món (kể cả món đã bán); món gốc không đổi
function restockFrom(src){
  if(!src)return;
  openItem(null);
  ["name","pn","cost","listPrice","shipMode","shipCharge"].forEach(k=>F(k).value=src[k]??"");
  const sk=kitOf(src);if(sk.length>1){F("kit").checked=true;F("cost").value=sk.reduce((a,i)=>a+n(i.cost),0).toFixed(2)}
  qtySync();kitTags();shipModeUI();
  photos=[...(src.photos||[])];drawPhotos();
  $("#title").textContent="🔁 Restock: "+(src.name||"món hàng");
  setTimeout(()=>F("serials").focus(),20);
}
$("#restock").onclick=()=>restockFrom(cur);
$("#del").onclick=async()=>{if(cur&&await ask(`Xoá "${cur.name}"? Không hoàn tác được.`)){await rm(cur.id);$("#dlg").close();await reload()}};

$("#check").onclick=check;[$("#rs"),$("#ro")].forEach(i=>i.onkeydown=e=>{if(e.key==="Enter")check()});
function card(i){return `<div class="card" style="margin:10px 0 0;padding:12px;color:var(--text)"><b>${esc(i.name)}</b> <span class="tag s-${i.status}">${ST[i.status]}</span><br>
  P/N: <span class="mono">${esc(i.pn||"")}</span><br>Serial đã ghi: <b class="mono">${esc(i.serial||"(trống)")}</b><br>Order: <span class="mono">${esc(i.orderId||"")}</span> · Người mua: ${esc(i.buyer||"")}<br>Test: ${esc(i.test||"")}
  <div class="photos" style="margin:8px 0">${(i.photos||[]).map(d=>`<img loading="lazy" src="${ph(d)}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;cursor:zoom-in" data-big>`).join("")}</div>
  ${(i.packPhotos||[]).length?`<div class="muted" style="font-size:13px">Ảnh đóng gói lúc gửi:</div><div class="photos" style="margin:4px 0 8px">${i.packPhotos.map(d=>`<img loading="lazy" src="${ph(d)}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;cursor:zoom-in" data-big>`).join("")}</div>`:""}
  <button class="btn" data-open="${i.id}">Mở / ghi nhận trả hàng</button></div>`}
function check(){
  const s=$("#rs").value.trim(),k=ns(s),o=$("#ro").value.trim().toLowerCase(),out=$("#res");
  if(!k&&!o){out.innerHTML=`<div class="result warn">Nhập serial hoặc Order ID.</div>`;return}
  let html;
  const bySerial=k?items.filter(i=>ns(i.serial)===k):[];
  const byOrder=o?items.filter(i=>[i.orderId,i.buyer,i.tracking].some(v=>v&&v.toLowerCase().includes(o))):[];
  if(o&&!byOrder.length)html=`<div class="result warn"><h3>Không tìm thấy đơn “${esc(o)}”</h3>Kiểm tra lại Order ID.${bySerial.map(card).join("")}</div>`;
  else if(o&&!k)html=`<div class="result warn"><h3>Đơn này có ${byOrder.length} món</h3>Giờ gõ serial trên món nhận về để so.${byOrder.map(card).join("")}</div>`;
  else if(o){
    const hit=byOrder.find(i=>ns(i.serial)===k);
    html=hit?`<div class="result ok"><h3>✅ KHỚP: đúng món bạn đã bán</h3>${card(hit)}</div>`
      :`<div class="result bad"><h3>❌ KHÔNG KHỚP</h3>Serial nhận về <b class="mono">${esc(s)}</b> khác serial đã gửi trong đơn này.<br><b>Có thể người mua trả hàng khác.</b> Đừng hoàn tiền vội. Chụp ảnh nhãn serial rồi mở khiếu nại trên eBay (Resolution Center, “item returned is different”) kèm ảnh lúc bán.${byOrder.map(card).join("")}</div>`;
  } else html=bySerial.length?`<div class="result ok"><h3>Tìm thấy serial trong dữ liệu</h3>Nên đối chiếu thêm Order ID.${bySerial.map(card).join("")}</div>`
      :`<div class="result bad"><h3>❌ Serial không có trong dữ liệu của bạn</h3>Có thể không phải hàng bạn bán. Nhập thêm Order ID để biết serial lẽ ra phải là gì.</div>`;
  out.innerHTML=html;
  $$("#res [data-open]").forEach(b=>b.onclick=()=>{openItem(b.dataset.open);if(status==="ban")setStatus("tra");F("retSerial").value=s;upd()});
  $$("#res [data-big]").forEach(im=>im.onclick=()=>{$("#viewer img").src=im.src;$("#viewer").showModal()});
}

const dl=(name,text,type)=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000)};
$("#bk").onclick=async()=>{
  const its=await all();
  for(const i of its){i.photos=await Promise.all((i.photos||[]).map(p=>API.readPhoto(p)));if(i.packPhotos)i.packPhotos=await Promise.all(i.packPhotos.map(p=>API.readPhoto(p)))}
  dl(`quanly-ebay-saoluu-${today()}.json`,JSON.stringify({app:"quanly-ebay-don-gian",pct:PCT,items:its,at:new Date().toISOString()}),"application/json");
  await mput("last",Date.now());backupAge();
};
$("#rf").onchange=async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;let d;
  try{d=JSON.parse(await f.text())}catch{await say("File không đúng định dạng.");return}
  if(d.app!=="quanly-ebay-don-gian"||!Array.isArray(d.items)){await say("Không phải file sao lưu của app này.");return}
  if(!await ask(`File có ${d.items.length} món. OK = THAY TOÀN BỘ dữ liệu hiện tại.`))return;
  await clr();for(const i of d.items)await put(i);if(d.pct){PCT=d.pct;$("#pct").value=PCT;await mput("pct",PCT)}await reload();await say("Đã khôi phục.")};
$("#mf").onchange=async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;let d;
  try{d=JSON.parse(await f.text())}catch{await say("File không đúng định dạng.");return}
  if(d.app!=="quanly-ebay-don-gian"||!Array.isArray(d.items)){await say("Không phải file của app này.");return}
  for(const i of d.items)await put(i);await reload();await say(`Đã thêm ${d.items.length} món (dữ liệu cũ giữ nguyên).`)};
$("#savepct").onclick=async()=>{PCT=n($("#pct").value);await mput("pct",PCT);$("#saved").textContent="Đã lưu";setTimeout(()=>$("#saved").textContent="",1500)};
$("#csv").onclick=()=>{
  const c=[["Tên",i=>i.name],["P/N",i=>i.pn],["Serial",i=>i.serial],["Trạng thái",i=>ST[i.status]],["Giá vốn",i=>i.cost],["Test",i=>i.test],["Ngày bán",i=>i.saleDate],["Giá bán",i=>i.price],["Phí eBay",i=>i.fees],["Ship (phần của cái này)",i=>i.status==="kho"||!i.shipTotal?"":shipShare(i).toFixed(2)],["Order ID",i=>i.orderId],["Người mua",i=>i.buyer],["Tracking",i=>i.tracking],["Lãi",i=>{const p=profit(i);return p==null?"":p.toFixed(2)}],["Hoàn tiền",i=>i.refund],["Serial nhận về",i=>i.retSerial],["Ghi chú",i=>i.notes]];
  const q=v=>{const s=String(v??"");return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s};
  dl(`quanly-ebay-${today()}.csv`,"\ufeff"+[c.map(x=>q(x[0])).join(","),...items.map(i=>c.map(x=>q(x[1](i))).join(","))].join("\r\n"),"text/csv;charset=utf-8");
};
async function backupAge(){
  const m=await mget("last"),last=m?m.value:0,w=$("#warn");
  $("#lastbk").textContent=API.info.electron||cget().on?"":(last?`Sao lưu gần nhất: ${new Date(last).toLocaleString("vi-VN")}`:"Chưa sao lưu lần nào.");
  const d=(Date.now()-last)/864e5;
  if(!API.info.electron&&!cget().on&&items.length&&d>7){w.style.display="block";w.innerHTML=(last?`Đã ${Math.floor(d)} ngày chưa sao lưu.`:"Bạn chưa sao lưu lần nào.")+` <a href="#" id="gb">Sao lưu ngay</a>`;$("#gb").onclick=e=>{e.preventDefault();showMod("set")}}else w.style.display="none";
}
