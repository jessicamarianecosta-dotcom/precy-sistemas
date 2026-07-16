import { LegalLayout } from '@/components/legal/LegalLayout'

export const metadata = { title: 'Suporte — Precy+', description: 'Canais de suporte e atendimento do Precy+.' }

export default function SuportePage() {
  return (
    <LegalLayout title="Central de Suporte" subtitle="Estamos aqui para ajudar" updated="Julho de 2026">
      <div className="highlight"><p>Ficou com alguma dúvida, encontrou um problema ou quer sugerir uma melhoria? Fale com a gente.</p></div>

      <h2>1. Canais de atendimento</h2>
      <ul>
        <li>E-mail: <a href="mailto:suporte@precyplus.com.br">suporte@precyplus.com.br</a></li>
        <li>Assinantes do Plano PRO têm suporte prioritário via WhatsApp (número enviado por e-mail após a assinatura)</li>
      </ul>

      <h2>2. Tempo de resposta</h2>
      <ul>
        <li>Plano Basic: até 2 dias úteis</li>
        <li>Plano PRO: prioridade, normalmente em até algumas horas em dias úteis</li>
      </ul>

      <h2>3. Antes de entrar em contato</h2>
      <p>Para agilizar o atendimento, inclua sempre que possível:</p>
      <ul>
        <li>O e-mail cadastrado na sua conta</li>
        <li>Uma descrição do que você esperava que acontecesse e o que aconteceu de fato</li>
        <li>Prints de tela, se for um problema visual ou uma mensagem de erro</li>
      </ul>

      <h2>4. Outros assuntos</h2>
      <ul>
        <li>Dúvidas sobre cobrança: <a href="mailto:financeiro@precyplus.com.br">financeiro@precyplus.com.br</a></li>
        <li>Cancelamento de assinatura: veja nossa <a href="/cancelamento">Política de Cancelamento</a></li>
        <li>Dados pessoais e LGPD: veja nossa <a href="/privacidade">Política de Privacidade</a></li>
      </ul>
    </LegalLayout>
  )
}
