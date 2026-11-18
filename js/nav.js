"use strict";
/* ===== Điều hướng module ===== */
function showMod(m){
  $$("#side button").forEach(b=>b.classList.toggle("on",b.dataset.mod===m));
  $$("main>div[id^=mod-]").forEach(d=>d.classList.toggle("hidden",d.id!=="mod-"+m));
  const f={home:renderHome,ebay:render,spend:renderSpend,work:renderWork,set:renderSet}[m];
  if(f)f();
  updateFab();
}
function updateFab(){
  const m=($$("#side button").find(b=>b.classList.contains("on"))||{dataset:{}}).dataset.mod;
  const el=$("#fab");if(!el)return;
  el.classList.toggle("hidden",!(m==="spend"||(m==="ebay"&&!$("#tab-kho").classList.contains("hidden"))));
  el.dataset.m=m;
}
{let ly=0;addEventListener("scroll",()=>{const y=scrollY,el=$("#fab");if(!el)return;if(y>ly+8)el.classList.add("away");else if(y<ly-8||y<40)el.classList.remove("away");ly=y},{passive:true})}
$("#fab").onclick=()=>{
  if($("#fab").dataset.m==="ebay"){$("#new").click();return}
  const f=$("#spForm");f.scrollIntoView({behavior:"smooth",block:"center"});setTimeout(()=>f.amount.focus(),350);
};
$$("#side button").forEach(b=>b.onclick=()=>showMod(b.dataset.mod));
$$(".subnav button").forEach(b=>b.onclick=()=>{
  $$(".subnav button").forEach(x=>x.classList.toggle("on",x===b));
  $$("#mod-ebay>section").forEach(s=>s.classList.toggle("hidden",s.id!=="tab-"+b.dataset.tab));
  if(b.dataset.eb&&b.dataset.eb!=="check"){ebTab=b.dataset.eb;try{localStorage.setItem("ebTab",ebTab)}catch(e){}render()}
  updateFab();
});
$$("[data-go]").forEach(b=>b.onclick=()=>{
  showMod(b.dataset.go);
  if(b.dataset.act)$(b.dataset.act).click();
  if(b.dataset.focus)$(b.dataset.focus).focus();
});
$$("[data-close-dlg]").forEach(b=>b.onclick=()=>$("#"+b.dataset.closeDlg).close());
