import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, addDoc, collection, query, where,
  orderBy, onSnapshot, serverTimestamp, updateDoc, deleteDoc, getDocs,
  limit
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

const CHANNEL_URL = "https://whatsapp.com/channel/GANTI_DENGAN_LINK_SALURAN";
const ADMIN_WA = "6283176204764";
const ROLE_PRICES = {"FULL UP":30000,"RESSELER":50000,"OWNER":150000};
const $ = (id) => document.getElementById(id);
const screens = ["fingerPage","loginPage","credentialPage","purchasePage","pendingPage","chatPage","mainPage"];
let app, auth, db, storage, currentUser=null, userData=null, selectedRole="FULL UP";
let unsubs=[], chatTargetUid=null, currentChatIsAdmin=false, currentPhotoUrl=null;
let localPassword="", senderCache=[];
const firebaseConfigPromise = fetch("./firebaseconfig.json").then(r=>r.json());

function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600)}
function showScreen(id){screens.forEach(s=>$(s).classList.toggle("active",s===id));}
function modal(html){$("modalContent").innerHTML=html;$("modal").classList.remove("hidden")}
function closeModal(){$("modal").classList.add("hidden");$("modalContent").innerHTML=""}
$("modalClose").addEventListener("click",closeModal);
document.addEventListener("contextmenu",e=>{if(!e.target.closest("input,textarea"))e.preventDefault()});
document.addEventListener("dragstart",e=>e.preventDefault());

function usernameEmail(name){return `${name.trim().toLowerCase()}@alyz.local`}
function cleanName(v){return v.trim().toLowerCase()}
function money(n){return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n)}
function roleBadge(role){return role==="OWNER"?"✦":role==="RESSELER"?"🚀":role==="FULL UP"?"⌘":role==="ADMIN"?"✓":""}
function stopListeners(){unsubs.forEach(fn=>fn());unsubs=[]}
function listen(ref,cb){const off=onSnapshot(ref,cb,err=>toast("Firebase: "+err.message));unsubs.push(off);return off}
function openMainView(view){
  $("homeView").classList.toggle("hidden",view!=="home");
  ["senderView","profileView","ordersView"].forEach(id=>$(id).classList.add("hidden"));
  if(view!=="home")$(view+"View").classList.remove("hidden");
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  $("sideMenu").classList.remove("open");
}
function setMainCore(){showScreen("mainPage");openMainView("home");$("adminOrderMenu").classList.toggle("hidden",!isAdmin());}
function isAdmin(){return !!currentUser && !!userData && (userData.role==="ADMIN" || userData.isAdmin===true)}
async function loadUser(uid){
  const snap=await getDoc(doc(db,"users",uid));
  userData=snap.exists()?snap.data():null;
  if(!userData) return;
  $("profileName").textContent=userData.displayName||userData.username||"Member";
  $("profileRole").textContent=userData.role||"MEMBER";
  $("profileBadge").textContent=roleBadge(userData.role);
  $("profileImage").src=userData.photoURL||"./media/profile.png";
  $("loginAvatar").src=userData.photoURL||"./media/profile.png";
  $("adminOrderMenu").classList.toggle("hidden",!isAdmin());
  await setDoc(doc(db,"presence",uid),{online:true,lastSeen:serverTimestamp()},{merge:true});
}
async function updatePresence(online){
  if(!currentUser||!db)return;
  try{await setDoc(doc(db,"presence",currentUser.uid),{online,lastSeen:serverTimestamp()},{merge:true})}catch{}
}
window.addEventListener("beforeunload",()=>{updatePresence(false)});

async function startFirebase(){
  const cfg=await firebaseConfigPromise;
  if(!cfg.apiKey || cfg.apiKey.startsWith("ISI_") || cfg.projectId==="PROJECT_ID"){
    toast("Isi firebaseconfig.json terlebih dahulu.");
    return;
  }
  app=initializeApp(cfg);auth=getAuth(app);db=getFirestore(app);storage=getStorage(app);
  onAuthStateChanged(auth,async user=>{
    stopListeners();currentUser=user;userData=null;
    if(!user){showScreen("fingerPage");return}
    try{
      await loadUser(user.uid);
      if(!userData){toast("Profil akun belum tersedia.");showScreen("pendingPage");return}
      if(userData.status==="active"||isAdmin()) setMain();
      else {showScreen("pendingPage");$("pendingTitle").textContent="AKUN BELUM AKTIF";$("pendingMessage").textContent="Akun belum disetujui. Silakan chat admin."}
    }catch(e){toast("Gagal memuat profil: "+e.message);showScreen("pendingPage")}
  });
}

