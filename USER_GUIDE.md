# Guia de utilização

1. O administrador cria as contas permitidas em Supabase Auth.
2. O primeiro administrador é promovido pelo procedimento documentado em `DATABASE.md`.
3. Os utilizadores iniciam sessão com email e palavra-passe em `/login`.
4. O painel inicial apresenta as três máquinas configuradas.
5. O administrador cria fornecedores com nome e código e cria produtos. Os preços base e os preços específicos por máquina mantêm histórico.
6. O administrador regista uma compra com as linhas da fatura. Ao confirmar, o sistema atualiza o armazém e o custo médio ponderado.
7. Um operador ou administrador regista reposições entre o armazém e uma máquina. A aplicação verifica a disponibilidade antes de confirmar.
8. Um operador ou administrador regista contagens físicas. As diferenças ficam pendentes até um administrador autorizar a correção.
9. Um operador ou administrador regista vendas manuais por máquina. O sistema verifica stock, aplica o preço e IVA configurados, deduz unidades e guarda o custo da venda.
10. Um administrador pode anular uma venda com justificação. A reposição do stock fica registada como movimento compensatório.
11. Registe separadamente recolhas, reforços e retiradas de dinheiro. No fecho diário, introduza o valor contado para comparar com o esperado.
12. Um administrador regista despesas em **Despesas**, indicando valor sem IVA e taxa; o sistema calcula o IVA e total. Pode associar a despesa a uma máquina e fornecedor.
13. Consulte o **Painel** para vendas de hoje e indicadores do mês. Em **Relatórios**, filtre por datas para consultar margens por máquina/produto, despesas por categoria, evolução diária e valores de stock.
14. Use **Exportar Excel (.xlsx)** nas páginas de despesas e relatórios para descarregar os dados apresentados.

Os valores de rentabilidade são estimativas de gestão. Compras são apresentadas separadamente; o custo das mercadorias é reconhecido nas vendas pelo custo médio ponderado histórico. O IVA indicado serve para acompanhamento e não substitui a contabilidade oficial.

A aplicação pode ser instalada no ecrã principal do telemóvel através do navegador, depois de publicada em HTTPS. Em modo sem ligação, não guarda nem permite submeter operações; apresenta apenas uma mensagem e é necessário reconectar para consultar os dados atuais.
