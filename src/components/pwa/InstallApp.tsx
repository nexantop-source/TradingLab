'use client';

import { useEffect, useState } from 'react';
import { Download, Share, PlusSquare, Check } from 'lucide-react';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)');
    const update = () => setInstalled(standalone.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    update();
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', update);
    standalone.addEventListener('change', update);
    return () => { window.removeEventListener('beforeinstallprompt', capture); window.removeEventListener('appinstalled', update); standalone.removeEventListener('change', update); };
  }, []);
  async function install() {
    if (!prompt) return;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setMessage(choice.outcome === 'accepted' ? 'Instalación solicitada al navegador.' : 'Puedes instalarla cuando quieras.');
    } catch { setMessage('Abre el menú del navegador para instalar TradingLab.'); }
    setPrompt(null);
  }
  if (installed) return <p className="pwa-installed"><Check size={15} />Estás usando TradingLab como app</p>;
  return (
    <div className="pwa-install">
      {prompt ? <button type="button" onClick={install}><Download size={17} />Instalar TradingLab</button> :
        <details><summary><Download size={17} />Llevar TradingLab a mi pantalla de inicio</summary>
          <div className="pwa-install-instructions">{ios ? <><p>Abre esta página en Safari.</p><p><Share size={15} />Toca Compartir → <PlusSquare size={15} />Añadir a pantalla de inicio. Si aparece, activa «Abrir como app web».</p></> : <p>En el menú de tu navegador busca «Instalar aplicación» o «Añadir a pantalla de inicio». La opción depende del navegador y del dispositivo.</p>}<p>Necesitas conexión para iniciar sesión, consultar datos y usar la cuenta DEMO.</p></div>
        </details>}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
