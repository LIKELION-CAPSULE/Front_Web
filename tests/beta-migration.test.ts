import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyState, report, session } from '../src/features/backend/adapters.ts'
import { connectionCacheKey, readConnectionCache, serverRecords, writeConnectionCache } from '../src/features/backend/connection-cache.ts'
import type { DemoAction } from '../src/features/demo/reducer.ts'
import { betaReducer } from '../src/features/backend/beta-reducer.ts'
import { cameraRecords, connectionSummary } from '../src/features/reports/connection-records.ts'
import { legacyBetaDestination } from '../src/features/mates/legacy-destination.ts'
import { removeAccountSnapshots } from '../src/features/auth/account-storage.ts'
import { launchMates, type AvailableMate } from '../src/features/mates/catalog.ts'

const dto = { sessionId:9001,character:{id:201,name:'채린'},startedAt:'2026-11-22T03:00:00Z',endedAt:'2026-11-22T03:30:00Z',studySeconds:1500,presentSeconds:1380,awaySeconds:120,returnCount:2,closingLine:'서버 대사' }
const actual = () => ({...report(dto,'101'),cameraFocus:{observedMs:1500000,focusedMs:1380000,returns:2}})
const mate:AvailableMate = {...launchMates[0]!,roomId:'101',characterId:'201'}
function storage() {
  const values=new Map<string,string>()
  return {values,get length(){return values.size},key:(i:number)=>[...values.keys()][i]??null,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)},removeItem:(key:string)=>{values.delete(key)}}
}

