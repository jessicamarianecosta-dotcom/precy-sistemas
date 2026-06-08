# Precy+ Sistemas 🚀

SaaS Premium de Precificação e Gestão Integrada para Pequenos Negócios

## 📋 Sobre

Precy+ Sistemas é uma plataforma inteligente voltada para artesãs, papelarias, cosméticos e pequenos negócios que precisam de:

- 📊 **Dashboard Inteligente** com dados reais
- 💰 **Precificação Automática** com cenários
- 📦 **Estoque Inteligente** com alertas
- 🛒 **Pedidos com Kanban** e drag-and-drop
- 📄 **Orçamentos Premium** em PDF
- 💵 **Financeiro Completo** com relatórios

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 + TypeScript + TailwindCSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Pagamentos**: Stripe
- **Deploy**: Vercel
- **Versionamento**: GitHub

## 🚀 Quick Start

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
# Editar .env.local com suas credenciais

# Rodar em desenvolvimento
npm run dev

# Abrir http://localhost:3000
```

## 📦 Estrutura do Projeto

```
app/                  # Next.js App Router
├── dashboard/       # Páginas de dashboard
├── auth/           # Autenticação
└── api/            # API Routes

components/         # Componentes React
├── ui/            # Componentes base
├── dashboard/     # Componentes de dashboard
├── forms/         # Formulários
└── layout/        # Layout

hooks/              # React Hooks customizados
services/           # Lógica de negócio
repositories/       # Data access layer
schemas/           # Validações (Zod)
types/             # TypeScript types
lib/               # Utilities e configurações
utils/             # Funções helpers
```

## 📚 Documentação

[Ver documento supremo de arquitetura](./PRECY_PLUS_DOCUMENTO_SUPREMO.pdf)

## 🔐 Segurança

- Autenticação JWT via Supabase
- Row Level Security (RLS) no PostgreSQL
- Validações em cliente e servidor
- HTTPS obrigatório
- Variáveis de ambiente seguras

---

**Desenvolvido com ❤️ para pequenos negócios**
