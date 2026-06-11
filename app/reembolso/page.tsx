import { LegalLayout } from '@/components/legal/LegalLayout'

export const metadata = { title: 'Política de Reembolso — Precy+', description: 'Condições de cancelamento e reembolso do Precy+.' }

export default function ReembolsoPage() {
  return (
    <LegalLayout title="Política de Reembolso" subtitle="Cancelamento e cobranças" updated="Junho de 2026">
      <div className="highlight"><p>Queremos que você esteja satisfeita com o Precy+. Se algo não estiver certo, entre em contato antes de solicitar reembolso — resolveremos.</p></div>

      <h2>1. Período de teste</h2>
      <p>O plano Basic inclui <strong>7 dias gratuitos</strong> sem necessidade de cartão de crédito. Use esse período para conhecer a plataforma antes de assinar.</p>

      <h2>2. Assinaturas mensais</h2>
      <ul>
        <li>Assinaturas são cobradas mensalmente na data de renovação</li>
        <li>A cobrança é feita com antecedência para o período seguinte</li>
        <li>Não há contrato de fidelidade — cancele quando quiser</li>
      </ul>

      <h2>3. Cancelamento</h2>
      <ul>
        <li>Cancele a qualquer momento pelo painel em Configurações → Plano</li>
        <li>Ou envie e-mail para <a href="mailto:suporte@precyplus.com.br">suporte@precyplus.com.br</a></li>
        <li>Após cancelar, você mantém acesso até o fim do período pago</li>
        <li>Não há cobranças adicionais após o cancelamento</li>
      </ul>

      <h2>4. Reembolso</h2>
      <h3>Quando concedemos reembolso</h3>
      <ul>
        <li>Cobrança duplicada ou incorreta — reembolso integral em até 5 dias úteis</li>
        <li>Serviço indisponível por mais de 72h consecutivas sem aviso — reembolso proporcional</li>
        <li>Cancelamento nos primeiros 7 dias após a primeira assinatura paga — reembolso integral</li>
      </ul>
      <h3>Quando não concedemos reembolso</h3>
      <ul>
        <li>Cancelamento após os 7 primeiros dias — sem reembolso do período em curso</li>
        <li>Não utilização do serviço — a assinatura foi disponibilizada independente do uso</li>
        <li>Problemas causados por dados incorretos inseridos pelo usuário</li>
      </ul>

      <h2>5. Como solicitar</h2>
      <p>Envie e-mail para <a href="mailto:financeiro@precyplus.com.br">financeiro@precyplus.com.br</a> com:</p>
      <ul>
        <li>E-mail da conta</li>
        <li>Data da cobrança</li>
        <li>Motivo da solicitação</li>
      </ul>
      <p>Respondemos em até <strong>2 dias úteis</strong>. Reembolsos aprovados são processados em até <strong>10 dias úteis</strong> pelo Stripe.</p>

      <h2>6. Alteração de plano</h2>
      <ul>
        <li>Upgrade (Basic → Pro): cobrado na próxima renovação ou imediatamente com crédito proporcional</li>
        <li>Downgrade (Pro → Basic): aplicado na próxima renovação sem reembolso da diferença</li>
      </ul>

      <h2>7. Contato</h2>
      <p>Dúvidas sobre cobranças: <a href="mailto:financeiro@precyplus.com.br">financeiro@precyplus.com.br</a></p>
    </LegalLayout>
  )
}
