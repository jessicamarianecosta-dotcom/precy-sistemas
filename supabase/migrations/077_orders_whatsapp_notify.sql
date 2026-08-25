-- Rastreia os avisos de "pedido pronto" enviados pelo WhatsApp (wa.me).
-- O Precy apenas abre o WhatsApp com a mensagem pronta — não envia nada
-- automaticamente — por isso guardamos só quando o link foi aberto.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS whatsapp_notified_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_notification_count INTEGER NOT NULL DEFAULT 0;
