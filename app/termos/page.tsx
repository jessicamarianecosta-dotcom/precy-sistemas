import { LegalLayout } from '@/components/legal/LegalLayout'

export const metadata = { title: 'Termos de Uso — Precy+', description: 'Termos e condições de uso da plataforma Precy+.' }

export default function TermosPage() {
  return (
    <LegalLayout title="Termos de Uso" subtitle="Condições da plataforma" updated="Junho de 2026">
      <div className="highlight">
        <p><strong>Aviso importante:</strong> O Precy+ é uma ferramenta auxiliar de gestão e precificação. Não substitui contador, ERP fiscal, emissor de notas fiscais ou assessoria jurídica. Todos os valores e cálculos devem ser validados pelo usuário.</p>
      </div>

      <h2>1. Aceitação</h2>
      <p>Ao criar conta e usar o Precy+, você concorda com estes Termos. Caso não concorde, não utilize a plataforma.</p>

      <h2>2. O serviço</h2>
      <p>O Precy+ oferece ferramentas de gestão para pequenos negócios, incluindo:</p>
      <ul>
        <li>Precificação de produtos e serviços</li>
        <li>Gestão de pedidos, clientes, estoque e agenda</li>
        <li>Controle financeiro básico e fluxo de caixa</li>
        <li>Geração de orçamentos em PDF</li>
        <li>Relatórios gerenciais</li>
      </ul>
      <div className="highlight"><p><strong>O Precy+ NÃO é:</strong> emissor de nota fiscal, sistema contábil oficial, ERP fiscal, substituto de contador ou ferramenta para declarações fiscais. Os dados e cálculos têm caráter auxiliar e gerencial.</p></div>

      <h2>3. Conta de usuário</h2>
      <p>Você é responsável por manter a segurança das suas credenciais e por todas as ações realizadas na sua conta. Notifique imediatamente qualquer uso não autorizado em <a href="mailto:suporte@precyplus.com.br">suporte@precyplus.com.br</a>.</p>

      <h2>4. Planos e pagamentos</h2>
      <ul>
        <li><strong>Plano Basic (R$17/mês):</strong> acesso às funcionalidades básicas com limites</li>
        <li><strong>Plano Pro (R$37/mês):</strong> acesso completo a todas as funcionalidades</li>
        <li>Os preços podem ser alterados com aviso prévio de 30 dias</li>
        <li>Pagamentos processados com segurança pelo Stripe</li>
      </ul>

      <h2>5. Uso aceitável</h2>
      <p>É proibido:</p>
      <ul>
        <li>Usar a plataforma para fins ilegais</li>
        <li>Tentar acessar dados de outros usuários</li>
        <li>Fazer engenharia reversa do sistema</li>
        <li>Usar automações ou scripts não autorizados</li>
        <li>Revender ou sublicenciar o acesso</li>
      </ul>

      <h2>6. Responsabilidades e limitações</h2>
      <p>O Precy+ oferece a plataforma &ldquo;como está&rdquo; (as-is). Não nos responsabilizamos por:</p>
      <ul>
        <li>Decisões de negócio tomadas com base nos cálculos do sistema</li>
        <li>Erros de entrada de dados pelo usuário</li>
        <li>Perdas financeiras decorrentes do uso ou não-uso da plataforma</li>
        <li>Indisponibilidades temporárias por manutenção</li>
        <li>Inconsistências entre valores calculados e valores fiscais/legais</li>
      </ul>

      <h2>7. Propriedade intelectual</h2>
      <p>O código, design, marca e conteúdos do Precy+ são propriedade exclusiva dos seus criadores. Os dados inseridos por você são de sua propriedade. Você nos concede licença para processá-los para prestação do serviço.</p>

      <h2>8. Cancelamento e suspensão</h2>
      <ul>
        <li>Você pode cancelar a qualquer momento pelo painel ou por e-mail</li>
        <li>Após cancelamento, seus dados ficam disponíveis por 30 dias para exportação</li>
        <li>Podemos suspender contas por violação destes termos, com aviso prévio quando possível</li>
      </ul>

      <h2>9. Privacidade</h2>
      <p>O tratamento de dados pessoais está descrito na nossa <a href="/privacidade">Política de Privacidade</a>, que faz parte integrante destes Termos.</p>

      <h2>10. Foro e legislação</h2>
      <p>Estes Termos são regidos pela legislação brasileira. Eventuais disputas serão resolvidas no foro da comarca de Curitiba/PR.</p>

      <h2>11. Alterações</h2>
      <p>Podemos atualizar estes Termos com aviso de 30 dias por e-mail. O uso continuado implica aceite das novas condições.</p>

      <h2>12. Contato</h2>
      <p><a href="mailto:suporte@precyplus.com.br">suporte@precyplus.com.br</a></p>
    </LegalLayout>
  )
}