let holdTimer=null,holdStart=0,holdFrame=null,holdDone=false;
function beginFingerprint(e){
  e.preventDefault();holdDone=false;holdStart=performance.now();$("fingerButton").classList.add("pressing");$("fingerHint").textContent="Memverifikasi…";
  const tick=()=>{
    const pct=Math.min(100,Math.floor((performance.now()-holdStart)/22));
    $("fingerPercent").textContent=pct+"%";$("scanFill").style.width=pct+"%";
    if(pct>=100){holdDone=true;cancelAnimationFrame(holdFrame);$("fingerHint").textContent="Akses terverifikasi";setTimeout(()=>showScreen("loginPage"),350)}
    else holdFrame=requestAnimationFrame(tick);
  };holdFrame=requestAnimationFrame(tick);
}
function endFingerprint(){
  if(!$("fingerButton").classList.contains("pressing"))return;
  $("fingerButton").classList.remove("pressing");
  if(!holdDone){cancelAnimationFrame(holdFrame);$("fingerPercent").textContent="0%";$("scanFill").style.width="0%";$("fingerHint").textContent="Belum selesai — ulangi tekan dan tahan"}
}
$("fingerButton").addEventListener("pointerdown",beginFingerprint);
["pointerup","pointerleave","pointercancel"].forEach(ev=>$("fingerButton").addEventListener(ev,endFingerprint));

$("goLogin").onclick=()=>showScreen("credentialPage");
$("buyAccess").onclick=()=>showScreen("purchasePage");
document.querySelectorAll("[data-back]").forEach(b=>b.onclick=()=>showScreen(b.dataset.back));
document.querySelectorAll(".role-option").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".role-option").forEach(x=>x.classList.remove("selected"));
  b.classList.add("selected");selectedRole=b.dataset.role;
  $("chosenRole").textContent=`${selectedRole} · ${money(+b.dataset.price)}`;
});

$("loginSubmit").onclick=async()=>{
  const name=cleanName($("loginUsername").value),pass=$("loginPassword").value;
  if(!/^[a-z0-9_]{3,24}$/.test(name)||!pass){toast("Periksa username dan password.");return}
  try{
    // Admin credentials are checked only by the Vercel serverless function.
    const adminResponse = await fetch("/api/admin-login", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({username:name,password:pass})
    });
    if(adminResponse.ok){
      const result = await adminResponse.json();
      const { signInWithCustomToken } = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js");
      await signInWithCustomToken(auth, result.customToken);
      localPassword = pass;
      return;
    }
    if(adminResponse.status !== 401) {
      const errorBody = await adminResponse.json().catch(()=>({}));
      throw new Error(errorBody.error || "Admin login endpoint bermasalah.");
    }
    await signInWithEmailAndPassword(auth,usernameEmail(name),pass);
    localPassword=pass;
  }catch(e){toast("Login gagal: "+(e.message||"Periksa username/password."));}
};
$("purchaseSubmit").onclick=async()=>{
  const name=cleanName($("newUsername").value),pass=$("newPassword").value,repeat=$("repeatPassword").value;
  if(!/^[a-z0-9_]{3,24}$/.test(name)){toast("Username 3–24 karakter: huruf, angka, underscore.");return}
  if(pass.length<8||pass!==repeat){toast("Password minimal 8 karakter dan harus sama.");return}
  if(!auth){toast("Firebase belum dikonfigurasi.");return}
  try{
    let uid;
    if(currentUser){
      uid=currentUser.uid;
      if(name!==(userData?.username||"")){toast("Untuk upgrade, gunakan username akun yang sedang login.");return}
    }else{
      const credential=await createUserWithEmailAndPassword(auth,usernameEmail(name),pass);
      uid=credential.user.uid;localPassword=pass;
      await setDoc(doc(db,"users",uid),{username:name,displayName:name,role:"PENDING",status:"pending",createdAt:serverTimestamp(),photoURL:null});
    }
    await addDoc(collection(db,"orders"),{uid,username:name,requestedRole:selectedRole,price:ROLE_PRICES[selectedRole],status:"pending",createdAt:serverTimestamp()});
    showScreen("pendingPage");$("pendingMessage").textContent="Pengajuan akses terkirim. Hubungi admin untuk proses pembayaran dan persetujuan.";
    await loadUser(uid);
  }catch(e){toast("Pengajuan gagal: "+e.message)}
};
$("pendingBack").onclick=()=>{if(currentUser)signOut(auth);else showScreen("loginPage")};
$("chatAdminFromPending").onclick=()=>openChat(currentUser?.uid,true);

