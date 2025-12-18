import {
  initStore,
  addAlt,
  removeAlt,
  listAlts,
  getAltSession
} from "./storage.js";

let cryptoKey = null;
let root;

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  kids.forEach(k => e.append(k));
  return e;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// --- placeholder client adapter ---
const ClientSession = {
  async logout() {
    console.warn("logout() placeholder");
  },
  async loginWithSession(sessionBlob) {
    console.warn("loginWithSession() placeholder", sessionBlob);
  },
  async reload() {
    location.reload();
  }
};

// --- render list of alts ---
async function renderList() {
  clear(root);
  const alts = await listAlts(cryptoKey);

  const header = el("h3", { innerText: "Alt Manager" });
  const addBtn = el("button", { innerText: "Add Alt" });
  addBtn.onclick = () => renderAdd();

  const list = el("div");
  alts.forEach(a => {
    const row = el("div", { className: "alt-row" });
    const name = el("span", { innerText: a.name });

    const use = el("button", { innerText: "Switch" });
    use.onclick = async () => {
      const session = await getAltSession(cryptoKey, a.id);
      await ClientSession.logout();
      await ClientSession.loginWithSession(session);
      await ClientSession.reload();
    };

    const del = el("button", { innerText: "Delete" });
    del.onclick = async () => {
      await removeAlt(cryptoKey, a.id);
      renderList();
    };

    row.append(name, use, del);
    list.append(row);
  });

  root.append(header, addBtn, list);
}

// --- render add new alt section ---
function renderAdd() {
  clear(root);

  const title = el("h3", { innerText: "Add Alt" });
  const addSection = el("div", { className: "add-section" });
  const name = el("input", { placeholder: "Alt name" });
  const session = el("textarea", { placeholder: "Paste session blob" });

  const save = el("button", { innerText: "Save" });
  const back = el("button", { innerText: "Back" });

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

// auto-start if mount exists
const mountNode = document.querySelector("#revenge-alt-root");
if (mountNode) startAltManager(mountNode);
