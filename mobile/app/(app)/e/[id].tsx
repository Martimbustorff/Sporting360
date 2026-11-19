// SEM FIGMA: entrada do link de empréstimo (Plano 8, Task 7), sem interface. Vive dentro de (app) (como o /j) para o
// guarda de (app)/_layout se aplicar: sem sessão guarda /e/{id} (lib/pendingLink) e manda para /welcome; depois de
// entrar, o guarda de (auth) abre /emprestimo/{id}. Com sessão, id válido (22 caracteres base64url) abre o empréstimo;
// inválido vai para a Home. O id não se regista nem se mede.
import { Redirect, useLocalSearchParams } from 'expo-router';

const LOAN_ID = /^[A-Za-z0-9_-]{22}$/;

export default function LinkEmprestimo() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const value = Array.isArray(id) ? id[0] : id;
  if (!value || !LOAN_ID.test(value)) return <Redirect href="/" />;
  return <Redirect href={{ pathname: '/emprestimo/[id]', params: { id: value } }} />;
}
