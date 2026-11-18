# ComfyUI Deadline Plugin

[English](README.md) | **Português (Brasil)**

Envie jobs do ComfyUI para o Thinkbox Deadline de dentro do próprio ComfyUI.
Veja também https://github.com/doubletwisted/ComfyUI-Deadline-Distributed

> **Fork não oficial.** Este é um fork de [doubletwisted/ComfyUI-Deadline-Plugin](https://github.com/doubletwisted/ComfyUI-Deadline-Plugin) (MIT), baseado na versão 1.1.2. Não tem vínculo nem aval do autor original nem da Thinkbox/AWS. Tudo o que vem depois da seção "Mudanças neste fork" é a documentação do upstream, traduzida. Em caso de dúvida, vale o [README em inglês](README.md).

## Mudanças neste fork

Três adições ao node `Submit to Deadline`. Todas as entradas novas são opcionais e ficam depois das existentes, então os workflows já salvos continuam funcionando.

- **`batch_name`**: grava `BatchName` no job info, de modo que jobs com o mesmo nome ficam agrupados no Deadline Monitor.
- **`job_dependencies`**: IDs de job do Deadline separados por vírgula (24 caracteres hexadecimais cada), gravados como `JobDependencies`. O job fica Pending até esses jobs terminarem. Valores com quebra de linha ou IDs malformados são rejeitados. Isso só define a **ordem** dos jobs: os arquivos gerados por um job não são repassados ao próximo automaticamente. Copie qualquer saída que um job posterior leia como entrada para a pasta `input` do ComfyUI antes de enviar esse job.
- **Seletor de workers para `machine_list`**: um botão **Select workers...** abaixo do campo abre uma lista de seleção com os Workers da farm (lidos com `deadlinecommand -GetSlaveNames`, por meio de uma nova rota `/deadline/workers`) e grava a lista separada por vírgula em `machine_list`. No envio, cada nome é conferido com a farm (sem diferenciar maiúsculas de minúsculas), e um nome desconhecido, como um erro de digitação, faz o envio falhar antes de o job ser criado. Se não for possível consultar o Deadline, a checagem é ignorada com uma mensagem no log e a lista é enviada como foi digitada.

Depois de atualizar o node, recarregue o navegador (Ctrl+F5) para o seletor aparecer. O plugin do repositório do Deadline em `plugins/ComfyUI` não foi alterado em relação ao upstream.

Testes: `tests/test_security.py` cobre as entradas novas e a checagem de workers.

Demonstração rápida (upstream):

<p align="center">
  <a href="https://youtu.be/NFmIvEoEPiU">
    <img src="https://img.youtube.com/vi/NFmIvEoEPiU/maxresdefault.jpg" alt="Demonstração ComfyUI x Deadline" />
  </a>
</p>

Este plugin adiciona dois nodes:

- `Submit to Deadline` envia o workflow atual para a farm.
- `DeadlineSeed` dá a cada variação do Deadline uma seed previsível.

O node de envio não renderiza o workflow localmente. Ele só empacota o job e o envia ao Deadline.

## Instalação

Clone isto em `ComfyUI/custom_nodes`:

```bash
git clone https://github.com/fernandodiasmatias/ComfyUI-Deadline-Plugin.git
```

Reinicie o ComfyUI.

Depois, instale o plugin no Deadline:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\deploy_deadline_plugin.ps1
```

O script de deploy pergunta ao Deadline onde fica o repositório, executando `deadlinecommand -GetRepositoryPath`, e copia `plugins/ComfyUI` para `custom/plugins/ComfyUI`.

Também dá para indicar o repositório manualmente:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\deploy_deadline_plugin.ps1 -RepositoryPath "\\YOUR-SERVER\Repository\custom\plugins"
```

No Deadline Monitor, configure `ComfyUI Installation Paths` no plugin ComfyUI. Coloque uma raiz de ComfyUI portable por linha:

```text
C:\ComfyUI_windows_portable
D:\Apps\ComfyUI
\\YOUR-SERVER\software\ComfyUI
```

Os workers tentam esses caminhos em ordem e usam o primeiro que contiver `ComfyUI\main.py` e `python_embeded\python.exe`.

### Outras instalações do ComfyUI (Stability Matrix, venv, conda)

Se o ComfyUI não roda a partir do `python_embeded` da versão portable, defina **ComfyUI Python Executable** nas mesmas configurações do plugin. Deixe vazio para continuar usando `python_embeded\python.exe`. Um caminho relativo é resolvido a partir de cada caminho de instalação; um caminho absoluto é usado como está. Os workers continuam executando `<caminho de instalação>\ComfyUI\main.py`, então os módulos do próprio ComfyUI são carregados dessa pasta, e o Python configurado só precisa ter os requisitos do ComfyUI (torch etc.) instalados.

Para o Stability Matrix, em que o ComfyUI fica em `Data\Packages\ComfyUI` com seu próprio `venv`:

```text
ComfyUI Installation Paths:  C:\StabilityMatrix\Data\Packages
ComfyUI Python Executable:   ComfyUI\venv\Scripts\python.exe
```

O `python_embeded` da versão portable ignora `PYTHONPATH` (o arquivo `._pth` o coloca em modo isolado), então apontá-lo para os pacotes de outra instalação não funciona; configure o Python da própria instalação. Um Python configurado respeita o `PYTHONPATH` do worker.

Antes de atualizar, confira que **ComfyUI Python Executable** está vazio, a menos que você queira defini-lo. Quando a configuração existe, todo job usa o valor que ela tiver, e um caminho errado faz a task falhar em vez de voltar ao `python_embeded`.

## Reutilizando a sessão gráfica de um worker

Defina estas chaves de extra info do worker no Deadline para cada worker ComfyUI: `ComfyUIApiUrl` (por exemplo `http://127.0.0.1:8188`) e `ComfyUILaunchGpuUuid` (um UUID `GPU-...` da NVIDIA). O endpoint local configurado é verificado antes de um job colocar o próprio prompt na fila atrás do trabalho já existente na interface. A verificação dá preferência à resposta de identidade `/deadline/session` do plugin e à raiz do ComfyUI correspondente; para uma sessão mais antiga já em execução, a propriedade da porta no Windows, o caminho do executável, o PID e a linha de comando precisam corresponder à instalação configurada. Essa verificação de sessão antiga exige o `python_embeded` portable; com **ComfyUI Python Executable** definido, só é reutilizada uma sessão que responda a `/deadline/session` (esta versão do plugin ou posterior, naquele ComfyUI). Um serviço não relacionado que por acaso use a porta nunca é reutilizado. O Deadline acompanha apenas esse prompt e nunca encerra o backend da interface. Se o endpoint não existir, o plano alternativo inicia na porta configurada e resolve o UUID da NVIDIA configurado. Um endpoint ocupado e não verificado faz a task falhar. A configuração JSON mais antiga `Per-Worker ComfyUI Endpoints` continua como alternativa para configurações existentes.

Para um endpoint reutilizado e verificado, as entradas da task são copiadas para uma subárvore isolada `input/deadline/<submission-id>` e as saídas registradas são copiadas para o diretório de saída do job.

## Vários workers em uma máquina

Jobs de render normais usam uma porta fixa por dispositivo CUDA: `ComfyUIPort + 100 * índice da GPU`, com base padrão `8188`. A GPU 0 usa `8188`, a GPU 1 usa `8288` e a GPU 2 usa `8388`. Configure um worker/task ativo por GPU e ative a afinidade de GPU do Deadline de cada worker para a GPU atribuída. Se uma porta estiver ocupada, a task falha com um erro claro, em vez de trocar de porta. A verificação de porta apenas abre um socket temporário; não cria pasta de lock nem exige acesso de escrita a `ProgramData`.

Cada nova execução recebe um `--database-url` único no diretório temporário da task do Deadline, evitando o lock compartilhado de `ComfyUI/user/comfyui.db`. O envio do workflow só começa depois que o ComfyUI confirma que a porta escolhida passou a escutar. Depois de instalar uma atualização, reinicie os workers quando estiverem ociosos para limpar as cópias do plugin em cache.

## Como usar

Adicione `Submit to Deadline` ao seu workflow, informe um `output_directory` completo, como `X:\outputs\shot010`, e execute. O caminho é verificado contra os locais de armazenamento permitidos pelo administrador antes de copiar arquivos ou enviar o job. Entradas normais enviadas por upload não exigem configuração extra.

### Armazenamento da farm (administrador, uma vez por farm)

No Deadline Monitor, abra **Tools > Configure Plugins > ComfyUI**:

Defina **Allowed Storage Locations** com os discos ou pastas que os usuários podem ler e gravar. Informe um local por linha:

```text
X:\*
Y:\*
G:\*
\\server\share\projects\*
```

`X:\*` libera o disco X inteiro; `X:\projects\*` limita o acesso a essa pasta e a todas as subpastas. Caminhos absolutos de pasta simples também funcionam. Só há suporte a `\*` no final; padrões como `X:\project*\renders` são rejeitados.

A lista vem vazia por padrão, então os jobs só podem usar o Default Output Directory e as pastas locais de entrada e saída do ComfyUI até você adicionar locais. Para liberar parte de um disco, liste só essas pastas, por exemplo `X:\input\*` e `X:\outputs\*`; as demais pastas de X: continuam bloqueadas. Para um disco mapeado, adicione também a regra UNC correspondente, como `\\fileserver\comfy\outputs\*`.

Tanto caminhos mapeados quanto UNC podem ser informados. No envio, caminhos de rede mapeados são convertidos para o local UNC atual, validados e gravados no job como caminhos UNC. Entradas UNC funcionam diretamente, então os workers não precisam das mesmas letras de disco para as entradas e saídas copiadas por este plugin. Caminhos de disco local continuam locais. Se outro node mantiver um caminho com letra de disco que não foi copiado, esse node ainda precisa do disco mapeado nos workers. Os serviços do Deadline podem ter mapeamentos de disco diferentes dos usuários interativos; veja a [documentação de discos mapeados do Deadline](https://docs.thinkboxsoftware.com/products/deadline/10.4/1_User%20Manual/manual/repository-config.html#mapped-drives).

Quem envia e os workers leem essa política automaticamente do Deadline. Não são necessárias variáveis de ambiente, JSON nem configuração por artista. Os usuários continuam informando caminhos completos; caminhos fora do armazenamento permitido são rejeitados. A configuração existente **Default Output Directory** e as pastas locais de entrada e saída do ComfyUI já são permitidas. Configure o armazenamento antes de instalar a 1.1, inclusive para jobs que já estão na fila.

Use `batch_count` para definir quantas variações você quer. Use `chunk_size` para definir quantas variações uma task do Deadline processa antes de terminar. São variações, não frames de animação.

Se você quer que as seeds mudem a cada variação, use `DeadlineSeed`. Uma seed base `1000` vira:

```text
variation 0 -> 1000
variation 1 -> 1001
variation 2 -> 1002
```

## Arquivos de entrada

Os nodes carregadores normais do ComfyUI copiam arquivos colados ou enviados por upload para `ComfyUI/input`. Essa pasta normalmente só existe na máquina em que você enviou o job, então o plugin copia esses arquivos referenciados para dentro da sua pasta de saída aprovada:

```text
<output directory>\.deadline-inputs\<submission id>\
```

Os workers iniciam o ComfyUI com a pasta dessa submissão como `--input-directory`, de modo que a varredura de metadados dos carregadores lê apenas as entradas dela, e não o arquivo compartilhado de entradas. Jobs existentes mantêm o diretório de entrada original.

Só são copiados os arquivos usados pelo prompt enviado. Isso inclui os carregadores de arquivo nativos e os nodes `VHS_LoadVideo`, `VHS_LoadVideoFFmpeg` e `VHS_LoadAudioUpload` do VideoHelperSuite. Os nodes de caminho do VideoHelperSuite (`VHS_LoadVideoPath`, `VHS_LoadVideoFFmpegPath`, `VHS_LoadImagePath` e `VHS_LoadAudio`) também são aceitos quando apontam para um arquivo de mídia existente dentro de uma raiz de entrada aprovada; o prompt enviado é reescrito para o arquivo copiado, visível na farm. Se um arquivo já existe e é idêntico, ele é reutilizado. Se o nome colide com um arquivo diferente, o plugin dá à cópia um sufixo único.

Carregadores de diretório, incluindo `VHS_LoadImagesPath`, não são copiados. Caminhos absolutos de nodes sem suporte são deixados como estão e já precisam ser válidos na farm.

## Limites de segurança

Os metadados do job não podem conter linhas extras do arquivo de job do Deadline. Os caminhos de armazenamento rejeitam travessia de diretório, caminhos de dispositivo do Windows, fluxos de dados alternativos e links simbólicos ou junctions que escapem das raízes aprovadas. As chamadas de API usam HTTP em loopback, com proxies e redirecionamentos desativados. As sessões reutilizadas executam um script simples `reuse_waiter.py`; não é usado nenhum lançador `exec` codificado.

O plugin envia workflows do ComfyUI; ele não isola outros custom nodes nem quem cria jobs no Deadline. Instale nodes confiáveis e mantenha o Deadline, o ComfyUI e o armazenamento aprovado graváveis apenas por usuários confiáveis. As chamadas de subprocesso em tempo de execução são necessárias para invocar o cliente do Deadline instalado e os utilitários do worker; elas usam listas de argumentos, sem shell.

O status de segurança no Registry é atribuído pelo Comfy Registry. Cada versão publicada exige sua própria varredura/revisão; atualizar o plugin não muda o status de versões antigas imutáveis. Veja os [padrões de segurança do Registry](https://docs.comfy.org/registry/standards).

## Metadados do workflow

O Deadline recebe os dois arquivos:

- `prompt_to_execute.json` é o prompt no formato de API que o worker renderiza.
- `workflow.json` é o workflow normal do ComfyUI, com as posições dos nodes.

O worker grava os metadados normais do workflow de volta na imagem de saída quando o ComfyUI os fornece. Assim, arrastar a imagem pronta de volta para o ComfyUI deve reabrir o grafo legível, e não o grafo feio no formato de API.

## Verificação prévia para execução sem interface (headless)

Cada variação é verificada no worker do Deadline selecionado depois da cópia das entradas, da expansão das seeds e da resolução dos switches fixos. O worker:

- valida cada `class_type` usando o endpoint `/object_info/<class_type>` daquele worker, pedindo apenas os tipos de node presentes no workflow;
- rejeita entradas copiadas ausentes e nodes interativos de navegador conhecidos;
- resolve seleções fixas a partir de valores literais ou de nodes primitivos seguros e depois remove os nodes de passagem `ImpactSwitch`, `LatentSwitch` e `SEGSSwitch`, religando os consumidores à entrada selecionada a montante;
- envia o `extra_pnginfo.workflow` completo enviado aos nodes que usam metadados;
- verifica se o histórico do ComfyUI informa os nodes de saída esperados e se todos os arquivos informados existem;
- permite o prompt de controle exato `DeadlineWorkerRegistration` quando os modos worker e distributed estão ativados; esse prompt termina pelo histórico e intencionalmente não produz arquivo;
- transforma erros de validação do prompt, exceções de execução, saídas antecipadas do processo, timeouts de HTTP, saída ausente e timeouts de task do Deadline em falhas da task.

Seleções de switches dinâmicos são aceitas quando o seletor é controlado por um node de valor fixo seguro, como `PrimitiveInt`; a ramificação escolhida é resolvida durante o envio. Seletores controlados por nodes de runtime ou interativos são rejeitados, pois um render na farm não tem ninguém para responder. Os nodes de escolha, seleção e ponte de preview controlados pelo navegador (`FL_ImagePicker`, `easy imageChooser`, `ImageChooser`, `PreviewChooser`, `PreviewBridge` e `ImpactPreviewBridge`) são rejeitados pelo mesmo motivo. Outros nodes que usam `PROMPT`, `DYNPROMPT`, `UNIQUE_ID` ou `EXTRA_PNGINFO` continuam com suporte quando o worker tem o node e o envio inclui os metadados completos do workflow. Nodes interativos de terceiros desconhecidos não podem ser identificados apenas por `/object_info`; adicione o `class_type` exato deles a `KNOWN_UI_DEPENDENT_NODE_TYPES` depois de confirmar que esperam pelo estado da interface.

## Scripts de manutenção

Há modelos higienizados de jobs de manutenção do Deadline em `scripts/maintenance`.

Copie-os para um local acessível aos seus workers, edite os caminhos padrão e envie os jobs de sincronização com:

```powershell
python \\YOUR-SERVER\share\scripts\maintenance\submit_comfy_sync.py --type both
```

Também dá para executar só um dos lados:

```powershell
python \\YOUR-SERVER\share\scripts\maintenance\submit_comfy_sync.py --type installation
python \\YOUR-SERVER\share\scripts\maintenance\submit_comfy_sync.py --type models
```

## Observações

- O alvo são workers Windows com ComfyUI portable.
- O Deadline cuida dos timeouts de render. Configure-os no Deadline Monitor.
- `/deadline/session` serve só para identidade e é usado para provar a propriedade do endpoint. O `ComfyUI-Deadline-Distributed` continua dono das suas rotas de execução.

Execute todos os testes de regressão com `python -m unittest discover -s tests -v`.
