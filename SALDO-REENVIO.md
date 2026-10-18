# Saldo e reenvio de vídeos

O cabeçalho consulta os créditos da conta MCP conectada a cada 30 segundos enquanto a página estiver visível. Há atualização manual e horário da última consulta. O backend deduplica consultas simultâneas e separa o cache por usuário e conta. Uma falha de consulta é identificada como saldo indisponível ou último saldo sem atualização; nunca é transformada em zero fictício.

A carteira da API é separada dos créditos MCP. A documentação oficial consultada não forneceu uma rota pública de saldo da API; por isso, o site oferece acesso a https://open.higgsfield.ai/billing e não apresenta créditos MCP como dólares da API. Não há coleta de cookies do console para obter saldo.

Vídeos com falha ou cancelamento têm Reenviar vídeo. O botão prepara o mesmo arquivo no Estúdio para revisão, sem iniciar cobrança. Gerar confirma uma nova solicitação. Novas solicitações preservam um snapshot do prompt, descrição e referências; a preparação do reenvio recupera esse material. Registros antigos que não guardaram o prompt exibem um aviso para conferência. O histórico anterior é mantido.

Casos incertos, recusas de conteúdo, etapas ainda em andamento ou parcialmente concluídas não são repetidos automaticamente. Isso evita contornar recusas ou gerar cobranças duplicadas. Estimativas MCP anteriores não são reutilizadas: é necessário estimar novamente.

Referências verificadas: https://open.higgsfield.ai/quick-start ; https://docs.higgsfield.ai/docs/llms.txt ; https://higgsfield.ai/creator-hub/help-center/integrations/what-is-the-higgsfield-api .
