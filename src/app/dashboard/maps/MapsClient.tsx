'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, MapPin, RefreshCw } from 'lucide-react';
import type {
  Icon as LeafletIcon,
  Map as LeafletMap,
  Marker as LeafletMarker,
} from 'leaflet';

const DEFAULT_CENTER = { lat: -6.2, lng: 106.816666 };

type ProjectApi = {
  id: string;
  name: string;
  lastLat?: number | string | null;
  lastLng?: number | string | null;
  lastSpeedKn?: number | string | null;
  lastHeadingDeg?: number | string | null;
  lastReportedAt?: string | null;
};

type ProjectLocation = {
  id: string;
  name: string;
  lastLat: number | null;
  lastLng: number | null;
  lastSpeedKn: number | null;
  lastHeadingDeg: number | null;
  lastReportedAt: string | null;
};

const fetchProjects = async (): Promise<ProjectApi[]> => {
  const response = await fetch('/api/projects');
  if (!response.ok) {
    throw new Error('Gagal memuat data kapal');
  }
  return response.json();
};

const parseNumber = (value?: number | string | null) => {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatCoordinate = (value: number | null) => {
  if (value === null) return '-';
  return value.toFixed(5);
};

const formatNumber = (value: number | null, digits = 1) => {
  if (value === null) return '-';
  return value.toFixed(digits);
};

const buildOsmEmbedUrl = (
  center: { lat: number; lng: number },
  showMarker: boolean
) => {
  const latOffset = showMarker ? 0.005 : 4;
  const lngOffset = showMarker ? 0.008 : 6;
  const bbox = [
    center.lng - lngOffset,
    center.lat - latOffset,
    center.lng + lngOffset,
    center.lat + latOffset,
  ]
    .map((value) => value.toFixed(6))
    .join(',');

  const markerParam = showMarker
    ? `&marker=${encodeURIComponent(`${center.lat},${center.lng}`)}`
    : '';

  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
    bbox
  )}&layer=mapnik${markerParam}`;
};

const buildOsmLink = (center: { lat: number; lng: number }, zoom: number) =>
  `https://www.openstreetmap.org/?mlat=${center.lat}&mlon=${center.lng}#map=${zoom}/${center.lat}/${center.lng}`;

