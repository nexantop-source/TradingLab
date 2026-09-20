/** Disposable, sandbox-only checkout UI preview. No production database or credentials. */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const sandbox = Object.fromEntries(readFileSync('.env.wompi.sandbox.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^"|"$/g,'')]}));
if(sandbox.WOMPI_ENVIRONMENT !== 'sandbox') throw Error('Sandbox required');
const dir=mkdtempSync(join(tmpdir(),'tradinglab-checkout-preview-'));const file=join(dir,'qa.db');new DatabaseSync(file).close();
const env={...process.env,...sandbox,DATABASE_URL:`file:${file.replaceAll('\\','/')}`,DATABASE_PROVIDER:'sqlite',NODE_ENV:'development',BILLING_PROVIDER:'wompi',MARKET_DATA_PROVIDER:'yahoo',AUTH_SECRET:'ISOLATED_CHECKOUT_QA_ONLY_2026_NOT_FOR_PRODUCTION',NEXT_PUBLIC_APP_URL:'https://local-fixture.invalid',WOMPI_PRICING_MODE:'fixed_cop',WOMPI_STANDARD_MONTHLY_AMOUNT_IN_CENTS:'2396000',WOMPI_STANDARD_YEARLY_AMOUNT_IN_CENTS:'23996000',WOMPI_PREMIUM_MONTHLY_AMOUNT_IN_CENTS:'7996000',WOMPI_PREMIUM_YEARLY_AMOUNT_IN_CENTS:'79996000'};
const result=spawnSync(process.execPath,[resolve('node_modules/prisma/build/index.js'),'db','push','--skip-generate'],{env,encoding:'utf8'});if(result.status!==0)throw Error('Isolated database init failed');
const db=new PrismaClient({datasources:{db:{url:env.DATABASE_URL}}});
for(const [id,name] of [['FREE','Explore'],['STANDARD','Plus'],['PREMIUM','Pro']])await db.plan.create({data:{id,name,priceMonthlyCents:0,priceYearlyCents:0}});
await db.user.create({data:{email:'checkout-qa@example.invalid',name:'QA Checkout',passwordHash:await bcrypt.hash('Local-only-QA-2026!',10),onboardingCompleted:true,profile:{create:{theme:'light'}}}});await db.$disconnect();
console.log('Disposable checkout QA: http://localhost:3020/entrar — sandbox only');
const child=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port','3020'],{env,stdio:'inherit',windowsHide:true});
process.on('SIGINT',()=>child.kill());child.on('exit',code=>process.exit(code??0));
