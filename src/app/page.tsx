import Link from 'next/link';
import Image from 'next/image';
import PublicMap from '@/components/PublicMap';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import TransLautJatimSection from '@/components/TransLautJatimSection';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      {/* Hero Section */}
      <Hero />
      
      {/* Info Section (Beranda) */}
      <TransLautJatimSection />
      
      {/* Map Section */}
      <div id="maps" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="text-center mb-10">
             <h2 className="text-3xl font-bold text-slate-900">Pantau Posisi Kapal</h2>
             <p className="text-slate-500 mt-2">Real-time tracking armada Trans Laut Jawa Timur</p>
           </div>
           
           <div className="relative w-full h-[600px] rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
              <PublicMap />
           </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
