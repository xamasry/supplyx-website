import React from 'react';
import { cn } from '../../lib/utils';

interface LogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  white?: boolean;
  grayscale?: boolean;
}

export default function Logo({ className, size = 'md', white = false, grayscale = false }: LogoProps) {
  const sizes = {
    xs: 'text-lg',
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-4xl'
  };

  const xSizes = {
    xs: 'w-4 h-4',
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-10 h-10'
  };

  return (
    <div className={cn(
      "flex items-center gap-1 font-extrabold italic tracking-tighter", 
      sizes[size], 
      className,
      grayscale && "grayscale brightness-0 opacity-40"
    )}>
      <span className={white ? "text-white" : "text-[#0B1D2A]"}>supply</span>
      <div className="relative flex items-center justify-center">
        {/* The X Logo */}
        <svg 
          viewBox="0 0 24 24" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg" 
          className={cn(xSizes[size], "text-[#22C55E]")}
        >
          {/* Motion lines */}
          <path d="M2 8H6M2 12H5M2 16H6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          {/* The X */}
          <path d="M10 4L20 20M20 4L10 20" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
