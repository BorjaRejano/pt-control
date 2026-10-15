import logo from './assets/pt-control-logo.png'

/** Mantiene la imagen original; el encuadre se adapta por CSS a cada superficie. */
export function Brand({ compact = false }: { compact?: boolean }) {
  if (!compact) return <div className="brand-logo-full">
    <span className="logo-frame"><img src={logo} alt="PT CONTROL · Gestión de permisos de trabajo" width="1254" height="1254" fetchPriority="high"/></span>
  </div>

  return <div className="brand logo-brand">
    <span className="logo-mark"><span className="logo-frame"><img src={logo} alt="" width="1254" height="1254"/></span></span>
    <div><strong>PT CONTROL</strong><small>Gestión y planificación de permisos</small></div>
  </div>
}
