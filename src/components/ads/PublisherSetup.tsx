import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, CircleDashed } from 'lucide-react';
import { validGooglePublisherId, GOOGLE_SLOT_IDS } from './google-config';

export function PublisherSetup() {
  const publisher = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT;
  const enabled = process.env.NEXT_PUBLIC_GOOGLE_ADS_ENABLED === 'true';
  const slots = Object.values(GOOGLE_SLOT_IDS).filter(Boolean).length;
  const steps = [
    { label: 'Cuenta AdSense creada', detail: 'nexantop@gmail.com · Colombia · 5 de septiembre de 2026', done: true },
    { label: 'Identificador configurado', detail: validGooglePublisherId(publisher) ? publisher : 'Configurar ca-pub-5136116898669374 en el despliegue.', done: validGooglePublisherId(publisher) },
    { label: 'Dominio propio aprobado', detail: 'Pendiente en Google. La URL temporal hosted.app fue rechazada como dominio restringido.', done: false },
    { label: 'Perfil de pagos', detail: 'Completar los datos reales del beneficiario en AdSense.', done: false },
    { label: 'Unidades publicitarias', detail: `${slots} IDs configurados. Crear unidades manuales para los espacios disponibles.`, done: slots > 0 },
    { label: 'Publicación de anuncios', detail: enabled ? 'Flag habilitado; la aprobación y la entrega se verifican en Google.' : 'Desactivada hasta completar aprobación, consentimiento y configuración.', done: enabled },
  ];
  return <section className="invest-panel"><div className="invest-panel-heading"><div><span className="invest-eyebrow">MONETIZACIÓN DEL PLAN GRATUITO</span><h2 className="mt-2">Google AdSense</h2></div><Link href="https://adsense.google.com/" target="_blank" rel="noopener noreferrer">Abrir AdSense <ArrowUpRight size={16}/></Link></div><div className="publisher-setup-grid">{steps.map(s=><div key={s.label}>{s.done ? <CheckCircle2 size={19} className="invest-positive"/> : <CircleDashed size={19}/>}<div><strong>{s.label}</strong><p>{s.detail}</p></div></div>)}</div><p className="invest-detail-note">Este panel muestra configuración local y el estado registrado del alta; no consulta el estado de aprobación en tiempo real. Explore admite anuncios identificados. Plus y Pro no cargan publicidad.</p></section>;
}
