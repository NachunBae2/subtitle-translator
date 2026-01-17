import React from 'react';

interface StepperProps {
  currentStep: 'setup' | 'input' | 'translate' | 'result';
}

type StepInfo = {
  id: 'setup' | 'input' | 'translate' | 'result';
  number: number;
  label: string;
};

const steps: StepInfo[] = [
  { id: 'setup', number: 1, label: '설정' },
  { id: 'input', number: 2, label: '자막 입력' },
  { id: 'translate', number: 3, label: '번역' },
  { id: 'result', number: 4, label: '완료' },
];

export function Stepper({ currentStep }: StepperProps) {
  const currentIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="steps">
      {steps.map((step, index) => {
        const isActive = step.id === currentStep;
        const isDone = index < currentIndex;

        return (
          <React.Fragment key={step.id}>
            <div className={`step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
              <span className="step-num">{step.number}</span>
              <span className="step-label">{step.label}</span>
            </div>
            {index < steps.length - 1 && <div className="step-line" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}
