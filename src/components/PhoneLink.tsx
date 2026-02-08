import React from 'react';

interface PhoneLinkProps {
  phoneNumber: string | null | undefined;
  className?: string;
}

export const PhoneLink: React.FC<PhoneLinkProps> = ({ phoneNumber, className = '' }) => {
  if (!phoneNumber) return <span>-</span>;

  const cleanNumber = phoneNumber.replace(/\D/g, '');
  const url = `https://wa.me/${cleanNumber}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`font-mono text-sm text-green-700 hover:text-green-900 hover:underline inline-flex items-center gap-1 ${className}`}
    >
      {phoneNumber}
    </a>
  );
};
