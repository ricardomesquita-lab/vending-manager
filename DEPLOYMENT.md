# Publicação, segurança e recuperação

## Preparação da aplicação

1. Execute `pnpm install`, `pnpm test`, `pnpm lint`, `pnpm typecheck` e `pnpm build`.
2. Crie um projeto Supabase dedicado a produção e aplique as migrations por ordem.
3. Crie as duas contas reais em Supabase Auth e promova apenas a conta administrativa através do procedimento em `DATABASE.md`.
4. Configure autenticação por email, URLs de redirecionamento e domínio permitido para a aplicação.
5. Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no ambiente de produção. Nunca coloque `service_role`, `secret`, palavra-passe da base de dados ou token de gestão em variáveis `NEXT_PUBLIC_*`.
6. Importe o repositório em Vercel, defina o diretório raiz do projeto, as variáveis de ambiente para Preview e Production e publique primeiro um Preview. A seguir à validação, promova para produção. Consulte [deployments com Git na Vercel](https://vercel.com/docs/git).
7. Confirme no domínio publicado que login, RLS por perfil, vendas e caixa funcionam, que o manifest e ícone carregam e que a aplicação pode ser instalada. HTTPS é necessário para Service Workers fora de localhost.

## Segurança e publicação

O Next.js envia CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` e HSTS em produção. A CSP permite o domínio Supabase gerido (`*.supabase.co`). Se o projeto usar um domínio Supabase personalizado ou self-hosted, ajuste `connect-src` e `img-src` em `next.config.ts` ao hostname exato antes de publicar.

Mantenha MFA na conta de administração dos serviços, limite acesso ao projeto e reveja alertas de segurança do Supabase. A publicação não substitui a revisão do Advisor de segurança do projeto, das políticas RLS efetivas nem dos domínios de autenticação.

## Backups

Confirme a retenção de backups do plano Supabase em uso. A documentação atual da Supabase indica backups automáticos diários nos planos Pro, Team e Enterprise, com retenção que varia por plano; em Free, faça exports próprios e mantenha-os fora do projeto. PITR tem configuração e custo próprios. Um backup PostgreSQL não inclui objetos de ficheiros da Storage API, portanto mantenha um procedimento separado se a aplicação passar a guardar documentos. Consulte [Backups da base de dados Supabase](https://supabase.com/docs/guides/platform/backups) antes de escolher retenção e RPO/RTO.

Para um backup lógico manual com Supabase CLI, use uma máquina segura e guarde a connection string apenas numa variável temporária protegida, nunca no repositório:

```powershell
$env:SUPABASE_DB_URL = "<connection string obtida no painel Supabase>"
supabase db dump --db-url $env:SUPABASE_DB_URL -f roles.sql --role-only
supabase db dump --db-url $env:SUPABASE_DB_URL -f schema.sql
supabase db dump --db-url $env:SUPABASE_DB_URL -f data.sql --data-only --use-copy
Remove-Item Env:SUPABASE_DB_URL
```

Guarde os ficheiros cifrados fora do repositório, com acesso restrito e política de retenção. O dump pode conter dados pessoais e financeiros.

## Teste de recuperação

Não execute um restauro inicial sobre produção. Crie um projeto Supabase temporário, restaure schema, roles e dados segundo o procedimento atual da Supabase CLI, aplique configurações e secrets separadamente, e valide login, três máquinas, utilizadores, vendas, caixa, despesas, saldos e movimentos. Registe data do backup, duração do restauro, diferenças e responsável. Só depois documente o procedimento como testado.

Os backups automáticos do fornecedor e os dumps lógicos são mecanismos documentados, não foram ativados ou testados contra uma conta neste workspace. Consulte os planos e o procedimento atuais antes de decidir retenção e RPO/RTO.

## Limite desta entrega

O workspace não está ligado a uma organização Supabase, repositório GitHub ou projeto Vercel. Por isso, esta fase prepara código e runbook, mas não cria contas, aplica migrations remotas, publica um domínio ou declara um restauro de produção testado.
