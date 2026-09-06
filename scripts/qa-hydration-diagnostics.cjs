/* Opt-in diagnostics for an isolated Chromium QA page.
 * Call before its first goto; invoke the returned async cleanup when finished.
 * Uses conditional debugger logpoints only: no page-error suppression, DOM or
 * history mutation, request interception, dependency patching, or build changes.
 * Logs structural node metadata, not account text / inputs / cookies.
 */
const { readFileSync, readdirSync } = require('node:fs');
const { join, resolve } = require('node:path');
const MARKER = 'TRADINGLAB_HYDRATION_DIAGNOSTIC ';

module.exports = async function installHydrationDiagnostics(page) {
  const directory = resolve('.next/static/chunks');
  let runtime;
  for (const filename of readdirSync(directory)) {
    if (!filename.endsWith('.js')) continue;
    const source = readFileSync(join(directory, filename), 'utf8');
    // This is the App Router's installed React runtime, not a guessed bundle hash.
    const mismatch = /function\s+([\w$]+)\(([\w$]+)\)\{var\s+[\w$]+=Error\([\w$]+\(418,/.exec(source);
    if (!mismatch) continue;
    const recover = [...source.matchAll(/([\w$]+)\(([\w$]+)\.value,\{componentStack:\2\.stack\}\)/g)]
      .find(match => source.slice(Math.max(0, match.index - 200), match.index).includes('onRecoverableError'));
    if (recover) { runtime = { filename, source, mismatch, recover }; break; }
  }
  if (!runtime) throw Error('Hydration diagnostic could not recognize the built React runtime; refusing to install a guessed breakpoint.');
  const { filename, source, mismatch, recover } = runtime;
  const cdp = await page.context().newCDPSession(page);
  const diagnostics = [];
  const log = message => {
    const value = message.text();
    if (!value.startsWith(MARKER)) return;
    try {
      const diagnostic = JSON.parse(value.slice(MARKER.length));
      diagnostics.push(diagnostic);
      console.log(MARKER + JSON.stringify(diagnostic));
    } catch { console.log(MARKER + 'Could not parse structural diagnostic'); }
  };
  const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const urlRegex = `/_next/static/chunks/${escapeRegex(filename)}(?:\\?|$)`;
  const location = offset => {
    const preceding = source.slice(0, offset);
    const lastBreak = preceding.lastIndexOf('\n');
    return { lineNumber: (preceding.match(/\n/g) || []).length, columnNumber: offset - lastBreak - 1 };
  };
  // Read-only expressions, intentionally no textContent or arbitrary props.
  const typeName = `(value)=>typeof value==='string'?value:(value?.displayName||value?.name||typeof value)`;
  const nodeShape = `(node)=>node?({nodeType:node.nodeType,name:node.nodeName,id:node.id||null,css:typeof node.className==='string'?node.className:node.className?.baseVal||null,children:Array.from(node.childNodes||[]).slice(0,8).map(child=>({nodeType:child.nodeType,name:child.nodeName,css:typeof child.className==='string'?child.className:null}))}):null`;
  const before = source.slice(Math.max(0, mismatch.index - 260), mismatch.index);
  const hydrationGlobals = /var\s+([\w$]+)=null,([\w$]+)=null,[\w$]+=!1,[\w$]+=null,[\w$]+=!1,[\w$]+=Error\([\w$]+\(519\)\);$/.exec(before);
  const fiber = mismatch[2];
  const parent = hydrationGlobals ? `${hydrationGlobals[1]}?.type` : 'undefined';
  const next = hydrationGlobals ? hydrationGlobals[2] : 'null';
  const mismatchCondition = `(()=>{try{const name=${typeName},shape=${nodeShape};const chain=[];for(let f=${fiber};f&&chain.length<16;f=f.return)chain.push({tag:f.tag,type:name(f.type),css:f.pendingProps?.className??f.memoizedProps?.className??null});console.info(${JSON.stringify(MARKER)}+JSON.stringify({phase:'mismatch',pathname:location.pathname,expected:name(${fiber}.type),css:${fiber}.pendingProps?.className??null,parent:name(${parent}),next:shape(${next}),ancestors:chain}));}catch(error){console.info(${JSON.stringify(MARKER)}+JSON.stringify({phase:'diagnostic-error',name:error?.name}));}return false})()`;
  const captured = recover[2];
  const recoverCondition = `(()=>{try{if(String(${captured}.value?.message||'').includes('418')){const name=${typeName};console.info(${JSON.stringify(MARKER)}+JSON.stringify({phase:'recovered',pathname:location.pathname,stack:${captured}.stack,expected:name(${captured}.source?.type),css:${captured}.source?.pendingProps?.className??null}));}}catch(error){console.info(${JSON.stringify(MARKER)}+JSON.stringify({phase:'diagnostic-error',name:error?.name}));}return false})()`;
  page.on('console', log);
  try {
    await cdp.send('Debugger.enable');
    // Stop at the first statement inside the mismatch function, where its
    // fiber parameter and hydration globals are in scope, before recovery.
    const mismatchBody = source.indexOf('{', mismatch.index) + 1;
    await cdp.send('Debugger.setBreakpointByUrl', { urlRegex, ...location(mismatchBody), condition: mismatchCondition });
    await cdp.send('Debugger.setBreakpointByUrl', { urlRegex, ...location(recover.index), condition: recoverCondition });
    console.log(JSON.stringify({ hydrationDiagnostics: 'installed', runtime: filename, nextNodeAvailable: Boolean(hydrationGlobals), pageErrorsRemainEnabled: true }));
  } catch (error) {
    page.off('console', log);
    await cdp.detach();
    throw error;
  }
  const cleanup = async () => { page.off('console', log); await cdp.detach(); return diagnostics; };
  cleanup.diagnostics = diagnostics;
  return cleanup;
};
