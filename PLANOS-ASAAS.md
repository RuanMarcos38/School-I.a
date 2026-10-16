# API central e mensalidades

A API central é uma opção reversível do administrador. Ela referencia a chave cifrada já cadastrada pelo administrador; não copia a chave para perfis de clientes. As conexões individuais permanecem salvas. O modo central exige franquia válida para clientes. Com a automação de pagamento ativa, cadastros pendentes são aprovados após confirmação financeira; suspensões e rejeições explícitas não são sobrescritas. Administradores continuam com a conta própria, sem franquia de cliente.

## Proposta comercial inicial — 15/10/2026

| Plano mensal | Preço | Créditos Fields IA por ciclo | Vídeo se usar toda a franquia | Imagens padrão se usar toda a franquia |
|---|---:|---:|---:|---:|
| Essencial | R$97 | 500 | 25 segundos | 20 |
| Criador | R$197 | 1.200 | 60 segundos | 48 |
| Studio | R$397 | 2.600 | 130 segundos | 104 |

Vídeo custa inicialmente 20 créditos por segundo arredondado para cima; imagem padrão, 25; alta/máxima qualidade, 50. É possível combinar usos. As taxas são editáveis pelo administrador e não representam créditos Higgsfield nem preço oficial do provedor. Franquias expiram um mês após o vencimento da cobrança, sem acúmulo. Gerações já enviadas podem consumir franquia mesmo com erro, recusa ou cancelamento do provedor. Falhas anteriores ao envio liberam a reserva. Respostas incertas mantêm a reserva para evitar gasto duplicado.

Referências de mercado consultadas: [HeyGen](https://www.heygen.com/pricing), Creator US$29/mês, 600 créditos; [Runway](https://runway.com/pricing), Standard US$15/mês (US$12 com contratação anual), 625 créditos. Os produtos, modelos e créditos não são equivalentes. A proposta em reais é uma decisão comercial, não uma garantia de margem ou qualidade superior.

Antes de ampliar vendas, medir o custo efetivo do Genjutsu e das imagens na própria conta, câmbio, impostos, infraestrutura e taxas Asaas. A documentação pública consultada não forneceu uma cotação verificável para o modelo exato integrado. Não usar preço de outro modelo como se fosse o custo desta operação.

## Asaas

Conectar em Administração usando o campo protegido, escolhendo sandbox ou produção. A chave é validada por consulta de saldo e cifrada no volume privado. O painel não retorna a chave nem o token de webhook. Após conectar, registrar webhook pelo botão próprio. URL: `https://fieldsia.r2rmarketingdigital.com.br/api/billing/webhook`.

O cliente escolhe plano e aceita mensalidade/envio de dados do pagador, informa CPF/CNPJ e recebe uma cobrança hospedada no Asaas. O Fields IA não coleta cartão. Pix/boleto exigem pagar a cobrança de cada ciclo; isso não é débito automático Pix. O valor e a franquia são determinados no servidor. O envio transacional de confirmação e boas-vindas é feito pelo fluxo n8n exclusivo, quando configurado.

Webhooks usam token aleatório independente no cabeçalho `asaas-access-token`, validação em tempo constante, deduplicação por evento e pagamento, consulta do pagamento na API Asaas e conferência de cliente, assinatura, valor e ambiente. Somente pagamentos recebidos/confirmados em produção liberam franquia. Sandbox nunca libera créditos reais. Estorno/chargeback bloqueia o lote correspondente. Cancelar a renovação preserva o período pago.

Operações de criação com resposta inconclusiva ficam bloqueadas para nova assinatura, evitando duplicação; exigem conferência/reconciliação antes de uma nova tentativa. Trocar a conta Asaas com assinaturas ativas exige migração assistida. Pagamentos manuais e valores confirmados pelo Asaas aparecem separados no painel, para evitar contagem dupla.

Documentação oficial: [Assinaturas](https://docs.asaas.com/docs/creating-a-subscription), [Criar cliente](https://docs.asaas.com/reference/criar-novo-cliente), [Webhooks](https://docs.asaas.com/docs/about-webhooks), [Registro de webhook por API](https://docs.asaas.com/docs/create-new-webhook-via-api).
