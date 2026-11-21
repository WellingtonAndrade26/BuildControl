import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const panel = join(here, 'painel');
const output = join(here, 'resultados');
await mkdir(output, { recursive: true });
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.woff2':'font/woff2', '.webp':'image/webp', '.json':'application/json' };
let updated = false;
const http = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const upgrade = url.pathname.startsWith('/atualizacao/');
    const base = upgrade && !updated ? root : panel;
    let name = decodeURIComponent(upgrade ? url.pathname.slice('/atualizacao/'.length) : url.pathname.slice(1));
    if (!name || name.endsWith('/')) name += 'index.html';
    const file = resolve(base, name);
    if (!file.startsWith(base + sep)) throw Error('Caminho inválido');
    // A outra rota serve a edição de conta, com a mesma API contratada pela V2.
    const contents = upgrade && updated && name === 'modo.js'
      ? 'const MODO_BUILD = "conta";' : await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control':'no-cache' });
    res.end(contents);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(ok => http.listen(0, '127.0.0.1', ok));
const address = 'http://127.0.0.1:' + http.address().port;
const report = {commit: process.env.GITHUB_SHA, lighthouse:[], telas:[], atualizacao:{}};
const flags = ['--headless','--no-sandbox','--disable-dev-shm-usage'];
const currency = new Intl.NumberFormat('pt-BR',{ style:'currency',currency:'BRL' });
const save = () => writeFile(join(output,'validacao.json'),JSON.stringify(report,null,2));
async function measure(mode) {
  const dest = join(output,'lighthouse-' + mode + '.json');
  const cli = join(here,'node_modules/lighthouse/cli/index.js');
  const args = [cli, address+'/', '--only-categories=performance,accessibility', '--output=json',
    '--output-path='+dest, '--chrome-flags='+flags.join(' '), '--quiet', '--no-enable-error-reporting'];
  if (mode === 'desktop') args.push('--preset=desktop');
  const run = await promisify(execFile)(process.execPath, args, {timeout:125000});
  if (run.stderr.trim()) console.log(run.stderr.slice(-1500));
  const lhr = JSON.parse(await readFile(dest,'utf8'));
  assert.ok(!lhr.runtimeError, JSON.stringify(lhr.runtimeError));
  assert.equal(new URL(lhr.finalDisplayedUrl).pathname, '/');
  assert.ok(lhr.audits['document-title']?.score === 1);
  const item = {perfil:mode, data:lhr.fetchTime, versao:lhr.lighthouseVersion, navegador:lhr.userAgent,
    viewport:lhr.configSettings.screenEmulation, desempenho:Math.round(lhr.categories.performance.score*100),
    acessibilidade:Math.round(lhr.categories.accessibility.score*100),
    falhasAcessibilidade:lhr.categories.accessibility.auditRefs.map(({id})=>lhr.audits[id]).filter(a=>a.score!==null && a.score<1).map(a=>a.id),
    avisos:lhr.runWarnings };
  report.lighthouse.push(item);
  console.log('LIGHTHOUSE',JSON.stringify(item));
  await save();
}
const totals = page => page.evaluate(() => ['totalMateriais','totalGuardado','faltaPagar'].map(id=>document.getElementById(id).textContent));
const controls = async page => {
  await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
  return page.evaluate(async ()=>(await navigator.serviceWorker.getRegistration()).active.scriptURL);
};
async function tapOrClick(page, selector, touch) {
  await page.waitForSelector(selector,{visible:true});
  if(touch) await page.tap(selector);
  else await page.click(selector);
}
async function fill(page, selector, value) {
  await page.$eval(selector, node => node.select());
  await page.type(selector,String(value));
}
async function addMaterial(page, open, name, qty, price, touch=false) {
  await tapOrClick(page,open,touch);
  await fill(page,'#nomeMaterial',name);
  await fill(page,'#quantidadeMaterial',qty);
  await fill(page,'#valorMaterial',price);
  await tapOrClick(page,'#btnMaterial',touch);
}
async function savings(page,open,month,value,touch=false) {
  await tapOrClick(page,open,touch);
  await page.select('#mesGuardado',month);
  await fill(page,'#valorGuardadoInput',value);
  await tapOrClick(page,'#btnGuardado',touch);
}
async function previewTests(browser) {
  for(const width of [320,390,768,1440]) {
    const profile = await browser.createBrowserContext();
    try {
      const page=await profile.newPage();
      const touch=width<=768, height=width===320?740:width===390?844:width===768?1024:950;
      await page.setViewport({width,height,hasTouch:touch,isMobile:touch,deviceScaleFactor:1});
      await page.goto(address+'/',{waitUntil:'networkidle0'});
      await page.evaluate(()=>document.fonts.ready);
      const base=await totals(page);
      assert.deepEqual(base,[19995,9350,10645].map(v=>currency.format(v)));
      assert.match(await page.$eval('meta[name=robots]',e=>e.content),/noindex/);
      if(width===390 || width===1440) await page.screenshot({path:join(output,width===390?'celular.png':'desktop.png'),fullPage:true});
      const add='#view-home [data-open-modal="material"]';
      const reserve='#view-home [data-open-modal="guardado"]';
      if(touch) await page.tap(add);
      else { await page.focus(add); await page.keyboard.press('Enter'); }
      assert.equal(await page.evaluate(()=>document.activeElement.id),'nomeMaterial');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'quantidadeMaterial');
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>!document.querySelector('#modal').open);
      assert.equal(await page.evaluate(s=>document.activeElement.matches(s),add),true);
      const longName='Tijolo cerâmico de vedação para a parede da sala integrado à cozinha gourmet — lote A';
      await addMaterial(page,add,longName,2,12.5,touch);
      await savings(page,reserve,'Janeiro',13.25,touch);
      await savings(page,reserve,'Fevereiro',21.75,touch);
      assert.deepEqual(await totals(page),[20020,9385,10635].map(v=>currency.format(v)));
      const geometry=await page.evaluate(()=>{
        const row=document.querySelector('#materiaisRecentes .row');
        const v=row.querySelector('.value').getBoundingClientRect();
        return {largura:innerWidth, documento:document.documentElement.scrollWidth, nome:row.querySelector('.item strong').textContent,
          total:row.querySelector('.value').textContent, limiteTotal:v.right,
          alturaAcao:document.querySelector('#view-home [data-open-modal]').getBoundingClientRect().height};
      });
      assert.equal(geometry.largura,width); assert.ok(geometry.documento<=width);
      assert.ok(geometry.limiteTotal<=width+1 && geometry.alturaAcao>=44);
      assert.equal(geometry.nome,longName); assert.equal(geometry.total,currency.format(25));
      const all='#view-home [data-go-view="materials"]';
      await tapOrClick(page,all,touch);
      const edit='[data-edit="material"][aria-label="Editar '+longName+'"]';
      await tapOrClick(page,edit,touch);
      await fill(page,'#quantidadeMaterial',3);
      await tapOrClick(page,'#btnMaterial',touch);
      await page.reload({waitUntil:'networkidle0'});
      assert.deepEqual(await totals(page),[20032.5,9385,10647.5].map(v=>currency.format(v)));
      report.telas.push({...geometry,toque:touch,teclado:true,recarga:true,edicao:true});
      await save();
    } finally { await profile.close(); }
  }
}
async function migration(browser) {
  const profile=await browser.createBrowserContext();
  const page=await profile.newPage();
  page.setDefaultTimeout(18000);
  await page.setViewport({width:1200,height:900});
  let cloud={materiais:[],guardados:[]};
  await page.setRequestInterception(true);
  page.on('request',async request=>{
    const url=new URL(request.url());
    if(url.origin===address || url.protocol==='data:')return request.continue();
    if(url.origin!=='https://buildcontrol-api.vercel.app')return request.abort();
    const headers={'Access-Control-Allow-Origin':address,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'};
    if(request.method()==='OPTIONS')return request.respond({status:204,headers});
    let body={};
    if(url.pathname==='/api/login')body={session:{access_token:'token-ficticio'},usuario:{id:'ensaio',email:'teste@example.invalid'}};
    else if(url.pathname==='/api/dados'){
      if(request.method()==='POST')cloud=JSON.parse(request.postData());
      body=cloud;
    }else return request.abort();
    return request.respond({status:200,headers,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto(address+'/atualizacao/login.html');
  await page.type('#emailUsuario','teste@example.invalid');
  await page.type('#senhaUsuario','exemplo-123');
  await Promise.all([page.waitForNavigation(),page.click('#btnAuth')]);
  await page.waitForFunction(()=>document.querySelector('#syncStatus')?.textContent.includes('sincronizado'));
  const oldM='.quick-card[data-open-modal="material"]',oldG='.quick-card[data-open-modal="guardado"]';
  await addMaterial(page,oldM,'Cimento CP II',30,38.9);
  await addMaterial(page,oldM,'Vergalhão CA-50',12,42.5);
  await savings(page,oldG,'Outubro',400);
  await savings(page,oldG,'Novembro',250.5);
  await page.waitForFunction(()=>document.querySelector('#syncStatus')?.textContent.includes('Salvo online'));
  await controls(page);
  const before=await totals(page);
  const records=()=>page.evaluate(()=>({materiais:JSON.parse(localStorage.buildcontrol_materiais),guardados:JSON.parse(localStorage.buildcontrol_guardados)}));
  const saved=await records(); assert.deepEqual(saved,cloud);
  assert.deepEqual(before,[1677,650.5,1026.5].map(v=>currency.format(v)));
  const same=page.url(); updated=true;
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(async()=>document.querySelector('#obraTipo') && (await caches.keys()).some(k=>k.startsWith('buildcontrol-prisma-')) && document.querySelector('#syncStatus')?.textContent==='Salvo na conta');
  await controls(page);
  assert.equal(page.url(),same); assert.deepEqual(await totals(page),before);
  assert.deepEqual(await records(),saved);
  // The previous page can show new network HTML while the new worker is still installing.
  await page.waitForFunction(async () => {
    const reg=await navigator.serviceWorker.getRegistration();
    const keys=await caches.keys();
    return reg?.active?.state==='activated' && !reg.installing && !reg.waiting &&
      keys.some(k=>k.startsWith('buildcontrol-prisma-/atualizacao/')) &&
      !keys.includes('buildcontrol-pwa-v5');
  }, {timeout:20000});
  const cacheKeys=await page.evaluate(()=>caches.keys());
  report.atualizacao={mesmoEndereco:true,antes:before,depois:await totals(page),dadosIdenticos:true,registros:saved,cache:cacheKeys,api:'simulada'};
  await save();
  await page.setOfflineMode(true);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector('#view-home .kpis');
  assert.deepEqual(await totals(page),before);
  assert.equal(await page.evaluate(()=>navigator.onLine),false);
  const offlineResponse=await page.goto(same,{waitUntil:'domcontentloaded'});
  assert.equal(offlineResponse.fromServiceWorker(),true);
  assert.deepEqual(await totals(page),before);
  report.atualizacao.offline={controlado:true,respostaDoServiceWorker:true,totais:await totals(page)};
  await save();
  await profile.close();
}
let browser;
try {
  for(const mode of ['mobile','desktop'])await measure(mode);
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,args:flags});
  await migration(browser);
  await previewTests(browser);
  console.log('VALIDACAO',JSON.stringify(report));
} catch(error) {
  report.erro=error.stack;console.error(error);process.exitCode=1;
} finally {
  await save();
  if(browser)await browser.close();
  await new Promise(ok=>http.close(ok));
}
