/* Supabase REST/Auth adapter. Session tokens stay in memory, never in the repo. */
(function(){
'use strict';
const config=window.BATTLE_SUPABASE||{};
const configured=!!(config.url&&config.publishableKey);
if(configured&&(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.url)||config.publishableKey.startsWith('sb_secret_')))throw Error('Invalid public Supabase settings');
if(configured&&config.publishableKey.startsWith('eyJ')){try{const claims=JSON.parse(atob(config.publishableKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(claims.role!=='anon')throw Error('secret');}catch{throw Error('Only a public anon or publishable key is allowed');}}
const base=(config.url||'').replace(/\/$/,'');let session=null,editor=false,refreshPromise=null;
async function request(path,options={}){const headers={apikey:config.publishableKey,...options.headers};if(options.body)headers['Content-Type']='application/json';if(session?.access_token)headers.Authorization='Bearer '+session.access_token;const response=await fetch(base+path,{...options,headers,cache:'no-store'});const body=await response.json().catch(()=>null);if(!response.ok){const error=Error('cloud_request');error.status=response.status;throw error}return body}
async function refresh(){if(!session||Date.now()<session.expires_at)return;if(!refreshPromise)refreshPromise=request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})}).then(data=>{session={...data,expires_at:Date.now()+(data.expires_in-60)*1000}}).catch(error=>{session=null;editor=false;throw error}).finally(()=>{refreshPromise=null});await refreshPromise}
async function login(email,password){const data=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});session={...data,expires_at:Date.now()+(data.expires_in-60)*1000};try{const rows=await request('/rest/v1/battle_editors?select=user_id&user_id=eq.'+encodeURIComponent(data.user.id));editor=rows.length===1;if(!editor)throw Error('not_editor')}catch(error){session=null;editor=false;throw error}return true}
async function logout(){try{if(session)await request('/auth/v1/logout',{method:'POST'})}finally{session=null;editor=false}}
async function read(){if(!configured)throw Error('not_configured');await refresh();const rows=await request('/rest/v1/battle_brackets?select=state,revision,updated_at&id=eq.'+encodeURIComponent(config.bracketId||'battle-oblivion'));if(rows.length!==1)throw Error('missing_bracket');return rows[0]}
async function save(state,revision){if(!editor)throw Error('not_editor');await refresh();const rows=await request('/rest/v1/battle_brackets?id=eq.'+encodeURIComponent(config.bracketId||'battle-oblivion')+'&revision=eq.'+encodeURIComponent(revision),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({state})});if(rows.length!==1)throw Error('conflict');return rows[0]}
window.BattleCloud={configured,login,logout,read,save,get canEdit(){return editor}};
})();
