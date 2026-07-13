import WhatsAppIcon from './icons/WhatsAppIcon';
import { WHATSAPP_NUMBER } from '../config/constants';

export default function WhatsAppFab() {
  return (
    <a
      className="fixed bottom-5 right-5 z-40 flex size-13 items-center justify-center rounded-full bg-[#25d366] text-white shadow-[0_12px_30px_-10px_rgb(37_211_102/0.55)] transition-transform duration-300 hover:scale-105 active:scale-95"
      href={`https://wa.me/${WHATSAPP_NUMBER}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
    >
      <WhatsAppIcon size={24} />
    </a>
  );
}