async function openChat(uid,isAdminView=false){
  if(!currentUser){toast("Silakan login terlebih dahulu.");return}
  chatTargetUid=uid;currentChatIsAdmin=isAdminView;
  $("chatTitle").textContent=isAdminView?"ADMIN ALYZ":"CHAT USER";
  $("chatStatus").textContent="Real-time";
  showScreen("chatPage");$("chatMessages").innerHTML="";
  const q=query(collection(db,"chats",uid,"messages"),orderBy("createdAt","asc"),limit(150));
  listen(q,snap=>{
    $("chatMessages").innerHTML="";
    snap.forEach(d=>{
      const m=d.data(),mine=m.senderUid===currentUser.uid;
      const node=document.createElement("div");node.className="message "+(mine?"mine":"theirs");
      if(m.deleted){node.textContent="Pesan ini telah dihapus."}
      else{
        if(m.imageUrl){const img=document.createElement("img");img.src=m.imageUrl;img.alt="Media chat";node.appendChild(img)}
        if(m.text){const t=document.createElement("div");t.textContent=m.text;node.appendChild(t)}
      }
      const time=document.createElement("time");time.textContent=m.createdAt?.toDate?m.createdAt.toDate().toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}):"";
      node.appendChild(time);
      if(mine&&!m.deleted)node.addEventListener("click",()=>modal(`<h3>Hapus pesan?</h3><p>Apakah kamu ingin menghapus pesan ini?</p><button class="primary wide" id="confirmDelete">HAPUS</button><button class="secondary wide" id="cancelDelete">TIDAK</button>`),{once:true});
      node.dataset.id=d.id;$("chatMessages").appendChild(node);
      node.addEventListener("click",async()=>{
        if(!mine||m.deleted)return;
        const yes=await confirmDeleteDialog();if(yes){await updateDoc(doc(db,"chats",uid,"messages",d.id),{deleted:true,text:""});}
      });
    });
    $("chatMessages").scrollTop=$("chatMessages").scrollHeight;
  });
}
function confirmDeleteDialog(){return new Promise(resolve=>{
  modal(`<h3>Hapus pesan?</h3><p>Apakah kamu ingin menghapus pesan ini?</p><button class="primary wide" id="confirmDelete">HAPUS</button><button class="secondary wide" id="cancelDelete">TIDAK</button>`);
  $("confirmDelete").onclick=()=>{closeModal();resolve(true)};
  $("cancelDelete").onclick=()=>{closeModal();resolve(false)};
})}
$("chatBack").onclick=()=>{stopListeners();if(userData?.status==="active"||isAdmin())setMain();else showScreen("pendingPage")};
$("chatForm").onsubmit=async e=>{
  e.preventDefault();if(!chatTargetUid)return;
  const textValue=$("chatInput").value.trim(),file=$("chatFile").files[0];
  if(!textValue&&!file)return;
  try{
    let imageUrl=null;
    if(file){
      if(!file.type.startsWith("image/")||file.size>5*1024*1024){toast("Pilih gambar maksimal 5 MB.");return}
      const path=ref(storage,`chat-media/${currentUser.uid}/${Date.now()}-${file.name}`);
      await uploadBytes(path,file);imageUrl=await getDownloadURL(path);
    }
    await addDoc(collection(db,"chats",chatTargetUid,"messages"),{senderUid:currentUser.uid,senderRole:isAdmin()?"ADMIN":"USER",text:textValue,imageUrl,createdAt:serverTimestamp(),deleted:false});
    $("chatInput").value="";$("chatFile").value="";
  }catch(err){toast("Pesan gagal dikirim: "+err.message)}
};

