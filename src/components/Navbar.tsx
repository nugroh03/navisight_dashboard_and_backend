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

  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-4 md:pt-6 pointer-events-none">
      {/* Latar gelap di belakang menu mobile; tap untuk menutup */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-[2px] pointer-events-auto md:hidden"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      <nav
        className={`relative w-full max-w-7xl transition-all duration-300 pointer-events-auto backdrop-blur-md border border-white/50 shadow-lg py-2 pl-5 pr-2 md:py-3 md:px-6 rounded-full ${
          isMobileMenuOpen
            ? 'bg-white max-md:rounded-3xl'
            : 'bg-white/90'
        }`}
      >
        <div className="flex items-center justify-between">
          
          {/* Logo */}
          <a href="#hero" onClick={closeMenu} className="flex-shrink-0 flex items-center gap-3">
            <div className="relative w-28 h-10 md:w-36 md:h-9">
               <Image
                src="/trans_laut_logo.png"
                alt="Trans Laut Jatim"
                fill
                className="object-contain object-left"
                priority
              />
            </div>
          </a>

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
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="flex h-11 w-11 items-center justify-center rounded-full text-slate-800 transition active:bg-slate-200 hover:bg-slate-100"
              aria-label={isMobileMenuOpen ? 'Tutup menu' : 'Buka menu'}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu: menyatu di dalam kartu navbar */}
        {isMobileMenuOpen && (
          <div id="mobile-menu" className="md:hidden mt-2 mr-3 mb-3 border-t border-slate-100 pt-3 space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="block px-4 py-3 text-base font-semibold !text-slate-800 rounded-xl transition hover:bg-slate-50 active:bg-slate-100"
                onClick={closeMenu}
              >
                {link.name}
              </a>
            ))}
            <div className="pt-2">
              <Link
                href="/login"
                className="block w-full text-center bg-blue-600 !text-white px-5 py-3.5 rounded-xl text-base font-bold shadow-lg shadow-blue-600/30 transition active:scale-[0.98] active:bg-blue-700"
                onClick={closeMenu}
              >
                Masuk
              </Link>
            </div>
          </div>
        )}
      </nav>
    </div>
  );
}
