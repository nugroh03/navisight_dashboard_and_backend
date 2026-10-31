'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  Joystick,
  Loader2,
  Mic,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useCameraListen } from '@/hooks/use-camera-listen';
import { useCameraTalk } from '@/hooks/use-camera-talk';
import { PtzControls, type PtzSheetTab } from '@/components/cctv/ptz-controls';
import { formatElapsed } from '@/components/cctv/talk-button';

interface CameraMobileControlsProps {
  cameraId: string;
  audioEnabled: boolean;
  ptzEnabled: boolean;
  videoRef: RefObject<HTMLElement | null>;
}

type OpenSheet = 'audio' | 'ptz' | null;

const PTZ_TABS: { id: PtzSheetTab; label: string }[] = [
  { id: 'control', label: 'Kontrol PTZ' },
  { id: 'preset', label: 'Preset' },
  { id: 'speed', label: 'Kecepatan' },
];

const BAR_COUNT = 11;

// Bar mengikuti suara mic yang sebenarnya, jadi terlihat bila mic tidak menangkap suara.
function MicLevelBars({ stream }: { stream: MediaStream | null }) {
  const barsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!stream) return;
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 64;
    context.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;
    const draw = () => {
      analyser.getByteFrequencyData(data);
      const bars = barsRef.current?.children;
      if (bars) {
        for (let i = 0; i < bars.length; i += 1) {
          const level = data[i + 1] / 255;
          (bars[i] as HTMLElement).style.height = `${12 + level * 88}%`;
        }
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(frame);
      void context.close();
    };
  }, [stream]);

  return (
    <div
      ref={barsRef}
      aria-hidden='true'
      className='flex h-14 items-center justify-center gap-1.5'
    >
      {Array.from({ length: BAR_COUNT }, (_, index) => (
        <span
          key={index}
          className='w-1 rounded-full bg-red-500 transition-[height] duration-75'
          style={{ height: '12%' }}
        />
      ))}
    </div>
  );
}

