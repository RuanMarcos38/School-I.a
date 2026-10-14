# School IA
Implementação independente baseada em inspeção da interface de Characters School. **Não é um clone 100% nem uma entrega de produção concluída.**

## Executar
Instale Node.js 24 ou superior. Não há dependências externas.
```
node --env-file-if-exists=.env server.mjs
```
Abra http://localhost:3038. O serviço escuta apenas em 127.0.0.1.
Na versão entregue, a chave da API não está configurada.

## Recursos implementados
- Estúdio com seleção, busca e favoritos de personagens.
- Biblioteca própria persistente, pastas e edição de referências.
- Upload local de imagens e vídeo, prévia e validação de formato/tamanho.
- Solicitações Genjutsu Object Swap, envio de mídia por URL assinada, acompanhamento e solicitação de cancelamento.
- Fila persistente, estados de erro, galeria, favoritos e comparação de dois resultados.
- Banco SQLite e arquivos locais na pasta data. Faça backup dessa pasta.
- Interface em português, adaptada para celular, inspirada na referência escura/amarela.
- Credencial somente no servidor, proteção de Host/Origin e chamadas ao domínio oficial fixo.

## Conectar Higgsfield
Copie .env.example para .env e preencha HF_API_KEY com a chave completa da API do console oficial https://open.higgsfield.ai/api-keys. Reinicie.
Não envie a chave no chat nem a publique no GitHub.
A assinatura e sessão do site original não são transferidas.
Geração tem custo no provedor. Nenhuma geração paga foi executada na validação.
O servidor não reenvia POST de geração em caso de resposta ambígua. Estado "uncertain" exige conferência manual no console antes de nova tentativa.
Polling retoma solicitações aceitas após reiniciar.

## Limitações e pendências
- Integração implementada a partir de documentação pública, SEM validação com chave real.
- Referência pública de Object Swap informa endpoint e campos, mas a API reference detalhada exige login. A compatibilidade completa de limites e conta permanece pendente.
- Limite conservador: 4–30 s, 200 MB; o original anuncia 4–60 s, 300 MB.
- GPT Image 2.5/Série Amarela, prompt proprietário, criação de opções e geração automática de vistas não implementados.
- Não incluídos os 42 personagens/assets privados da biblioteca original.
- Importação de TikTok/Instagram não implementada.
- Saldo da assinatura, cobrança de R$49,90, gerações grátis e login da escola não replicados.
- Original aparenta usar integração da assinatura, enquanto esta versão usa API oficial separada.
- Sem autenticação multiusuário, hospedagem pública, pagamentos, backup externo ou infraestrutura de produção.
- Exportação de resultados abre o URL do provedor; retenção e disponibilidade seguem o provedor, sem promessa de 30 dias.
- Duração conferida no navegador; servidor valida o valor recebido, não decodifica vídeo. Antes de publicação, adicionar análise de mídia no servidor.
- Não expor este serviço local à internet sem implementar autenticação e isolamento por usuário.

## Validação
```
node --test tests/*.test.mjs
```
Os testes cobrem persistência, uploads, bloqueio de origem, configuração ausente e o fluxo de geração com provedor substituto para testes. Não demonstram geração real.

## Fontes oficiais
- https://open.higgsfield.ai/quick-start
- https://open.higgsfield.ai/models/higgsfield/genjutsu/object-swap/v1.0/playground
- https://docs.higgsfield.ai/docs/llms.txt
