interface WhatsAppMessageData {
  name: string;
  email: string;
  phone: string;
  company: string;
  fleetSize: string;
  message: string;
}

const WHATSAPP_NUMBER = "5541988633361";

export function formatWhatsAppMessage(data: WhatsAppMessageData): string {
  const now = new Date();
  const dateTime = now.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const sanitizedMessage = encodeURIComponent(
    `🚀 *Nova Solicitação de Reunião - Frota Link*\n\n` +
    `👤 *Nome:* ${data.name}\n` +
    `📧 *E-mail:* ${data.email}\n` +
    `📱 *Telefone:* ${data.phone}\n` +
    `🏢 *Empresa:* ${data.company}\n` +
    `🚗 *Tamanho da Frota:* ${data.fleetSize} veículos\n\n` +
    (data.message ? `💬 *Principal Desafio:*\n${data.message}\n\n` : '') +
    `⏰ *Solicitado em:* ${dateTime}`
  );

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${sanitizedMessage}`;
}
