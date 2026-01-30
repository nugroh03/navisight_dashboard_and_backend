'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet';
import { useQuery } from '@tanstack/react-query';
import { Loader2, LocateFixed, RefreshCw } from 'lucide-react';
import Image from 'next/image';

const DEFAULT_CENTER = { lat: -7.2575, lng: 112.7521 }; // Surabaya Default
const DEFAULT_ZOOM = 14;
const REFRESH_INTERVAL = 5000; // 5 seconds

type Ship = {
  id: string;
  name: string;
  lastLat: number | null;
  lastLng: number | null;
  lastSpeedKn: number | null;
  lastHeadingDeg: number | null;
  lastReportedAt: string | null;
};

const fetchShips = async (): Promise<Ship[]> => {
  const response = await fetch('/api/public/ships');
  if (!response.ok) {
    throw new Error('Gagal memuat data kapal');
  }
  const data = await response.json();
  return data.map((item: any) => ({
    ...item,
    lastLat: item.lastLat ? Number(item.lastLat) : null,
    lastLng: item.lastLng ? Number(item.lastLng) : null,
    lastSpeedKn: item.lastSpeedKn ? Number(item.lastSpeedKn) : null,
    lastHeadingDeg: item.lastHeadingDeg ? Number(item.lastHeadingDeg) : null,
  }));
};

