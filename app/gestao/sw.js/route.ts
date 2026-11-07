/**
 * Service worker mínimo: permite instalar a aplicação e mostra um aviso quando não há rede.
 * Por segurança, NÃO guarda páginas nem dados da empresa em cache: tudo vem sempre do servidor.
 */
const SCRIPT = `
const OFFLINE = '<!doctype html><html lang="pt-PT"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sem ligação</title><body style="font-family:system-ui;background:#000;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px"><div><p style="letter-spacing:.2em;font-size:12px;color:#aaa">PONTO RADICAL · GESTÃO DE OBRAS</p><h1 style="font-size:22px">Sem ligação à Internet</h1><p style="color:#ccc">Os dados da plataforma ficam sempre no servidor. Volte a tentar quando tiver rede.</p><button onclick="location.reload()" style="margin-top:12px;padding:12px 20px;border-radius:8px;border:0;font-weight:600">Tentar novamente</button></div></body></html>';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
`;

export function GET() {
  return new Response(SCRIPT, {
    headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-cache", "Service-Worker-Allowed": "/" },
  });
}
