import { LegalLayout } from '@/components/legal/LegalLayout'

export const metadata = { title: 'Política de Cancelamento — Precy+', description: 'Como cancelar sua assinatura do Precy+.' }

export default function CancelamentoPage() {
  return (
    <LegalLayout title="Política de Cancelamento" subtitle="Como cancelar sua assinatura" updated="Julho de 2026">
      <div className="highlight"><p>Você pode cancelar sua assinatura do Precy+ a qualquer momento, sem burocracia e sem fidelidade.</p></div>

      <h2>1. Como cancelar</h2>
      <ul>
        <li>Pelo painel: Configurações → Conta &amp; Plano → Cancelar assinatura</li>
        <li>Ou enviando e-mail para <a href="mailto:suporte@precyplus.com.br">suporte@precyplus.com.br</a> a partir do e-mail cadastrado na conta</li>
      </ul>

      <h2>2. O que acontece ao cancelar</h2>
      <ul>
        <li>Você mantém acesso completo ao plano contratado até o fim do período já pago</li>
        <li>Não há novas cobranças depois do cancelamento</li>
        <li>Seus dados permanecem acessíveis durante o período restante e são retidos conforme a nossa <a href="/privacidade">Política de Privacidade</a></li>
        <li>É possível reativar a assinatura a qualquer momento antes dos dados serem removidos</li>
      </ul>

      <h2>3. Cancelamento durante o período de teste</h2>
      <p>Se você cancelar durante os 7 dias gratuitos do plano Basic, nenhuma cobrança é feita.</p>

      <h2>4. Reembolso</h2>
      <p>Condições de reembolso (cobrança duplicada, indisponibilidade do serviço, cancelamento nos primeiros 7 dias após a primeira cobrança) estão descritas na nossa <a href="/reembolso">Política de Reembolso</a>.</p>

      <h2>5. Exclusão de conta e dados</h2>
      <p>Cancelar a assinatura não apaga sua conta automaticamente. Para solicitar a exclusão definitiva dos seus dados, use a opção &ldquo;Solicitar exclusão da conta&rdquo; em Configurações → Privacidade, ou veja mais em nossa <a href="/privacidade">Política de Privacidade</a>.</p>

      <h2>6. Dúvidas</h2>
      <p>Fale com a gente: <a href="mailto:suporte@precyplus.com.br">suporte@precyplus.com.br</a></p>
    </LegalLayout>
  )
}
