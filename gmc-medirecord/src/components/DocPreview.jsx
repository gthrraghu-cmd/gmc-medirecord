import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer, MessageCircle } from 'lucide-react'
import { Modal } from './ui.jsx'
import { useT } from '../lib/i18n.jsx'

function ScaleBox({ children }) {
  const outer = useRef(null)
  const inner = useRef(null)
  const [box, setBox] = useState({ scale: 1, h: 0 })

  useLayoutEffect(() => {
    const measure = () => {
      if (!outer.current || !inner.current) return
      const w = outer.current.clientWidth
      const pw = inner.current.offsetWidth
      const scale = Math.min(1, w / pw)
      setBox({ scale, h: inner.current.offsetHeight * scale })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(outer.current)
    ro.observe(inner.current)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={outer} className="w-full" style={{ height: box.h || undefined }}>
      <div ref={inner} className="mx-auto w-max origin-top-left rounded-md shadow-[0_30px_60px_-20px_rgba(0,0,0,.7)]" style={{ transform: `scale(${box.scale})`, marginLeft: box.scale < 1 ? 0 : 'auto' }}>
        {children}
      </div>
    </div>
  )
}

export default function DocPreview({ open, onClose, title, subtitle, sheet, waHref, waDisabledReason }) {
  const { tx } = useT()
  return (
    <>
      <Modal open={open} onClose={onClose} wide title={title} subtitle={subtitle}>
        <div className="-mx-2 rounded-2xl bg-night-950/60 p-3 sm:p-5">
          <ScaleBox>{sheet}</ScaleBox>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {waHref ? (
            <a href={waHref} target="_blank" rel="noopener noreferrer" className="btn border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20">
              <MessageCircle size={16} /> {tx('Send on WhatsApp')}
            </a>
          ) : (
            waDisabledReason && <span className="self-center text-xs text-gold-200/40">{waDisabledReason}</span>
          )}
          <button onClick={() => window.print()} className="btn-gold">
            <Printer size={16} /> {tx('Print / Save PDF')}
          </button>
        </div>
      </Modal>
      {open && createPortal(<div className="print-root">{sheet}</div>, document.body)}
    </>
  )
}
