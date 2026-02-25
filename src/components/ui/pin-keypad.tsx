'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface PinKeypadProps {
  onComplete: (pin: string) => void;
  isLoading?: boolean;
  error?: string;
}

export function PinKeypad({ onComplete, isLoading, error }: PinKeypadProps) {
  const [pin, setPin] = useState('');

  const handleKeyPress = (key: string) => {
    if (isLoading) return;

    if (key === 'C') {
      setPin('');
      return;
    }

    if (key === 'backspace') {
      setPin((prev) => prev.slice(0, -1));
      return;
    }

    if (pin.length < 4) {
      const newPin = pin + key;
      setPin(newPin);

      if (newPin.length === 4) {
        onComplete(newPin);
      }
    }
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'backspace'];

  return (
    <div className="w-full max-w-xs mx-auto">
      {/* PIN Display */}
      <div className="flex justify-center gap-3 mb-6">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={cn(
              'w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all',
              index < pin.length
                ? 'bg-amber-100 border-amber-500 text-amber-700'
                : 'bg-gray-50 border-gray-300'
            )}
          >
            {index < pin.length ? '●' : ''}
          </div>
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-center text-red-500 text-sm mb-4 animate-shake">
          {error}
        </div>
      )}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3">
        {keys.map((key) => (
          <button
            key={key}
            onClick={() => handleKeyPress(key)}
            disabled={isLoading}
            className={cn(
              'h-16 rounded-xl text-2xl font-semibold transition-all active:scale-95',
              'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              key === 'C'
                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                : key === 'backspace'
                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                : 'bg-white border-2 border-gray-200 text-gray-900 hover:bg-gray-50 hover:border-amber-400'
            )}
          >
            {key === 'backspace' ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 mx-auto"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z"
                />
              </svg>
            ) : (
              key
            )}
          </button>
        ))}
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex justify-center mt-6">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