function IconButton({
  label,
  active,
  activeClass,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  activeClass: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type='button'
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-14 w-14 items-center justify-center rounded-full shadow-sm ring-1 transition-colors ${
        active ? activeClass : 'bg-white text-slate-600 ring-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

function Sheet({
  labelledBy,
  open,
  children,
}: {
  labelledBy: string;
  open: boolean;
  children: ReactNode;
}) {
  // Tanpa latar gelap agar video tetap terlihat saat kamera digerakkan.
  return (
    <div
      role='dialog'
      aria-labelledby={labelledBy}
      hidden={!open}
      className='fixed inset-x-0 bottom-0 z-[60] max-h-[55vh] overflow-y-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(15,23,42,0.18)]'
    >
      {children}
    </div>
  );
}

export function CameraMobileControls({
  cameraId,
  audioEnabled,
  ptzEnabled,
  videoRef,
}: CameraMobileControlsProps) {
  const {
    state: listenState,
    error: listenError,
    volume,
    setVolume,
    attachAudio,
    start: startListen,
    stop: stopListen,
  } = useCameraListen(cameraId);
  const talk = useCameraTalk(cameraId);
  const [openSheet, setOpenSheet] = useState<OpenSheet>(null);
  const [ptzTab, setPtzTab] = useState<PtzSheetTab>('control');

  if (!audioEnabled && !ptzEnabled) return null;

  // Sheet menutupi bagian bawah layar, jadi video dibawa ke atas agar tetap terlihat.
  const showSheet = (sheet: OpenSheet) => {
    setOpenSheet(sheet);
    videoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleMic = () => {
    if (talk.state === 'idle') void talk.start();
    showSheet('audio');
  };

  const isTalkActive = talk.state !== 'idle';
  const audioError = listenError || talk.error;

  return (
    <div className='space-y-3'>
      <audio ref={attachAudio} autoPlay />

      <div className='flex items-start justify-center gap-6 py-1'>
        {audioEnabled && (
          <div className='flex flex-col items-center gap-1.5'>
            <IconButton
              label={
                listenState === 'idle'
                  ? 'Dengarkan kamera'
                  : 'Berhenti mendengarkan'
              }
              active={listenState !== 'idle'}
              activeClass='bg-emerald-600 text-white ring-emerald-600'
              onClick={() =>
                listenState === 'idle' ? void startListen() : stopListen()
              }
            >
              {listenState === 'connecting' ? (
                <Loader2 className='h-6 w-6 animate-spin' />
              ) : listenState === 'listening' ? (
                <Volume2 className='h-6 w-6' />
              ) : (
                <VolumeX className='h-6 w-6' />
              )}
            </IconButton>
            <span className='text-xs text-[var(--color-muted)]'>Suara</span>
          </div>
        )}

        {audioEnabled && (
          <div className='flex flex-col items-center gap-1.5'>
            <IconButton
              label='Bicara ke kamera'
              active={isTalkActive}
              activeClass='bg-red-600 text-white ring-red-600'
              onClick={handleMic}
            >
              <Mic className='h-6 w-6' />
            </IconButton>
            <span className='text-xs tabular-nums text-[var(--color-muted)]'>
              {talk.state === 'talking' ? formatElapsed(talk.elapsed) : 'Mic'}
            </span>
          </div>
        )}

        {ptzEnabled && (
          <div className='flex flex-col items-center gap-1.5'>
            <IconButton
              label='Kontrol PTZ'
              active={openSheet === 'ptz'}
              activeClass='bg-[var(--color-primary)] text-white ring-[var(--color-primary)]'
              onClick={() =>
                openSheet === 'ptz' ? setOpenSheet(null) : showSheet('ptz')
              }
            >
              <Joystick className='h-6 w-6' />
            </IconButton>
            <span className='text-xs text-[var(--color-muted)]'>PTZ</span>
          </div>
        )}
      </div>

      {listenState === 'listening' && (
        <label className='flex items-center gap-3 px-2 text-sm text-[var(--color-muted)]'>
          Volume
          <input
            type='range'
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            className='flex-1'
          />
        </label>
      )}

      {audioError && openSheet !== 'audio' && (
        <p role='alert' className='text-center text-sm text-red-600'>
          {audioError}
        </p>
      )}

      {audioEnabled && (
        <Sheet labelledBy='two-way-title' open={openSheet === 'audio'}>
          <div className='relative space-y-4 p-5'>
            <h3
              id='two-way-title'
              className='text-center font-semibold text-[var(--color-text)]'
            >
              Bicara ke Kamera
            </h3>
            <button
              type='button'
              aria-label='Tutup'
              onClick={() => setOpenSheet(null)}
              className='absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100'
            >
              <X className='h-5 w-5' />
            </button>

            {talk.state === 'idle' ? (
              <>
                {talk.error && (
                  <p role='alert' className='text-center text-sm text-red-600'>
                    {talk.error}
                  </p>
                )}
                <button
                  type='button'
                  onClick={() => void talk.start()}
                  className='flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-primary-strong)] text-sm font-semibold text-white'
                >
                  <Mic className='h-4 w-4' />
                  Mulai bicara
                </button>
              </>
            ) : (
              <>
                <MicLevelBars
                  stream={talk.state === 'talking' ? talk.mic : null}
                />
                <p
                  role='status'
                  className='text-center text-sm text-[var(--color-muted)]'
                >
                  {talk.state === 'talking'
                    ? `Mic aktif · ${formatElapsed(talk.elapsed)}`
                    : 'Menyambungkan...'}
                </p>
                <button
                  type='button'
                  onClick={() => {
                    talk.stop();
                    setOpenSheet(null);
                  }}
                  className='h-12 w-full rounded-full bg-red-500 text-sm font-semibold text-white'
                >
                  Akhiri
                </button>
              </>
            )}
          </div>
        </Sheet>
      )}

      {ptzEnabled && (
        <Sheet labelledBy='ptz-sheet-title' open={openSheet === 'ptz'}>
          <h3 id='ptz-sheet-title' className='sr-only'>
            Kontrol PTZ
          </h3>
          <div className='sticky top-0 z-10 flex items-center border-b border-[var(--color-border)] bg-white'>
            <div role='tablist' className='flex flex-1 min-w-0'>
              {PTZ_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type='button'
                  role='tab'
                  aria-selected={ptzTab === tab.id}
                  onClick={() => setPtzTab(tab.id)}
                  className={`flex-1 border-b-2 px-2 py-3.5 text-sm font-medium ${
                    ptzTab === tab.id
                      ? 'border-red-500 text-[var(--color-text)]'
                      : 'border-transparent text-[var(--color-muted)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              type='button'
              aria-label='Tutup'
              onClick={() => setOpenSheet(null)}
              className='flex h-12 w-12 shrink-0 items-center justify-center text-slate-500'
            >
              <X className='h-5 w-5' />
            </button>
          </div>
          <div className='p-5'>
            <PtzControls cameraId={cameraId} sheetTab={ptzTab} />
          </div>
        </Sheet>
      )}
    </div>
  );
}
