# Contas Higgsfield

Em Configurações → Contas Higgsfield, escolha a conta da API e a conta MCP separadamente.

API: Adicionar conta API → informe um nome e a chave da conta desejada → Conectar e validar. Só é ativada depois da validação. A conta anterior permanece salva e pode ser escolhida no seletor.

MCP: Adicionar ou trocar conta MCP → informe um nome → prossiga para a autorização. Antes de confirmar no Higgsfield, entre na conta desejada naquele serviço e confira a conta apresentada. O site não pode escolher uma conta que você ainda não autorizou. A autorização anterior fica disponível até concluir a nova. É possível cancelar a autorização pendente nas Configurações.

As conexões existentes são preservadas como Conta atual. Os nomes são definidos pelo usuário e não constituem identificação verificada de email. As credenciais ficam cifradas no backend, sem aparecer no estado enviado ao navegador. Cada usuário vê somente suas conexões.

Trocas ficam bloqueadas enquanto houver solicitações pendentes, incluindo montagem e estado incerto. Ao trocar MCP, as estimativas anteriores são invalidadas: estime novamente antes de gerar. API e MCP podem ter saldos diferentes.

Desconectar pausa o uso daquela conexão e preserva as contas, chaves e tokens cifrados. Selecione uma conta salva para reconectar. Nenhuma chave é revogada ou removida no provedor. Autorizações expiradas ou revogadas no próprio Higgsfield podem precisar de nova autorização.

Validação: 33 testes automatizados aprovados, incluindo seleção API, captura de tokens MCP renovados, isolamento por usuário, cancelamento de autorização e bloqueio da troca durante solicitações pendentes. Não foi autorizada uma segunda conta real nem iniciada geração paga nesta alteração.
