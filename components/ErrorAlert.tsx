import React from 'react';

export const ErrorAlert: React.FC<{ message: string }> = ({ message }) => (
  <section
    className="mt-6 p-4 bg-red-800/50 border border-red-600 text-white rounded-md"
    role="alert"
  >
    <p className="font-semibold text-white">Erro:</p>
    <p className="whitespace-pre-wrap">{message}</p>
  </section>
);
