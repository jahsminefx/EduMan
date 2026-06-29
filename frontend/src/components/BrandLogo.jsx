import React from 'react';

export default function BrandLogo({ className = 'h-12 w-auto' }) {
  return (
    <img
      src="/images/eduman-logo-cropped.png"
      alt="EduMan"
      className={`block object-contain ${className}`}
    />
  );
}
