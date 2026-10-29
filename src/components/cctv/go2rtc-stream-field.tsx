'use client';

import type { UseFormRegisterReturn } from 'react-hook-form';
import { useGo2rtcStreams } from '@/hooks/use-cctv';

interface Go2rtcStreamFieldProps {
  registration: UseFormRegisterReturn;
  value?: string | null;
  disabled?: boolean;
  hasError?: boolean;
}

// Pilihan nama stream dari daftar yang benar-benar ada di go2rtc, agar tidak
// terjadi salah ketik (mis. "vip-cam141"). Jika daftar gagal dimuat, kembali
// ke input teks biasa.
export function Go2rtcStreamField({
  registration,
  value,
  disabled,
  hasError,
}: Go2rtcStreamFieldProps) {
  const { data: streams, isLoading, isError } = useGo2rtcStreams(true);
  const className = `input-field w-full ${hasError ? 'border-red-500' : ''}`;

  if (isLoading) {
    return (
      <select id='go2rtcStream' disabled className={className}>
        <option>Memuat daftar stream...</option>
      </select>
    );
  }

  if (isError || !streams) {
    return (
      <>
        <input
          id='go2rtcStream'
          {...registration}
          placeholder='contoh: cam141'
          disabled={disabled}
          className={className}
        />
        <p className='text-xs text-amber-600'>
          Daftar stream go2rtc tidak bisa dimuat; ketik nama persis seperti di
          konfigurasi go2rtc.
        </p>
      </>
    );
  }

  const isUnknown = !!value && !streams.includes(value);

  return (
    <select
      id='go2rtcStream'
      {...registration}
      disabled={disabled}
      className={className}
    >
      <option value=''>— Tidak dipakai —</option>
      {isUnknown && (
        <option value={value}>{value} (tidak ada di go2rtc)</option>
      )}
      {streams.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}
