import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

let openModals = 0
let originalOverflow = ''

export function Modal({ title, eyebrow, busy, onClose, children, alert = false }: {title:string,eyebrow?:string,busy:boolean,onClose:()=>void,children:ReactNode,alert?:boolean}) {
  const ref = useRef<HTMLElement>(null)
  const callbacks = useRef({busy,onClose})
  callbacks.current = {busy,onClose}
  useEffect(()=>{
    const previous = document.activeElement as HTMLElement | null
    if(openModals===0)originalOverflow=document.body.style.overflow
    ++openModals
    document.body.style.overflow='hidden'
    const focusable=()=>Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')||[])
    focusable()[0]?.focus()
    const key=(e:KeyboardEvent)=>{
      const dialogs=document.querySelectorAll('[role="dialog"],[role="alertdialog"]')
      if (dialogs[dialogs.length-1]!==ref.current) return
      if(e.key==='Escape'&&!callbacks.current.busy)callbacks.current.onClose()
      if(e.key==='Tab'){
        const list=focusable(),first=list[0],last=list[list.length-1]
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}
        if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
      }
    }
    document.addEventListener('keydown',key)
    return ()=>{if(--openModals===0)document.body.style.overflow=originalOverflow;document.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus()}
  },[])
  return <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose()}}>
    <section ref={ref} className="modal" role={alert?'alertdialog':'dialog'} aria-modal="true" aria-label={title}>
      <header className="modal-head"><div>{eyebrow&&<small>{eyebrow}</small>}<h2>{title}</h2></div><button className="icon-button" disabled={busy} onClick={onClose} aria-label="Cerrar"><X size={21}/></button></header>
      {children}
    </section>
  </div>
}
