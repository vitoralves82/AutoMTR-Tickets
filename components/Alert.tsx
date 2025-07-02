
import React from 'react';
import { AlertProps } from '../types';

const Alert: React.FC<AlertProps> = ({ message, type }) => {
  let bgColor = 'bg-red-600'; // Slightly adjusted red
  let borderColor = 'border-red-700';
  let textColor = 'text-red-100';
  let iconPath = "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"; // Error icon

  if (type === 'info') {
    bgColor = 'bg-sky-700'; // Using sky blue for info
    borderColor = 'border-sky-800';
    textColor = 'text-sky-100';
    iconPath = "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"; // Info icon
  } else if (type === 'success') {
    bgColor = 'bg-teal-700'; // EnvironPact teal for success
    borderColor = 'border-teal-800';
    textColor = 'text-teal-100';
    iconPath = "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"; // Success icon
  }

  return (
    <div className={`my-6 p-4 border-l-4 ${borderColor} ${bgColor} ${textColor} rounded-r-md shadow-md`} role="alert">
      <div className="flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={iconPath} />
        </svg>
        <p className="font-medium">{message}</p>
      </div>
    </div>
  );
};

export default Alert;