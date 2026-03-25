'use client'

interface Props {
  mapUrl: string
  mapLabel: string
  onClose: () => void
}

export default function MapModal({ mapUrl, mapLabel, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-white font-semibold">🗺️ {mapLabel}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <img
            src={mapUrl}
            alt={mapLabel}
            className="w-full h-auto rounded-lg"
          />
        </div>
      </div>
    </div>
  )
}