export default function PublicMap() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<{ [id: string]: LeafletMarker }>({});
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const hasAutoFocusedRef = useRef(false);
  const [isMapReady, setIsMapReady] = useState(false);

  const {
    data: ships = [],
    isLoading,
    isFetching,
    refetch,
    error,
  } = useQuery({
    queryKey: ['public-ships'],
    queryFn: () => fetchShips(),
    refetchInterval: REFRESH_INTERVAL,
    refetchIntervalInBackground: true,
  });

  // Calculate center based on ships or default
  const center = useMemo(() => {
    const activeShips = ships.filter(
      (s) => s.lastLat !== null && s.lastLng !== null,
    );
    if (activeShips.length > 0) {
      // Find average center or jus take the first one?
      // For now, let's just focus on the first one or default if many
      // Ideally fitBounds, but simple center is fine for now.
      return { lat: activeShips[0].lastLat!, lng: activeShips[0].lastLng! };
    }
    return DEFAULT_CENTER;
  }, [ships]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    let isMounted = true;

    const initMap = async () => {
      const L = await import('leaflet');

      if (!isMounted) return;
      if (mapRef.current) return;
      if (!mapContainerRef.current) return;

      // Check if the container already has a map instance (leaflets internal property)
      // @ts-ignore
      if (mapContainerRef.current._leaflet_id) {
        return;
      }

      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], DEFAULT_ZOOM);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapRef.current = map;
      leafletRef.current = L;
      setIsMapReady(true);
    };

    void initMap();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setIsMapReady(false);
      }
    };
  }, []);

  const focusOnShips = () => {
    if (!isMapReady || !leafletRef.current || !mapRef.current) return;

    const L = leafletRef.current;
    const map = mapRef.current;
    const activeShips = ships.filter(
      (s) => s.lastLat !== null && s.lastLng !== null,
    );

    if (activeShips.length === 0) {
      map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], DEFAULT_ZOOM);
      return;
    }

    if (activeShips.length === 1) {
      map.setView(
        [activeShips[0].lastLat!, activeShips[0].lastLng!],
        DEFAULT_ZOOM,
      );
      return;
    }

    const bounds = L.latLngBounds(
      activeShips.map(
        (ship) => [ship.lastLat!, ship.lastLng!] as [number, number],
      ),
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: DEFAULT_ZOOM });
  };

  useEffect(() => {
    if (!isMapReady || !mapRef.current || hasAutoFocusedRef.current) return;

    const activeShips = ships.filter(
      (s) => s.lastLat !== null && s.lastLng !== null,
    );
    if (activeShips.length === 0) return;

    mapRef.current.setView(
      [activeShips[0].lastLat!, activeShips[0].lastLng!],
      DEFAULT_ZOOM,
    );
    hasAutoFocusedRef.current = true;
  }, [isMapReady, ships]);

  // Update Markers
  useEffect(() => {
    if (!isMapReady || !leafletRef.current || !mapRef.current) return;

    const L = leafletRef.current;
    const map = mapRef.current;

    ships.forEach((ship) => {
      if (ship.lastLat !== null && ship.lastLng !== null) {
        let marker = markersRef.current[ship.id];

        const icon = L.divIcon({
          className: 'custom-ship-marker',
          html: `<div class="w-8 h-8 relative">
                   <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20"></div>
                   <div class="absolute inset-0 m-1 bg-[var(--color-primary-strong)] rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                     <svg class="w-4 h-4 text-white transform ${ship.lastHeadingDeg ? `rotate-[${ship.lastHeadingDeg}deg]` : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                     </svg>
                   </div>
                 </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        if (!marker) {
          marker = L.marker([ship.lastLat, ship.lastLng], { icon }).addTo(map);
          marker.bindPopup(`
            <div class="p-2 min-w-[200px]">
              <h3 class="font-bold text-base mb-1">${ship.name}</h3>
              <div class="space-y-1 text-sm text-slate-600">
                <div class="flex justify-between"><span>Speed:</span> <span class="font-medium">${ship.lastSpeedKn?.toFixed(1) ?? 0} kn</span></div>
                <div class="flex justify-between"><span>Heading:</span> <span class="font-medium">${ship.lastHeadingDeg?.toFixed(0) ?? 0}°</span></div>
                <div class="text-xs text-slate-400 mt-2">Last update: ${new Date(ship.lastReportedAt || Date.now()).toLocaleString('id-ID')}</div>
              </div>
            </div>
          `);
          markersRef.current[ship.id] = marker;
        } else {
          marker.setLatLng([ship.lastLat, ship.lastLng]);
          marker.setIcon(icon);
        }
      }
    });

    // Remove markers for ships that no longer exist in data
    Object.keys(markersRef.current).forEach((id) => {
      if (!ships.find((s) => s.id === id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Auto fit bounds if ships exist and it's the first load or something?
    // For now, let's just keep center or user control.
  }, [ships, isMapReady]);

  return (
    <div className='relative w-full h-full bg-slate-100 overflow-hidden'>
      {/* Map Container */}
      <div ref={mapContainerRef} className='absolute inset-0 z-0' />

      {/* Loading Overlay */}
      {isLoading && (
        <div className='absolute inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-sm'>
          <div className='flex flex-col items-center gap-2'>
            <Loader2 className='w-10 h-10 text-[var(--color-primary-strong)] animate-spin' />
            <span className='font-semibold text-[var(--color-primary-strong)]'>
              Memuat Data Kapal...
            </span>
          </div>
        </div>
      )}

      {/* Floating Info / Refresh */}
      {/* This is handled by parent or header, but we can add a refresh button on map */}
      <div className='absolute top-24 right-4 z-[400] flex flex-col gap-2'>
        <button
          onClick={focusOnShips}
          className='bg-white p-3 rounded-full shadow-lg border border-slate-200 hover:bg-slate-50 transition-colors group'
          title='Fokus Kapal'
        >
          <LocateFixed className='w-5 h-5 text-slate-600 group-hover:text-blue-600' />
        </button>
        {/* <button
          onClick={() => refetch()}
          className='bg-white p-3 rounded-full shadow-lg border border-slate-200 hover:bg-slate-50 transition-colors group'
          title='Refresh Data'
        >
          <RefreshCw
            className={`w-5 h-5 text-slate-600 group-hover:text-blue-600 ${isFetching ? 'animate-spin' : ''}`}
          />
        </button> */}
      </div>

      {/* Stats Overlay at Bottom */}
      <div className='absolute bottom-8 left-4 right-4 md:left-8 md:w-80 z-[400]'>
        <div className='bg-white/90 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/50'>
          <h3 className='font-bold text-slate-800 text-lg mb-2 flex items-center gap-2'>
            <span className='w-2 h-2 rounded-full bg-green-500 animate-pulse'></span>
            Armada Aktif
          </h3>
          <div className='grid grid-cols-2 gap-4'>
            <div className='bg-blue-50/50 p-3 rounded-xl border border-blue-100'>
              <div className='text-xs text-slate-500 uppercase font-semibold tracking-wider'>
                Total Kapal
              </div>
              <div className='text-2xl font-bold text-blue-700'>
                {ships.length}
              </div>
            </div>
            <div className='bg-cyan-50/50 p-3 rounded-xl border border-cyan-100'>
              <div className='text-xs text-slate-500 uppercase font-semibold tracking-wider'>
                Online
              </div>
              {/* Mock online count or based on recent reportedAt */}
              <div className='text-2xl font-bold text-cyan-700'>
                {
                  ships.filter((s) => {
                    if (!s.lastReportedAt) return false;
                    const diff =
                      Date.now() - new Date(s.lastReportedAt).getTime();
                    return diff < 60 * 60 * 1000; // 1 hour
                  }).length
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
