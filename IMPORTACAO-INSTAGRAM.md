# Instagram conectado — configuração única

O assistente 1.1.0 oferece a opção explícita **Manter conectado neste Chrome**. O Chrome guarda a autorização, e a extensão armazena apenas a preferência booleana keepConnected. Ao reabrir o navegador, o acesso continua autorizado. **Desconectar Instagram** revoga as permissões opcionais. O modo avulso mantém a revogação após a importação, o alarme de três minutos e a limpeza no início do Chrome.

Após instalar/atualizar, autorizar uma vez e recarregar o Fields IA, o botão Baixar do Estúdio funciona diretamente. A indicação Instagram pronto neste Chrome confirma a detecção. É necessário estar conectado ao Instagram no mesmo perfil; sessões expiradas exigem novo login no Instagram, sem reinstalação.

O content script é restrito a https://fieldsia.r2rmarketingdigital.com.br e roda em mundo isolado. Só inicia downloads em cliques reais no botão Baixar com link Instagram válido. Consulta primeiro o importador/cache por conta. Se necessário, solicita ao worker somente sessionid, csrftoken e ds_user_id e envia à rota existente de importação autenticada. Os cookies não são expostos à página nem gravados no armazenamento da extensão. O worker valida a extensão remetente, a origem Fields IA, o frame principal e o formato do link. Páginas externas não recebem sessões.

O backend e suas credenciais permanecem inalterados: sessão Fields IA obrigatória, origem do POST validada, sessão temporária em memória no Linux, limpeza em sucesso ou falha e cache de vídeos por conta. Nenhum cookie é salvo no banco.

Instalação/atualização: extrair o ZIP completo, carregar/recarregar a pasta em chrome://extensions, abrir o assistente, escolher Manter conectado neste Chrome e autorizar os acessos. Recarregar o Fields IA. Não abrir popup.html como arquivo local.

Validação automatizada cobre persistência, desconexão, acesso negado, remetentes inválidos, sessão expirada, cliques sintéticos e cache sem leitura de cookies. Importação real depende de instalação no perfil e de o Instagram aceitar a sessão no IP do servidor.

Reversão: voltar ao commit f18dd9d65fbedb762517bbdf737a94477ffec9f4 e recarregar o pacote anterior da extensão. Não remover /app/data nem alterar variáveis ou credenciais.
