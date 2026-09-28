/**
 * Soporte para acceder al sitio con o sin el prefijo de ruta que agrega el
 * WAF/reverse proxy en la DMZ (ej. https://aluminios.com.uy/comedor/...),
 * mientras el acceso directo interno (http://10.25.1.165:11546/...) sigue
 * funcionando igual que siempre, sin prefijo.
 *
 * El WAF preserva el prefijo al reenviar la request (no lo recorta), así
 * que el navegador ve la URL completa con "/comedor" — este archivo detecta
 * en tiempo de ejecución, mirando window.location.pathname, si el usuario
 * entró por esa ruta, y lo agrega a las URLs propias (rutas del router,
 * llamadas a la API, imágenes de /uploads) para que todo siga apuntando al
 * mismo lugar por donde entró.
 *
 * Ver backend/app/middleware/prefijo_waf.py para la contraparte del lado
 * del servidor (que hace el trabajo equivalente con las rutas entrantes).
 */
export const PREFIJOS_WAF_CONOCIDOS = ['/comedor']

export function prefijoActual() {
  if (typeof window === 'undefined') return ''
  return PREFIJOS_WAF_CONOCIDOS.find((p) => window.location.pathname.startsWith(p)) || ''
}

/** Antepone el prefijo vigente a una ruta absoluta ("/uploads/x" → "/comedor/uploads/x"). */
export function conPrefijo(path) {
  return `${prefijoActual()}${path}`
}
