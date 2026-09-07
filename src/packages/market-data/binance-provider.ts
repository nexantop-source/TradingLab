import type { Candle, CandleSeries, DataProvenance, Quote, Timeframe } from '@tl/types';
import { TIMEFRAME_SECONDS } from '@tl/types';
import { MarketDataError, type MarketDataProvider } from './provider';
import { SyntheticMarketDataProvider } from './synthetic-provider';
import { getSymbol, requireSymbol } from './symbols';

export const LIVE_PAIRS = ['BTCUSDT','ETHUSDT','SOLUSDT'] as const;
export const isLivePair = (symbol:string) => (LIVE_PAIRS as readonly string[]).includes(symbol);

/**
 * Par de Binance con el que se cotiza un instrumento del catalogo, o `null` si
 * Binance no lo cubre.
 *
 * El catalogo usa identificadores propios -`XRPUSD`- y Binance cotiza contra
 * Tether -`XRPUSDT`-. La traduccion vive aqui, en el unico sitio que conoce
 * ambos vocabularios, y no en quien llama.
 */
export function binancePair(symbol:string):string|null{
  if(isLivePair(symbol))return symbol;
  const meta=getSymbol(symbol);
  if(!meta||meta.assetClass!=='CRYPTO')return null;
  const pair=meta.upstreamSymbol;
  return pair&&pair.endsWith('USDT')?pair:null;
}
type Bar = [number,string,string,string,string,string,number,...unknown[]];
/** Public market data only: no exchange credentials or order endpoints. Old
 * USD demo instruments retain their exact original synthetic provider. */
