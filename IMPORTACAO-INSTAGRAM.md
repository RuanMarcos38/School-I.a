# Importação autenticada temporária

O backend aceita somente sessionid, csrftoken e ds_user_id da conta Instagram, com origem do POST validada e sessão Fields IA obrigatória. Nenhum cookie é salvo no banco. Durante o download, o arquivo privado fica em /dev/shm no Linux (memória, fora do volume). É removido no sucesso ou falha; o download tem timeout de três minutos. No Windows de desenvolvimento é usado o diretório temporário do usuário.

A extensão não mantém permissões cookies/scripting por padrão. Solicita acesso opcional somente após clicar Autorizar e importar uma vez. Remove as permissões no finally; um alarme remove o acesso em até três minutos se a janela fechar. A extensão também revoga no início do Chrome. Não lê cookies de outros sites e não usa getAll.

O arquivo de vídeo é salvo na conta que o importou. O mesmo link /p ou /reel reutiliza o arquivo dessa conta, sem nova sessão; consultas ignoram parâmetros de rastreamento. Outros usuários não têm acesso a esse cache.

Não há assinatura ou serviço pago novo. A instalação local é feita pelo usuário. O teste real com o link DeBwwYiIO-F depende da sessão autorizada ser enviada pela extensão; testes simulados não comprovam que o Instagram aceitará a sessão no IP do servidor.

Reversão: voltar ao commit 508f2ba7e31af31b9830322555fc25af2030e7bf no serviço fieldsia. Não remover o volume. A tabela imported_links pode permanecer sem uso. Remover a extensão no Chrome revoga seu acesso.
