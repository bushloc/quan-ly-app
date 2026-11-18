"use strict";
/* ===== Khởi động ===== */
(async()=>{
  await loadDb();applyTheme();
  const p=await mget("pct");if(p)PCT=p.value;$("#pct").value=PCT;
  await reload();
  showMod("home");cloudStart();
  if("serviceWorker" in navigator&&location.protocol==="https:")navigator.serviceWorker.register("sw.js").catch(()=>{});
})();
