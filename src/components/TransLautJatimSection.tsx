'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';

export default function TransLautJatimSection() {
  const images = [
    '/carousel/ship_sea.png',
    '/carousel/launch_event.png',
    '/carousel/group_photo.png',
  ];

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 5000); // Change image every 5 seconds

    return () => clearInterval(interval);
  }, [images.length]);

  return (
    <section id="translautjatim" className="relative py-20 bg-white overflow-hidden flex items-center min-h-screen">
      
      {/* Background Decor */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-blue-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-cyan-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 items-center">
            
          {/* Content */}
          <div className="flex-1 space-y-6">
             <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
              Resmi Diluncurkan
            </div>
            
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 leading-tight">
              Layanan Kapal Cepat <br/>
              <span className="text-blue-600">Trans Laut Jawa Timur</span>
            </h2>
            
            <div className="prose prose-lg text-slate-600 text-justify">
              <p>
                Rabu, 10 Desember 2025 menjadi momentum terhubungnya maritim di Jawa Timur dengan peluncuran <strong>Trans Laut Jawa Timur</strong>. 
                Layanan kapal cepat ini hadir sebagai penghubung strategis antara <strong>Probolinggo</strong> dengan sejumlah pulau di perairan Madura.
              </p>
              <p>
                 Acara peluncuran di Pelabuhan DABN Probolinggo ini dihadiri oleh para pemangku kepentingan, menjadi wujud dukungan kuat dari Pemerintah Provinsi Jawa Timur terhadap peningkatan layanan transportasi laut yang <strong>modern, cepat, dan terjangkau</strong>.
              </p>
              
               <h3 className="text-xl font-bold text-slate-800 mt-6 mb-2">Rute Strategis & Efisien</h3>
               <p>
                Melayani rute dari Pelabuhan DABN Probolinggo menuju:
               </p>
               <ul className="list-disc pl-5 space-y-1">
                 <li>Gili Ketapang</li>
                 <li>Gili Mandangin</li>
                 <li>Branta</li>
                 
               </ul>
               <p className="mt-4">
                 Dengan waktu tempuh hanya sekitar <strong>2 jam</strong> dari Probolinggo menuju Pulau Madura, Trans Laut Jawa Timur menawarkan pengalaman perjalanan yang lebih efisien, aman, dan nyaman.
               </p>
            </div>
          </div>
          
           {/* Visual / Image Carousel */}
           <div className="flex-1 w-full">
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border-4 border-white transform hover:scale-[1.02] transition-transform duration-500 bg-slate-100 group">
             
             {/* Carousel Images */}
             {images.map((src, index) => (
              <div 
                key={src}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                  index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                }`}
              >
                 <Image
                  src={src}
                  alt={`Trans Laut Jatim Image ${index + 1}`}
                  fill
                  className="object-cover"
                  priority={index === 0}
                />
                 {/* Gradient Overlay */}
                 <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-60"></div>
              </div>
            ))}

            {/* Navigation Indicators */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-3">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`h-3 rounded-full transition-all duration-300 shadow-sm ${
                    index === currentIndex 
                      ? 'bg-blue-600 w-8 scale-110' 
                      : 'bg-white/70 w-3 hover:bg-white hover:scale-110'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
