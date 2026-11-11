// @ts-nocheck — ad-hoc multi-client API integration script (run: npx tsx tests/api-integration.ts against a running server)
import { generateMine } from '../src/game/gen';
async function main(){
const B='http://localhost:3000';
const j=async(p,o={},tok)=>{const r=await fetch(B+p,{...o,headers:{'content-type':'application/json',...(tok?{authorization:'Bearer '+tok}:{})}});return {s:r.status,d:await r.json().catch(()=>({}))}};
const a=(await j('/api/player',{method:'POST',body:JSON.stringify({name:'Ayse'})})).d;
const b=(await j('/api/player',{method:'POST',body:JSON.stringify({name:'Bora'})})).d;
console.log('accounts',a.player.code,b.player.code);
console.log('unauth',(await j('/api/player')).s);
// friends
console.log('friend req',(await j('/api/friends',{method:'POST',body:JSON.stringify({code:b.player.code})},a.token)).d);
const inc=(await j('/api/friends',{},b.token)).d; console.log('incoming',inc.incoming.length);
console.log('accept',(await j('/api/friends',{method:'POST',body:JSON.stringify({acceptId:inc.incoming[0].id})},b.token)).d);
console.log('friends A',(await j('/api/friends',{},a.token)).d.friends.map(x=>x.name));
// party
const p=(await j('/api/party',{method:'POST',body:JSON.stringify({action:'create',biome:0})},a.token)).d.party;
console.log('party',p.code,p.members.length);
const p2=(await j('/api/party',{method:'POST',body:JSON.stringify({action:'join',code:p.code})},b.token)).d.party;
console.log('joined',p2.members.map(m=>m.name));
console.log('start by non-host',(await j('/api/party',{method:'POST',body:JSON.stringify({action:'start'})},b.token)).s);
console.log('start host',(await j('/api/party',{method:'POST',body:JSON.stringify({action:'start'})},a.token)).d.party.status);
const s1=await j('/api/party/sync',{method:'POST',body:JSON.stringify({partyId:p.id,x:10,z:12,f:1,a:'walk',hp:100})},a.token);
const s2=await j('/api/party/sync',{method:'POST',body:JSON.stringify({partyId:p.id,x:20,z:22,f:0,a:'mine',hp:90})},b.token);
console.log('B sees',s2.d.players.map(x=>x.name+'@'+x.x));
const s3=await j('/api/party/sync',{method:'POST',body:JSON.stringify({partyId:p.id,x:10.5,z:12,f:1,a:'walk',hp:100})},a.token);
console.log('A sees',s3.d.players.map(x=>x.name+'@'+x.x));
const tp=await j('/api/party/sync',{method:'POST',body:JSON.stringify({partyId:p.id,x:150,z:150,f:1,a:'walk',hp:100})},a.token);
console.log('teleport corrected',tp.d.corrected);
console.log('outsider sync',(await j('/api/party/sync',{method:'POST',body:JSON.stringify({partyId:p.id,x:1,z:1,f:1,a:'idle',hp:1})},(await j('/api/player',{method:'POST',body:JSON.stringify({name:'Eve'})})).d.token)).s);
// expedition
const seed=777, m=generateMine(seed,0);
const ids=m.deposits.filter(d=>d.kind==='ore').slice(0,6).map(d=>d.id);
const rep={id:'run-'+Date.now()+'-aaaa',seed,biome:0,outcome:'extracted',durationSec:240,maxDepth:260,minedIds:ids,kills:2,bossKill:false,hidden:0,discoveries:[]};
console.log('report ok',(await j('/api/expedition',{method:'POST',body:JSON.stringify(rep)},a.token)).d);
console.log('duplicate',(await j('/api/expedition',{method:'POST',body:JSON.stringify(rep)},a.token)).d.duplicate);
console.log('other player same id',(await j('/api/expedition',{method:'POST',body:JSON.stringify(rep)},b.token)).s);
console.log('forged',(await j('/api/expedition',{method:'POST',body:JSON.stringify({...rep,id:'forged-12345678',maxDepth:9999,minedIds:[99999]})},a.token)).d);
console.log('too fast',(await j('/api/expedition',{method:'POST',body:JSON.stringify({...rep,id:'fast-1234567890',durationSec:3})},a.token)).d);
// discovery first: pick a rare+ deposit in some mine
let found=null;
for(let sd=1;sd<400&&!found;sd++){const mm=generateMine(sd,1);const d=mm.deposits.find(x=>x.res==='emerald'||x.res==='diamond'||x.res==='gold');if(d)found={sd,d,mm}}
const dep=found.d;
const dr=(id,tok)=>j('/api/expedition',{method:'POST',body:JSON.stringify({id,seed:found.sd,biome:1,outcome:'extracted',durationSec:900,maxDepth:900,minedIds:[dep.id],kills:0,bossKill:false,hidden:0,discoveries:[{key:dep.res,depth:700}]})},tok);
console.log('A discovery',(await dr('disc-a-1234567890',a.token)).d);
console.log('B discovery',(await dr('disc-b-1234567890',b.token)).d);
console.log('leaderboard',(await j('/api/leaderboard')).d.rows.map(r=>r.name+':'+r.score));
console.log('global disc',(await j('/api/discoveries?scope=global')).d.rows.map(r=>r.name+':'+r.key+':'+r.isFirst));
console.log('profile',(await j('/api/profile?code='+a.player.code)).d.profile);
// cloud save
console.log('save',(await j('/api/player/save',{method:'PUT',body:JSON.stringify({save:{name:'Ayse',coins:5},revision:3})},a.token)).d);
console.log('stale save',(await j('/api/player/save',{method:'PUT',body:JSON.stringify({save:{name:'Ayse',coins:1},revision:2})},a.token)).s);
console.log('me',(await j('/api/player',{},a.token)).d.revision);
console.log('health',(await j('/api/health')).d);
}
main();
