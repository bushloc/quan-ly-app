"use strict";
/* ===== Cài đặt ===== */
function renderSet(){
  if(holdWhileTyping("set",$("#mod-set"),renderSet))return;
  $("#stWage").value=S().wage;$("#stOtAfter").value=S().otAfter;$("#stOtMult").value=S().otMult;$("#stWeek").value=S().weekStart;$("#stLunch").value=lunch();$("#stLeaveOt").checked=!!S().leaveOt;$("#stPay").value=payStart();$("#stTax").value=taxPct();$("#stTheme").value=S().theme||"dark";
  $("#bkText").innerHTML=API.info.electron
    ?`Dữ liệu lưu thành file trong thư mục <b class="mono">${esc(API.info.dir)}</b> (ảnh nằm trong thư mục con <span class="mono">photos</span>). App tự lưu <b>1 bản dự phòng</b> vào <span class="mono">backup\\db-saoluu.json</span>, mỗi tuần ghi đè 1 lần. Nếu để thư mục này trong OneDrive thì có thêm bản dự phòng trên mạng.`
    :`Dữ liệu lưu trong trình duyệt này. Hãy tải file sao lưu thường xuyên và cất vào C:\\Dev\\Online hoặc OneDrive.`;
  $("#elBtns").classList.toggle("hidden",!API.info.electron);
  renderFixedSet();renderCardSet();
  backupAge();
}
$("#stSaveWork").onclick=()=>{
  Object.assign(S(),{wage:n($("#stWage").value),otAfter:n($("#stOtAfter").value)||40,otMult:n($("#stOtMult").value)||1.5,weekStart:+$("#stWeek").value,lunch:Math.max(0,n($("#stLunch").value)),leaveOt:$("#stLeaveOt").checked,payStart:$("#stPay").value||payStart(),taxPct:Math.min(60,Math.max(0,n($("#stTax").value)))});
  save();$("#stWorkSaved").textContent="Đã lưu";setTimeout(()=>$("#stWorkSaved").textContent="",1500);
};
// Giao diện: tối / sáng / theo Windows (đổi ngay, không cần bấm Lưu)
const darkMQ=matchMedia("(prefers-color-scheme: dark)");
function applyTheme(){const t=S().theme||"dark",h=new Date().getHours();document.documentElement.dataset.theme=t==="system"?(darkMQ.matches?"dark":"light"):t==="time"?(h>=18||h<7?"dark":"light"):t;if(typeof applyAccent==="function")applyAccent()}
darkMQ.addEventListener("change",applyTheme);
$("#stTheme").onchange=e=>{S().theme=e.target.value;applyTheme();save()};
$("#trkOpen").onclick=()=>{const t=F("tracking").value.trim();if(t)API.openUrl(trackLink(t).u);else F("tracking").focus()};
$("#openDir").onclick=()=>API.openDir();
$("#backupNow").onclick=async()=>{const p=await API.backupNow();await say("Đã tạo bản sao lưu:\n"+p)};
