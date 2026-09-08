import React from 'react';
import { CheckIcon, XMarkIcon } from '@heroicons/react/20/solid';

interface Props {
  password: string;
}

export interface PasswordScore {
  score: number; // 0 to 4
  label: string;
  color: string;
  hasMinLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

export const calculatePasswordStrength = (pass: string): PasswordScore => {
  const hasMinLength = pass.length >= 8;
  const hasUpper = /[A-Z]/.test(pass);
  const hasLower = /[a-z]/.test(pass);
  const hasNumber = /[0-9]/.test(pass);
  const hasSpecial = /[^A-Za-z0-9]/.test(pass);

  let score = 0;
  if (pass.length >= 6) score += 1;
  if (hasMinLength) score += 1;
  if (hasUpper && hasLower) score += 1;
  if (hasNumber && hasSpecial) score += 1;

  if (pass.length === 0) {
    return {
      score: 0,
      label: '',
      color: 'bg-white/20',
      hasMinLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSpecial,
    };
  }

  switch (score) {
    case 1:
      return { score: 1, label: 'Weak', color: 'bg-red-500', hasMinLength, hasUpper, hasLower, hasNumber, hasSpecial };
    case 2:
      return { score: 2, label: 'Fair', color: 'bg-orange-500', hasMinLength, hasUpper, hasLower, hasNumber, hasSpecial };
    case 3:
      return { score: 3, label: 'Good', color: 'bg-yellow-400', hasMinLength, hasUpper, hasLower, hasNumber, hasSpecial };
    case 4:
    default:
      return { score: 4, label: 'Strong', color: 'bg-[#1DB954]', hasMinLength, hasUpper, hasLower, hasNumber, hasSpecial };
  }
};

const PasswordStrengthIndicator: React.FC<Props> = ({ password }) => {
  if (!password) return null;

  const strength = calculatePasswordStrength(password);

  return (
    <div className="w-full mt-2 space-y-2 text-xs">
      {/* 4-bar meter */}
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              step <= strength.score ? strength.color : 'bg-white/10'
            }`}
          />
        ))}
        <span
          className={`ml-2 text-xs font-semibold ${
            strength.score === 1
              ? 'text-red-400'
              : strength.score === 2
              ? 'text-orange-400'
              : strength.score === 3
              ? 'text-yellow-400'
              : 'text-[#1DB954]'
          }`}
        >
          {strength.label}
        </span>
      </div>

      {/* Criteria checklist */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-white/60 pt-1">
        <div className="flex items-center gap-1.5">
          {strength.hasMinLength ? (
            <CheckIcon className="w-3.5 h-3.5 text-[#1DB954]" />
          ) : (
            <XMarkIcon className="w-3.5 h-3.5 text-white/30" />
          )}
          <span className={strength.hasMinLength ? 'text-white/80' : ''}>8+ characters</span>
        </div>
        <div className="flex items-center gap-1.5">
          {strength.hasUpper && strength.hasLower ? (
            <CheckIcon className="w-3.5 h-3.5 text-[#1DB954]" />
          ) : (
            <XMarkIcon className="w-3.5 h-3.5 text-white/30" />
          )}
          <span className={strength.hasUpper && strength.hasLower ? 'text-white/80' : ''}>Upper & lowercase</span>
        </div>
        <div className="flex items-center gap-1.5">
          {strength.hasNumber ? (
            <CheckIcon className="w-3.5 h-3.5 text-[#1DB954]" />
          ) : (
            <XMarkIcon className="w-3.5 h-3.5 text-white/30" />
          )}
          <span className={strength.hasNumber ? 'text-white/80' : ''}>At least 1 number</span>
        </div>
        <div className="flex items-center gap-1.5">
          {strength.hasSpecial ? (
            <CheckIcon className="w-3.5 h-3.5 text-[#1DB954]" />
          ) : (
            <XMarkIcon className="w-3.5 h-3.5 text-white/30" />
          )}
          <span className={strength.hasSpecial ? 'text-white/80' : ''}>Symbol (@, $, !, %, #)</span>
        </div>
      </div>
    </div>
  );
};

export default PasswordStrengthIndicator;
