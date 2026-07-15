# Modelos 3D

Coloque aqui o arquivo `character.glb` do personagem principal.

Enquanto este arquivo não existir, a app usa um **boneco procedural** (cápsula candy com braços/pernas oscilando) como fallback. Assim que o `character.glb` aparecer neste diretório, a app detecta e substitui automaticamente na próxima vez que entrar no modo cinema.

## Como obter (Mixamo — grátis, uso comercial permitido)

1. Vá em https://www.mixamo.com e faça login com uma conta Adobe (gratuita).
2. **Escolha um personagem** na aba _Characters_ (recomendação: `Y Bot`, `X Bot`, `Ch14_nonPBR` ou qualquer humanóide estilizado).
3. **Escolha a animação _Walking_** na aba _Animations_:
   - Marque a opção **"In Place"** (o personagem anda no lugar — essencial, senão ele "desliza" no mapa).
   - Ajuste a velocidade se quiser.
4. Clique em **Download**:
   - Format: **FBX Binary (.fbx)**
   - Skin: **With Skin** (para incluir o mesh, não só o esqueleto)
   - Frames per Second: `30` (ou `60` se preferir)
   - Keyframe Reduction: `none`
5. Você agora tem um `.fbx`. Precisamos converter para `.glb` (formato nativo do Three.js).

### Converter FBX → GLB

**Opção A — Online (mais rápido para 1 arquivo):**

- https://products.aspose.app/3d/conversion/fbx-to-glb
- Faça upload do FBX, baixe o GLB resultante.

**Opção B — CLI (npx, sem instalar nada):**

```bash
npx -y fbx2gltf character.fbx --binary -o character
# gera character.glb
```

**Opção C — Blender (mais controle, ideal se for combinar múltiplas animações):**

1. Abrir o FBX no Blender (File → Import → FBX).
2. File → Export → glTF 2.0 → escolher **.glb** binary.

### Instalar

Renomeie o arquivo final para `character.glb` e coloque neste diretório:

```
apps/web/public/models/character.glb
```

Depois disso: entre no modo cinema (clique em "Assistir viagem em 3D") — a próxima entrada carrega o modelo Mixamo. Se você já estava no cinema, saia e entre de novo.

## Verificar se carregou

Abra o DevTools (F12) → aba _Network_ → filtre por `character.glb` — deve aparecer com status 200 e algum tamanho (~1-5 MB). Se aparecer 404, o arquivo ainda não está no lugar certo.

## Problemas comuns

### O boneco aparece em T-pose e não anima

O arquivo foi baixado **sem skinning** (opção errada no Mixamo). Sintomas ao inspecionar o `.glb`:

- `skins: 0`
- meshes sem `JOINTS_0` / `WEIGHTS_0`

**Solução:** baixe novamente com **Skin: With Skin** e substitua o arquivo.

### O boneco não aparece de jeito nenhum

1. Confirme que entrou no **modo cinema** ("Assistir viagem em 3D").
2. No console, procure `[DocitoMapas][character] 1º render` — se não aparecer, a rota ainda não foi posicionada.
3. Se aparecer um **ponto rosa 2D** mas nada 3D, recarregue a página (Ctrl+R) após colocar o `.glb`.

### Erro no console: `Expected value to be of type number, but found null instead`

Esse aviso vem do **estilo de mapa OpenFreeMap** (tiles vetoriais com propriedades nulas) — não impede o boneco de renderizar. Se incomodar, ignore ou use o fallback raster (a app troca automaticamente se o estilo falhar).

## Licença

Modelos do Mixamo são gratuitos para uso comercial e pessoal (termos da Adobe). Documente a origem nos créditos do produto:

> Modelo 3D: Mixamo (Adobe). https://www.mixamo.com
