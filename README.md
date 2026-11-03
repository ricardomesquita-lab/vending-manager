# Vending Manager

Aplicação web para gerir operações de um pequeno espaço de vending. Idioma e apresentação em português europeu, moeda EUR e fuso horário Europe/Lisbon.

## Requisitos

- Node.js 20.9 ou superior
- pnpm
- Projeto Supabase

## Desenvolvimento local

1. Instale as dependências com `pnpm install`.
2. Copie `.env.example` para `.env.local` e preencha o URL e a chave pública `publishable` do projeto Supabase.
3. Execute pela ordem os ficheiros da pasta `supabase/migrations` no SQL Editor do projeto Supabase.
4. Crie os utilizadores em Supabase Auth. Os utilizadores novos recebem o perfil `operator`; promova um utilizador inicial a `administrator` através do painel SQL seguro do Supabase.
5. Execute `pnpm dev` e abra http://localhost:3000.

Nunca exponha uma chave `secret`/`service_role` no navegador nem a inclua no repositório. A chave `anon` continua suportada para projetos antigos, mas deve preferir-se a chave `publishable`.

## Estado

A Fase 1 inclui a base de autenticação, perfis, políticas RLS e as três máquinas de demonstração. As Fases 2 e 3 incluem migrations e ecrãs para produtos, fornecedores, compras, stocks, reposições, inventários, vendas e caixa. A Fase 4 acrescenta despesas administrativas, indicadores financeiros, rentabilidade por máquina e produto, dashboard e relatórios com exportação `.xlsx`. A Fase 5 acrescenta PWA, suporte mobile, cabeçalhos de segurança, verificações automatizadas e procedimentos de cópia/restauro. Não são criados produtos, fornecedores, despesas, vendas ou compras fictícios.

Aplicar todas as migrations de `supabase/migrations` por ordem antes de usar os módulos correspondentes. A migration mais recente acrescenta o código de fornecedor: `202611030006_supplier_code.sql`.

Execute `pnpm test`, `pnpm lint`, `pnpm typecheck` e `pnpm build` antes da publicação. Consulte `TESTS.md` e `DEPLOYMENT.md` para validação com Supabase, cópias de segurança e restauro.
