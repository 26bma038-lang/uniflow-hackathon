const {chromium} = require('C:/Users/sahil/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const server = require('node:child_process').spawn(process.execPath, ['node_modules/vite/bin/vite.js','--port','8444'], {cwd:process.cwd(),stdio:'ignore',windowsHide:true});
(async () => {
 await new Promise(r=>setTimeout(r,2500));
 const browser = await chromium.launch({headless:true, executablePath:'C:/Users/sahil/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'});
 const page = await browser.newPage();
 const errors=[]; page.on('pageerror', e => errors.push(e.message));
 await page.goto('http://127.0.0.1:8444');
 await page.locator('.campus-inbox-item').first().waitFor();
 for (const width of [390,768,1440]) {
  await page.setViewportSize({width,height:1200});
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.waitForTimeout(700);
  await page.screenshot({path:`scratch_pw/hero-${width}.png`});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),`overflow at ${width}`);
  const inbox = page.locator('#campus-inbox');
  const initial = await inbox.boundingBox();
  await inbox.getByRole('button',{name:'Deadlines',exact:true}).click();
  assert.equal(await inbox.locator('.campus-inbox-item').count(),3);
  await inbox.getByRole('button',{name:'Events',exact:true}).click();
  assert.equal(await inbox.locator('.campus-inbox-item').count(),1);
  await inbox.getByRole('button',{name:'All',exact:true}).click();
  for (const title of ['Student support scholarship','Design thinking assignment','Creative Circle recruitment','Campus open-air evening']) {
   await inbox.getByRole('button').filter({hasText:title}).click();
   assert(await inbox.getByRole('heading',{name:title}).isVisible());
   assert(await inbox.getByText('Example source',{exact:true}).isVisible());
   assert.equal((await inbox.boundingBox()).height,initial.height,'stable detail frame');
   await inbox.getByRole('button',{name:'Back to inbox'}).click();
   assert.equal(await inbox.locator('.campus-inbox-item').count(),4);
   assert((await page.evaluate(()=>document.activeElement.className)).includes('campus-inbox-item'));
  }
  await page.locator('.campus-primary').click();
  await page.waitForTimeout(700);
  assert.equal(new URL(page.url()).hash,'#campus-inbox');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'campus-inbox');
  await page.locator('.campus-secondary').click();
  await page.waitForTimeout(700);
  assert.equal(new URL(page.url()).hash,'#how-it-works');
  assert((await page.locator('#how-it-works').boundingBox()).y < 150);
  console.log(`PASS ${width}px: overflow, filters, four details, back/focus, fixed frame, both buttons`);
  if(width===390) {
   await page.getByRole('button',{name:'Open navigation',exact:true}).click();
   await page.locator('#mobile-menu').getByRole('link',{name:'Clubs'}).click();
   assert.equal(await page.locator('#mobile-menu').count(),0);
   assert.equal(new URL(page.url()).hash,'#clubs');
  }
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:8444');
 assert.equal(await page.locator('.campus-hero-copy').evaluate(e=>getComputedStyle(e).opacity),'1');
 assert.equal(await page.locator('#campus-inbox').evaluate(e=>getComputedStyle(e).opacity),'1');
 await page.locator('header').getByRole('link',{name:'Events',exact:true}).click();
 assert.equal(new URL(page.url()).pathname,'/events');
 assert(await page.getByRole('heading',{name:'Find your next campus event.'}).first().isVisible());
 assert.deepEqual(errors,[]);
 await page.goto('http://127.0.0.1:8444');
 for (const step of ['discover','register','track']) { await page.locator('#walkthrough-tab-'+step).click(); assert.equal(await page.locator('#walkthrough-tab-'+step).getAttribute('aria-selected'),'true'); }
 await page.locator('.campus-inbox-item').first().click(); await page.locator('#campus-inbox').screenshot({path:'scratch_pw/hero-detail.png'});
 console.log('PASS walkthrough tabs; mobile menu, reduced motion, events route, no browser errors');
 await browser.close(); server.kill();
})().catch(e=>{console.error(e);server.kill();process.exit(1)});
