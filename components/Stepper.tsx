'use client'

interface StepperProps {
  currentStep: string
  deepDiveNo: number
  onNext: () => void
  onBack: () => void
  onDeepDive: () => void
}

const STEPS = [
  'REQUIREMENTS',
  'FNFRS', 
  'ENTITIES',
  'API',
  'HLD',
  'DEEPDIVE',
  'CONCLUSION'
]

export function Stepper({ currentStep, deepDiveNo, onNext, onBack, onDeepDive }: StepperProps) {
  const currentIndex = STEPS.indexOf(currentStep)
  
  return (
    <div className="p-4">
      <h3 className="font-semibold text-gray-900 mb-4">Design Steps</h3>
      
      <div className="space-y-2 mb-6">
        {STEPS.map((step, index) => {
          let status = 'upcoming'
          if (index < currentIndex) status = 'completed'
          if (index === currentIndex) status = 'current'
          
          return (
            <div
              key={step}
              className={`p-2 rounded text-sm ${
                status === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : status === 'current'
                  ? 'bg-blue-100 text-blue-800 font-medium'
                  : 'bg-gray-50 text-gray-600'
              }`}
            >
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  status === 'completed' ? 'bg-green-600' :
                  status === 'current' ? 'bg-blue-600' : 'bg-gray-300'
                }`} />
                {step}
                {step === 'DEEPDIVE' && deepDiveNo > 0 && (
                  <span className="ml-1 text-xs">({deepDiveNo})</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      
      <div className="space-y-2">
        <button
          onClick={onNext}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
        >
          Next Step
        </button>
        
        <button
          onClick={onBack}
          className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-md transition-colors"
        >
          Back
        </button>
        
        {currentStep === 'HLD' && deepDiveNo === 0 && (
          <button
            onClick={onDeepDive}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            Deep Dive (Once)
          </button>
        )}
      </div>
    </div>
  )
}