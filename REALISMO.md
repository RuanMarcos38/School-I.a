# Realismo: parâmetros verificados e critério de aceitação
O realismo é requisito central. Não foi demonstrada equivalência visual com o sistema original.

## Verificado
- O original exibe GPT Image 2.5 para criar personagem e Genjutsu para troca em vídeo.
- O catálogo autenticado do conector Higgsfield contém gpt_image_2_5, com variantes Flare e Sunburst.
- A página oficial da variante Flare identifica o modelo como GPT Image 2.5.
- O backend usa marketing-studio/image/flare, quality high, resolução 2k e proporção 3:4.
- O backend não aplica preset publicitário: enhance_prompt=false.
- O card escolhido vira referência persistente; vistas são geradas usando referências do personagem salvo.
- Genjutsu usa resolução 1080p e até cinco referências.
- A biblioteca importada contém prévias visíveis, não arquivos originais em alta resolução.

## O que não está demonstrado
O navegador não revelou o prompt ou o processamento interno do servidor da escola. O texto mostrado em “Prompt final” correspondeu à descrição inserida. Não há evidência suficiente para afirmar que esse seja o prompt completo enviado ao modelo.
Não foram demonstrados variante, qualidade, resolução e possíveis etapas adicionais usadas no backend original. O rótulo “GPT Image 2.5” por si só não estabelece a equivalência desse processo.

## Teste real obrigatório antes de declarar equivalência
1. Criar um personagem com a mesma descrição e referências nos dois sistemas.
2. Comparar rosto, textura de pele, cabelo, roupa, proporção corporal, luz e acabamento; verificar se há aparência de desenho, plástico ou pele artificial.
3. Salvar o card escolhido e gerar frente, perfil e 3/4. Comparar identidade, cabelo, roupa e cores entre vistas.
4. Gerar um vídeo curto com o mesmo vídeo base e personagem. Conferir rosto ao longo do movimento, mãos, articulações, tecido, fundo, luz, câmera e áudio.
5. Examinar continuidade entre partes antes de aprovar vídeos longos.
6. Guardar parâmetros, referências e resultados usados na comparação. Alterar parâmetros só a partir da diferença observada.

A recarga de US$10 foi autorizada e concluída. Um card e duas vistas (perfil e costas) foram gerados e examinados. Pele, cabelo, tecido e anatomia apresentam aparência fotográfica; cabelo, roupa e cores se mantêm nas três referências. A inspeção visual não demonstra identidade perfeita nem equivalência ao original. Vídeo com movimento e comparação com o mesmo prompt no original continuam pendentes.


O teste de vídeo autorizado foi recusado pelo filtro do provedor (nsfw), sem resultado. A cobrança foi estornada. Não é possível avaliar identidade em movimento, áudio ou cenário a partir desse teste.


O tamanho mínimo de entrada do Genjutsu é validado antes do envio pago: 409.600 pixels por quadro, conforme a documentação oficial. Os testes de geração usam arquivos reais que atendem a esse requisito.

