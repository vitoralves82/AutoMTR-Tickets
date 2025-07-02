
import React from 'react';

interface SpinnerProps {
  message?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ message }) => {
  return (
    <div className="flex justify-center items-center my-8" aria-live="polite">
      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-teal-500"></div>
      <p className="ml-4 text-lg text-slate-300">{message || 'Processando, por favor aguarde...'}</p>
    </div>
  );
};

export default Spinner;
