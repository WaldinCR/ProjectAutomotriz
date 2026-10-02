export async function login(usuario, password) {
  return window.api.auth.login({ usuario, password });
}
export async function logout() {
  return window.api.auth.logout();
}
