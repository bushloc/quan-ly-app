"use strict";
/* ===== Đồng bộ cloud (Supabase) =====
   Mỗi món / khoản chi / ca làm là 1 dòng trong bảng records; cài đặt, danh mục... là dòng coll="doc".
   "shadow" = bản đã đồng bộ lần cuối của từng dòng (lưu riêng trên thiết bị này) để biết dòng nào đổi.
   Đổi ở máy này chưa gửi + cloud cũng đổi: giữ bản ở máy này (vừa sửa, mới hơn) rồi gửi lên. */
const CK="ql-cloud",COLLS=["items","expenses","shifts"],DOCS=["clock","budgets","cats","settings","meta"];
const DEF={settings:{...DB.settings},cats:[...DB.cats]};
const cget=()=>{try{return JSON.parse(localStorage.getItem(CK))||{}}catch(e){return {}}};
const cset=v=>{try{localStorage.setItem(CK,JSON.stringify(v))}catch(e){}};
const NEED_LOGIN="Cần đăng nhập lại: gõ mật khẩu rồi bấm Kết nối";
let sb=null,sbUser=null,syncBusy=false,syncAgain=false,syncT=null,cloudErr="",cloudAt=0;
function sbClient(c){
  if(!c.url||!c.key||!window.supabase)return null;
  if(!sb)sb=supabase.createClient(c.url,c.key,{auth:{persistSession:true,autoRefreshToken:true,storageKey:"ql-sb-auth"}});
  return sb;
}
function recs(){
  const m=new Map();
  for(const c of COLLS)for(const r of DB[c]||[])if(r&&r.id)m.set(c+"/"+r.id,r);
  for(const k of DOCS)m.set("doc/"+k,DB[k]??null);
  return m;
}
const splitK=k=>{const i=k.indexOf("/");return [k.slice(0,i),k.slice(i+1)]};
async function pushAll(c){
  const sh=c.shadow||(c.shadow={}),now=recs(),rows=[];
  for(const [k,v] of now){const j=JSON.stringify(v);if(sh[k]!==j){const [coll,id]=splitK(k);rows.push({k,j,r:{user_id:sbUser.id,coll,id,data:v,deleted:false}})}}
  for(const k in sh)if(!now.has(k)){const [coll,id]=splitK(k);rows.push({k,r:{user_id:sbUser.id,coll,id,data:null,deleted:true}})}
  // chặn xoá hàng loạt: máy này lỡ mất dữ liệu thì không được xoá theo trên cloud
  {const dn=rows.filter(x=>x.r.deleted&&x.r.coll!=="doc").length,tot=Object.keys(sh).filter(k=>!k.startsWith("doc/")).length;
   if(dn>=10&&dn>tot*0.3)throw new Error(`Đã chặn: máy này định xoá ${dn}/${tot} dòng trên cloud. Dữ liệu cloud được giữ nguyên.`)}
  for(let i=0;i<rows.length;i+=200){
    const b=rows.slice(i,i+200);
    const {error}=await sb.from("records").upsert(b.map(x=>x.r),{onConflict:"user_id,coll,id"});
    if(error)throw error;
    for(const x of b){if(x.r.deleted)delete sh[x.k];else sh[x.k]=x.j}
    cset(c);
  }
  return rows.length;
}
function applyRow(c,r,first){
  const sh=c.shadow||(c.shadow={}),k=r.coll+"/"+r.id,j=r.deleted?undefined:JSON.stringify(r.data);
  const now=recs(),cur=now.has(k)?JSON.stringify(now.get(k)):undefined;
  if(cur===j){if(j===undefined)delete sh[k];else sh[k]=j;return 0}
  if(!first&&cur!==undefined&&cur!==sh[k]){if(j===undefined)delete sh[k];else sh[k]=j;return 0} // máy này vừa sửa, chưa gửi: giữ bản này
  if(j===undefined)delete sh[k];else sh[k]=j;
  if(r.coll==="doc"){
    if(!DOCS.includes(r.id)||r.deleted)return 0;
    if(first&&c.keep)return 0; // máy có dữ liệu kết nối lần đầu: giữ cài đặt của máy này (cloud có thể chỉ có mặc định của phone mới)
    const v=r.data;
    if(r.id==="settings")DB.settings={...DEF.settings,...(v||{})};
    else if(r.id==="cats")DB.cats=Array.isArray(v)?v:[...DEF.cats];
    else if(r.id==="budgets"||r.id==="meta")DB[r.id]=v&&typeof v==="object"?v:{};
    else DB[r.id]=v??null;
    return 1;
  }
  if(!COLLS.includes(r.coll))return 0;
  const a=DB[r.coll],ix=a.findIndex(x=>x&&x.id===r.id);
  if(r.deleted){if(ix>=0){a.splice(ix,1);return 1}return 0}
  if(ix>=0)a[ix]=r.data;else a.push(r.data);
  return 1;
}
async function pullAll(c){
  const first=!c.lastPull,from=new Date(Math.max(0,Date.parse(c.lastPull||0)-10000)).toISOString(); // lùi 10 giây cho chắc; áp lại dòng trùng không sao
  let ch=0,max=c.lastPull||"";
  for(let off=0;;off+=1000){
    const {data,error}=await sb.from("records").select("coll,id,data,deleted,updated_at").gt("updated_at",from).order("updated_at").range(off,off+999);
    if(error)throw error;
    for(const r of data){ch+=applyRow(c,r,first);if(!max||Date.parse(r.updated_at)>Date.parse(max))max=r.updated_at}
    if(data.length<1000)break;
  }
  if(max)c.lastPull=max;
  cset(c);
  return ch;
}
/* Ảnh: máy tính giữ file trong data\photos và đưa lên cloud; ảnh chụp trên phone thì máy tính tải về */
const toBlob=d=>fetch(d).then(r=>r.blob());
const toData=b=>new Promise((res,rej)=>{const f=new FileReader();f.onload=()=>res(f.result);f.onerror=rej;f.readAsDataURL(b)});
const photoNames=()=>{const s=new Set();for(const i of DB.items)for(const k of ["photos","packPhotos"])for(const p of i[k]||[])if(typeof p==="string"&&p&&!p.startsWith("data:"))s.add(p);return s};
async function photoSync(c){
  if(!API.info.electron)return 0;
  c.up=c.up||{};c.miss=c.miss||{};let got=0;const pre=sbUser.id+"/";
  for(const nm of photoNames()){
    if(c.up[nm]||(c.miss[nm]&&Date.now()-c.miss[nm]<3600e3))continue;
    const d=await API.readPhoto(nm);
    if(d){
      const {error}=await sb.storage.from("photos").upload(pre+nm,await toBlob(d),{upsert:true,contentType:d.slice(5,d.indexOf(";"))});
      if(error)throw error;
    }else{
      const {data,error}=await sb.storage.from("photos").download(pre+nm);
      if(error){c.miss[nm]=Date.now();cset(c);continue}
      await API.putPhoto(nm,await toData(data));got++;
    }
    c.up[nm]=1;delete c.miss[nm];cset(c);
  }
  return got;
}
// phone/trình duyệt: ảnh nằm trên cloud, hiện qua link có hạn (7 ngày), lấy theo lô rồi vẽ lại
const BLANK="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
const SIGK="ql-sig",LOCALPH=new Map();let SIG={};try{SIG=JSON.parse(localStorage.getItem(SIGK))||{}}catch(e){}
let sigQ=new Set(),sigT=null;
function cloudPhotoUrl(nm){
  if(!nm||nm.startsWith("data:"))return nm;
  if(LOCALPH.has(nm))return LOCALPH.get(nm);
  const s=SIG[nm];if(s&&s.exp>Date.now())return s.u;
  sigQ.add(nm);clearTimeout(sigT);sigT=setTimeout(fetchSigs,30);
  return s?s.u:BLANK;
}
async function fetchSigs(){
  const ns=[...sigQ];sigQ.clear();if(!sb||!sbUser||!ns.length)return;
  const {data,error}=await sb.storage.from("photos").createSignedUrls(ns.map(x=>sbUser.id+"/"+x),7*86400);
  if(error)return;
  ns.forEach((nm,i)=>{const r=data[i];SIG[nm]=r&&r.signedUrl?{u:r.signedUrl,exp:Date.now()+6*86400e3}:{u:BLANK,exp:Date.now()+600e3}});
  try{localStorage.setItem(SIGK,JSON.stringify(SIG))}catch(e){}
  render();
}
async function cloudSavePhoto(d){
  if(!sb||!sbUser)return d;
  const nm=uid()+"."+(/^data:image\/png/.test(d)?"png":"jpg");
  try{
    const {error}=await sb.storage.from("photos").upload(sbUser.id+"/"+nm,await toBlob(d),{upsert:true,contentType:d.slice(5,d.indexOf(";"))});
    if(error)throw error;
    LOCALPH.set(nm,d);return nm;
  }catch(e){return d} // mất mạng: giữ ảnh trong món, vẫn đồng bộ được (nặng hơn)
}
function cloudSoon(){if(cget().on){clearTimeout(syncT);syncT=setTimeout(cloudSync,2500)}}
async function cloudSync(){
  const c=cget();if(!c.on)return;
  if(syncBusy){syncAgain=true;return}
  syncBusy=true;let ch=0;
  try{
    if(!sbClient(c))throw new Error("Thiếu địa chỉ/khoá");
    const {data:{session}}=await sb.auth.getSession();
    if(!session)throw new Error(NEED_LOGIN);
    sbUser=session.user;
    // dữ liệu trên máy trống mà cloud từng có: lấy lại toàn bộ từ cloud thay vì xoá cloud
    if(c.lastPull&&!COLLS.some(k=>(DB[k]||[]).length)&&Object.keys(c.shadow||{}).some(k=>!k.startsWith("doc/"))){c.shadow={};c.lastPull="";c.keep=false;cset(c)}
    if(!c.lastPull)ch+=await pullAll(c); // lần đầu trên thiết bị này: lấy cloud trước rồi mới gửi
    await pushAll(c);
    ch+=await pullAll(c);
    ch+=await photoSync(c);
    cloudErr="";cloudAt=Date.now();
    bakWeekly();
  }catch(e){cloudErr=navigator.onLine===false?"Mất mạng, sẽ thử lại":(e&&e.message)||String(e)}
  if(ch){
    for(const k of COLLS)if(!Array.isArray(DB[k]))DB[k]=[];
    if(DB.meta&&DB.meta.pct)PCT=DB.meta.pct;
    API.save(DB).catch(()=>{});applyTheme();await reload();
    $("#pct").value=PCT;
    const m=($$("#side button").find(b=>b.classList.contains("on"))||{dataset:{}}).dataset.mod;if(m&&m!=="ebay")showMod(m);
  }
  syncBusy=false;cloudUi();
  if(syncAgain){syncAgain=false;cloudSoon()}
}
function cloudUi(){
  const c=cget(),on=!!c.on,st=$("#cloudSt");if(!st)return;
  const relog=on&&cloudErr===NEED_LOGIN; // phiên đăng nhập hết hạn: hiện lại ô nhập để đăng nhập lại (giữ nguyên dữ liệu đồng bộ)
  $("#cloudForm").classList.toggle("hidden",on&&!relog);$("#cOn").classList.toggle("hidden",!on);
  st.textContent=!on?"Chưa kết nối. Dữ liệu chỉ nằm trên "+(API.info.electron?"máy tính này.":"thiết bị này.")
    :`Đã kết nối: ${c.email||""}`+(cloudErr?` · ⚠️ ${cloudErr}`:cloudAt?` · đồng bộ lúc ${String(new Date(cloudAt).getHours()).padStart(2,"0")}:${String(new Date(cloudAt).getMinutes()).padStart(2,"0")}`:" · đang đồng bộ…");
  st.classList.toggle("neg",!!cloudErr);
  if(on&&!API.info.electron)$("#warn").style.display="none";
  const b=$("#cloudDot");if(b){b.className="cdot"+(on?cloudErr?" bad":" ok":"");b.title=st.textContent}
}
// nhận cả link dashboard (…/project/<mã>) hay link có đuôi /rest/v1 → https://<mã>.supabase.co
const sbUrl=v=>{v=String(v||"").trim();let m=/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i.exec(v);if(m)return "https://"+m[1].toLowerCase()+".supabase.co";m=/^(?:https?:\/\/)?([a-z0-9-]+)\.supabase\.co\b/i.exec(v);if(m)return "https://"+m[1].toLowerCase()+".supabase.co";if(/^[a-z0-9]{15,}$/i.test(v))return "https://"+v.toLowerCase()+".supabase.co";return v};
async function cloudConnect(){
  const url=sbUrl($("#cUrl").value),key=$("#cKey").value.trim(),email=$("#cMail").value.trim(),pass=$("#cPass").value;
  if(!/^https:\/\/[\w-]+\.supabase\.co$/.test(url))return say("Project URL phải có dạng https://xxxx.supabase.co");
  if(!key||!email||!pass)return say("Điền đủ khoá, email và mật khẩu.");
  if(!window.supabase)return say("Không tải được thư viện cloud.");
  sb=null;const c={url,key,email};
  const btn=$("#cGo");btn.disabled=true;btn.textContent="Đang kết nối…";
  try{
    sbClient(c);
    const {data,error}=await sb.auth.signInWithPassword({email,password:pass});
    if(error)throw error;
    sbUser=data.user;$("#cPass").value="";
    const prev=cget();
    if(prev.on&&prev.url===url&&prev.email===email){cset({...prev,key});cloudErr="";cloudUi();await cloudSync();return} // chỉ đăng nhập lại
    const {count,error:e2}=await sb.from("records").select("id",{count:"exact",head:true}).neq("coll","doc").eq("deleted",false);
    if(e2)throw e2;
    const local=DB.items.length+DB.expenses.length+DB.shifts.length;
    if(local){
      const msg=count?`Cloud đã có ${count} dòng. Gộp ${local} dòng trên ${API.info.electron?"máy tính":"thiết bị"} này vào cloud?\n(Cài đặt giữ theo máy này.)`
        :`Cloud đang trống. Đưa toàn bộ dữ liệu trên ${API.info.electron?"máy tính":"thiết bị"} này lên cloud?\n(${DB.items.length} món, ${DB.expenses.length} khoản chi, ${DB.shifts.length} ca làm)`;
      if(!await ask(msg+(API.info.electron?"\n\nMáy sẽ tạo bản sao lưu trước.":""))){await sb.auth.signOut({scope:"local"});sb=null;sbUser=null;return}
      if(API.info.electron)await API.backupNow();
    }
    cset({...c,on:true,shadow:{},lastPull:"",keep:local>0});
    useCloudPhotos();cloudUi();await cloudSync();
  }catch(e){sb=null;await say("Không kết nối được: "+((e&&e.message)||e))}
  finally{btn.disabled=false;btn.textContent="Kết nối"}
}
async function cloudOff(){
  if(!await ask("Ngắt đồng bộ cloud trên "+(API.info.electron?"máy tính":"thiết bị")+" này?\nDữ liệu trên máy và trên cloud vẫn giữ nguyên."))return;
  try{if(sb)await sb.auth.signOut({scope:"local"})}catch(e){} /* chỉ thoát máy này, không đăng xuất các máy khác */
  cset({});sb=null;sbUser=null;cloudErr="";cloudUi();
}
function useCloudPhotos(){if(!API.info.electron){API.photoUrl=cloudPhotoUrl;API.savePhoto=cloudSavePhoto}}
$("#cGo").onclick=cloudConnect;$("#cNow").onclick=()=>cloudSync();$("#cOff").onclick=cloudOff;
function cloudStart(){
  const c=cget();
  if(c.url)$("#cUrl").value=c.url;if(c.key)$("#cKey").value=c.key;if(c.email)$("#cMail").value=c.email;
  if(c.on){useCloudPhotos();sbClient(c);cloudSync()}
  cloudUi();
  setInterval(()=>{if(!document.hidden)cloudSync()},60000);
  // ẩn app (vuốt tắt trên iPhone không có beforeunload): ghi ngay + gửi cloud ngay, không đợi hẹn giờ
  document.addEventListener("visibilitychange",()=>{if(document.hidden)saveNow();cloudSync()});
  window.addEventListener("online",()=>cloudSync());
}

