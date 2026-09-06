'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react';
export function HomeNews({ free }: { free: boolean }) {
  const items = [
    { title:'Tu próxima idea empieza aquí.', text:'Monto, dirección y control de riesgo. Tu plataforma de práctica, a un toque.', href:'/terminal', cta:'Abrir plataforma', tone:'mint', tag:'PLATAFORMA DEMO' },
    ...(free ? [{ title:'Dale más espacio a tu práctica.', text:'Plus amplía tus simulaciones, indicadores y análisis. Consulta qué incluye antes de decidir.', href:'/precios', cta:'Descubrir Plus', tone:'violet', tag:'PROMOCIÓN DE TRADINGLAB' }] : []),
    { title:'Entiende antes de actuar.', text:'Retoma una lección y aplícala en tu siguiente ejercicio.', href:'/academia', cta:'Continuar aprendiendo', tone:'blue', tag:'TU ACADEMIA' },
  ];
  const [index,setIndex] = useState(0);
  const item = items[Math.min(index,items.length-1)];
  return <section className="home-news" aria-label="Novedades de TradingLab" aria-roledescription="carrusel"><Link className="home-news-card" data-tone={item.tone} href={item.href}><small>{item.tag}</small><h2>{item.title}</h2><p>{item.text}</p><span>{item.cta}<ArrowUpRight size={18}/></span></Link><div className="home-news-controls"><button aria-label="Novedad anterior" onClick={()=>setIndex((index-1+items.length)%items.length)}><ChevronLeft size={18}/></button><span aria-live="polite">{index+1} / {items.length}</span><button aria-label="Siguiente novedad" onClick={()=>setIndex((index+1)%items.length)}><ChevronRight size={18}/></button></div></section>;
}
