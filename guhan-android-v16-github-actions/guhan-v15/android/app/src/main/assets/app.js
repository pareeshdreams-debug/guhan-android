const messages=document.getElementById('messages');const stopResponse=document.getElementById('stopResponse');const input=document.getElementById('input');const form=document.getElementById('chatForm');const mic=document.getElementById('mic');const listenState=document.getElementById('listenState');const clock=document.getElementById('clock');const memoryList=document.getElementById('memoryList');const memoryCount=document.getElementById('memoryCount');const clearMemory=document.getElementById('clearMemory');const assistantBadge=document.getElementById('assistantBadge');const assistantMode=document.getElementById('assistantMode');const assistantSetup=document.getElementById('assistantSetup');const toolsBtn=document.getElementById('toolsBtn');const toolsPanel=document.getElementById('toolsPanel');const closeTools=document.getElementById('closeTools');const clearChat=document.getElementById('clearChat');const promptText=document.getElementById('promptText');
const MEMORY_KEY='guhan_memory_v1';
const actionState=document.getElementById('actionState');
const confirmPanel=document.getElementById('confirmPanel');
const confirmTitle=document.getElementById('confirmTitle');
const confirmDescription=document.getElementById('confirmDescription');
const confirmApprove=document.getElementById('confirmApprove');
const confirmCancel=document.getElementById('confirmCancel');
let pendingConfirmation=null;
let commandSequence=0;
let commandQueue=Promise.resolve();
let activeCommand=null;
let activeGoal=null;
const GOAL_MAX_STEPS=8;
function splitGoal(text){
  const normalized=String(text||'').replace(/\s+/g,' ').trim();
  if(!normalized) return [];
  const parts=normalized.split(/\s+(?:and then|then|after that|next)\s+|\s*;\s*/i).map(x=>x.trim()).filter(Boolean);
  return parts.length>1?parts.slice(0,GOAL_MAX_STEPS):[normalized];
}
function beginGoal(text,steps){
  activeGoal={id:Date.now(),text,steps,index:0,results:[]};
  setActionState(`Goal started · 0/${steps.length} steps`,'pending');
  setPipelineState('GOAL','active');
}
function updateGoal(label,kind='pending'){
  if(!activeGoal)return;
  setActionState(`${label} · ${activeGoal.index}/${activeGoal.steps.length} steps`,kind);
}
function finishGoal(success=true){
  if(!activeGoal)return;
  const total=activeGoal.steps.length;
  setActionState(success?`Goal complete · ${total}/${total} steps`:`Goal stopped · ${activeGoal.index}/${total} steps`,success?'confirmed':'cancelled');
  setPipelineState(success?'READY':'PAUSED',success?'ready':'cancelled');
  activeGoal=null;
}

