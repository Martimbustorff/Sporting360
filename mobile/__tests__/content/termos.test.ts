// Task 27: termos e política de privacidade (responsável Martim Bustorff), pendentes para o Plano 5 e TermsView.
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { TERMS, TERMS_TODOS } from '@/content/termos';
import { TermsView } from '@/components/TermsView';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AuthTermos from '../../app/(auth)/termos';
import DefinicoesTermos from '../../app/(app)/definicoes/termos';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const inSafeArea = (C: React.ComponentType) =>
  React.createElement(SafeAreaProvider, { initialMetrics: METRICS }, React.createElement(C));

const all = TERMS.map((s) => `${s.title}\n${s.body}`).join('\n');

describe('TERMS', () => {
  it('responsável é Martim Bustorff, pessoa singular, com o contacto decidido', () => {
    expect(all).toContain('Martim Bustorff');
    expect(all).toContain('pessoa singular');
    expect(all).toContain('app.scp360@gmail.com');
    expect(all).not.toContain('martimbustorff@gmail.com');
  });

  it('diz que a app é não oficial e sem ligação ao Sporting Clube de Portugal', () => {
    expect(all).toMatch(/não oficial/);
    expect(all).toContain('Sporting Clube de Portugal');
  });

  it('cobre os pontos decididos de privacidade (F15: região eur3 escrita, não TODO)', () => {
    for (const s of [
      'União Europeia (Firestore multirregião eur3)',
      'Firebase Authentication',
      'Crashlytics',
      'Firebase Analytics',
      '"Maria C."',
      'Apagar conta',
      'CNPD',
      'portabilidade',
      'oposição',
      'retificação',
      'valor monetário',
      'API-Football',
      'VSports',
      'RSS',
      'Não vendemos',
      'lei portuguesa',
    ]) {
      expect(all).toContain(s);
    }
    expect(all).not.toContain('região do Firestore]');
  });

  it('saem as frases da V2 (QR, torniquetes, voluntários, ponta a ponta)', () => {
    expect(all).not.toMatch(/ponta a ponta/i);
    expect(all).not.toMatch(/torniquete/i);
    expect(all).not.toMatch(/QR code/i);
    expect(all).not.toMatch(/voluntári/i);
  });

  it('GameBox guardada de forma ofuscada, nunca "cifrada" nem "encriptada"', () => {
    expect(all).toContain('de forma ofuscada');
    expect(all).not.toMatch(/cifrad|encriptad/i);
  });

  it('§6: os fornecedores não recebem dados da conta, mas recebem dados técnicos (IP) ao carregar imagens e o leitor', () => {
    const s6 = TERMS.find((x) => x.title.startsWith('6. SUBCONTRATANTES'))!.body;
    expect(s6).toContain('não recebem dados da conta');
    expect(s6).toMatch(/endereço IP/);
    expect(s6).toMatch(/VSports/);
    expect(s6).not.toContain('não recebem dados pessoais');
  });

  it('sem travessões', () => {
    expect(all).not.toMatch(/[—–]/);
  });

  it('todas as secções têm título; só os cabeçalhos de parte têm corpo vazio', () => {
    for (const s of TERMS) expect(s.title.trim()).not.toBe('');
    const empty = TERMS.filter((s) => !s.body).map((s) => s.title);
    expect(empty).toEqual(['POLÍTICA DE PRIVACIDADE']);
  });
});

describe('pendentes para o Plano 5', () => {
  it('TERMS_TODOS tem só os prazos de conservação (F15) e a marca aparece no texto', () => {
    expect(TERMS_TODOS).toHaveLength(1);
    expect(TERMS_TODOS[0]!.startsWith('[A DEFINIR PELO MARTIM')).toBe(true);
    expect(TERMS_TODOS[0]).toMatch(/conservação/);
    for (const t of TERMS_TODOS) expect(all).toContain(t);
  });
});

describe('TermsView', () => {
  it('renderiza todas as secções (títulos como cabeçalho e corpos)', async () => {
    await render(React.createElement(TermsView));
    expect(screen.getAllByRole('header')).toHaveLength(TERMS.length);
    for (const s of TERMS) {
      expect(screen.getByText(s.title)).toBeTruthy();
      if (s.body) expect(screen.getByText(s.body)).toBeTruthy();
    }
  });
});

describe('rotas', () => {
  it.each([
    ['(auth)/termos', AuthTermos],
    ['definicoes/termos', DefinicoesTermos],
  ])('%s usa a TermsView', async (_name, C) => {
    await render(inSafeArea(C));
    expect(screen.getByTestId('terms')).toBeTruthy();
    expect(screen.getByText('2. QUEM DISPONIBILIZA A APP')).toBeTruthy();
    expect(screen.queryByText('Em breve.')).toBeNull();
  });
});
