"use strict";
const APP_VER="1.9.28";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const n=v=>{const x=parseFloat(v);return isFinite(x)?x:0};
const money=v=>(v<0?"-$":"$")+Math.abs(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ns=s=>String(s||"").toUpperCase().replace(/[\s\-_.:\/]/g,"");
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const ymd=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const today=()=>ymd(new Date());
const parseD=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
const addDays=(s,k)=>{const d=parseD(s);d.setDate(d.getDate()+k);return ymd(d)};
const monthOf=s=>String(s||"").slice(0,7);
const mKey=d=>ymd(d).slice(0,7);
const mShift=(k,delta)=>{const [y,m]=k.split("-").map(Number);return mKey(new Date(y,m-1+delta,1))};
const mLabel=k=>{const [y,m]=k.split("-");return "Tháng "+(+m)+"/"+y};
const DOW=["CN","T2","T3","T4","T5","T6","T7"];
const ST={kho:"Trong kho",ban:"Đã bán",tra:"Bị trả lại"};

/* ===== Lưu trữ: DB nằm trong bộ nhớ, ghi ra file qua API (Electron) hoặc localStorage (trình duyệt) ===== */
function browserApi(){
  const K="quan-ly-ca-nhan-db";
  return {
    info:{electron:false,dir:""},
    load:async()=>{try{return JSON.parse(localStorage.getItem(K))}catch(e){return null}},
    save:async d=>{try{localStorage.setItem(K,JSON.stringify(d))}catch(e){}return true},
    saveSync:d=>{try{localStorage.setItem(K,JSON.stringify(d))}catch(e){}return true},
    savePhoto:async d=>d, readPhoto:async n=>n, photoUrl:n=>n,
    openDir:async()=>{}, backupNow:async()=>"", openUrl:async u=>{window.open(u,"_blank","noopener")}
  };
}
const API=window.api||browserApi();
// Tracking API (USPS/UPS/FedEx) tạm tắt theo yêu cầu: giữ code, đổi thành true để bật lại
/* Hộp xác nhận/thông báo nằm trong app (thay confirm/alert gốc: trên Windows, sau hộp gốc của Electron
   ô nhập có thể không nhận phím cho tới khi bấm ra ngoài cửa sổ) */
function ask(msg,okOnly){
  return new Promise(res=>{
    const d=document.getElementById("askDlg"),back=document.activeElement;
    if(back&&back.blur&&back!==document.body)back.blur();
    document.getElementById("askMsg").textContent=msg;
    document.getElementById("askNo").style.display=okOnly?"none":"";
    d.returnValue="";
    d.onclose=()=>{d.onclose=null;res(okOnly?true:d.returnValue==="yes");if(back&&back.isConnected&&back.focus)setTimeout(()=>back.focus(),0)};
    d.showModal();setTimeout(()=>document.getElementById("askYes").focus(),0);
  });
}
const say=msg=>ask(msg,true);
// mở cửa sổ nào cũng đặt con trỏ vào ô nhập đầu tiên đang hiện
{const sm=HTMLDialogElement.prototype.showModal;
 HTMLDialogElement.prototype.showModal=function(){sm.call(this);if(this.id==="askDlg"||this.id==="viewer")return;
  setTimeout(()=>{const x=[...this.querySelectorAll("input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([disabled]),textarea,select")].find(e=>e.offsetParent!==null);if(x)x.focus()},0)}}
let DB={
  version:2, meta:{}, items:[], expenses:[], shifts:[], clock:null, budgets:{},
  cats:["Ăn uống","Nhà / Thuê","Xăng / Đi lại","Hoá đơn","Mua sắm","Sức khoẻ","Giải trí","Khác"],
  settings:{wage:23.5,otAfter:40,otMult:1.5,weekStart:0,lunch:30,payStart:"2026-11-01",theme:"dark"}
};
let saveT=null;
function save(){clearTimeout(saveT);saveT=setTimeout(()=>{API.save(DB).catch(()=>{});cloudSoon()},300)}
/* Đang gõ thì không vẽ lại vùng đó: vẽ lại dựng lại ô nhập nên mất focus (phone tụt bàn phím) và mất số đang gõ.
   Hoãn tới khi rời hẳn vùng đó (đồng bộ cloud, tải ảnh, lưu ô bên cạnh… đều đi qua đây) */
const isField=a=>!!(a&&a.matches&&a.matches("input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=button]),textarea,select"));
const typingIn=box=>{const a=document.activeElement;return isField(a)&&(!box||box.contains(a))};
const held=new Map();
function holdWhileTyping(key,box,fn){if(ptrDown){held.set(key,[box,fn]);return true}if(!typingIn(box))return false;held.set(key,[box,fn]);return true}
/* Đang nhấn chuột/ngón tay: chưa vẽ lại. Rời ô số (lưu + vẽ lại) xảy ra giữa lúc nhấn và thả nút Trả,
   vẽ lại lúc đó thay mất nút đang bấm nên cú bấm bị nuốt. Vẽ lại sau khi thả (sau click) */
let ptrDown=false;
const flushHeld=()=>{for(const [k,[box,fn]] of [...held])if(!typingIn(box)){held.delete(k);fn()}};
document.addEventListener("pointerdown",()=>{ptrDown=true},true);
for(const ev of ["pointerup","pointercancel"])document.addEventListener(ev,()=>setTimeout(()=>{ptrDown=false;flushHeld()},30),true);
document.addEventListener("focusout",()=>setTimeout(()=>{if(!ptrDown)flushHeld()},0));
// gửi form bằng Enter: rời ô trước để danh sách vẽ lại ngay
document.addEventListener("submit",()=>{const a=document.activeElement;if(isField(a))a.blur()},true);
function saveNow(){clearTimeout(saveT);try{API.saveSync(DB)}catch(e){}}
window.addEventListener("beforeunload",saveNow);
const S=()=>DB.settings;
const photoCache=new Map();
async function toFile(p){
  if(typeof p!=="string"||!p.startsWith("data:"))return p;
  if(photoCache.has(p))return photoCache.get(p);
  const name=await API.savePhoto(p);photoCache.set(p,name);return name;
}
async function procPhotos(v){
  for(const k of ["photos","packPhotos"])if(Array.isArray(v[k]))v[k]=await Promise.all(v[k].map(toFile));
}
const ph=d=>API.photoUrl(d);
const all=async()=>DB.items.map(x=>({...x}));
const put=async v=>{await procPhotos(v);const c={...v},k=DB.items.findIndex(i=>i.id===c.id);if(k>=0)DB.items[k]=c;else DB.items.push(c);save();return v};
const rm=async k=>{DB.items=DB.items.filter(i=>i.id!==k);save()};
const clr=async()=>{DB.items=[];save()};
const mget=async k=>DB.meta[k]!==undefined?{value:DB.meta[k]}:undefined;
const mput=async(k,v)=>{DB.meta[k]=v;save()};
async function loadDb(){
  const d=await API.load();
  if(d&&typeof d==="object"){
    DB={...DB,...d,settings:{...DB.settings,...(d.settings||{})}};
    for(const k of ["items","expenses","shifts","cats"])if(!Array.isArray(DB[k]))DB[k]=[];
    if(!DB.budgets||typeof DB.budgets!=="object")DB.budgets={};
    if(!DB.meta)DB.meta={};
    // đổi một lần: tuần CN–T7 (dữ liệu cũ lưu Thứ hai); sau đó tôn trọng lựa chọn trong Cài đặt
    if(!DB.meta.weekSun){DB.settings.weekStart=0;DB.meta.weekSun=1;save()}
  }
}

let items=[], cur=null, photos=[], packPhotos=[], PCT=15, status="kho";
const FEE_FIXED=0.40;
const calcFee=p=>p>0?+(p*PCT/100+FEE_FIXED).toFixed(2):0;
const shipShare=i=>n(i.shipTotal)/(n(i.shipN)||1);
// ship người mua trả (cả đơn) cộng vào doanh thu, chia đều như ship bạn trả; đơn không điền thì = 0 (đơn cũ không đổi)
const chargeShare=i=>i.shipMode==="buyer"?n(i.shipCharge)/(n(i.shipN)||1):0;
const profit=i=>i.status==="ban"?n(i.price)+chargeShare(i)-n(i.fees)-shipShare(i)-n(i.cost):null;

async function reload(){items=(await all()).sort((a,b)=>b.createdAt-a.createdAt);render();backupAge()}


$("#q").oninput=()=>render();$("#new").onclick=()=>openItem(null);
/* Tracking: có số tracking = đã ship = HOÀN THÀNH */
const shipped=i=>i.status==="ban"&&!!String(i.tracking||"").trim();
// mọi hãng đều tra trên 17track (tự nhận hãng)
function trackLink(t){
  const s=String(t||"").replace(/[\s-]/g,"").toUpperCase();
  return {c:"Track trên 17track",u:"https://t.17track.net/en#nums="+encodeURIComponent(s)};
}
const fdate=s=>{const d=new Date(s);return isNaN(d)?"":d.getDate()+"/"+(d.getMonth()+1)};
 // tự cập nhật: mỗi số tối đa 1 lần/3 giờ; bấm tay: tối đa 1 lần/10 phút
