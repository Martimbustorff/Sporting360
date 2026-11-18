// Cores de marcas de terceiros (não são tokens S360): só aqui, permitido pelo check:tokens (R16).
// Google: botão "Continuar com o Google", tema escuro das regras de marca do Google Identity
// (https://developers.google.com/identity/branding-guidelines): fundo #131314, contorno #8E918F, texto #E3E3E3,
// logótipo "G" nas cores oficiais (assets/images/google-g.svg), fonte Roboto Medium (system font no iOS).
export const googleBrand = {
  fill: '#131314',
  stroke: '#8E918F',
  text: '#E3E3E3',
  logoSize: 20,
  logoGap: 10, // entre o "G" e o texto
  fontSize: 16,
  fontWeight: '500',
} as const;
