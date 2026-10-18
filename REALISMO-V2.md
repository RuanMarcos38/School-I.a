# Diretriz referência-primeiro para realismo (v2)

Esta mudança acrescenta à orientação já existente uma prioridade explícita à **fotografia de referência do personagem** e ao **vídeo original como fonte de movimento e cenário**. O realismo agora é a orientação padrão para cards, vistas e Object Swap da API e MCP; não altera o modelo Higgsfield, os custos, os arquivos, o banco, as credenciais, os parâmetros de envio ou as contas.

- **Identidade:** preservar traços singulares (nariz, olhos, dentes, cabelo, pele, corpo), assimetrias e detalhes da imagem sem embelezamento nem padronização. Características incomuns da foto são intencionais, não defeitos a corrigir.
- **Vídeo:** trocar somente o indivíduo especificado pelo prompt da cena. Manter coreografia, tempo, câmera, cenário, outras pessoas, áudio e composição originais quando o provedor suportar.
- **Roupa:** manter roupas e acessórios da fotografia de referência, exceto quando o usuário solicitar explicitamente outra vestimenta.
- **Prompt personalizado:** a descrição salva do personagem passa a seguir junto do prompt da cena, não somente quando a cena está vazia.
- **Limite:** continua a validação antes de gerar (10.000 caracteres no Genjutsu); o campo de edição não corta texto automaticamente e o contador contabiliza a descrição inserida. A foto continua sendo a fonte visual prioritária.
- **Reversão:** HUMAN_REALISM_ENABLED=false restaura a composição anterior do prompt; não exige migração de dados.

Validação de código: testes unitários de identidade, cenário, textos extensos, contador e desativação. Ainda é necessário realizar uma geração REAL autorizada e comparar quadros, áudio e fidelidade visual antes de declarar qualidade final; prompts não garantem resultado perfeito e podem consumir créditos.
