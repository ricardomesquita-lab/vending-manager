# Verificação e testes

## Automatizados neste repositório

`pnpm test` executa testes Node sem dependências de terceiros para verificar o manifest PWA, o fallback offline que não armazena respostas operacionais e a presença dos cabeçalhos de segurança. Execute também `pnpm lint`, `pnpm typecheck` e `pnpm build`.

## Verificação integrada antes de produção

Com um projeto Supabase descartável e duas contas de teste (uma administrator e outra operator), validar manualmente:

1. Ambos iniciam sessão; o operador não regista despesas nem compras e não altera preços ou utilizadores.
2. O operador consegue registar venda, reposição e contagem física; stock insuficiente bloqueia a venda/reposição.
3. A repetição de um pedido com a mesma request key não duplica venda ou movimento de caixa.
4. Uma venda confirmada não pode ser eliminada e apenas administrador a anula com justificação.
5. O fecho de caixa compara vendas e movimentos reais de dinheiro; novos movimentos desse dia ficam bloqueados.
6. Uma despesa é calculada com IVA correto, visível no histórico e refletida no dashboard/relatório.
7. Exportações `.xlsx` abrem no Excel/LibreOffice e correspondem aos filtros e totais visíveis.
8. No telemóvel, validar navegação, formulários, tabelas com deslocamento horizontal, foco de teclado e instalação da PWA.
9. Com rede desligada, só aparece a página offline; ao voltar a rede, iniciar sessão e confirmar que os dados são carregados do servidor.
10. Aplicar e confirmar CSP, HSTS em HTTPS, RLS e ausência de chaves secretas no bundle do navegador.

## Backups e recuperação

Seguir o teste de recuperação num projeto Supabase temporário descrito em `DEPLOYMENT.md`. A recuperação não foi executada por não existirem credenciais nem instância PostgreSQL disponível neste ambiente.
