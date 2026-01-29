'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function Hero() {
  return (
    <div id="hero" className="relative w-full h-screen min-h-[600px] flex items-center justify-center overflow-hidden bg-slate-900">
      
      {/* Background with Gradient/Pattern */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 opacity-90"></div>
        {/* Abstract shapes/glows */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[600px] h-[600px] bg-blue-500 rounded-full blur-[120px] opacity-20 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[500px] h-[500px] bg-cyan-500 rounded-full blur-[100px] opacity-20"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
        
        {/* Logo or specialized icon */}
        <div className="mb-8 relative w-40 h-40 md:w-56 md:h-56 animate-float">
            {/* Using logo.png or similar if available, else standard Trans Laut */}
             <div className="absolute inset-0 bg-white/5 rounded-full blur-xl"></div>
             <Image
                src="/trans_laut_logo.png"
                alt="Trans Laut Jatim Logo"
                fill
                className="object-contain drop-shadow-2xl"
                priority
              />
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight">
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-white to-cyan-200">
            Trans Laut Jawa Timur
          </span>
        </h1>
        
        <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-300 mb-10 leading-relaxed">
          Layanan transportasi laut modern yang menghubungkan Probolinggo dan Madura dengan cepat, aman, dan nyaman.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Link 
            href="#maps" 
            className="px-8 py-4 bg-white hover:bg-blue-50 text-blue-900 rounded-full font-bold text-lg transition-all shadow-xl shadow-blue-900/20 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 group"
          >
            <span>Pantau Kapal</span>
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
          <Link 
            href="#translautjatim" 
            className="px-8 py-4 bg-transparent hover:bg-white/10 text-white border-2 border-white rounded-full font-bold text-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg"
          >
            Informasi Layanan
          </Link>
        </div>
      </div>
      
      {/* Scroll Indicator */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 animate-bounce text-slate-400">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </div>
  );
}