/* Bản dự phòng tuần: đúng 1 file <user>/_saoluu/du-phong.json trong kho "photos", mỗi tuần ghi đè 1 lần.
   Không nằm trong bảng records nên đồng bộ không đụng tới; lỡ xoá nhầm thì khôi phục từ đây. */
const BAK_PATH=()=>sbUser.id+"/_saoluu/du-phong.json";
async function bakUpload(){
  const body=new Blob([JSON.stringify({app:"quan-ly-ca-nhan",ver:typeof APP_VER!=="undefined"?APP_VER:"",at:new Date().toISOString(),db:DB})]);
  let r=await sb.storage.from("photos").upload(BAK_PATH(),body,{upsert:true,contentType:"application/json"});
  if(r.error)r=await sb.storage.from("photos").upload(BAK_PATH(),body,{upsert:true,contentType:"image/png"}); // kho chỉ nhận ảnh: vẫn lưu được
  if(r.error)throw r.error;
  const c=cget();c.bakAt=Date.now();cset(c);return c.bakAt;
}
async function bakInfo(){
  try{const {data,error}=await sb.storage.from("photos").list(sbUser.id+"/_saoluu");if(error)return null;const f=(data||[]).find(x=>x.name==="du-phong.json");return f?Date.parse(f.updated_at||f.created_at):null}catch(e){return null}
}
async function bakWeekly(){
  const c=cget();if(!c.on||!sbUser)return;
  if(c.bakAt&&Date.now()-c.bakAt<7*864e5)return;
  const at=await bakInfo();if(at&&Date.now()-at<7*864e5){c.bakAt=at;cset(c);return} // máy khác vừa lưu
  try{await bakUpload()}catch(e){}
}
async function bakRestore(){
  const {data,error}=await sb.storage.from("photos").download(BAK_PATH());
  if(error)throw error;
  const o=JSON.parse(await data.text());if(!o||!o.db||!Array.isArray(o.db.items))throw new Error("File dự phòng không đọc được");
  return o;
}

