'use client';
// TradingView Lightweight Charts™ — Copyright (c) 2025 TradingView, Inc.
// https://www.tradingview.com/ — Apache-2.0; visible attribution below the chart.
import { useEffect, useRef } from 'react';
import { createChart, LineSeries, AreaSeries, CandlestickSeries, ColorType, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import type { MarketTick } from './marketPulse';
import type { ChartLevel } from './SimpleLiveChart';
import { aggregateCandles } from './aggregateCandles';
export function TradingChart({ticks,precision,type,windowSeconds,indicator,levels,stale,synthetic,sourceLabel}:{ticks:MarketTick[];precision:number;type:'line'|'area'|'candles';windowSeconds:number;indicator:'SMA20'|'EMA12'|null;levels:ChartLevel[];stale:boolean;synthetic:boolean;sourceLabel:string}) {
  const host=useRef<HTMLDivElement>(null);
  const chart=useRef<IChartApi|null>(null);
  const series=useRef<ISeriesApi<'Line'|'Area'|'Candlestick'>|null>(null);
  const overlay=useRef<ISeriesApi<'Line'>|null>(null);
  const levelLines=useRef<ReturnType<ISeriesApi<'Line'>['createPriceLine']>[]>([]);
  const hasData=useRef(false);
  useEffect(()=>{
    if(!host.current) return;
    const c=createChart(host.current,{autoSize:true,height:matchMedia('(min-width:1024px)').matches?340:210,
      layout:{background:{type:ColorType.Solid,color:'transparent'},textColor:getComputedStyle(host.current).color,fontSize:11,attributionLogo:false},
      grid:{vertLines:{visible:false},horzLines:{color:'#8395a21c'}},rightPriceScale:{borderVisible:false},
      timeScale:{timeVisible:true,secondsVisible:true,borderVisible:false,rightOffset:5},
      handleScroll:{vertTouchDrag:false},handleScale:{pinch:true},crosshair:{mode:0},
    });
    chart.current=c;
    series.current= type==='candles'?c.addSeries(CandlestickSeries,{upColor:'#34d39e',downColor:'#f45d75',wickUpColor:'#34d39e',wickDownColor:'#f45d75',borderVisible:false}):type==='area'?c.addSeries(AreaSeries,{lineColor:'#34d39e',topColor:'#34d39e44',bottomColor:'#34d39e00',lineWidth:2}):c.addSeries(LineSeries,{color:'#34d39e',lineWidth:2});
    series.current.applyOptions({priceFormat:{type:'price',precision,minMove:10**-precision}});
    overlay.current=c.addSeries(LineSeries,{color:'#b69bf3',lineWidth:1,lastValueVisible:false,priceLineVisible:false});
    hasData.current=false;levelLines.current=[];
    return()=>{c.remove();chart.current=null;series.current=null;overlay.current=null;levelLines.current=[];};
  },[type,precision]);
  useEffect(()=>{
    const s=series.current,c=chart.current;if(!s||!c||!ticks.length)return;
    const color=ticks.at(-1)!.price >= (ticks.at(-2)?.price??ticks[0].price)?'#34d39e':'#f45d75';
    const rows=ticks.map(t=>({time:(t.time/1000) as UTCTimestamp,value:t.price}));
    const follow=!hasData.current||c.timeScale().scrollPosition()>=-1;
    if(type==='candles') {
      s.setData(aggregateCandles(ticks,5,synthetic).map(bar=>({...bar,time:bar.time as UTCTimestamp})));
    } else {s.setData(rows);s.applyOptions(type==='area'?{lineColor:color,topColor:color+'44',bottomColor:color+'00'}:{color});}
    if(indicator){const n=indicator==='SMA20'?20:12;let ema=0;overlay.current?.setData(rows.flatMap((r,i)=>{ema=i?ema+(r.value-ema)*2/(n+1):r.value;return i<n-1?[]:[{time:r.time,value:indicator==='EMA12'?ema:rows.slice(i-n+1,i+1).reduce((sum,p)=>sum+p.value,0)/n}];}));}else overlay.current?.setData([]);
    if(follow){const end=ticks.at(-1)!.time/1000;c.timeScale().setVisibleRange({from:(end-windowSeconds) as UTCTimestamp,to:(end+windowSeconds*.04) as UTCTimestamp});}
    hasData.current=true;
  },[ticks,type,indicator,windowSeconds,synthetic]);
  useEffect(()=>{const s=series.current;if(!s)return;for(const l of levelLines.current)s.removePriceLine(l);levelLines.current=levels.map(l=>s.createPriceLine({price:l.price,title:l.label,color:l.tone==='negative'?'#f45d75':l.tone==='positive'?'#34d39e':'#94a7b8',lineWidth:1,lineStyle:2,axisLabelVisible:true}));},[levels,type]);
  return <div className="trading-chart" data-gesture-exclude data-stale={stale} data-chart-type={type} data-window={windowSeconds}><div ref={host} className="trading-chart-canvas" aria-label="Gráfico interactivo de precios"/><p className="simple-market-source">{synthetic?'Fuente: simulación local':`Fuente: ${sourceLabel}`} · <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">Gráficos por TradingView</a></p><span className="sr-only">Último precio {ticks.at(-1)?.price.toFixed(precision)??'pendiente'}. {stale?'Datos desactualizados.':''} Las velas agrupan observaciones de cinco segundos.</span></div>;
}
