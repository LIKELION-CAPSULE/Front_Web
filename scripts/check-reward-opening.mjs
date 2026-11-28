/* global document, getComputedStyle */
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright')
const origin=process.argv[2]??'http://127.0.0.1:53187'
const out=join(process.env.CX_3D_EVIDENCE_DIR??'/tmp/cx-3d-evidence','reward-check')
await mkdir(out,{recursive:true})
const b=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']})
try{for(const reducedMotion of ['no-preference','reduce']){
 const p=await b.newPage({viewport:{width:900,height:700},reducedMotion})
 p.on('pageerror',e=>console.error(e.message))
 const downloads=[];p.on('request',r=>{if(/reward-opening\.(ts|webp)/.test(r.url()))downloads.push(r.url())})
 await p.goto(`${origin}/scripts/fixtures/attendance-preview.html`);await p.waitForTimeout(300)
 assert.equal(downloads.length,0,'no sequence before the check-in')
 await p.getByRole('button',{name:'7일차 출석 받기'}).click()
 if(reducedMotion==='reduce'){await p.waitForTimeout(500);assert.equal(downloads.length,0,'reduced motion skips the module and image')}
 else{
  await p.waitForSelector('.attendance-path-capsule[data-opening]')
  await p.waitForTimeout(1800)
  assert.ok((await p.locator('.attendance-path-capsule img').getAttribute('src')).includes('reward-capsule.webp'),'original cutout during opening')
  await p.screenshot({path:join(out,'attendance-opening.png')})
 }
 await p.waitForFunction(()=>{
  const capsule=document.querySelector('.attendance-path-capsule')
  return document.querySelector('.attendance-path[data-complete]')&&!capsule.hasAttribute('data-opening')&&getComputedStyle(capsule).display==='none'
 })
 assert.equal(downloads.length,0,'retired 3D sequence is never requested')
 console.log(`ok reward ${reducedMotion}: original art, motion policy and cleanup`);await p.close()
}}finally{await b.close()}
