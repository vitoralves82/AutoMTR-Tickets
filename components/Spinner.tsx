
import React from 'react';

const Spinner: React.FC = () => {
  return (
    <div className="flex justify-center items-center my-8">
      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-teal-500"></div>
      <p className="ml-4 text-lg text-slate-300">Processando imagem, por favor aguarde...</p>
    </div>
  );
};

export default Spinner;