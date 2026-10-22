import { useEffect, useState } from 'react'
import { X, FileVideo, FileImage, FileAudio, Download } from 'lucide-react'
import { formatBytes } from '../lib/format'

const icons = { image: FileImage, video: FileVideo, audio: FileAudio }

/** Evidence grid with a lightbox — how the admin reviews the proof. */
export default function EvidenceViewer({ evidence = [] }) {
  const [active, setActive] = useState(null)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setActive(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!evidence.length) {
    return <p className="text-sm text-ink-mute">No photos or videos were attached to this complaint.</p>
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {evidence.map((f) => {
          const Icon = icons[f.kind] || FileImage
          return (
            <li key={f.id ?? f.url}>
              <button
                type="button"
                onClick={() => setActive(f)}
                className="w-full overflow-hidden rounded-xl border border-hairline bg-white text-left transition hover:shadow-lift"
              >
                <div className="grid h-28 place-items-center bg-canvas">
                  {f.kind === 'image' && <img src={f.url} alt={f.name} className="h-full w-full object-cover" />}
                  {f.kind === 'video' && <video src={f.url} className="h-full w-full object-cover" muted />}
                  {f.kind === 'audio' && <FileAudio className="h-8 w-8 text-purple-400" strokeWidth={1.6} />}
                </div>
                <div className="flex items-center gap-2 px-3 py-2">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-ink-mute" />
                  <span className="truncate text-[11px] font-medium text-ink-soft">{f.name}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-ink-mute">{formatBytes(f.size)}</span>
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      {active && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-4"
          onClick={() => setActive(null)}
          role="dialog"
          aria-modal="true"
          aria-label={active.name}
        >
          <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-3">
              <p className="truncate text-sm font-medium text-white">{active.name}</p>
              <a
                href={active.url}
                target="_blank"
                rel="noreferrer"
                className="ml-auto grid h-9 w-9 place-items-center rounded-lg bg-white/15 text-white hover:bg-white/25"
                aria-label="Open the original file"
              >
                <Download className="h-4 w-4" />
              </a>
              <button
                onClick={() => setActive(null)}
                className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 text-white hover:bg-white/25"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-hidden rounded-2xl bg-black">
              {active.kind === 'image' && <img src={active.url} alt={active.name} className="max-h-[75vh] w-full object-contain" />}
              {active.kind === 'video' && <video src={active.url} controls autoPlay className="max-h-[75vh] w-full" />}
              {active.kind === 'audio' && (
                <div className="p-10"><audio src={active.url} controls autoPlay className="w-full" /></div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
