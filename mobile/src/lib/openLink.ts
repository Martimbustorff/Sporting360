// Ligações externas (estádio, sites do clube, comunidade): só https, sempre no browser dentro da app.
// Uma falha ao abrir vai ao Crashlytics com o endereço sem query nem fragmento (podem levar dados); nunca lança.
import * as WebBrowser from 'expo-web-browser';
import { isHttps } from '@/content/clubLinks';
import { reportCode } from '@/lib/report';

export async function openLink(url: string | null | undefined): Promise<void> {
  if (!isHttps(url)) return;
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch (e) {
    reportCode(`OPEN_LINK_FAILED ${url.split(/[?#]/)[0]}`, e);
  }
}
