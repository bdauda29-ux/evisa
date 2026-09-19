const $=id=>document.getElementById(id);
const defaults={serverUrl:'https://evisa-production.up.railway.app',portalUrl:'https://evisa.immigration.gov.ng/',username:'admin',password:'',enabled:false};
async function load(){const c={...defaults,...await chrome.storage.local.get(defaults)}; for(const k of ['serverUrl','portalUrl','username','password']) $(k).value=c[k]||''; $('enabled').checked=!!c.enabled;}
async function save(){const c={serverUrl:$('serverUrl').value.trim().replace(/\/+$/,''),portalUrl:$('portalUrl').value.trim(),username:$('username').value.trim(),password:$('password').value,enabled:$('enabled').checked}; await chrome.storage.local.set(c); $('status').textContent='Saved. Testing Railway…'; chrome.runtime.sendMessage({type:'EVISA_POPUP_TEST'},r=>{$('status').textContent=r?.ok?`Connected to Railway.\nAutomation mode: ${r.data?.automationMode||'device-extension'}`:`Connection failed: ${r?.error||chrome.runtime.lastError?.message||'Unknown error'}`;});}
$('save').onclick=save;
$('open').onclick=async()=>{const url=$('portalUrl').value.trim()||defaults.portalUrl; await chrome.tabs.create({url,active:true});};
$('poll').onclick=()=>chrome.runtime.sendMessage({type:'EVISA_POPUP_POLL'},r=>{$('status').textContent=r?.ok?(r.active?'Applicant claimed. Open/keep the eVisa tab visible.':'No queued applicant right now.'):`Worker error: ${r?.error||'Unknown error'}`;});
load();
