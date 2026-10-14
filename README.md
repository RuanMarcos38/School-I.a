# School IA · instalação local
Frontend e backend instalados e funcionando em http://localhost:3038, com SQLite, validação de mídia e biblioteca importada. A chave Higgsfield foi criada com autorização e conectada nesta instalação. A autenticação foi validada e uma recarga de US$10 foi concluída com autorização. Um card e duas vistas foram gerados pela API real e salvos na biblioteca. O vídeo de quatro segundos foi enviado, mas recusado pelo provedor (nsfw), sem resultado; a cobrança foi estornada. Saldo observado após os testes: US$9,77. Não é possível afirmar que esta implementação é um clone 100% do código ou dos serviços internos do original.

## Abrir
Nesta máquina, o serviço já foi iniciado. Para reiniciar:
```powershell
node --use-env-proxy --env-file-if-exists=.env server.mjs
```
Também é possível abrir start.cmd. Node 24 ou superior é necessário.

## O que está configurado
- Biblioteca local com 42 personagens e 123 referências, correspondentes a 123 entradas e 123 arquivos únicos observados na interface (prévia do original).
- Busca, filtros Todos / Favoritos / Biblioteca / Criados, pastas e renomeação.
- Referências próprias, edição, capa, cópia, arquivamento e restauração.
- Upload JPG / PNG / WEBP até 10 MB por imagem; MP4 / MOV / WEBM de 4–60 s e até 300 MB.
- Decodificação de imagens e validação de vídeo no servidor; duração não é aceita do navegador.
- Pipeline Genjutsu Object Swap com até 5 referências; vídeos longos são divididos em partes de até 30 s e reunidos, preservando áudio quando todas as partes o contêm.
- Criação de 1–4 opções por descrição e até 3 referências, usando o endpoint oficial GPT Image 2.5 Flare.
- Vistas: frente, perfil, 3/4 direita, costas e cabelo; as imagens geradas entram no personagem.
- Fila persistente, consulta de andamento, solicitação de cancelamento, erros e reconciliação manual de resposta incerta.
- Resultados armazenados neste computador, download local, favoritos e comparação de vídeos.
- Importador yt-dlp instalado com checksum oficial para links públicos TikTok / Instagram.
- Chaves cifradas no servidor, fora do estado devolvido ao frontend, e excluídas do GitHub.
- Modo local e modo com login, sessões HttpOnly, senha derivada com scrypt e isolamento de dados entre usuários.

## Conectar geração real
Abra Configurações → Conectar chave da API e cole a chave completa do console https://open.higgsfield.ai/api-keys. A consulta de validação não gera mídia.
A chave não deve ser enviada no chat. A sessão da escola e o saldo da assinatura não são credenciais da API.
A validação da chave consulta o catálogo Restyle. Isso confirma essa operação. Flare foi confirmado com três imagens reais; Object Swap foi acessado, mas sua geração bem-sucedida ainda precisa ser validada.
Gerações são cobradas pelo provedor. Foram executadas três gerações reais de imagem, dentro do limite autorizado de US$10.

## Instalar em outra máquina Windows
```powershell
pnpm install --frozen-lockfile
node --use-env-proxy scripts/setup.mjs
pnpm start
```
O setup instala ferramentas e cria .env local. A biblioteca importada está na pasta data desta instalação; ela não é enviada ao repositório público. O pacote de código também exclui banco, chave e arquivos pessoais.

## Backup e acesso
Faça backup de data inteira, incluindo school.sqlite, arquivos de mídia e master.key. A master.key permite ler credenciais cifradas; trate o backup como privado. Pare o serviço antes de copiar o banco ou use backup consistente de SQLite.
O modo local escuta apenas 127.0.0.1 e dispensa login porque a instalação é privada do computador.
Para habilitar o modo com login, configure LOCAL_MODE=false e PUBLIC_ORIGIN com o endereço HTTPS real atrás de um proxy TLS. O primeiro administrador usa o token local de data/setup-token.txt. A inicialização não foi publicada na internet nesta entrega.
Contas adicionais precisam de administração própria; cadastro público e recuperação de senha por email não estão implementados.

## Verificação
```powershell
pnpm test
pnpm check
```
Nove testes de integração aprovados. Eles usam arquivos reais, FFmpeg e SQLite; respostas do provedor são substituídas apenas no ambiente de testes.
No Chrome da instalação principal: upload e gravação de imagem, leitura do personagem, edição, pasta, favorito e seleção no Estúdio confirmados.
Veja VERIFICACAO.md para o escopo completo e os pontos não validados.

## Diferenças e pendências
- Flare confirmado com um card e duas vistas reais. Object Swap ainda depende do teste de vídeo de quatro segundos.
- Hospedagem pública, domínio e pagamento não configurados.
- Não há cobrança de R$49,90 nem promessa de três gerações grátis; essas regras pertencem ao negócio do original.
- A conexão da assinatura usada pelo original não foi recuperada; esta implementação usa a API oficial.
- O prompt de card desta versão foi escrito para o estilo observado e não é o prompt interno do original.
- GPT Image 2.5 Flare é a variante documentada da API; equivalência com o modelo privado rotulado GPT Image 2.5 no original não foi demonstrada.
- Imagens da biblioteca são as prévias acessíveis na página, não os arquivos originais de alta resolução.
- Importação depende de links públicos e das restrições das plataformas. O link Instagram fornecido foi importado e validado com sucesso após corrigir o filtro de duração ausente nos metadados.
- IA pode mudar identidade, áudio, movimento e continuidade entre partes. Não existe garantia de preservação perfeita.
- Créditos, preços e cobranças são do provedor; não há saldo simulado.
- Não foi recuperado o código-fonte ou backend da escola.

## Fontes oficiais
- https://open.higgsfield.ai/quick-start
- https://open.higgsfield.ai/models/higgsfield/genjutsu/object-swap/v1.0/playground
- https://open.higgsfield.ai/models/marketing-studio/image/flare/api-reference
- https://docs.higgsfield.ai/docs/llms.txt




