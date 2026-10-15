import logo from './assets/pt-control-logo.png'
import darkMark from './assets/pt-control-mark-dark.png'

/** Logo completo para superficies claras y símbolo transparente para la cabecera. */
export function Brand({ compact = false }: { compact?: boolean }) {
  if (!compact) return <div className="brand-logo-full">
    <span className="logo-frame"><img src={logo} alt="PT CONTROL · Gestión de permisos de trabajo" width="1254" height="1254" fetchPriority="high"/></span>
  </div>

  return <div className="brand logo-brand">
    <span className="logo-mark"><span className="logo-frame"><img src={darkMark} alt="" width="1860" height="846"/></span></span>
    <div><strong>PT CONTROL</strong><small>Gestión y planificación de permisos</small></div>
  </div>
}
