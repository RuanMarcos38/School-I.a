# Pagamento, acesso e boas-vindas

Quando a automação está ativa, cadastros pendentes podem entrar em uma área limitada de contratação. Não podem gerar nem acessar biblioteca, mídias ou administração. Pagamento confirmado em produção pelo Asaas, inclusive baixa reconhecida por ele, libera a franquia e aprova somente cadastros pendentes. Suspensões e rejeições explícitas não são sobrescritas. Sandbox não libera acesso real.

O webhook consulta o pagamento no Asaas e confere assinatura, cliente e valor. A franquia, aprovação e inclusão na fila de email são gravadas na mesma transação. Os eventos repetidos não duplicam franquia nem mensagem. Estorno/chargeback bloqueia a franquia correspondente. Anular uma baixa no Asaas também bloqueia essa franquia; não equivale a suspender manualmente a conta.

A fila de email fica no SQLite privado. A liberação do acesso não depende de o SMTP estar online. O n8n recebe um evento autenticado por token exclusivo, usa a conexão SMTP existente e confirma somente após o nó de envio. A senha SMTP não é copiada para o Fields IA. O texto inclui confirmação, plano, franquia, validade, link de acesso e agradecimento pela comunidade; nunca senha.

Fluxo exclusivo: https://n8n-n8n.ke4n49.easypanel.host/workflow/Cj3N6so2ABGu0W2E

O n8n mantém deduplicação por evento; o backend mantém a fila persistente. Respostas inconclusivas do n8n ficam em review para conferir os logs antes de repetir, pois SMTP não garante idempotência. Aceitação SMTP não garante entrega na caixa de entrada. O teste administrativo é identificado como teste e não registra pagamento.

Registros contábeis manuais antigos em Administração continuam registros contábeis. Para baixar uma cobrança Asaas, use a baixa no próprio Asaas ou a reconciliação da assinatura; não registre o mesmo pagamento nos dois lugares.

A integração Resend é opcional. Um domínio foi preparado no conector antes da escolha do n8n, mas nenhum registro DNS foi alterado para ele e ele não é usado pelo envio de produção.
