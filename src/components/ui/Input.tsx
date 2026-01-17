import React from 'react';

interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'password';
  error?: string;
  success?: boolean;
  helper?: string;
  disabled?: boolean;
  className?: string;
}

const Input: React.FC<InputProps> = ({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  error,
  success = false,
  helper,
  disabled = false,
  className = '',
}) => {
  const inputClasses = [
    'input',
    success && !error ? 'input-valid' : '',
    error ? 'input-error' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const helperClasses = [
    'input-helper',
    success && !error ? 'input-helper-success' : '',
    error ? 'input-helper-error' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="input-group">
      {label && <label className="input-label">{label}</label>}
      <input
        type={type}
        className={inputClasses}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      {(helper || error) && (
        <span className={helperClasses}>{error || helper}</span>
      )}
    </div>
  );
};

export default Input;
export { Input };
export type { InputProps };
