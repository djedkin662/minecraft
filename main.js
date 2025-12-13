import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

const tpaRequests = new Map();
const tradeRequests = new Map();
const balances = new Map();
const lastPos = new Map();

// ==================== ECONOMY ====================
function getMoney(p){ if(!balances.has(p.name)) balances.set(p.name,1000); return balances.get(p.name);}
function addMoney(p,amt){ balances.set(p.name,getMoney(p)+amt);}
function takeMoney(p,amt){ balances.set(p.name,Math.max(0,getMoney(p)-amt));}

// ==================== SHOP ====================
function openShop(player){
  const form = new ActionFormData()
    .title("§aServer Shop")
    .body(`Balance: §e$${getMoney(player)}`)
    .button("Diamond Sword - $500")
    .button("64 Iron - $200")
    .button("Golden Apple - $100");
  form.show(player).then(res=>{
    if(res.canceled) return;
    if(res.selection===0 && getMoney(player)>=500){ takeMoney(player,500); player.runCommandAsync("give @s diamond_sword 1"); }
    if(res.selection===1 && getMoney(player)>=200){ takeMoney(player,200); player.runCommandAsync("give @s iron_ingot 64"); }
    if(res.selection===2 && getMoney(player)>=100){ takeMoney(player,100); player.runCommandAsync("give @s golden_apple 1"); }
  });
}

// ==================== TRADE ====================
function openTradeGUI(p1,p2){
  const form = new ModalFormData()
    .title(`Player Trade with ${p2.name}`)
    .textField("Item","minecraft:diamond")
    .textField("Amount","1")
    .textField("Money","0");
  form.show(p1).then(res=>{
    if(res.canceled) return;
    const [item,amt,money] = res.formValues;
    if(item) p1.runCommandAsync(`give ${p2.name} ${item} ${amt}`);
    if(Number(money)>0){ takeMoney(p1,Number(money)); addMoney(p2,Number(money)); }
  });
}

// ==================== CHAT COMMANDS ====================
world.beforeEvents.chatSend.subscribe(ev=>{
  const msg = ev.message;
  const sender = ev.sender;
  const args = msg.split(" ");

  // SHOP
  if(msg==="/shop"){ ev.cancel=true; openShop(sender); }

  // TPA
  if(args[0]==="/tpa"){ ev.cancel=true; 
    const target = [...world.getPlayers()].find(p=>p.name===args[1]);
    if(!target) return sender.sendMessage("§cPlayer not found");
    tpaRequests.set(target.name,sender.name);
    sender.sendMessage(`§aTPA sent to ${target.name}`);
    target.sendMessage(`§e${sender.name} wants to teleport to you. Type /tpaccept or /tpdeny`);
  }
  if(msg==="/tpaccept"){ ev.cancel=true; const from=tpaRequests.get(sender.name); if(!from) return; const p=[...world.getPlayers()].find(pl=>pl.name===from); if(!p) return; p.teleport(sender.location,{dimension:sender.dimension}); tpaRequests.delete(sender.name); sender.sendMessage("§aTeleport accepted"); }
  if(msg==="/tpdeny"){ ev.cancel=true; tpaRequests.delete(sender.name); sender.sendMessage("§cTeleport denied"); }

  // TRADE
  if(args[0]==="/tradereq"){ ev.cancel=true; const target=[...world.getPlayers()].find(p=>p.name===args[1]); if(!target) return sender.sendMessage("§cPlayer not found"); tradeRequests.set(target.name,sender.name); target.sendMessage(`§e${sender.name} wants to trade. Type /tradeaccept`);}
  if(msg==="/tradeaccept"){ ev.cancel=true; const from=tradeRequests.get(sender.name); if(!from) return; const p=[...world.getPlayers()].find(pl=>pl.name===from); if(!p) return; openTradeGUI(p,sender); openTradeGUI(sender,p); tradeRequests.delete(sender.name); }

  // ADMIN COMMANDS
  if(!sender.hasTag("admin")) return;
  if(args[0]==="/ban"){ ev.cancel=true; sender.runCommandAsync(`ban \"${args[1]}\" ${args.slice(2).join(" ")}`);}
  if(args[0]==="/kick"){ ev.cancel=true; sender.runCommandAsync(`kick \"${args[1]}\" ${args.slice(2).join(" ")}`);}
  if(args[0]==="/goto"){ ev.cancel=true; sender.runCommandAsync(`tp @s \"${args[1]}\"`);}
  if(args[0]==="/view"){ ev.cancel=true; sender.runCommandAsync(`spectate @s \"${args[1]}\"`);}
  if(msg==="/spectate"){ ev.cancel=true; sender.runCommandAsync("gamemode spectator");}
});

// ==================== ANTI-CHEAT ====================
system.runInterval(()=>{
  for(const p of world.getPlayers()){
    const prev=lastPos.get(p.name);
    if(prev){
      const dx=p.location.x-prev.x;
      const dz=p.location.z-prev.z;
      if(Math.sqrt(dx*dx+dz*dz)>1.3){ p.runCommandAsync(`ban \"${p.name}\" Speed hacking`);}
    }
    lastPos.set(p.name,p.location);
  }
},20);
