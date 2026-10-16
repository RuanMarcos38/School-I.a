# Prompts longos

Foram removidos os limites locais de 8.000 e 10.000 caracteres dos prompts de vídeo e das descrições usadas para criar personagens e vistas, incluindo descrições de biblioteca. O texto é enviado integralmente, sem resumo ou corte automático, junto das orientações de realismo existentes.

O campo de texto não tem maxlength. As rotas de criação e estimativa aceitam requisições JSON de até 8 MiB; esse é um limite de transporte para proteção do servidor, não um contador de caracteres do prompt. Autenticação, aprovação de usuários, limites de arquivos e quantidade de opções/referências permanecem ativos.

O provedor continua responsável pelas restrições dos modelos. Remover os limites locais não altera as regras de entrada da API ou do MCP Higgsfield. Não foi feita uma geração paga para verificar o maior tamanho aceito pelo provedor.

Verificação automatizada: texto com acentuação acima de 64 KiB persistido integralmente e encaminhado sem corte às chamadas simuladas de imagem e vídeo. Orientações de realismo e enquadramento preservados.
