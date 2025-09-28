'use client'

interface ControlsProps {
  connected: boolean
  hasPendingPatch: boolean
  onApplyPatch: () => void
  onExport: () => void
}

export function Controls({ connected, hasPendingPatch, onApplyPatch, onExport }: ControlsProps) {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              connected ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span className="text-sm text-gray-600">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          <h1 className="text-lg font-semibold text-gray-900">
            System Design Copilot
          </h1>
        </div>
        
        <div className="flex items-center space-x-3">
          {hasPendingPatch && (
            <button
              onClick={onApplyPatch}
              className="bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Apply Patch
            </button>
          )}
          
          <button
            onClick={onExport}
            className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  )
}