export default function MapsClient() {
  const {
    data: projects = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['map-projects'],
    queryFn: fetchProjects,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    select: (data) =>
      data.map(
        (project): ProjectLocation => ({
          id: project.id,
          name: project.name,
          lastLat: parseNumber(project.lastLat),
          lastLng: parseNumber(project.lastLng),
          lastSpeedKn: parseNumber(project.lastSpeedKn),
          lastHeadingDeg: parseNumber(project.lastHeadingDeg),
          lastReportedAt: project.lastReportedAt ?? null,
        })
      ),
  });

  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    if (!projects.length) {
      return;
    }

    const selectedExists = projects.some(
      (project) => project.id === selectedId
    );
    if (selectedId && selectedExists) {
      return;
    }

    const withLocation = projects.find(
      (project) => project.lastLat !== null && project.lastLng !== null
    );
    setSelectedId((withLocation ?? projects[0])?.id ?? '');
  }, [projects, selectedId]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedId) ?? null,
    [projects, selectedId]
  );
  const speedValue = selectedProject?.lastSpeedKn ?? null;
  const headingValue = selectedProject?.lastHeadingDeg ?? null;

  const hasLocation = Boolean(
    selectedProject &&
      selectedProject.lastLat !== null &&
      selectedProject.lastLng !== null
  );

  const center = useMemo(() => {
    if (
      selectedProject &&
      selectedProject.lastLat !== null &&
      selectedProject.lastLng !== null
    ) {
      return { lat: selectedProject.lastLat, lng: selectedProject.lastLng };
    }
    return DEFAULT_CENTER;
  }, [selectedProject]);

  const mapZoom = hasLocation ? 14 : 5;
  // const mapSrc = useMemo(
  //   () => buildOsmEmbedUrl(center, Boolean(hasLocation)),
  //   [center, hasLocation]
  // );
  const mapLink = useMemo(
    () => buildOsmLink(center, mapZoom),
    [center, mapZoom]
  );
  const reportedAtText = useMemo(() => {
    if (!selectedProject?.lastReportedAt) {
      return '-';
    }
    const reportedAt = new Date(selectedProject.lastReportedAt);
    if (Number.isNaN(reportedAt.getTime())) {
      return '-';
    }
    return reportedAt.toLocaleString('id-ID');
  }, [selectedProject?.lastReportedAt]);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const iconRef = useRef<LeafletIcon | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    let isMounted = true;

    const initMap = async () => {
      const L = await import('leaflet');
      if (!isMounted || !mapContainerRef.current || mapRef.current) {
        return;
      }

      leafletRef.current = L;
      iconRef.current = L.icon({
        iconUrl: '/icons/ship-icon.png',
        // iconUrl: '/icons/ship-marker.svg',
        iconSize: [50, 50],
        iconAnchor: [18, 18],
      });

      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      mapRef.current = map;
      setIsMapReady(true);
    };

    void initMap();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
      }
      mapRef.current = null;
      markerRef.current = null;
      iconRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !isMapReady) {
      return;
    }

    map.setView([center.lat, center.lng], mapZoom);

    if (hasLocation) {
      if (!markerRef.current) {
        const icon =
          iconRef.current ??
          L.icon({
            iconUrl: '/icons/ship-marker.svg',
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          });
        iconRef.current = icon;
        markerRef.current = L.marker([center.lat, center.lng], {
          icon,
        }).addTo(map);
      } else {
        markerRef.current.setLatLng([center.lat, center.lng]);
      }
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [center.lat, center.lng, hasLocation, isMapReady, mapZoom]);

  return (
    <div className='space-y-6'>
      <div className='card border-[var(--color-border)] bg-white p-8 shadow-lg'>
        <p className='text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-primary-strong)]'>
          Tracking and Maps
        </p>
        <h1 className='mt-3 text-2xl font-semibold text-[var(--color-text)]'>
          Tracking and Maps
        </h1>
        <p className='mt-2 text-[var(--color-muted)]'>
          Pantau posisi kapal yang terdaftar di proyek Anda. Pilih kapal untuk
          menampilkan marker lokasi terakhir pada peta OpenStreetMap.
        </p>
      </div>

      <div className='grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]'>
        <div className='card border-[var(--color-border)] bg-white p-6 shadow-lg'>
          <div className='flex items-center justify-between'>
            <h2 className='text-lg font-semibold text-[var(--color-text)]'>
              Pilih Kapal
            </h2>
            <button
              type='button'
              onClick={() => refetch()}
              disabled={isFetching}
              className='inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-primary-strong)] hover:text-[var(--color-primary)] disabled:text-[var(--color-muted)]'
            >
              <RefreshCw className='h-4 w-4' />
              {isFetching ? 'Memuat' : 'Refresh'}
            </button>
          </div>

          <div className='mt-4'>
            <label
              htmlFor='projectSelect'
              className='block text-sm font-medium text-[var(--color-text)]'
            >
              Kapal Terdaftar
            </label>
            <div className='relative mt-2'>
              <div className='absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none'>
                <MapPin className='h-4 w-4 text-[var(--color-primary)]' />
              </div>
              <select
                id='projectSelect'
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
                disabled={isLoading || projects.length === 0}
                className='w-full appearance-none pl-10 pr-9 py-2.5 border border-[var(--color-border)] bg-white text-[var(--color-text)] rounded-lg text-sm font-medium 
                  hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-strong)] focus:border-transparent
                  transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed disabled:text-[var(--color-muted)]'
              >
                <option value=''>
                  {isLoading ? 'Memuat data kapal...' : 'Pilih kapal'}
                </option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <div className='absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none'>
                <ChevronDown className='h-4 w-4 text-[var(--color-muted)]' />
              </div>
            </div>
          </div>

          {error && (
            <div className='mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600'>
              {(error as Error).message}
            </div>
          )}

          <div className='mt-6 rounded-lg border border-[var(--color-border)] bg-slate-50 p-4'>
            <p className='text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]'>
              Detail Kapal
            </p>
            <p className='mt-2 text-base font-semibold text-[var(--color-text)]'>
              {selectedProject?.name ?? 'Belum ada kapal dipilih'}
            </p>
            <div className='mt-4 grid gap-3 text-sm text-[var(--color-text)]'>
              <div className='flex items-center justify-between'>
                <span className='text-[var(--color-muted)]'>Latitude</span>
                <span className='font-semibold'>
                  {formatCoordinate(selectedProject?.lastLat ?? null)}
                </span>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-[var(--color-muted)]'>Longitude</span>
                <span className='font-semibold'>
                  {formatCoordinate(selectedProject?.lastLng ?? null)}
                </span>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-[var(--color-muted)]'>Kecepatan</span>
                <span className='font-semibold'>
                  {speedValue === null ? '-' : `${formatNumber(speedValue)} kn`}
                </span>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-[var(--color-muted)]'>Heading</span>
                <span className='font-semibold'>
                  {headingValue === null
                    ? '-'
                    : `${formatNumber(headingValue, 0)} deg`}
                </span>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-[var(--color-muted)]'>
                  Update Terakhir
                </span>
                <span className='font-semibold text-right'>
                  {reportedAtText}
                </span>
              </div>
            </div>
          </div>

          {!projects.length && !isLoading && !error && (
            <div className='mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700'>
              Belum ada kapal yang bisa dipantau. Tambahkan proyek terlebih
              dahulu.
            </div>
          )}
        </div>

        <div className='card border-[var(--color-border)] bg-white p-6 shadow-lg'>
          <div className='flex items-start justify-between gap-4'>
            <div>
              <h2 className='text-lg font-semibold text-[var(--color-text)]'>
                Peta Posisi Kapal
              </h2>
              <p className='text-sm text-[var(--color-muted)]'>
                Sumber peta: OpenStreetMap
              </p>
            </div>
            <a
              href={mapLink}
              target='_blank'
              rel='noreferrer'
              className='text-xs font-semibold text-[var(--color-primary-strong)] hover:text-[var(--color-primary)]'
            >
              Buka OSM
            </a>
          </div>

          <div className='relative mt-4 h-[520px] w-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-slate-100 lg:h-[600px]'>
            <div ref={mapContainerRef} className='h-full w-full' />
            {/* Legacy iframe embed (kept for quick rollback)
            <iframe
              title='OpenStreetMap'
              src={mapSrc}
              className='h-full w-full'
              loading='lazy'
            />
            */}
            {!hasLocation && (
              <div className='absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-semibold text-[var(--color-muted)]'>
                Lokasi kapal belum tersedia
              </div>
            )}
          </div>
          <p className='mt-3 text-xs text-[var(--color-muted)]'>
            Marker hanya muncul jika kapal sudah mengirim laporan posisi.
          </p>
        </div>
      </div>
    </div>
  );
}
