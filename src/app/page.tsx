import Link from 'next/link';
import Image from 'next/image';
import PublicMap from '@/components/PublicMap';

export default function Home() {
  const mapsApiKey = process.env.MAPS_API_KEY || '';

  return (
    <div className="relative h-screen w-full overflow-hidden bg-slate-900">
      
      {/* Background Map - Full Screen */}
      <div className="absolute inset-0 z-0">
        <PublicMap apiKey={mapsApiKey} />
      </div>

      <header className="absolute top-4 left-4 right-4 md:top-6 md:left-6 md:right-6 z-20 flex justify-center pointer-events-none">
        <div className="flex items-center justify-between w-full max-w-7xl px-4 py-3 md:px-6 md:py-4 bg-white/90 backdrop-blur-md shadow-xl rounded-xl md:rounded-2xl border border-white/50 pointer-events-auto transition-all hover:bg-white/95">
          {/* Logo Section */}
          <div className="flex items-center gap-3 md:gap-4">
            <div className="relative w-32 h-10 md:w-52 md:h-14">
              <Image
                src="/trans_laut_logo.png"
                alt="Trans Laut Jawa Timur"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="hidden md:block w-px h-10 bg-slate-200 mx-2"></div>
            <div className="hidden md:flex flex-col">
              <span className="text-xs font-bold text-slate-700 tracking-wider uppercase">Trans Laut Jatim Operations</span>
              <span className="text-[10px] font-semibold text-slate-500">Live Surveillance Console</span>
            </div>
          </div>

          {/* Action Button */}
          <Link 
            href="/login" 
            className="flex items-center gap-2 md:gap-3 px-4 py-2 md:px-8 md:py-3 bg-blue-600 hover:bg-blue-700 text-white !text-white font-bold rounded-lg md:rounded-xl transition-all shadow-md md:shadow-lg hover:shadow-blue-500/30 active:scale-95 group"
          >
            <span className="tracking-wide text-sm md:text-base">Masuk</span>
            <svg className="w-4 h-4 md:w-5 md:h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </header>
      
      {/* No complex text hero, just the map is the hero as requested */}
      
    </div>
  );
}
