# Brainstorm de Design - Maio Amarelo: Travessia Segura

## Contexto
Jogo arcade infinito estilo Crossy Road para campanha corporativa de segurança no trânsito (Maio Amarelo). Deve ser leve, rápido, intuitivo e jogável em poucos minutos.

---

<response>
<text>
## Ideia 1: "Retro Pixel Traffic"

**Design Movement**: Pixel Art Retro com influência de jogos 8-bit dos anos 80

**Core Principles**:
- Nostalgia visual com pixels grandes e definidos
- Paleta limitada e contrastante (amarelo, preto, cinza, verde)
- Simplicidade gráfica que prioriza legibilidade
- Animações frame-by-frame discretas

**Color Philosophy**: Amarelo vibrante (#FFD700) como cor dominante representando o Maio Amarelo, contrastando com asfalto cinza escuro e vegetação verde pixelada. O amarelo transmite alerta e atenção.

**Layout Paradigm**: Canvas centralizado com HUD minimalista no topo. Tela dividida em faixas horizontais (calçada/rua/calçada).

**Signature Elements**:
- Personagem pixelado de 16x16
- Veículos em blocos retangulares com 3-4 cores
- Faixa de pedestres com padrão zebrado pixelado

**Interaction Philosophy**: Movimento discreto tile-by-tile, cada input move exatamente uma posição.

**Animation**: Sprites com 2-3 frames de animação, transições instantâneas.

**Typography System**: Fonte monospace pixelada (Press Start 2P ou similar).
</text>
<probability>0.06</probability>
</response>

<response>
<text>
## Ideia 2: "Urban Voxel Pop"

**Design Movement**: Voxel Art Contemporâneo com estética low-poly colorida (inspirado diretamente em Crossy Road)

**Core Principles**:
- Blocos 3D simplificados com perspectiva isométrica simulada
- Cores saturadas e alegres que convidam à interação
- Clareza visual absoluta - cada elemento é imediatamente reconhecível
- Sensação de profundidade sem complexidade real

**Color Philosophy**: Base em amarelo-dourado (#F5A623) e tons quentes para o cenário urbano. Asfalto em cinza médio (#4A4A4A), calçadas em bege claro, vegetação em verde vivo. Veículos em cores primárias vibrantes (vermelho, azul, branco) para contraste máximo com o fundo.

**Layout Paradigm**: Canvas com perspectiva top-down levemente inclinada. O mundo rola verticalmente enquanto o jogador avança. Interface limpa com score flutuante.

**Signature Elements**:
- Personagem como bloco 3D simplificado com sombra projetada
- Veículos com aparência de "brinquedo" (formas geométricas simples)
- Semáforos e placas como elementos decorativos reconhecíveis

**Interaction Philosophy**: Movimento hop-by-hop com pequena animação de salto. Resposta tátil imediata. Controles intuitivos tanto em teclado quanto touch.

**Animation**: 
- Hop suave do personagem (ease-out de 150ms)
- Veículos deslizam continuamente
- Leve bounce ao pousar
- Tela treme sutilmente na colisão
- Fade-in progressivo de novas fileiras

**Typography System**: Fonte bold arredondada (Nunito Black) para scores e títulos, com sombra sutil para legibilidade sobre o cenário.
</text>
<probability>0.08</probability>
</response>

<response>
<text>
## Ideia 3: "Flat Neon Safety"

**Design Movement**: Flat Design com acentos neon e influência de sinalização viária real

**Core Principles**:
- Formas absolutamente planas sem sombras
- Contraste extremo entre elementos e fundo
- Iconografia baseada em sinalização real de trânsito
- Minimalismo funcional

**Color Philosophy**: Fundo escuro (quase preto) com elementos em amarelo neon brilhante e branco. Veículos em tons de vermelho e laranja neon. Inspirado em sinalização noturna reflexiva.

**Layout Paradigm**: Canvas escuro com grid visível de linhas tracejadas representando faixas. Estética de "planta baixa" de engenharia de tráfego.

**Signature Elements**:
- Personagem como ícone de pedestre estilizado (similar a placas de trânsito)
- Veículos como silhuetas geométricas com contorno neon
- Faixas de pedestres brilhantes

**Interaction Philosophy**: Movimento fluido e contínuo, sem grid fixo. Sensação de urgência.

**Animation**: Trails de luz nos veículos, pulso nos elementos de sinalização.

**Typography System**: Fonte condensada industrial (Oswald ou similar) em caixa alta.
</text>
<probability>0.04</probability>
</response>

---

## Decisão Final

**Escolha: Ideia 2 - "Urban Voxel Pop"**

Esta abordagem é a mais alinhada com o briefing (estilo Crossy Road), oferece a melhor jogabilidade visual, é amigável para o contexto corporativo e mantém o equilíbrio entre diversão e profissionalismo. A estética colorida e alegre incentiva o engajamento sem ser infantil.
