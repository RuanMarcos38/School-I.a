# Acesso e administração

Produção exige email e senha. O primeiro administrador já existente é preservado e permanece aprovado. Novos cadastros usam Solicitar acesso e ficam pendentes até aprovação pelo administrador. Contas anteriores sem função administrativa também precisam de aprovação. Não há promoção automática de administradores.

O menu Administração é exibido somente para administradores. O backend recusa consultas e alterações administrativas feitas por usuários comuns. Aprovar libera o login; suspender ou não aprovar revoga as sessões existentes. O administrador não pode suspender a si mesmo pelo painel. É possível aprovar novamente uma conta sem apagar personagens e arquivos.

Antes da primeira migração em produção, o banco é copiado para /app/data/before-access-approval.sqlite com permissão privada. A migração adiciona colunas e tabelas, preservando credenciais, senhas, personagens, mídias e solicitações. O backup contém o banco; os arquivos de mídia permanecem no volume original. Não remover o volume.

O dashboard reúne usuários por situação, usuários ativos nos últimos 30 dias, faturamento manual em BRL, solicitações concluídas/falhas/pendentes e métricas do processo do servidor. Taxa de conclusão usa concluídas, falhas e recusadas, sem canceladas ou pendentes; não mede qualidade visual. Métricas de requisições, latência média, erros e memória são do processo atual e reiniciam com o serviço.

Pagamentos são registros manuais de valores recebidos: não cobram clientes, não são notas fiscais e não sincronizam bancos ou plataformas de pagamento. Pode-se vincular um usuário, informar data, valor e descrição. Anular mantém histórico e exclui o valor das somas; reativar volta a incluir. Repetir a mesma submissão com o mesmo identificador não duplica a receita. O histórico de ações é persistente.

No ambiente local de desenvolvimento, LOCAL_MODE=true continua disponível para testes isolados. A produção usa LOCAL_MODE=false. Não ativar modo local na produção.
