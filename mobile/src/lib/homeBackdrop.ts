// Geometria do fundo da Home e do ecrã de bloqueio (LionBackdrop), em função do tamanho do ecrã.
// Regras (Martim, 20/11): verde limpo em cima, leão e anéis mais abaixo, sem arestas em nenhum telemóvel.
// O leão alinha-se pelo fundo e pelo olho; os anéis seguem o olho; o véu verde tapa sempre a aresta de cima da imagem.
import { layout } from '@/theme/tokens';

export type HomeBackdropLayout = {
  /** Caixa da imagem do leão, em pontos. */
  lion: { left: number; top: number; width: number; height: number };
  /** Quadrado dos anéis, em pontos. */
  rings: { left: number; top: number; size: number };
  /** Véu verde, em frações da altura: opaco até `solidTo`, a esbater até `fadeTo`. */
  veil: { solidTo: number; fadeTo: number };
  /** Altura do esbatido escuro de baixo, em pontos. */
  fadeHeight: number;
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function homeBackdropLayout(width: number, height: number): HomeBackdropLayout {
  const t = layout.homeBackdrop;
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  const lionWidth = Math.max(Math.min(t.lionWidth * w, t.lionMaxHeight * h * t.lionAspect), t.lionMinWidth * w);
  const lionHeight = lionWidth / t.lionAspect;
  const lionTop = h - lionHeight + t.lionOverflow * lionHeight;
  const lionLeft = t.eyeX * w - t.eyeImageX * lionWidth;
  const eyeY = lionTop + t.eyeImageY * lionHeight;
  const ringsSize = t.ringsWidth * w;
  const solidTo = h > 0 ? clamp01((lionTop + t.veilSolidTo * lionHeight) / h) : 0;
  const fadeTo = h > 0 ? clamp01((lionTop + t.veilFadeTo * lionHeight) / h) : 1;
  return {
    lion: { left: lionLeft, top: lionTop, width: lionWidth, height: lionHeight },
    rings: { left: t.eyeX * w - ringsSize / 2, top: eyeY + t.ringsEyeDy * lionHeight - ringsSize / 2, size: ringsSize },
    veil: { solidTo, fadeTo: Math.min(1, Math.max(fadeTo, solidTo + 0.01)) },
    fadeHeight: t.fadeHeight * h,
  };
}
