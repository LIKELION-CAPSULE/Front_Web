/* global document, window */
import {mkdir, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright')
const origin=process.argv[2]??'http://127.0.0.1:53187'
const out=join(process.env.CX_3D_EVIDENCE_DIR??'/tmp/cx-3d-evidence','clock')
await mkdir(out,{recursive:true})
const b=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']})
try{const p=await b.newPage({viewport:{width:256,height:180}});p.on('pageerror',e=>console.error(e.message))
 for(let frame=0;frame<12;frame++){
  await p.goto(`${origin}/src/assets/connection/capsule-clock/clock-render.html?frame=${frame}`);await p.waitForFunction(()=>document.title==='ready')
  const result=await p.evaluate(()=>({image:document.querySelector('canvas').toDataURL('image/webp',.92),triangles:window.__clock.triangles,matrices:Array.from(window.__clock.root.getObjectByName('hourglass-orbs').instanceMatrix.array)}))
  if(result.triangles>6000)throw new Error(`Triangle budget exceeded: ${result.triangles}`)
  await writeFile(join(out,`frame-${String(frame).padStart(2,'0')}.webp`),Buffer.from(result.image.split(',')[1],'base64'))
  await writeFile(join(out,`frame-${frame}-matrices.json`),JSON.stringify(result.matrices))
 }
}finally{await b.close()}
