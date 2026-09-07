'use client';

import { useEffect, useState } from 'react';
import { Check, Download, Share, PlusSquare, Smartphone, WifiOff, BellRing, Zap } from 'lucide-react';

/**
 * Instalación de la aplicación, en la web pública.
 *
 * Solo se muestra en móvil: en un portátil, "añade esto a tu pantalla de
 * inicio" no significa nada y ocupa el sitio de un argumento que sí importa.
 * Y solo se muestra si **no** está ya instalada, porque insistirle a quien ya
 * te hizo caso es la forma más rápida de que deje de hacértelo.
 *
 * Las instrucciones dependen del sistema real, no de un texto genérico: en
 * Android hay un diálogo nativo que se puede invocar, y en iPhone hay que
 * describir el gesto exacto de Safari porque no existe ese diálogo.
 */

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const REASONS = [
  { icon: WifiOff, title: 'Estudia sin conexión', body: 'Descarga la academia y sigue tus lecciones en el metro o sin datos.' },
  { icon: BellRing, title: 'No pierdas la constancia', body: 'Un recordatorio al día, y solo si hoy no has estudiado.' },
  { icon: Zap, title: 'Se abre como una app', body: 'Sin barra del navegador, a pantalla completa y desde tu pantalla de inicio.' },
];

export function InstallSection() {
  // Se parte de visible y es el CSS quien la reserva para el movil. Al reves
  // -decidir en JavaScript- la seccion no existiria en el HTML y apareceria de
  // golpe al hidratar, que es justo el salto que hace que una pagina parezca
  // barata. JavaScript solo la retira cuando ya esta instalada, que es lo unico
  // que el servidor no puede saber.
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)');
    const update = () =>
      setInstalled(standalone.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    update();
    standalone.addEventListener('change', update);
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', capture);
    const installedHandler = () => setInstalled(true);
    window.addEventListener('appinstalled', installedHandler);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', installedHandler);
      standalone.removeEventListener('change', update);
    };
  }, []);

  // Insistirle a quien ya te hizo caso es la forma mas rapida de que deje de
  // hacertelo.
  if (installed) return null;

  async function install() {
    if (!prompt) return;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setMessage(choice.outcome === 'accepted' ? 'Instalación solicitada al navegador.' : 'Puedes instalarla cuando quieras.');
    } catch {
      setMessage('Abre el menú de tu navegador y elige «Instalar aplicación».');
    }
    setPrompt(null);
  }

  return (
    <section className="install-section" aria-labelledby="instalar">
      <span className="install-badge">
        <Smartphone size={13} aria-hidden="true" />
        Para tu teléfono
      </span>
      <h2 id="instalar">Llévate TradingLab a tu pantalla de inicio.</h2>
      <p className="install-lede">
        Es la misma cuenta y el mismo progreso, pero instalada: se abre al instante y funciona aunque te quedes sin
        conexión.
      </p>

      <ul className="install-reasons">
        {REASONS.map(({ icon: Icon, title, body }) => (
          <li key={title}>
            <Icon size={17} aria-hidden="true" />
            <div>
              <strong>{title}</strong>
              <span>{body}</span>
            </div>
          </li>
        ))}
      </ul>

      {prompt ? (
        <button type="button" className="install-cta" onClick={install}>
          <Download size={17} aria-hidden="true" />
          Instalar TradingLab
        </button>
      ) : ios ? (
        <ol className="install-steps">
          <li>
            <span aria-hidden="true">1</span>
            <div>
              Toca <Share size={14} aria-hidden="true" /> <strong>Compartir</strong> en la barra de Safari.
            </div>
          </li>
          <li>
            <span aria-hidden="true">2</span>
            <div>
              Elige <PlusSquare size={14} aria-hidden="true" /> <strong>Añadir a pantalla de inicio</strong>.
            </div>
          </li>
          <li>
            <span aria-hidden="true">3</span>
            <div>
              Confirma con <strong>Añadir</strong>. Aparecerá junto a tus demás aplicaciones.
            </div>
          </li>
        </ol>
      ) : (
        <ol className="install-steps">
          <li>
            <span aria-hidden="true">1</span>
            <div>Abre el menú de tu navegador.</div>
          </li>
          <li>
            <span aria-hidden="true">2</span>
            <div>
              Elige <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.
            </div>
          </li>
          <li>
            <span aria-hidden="true">3</span>
            <div>Confirma. Se abrirá como una aplicación, sin barra del navegador.</div>
          </li>
        </ol>
      )}

      {message && (
        <p role="status" className="install-message">
          <Check size={14} aria-hidden="true" />
          {message}
        </p>
      )}

      <p className="install-foot">
        Ocupa unos pocos megabytes y no pide permisos al instalar. Necesitas conexión para iniciar sesión y para ver
        precios de mercado.
      </p>
    </section>
  );
}