const pipelineMode=document.getElementById('pipelineMode');
const GUHAN_API_KEY='guhan_api_url_v1';
const CHAT_KEY='guhan_chat_v2';
let hydratingChat=true;
let activeStreamAbort=null;
stopResponse?.addEventListener('click',()=>{if(activeStreamAbort){activeStreamAbort.abort();listenState.textContent='Response stopped.';} if(activeGoal){finishGoal(false);}});
function getApiUrl(){
  const stored=(localStorage.getItem(GUHAN_API_KEY)||'').trim();
  if(stored) return stored.replace(/\/$/,'');
  return window.GUHAN_API_URL||'';
}
function setApiUrl(url){
  const clean=String(url||'').trim().replace(/\/$/,'');
  if(!/^https:\/\//i.test(clean)) return false;
  localStorage.setItem(GUHAN_API_KEY,clean); return true;
}
function getMemory(){try{return JSON.parse(localStorage.getItem(MEMORY_KEY)||'[]')}catch{return[]}}
function saveMemory(items){localStorage.setItem(MEMORY_KEY,JSON.stringify(items.slice(-30)));renderMemory()}
function renderMemory(){const items=getMemory();if(memoryCount)memoryCount.textContent=String(items.length).padStart(2,'0');if(memoryList)memoryList.innerHTML=items.length?items.slice().reverse().map(m=>`<li>${escapeHtml(m)}</li>`).join(''):'<li class="empty">No memories stored yet.</li>'}
function remember(text){const items=getMemory();if(!items.some(x=>x.toLowerCase()===text.toLowerCase())){items.push(text);saveMemory(items)} }
function forgetAll(){localStorage.removeItem(MEMORY_KEY);renderMemory()}
function forgetMemory(text){const q=String(text||'').trim().toLowerCase();if(!q)return;const kept=getMemory().filter(x=>!x.toLowerCase().includes(q)&&!q.includes(x.toLowerCase()));saveMemory(kept)}
renderMemory();
clearMemory?.addEventListener('click',forgetAll);
function readChat(){try{const value=JSON.parse(localStorage.getItem(CHAT_KEY)||'[]');return Array.isArray(value)?value.filter(x=>x&&['user','jarvis'].includes(x.role)&&typeof x.text==='string').slice(-80):[]}catch{return[]}}
function persistChat(){if(hydratingChat)return;localStorage.setItem(CHAT_KEY,JSON.stringify([...document.querySelectorAll('#messages .msg')].map(el=>({role:el.classList.contains('user')?'user':'jarvis',text:el.querySelector('p')?.textContent||''})).filter(x=>x.text).slice(-80)))}
function clearConversation(){messages.innerHTML='<div class="msg jarvis"><span class="avatar">G</span><div><small>G.U.H.A.N.</small><p>Conversation cleared. Systems ready.</p></div></div>';localStorage.removeItem(CHAT_KEY);persistChat()}
clearChat?.addEventListener('click',clearConversation);
toolsBtn?.addEventListener('click',()=>{if(toolsPanel)toolsPanel.hidden=!toolsPanel.hidden});
closeTools?.addEventListener('click',()=>{if(toolsPanel)toolsPanel.hidden=true});
document.querySelectorAll('[data-command]').forEach(b=>b.addEventListener('click',()=>{const cmd=b.getAttribute('data-command');if(cmd){dispatchCommand(cmd,'tool',{});if(toolsPanel)toolsPanel.hidden=true}}));
setInterval(()=>{const c=document.getElementById('clock');if(c)c.textContent=new Date().toLocaleTimeString()},1000);
function setAssistantState(label,mode='ONLINE'){if(assistantMode)assistantMode.textContent=mode;if(promptText)promptText.textContent=label}
function setPipelineState(label,kind='ready'){if(pipelineMode){pipelineMode.textContent=label;pipelineMode.dataset.kind=kind}}
function beginCommand(text,source){const id=++commandSequence;activeCommand={id,text,source,startedAt:Date.now()};setPipelineState(source.toUpperCase(),'active');setActionState(`Command #${id} received · ${source}`,'pending');return id}
function endCommand(id,label='Ready'){if(!activeCommand||activeCommand.id!==id)return;activeCommand=null;setPipelineState('READY','ready');setActionState(label,'confirmed')}
function failCommand(id,label='Command failed'){if(!activeCommand||activeCommand.id!==id)return;activeCommand=null;setPipelineState('ERROR','cancelled');setActionState(label,'cancelled');setTimeout(()=>{if(!activeCommand)setPipelineState('READY','ready')},1800)}
function addMessage(role,text){const el=document.createElement('div');el.className='msg '+role;el.innerHTML=`<span class="avatar">${role==='jarvis'?'G':'U'}</span><div><small>${role==='jarvis'?'G.U.H.A.N.':'YOU'}</small><p>${escapeHtml(String(text))}</p></div>`;messages.appendChild(el);messages.scrollTop=messages.scrollHeight;persistChat();return el}
function loadChat(){const saved=readChat();if(!saved.length){hydratingChat=false;return}messages.innerHTML='';for(const item of saved)addMessage(item.role,item.text);hydratingChat=false;persistChat()}
loadChat();
function escapeHtml(s){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function formatDuration(ms){
  const total=Math.max(0,Math.round(ms/1000));
  const m=Math.floor(total/60), sec=total%60;
  return m?`${m} minute${m===1?'':'s'}${sec?` ${sec} second${sec===1?'':'s'}`:''}`:`${sec} second${sec===1?'':'s'}`;
}
function parseDuration(text){
  const m=text.match(/(?:in|for)\s+(?:(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\s*)?(?:(\d+(?:\.\d+)?)\s*(minutes?|mins?|m)\s*)?(?:(\d+(?:\.\d+)?)\s*(seconds?|secs?|s))?/i);
  if(!m)return null;
  const ms=((Number(m[1]||0)*3600)+(Number(m[3]||0)*60)+Number(m[5]||0))*1000;
  return ms>0?ms:null;
}
function calculateExpression(raw){
  let s=raw.replace(/,/g,'').replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/π/gi,'pi').trim();
  if(!/^[0-9+\-*/().%^\s]|sqrt|pi|e/i.test(s) || /[^0-9+\-*/().%^\s]|(?:^|[^a-z])(?:sqrt|pi|e)(?:[^a-z]|$)/i.test(s)) return null;
  s=s.replace(/\^/g,'**');
  if(!/^[0-9eE+\-*/().%\s*]+$/.test(s)) return null;
  try{
    const value=Function(`"use strict";return (${s})`)();
    return Number.isFinite(value)?value:null;
  }catch{return null}
}
function handleLocalTool(text){
  const t=text.trim();
  if(/^what(?:'s| is)\s+the\s+(?:current\s+)?time\??$/i.test(t)||/^time\??$/i.test(t)){
    return `The current time is ${new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit',second:'2-digit'})}.`;
  }
  if(/^what(?:'s| is)\s+(?:today'?s\s+)?date\??$/i.test(t)||/^date\??$/i.test(t)){
    return `Today is ${new Date().toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'})}.`;
  }
  const calc=t.match(/^(?:calculate|compute|solve)\s+(.+)$/i)||t.match(/^what(?:'s| is)\s+(.+?)\s*\??$/i);
  if(calc){
    const value=calculateExpression(calc[1].replace(/\?$/,''));
    if(value!==null)return `The answer is ${Number.isInteger(value)?value:value.toFixed(8).replace(/0+$/,'').replace(/\.$/,'')}.`;
  }
  if(/^(?:set\s+)?(?:a\s+)?timer\b/i.test(t)){
    const ms=parseDuration(t);
    if(ms){
      window.setTimeout(()=>{const msg=`Timer finished after ${formatDuration(ms)}.`;addMessage('jarvis',msg);speak(msg);listenState.textContent='Timer finished.';},ms);
      return `Timer set for ${formatDuration(ms)}.`;
    }
  }
  return null;
}

// Android command/action router. Consequential actions stay confirmation-gated.
const SERVICE_CATALOG={
  maps:{name:'Google Maps',web:'https://www.google.com/maps/'},
  swiggy:{name:'Swiggy',web:'https://www.swiggy.com/'},
  blinkit:{name:'Blinkit',web:'https://blinkit.com/'},
  zomato:{name:'Zomato',web:'https://www.zomato.com/'},
  gmail:{name:'Gmail',web:'https://mail.google.com/'},
  calendar:{name:'Google Calendar',web:'https://calendar.google.com/'},
  youtube:{name:'YouTube',web:'https://www.youtube.com/'},
  spotify:{name:'Spotify',web:'https://open.spotify.com/'},
  uber:{name:'Uber',web:'https://m.uber.com/'},
  ola:{name:'Ola',web:'https://www.olacabs.com/'},
  keep:{name:'Google Keep',web:'https://keep.google.com/'},
  whatsapp:{name:'WhatsApp',web:'https://web.whatsapp.com/'}
};
function openService(key){
  const svc=SERVICE_CATALOG[key];
  if(!svc)return false;
  if(window.GuhanAndroidActions?.openService) window.GuhanAndroidActions.openService(key,svc.name,svc.web);
  else if(window.GuhanAndroidActions?.web) window.GuhanAndroidActions.web(svc.web);
  return true;
}
async function serviceCommand(text){
  const t=text.trim();
  let m=t.match(/^(?:open|launch|start)\s+(.+?)$/i);
  if(m){
    const q=m[1].trim().toLowerCase().replace(/\s+/g,'');
    if(SERVICE_CATALOG[q]){openService(q);return `Opening ${SERVICE_CATALOG[q].name}.`;}
  }
  if(/\b(?:order|food|meal|restaurant|delivery)\b/i.test(t) && /\b(?:food|meal|restaurant|order|delivery)\b/i.test(t)){
    if(!(await confirmAction('open a food-ordering service','Confirm food service'))) return 'Cancelled.';
    openService('swiggy'); return 'Opening Swiggy. I will not place an order without your confirmation.';
  }
  if(/\b(?:groceries|grocery|instamart|quick delivery)\b/i.test(t)){
    if(!(await confirmAction('open a grocery-delivery service','Confirm grocery service'))) return 'Cancelled.';
    openService('blinkit'); return 'Opening Blinkit. I will not place an order without your confirmation.';
  }
  if(/\b(?:book|request|ride|cab|taxi)\b/i.test(t) && /\b(?:ride|cab|taxi|uber|ola)\b/i.test(t)){
    if(!(await confirmAction('open a ride-booking service','Confirm ride service'))) return 'Cancelled.';
    openService('uber'); return 'Opening Uber. I will not request a ride without your confirmation.';
  }
  if(/^open\s+(?:my\s+)?(?:mail|email|inbox)$/i.test(t)){openService('gmail');return 'Opening Gmail.';}
  if(/^open\s+(?:my\s+)?calendar$/i.test(t)){openService('calendar');return 'Opening Google Calendar.';}
  if(/^open\s+(?:music|spotify)$/i.test(t)){openService('spotify');return 'Opening Spotify.';}
  return null;
}

const APP_ALIASES={
  chrome:'Chrome', browser:'Chrome', gmail:'Gmail', email:'Gmail', youtube:'YouTube',
  maps:'Maps', googlemaps:'Maps', whatsapp:'WhatsApp', instagram:'Instagram',
  settings:'Settings', calculator:'Calculator', calendar:'Calendar',
  swiggy:'Swiggy', zomato:'Zomato', blinkit:'Blinkit'
};
function setActionState(text,kind=''){if(actionState){actionState.textContent=text;actionState.dataset.kind=kind;}}
function confirmAction(summary,title='Confirm action'){
  if(pendingConfirmation) return Promise.resolve(false);
  if(!confirmPanel) return Promise.resolve(false);
  confirmTitle.textContent=title;
  confirmDescription.textContent=`G.U.H.A.N. is ready to ${summary}. Nothing has been sent, purchased, called, deleted, or committed yet.`;
  confirmPanel.hidden=false;
  setActionState('Waiting for your confirmation…','pending');
  return new Promise(resolve=>{
    pendingConfirmation={resolve};
  });
}
function resolveConfirmation(ok){
  if(!pendingConfirmation)return;
  const resolve=pendingConfirmation.resolve;pendingConfirmation=null;
  if(confirmPanel)confirmPanel.hidden=true;
  setActionState(ok?'Action approved.':'Action cancelled.',''+(ok?'confirmed':'cancelled'));
  resolve(ok);
}
confirmApprove?.addEventListener('click',()=>resolveConfirmation(true));
confirmCancel?.addEventListener('click',()=>resolveConfirmation(false));
function chooseTool(text){
  const t=text.trim();
  // Natural-language tool selection: route common requests before the general AI fallback.
  let m=t.match(/^(?:find|search for|show me)\s+(?:a\s+)?(.+?)\s+(?:near me|nearby|around me)$/i);
  if(m){ GuhanAndroidActions.mapsSearch(m[1].trim()); return `Searching Maps for ${m[1].trim()} nearby.`; }
  m=t.match(/^(?:find|search for|show me)\s+(.+?)\s+(?:on|in)\s+(?:google\s+)?maps$/i);
  if(m){ GuhanAndroidActions.mapsSearch(m[1].trim()); return `Searching Maps for ${m[1].trim()}.`; }
  m=t.match(/^(?:navigate|directions|take me|route me)\s+(?:to\s+)?(.+)$/i);
  if(m){ GuhanAndroidActions.directions(m[1].replace(/[?.]$/,'').trim()); return `Opening navigation to ${m[1].replace(/[?.]$/,'').trim()}.`; }
  m=t.match(/^(?:what(?:'s| is)\s+the\s+)?weather(?:\s+(?:in|at)\s+(.+))?\??$/i);
  if(m){ const q=m[1]?`weather in ${m[1]}`:'weather today'; GuhanAndroidActions.web(`https://www.google.com/search?q=${encodeURIComponent(q)}`); return `Checking ${q}.`; }
  m=t.match(/^(?:set|create|add)\s+(?:an?\s+)?alarm\s+(?:for\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if(m){ let h=Number(m[1]), min=Number(m[2]||0), ap=(m[3]||'').toLowerCase(); if(ap==='pm'&&h<12)h+=12; if(ap==='am'&&h===12)h=0; if(h>=0&&h<24&&min<60){ return {__confirm:true,summary:`open the alarm setup for ${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`,title:'Confirm alarm',action:()=>GuhanAndroidActions.alarm(h,min,'G.U.H.A.N. alarm'),message:`Opening the alarm setup for ${m[1]}${m[2]?':'+m[2]:' '+String(min).padStart(2,'0')}${m[3]?' '+m[3].toUpperCase():''}.`}; }}
  m=t.match(/^(?:add|create|schedule)\s+(?:a\s+)?calendar\s+(?:event|appointment)\s+(?:called|named)?\s*(.+)$/i);
  if(m){ const title=m[1].trim(); const start=Date.now()+5*60*1000; return {__confirm:true,summary:`open Calendar to create “${title}”`,title:'Confirm calendar event',action:()=>GuhanAndroidActions.calendar(title,start,start+60*60*1000),message:`Opening Calendar to create “${title}”.`}; }
  m=t.match(/^(?:search|google|look up)\s+(.+)$/i);
  if(m){ const q=m[1].trim(); GuhanAndroidActions.web(`https://www.google.com/search?q=${encodeURIComponent(q)}`); return `Searching the web for ${q}.`; }
  return null;
}

async function routeCommand(text){
  const t=text.trim();
  let m=t.match(/^open\s+(wifi|bluetooth|sound|display|apps|battery)\s+settings$/i);
  if(m){
    GuhanAndroidActions.settings(m[1].toLowerCase());
    return `Opening ${m[1]} settings.`;
  }
  m=t.match(/^open\s+(.+)$/i);
  if(m){
    const raw=m[1].trim().replace(/[?.]$/,'');
    const key=raw.toLowerCase().replace(/\s+/g,'');
    if(APP_ALIASES[key]){
      GuhanAndroidActions.openAppByName(APP_ALIASES[key]);
      return `Opening ${APP_ALIASES[key]}.`;
    }
    if(/^https?:\/\//i.test(raw)||/\.[a-z]{2,}(\/|$)/i.test(raw)){
      GuhanAndroidActions.web(raw);
      return `Opening ${raw}.`;
    }
    GuhanAndroidActions.openAppByName(raw);
    return `Looking for ${raw}.`;
  }
  m=t.match(/^(?:go to|browse to|visit)\s+(.+)$/i);
  if(m){
    let url=m[1].trim();
    if(!/^https?:\/\//i.test(url)) url='https://'+url;
    GuhanAndroidActions.web(url);
    return `Opening ${url.replace(/^https?:\/\//,'')}.`;
  }
  m=t.match(/^(?:call|dial)\s+([+\d][\d\s().-]{5,})$/i);
  if(m){
    const number=m[1].trim();
    if(!(await confirmAction(`open the phone dialer for ${number}`,'Confirm phone action'))) return 'Cancelled.';
    GuhanAndroidActions.dial(number);
    return `Opening the dialer for ${number}.`;
  }
  m=t.match(/^(?:email|send an email to)\s+([^,;]+?)(?:\s+(?:about|subject)\s+(.+?))?$/i);
  if(m && m[1].includes('@')){
    const to=m[1].trim(), subject=(m[2]||'').trim();
    if(!(await confirmAction(`prepare an email to ${to}${subject?` with subject “${subject}”`:''}`,'Confirm email draft'))) return 'Cancelled.';
    GuhanAndroidActions.email(to,subject,'');
    return `Preparing an email to ${to}. I’ll leave the final send to you.`;
  }
  m=t.match(/^(?:remember|store)\s+(.+)$/i);
  if(m) return null; // handled by memory logic below
  return null;
}

async function executeAgentActions(toolResults){
  if(!Array.isArray(toolResults)) return;
  for(const tr of toolResults){
    const result=tr?.result ?? tr?.output;
    const type=result?.type;
    const payload=result?.payload||{};
    if(!type) continue;
    if(result.confirmation==='required' && !(await confirmAction(String(result.confirmationSummary||`perform ${type.replace(/_/g,' ')}`),String(result.confirmationTitle||'Confirm action')))) continue;
    try{
    switch(type){
      case 'open_app': GuhanAndroidActions.openAppByName(payload.app); break;
      case 'maps_search': GuhanAndroidActions.mapsSearch(payload.query); break;
      case 'directions': GuhanAndroidActions.directions(payload.destination); break;
      case 'web_search': GuhanAndroidActions.web(`https://www.google.com/search?q=${encodeURIComponent(payload.query)}`); break;
      case 'set_alarm': GuhanAndroidActions.alarm(Number(payload.hour),Number(payload.minute),String(payload.label||'G.U.H.A.N. alarm')); break;
      case 'calendar_event': {
        const start=Date.parse(String(payload.startIso));
        if(Number.isFinite(start)) GuhanAndroidActions.calendar(String(payload.title),start,start+Number(payload.durationMinutes||60)*60000);
        break;
      }
      case 'email_draft': GuhanAndroidActions.email(String(payload.to||''),String(payload.subject||''),String(payload.body||'')); break;
      case 'dial': GuhanAndroidActions.dial(String(payload.number||'')); break;
      case 'open_service': openService(String(payload.service||'')); break;
      case 'remember': remember(String(payload.text||'')); break;
      case 'forget_memory': forgetMemory(String(payload.text||'')); break;
    }
    }catch(err){setActionState(`Action failed: ${err?.message||'unknown error'}`,'cancelled');}
  }
}

async function streamAgent(text){
  const apiUrl=getApiUrl();
  if(!apiUrl) throw new Error('AI_ENDPOINT_NOT_CONFIGURED');
  if(activeStreamAbort) activeStreamAbort.abort();
  activeStreamAbort=new AbortController();
  if(stopResponse)stopResponse.hidden=false;
  const history=[...document.querySelectorAll('#messages .msg')].map(el=>({role:el.classList.contains('user')?'user':'assistant',content:el.querySelector('p')?.textContent||''})).filter(m=>m.content);
  const deviceContext=(()=>{try{return JSON.parse(window.GuhanAndroid?.getDeviceContext?.()||'{}')}catch{return{}}})();
  const res=await fetch(`${apiUrl}/api/stream`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:history,memory:getMemory(),client:{timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',locale:navigator.language||'en-IN',systemAssistant:!!window.GuhanAndroid?.isSystemAssistant?.(),deviceContext}}),signal:activeStreamAbort.signal});
  if(!res.ok){let data={};try{data=await res.json()}catch{};throw new Error(data.error||'Request failed')}
  if(!res.body) throw new Error('Streaming is not supported by this connection.');
  const reply=addMessage('jarvis','');
  const paragraph=reply.querySelector('p');let full='';let buffer='';
  const reader=res.body.getReader();const decoder=new TextDecoder();
  const consume=async(chunk,final=false)=>{
    buffer+=decoder.decode(chunk,{stream:!final});
    const lines=buffer.split('\n');buffer=lines.pop()||'';
    for(const line of lines){if(!line.trim())continue;let part;try{part=JSON.parse(line)}catch{continue}
      if(part.type==='text'){full+=String(part.delta||'');paragraph.textContent=full;messages.scrollTop=messages.scrollHeight}
      else if(part.type==='tool-result') await executeAgentActions([{toolName:part.toolName,result:part.result}]);
      else if(part.type==='source'&&part.source?.url){reply.dataset.source=part.source.url}
      else if(part.type==='error') throw new Error(String(part.error||'Streaming failed'));
    }
  };
  try{while(true){const {done,value}=await reader.read();if(done)break;await consume(value)}await consume(new Uint8Array(),true)}finally{reader.releaseLock();activeStreamAbort=null;if(stopResponse)stopResponse.hidden=true}
  if(!full) full='Command processed.';
  persistChat();return full;
}

async function respondCore(text,source='chat'){
  const localResult=handleLocalTool(text);
  if(localResult){addMessage('jarvis',localResult);speak(localResult);listenState.textContent='Local tool executed.';return}
  const service=await serviceCommand(text);
  if(service){addMessage('jarvis',service);speak(service);listenState.textContent='Service selected automatically.';return}
  const selected=chooseTool(text);
  if(selected){if(selected.__confirm)return selected;addMessage('jarvis',selected);speak(selected);listenState.textContent='Tool selected automatically.';return selected}
  const routed=await routeCommand(text);
  if(routed){if(routed.__confirm)return routed;addMessage('jarvis',routed);speak(routed);listenState.textContent='Android action executed.';return routed}
  const rememberMatch=text.match(/^remember(?: that)?\s+(.+)/i);
  if(rememberMatch){const fact=rememberMatch[1].trim();remember(fact);const confirmation=`Got it. I’ll remember: ${fact}`;addMessage('jarvis',confirmation);speak(confirmation);listenState.textContent='Memory updated.';return}
  const forgetMatch=text.match(/^(?:forget|delete from memory|don't remember)\s+(.+)/i);
  if(forgetMatch){const fact=forgetMatch[1].trim();forgetMemory(fact);const confirmation=`I removed matching memory for “${fact}”.`;addMessage('jarvis',confirmation);speak(confirmation);listenState.textContent='Memory updated.';return}
  try{
    listenState.textContent='G.U.H.A.N. is thinking...';
    const answer=await streamAgent(text);
    speak(answer);listenState.textContent='Response complete.';
  }catch(err){
    if(err.name==='AbortError')return;
    let message='I could not reach my AI core right now. Please try again.';
    if(err.message.includes('AI_ENDPOINT_NOT_CONFIGURED')) message='My AI core needs a secure server address. Set it with: set AI server URL https://your-server.example';
    else if(err.message.includes('AI_GATEWAY_API_KEY')) message='My AI core is online but its server key is not configured yet.';
    addMessage('jarvis',message);speak(message);
  }finally{listenState.textContent='Tap to speak'}
}

async function dispatchCommand(text,source='chat',options={}){
  const clean=String(text||'').trim(); if(!clean)return;
  const steps=options.skipGoalSplit? [clean] : splitGoal(clean);
  if(steps.length>1 && !activeGoal){
    beginGoal(clean,steps);
    let allOk=true;
    for(let i=0;i<steps.length;i++){
      if(!activeGoal) { allOk=false; break; }
      activeGoal.index=i+1;
      updateGoal(`Step ${i+1}: ${steps[i]}`,'pending');
      try{
        await dispatchCommand(steps[i],source,{addUser:i===0,skipGoalSplit:true});
        activeGoal?.results.push({step:steps[i],ok:true});
      }catch(err){
        allOk=false;
        activeGoal?.results.push({step:steps[i],ok:false,error:err?.message||'failed'});
        addMessage('jarvis',`I stopped the goal because step ${i+1} failed. I did not continue blindly.`);
        speak(`I stopped the goal because step ${i+1} failed.`);
        break;
      }
    }
    finishGoal(allOk);
    return;
  }
  const run=async()=>{
    const id=beginCommand(clean,source);
    try{
      if(options.addUser!==false) addMessage('user',clean);
      const result=await respondCore(clean,source);
      if(result && result.__confirm){
        const ok=await confirmAction(result.summary,result.title||'Confirm action');
        if(ok){setActionState('Executing approved action…','pending'); try{result.action?.();}catch(err){failCommand(id,err?.message||'Action failed');throw err;} addMessage('jarvis',result.message||'Action completed.'); speak(result.message||'Action completed.');}
        else {addMessage('jarvis','Cancelled. Nothing was committed.'); speak('Cancelled. Nothing was committed.');}
        endCommand(id,ok?'Action approved.':'Action cancelled.');
        return result;
      }
      endCommand(id,'Ready');
      return result;
    }catch(err){
      failCommand(id,err?.message||'Command failed');
      throw err;
    }
  };
  const next=commandQueue.then(run,run);
  commandQueue=next.catch(()=>{});
  return next;
}

form.addEventListener('submit',e=>{e.preventDefault();const v=input.value.trim();if(!v)return;input.value='';dispatchCommand(v,'chat')});
let recognition=null;if('SpeechRecognition' in window||'webkitSpeechRecognition' in window){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;recognition=new SR();recognition.lang='en-IN';recognition.interimResults=false;recognition.continuous=false;recognition.onstart=()=>{try{window.GuhanAndroid?.startVoiceSession?.()}catch{};mic.classList.add('active');listenState.textContent='Listening...';if(assistantBadge)assistantBadge.textContent='LISTENING';setAssistantState('Listening...','VOICE ACTIVE')};recognition.onend=()=>{try{window.GuhanAndroid?.stopVoiceSession?.()}catch{};mic.classList.remove('active');if(assistantBadge&&assistantBadge.textContent==='LISTENING')assistantBadge.textContent='READY';setAssistantState('Hey G.U.H.A.N., what do you need?','ONLINE');listenState.textContent='Tap to speak'};recognition.onerror=()=>{mic.classList.remove('active');if(assistantBadge)assistantBadge.textContent='VOICE READY';setAssistantState('Voice input unavailable. Type instead.','ONLINE');listenState.textContent='Tap to speak'};recognition.onresult=e=>{const text=e.results[0][0].transcript;input.value=text;dispatchCommand(text,'voice');input.value=''}}else{listenState.textContent='Voice input is not supported in this browser.'}
mic.addEventListener('click',()=>{try{window.GuhanAndroid?.startVoiceSession?.()}catch{};if(!recognition){GuhanAndroidActions.voice();return}try{recognition.start()}catch{try{recognition.stop()}catch{}}});
assistantSetup?.addEventListener('click',()=>{if(window.GuhanAndroid?.openAssistantSettings) window.GuhanAndroid.openAssistantSettings(); else listenState.textContent='Assistant settings are available on the Android app.'});

// Android bridge: safe, user-visible actions.
window.guhanVoiceResult = function(text) {
  if (input) input.value = text;
  dispatchCommand(text,'voice');
  if (input) input.value='';
};
window.guhanAssistantInvoked = function(){
  try{window.GuhanAndroid?.startVoiceSession?.()}catch{}
  if(assistantBadge)assistantBadge.textContent='ASSISTANT ACTIVE';
  setAssistantState('Awaiting your command.','SYSTEM ASSISTANT');
  listenState.textContent='Listening...';
  if(!activeCommand) addMessage('jarvis','G.U.H.A.N. is online. Awaiting your command.');
  speak('G.U.H.A.N. is online. Awaiting your command.');
  setTimeout(()=>{ if(window.GuhanAndroid?.voiceInput) window.GuhanAndroid.voiceInput(); },180);
};
window.guhanSpeak = function(text) {
  if ('speechSynthesis' in window) { speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); speechSynthesis.speak(u); }
};
window.GuhanAndroidActions = {
  openApp: (pkg) => window.GuhanAndroid?.openApp(pkg),
  openAppByName: (name) => window.GuhanAndroid?.openAppByName(name),
  web: (url) => window.GuhanAndroid?.openWeb(url),
  dial: (number) => window.GuhanAndroid?.openDialer(number),
  mapsSearch: (query) => window.GuhanAndroid?.mapSearch(query),
  directions: (destination) => window.GuhanAndroid?.mapDirections(destination),
  calendar: (title,start,end) => window.GuhanAndroid?.createCalendarEvent(title,start,end),
  alarm: (hour, minute, message) => window.GuhanAndroid?.setAlarm(hour, minute, message),
  settings: (page) => window.GuhanAndroid?.openSettings(page),
  email: (to, subject, body) => window.GuhanAndroid?.composeEmail(to || '', subject || '', body || ''),
  voice: () => window.GuhanAndroid?.voiceInput(),
  assistantSettings: () => window.GuhanAndroid?.openAssistantSettings(),
  systemAssistant: () => !!window.GuhanAndroid?.isSystemAssistant()
};

// V4 optional Accessibility automation. Android requires the user to enable it manually.
window.GuhanAndroidActions.openAutomationSettings = () => window.GuhanAndroid?.openAccessibilitySettings();
window.GuhanAndroidActions.automationEnabled = () => !!window.GuhanAndroid?.isAutomationEnabled();
window.GuhanAndroidActions.clickText = (text) => !!window.GuhanAndroid?.clickVisibleText(text);
window.GuhanAndroidActions.back = () => !!window.GuhanAndroid?.globalBack();
window.GuhanAndroidActions.home = () => !!window.GuhanAndroid?.globalHome();
window.GuhanAndroidActions.recents = () => !!window.GuhanAndroid?.globalRecents();

function refreshAssistantState(){
  if(!window.GuhanAndroid?.isSystemAssistant) return;
  try{
    const active=!!window.GuhanAndroid.isSystemAssistant();
    if(assistantBadge)assistantBadge.textContent=active?'SYSTEM ASSISTANT':'LOCAL MODE';
    setAssistantState(active?'System assistant ready.':'Hey G.U.H.A.N., what do you need?',active?'SYSTEM ASSISTANT':'ONLINE');
  }catch{}
}
setTimeout(refreshAssistantState,300);

const _guhanOldRouteCommand = routeCommand;
routeCommand = function(text) {
  const t=text.trim();
  const apiSet=t.match(/^set\s+(?:the\s+)?AI\s+server\s+URL\s+(https:\/\/\S+)$/i);
  if(apiSet){ return setApiUrl(apiSet[1]) ? 'AI core server saved on this device.' : 'Please provide an HTTPS server URL.'; }
  if(/^AI\s+server\s+status$/i.test(t)){ const u=getApiUrl(); return u ? `AI core server is configured at ${u}.` : 'AI core server is not configured yet.'; }
  if (/^(?:open|show|change) (?:default )?(?:assistant|voice assistant) settings$/i.test(t)) {
    GuhanAndroidActions.assistantSettings();
    return 'Opening Android assistant settings.';
  }
  if (/^(?:what is my|show) device context$/i.test(t)) {
    try { const c=JSON.parse(window.GuhanAndroid?.getDeviceContext?.()||'{}'); return `Battery ${c.batteryPercent ?? 'unknown'}%${c.charging?' and charging':''}. Network ${c.networkAvailable?'available':'unavailable'}. Timezone ${c.timezone||'unknown'}.`; } catch { return 'Device context is unavailable.'; }
  }
  if (/^(?:goal|task) status$/i.test(t)) {
    if(!activeGoal) return 'No multi-step goal is currently running.';
    return `Goal in progress: step ${activeGoal.index} of ${activeGoal.steps.length}. Current step: ${activeGoal.steps[activeGoal.index-1]||'starting'}.`;
  }
  if (/^cancel (?:the )?(?:goal|task)$/i.test(t)) {
    if(!activeGoal) return 'There is no active goal to cancel.';
    finishGoal(false); return 'Goal cancelled. No further steps will run.';
  }
  if (/^assistant status$/i.test(t)) {
    return GuhanAndroidActions.systemAssistant() ? 'G.U.H.A.N. is selected as the system assistant.' : 'G.U.H.A.N. is not selected as the system assistant yet.';
  }
  if (/^(?:enable|set up|setup|turn on) (?:guhan )?(?:automation|accessibility)$/i.test(t)) {
    GuhanAndroidActions.openAutomationSettings();
    return 'Opening Android Accessibility settings. Enable G.U.H.A.N. Automation there if you want cross-app UI actions.';
  }
  if (/^(?:automation|accessibility) status$/i.test(t)) {
    return GuhanAndroidActions.automationEnabled() ? 'G.U.H.A.N. Automation is enabled.' : 'G.U.H.A.N. Automation is not enabled. Say “enable automation” to open the required Android setting.';
  }
  let m = t.match(/^(?:find|search for|show me) (.+?) (?:on|in) (?:google )?maps$/i);
  if (m) {
    GuhanAndroidActions.mapsSearch(m[1].trim());
    return `Searching Maps for ${m[1].trim()}.`;
  }
  m = t.match(/^(?:take me|navigate|directions?) (?:to )?(.+)$/i);
  if (m) {
    GuhanAndroidActions.directions(m[1].trim());
    return `Opening navigation to ${m[1].trim()}.`;
  }
  m = t.match(/^set (?:an )?alarm for (\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?:\s+(.+))?$/i);
  if (m) {
    let hour=Number(m[1]), minute=Number(m[2]||0); const ap=(m[3]||'').toLowerCase();
    if(ap==='pm' && hour<12) hour+=12; if(ap==='am' && hour===12) hour=0;
    if(hour>23 || minute>59) return 'That is not a valid alarm time.';
    return {__confirm:true,summary:`open the alarm setup for ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`,title:'Confirm alarm',action:()=>GuhanAndroidActions.alarm(hour,minute,m[4]||'G.U.H.A.N. alarm'),message:`Opening the alarm setup for ${m[1]}${m[2]?':'+m[2]:''}${m[3]||''}.`};
  }
  if (/^(?:go )?back$/i.test(t)) {
    if (!GuhanAndroidActions.automationEnabled()) return 'Automation is not enabled. Say “enable automation” first.';
    return GuhanAndroidActions.back() ? 'Going back.' : 'I could not go back.';
  }
  if (/^(?:go )?home$/i.test(t)) {
    if (!GuhanAndroidActions.automationEnabled()) return 'Automation is not enabled. Say “enable automation” first.';
    return GuhanAndroidActions.home() ? 'Going home.' : 'I could not go home.';
  }
  if (/^show recent apps$/i.test(t)) {
    if (!GuhanAndroidActions.automationEnabled()) return 'Automation is not enabled. Say “enable automation” first.';
    return GuhanAndroidActions.recents() ? 'Showing recent apps.' : 'I could not open recent apps.';
  }
  const click=t.match(/^(?:click|tap|press) (?:the )?(.+)$/i);
  if (click) {
    const label=click[1].trim().replace(/[?.]$/,'');
    if (!GuhanAndroidActions.automationEnabled()) return 'Automation is not enabled. Say “enable automation” first.';
    if (/\b(?:buy|order|pay|checkout|purchase|delete|remove|send|confirm|place order)\b/i.test(label)) {
      return 'I won’t automatically activate purchase, payment, deletion, or send/confirm controls. Those actions need an explicit user confirmation step.';
    }
    if (!confirmAction(`tap “${label}” in the currently visible app`)) return 'Cancelled.';
    return GuhanAndroidActions.clickText(label) ? `Tapped “${label}”.` : `I couldn't find a visible “${label}” control.`;
  }
  return _guhanOldRouteCommand(text);
};
