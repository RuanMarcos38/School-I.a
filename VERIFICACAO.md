# Verificação da instalação
A instalação principal usa dados reais locais e não tem chave Higgsfield configurada. O teste não comprova funcionamento 100% das integrações externas.

## Testes automatizados: 9 aprovados
1. Biblioteca própria, arquivos reais, favoritos, pastas, capas, arquivamento e persistência após reiniciar.
2. Bloqueio de origem / Host inválidos, imagem com conteúdo falso e geração sem chave.
3. Validação antes de armazenar credencial, cifra no banco e omissão no estado enviado ao navegador.
4. Envio de vídeo ao provedor substituto, acompanhamento, arquivo local e download.
5. Vídeo real de 36 s dividido em duas partes e reunido, com áudio.
6. Duas opções de personagem e vista de perfil salvas como referências.
7. Cancelamento encaminhado ao provedor e ausência de reenvio automático após resposta incerta.
8. Login, logout e isolamento de arquivos entre duas contas.
9. Host allowlist da importação social e armazenamento de vídeo real retornado pelo importador substituto.

Os testes utilizam imagens válidas e vídeos reais criados para verificação. Chamadas de geração e download de resultados da IA são substituídas no ambiente de teste, sem cobrança.

## Verificações no Chrome da instalação principal
- Biblioteca com 42 nomes únicos e 123 entradas de referência.
- Upload pelo seletor de arquivos, criação e leitura do personagem.
- Favorito atualizado pela interface.
- Edição do personagem e associação a pasta.
- Seleção do personagem no Estúdio.
- Configurações e controles de geração bloqueados quando a chave está ausente.
- Nenhuma chave ou sessão da conta original foi copiada para o novo aplicativo.

## Rede
O domínio oficial Higgsfield respondeu HTTP 401 a uma consulta sem credencial. A conectividade está disponível; a autenticação exige uma chave própria.
FFmpeg, FFprobe, Sharp e yt-dlp estão instalados nesta máquina. O executável yt-dlp foi conferido contra SHA2-256SUMS da versão oficial.

## Pendente para encerrar a entrega como integrada
- Conectar chave real pelo campo seguro.
- Confirmar acesso da conta aos modelos Object Swap e Flare.
- Definir limite de gasto e executar um teste real de imagem / vista / vídeo.
- Testar o importador com um link público real fornecido para esse fim.
- Selecionar hospedagem e domínio se houver necessidade de acesso pela internet.
- Confirmar quais regras de cobrança devem pertencer à nova operação.

A geração real, a publicação e os serviços internos do original não foram validados.