// Cài đặt → Sao lưu: hiện ngày bản dự phòng, lưu ngay, khôi phục
async function bakUi(){
  const box=$("#bakCloud");if(!box)return;
  const on=cget().on&&sbUser;box.classList.toggle("hidden",!on);if(!on)return;
  if(!API.info.electron){$("#bkText").innerHTML="Dữ liệu tự đồng bộ lên cloud. App giữ thêm <b>1 bản dự phòng</b> ở trên, mỗi tuần tự ghi đè, để lấy lại khi lỡ xoá nhầm. Các nút dưới chỉ cần khi muốn có file riêng.";$("#lastbk").textContent=""}
  const at=await bakInfo(),el=$("#bakAt");
  el.textContent=at?`Lưu lúc ${new Date(at).toLocaleDateString("vi-VN")} · tự ghi đè mỗi tuần`:"Chưa có · app sẽ tự lưu";
  $("#bakRes").disabled=!at;
  const c=[...document.querySelectorAll("#mod-set .acc")].find(x=>/Sao lưu/.test((x.querySelector("h3")||{}).textContent||""));
  if(c&&c.querySelector(".accs"))c.querySelector(".accs").textContent=at?"Dự phòng "+new Date(at).toLocaleDateString("vi-VN",{day:"numeric",month:"numeric"}):"";
}
$("#bakNow")&&($("#bakNow").onclick=async()=>{const b=$("#bakNow");b.disabled=true;b.textContent="Đang lưu…";try{await bakUpload();await bakUi();b.textContent="Đã lưu ✓"}catch(e){b.textContent="Lỗi";await say("Không lưu được: "+(e.message||e))}setTimeout(()=>{b.disabled=false;b.textContent="Lưu ngay"},1500)});
$("#bakRes")&&($("#bakRes").onclick=async()=>{
  try{
    const o=await bakRestore(),d=new Date(o.at).toLocaleString("vi-VN");
    if(!await ask(`Khôi phục dữ liệu về bản dự phòng lúc ${d}?\nMọi thay đổi sau thời điểm đó sẽ mất (trên cả iPhone và máy tính).`))return;
    for(const k of COLLS)DB[k]=Array.isArray(o.db[k])?o.db[k]:[];
    for(const k of DOCS)if(k in o.db)DB[k]=o.db[k];
    if(DB.meta&&DB.meta.pct)PCT=DB.meta.pct;
    await API.save(DB);await reload();cloudSoon();await say("Đã khôi phục bản dự phòng lúc "+d+".");
  }catch(e){await say("Không khôi phục được: "+(e.message||e))}
});
{const rs=renderSet;renderSet=function(){const r=rs.apply(this,arguments);bakUi();return r}}