$("menuToggle").onclick=()=>$("sideMenu").classList.toggle("open");
$("topMore").onclick=()=>$("moreMenu").classList.toggle("hidden");
$("openProfileQuick").onclick=()=>{openMainView("profile");$("moreMenu").classList.add("hidden")};
$("logoutQuick").onclick=()=>$("logoutButton").click();
document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>openMainView(b.dataset.view));
document.querySelectorAll(".side-menu [data-action]").forEach(b=>b.onclick=async()=>{
  const action=b.dataset.action;$("sideMenu").classList.remove("open");
  if(action==="link")window.open(CHANNEL_URL,"_blank","noopener");
  if(action==="contact")window.open(`https://wa.me/${ADMIN_WA}`,"_blank","noopener");
  if(action==="sender")openMainView("sender");
  if(action==="upgrade"){showScreen("purchasePage");}
  if(action==="orders"){if(isAdmin())openMainView("orders");else toast("Khusus admin.")}
  if(action==="ai"){$("aiPanel").classList.remove("hidden")}
});
$("logoutButton").onclick=async()=>{await updatePresence(false);await signOut(auth);localPassword="";stopListeners();showScreen("fingerPage")};
$("profilePassword").value="••••••••";
$("togglePassword").onclick=()=>{$("profilePassword").type=$("profilePassword").type==="password"?"text":"password";$("profilePassword").value=$("profilePassword").type==="text"?(localPassword||"Password dikelola Firebase"):"••••••••"};

$("profileFile").onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  if(!file.type.startsWith("image/")||file.size>3*1024*1024){toast("Foto maksimal 3 MB.");return}
  try{
    const path=ref(storage,`profile/${currentUser.uid}/${Date.now()}-${file.name}`);
    await uploadBytes(path,file);const url=await getDownloadURL(path);
    await updateDoc(doc(db,"users",currentUser.uid),{photoURL:url});
    $("profileImage").src=url;$("loginAvatar").src=url;toast("Foto profil diperbarui.");
  }catch(err){toast("Upload gagal: "+err.message)}
};

$("addSender").onclick=()=>modal(`<h3>Tambah sender demo</h3><p>Masukkan nomor untuk label simulasi. Tidak ada koneksi ke WhatsApp.</p><label>Nomor<input id="senderNumber" inputmode="tel" placeholder="08xxxxxxxxxx"></label><button class="primary wide" id="senderContinue">MASUK</button>`);
document.addEventListener("click",e=>{
  if(e.target.id==="senderContinue"){
    const number=$("senderNumber").value.trim();if(number.length<8){toast("Nomor tidak valid.");return}
    const code="ALYZ-"+Math.random().toString(36).slice(2,6).toUpperCase();
    modal(`<h3>Pairing Code Demo</h3><p>Kode berikut hanya tampilan simulasi. Tidak dapat dipakai untuk menautkan WhatsApp.</p><div class="code">${code}</div><button class="secondary wide" id="refreshPair">REFRESH</button><button class="primary wide" id="finishPair">KEMBALI</button>`);
    $("refreshPair").onclick=()=>{$("modalContent").querySelector(".code").textContent="ALYZ-"+Math.random().toString(36).slice(2,6).toUpperCase()};
    $("finishPair").onclick=async()=>{
      await addDoc(collection(db,"senders"),{uid:currentUser.uid,number,mode:"simulation",status:"offline",createdAt:serverTimestamp()});
      closeModal();loadSenders();
    };
  }
});
async function loadSenders(){
  if(!db||!currentUser)return;
  listen(query(collection(db,"senders"),where("uid","==",currentUser.uid)),snap=>{
    senderCache=snap.docs.map(d=>({id:d.id,...d.data()}));
    $("senderCount").textContent=senderCache.length;
    $("senderList").innerHTML="";
    senderCache.forEach(s=>{
      const card=document.createElement("div");card.className="sender-card glass";
      const left=document.createElement("div");left.innerHTML=`<b>${escapeHtml(s.number)}</b><small>Mode simulasi · <span class="sender-status">${s.status==="online"?"ONLINE":"OFFLINE"}</span></small>`;
      const actions=document.createElement("div");actions.className="sender-actions";
      const refresh=document.createElement("button");refresh.textContent="Refresh";refresh.onclick=()=>toast("Status simulasi diperbarui.");
      const del=document.createElement("button");del.textContent="Hapus";del.onclick=async()=>{if(confirm("Hapus data sender ini?"))await deleteDoc(doc(db,"senders",s.id))};
      actions.append(refresh,del);card.append(left,actions);$("senderList").append(card);
    });
  });
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

$("demoSend").onclick=()=>{
  const number=$("demoNumber").value.trim();if(number.length<6){toast("Masukkan label nomor untuk simulasi.");return}
  let n=8;
  modal(`<h3>PRANK BUG · DEMO</h3><p>Simulasi lokal berjalan. Tidak ada pesan atau gangguan yang dikirim.</p><div class="code" id="countdown">8</div><p id="countText" style="text-align:center">Menyiapkan animasi…</p>`);
  const timer=setInterval(()=>{
    n--;$("countdown").textContent=n;
    if(n<=0){clearInterval(timer);$("countText").textContent="Simulasi selesai. Tidak ada tindakan eksternal.";const c=$("modalContent");c.insertAdjacentHTML("beforeend",'<button class="primary wide" id="demoOk">OKE</button>');$("demoOk").onclick=closeModal}
  },650);
};

$("aiOrb").addEventListener("pointerdown",e=>{
  const el=$("aiOrb"),startX=e.clientX,startY=e.clientY,rect=el.getBoundingClientRect();
  const move=ev=>{el.style.right="auto";el.style.bottom="auto";el.style.left=Math.max(5,Math.min(innerWidth-55,rect.left+ev.clientX-startX))+"px";el.style.top=Math.max(5,Math.min(innerHeight-55,rect.top+ev.clientY-startY))+"px"};
  const up=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up)};
  window.addEventListener("pointermove",move);window.addEventListener("pointerup",up,{once:true});
});
$("aiOrb").onclick=()=>{if(!$("aiPanel").classList.contains("hidden"))return;$("aiPanel").classList.remove("hidden")};
$("closeAI").onclick=()=>$("aiPanel").classList.add("hidden");
$("aiForm").onsubmit=e=>{
  e.preventDefault();const cmd=$("aiInput").value.trim().toLowerCase();if(!cmd)return;
  const log=$("aiLog");log.textContent+="\n\n> "+cmd;
  if(cmd.includes("home")){openMainView("home");log.textContent+="\nMembuka Home."}
  else if(cmd.includes("sender")){openMainView("sender");log.textContent+="\nMembuka Sender."}
  else if(cmd.includes("profil")){openMainView("profile");log.textContent+="\nMembuka Profil."}
  else if(cmd.includes("order")&&isAdmin()){openMainView("orders");log.textContent+="\nMembuka Order."}
  else{log.textContent+="\nPerintah belum dikenali. Gunakan: buka home, buka sender, buka profil."}
  $("aiInput").value="";
};

