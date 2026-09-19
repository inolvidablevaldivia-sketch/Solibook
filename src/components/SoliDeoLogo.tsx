import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export const SoliDeoLogo: React.FC<LogoProps> = ({ className = '', size = 36, showText = true }) => {
  const [useImg, setUseImg] = React.useState(true);

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {useImg ? (
        <img
          src="/logo-solideo.png"
          alt="Soli Deo"
          width={size}
          height={size}
          className="shrink-0 object-contain drop-shadow-xs transition-transform hover:scale-105"
          onError={() => setUseImg(false)}
        />
      ) : (
        /* Isotipo SVG de respaldo si no hay imagen */
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0 drop-shadow-sm transition-transform hover:scale-105"
        >
          <path d="M 50 42 C 45 52, 40 68, 30 88 C 42 78, 48 64, 48 52 Z" fill="#0099DD" />
          <circle cx="51" cy="33" r="6" fill="#0099DD" />
          <path d="M 47 38 C 38 28, 24 20, 10 22 C 22 27, 34 33, 43 41 Z" fill="#00AEEF" />
          <path d="M 54 38 C 64 27, 78 18, 92 18 C 80 25, 68 32, 58 41 Z" fill="#0099DD" />
        </svg>
      )}

      {/* Tipografía Institucional */}
      {showText && (
        <div className="flex flex-col leading-none">
          <div className="flex items-baseline gap-1">
            <span className="text-[15px] font-bold tracking-widest text-[#0099DD] uppercase font-sans">
              SOLI
            </span>
            <span className="text-[20px] font-serif italic text-[#8B1E2B] font-semibold -ml-0.5 tracking-tight">
              Deo
            </span>
          </div>
          <span className="text-[8.5px] uppercase tracking-wider text-slate-400 font-medium -mt-0.5">
            Ministerio Vocal
          </span>
        </div>
      )}
    </div>
  );
};
