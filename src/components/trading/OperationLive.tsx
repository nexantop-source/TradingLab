'use client';
import { useEffect,useState } from 'react';
import type { OpenPositionDto } from '@/lib/simulation-service';
export function OperationLive({position,price,stale,serverTime}:{position:OpenPositionDto;price:number;stale:boolean;serverTime:number}) {
  const [now,setNow]=useState<number|null>(null);
  useEffect(()=>{const received=performance.now();setNow(serverTime);const timer=setInterval(()=>setNow(serverTime+performance.now()-received),1000);return()=>clearInterval(timer);},[serverTime]);
  const seconds=position.expiresAt&&now!=null?Math.max(0,Math.ceil((Date.parse(position.expiresAt)-now)/1000)):null;
  const pnl=Math.round((price-position.entryPrice)*position.quantity*100*(position.direction==='BEARISH'?-1:1));
  return <article className="operation-live"><header><span>{position.direction==='BEARISH'?'Bajar':'Subir'} · {position.symbol}</span><span>{seconds==null?(position.expiresAt?'Actualizando tiempo…':'Sin vencimiento'):seconds===0?'Validando cierre…':`${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')} restantes`}</span></header><strong className={seconds===0?'':pnl<0?'simple-negative':'simple-positive'}>{seconds===0?'Resultado pendiente':`${pnl>=0?'+':''}USD ${(pnl/100).toLocaleString('es-CO',{minimumFractionDigits:2,maximumFractionDigits:2})}`}</strong><small>{seconds===0?'El servidor calcula el precio del vencimiento.':stale?'Último resultado estimado · conexión pendiente':'Resultado virtual no realizado · estimación antes de comisiones de cierre'}</small></article>;
}
