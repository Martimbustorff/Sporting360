// Task 17: página do link único (/j). Com a app instalada o sistema abre a app (universal links / app links) e esta
// página nem carrega; sem a app manda para a loja certa. Medição: App Store com `ct=share`, Google Play com o
// referrer `utm_source=share&utm_campaign=game_<id>`. UMD: o teste (mobile/__tests__/hosting) usa-a em Node.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.S360Redirect = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // TODO: acrescentar o provider token (`pt=`) da App Store Connect quando o Martim o indicar, para a campanha
  // `ct=share` aparecer nas métricas da App Store.
  var APP_STORE = 'https://apps.apple.com/app/id6450608023?ct=share';
  var PLAY = 'https://play.google.com/store/apps/details?id=com.scp360';
  var GAME_ID = /^[\w-]{1,64}$/;

  /** Loja para o telemóvel; `null` fora de iOS e Android (a página mostra os dois botões). */
  function storeUrlFor(userAgent, game) {
    var ua = userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return APP_STORE;
    if (/Android/i.test(ua)) {
      var referrer = 'utm_source=share' + (game ? '&utm_campaign=game_' + game : '');
      return PLAY + '&referrer=' + encodeURIComponent(referrer);
    }
    return null;
  }

  /** `game` do URL, só se for um id válido. */
  function gameFrom(search) {
    var m = /[?&]game=([^&#]*)/.exec(search || '');
    if (!m) return null;
    var g;
    try {
      g = decodeURIComponent(m[1]);
    } catch (e) {
      return null;
    }
    return GAME_ID.test(g) ? g : null;
  }

  return { storeUrlFor: storeUrlFor, gameFrom: gameFrom, APP_STORE: APP_STORE, PLAY: PLAY };
});
