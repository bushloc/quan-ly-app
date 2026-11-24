"use strict";
/* ===== Giao diện thêm: trạng thái trống, badge thanh bên, chip danh mục, tìm kiếm chung, vuốt xoá, màu nhấn ===== */

// 5) trạng thái trống: biểu tượng + câu + nút gợi ý (act = tên hành động xử lý ở dưới)
function emptyBox(msg,icon,btn,act,sub){
  return `<div class="emp"><div class="emi"><span>${icon}</span></div><div class="emt">${esc(msg)}</div>${sub?`<div class="ems">${esc(sub)}</div>`:""}${btn?`<button type="button" class="btn ${act==="clrq"||act==="eball"?"":"primary"}" data-emp="${act}">${esc(btn)}</button>`:""}</div>`;
}
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-emp]");if(!b)return;
  if(b.dataset.emp==="new")$("#new").click();
  else if(b.dataset.emp==="clrq"){const q=$("#q");q.value="";q.dispatchEvent(new Event("input",{bubbles:true}));render()}
  else if(b.dataset.emp==="eball")$("#ebMAll").click();
  else if(b.dataset.emp==="fx"||b.dataset.emp==="cc"){showMod("set");setTimeout(()=>{openSet(b.dataset.emp==="fx"?"fxSet":"cardSet");$("#"+(b.dataset.emp==="fx"?"fxSet":"cardSet")).scrollIntoView({block:"start"})},0)}
  else if(b.dataset.emp==="bud"){showMod("spend");setTimeout(()=>{const x=[...$$("#mod-spend button")].find(x=>/Chỉnh ngân sách/.test(x.textContent));x&&x.click()},50)}
  else if(b.dataset.emp==="spend"){const f=$("#spForm");f.scrollIntoView({behavior:"smooth",block:"center"});setTimeout(()=>f.amount.focus(),300)}
});

// 8) badge số trên thanh dưới / thanh bên
function updateBadges(){
  if(typeof DB==="undefined"||!DB.items)return;
  const nowM=mKey(new Date());
  const ship=ordersOf(DB.items.filter(i=>i.status!=="kho")).filter(o=>o.stage==="ship").length;
  let late=0,due=0;
  for(const c of cards().filter(c=>c.name)){const [st]=cardState(c,nowM);if(st==="late")late++;else if(st==="soon")due++}
  const fx=fxRows(nowM).filter(r=>!r.paid).length;
  const v={ebay:[ship,ship?"warn":""],spend:[late+due+fx,late?"bad":"warn"],work:[DB.clock?1:0,"go"]};
  for(const b of $$("#side button[data-mod]")){
    const x=v[b.dataset.mod];let i=b.querySelector(".nbadge");
    if(!x||!x[0]){if(i)i.remove();continue}
    if(!i){i=document.createElement("i");b.appendChild(i)}
    i.className="nbadge "+x[1];i.textContent=b.dataset.mod==="work"?"":x[0]>99?"99+":x[0];
  }
}
setInterval(updateBadges,1500);

