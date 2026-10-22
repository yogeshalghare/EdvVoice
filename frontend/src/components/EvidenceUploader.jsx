import { useRef, useState } from 'react'
import { ImagePlus, X, FileVideo, FileImage, Upload, LoaderCircle } from 'lucide-react'
import { formatBytes } from '../lib/format'
import { api } from '../lib/api'

const MAX_FILES = 6
const MAX_BYTES = 25 * 1024 * 1024

/**
 * Files go up to Cloudinary as soon as they're chosen, not on submit.
 * The student sees each one land, and a slow video doesn't hold up the
 * whole form at the end.
 */
export default function EvidenceUploader({ files, onChange }) {
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(0)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  async function add(fileList) {
    setError('')
    const incoming = Array.from(fileList)
    const room = MAX_FILES - files.length

    if (room <= 0) { setError(`You can attach ${MAX_FILES} files in total.`); return }
    if (incoming.length > room) setError(`Only the first ${room} files were added.`)

    const valid = []
    for (const file of incoming.slice(0, room)) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        setError('Attach photos or videos only.'); continue
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name} is over 25 MB. Trim it and try again.`); continue
      }
      valid.push(file)
    }
    if (!valid.length) return

    setUploading(valid.length)
    try {
      const uploaded = await api.uploadEvidence(valid)
      onChange([...files, ...uploaded])
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(0)
    }
  }

  const remove = (url) => onChange(files.filter((f) => f.url !== url))

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); add(e.dataTransfer.files) }}
        className={`rounded-2xl border-2 border-dashed p-6 text-center transition
                    ${dragging ? 'border-purple-400 bg-purple-50' : 'border-hairline bg-canvas'}`}
      >
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-white text-purple-500 shadow-sm">
          {uploading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" strokeWidth={1.9} />}
        </div>
        <p className="text-sm font-semibold text-ink">
          {uploading ? `Uploading ${uploading} file${uploading > 1 ? 's' : ''}…` : 'Add photos or a short video'}
        </p>
        <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-ink-mute">
          Evidence helps the department act faster. Up to {MAX_FILES} files, 25 MB each.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={files.length >= MAX_FILES || uploading > 0}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-hairline bg-white px-4 py-2.5
                     text-sm font-semibold text-purple-600 transition hover:border-purple-200 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" /> Choose files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => { add(e.target.files); e.target.value = '' }}
        />
      </div>

      {error && <p className="mt-3 text-xs font-medium text-orange-700">{error}</p>}

      {files.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {files.map((f) => (
            <li key={f.url} className="group relative overflow-hidden rounded-xl border border-hairline bg-white">
              <div className="grid h-24 place-items-center bg-canvas">
                {f.kind === 'image'
                  ? <img src={f.url} alt={f.name} className="h-full w-full object-cover" />
                  : <video src={f.url} className="h-full w-full object-cover" muted />}
              </div>
              <div className="flex items-center gap-2 px-3 py-2">
                {f.kind === 'image'
                  ? <FileImage className="h-3.5 w-3.5 shrink-0 text-ink-mute" />
                  : <FileVideo className="h-3.5 w-3.5 shrink-0 text-ink-mute" />}
                <span className="truncate text-[11px] font-medium text-ink-soft">{f.name}</span>
                <span className="ml-auto shrink-0 text-[10px] text-ink-mute">{formatBytes(f.size)}</span>
              </div>
              <button
                type="button"
                onClick={() => remove(f.url)}
                aria-label={`Remove ${f.name}`}
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-ink/70 text-white
                           opacity-0 transition group-hover:opacity-100 focus:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
