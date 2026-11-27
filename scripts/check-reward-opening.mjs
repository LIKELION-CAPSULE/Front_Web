/* global document */
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
 else{await p.waitForFunction(()=>document.querySelector('.attendance-path-capsule img')?.src.includes('reward-opening.webp')).catch(async e=>{console.error('downloads',downloads);console.error(await p.locator('.attendance-path-capsule').evaluate(x=>x.outerHTML));throw e});await p.waitForTimeout(500);await p.screenshot({path:join(out,'attendance-opening.png')});assert.ok(downloads.some(x=>x.includes('.webp')));await p.waitForTimeout(1200);assert.equal(await p.locator('.attendance-path-capsule[data-opening]').count(),0,'opening layer cleaned up')}
 console.log(`ok reward ${reducedMotion}: lazy asset, motion policy and cleanup`);await p.close()
}}finally{await b.close()}
