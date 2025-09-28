'use client'

interface ApprovalDrawerProps {
  patch: any
  onApprove: () => void
}

export function ApprovalDrawer({ patch, onApprove }: ApprovalDrawerProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex-1 mr-4">
            <h3 className="font-semibold text-gray-900 mb-1">
              Proposed Changes: {patch.label || 'Diagram Update'}
            </h3>
            <div className="text-sm text-gray-600">
              {patch.adds?.length || 0} additions, {patch.updates?.length || 0} updates, {patch.deletes?.length || 0} deletions
            </div>
          </div>
          
          <button
            onClick={onApprove}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition-colors"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  )
}