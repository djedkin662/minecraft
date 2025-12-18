import {
  initStore,
  addAlt,
  removeAlt,
  listAlts,
  getAltSession,
  saveStore,
  loadStore
} from "./storage.js";

let cryptoKey = null;
let root;
let altInstances = {}; // { altId: {win, interval} }

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  kids.forEach(k => e.append(k));
  return e;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// placeholder client session
const ClientSession = {
  async logout() { console.warn("logout() placeholder"); },
  async loginWithSession(sessionBlob) { console.warn("loginWithSession() placeholder", sessionBlob); },
  async reload() { location.reload(); }
};

// --- multi-instance logic ---
async function startAllAlts() {
  const alts = await listAlts(cryptoKey);
  for (const alt of alts) {
    if (altInstances[alt.id] && !altInstances[alt.id].win.closed) continue;

    const newWin = window.open("", "_blank", "width=400,height=600");
    newWin.document.write(`<h3>Loading alt: ${alt.name}</h3>`);

    const session = await getAltSession(cryptoKey, alt.id);

    // placeholder login
    // newWin.ClientSession.loginWithSession(session);

    // auto-refresh interval every 4 minutes
    const interval = setInterval(() => {
      if (!newWin.closed) newWin.location.reload();
      else clearInterval(interval);
    }, 4 * 60 * 1000); // 4 minutes

    altInstances[alt.id] = { win: newWin, interval };
  }
}

function stopAllAlts() {
  for (const obj of Object.values(altInstances)) {
    if (obj.win && !obj.win.closed) obj.win.close();
    if (obj.interval) clearInterval(obj.interval);
  }
  altInstances = {};
}

// --- render list ---
async function renderList() {
  clear(root);
  const alts = await listAlts(cryptoKey);

  const header = el("h3", { innerText: "Alt Manager" });

  // top bar buttons
  const addBtn = el("button", { innerText: "➕ Add Alt" });
  addBtn.onclick = () => renderAdd();

  const exportBtn = el("button", { innerText: "💾 Export" });
  exportBtn.onclick = async () => {
    const store = await loadStore(cryptoKey);
    const blob = new Blob([JSON.stringify(store)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "alts_backup.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBtn = el("button", { innerText: "📂 Import" });
  importBtn.onclick = async () => {
    const fileInput = el("input", { type: "file", accept: ".json" });
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        await saveStore(cryptoKey, data);
        renderList();
      } catch {
        alert("Invalid backup file");
      }
    };
    fileInput.click();
  };

  const startAllBtn = el("button", { innerText: "🚀 Start All" });
  startAllBtn.onclick = startAllAlts;

  const stopAllBtn = el("button", { innerText: "🛑 Stop All" });
  stopAllBtn.onclick = stopAllAlts;

  const topBar = el("div");
  topBar.append(addBtn, exportBtn, importBtn, startAllBtn, stopAllBtn);

  // list of alts
  const list = el("div");
  alts.forEach(a => {
    const row = el("div", { className: "alt-row" });
    const name = el("span", { innerText: a.name });

    const use = el("button", { innerText: "⚡ Switch" });
    use.onclick = async () => {
      const session = await getAltSession(cryptoKey, a.id);
      await ClientSession.logout();
      await ClientSession.loginWithSession(session);
      await ClientSession.reload();
    };

    const copyBtn = el("button", { innerText: "📋 Copy" });
    copyBtn.onclick = async () => {
      const session = await getAltSession(cryptoKey, a.id);
      navigator.clipboard.writeText(session);
      alert("Session copied!");
    };

    const del = el("button", { innerText: "❌ Delete" });
    del.onclick = async () => {
      await removeAlt(cryptoKey, a.id);
      renderList();
    };

    row.append(name, use, copyBtn, del);
    list.append(row);
  });

  root.append(header, topBar, list);
}

// --- render add ---
function renderAdd() {
  clear(root);

  const title = el("h3", { innerText: "➕ Add Alt" });
  const addSection = el("div", { className: "add-section" });

  const name = el("input", { placeholder: "Alt name" });
  const session = el("textarea", { placeholder: "Paste session blob" });

  const save = el("button", { innerText: "💾 Save" });
  const back = el("button", { innerText: "🔙 Back" });

  save.onclick = async () => {
    if (!name.value || !session.value) return alert("Fill in all fields");
    await addAlt(cryptoKey, name.value, session.value);
    renderList();
  };

  back.onclick = () => renderList();

  addSection.append(name, session, save, back);
  root.append(title, addSection);
}

// --- bootstrap ---
export async function startAltManager(mountNode) {
  root = mountNode;
  const password = prompt("Enter encryption password");
  cryptoKey = await initStore(password);
  renderList();
}

// auto-start
const mountNode = document.querySelector("#revenge-alt-root");
if (mountNode) startAltManager(mountNode);