export class BinanceMarketDataProvider implements MarketDataProvider {
  readonly id='binance-hybrid-v1'; readonly label='Binance Spot / simulación local';
  readonly synthetic=false; readonly declaredDelaySeconds=1;
  readonly attribution={text:'Datos cripto por Binance Spot',url:'https://www.binance.com/'};
  private demo=new SyntheticMarketDataProvider();
  private cache=new Map<string,{until:number;value:Promise<unknown>}>();
  constructor(private request:typeof fetch=fetch,private clock:()=>number=Date.now){}
  private async json(path:string,params:Record<string,string|number>,ttl=1000):Promise<unknown>{
    const key=path+'?'+new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)]));
    const now=this.clock(), prior=this.cache.get(key);if(prior&&prior.until>now)return prior.value;
    if(this.cache.size>512)for(const [k,v] of this.cache){if(v.until<=now)this.cache.delete(k);}
    if(this.cache.size>1024)this.cache.delete(this.cache.keys().next().value!);
    const value=(async()=>{try{const r=await this.request('https://data-api.binance.vision/api/v3/'+key,{cache:'no-store',signal:AbortSignal.timeout(6500),redirect:'error'});if(!r.ok)throw new Error(String(r.status));return await r.json();}catch{this.cache.delete(key);throw new MarketDataError('La fuente de mercado no está disponible. No se usarán precios inventados para este instrumento.','UPSTREAM',this.id);}})();
    this.cache.set(key,{until:now+ttl,value});return value;
  }
  private provenance(timestamp:number):DataProvenance{return {provider:'binance-spot-v1',providerLabel:'Binance Spot',sourceTimestamp:timestamp,receivedTimestamp:this.clock(),latencyMs:Math.max(0,this.clock()-timestamp),freshness:this.clock()-timestamp<10000?'REALTIME':'STALE',marketStatus:'OPEN',currency:'USDT',synthetic:false,notice:'Precio de Binance Spot en USDT. Saldo y operaciones exclusivamente virtuales; no es BTC/USD ni una conexión de ejecución.'};}
  private async bars(symbol:string,interval:string,endTime:number,limit:number,startTime?:number):Promise<Bar[]>{
    const raw=await this.json('klines',{symbol,interval,endTime,limit,...(startTime==null?{}:{startTime})},endTime<this.clock()-60000?60000:900);
    if(!Array.isArray(raw))throw new MarketDataError('Respuesta de mercado inválida.','UPSTREAM',this.id);
    const rows=raw as Bar[];
    if(rows.some((b,i)=>!Array.isArray(b)||!Number.isFinite(Number(b[5]))||Number(b[5])<0||(i>0&&b[0]<=rows[i-1][0])))throw new MarketDataError('Secuencia o volumen de mercado inválido.','UPSTREAM',this.id);
    if(rows.some(b=>!Array.isArray(b)||!Number.isSafeInteger(b[0])||!Number.isSafeInteger(b[6])||b[6]<b[0]||![1,2,3,4].every(i=>Number.isFinite(Number(b[i]))&&Number(b[i])>0)||Number(b[2])<Math.max(Number(b[1]),Number(b[4]))||Number(b[3])>Math.min(Number(b[1]),Number(b[4]))))throw new MarketDataError('No pudimos validar las velas recibidas.','UPSTREAM',this.id);
    return rows;
  }
  async getPriceAt(symbol:string,timestampMs:number){
    const pair=binancePair(symbol);
    if(!pair)return this.demo.getPriceAt(symbol,timestampMs);
    if(!Number.isFinite(timestampMs)||timestampMs>this.clock()+1000)throw new MarketDataError('Instante de mercado inválido.','UPSTREAM',this.id);
    const boundary=Math.floor(Math.min(timestampMs,this.clock())/1000)*1000;
    const minute=Math.floor((boundary-1)/60000)*60000;
    const end=Math.min(minute+59999,Math.floor(this.clock()/1000)*1000-1);
    const rows=await this.bars(pair,'1s',end,60,minute);
    const row=rows.filter(b=>b[6]<boundary).at(-1);
    if(!row||boundary-row[6]>2500)throw new MarketDataError('No hay una observación válida en el instante solicitado.','UPSTREAM',this.id);
    return {price:Number(row[4]),provenance:this.provenance(row[6]),candle:{t:row[0],o:Number(row[1]),h:Number(row[2]),l:Number(row[3]),c:Number(row[4]),v:Number(row[5])}};
  }
  async getQuote(symbol:string,at=this.clock()):Promise<Quote>{
    const pair=binancePair(symbol);
    if(!pair)return this.demo.getQuote(symbol,at);
    const [point,raw]=await Promise.all([this.getPriceAt(symbol,at),this.json('ticker/24hr',{symbol:pair},5000)]);
    const day=raw as Record<string,string>;
    if(!day||Number(day.openPrice)<=0||Number(day.highPrice)<=0||Number(day.lowPrice)<=0||Number(day.volume)<0)throw new MarketDataError('Resumen de mercado inválido.','UPSTREAM',this.id);
    if(!['openPrice','highPrice','lowPrice','volume'].every(k=>Number.isFinite(Number(day[k]))))throw new MarketDataError('Resumen de mercado inválido.','UPSTREAM',this.id);
    const spread=requireSymbol(symbol).spreadBps/20000;
    return {symbol,price:point.price,bid:point.price*(1-spread),ask:point.price*(1+spread),previousClose:Number(day.openPrice),change:point.price-Number(day.openPrice),changePercent:(point.price/Number(day.openPrice)-1)*100,dayHigh:Number(day.highPrice),dayLow:Number(day.lowPrice),volume:Number(day.volume),provenance:point.provenance};
  }
  /**
   * Cotizaciones de muchos pares en una sola llamada.
   *
   * `getQuote` pide dos cosas por instrumento -la vela de un segundo y el
   * resumen de 24 h- porque quien abre un grafico necesita el precio exacto de
   * este segundo. Una lista no: necesita el ultimo precio de cada uno. Con
   * sesenta y ocho criptomonedas en el catalogo, la via de una en una son ciento
   * treinta y seis peticiones para pintar una tabla, y la fuente empieza a
   * limitar la frecuencia justo cuando mas gente hay mirando.
   */
  async getQuotes(symbols:string[],at?:number):Promise<Quote[]>{
    const pairs=new Map<string,string>();
    for(const symbol of symbols){const pair=binancePair(symbol);if(pair)pairs.set(symbol,pair);}
    const rest=symbols.filter(s=>!pairs.has(s));
    const out:Quote[]=[];
    if(pairs.size){
      const list=[...new Set(pairs.values())];
      const quoted=JSON.stringify(list);
      try{
        const raw=await this.json('ticker/24hr',{symbols:quoted},5000);
        const rows=Array.isArray(raw)?raw as Array<Record<string,string>>:[];
        const byPair=new Map(rows.map(r=>[String(r.symbol),r]));
        const now=this.clock();
        for(const [symbol,pair] of pairs){
          const day=byPair.get(pair);
          const price=Number(day?.lastPrice);
          const open=Number(day?.openPrice);
          if(!day||!Number.isFinite(price)||price<=0||!Number.isFinite(open)||open<=0)continue;
          const spread=(getSymbol(symbol)?.spreadBps??8)/20000;
          out.push({symbol,price,bid:price*(1-spread),ask:price*(1+spread),previousClose:open,
            change:price-open,changePercent:(price/open-1)*100,
            dayHigh:Number(day.highPrice)||price,dayLow:Number(day.lowPrice)||price,
            volume:Number(day.volume)||0,provenance:this.provenance(Number(day.closeTime)||now)});
        }
      }catch{
        // El lote es una optimizacion, no la unica via: si falla se vuelve al
        // camino de siempre en lugar de dejar la lista sin criptomonedas.
        const settled=await Promise.allSettled([...pairs.keys()].map(symbol=>this.getQuote(symbol,at)));
        out.push(...settled.flatMap(r=>r.status==='fulfilled'?[r.value]:[]));
      }
    }
    const settled=await Promise.allSettled(rest.map(symbol=>this.getQuote(symbol,at)));
    return [...out,...settled.flatMap(r=>r.status==='fulfilled'?[r.value]:[])];
  }
  async getCandles(params:{symbol:string;timeframe:Timeframe;limit:number;to?:number}):Promise<CandleSeries>{
    const pair=binancePair(params.symbol);
    if(!pair)return this.demo.getCandles(params);
    const to=Math.min(params.to??this.clock(),this.clock());
    const rows=await this.bars(pair,params.timeframe,to,Math.min(1000,Math.max(1,params.limit)));
    // Do not include an unfinished OHLC bar: it may include observations
    // after a requested historical cutoff. Construct its partial data below.
    const complete=rows.filter(b=>b[6]<to);
    const candles:Candle[]=complete.map(b=>({t:b[0],o:Number(b[1]),h:Number(b[2]),l:Number(b[3]),c:Number(b[4]),v:Number(b[5])}));
    if(params.timeframe==='1m' && Math.floor(to/1000)*1000 > Math.floor(to/60000)*60000){
      const start=Math.floor(to/60000)*60000;
      const seconds=(await this.bars(params.symbol,'1s',Math.floor(to/1000)*1000-1,60,start)).filter(b=>b[0]>=start&&b[6]<to);
      if(seconds.length)candles.push({t:start,o:Number(seconds[0][1]),h:Math.max(...seconds.map(b=>Number(b[2]))),l:Math.min(...seconds.map(b=>Number(b[3]))),c:Number(seconds.at(-1)![4]),v:seconds.reduce((v,b)=>v+Number(b[5]),0)});
    }
    const ts=params.timeframe==='1m'?Math.floor(to/1000)*1000-1:complete.at(-1)?.[6]??to-TIMEFRAME_SECONDS[params.timeframe]*1000;
    return {symbol:params.symbol,timeframe:params.timeframe,candles:candles.slice(-params.limit),provenance:this.provenance(ts)};
  }
  getMarketStatus(symbol:string,at?:number){return isLivePair(symbol)?'OPEN' as const:this.demo.getMarketStatus(symbol,at);}
  search(query:string,limit?:number){return this.demo.search(query,limit);}
  getMeta(symbol:string){return this.demo.getMeta(symbol);}
  async healthCheck(){try{await this.getQuote('BTCUSDT');return {ok:true,latencyMs:0,message:'Binance Spot disponible; instrumentos USD antiguos conservan simulación.'};}catch{return {ok:false,latencyMs:0,message:'Binance no disponible; no se sustituyen los precios.'};}}
}
