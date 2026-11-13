# Base de dados

## Fundação inicial

- `profiles`: perfil por utilizador Supabase Auth, com função `administrator` ou `operator`.
- `machines`: máquinas com código, nome, localização e estado.

A migration inicial ativa RLS, deixa os utilizadores consultar apenas o próprio perfil (administradores podem consultar e gerir todos os perfis), permite leitura das máquinas a utilizadores autenticados e reserva alterações de máquinas a administradores. A criação de utilizadores gera automaticamente um perfil de operador.

As máquinas M1, M2 e M3 são dados de demonstração de configuração. Nenhum utilizador ou dado operacional é criado pelo seed.

## Alteração de permissões iniciais

Promova o primeiro administrador manualmente no SQL Editor do Supabase, depois de criar a respetiva conta:

```sql
update public.profiles
set role = 'administrator', updated_at = now()
where id = (select id from auth.users where email = 'admin@exemplo.pt');
```

Substitua o email pelo endereço real e execute apenas num projeto controlado pelo proprietário.

## Produtos, compras e stocks

A migration `202611020002_products_stock_purchases.sql` acrescenta categorias, fornecedores, produtos, preços por máquina, histórico de preços, saldos do armazém e das máquinas, movimentos, compras, reposições e inventários físicos.

- As categorias iniciais são criadas pela migration; não são criados produtos ou fornecedores fictícios.
- O custo médio ponderado só é atualizado quando uma compra confirmada entra no armazém. O custo e IVA de cada linha de compra ficam guardados como histórico.
- `register_purchase` valida a função de administrador, calcula os totais no servidor e lança a compra e entradas de stock numa transação.
- `replenish_machine` valida a sessão, impede stock negativo, atualiza armazém e máquina numa transação e usa chave única para evitar duplicação por repetição do pedido.
- Operadores podem registar contagens físicas, mas estas ficam pendentes. `approve_inventory_count` só pode ser executada por administrador; volta a conferir o stock teórico e cria movimentos compensatórios auditáveis.
- Os movimentos de stock não podem ser inseridos ou alterados diretamente por utilizadores autenticados. São criados pelas funções transacionais.
- A atualização do preço base ou do preço por máquina cria uma linha em `product_price_history` através de trigger.

## Vendas e caixa

As migrations `202611020003_sales_movement_types.sql` e `202611020004_sales_and_cash.sql` acrescentam vendas, linhas de venda, movimentos de caixa e fechos.

- `register_sale` verifica sessão, máquina, caixa ainda aberto e stock disponível; fixa preço, IVA e custo médio aplicáveis e faz a dedução e os movimentos na mesma transação.
- A chave de pedido e a impressão digital dos dados impedem que a repetição do mesmo pedido crie uma segunda venda ou operação de caixa. As vendas confirmadas não podem ser apagadas.
- `void_sale` exige administrador e justificação, repõe as unidades na máquina e guarda movimentos compensatórios. Uma anulação após fecho marca esse fecho para revisão.
- `record_cash_operation` regista recolhas, reforços e retiradas, sem inferir o dinheiro recolhido a partir das vendas.
- `close_cash_day` guarda vendas, recolhas, reforços, retiradas, dinheiro esperado, valor contado na máquina e diferença numa operação única. O esperado é vendas + reforços − retiradas − recolhas. O fecho impede novas vendas ou movimentos de caixa para esse dia.

## Financeiro e relatórios

A migration `202611020005_financial_reports.sql` acrescenta despesas categorizadas, com valores sem IVA, taxa, IVA calculado no servidor, valor total, data, máquina e fornecedor opcionais, e utilizador responsável. Apenas administradores podem criar despesas; os utilizadores autenticados podem consultar o histórico. Não há atualização ou eliminação direta de despesas.

Os relatórios usam as vendas confirmadas e as respetivas linhas históricas, que preservam preço, taxa de IVA e custo médio aplicado no momento da venda. A margem bruta é faturação sem IVA menos custo das mercadorias vendidas; o resultado operacional estimado subtrai as despesas sem IVA. Compras aparecem separadamente e não são tratadas como custo integral do período. A valorização dos stocks usa o custo médio atual do produto. Os valores servem acompanhamento de gestão e não substituem a contabilidade oficial.

O dashboard apresenta o dia e mês correntes. A página Relatórios permite selecionar datas e exporta as linhas do período em formato `.xlsx`. O histórico de despesas no ecrã mostra até 300 registos mais recentes; o relatório financeiro limita cada consulta a 5.000 operações e 10.000 linhas de venda.

## Código de fornecedor

A migration `202611030006_supplier_code.sql` acrescenta um código único (sem diferenciar maiúsculas/minúsculas) para cada fornecedor. O campo é anulável para preservar os fornecedores já criados; a interface permite preencher o código em falta e exige nome e código para novos fornecedores. As colunas anteriores de NIF, contactos, morada e observações ficam intactas na base de dados, mas deixam de aparecer nos ecrãs.

A migration `202611130001_auto_replenishment_after_sale.sql` acrescenta o registo atómico de venda com reposição automática da mesma quantidade a partir do armazém. Se faltar stock na máquina ou no armazém, a operação inteira é cancelada. A anulação da venda também reverte a reposição automática e devolve as unidades ao armazém.
