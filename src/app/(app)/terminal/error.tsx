'use client';
import Link from 'next/link';
export default function TerminalError({reset}:{reset:()=>void}) {
  return <div className="billing-page"><h1>La fuente no está disponible</h1><section><p>No pudimos cargar una cotización verificada. No mostraremos precios inventados ni abriremos operaciones sin datos válidos.</p><button className="simple-confirm" onClick={reset}>Reintentar conexión</button><Link href="/portafolio">Consultar mis ejercicios →</Link></section></div>;
}
