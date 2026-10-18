# Integração incremental de realismo — 14/10/2026

Os dois textos fornecidos pelo usuário orientam o módulo lib/realism.mjs. A versão human-realism-v1 prioriza identidade, anatomia, pele orgânica, luz coerente, movimento e estabilidade temporal. As instruções são compartilhadas por cards, vistas e vídeo (API e MCP), incluindo cenas personalizadas. Não são um algoritmo de visão computacional nem uma garantia de ausência de artefatos.

Arquitetura preservada: frontend atual, SQLite, autenticação, volume, credenciais cifradas, modelos e parâmetros de resolução existentes. Nenhuma migração ou dependência adicional. Importação por link Instagram/TikTok e downloads existentes permanecem operacionais nos testes locais; disponibilidade de um link depende da plataforma e de acesso público. Não se removem marcas de origem dos arquivos importados.

Validação: 18 testes de regressão aprovados, incluindo arquivos de vídeo reais com provedor simulado, importação com importador simulado, download com conteúdo e isolamento de contas. Dois testes adicionais confirmam aplicação às modalidades e reversão. Sintaxe de backend e frontend aprovada. Não houve nova geração paga nesta alteração.

Limites: nenhuma comparação visual independente com o original. A nova orientação ainda não foi avaliada em imagens/vídeos gerados pelo provedor real. MCP recebeu autorização OAuth, mas compatibilidade operacional e vídeo real permanecem pendentes. O último vídeo API terminou por timeout do provedor. O controle do Chrome não respondeu ao diagnóstico nesta sessão.

Os módulos de análise facial automática, avaliação temporal, clonagem de voz e comprovação jurídica automática descritos no segundo texto não foram implementados por esta mudança. Declarações e evidências de direitos exigem implementação específica; os prompts não comprovam autorização.

Reversão: definir HUMAN_REALISM_ENABLED=false e reiniciar o serviço desativa somente a orientação adicional. Para restaurar o código anterior, usar o commit a6073f488d73c92402908eb918a94f53ff6a8bd4 no EasyPanel. O banco e o volume não precisam ser substituídos. Snapshot local dos três módulos anteriores e hashes: work/realism-before-20261014. A desativação foi testada; rollback de produção não foi executado.
