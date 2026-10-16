# Fields IA no EasyPanel

Destino: projeto r2rmarketingdigital, serviço fieldsia.
Domínio: https://fieldsia.r2rmarketingdigital.com.br

Use o Dockerfile da raiz, porta interna 3038 e volume nomeado em /app/data.
O volume mantém banco, mídias, sessões e chave de cifra entre implantações.

Ambiente necessário:
```
PORT=3038
LOCAL_MODE=false
PUBLIC_ORIGIN=https://fieldsia.r2rmarketingdigital.com.br
DATA_DIR=/app/data
YTDLP_PATH=/usr/local/bin/yt-dlp
```

A primeira conta é criada pelo proprietário no formulário de configuração, com o token privado de /app/data/setup-token.txt. Nunca publique esse token nem a chave da API no repositório. Conecte o provedor apenas após configurar o proprietário e confirmar o HTTPS.

O DNS do subdomínio fieldsia deve apontar para o servidor EasyPanel 2.25.155.142. A configuração de domínio do serviço encaminha para a porta 3038.

Implantação automática aplica alterações enviadas à branch configurada no EasyPanel. Os dados ficam no volume, não na imagem. Mantenha uma única réplica por usar SQLite.

MCP e API usam conexões e saldos distintos. O conector deste chat não é uma credencial reutilizável pelo servidor. Uma integração MCP de produção exige autenticação própria autorizada pelo proprietário. A cotação MCP observada foi 2,75 créditos para uma imagem Flare high 2K; economia em relação à API não foi demonstrada.
