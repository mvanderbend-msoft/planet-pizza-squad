const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const search = [process.cwd(), ...(process.env.PATH ?? '').split(path.delimiter)
  .filter(entry => path.basename(entry) === '.bin').map(entry => path.dirname(entry))];
const { chromium } = createRequire(__filename)(require.resolve('playwright', { paths: search }));

(async () => {
  const browser = await chromium.launch({ channel: process.env.SMOKE_BROWSER ?? 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const smoke = new Function(`return (${fs.readFileSync(path.join(__dirname, 'ui-smoke.cjs'), 'utf8')})`)();
    console.log(JSON.stringify(await smoke(page)));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
