'use client';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-white py-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          
          <div className="text-center md:text-left">
             <h3 className="text-lg font-bold mb-1">Trans Laut Jawa Timur</h3>
             <p className="text-slate-400 text-sm">Menghubungkan Maritim Jawa Timur</p>
          </div>

          <div className="flex gap-6 text-sm text-slate-400">
            <span className="hover:text-white transition-colors cursor-pointer">Privacy Policy</span>
            <span className="hover:text-white transition-colors cursor-pointer">Terms of Service</span>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
          <p>© 2026 Bidang Pelayaran Dinas Perhubungan Provinsi Jawa Timur — All rights reserved</p>
        </div>
      </div>
    </footer>
  );
}
