import { LegalLayout } from '@/components/legal/LegalLayout'
import { PRIVACY_VERSION, PRIVACY_UPDATED_AT } from '@/lib/legal/versions'

export const metadata = { title: 'Política de Privacidade — Precy+', description: 'Como coletamos, usamos e protegemos seus dados no Precy+.' }

export default function PrivacidadePage() {
  return (
    <LegalLayout title="Política de Privacidade" subtitle="Transparência e proteção de dados" updated={PRIVACY_UPDATED_AT} version={PRIVACY_VERSION}>
      <div className="highlight"><p>O Precy+ é comprometido com a privacidade e segurança dos seus dados. Esta política está em conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018)</strong>.</p></div>

      <h2>1. Quem somos</h2>
      <p>O Precy+ Sistemas é uma plataforma SaaS de gestão e precificação para pequenos negócios, operada por pessoa física/jurídica brasileira. Contato: <a href="mailto:privacidade@precyplus.com.br">privacidade@precyplus.com.br</a></p>

      <h2>2. Quais dados coletamos</h2>
      <h3>Dados de cadastro</h3>
      <ul><li>Nome e e-mail (obrigatórios para criar conta)</li><li>Nome da empresa e dados comerciais opcionais (CNPJ, telefone, endereço)</li><li>Logotipo da empresa (upload voluntário)</li></ul>
      <h3>Dados de uso</h3>
      <ul><li>Informações de pedidos, clientes, produtos e estoque que você cadastra</li><li>Transações financeiras e orçamentos inseridos por você</li><li>Horários de acesso e ações realizadas (logs de sistema)</li></ul>
      <h3>Dados técnicos</h3>
      <ul><li>Endereço IP (anonimizado)</li><li>Tipo de dispositivo e navegador</li><li>Cookies de sessão e preferências</li></ul>

      <h2>3. Como usamos seus dados</h2>
      <ul>
        <li>Fornecer as funcionalidades da plataforma</li>
        <li>Autenticar seu acesso com segurança</li>
        <li>Calcular precificações e gerar relatórios</li>
        <li>Enviar notificações importantes sobre sua conta</li>
        <li>Melhorar o sistema com base em uso agregado e anonimizado</li>
        <li>Cumprir obrigações legais</li>
      </ul>

      <h2>4. Base legal (LGPD)</h2>
      <p>Processamos seus dados com base em:</p>
      <ul>
        <li><strong>Execução de contrato</strong> — para prestar o serviço contratado</li>
        <li><strong>Legítimo interesse</strong> — para segurança e melhoria do sistema</li>
        <li><strong>Consentimento</strong> — para cookies não essenciais e comunicações de marketing</li>
        <li><strong>Cumprimento legal</strong> — quando exigido por lei</li>
      </ul>

      <h2>5. Armazenamento e segurança</h2>
      <p>Seus dados são armazenados na infraestrutura do <strong>Supabase</strong> (PostgreSQL), hospedado na AWS com data center no Brasil (sa-east-1). A plataforma opera sobre HTTPS com TLS 1.2+. Acesso aos dados é controlado por Row Level Security (RLS), garantindo que cada usuário acesse apenas seus próprios dados.</p>

      <h2>6. Compartilhamento de dados</h2>
      <p>Não vendemos nem compartilhamos seus dados pessoais com terceiros, exceto:</p>
      <ul>
        <li><strong>Supabase</strong> — infraestrutura de banco de dados e autenticação</li>
        <li><strong>Stripe</strong> — processamento seguro de pagamentos (não armazenamos dados de cartão)</li>
        <li><strong>Vercel</strong> — hospedagem da aplicação</li>
        <li>Autoridades públicas quando exigido por lei</li>
      </ul>

      <h2>7. Cookies</h2>
      <p>Utilizamos cookies essenciais (sessão/autenticação) e, com seu consentimento, cookies analíticos para entender como o sistema é usado. Você pode gerenciar preferências a qualquer momento pelo banner de cookies.</p>

      <h2>8. Seus direitos (LGPD Art. 18)</h2>
      <p>Você tem direito a:</p>
      <ul>
        <li><strong>Acesso</strong> — solicitar cópia dos seus dados</li>
        <li><strong>Correção</strong> — atualizar dados incompletos ou incorretos</li>
        <li><strong>Exclusão</strong> — solicitar remoção dos seus dados pessoais</li>
        <li><strong>Portabilidade</strong> — receber seus dados em formato estruturado</li>
        <li><strong>Revogação</strong> — revogar consentimentos dados anteriormente</li>
        <li><strong>Oposição</strong> — opor-se ao processamento em determinadas situações</li>
      </ul>
      <p>
        Acesso e portabilidade (baixar seus dados) estão disponíveis a qualquer momento em{' '}
        <strong>Configurações → Conta &amp; Plano → Privacidade e seus dados</strong>. Exclusão e
        anonimização podem ser solicitadas na mesma tela — o pedido é registrado e processado por
        nossa equipe, sem execução automática imediata. Para os demais direitos ou dúvidas:{' '}
        <a href="mailto:privacidade@precyplus.com.br">privacidade@precyplus.com.br</a>
      </p>

      <h2>9. Retenção de dados</h2>
      <p>Seus dados são mantidos enquanto sua conta estiver ativa. Após cancelamento, dados pessoais são removidos em até 90 dias, salvo obrigação legal de retenção.</p>

      <h2>10. Menores de idade</h2>
      <p>O Precy+ é destinado a pessoas maiores de 18 anos. Não coletamos dados de menores conscientemente.</p>

      <h2>11. Alterações nesta política</h2>
      <p>Mudanças significativas serão comunicadas por e-mail com 30 dias de antecedência. O uso continuado após a vigência implica aceite.</p>

      <h2>12. Contato e DPO</h2>
      <p>Encarregado de Proteção de Dados: <a href="mailto:privacidade@precyplus.com.br">privacidade@precyplus.com.br</a></p>
    </LegalLayout>
  )
}
