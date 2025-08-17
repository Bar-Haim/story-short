'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';

interface Step {
  id: string;
  name: string;
  description: string;
}

interface WizardStepperProps {
  steps: Step[];
  currentStep: number;
  className?: string;
  videoStatus?: string;
}

const stepRoutes = {
  0: '/create',
  1: (id: string) => `/script/${id}`,
  2: (id: string) => `/storyboard/${id}`,
  3: (id: string) => `/finalize/${id}`,
  4: (id: string) => `/video/${id}`,
};

export default function WizardStepper({ steps, currentStep, className = '', videoStatus }: WizardStepperProps) {
  const router = useRouter();
  const params = useParams();
  const videoId = params.id as string;

  const handleStepClick = (stepIndex: number) => {
    // Allow navigation to previous steps
    if (stepIndex < currentStep) {
      const route = stepRoutes[stepIndex as keyof typeof stepRoutes];
      if (typeof route === 'function') {
        router.push(route(videoId));
      } else {
        router.push(route);
      }
    }
    // Allow navigation to script step even if current step is storyboard and status allows it
    else if (stepIndex === 1 && currentStep === 2 && videoStatus === 'storyboard_generated') {
      router.push(`/script/${videoId}`);
    }
  };

  const isStepClickable = (stepIndex: number) => {
    // Always allow clicking on previous steps
    if (stepIndex < currentStep) return true;
    // Allow clicking on script step if we're on storyboard and status allows script editing
    if (stepIndex === 1 && currentStep === 2 && videoStatus === 'storyboard_generated') return true;
    return false;
  };

  return (
    <nav aria-label="Progress" className={className}>
      <ol role="list" className="flex items-center justify-center space-x-4 md:space-x-8">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isUpcoming = index > currentStep;
          const isClickable = isStepClickable(index);

          return (
            <li key={step.id} className="flex items-center">
              <div className="flex flex-col items-center group">
                {/* Step Circle */}
                <div className="relative flex items-center justify-center">
                  <button
                    onClick={() => handleStepClick(index)}
                    disabled={!isClickable}
                    className={`
                      flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all duration-200
                      ${isCompleted
                        ? 'bg-purple-600 border-purple-600 text-white hover:bg-purple-700 hover:border-purple-700'
                        : isCurrent
                        ? 'bg-purple-100 border-purple-600 text-purple-600'
                        : 'bg-gray-100 border-gray-300 text-gray-400'
                      }
                      ${isClickable ? 'cursor-pointer' : 'cursor-default'}
                      ${isClickable && isCompleted ? 'hover:scale-105' : ''}
                    `}
                    title={isClickable ? `Go to ${step.name} step` : step.name}
                  >
                    {isCompleted ? (
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </button>
                </div>

                {/* Step Label */}
                <div className="mt-2 text-center">
                  <span
                    className={`
                      text-sm font-medium transition-colors duration-200
                      ${isCurrent
                        ? 'text-purple-600'
                        : isCompleted
                        ? 'text-gray-900'
                        : 'text-gray-400'
                      }
                      ${isClickable && isCompleted ? 'hover:text-purple-700' : ''}
                    `}
                  >
                    {step.name}
                  </span>
                  <p className="text-xs text-gray-500 mt-1 max-w-24 hidden md:block">
                    {step.description}
                  </p>
                </div>
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div
                  className={`
                    h-px w-8 md:w-16 ml-4 mr-4 transition-colors duration-200
                    ${index < currentStep ? 'bg-purple-600' : 'bg-gray-300'}
                  `}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Default steps for the video creation wizard
export const defaultSteps: Step[] = [
  {
    id: 'story',
    name: 'Story',
    description: 'Enter your premise'
  },
  {
    id: 'script',
    name: 'Script',
    description: 'Review & edit'
  },
  {
    id: 'scenes',
    name: 'Scenes',
    description: 'Manage storyboard'
  },
  {
    id: 'finalize',
    name: 'Finalize',
    description: 'Generate assets'
  },
  {
    id: 'view',
    name: 'View',
    description: 'Watch & share'
  }
];