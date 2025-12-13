const bedrock = require("bedrock-protocol");

const client = bedrock.createClient({
  host: "5.9.152.30:3817",
  port: 19132,
  username: "Tuff Bot Guy"
});

client.on('spawn', ()=>{
  console.log("Bot joined server");
  setInterval(()=>{
    client.queue('text',{type:'chat',needs_translation:false,source_name:'bot',message:'SMP online 🔥'});
  },60000);
});