// 3) ghi chi tiêu nhanh: chip danh mục hay dùng, nhớ danh mục lần trước
function spChips(){
  const f=$("#spForm"),box=$("#spChips");if(!f||!box)return;
  if(!f.dataset.init){f.dataset.init="1";try{const c=localStorage.getItem("lastCat");if(c&&DB.cats.includes(c))f.cat.value=c}catch(e){}}
  const since=addDays(today(),-90),cnt={};
  for(const e of DB.expenses)if(e.type==="chi"&&e.date>=since&&DB.cats.includes(e.cat))cnt[e.cat]=(cnt[e.cat]||0)+1;
  const top=[...new Set([...Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]),...DB.cats])].slice(0,6);
  box.classList.toggle("hidden",f.type.value!=="chi");
  box.innerHTML=top.map(c=>`<button type="button" class="chip${f.cat.value===c?" on":""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
}
{
  const f=$("#spForm");f.insertAdjacentHTML("afterbegin",'<div class="catchips" id="spChips"></div>');
  $("#spChips").addEventListener("click",e=>{const b=e.target.closest("[data-cat]");if(!b)return;f.cat.value=b.dataset.cat;try{localStorage.setItem("lastCat",b.dataset.cat)}catch(x){}spChips();f.amount.focus()});
  f.cat.addEventListener("change",()=>{try{localStorage.setItem("lastCat",f.cat.value)}catch(x){}spChips()});
  f.type.addEventListener("change",spChips);
  const rs=renderSpend;renderSpend=function(){rs.apply(this,arguments);spChips()};
}

// 1) vuốt trái một khoản chi để xoá (hỏi lại trước khi xoá)
{
  const L=$("#spList");let st=null;
  L.addEventListener("touchstart",e=>{const r=e.target.closest(".exrow");if(!r||e.touches.length!==1){st=null;return}st={r,x:e.touches[0].clientX,y:e.touches[0].clientY,dx:0,on:false}},{passive:true});
  L.addEventListener("touchmove",e=>{if(!st)return;const dx=e.touches[0].clientX-st.x,dy=e.touches[0].clientY-st.y;
    if(!st.on){if(Math.abs(dy)>14&&Math.abs(dy)>Math.abs(dx)){st=null;return}if(dx<-14&&Math.abs(dx)>Math.abs(dy)*1.5)st.on=true}
    if(st.on){st.dx=dx;st.r.style.transform=`translateX(${Math.max(-120,dx)}px)`;st.r.classList.toggle("swd",dx<-90)}},{passive:true});
  L.addEventListener("touchend",async()=>{if(!st)return;const {r,dx,on}=st;st=null;r.style.transform="";r.classList.remove("swd");
    if(on&&dx<-90){r.dataset.noclick="1";setTimeout(()=>delete r.dataset.noclick,400);const id=r.dataset.ex;
      const ex=DB.expenses.find(x=>x.id===id);if(ex)delUndo("expenses",ex,"Đã xoá khoản chi",renderSpend)}});
  L.addEventListener("click",e=>{const r=e.target.closest(".exrow");if(r&&r.dataset.noclick)e.stopImmediatePropagation()},true);
}

// 7) màu nhấn + chế độ tối tự theo giờ
const ACCENTS={
  blue:{dark:["#60a5fa","#2563eb","#06b6d4"],light:["#2563eb","#2563eb","#0891b2"]},
  green:{dark:["#34d399","#059669","#06b6d4"],light:["#047857","#059669","#0891b2"]},
  orange:{dark:["#fb923c","#ea580c","#f59e0b"],light:["#c2410c","#ea580c","#d97706"]},
  pink:{dark:["#f472b6","#db2777","#a855f7"],light:["#be185d","#db2777","#9333ea"]}
};
function applyAccent(){
  const st=document.documentElement.style,k=S().accent,a=ACCENTS[k];
  for(const p of ["--accent","--soft","--grad","--glow","--glow-h","--hl"])st.removeProperty(p);
  if(!a)return;
  const th=document.documentElement.dataset.theme==="light"?"light":"dark",[ac,c1,c2]=a[th];
  const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)).join(",");
  st.setProperty("--accent",ac);st.setProperty("--soft",`rgba(${rgb(c1)},${th==="light"?.1:.18})`);
  st.setProperty("--grad",`linear-gradient(135deg,${c1},${c2})`);
  st.setProperty("--glow",`0 6px 22px rgba(${rgb(c1)},${th==="light"?.32:.45})`);st.setProperty("--glow-h",`0 8px 30px rgba(${rgb(c1)},${th==="light"?.5:.68})`);
  st.setProperty("--hl",`rgba(${rgb(c1)},.45)`);
}
{
  const lab=$("#stTheme").closest("label");
  lab.insertAdjacentHTML("afterend",'<label style="max-width:260px;margin-bottom:0">Màu nhấn<select id="stAccent"><option value="">Tím (mặc định)</option><option value="blue">Xanh dương</option><option value="green">Xanh lá</option><option value="orange">Cam</option><option value="pink">Hồng</option></select></label>');
  $("#stTheme").insertAdjacentHTML("beforeend",'<option value="time">Tự động theo giờ (tối 18h–7h)</option>');
  $("#stAccent").onchange=e=>{S().accent=e.target.value;applyAccent();save()};
  const rs=renderSet;renderSet=function(){rs.apply(this,arguments);$("#stAccent").value=S().accent||""};
  setInterval(()=>{if(S().theme==="time")applyTheme()},600000);
}

// 8) xoá xong hiện thanh "Hoàn tác" 6 giây thay cho hộp hỏi lại
let toastT=null;
function toast(msg,undo){
  let t=$("#toast");if(!t){document.body.insertAdjacentHTML("beforeend",'<div id="toast" class="toast hidden" role="status"><span></span><button type="button" class="btn">Hoàn tác</button></div>');t=$("#toast")}
  t.querySelector("span").textContent=msg;const b=t.querySelector("button");b.style.display=undo?"":"none";
  b.onclick=()=>{clearTimeout(toastT);t.classList.add("hidden");if(undo)undo()};
  t.classList.remove("hidden");clearTimeout(toastT);toastT=setTimeout(()=>t.classList.add("hidden"),6000);
}
function delUndo(arr,obj,label,rerender){
  const a=DB[arr],idx=a.indexOf(obj);if(idx<0)return;
  DB[arr]=a.filter(x=>x!==obj);save();rerender();
  toast(label,()=>{if(!DB[arr].some(x=>x.id===obj.id)){DB[arr].splice(Math.min(idx,DB[arr].length),0,obj);save();rerender()}});
}

// 1) lời chào + tóm tắt hôm nay trên Tổng quan; 10) hướng dẫn lần đầu khi chưa có dữ liệu
{
  const rh=renderHome;
  renderHome=function(){
    rh.apply(this,arguments);
    const h=new Date().getHours(),g=h<11?"Chào buổi sáng ☀️":h<14?"Chào buổi trưa 🌤":h<18?"Chào buổi chiều 🌇":"Chào buổi tối 🌙";
    const k=$$("#homeTodo .tdo").length,bad=$$("#homeTodo .tdo.bad").length;
    const d=new Date(),dow=["Chủ nhật","Thứ Hai","Thứ Ba","Thứ Tư","Thứ Năm","Thứ Sáu","Thứ Bảy"][d.getDay()];
    let el=$("#greet");if(!el){$("#homeTodo").insertAdjacentHTML("beforebegin",'<div id="greet" class="greet"></div>');el=$("#greet")}
    el.innerHTML=`<b>${g}</b><span>${dow} ${d.getDate()}/${d.getMonth()+1} · ${k?`${k} việc cần để ý${bad?`, ${bad} đã trễ`:""}`:"hôm nay không có việc gấp"}</span><em>Xem trang Hôm nay ›</em>`;
    let ob=$("#onboard");const empty=!DB.items.length&&!DB.expenses.length&&!DB.shifts.length;let dis=false;try{dis=localStorage.getItem("obDone")==="1"}catch(e){}
    if(empty&&!dis){
      if(!ob){el.insertAdjacentHTML("afterend",'<div id="onboard" class="card onb"><h3>Bắt đầu nhanh</h3><div class="onb-s"><button type="button" class="btn" data-go="ebay" data-act="#new"><b>1</b> Thêm món hàng đầu tiên</button><button type="button" class="btn" data-go="spend" data-focus="#spForm [name=amount]"><b>2</b> Ghi khoản chi đầu tiên</button><button type="button" class="btn" data-go="work"><b>3</b> Nhập giờ làm / Clock In</button></div><button type="button" class="btn" id="obX">Để sau</button></div>');
        $$("#onboard [data-go]").forEach(b=>b.onclick=()=>{showMod(b.dataset.go);if(b.dataset.act)$(b.dataset.act).click();if(b.dataset.focus)$(b.dataset.focus).focus()});
        $("#obX").onclick=()=>{try{localStorage.setItem("obDone","1")}catch(e){}$("#onboard").remove()}}
    }else if(ob)ob.remove();
  };
}

// 7) nút Clock Out nổi khi đang trong ca (ở mọi tab trừ Giờ làm)
{
  document.body.insertAdjacentHTML("beforeend",'<button type="button" id="clkFab" class="clkfab hidden"><i></i><span id="clkT">00:00:00</span><b>Clock Out</b></button>');
  const tick=()=>{
    const el=$("#clkFab");
    if(!DB.clock||!$("#mod-work").classList.contains("hidden")||($("#mod-today")&&!$("#mod-today").classList.contains("hidden"))){el.classList.add("hidden");return}
    const s=Math.max(0,Math.floor((Date.now()-DB.clock.start)/1000));
    $("#clkT").textContent=[Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(x=>String(x).padStart(2,"0")).join(":");el.classList.remove("hidden");
  };
  $("#clkFab").onclick=()=>{$("#clockBtn").click();tick()};
  setInterval(tick,1000);
}

// 4) xem ảnh lớn: vuốt hoặc bấm ‹ › để qua ảnh khác của cùng món
{
  let gal=[],gi=0;const v=$("#viewer");
  v.insertAdjacentHTML("beforeend",'<button type="button" class="vnav prev" aria-label="Ảnh trước">‹</button><button type="button" class="vnav next" aria-label="Ảnh sau">›</button><span class="vcnt"></span>');
  const cnt=()=>{v.querySelector(".vcnt").textContent=gal.length>1?`${gi+1}/${gal.length}`:"";v.classList.toggle("multi",gal.length>1)};
  const show=d=>{if(gal.length<2)return;gi=(gi+d+gal.length)%gal.length;v.querySelector("img").src=gal[gi];cnt()};
  document.addEventListener("click",e=>{
    const im=e.target.closest("img[data-zoom],img[data-v],img[data-pv],img[data-big]");if(!im)return;
    const sel=["data-zoom","data-v","data-pv","data-big"].find(a=>im.hasAttribute(a)),box=im.closest("#photos,#packs,#res,.oc,.u")||im.parentElement;
    gal=[...box.querySelectorAll(`img[${sel}]`)].map(x=>x.src);gi=Math.max(0,gal.indexOf(im.src));
    setTimeout(cnt,0);
  },true);
  v.querySelector(".prev").onclick=e=>{e.stopPropagation();show(-1)};v.querySelector(".next").onclick=e=>{e.stopPropagation();show(1)};
  let x0=null;v.addEventListener("touchstart",e=>{x0=e.touches[0].clientX},{passive:true});
  v.addEventListener("touchend",e=>{if(x0==null)return;const dx=e.changedTouches[0].clientX-x0;x0=null;if(Math.abs(dx)>50){show(dx<0?1:-1);v.dataset.sw="1";setTimeout(()=>delete v.dataset.sw,300)}});
  v.addEventListener("click",e=>{if(v.dataset.sw)e.stopImmediatePropagation()},true);
}

// 9) cỡ chữ + độ thoáng
function applyView(){const r=document.documentElement;r.dataset.fs=S().fs||"m";r.dataset.den=S().den||"n"}
{
  const lab=$("#stTheme").closest("label");
  lab.insertAdjacentHTML("afterend",'<label style="max-width:260px;margin-bottom:0">Cỡ chữ<select id="stFs"><option value="s">Nhỏ</option><option value="m">Vừa</option><option value="l">Lớn</option></select></label><label style="max-width:260px;margin-bottom:0">Khoảng cách<select id="stDen"><option value="c">Gọn</option><option value="n">Bình thường</option><option value="r">Thoáng</option></select></label>');
  $("#stFs").onchange=e=>{S().fs=e.target.value;applyView();save()};$("#stDen").onchange=e=>{S().den=e.target.value;applyView();save()};
  const rs=renderSet;renderSet=function(){rs.apply(this,arguments);$("#stFs").value=S().fs||"m";$("#stDen").value=S().den||"n"};
  const at=applyTheme;applyTheme=function(){at.apply(this,arguments);applyView()};
}

// 11) rung nhẹ khi bấm nút chính (Android/Chrome; iPhone chưa hỗ trợ web rung)
document.addEventListener("click",e=>{if(navigator.vibrate&&e.target.closest(".pt,.btn.primary,.clockbtn,.clkfab,#fab"))navigator.vibrate(12)},true);
