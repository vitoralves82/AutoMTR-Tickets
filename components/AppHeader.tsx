
import React from 'react';

const AppHeader: React.FC = () => {
  return (
    <header className="w-full text-center py-6">
      <h1 className="text-6xl font-bold text-[rgba(0,90,149,255)] tracking-tight">
        AutoMMR v2
      </h1>
      <p className="text-xl text-[rgba(0,90,149,255)] mt-2">
        Extraia informações de formulários MMR com facilidade usando IA.
      </p>
    </header>
  );
};

export default AppHeader;