test('empty beta storage never creates sample history, balance or a running local session',()=>{
 const cached=readConnectionCache(storage(),7)
 assert.deepEqual(cached,{records:[],messages:[],latestRecordId:null})
})
test('legacy migration keeps API identities, original server metrics and camera measurements while discarding simulations',()=>{
 const store=storage(),legacy=JSON.stringify({credits:5000,pass:{name:'old'},activeSession:{id:'local'},records:[{...actual(),studySeconds:999999}, {...actual(),id:'sample',dataSource:'dummy'}],messages:[{id:'real',sessionId:'9001',characterId:'201',sender:'character',text:'실제 답장',voice:false},{id:'sample',sessionId:'local',characterId:'chaerin',sender:'character',text:'샘플'},{id:'pending',sessionId:'9001',characterId:'201',sender:'user',text:'전송 중',delivery:'pending'}]})
 store.setItem('capsule-dummy:v1:7',legacy)
 const cached=readConnectionCache(store,7)
 assert.equal(cached.records.length,1)
 assert.equal(cached.records[0]!.studySeconds,1500)
 assert.equal(cached.records[0]!.cameraFocus?.focusedMs,1380000)
 assert.deepEqual(cached.messages.map(message=>message.id),['real'])
 assert.equal(store.getItem('capsule-dummy:v1:7'),legacy,'migration must not delete the previous local data')
 assert.equal(writeConnectionCache(store,7,{...emptyState(),...cached}),true)
 const saved=JSON.parse(store.getItem(connectionCacheKey(7))!)
 for(const key of ['credits','ledger','pass','gifts','profile','activeSession','memories'])assert.equal(Object.hasOwn(saved,key),false)
})
test('an empty migrated cache never resurrects legacy history and cache reads stay scoped to one account',()=>{
 const store=storage();store.setItem('capsule-dummy:v1:7',JSON.stringify({records:[actual()]}))
 writeConnectionCache(store,7,{records:[],messages:[],latestRecordId:null})
 assert.deepEqual(readConnectionCache(store,7).records,[])
 writeConnectionCache(store,8,{records:[actual()],messages:[],latestRecordId:'9001'})
 assert.equal(readConnectionCache(store,8).records.length,1)
 assert.equal(readConnectionCache(store,7).records.length,0)
 removeAccountSnapshots(store,7)
 assert.equal(store.getItem(connectionCacheKey(7)),null)
 assert.equal(store.getItem('capsule-dummy:v1:7'),null)
 assert.ok(store.getItem(connectionCacheKey(8)))
})
test('malformed cache, mismatched report identities, invalid camera values and unavailable storage do not invent data',()=>{
 const store=storage();store.setItem(connectionCacheKey(7),JSON.stringify({version:1,userId:8,records:[actual()]}))
 assert.equal(readConnectionCache(store,7).records.length,0)
 assert.equal(serverRecords([{...actual(),id:'9002'},{...actual(),characterIds:['202']}]).length,0)
 const corruptCamera={...actual(),cameraFocus:{observedMs:10,focusedMs:50,returns:0}}
 assert.equal(serverRecords([corruptCamera])[0]?.cameraFocus,undefined)
 assert.equal(readConnectionCache({getItem:()=>{throw new Error('blocked')}},7).records.length,0)
 assert.equal(writeConnectionCache({setItem:()=>{throw new Error('blocked')}},7,{records:[],messages:[],latestRecordId:null}),false)
})
test('retired study goals are ignored in start/resume responses and never become connection limits',()=>{
 const base={room:{id:101},character:{id:201},sessionId:9001,serverTime:dto.endedAt}
 for(const targetMinutes of [undefined,0,3,180]){
  const active=session({...base,startedAt:dto.startedAt,targetMinutes},Date.parse(dto.endedAt))
  assert.equal(active.targetSeconds,undefined)
  assert.equal(session({...base,studySeconds:1500,targetMinutes},Date.parse(dto.endedAt)).studySeconds,1500)
 }
})
test('production reducer cannot purchase, start simulated sessions, send scripted replies or add schedules',()=>{
 const state=emptyState()
 const retired:DemoAction[]=[{type:'PURCHASE',productId:'x',method:'card',now:0},{type:'START',roomId:'dawn-library',characterIds:['chaerin'],tier:'basic',targetMinutes:50,camera:false,now:0},{type:'MESSAGE',characterId:'201',name:'채린',text:'test',now:0},{type:'MEMORY',memory:{id:'1',kind:'목표',title:'test',date:'',time:''}}]
 for(const action of retired)assert.equal(betaReducer(state,action),state)
})
test('production camera totals remain monotonic, bounded by connected time and scoped to the active server session',()=>{
 const active=session({sessionId:9001,room:{id:101},character:{id:201},startedAt:dto.startedAt,serverTime:dto.startedAt},0)
 const state={...emptyState(),activeSession:active}
 const next=betaReducer(state,{type:'FACE_FOCUS',sessionId:'9001',totals:{observedMs:5000,focusedMs:5000,returns:1},now:1000})
 assert.equal(next.activeSession?.focus?.observedMs,1000)
 assert.equal(next.activeSession?.focus?.focusedMs,1000)
 assert.equal(betaReducer(next,{type:'FACE_FOCUS',sessionId:'9002',totals:{observedMs:6000,focusedMs:5000,returns:1},now:2000}),next)
 assert.equal(betaReducer(next,{type:'FACE_FOCUS',sessionId:'9001',totals:{observedMs:500,focusedMs:400,returns:0},now:2000}),next)
})
test('camera graphs never substitute connected time for unknown camera time or mutate the source records',()=>{
 const known=actual(),unknown={...known,id:'9002',cameraFocus:undefined}
 const projected=cameraRecords([known,unknown])
 assert.equal(projected.length,1)
 assert.equal(projected[0]!.studySeconds,1380)
 assert.equal(known.studySeconds,1500)
 assert.equal(connectionSummary([known,unknown]).cameraSeconds,null)
 assert.equal(connectionSummary([known,unknown]).connectionSeconds,3000)
 assert.equal(connectionSummary([{...known,cameraFocus:{observedMs:0,focusedMs:0,returns:0}}]).cameraSeconds,0)
 assert.equal(connectionSummary([]).cameraSeconds,null)
})
test('legacy URLs resolve to approved mate/detail/connection records without starting a new session',()=>{
 const destination=(path:string)=>legacyBetaDestination(path,[mate],null,null,[])
 assert.equal(destination('/rooms/101/prepare'),'/mates/chaerin')
 assert.equal(destination('/rooms/dawn-library'),'/mates/chaerin')
 assert.equal(destination('/rooms/hogwarts-night-library'),'/')
 assert.equal(destination('/characters/chaerin'),'/mates/chaerin')
 assert.equal(destination('/characters/malfoy-ts'),'/mates/me')
 assert.equal(destination('/capsules/9001'),'/connections/9001')
 assert.equal(destination('/reports/demo-report'),'/records')
 assert.equal(destination('/study/9001'),'/connections/9001')
 assert.equal(legacyBetaDestination('/study/9001',[mate],null,{sessionId:9001,roomId:101,characterName:'채린'},[]),'/connect/chaerin')
})
