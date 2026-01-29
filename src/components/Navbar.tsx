'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Beranda', href: '#hero' },
    { name: 'Maps', href: '#maps' },
  ];

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 px-4 pointer-events-none">
      <nav
        className={`w-full max-w-7xl rounded-full transition-all duration-300 pointer-events-auto bg-white/90 backdrop-blur-md border border-white/50 py-3 px-6 shadow-lg`}
      >
        <div className="flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center gap-3">
            <div className="relative w-32 h-8 md:w-36 md:h-9">
               <Image
                src="/trans_laut_logo.png"
                alt="Trans Laut Jatim"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-2">
             <div className="flex items-center rounded-full p-1 mr-2">
                {navLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    className="px-6 py-2 rounded-full text-sm font-bold tracking-wide transition-all text-blue-900 hover:text-blue-600 hover:bg-blue-50"
                  >
                    {link.name}
                  </a>
                ))}
            </div>
            
            <Link
              href="/login"
              className="px-8 py-3 rounded-full font-bold transition-all shadow-lg text-sm hover:scale-105 active:scale-95 bg-blue-600 hover:bg-blue-700 !text-white shadow-blue-500/30"
            >
              Masuk
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-full hover:bg-slate-100 text-slate-800"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu (Integrated into floating island context) */}
        {isMobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 p-2">
             <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-4 space-y-2">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="block px-4 py-3 text-base font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-50 rounded-xl"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.name}
                </a>
              ))}
              <div className="pt-2">
                <Link
                  href="/login"
                  className="block w-full text-center bg-blue-600 text-white px-5 py-3 rounded-xl font-bold shadow-lg"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Masuk
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>
    </div>
  );
}
