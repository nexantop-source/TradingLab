/* Opt-in isolated QA only. Instrument the served React runtime in memory, not
 * the build or node_modules. The original hydration throw remains unchanged. */
const { readFileSync, readdirSync } = require('node:fs');
const { resolve, join } = require('node:path');
module.exports = async function installHydrationNodeCapture(context) {
  const directory = resolve('.next/static/chunks');
  for (const filename of readdirSync(directory)) {
    if (!filename.endsWith('.js')) continue;
    const source = readFileSync(join(directory, filename), 'utf8');
    const mismatch = /function\s+([\w$]+)\(([\w$]+)\)\{var\s+[\w$]+=Error\([\w$]+\(418,/.exec(source);
    if (!mismatch) continue;
    const before = source.slice(Math.max(0, mismatch.index - 260), mismatch.index);
    const globals = /var\s+([\w$]+)=null,([\w$]+)=null,[\w$]+=!1,[\w$]+=null,[\w$]+=!1,[\w$]+=Error\([\w$]+\(519\)\);$/.exec(before);
    if (!globals) throw Error('Cannot identify React hydration globals; refusing guessed instrumentation');
    const fiber = mismatch[2];
    const injected = `try{const shape=n=>n?({type:n.nodeType,name:n.nodeName,id:n.id||null,css:typeof n.className==='string'?n.className:null,src:n.src||null,children:Array.from(n.childNodes||[]).slice(0,12).map(c=>({type:c.nodeType,name:c.nodeName,css:typeof c.className==='string'?c.className:null}))}):null;console.error('TRADINGLAB_HYDRATION_NODE',JSON.stringify({path:location.pathname,expected:typeof ${fiber}.type==='string'?${fiber}.type:'component',css:${fiber}.pendingProps?.className,next:shape(${globals[2]}),parent:shape(${globals[2]}?.parentNode),body:shape(document.body),ready:document.readyState}));}catch{};`;
    const offset = source.indexOf('{', mismatch.index) + 1;
    const diagnostic = source.slice(0, offset) + injected + source.slice(offset);
    await context.route(`**/_next/static/chunks/${filename}`, async route => {
      if (new URL(route.request().url()).origin !== 'https://127.0.0.1:3443') {
        await route.abort('blockedbyclient');
        return;
      }
      const response = await route.fetch();
      const headers = { ...response.headers() };
      delete headers['content-length'];
      await route.fulfill({ status: response.status(), headers, body: diagnostic });
    });
    return;
  }
  throw Error('No recognizable production React bundle for hydration node diagnostic');
};