document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===b));
  $("approvalList").classList.toggle("hidden",b.dataset.tab!=="approvals");
  $("buyerList").classList.toggle("hidden",b.dataset.tab!=="buyers");
});
async function loadOrders(){
  if(!isAdmin())return;
  listen(query(collection(db,"orders"),orderBy("createdAt","desc"),limit(100)),snap=>{
    $("approvalList").innerHTML="";$("buyerList").innerHTML="";
    snap.forEach(d=>{
      const o=d.data();const card=document.createElement("div");card.className="order-card glass";
      card.innerHTML=`<h3>${escapeHtml(o.username||"User")} · ${escapeHtml(o.requestedRole||"")}</h3><p>Harga: ${money(o.price||0)}</p><p>Status: ${escapeHtml(o.status||"pending")}</p><div class="order-actions"><button class="accept">TERIMA</button><button class="reject">TOLAK</button></div>`;
      card.querySelector(".accept").onclick=()=>reviewOrder(d.id,o,true);
      card.querySelector(".reject").onclick=()=>reviewOrder(d.id,o,false);
      $("approvalList").append(card);
      const buyer=document.createElement("button");buyer.className="buyer-card glass";buyer.style.width="100%";buyer.style.textAlign="left";buyer.textContent=`${o.username||"User"} · ${o.requestedRole} · Chat user`;
      buyer.onclick=()=>openChat(o.uid,true);$("buyerList").append(buyer);
    });
  });
}
async function reviewOrder(id,o,approve){
  try{
    await updateDoc(doc(db,"orders",id),{status:approve?"approved":"rejected",reviewedAt:serverTimestamp(),reviewedBy:currentUser.uid,approvedRole:approve?o.requestedRole:null});
    if(approve){
      await updateDoc(doc(db,"users",o.uid),{role:o.requestedRole,status:"active"});
      toast("Order diterima.");
    }else toast("Order ditolak.");
  }catch(e){toast("Gagal memperbarui order: "+e.message)}
}

function setMain(){
  setMainCore();
  loadSenders();
  if(isAdmin()){
    loadOrders();
    listen(query(collection(db,"users"),limit(300)),snap=>$("userCount").textContent=snap.size);
  } else {
    $("userCount").textContent="—";
  }
  listen(query(collection(db,"presence"),where("online","==",true)),snap=>$("onlineCount").textContent=snap.size);
}
$("adminOrderMenu").onclick=()=>openMainView("orders");

startFirebase().catch(e=>toast("Firebase error: "+e.message));
