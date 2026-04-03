"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  HardDrive,
  Search,
  Play,
  Download,
  Film,
  Calendar,
  ChevronDown,
  ChevronRight,
  X,
  Folder,
  ArrowLeft,
} from "lucide-react";

interface DriveFolder {
  id: string;
  name: string;
  modifiedTime: string;
  totalSize?: number;
  fileCount?: number;
}

interface DriveFile {
  id: string;
  name: string;
  size: string;
  createdTime: string;
  modifiedTime: string;
  thumbnailLink: string | null;
  mimeType: string;
}

interface StorageResponse {
  folders: DriveFolder[];
  files: DriveFile[];
}

function formatBytes(bytes: string | number): string {
  const b = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (!b || isNaN(b)) return "-";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function StoragePage() {
  const { data: session, status } = useSession();

  // Navigation stack: kosong = root, setiap item = { id, name } folder yang masuk
  const [navStack, setNavStack] = useState<{ id: string; name: string }[]>([]);

  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "largest" | "smallest">("newest");
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);

  // ── Navigation helpers ───────────────────────────────────────────────────
  const currentFolderId = navStack.length > 0 ? navStack[navStack.length - 1].id : null;

  function navigateInto(folder: { id: string; name: string }) {
    setNavStack((prev) => [...prev, folder]);
    setSearchTerm("");
  }

  function navigateBack() {
    setNavStack((prev) => prev.slice(0, -1));
    setSearchTerm("");
  }

  function navigateTo(index: number) {
    setNavStack((prev) => prev.slice(0, index));
    setSearchTerm("");
  }

  // ── Data fetching ────────────────────────────────────────────────────────
  const fetchContents = useCallback(async (folderId: string | null, depth: number) => {
    // depth=0 (root, camera folders): videos are 2 levels deep → withSizes=2
    // depth=1 (inside camera, date folders): videos are 1 level deep → withSizes=1
    const params = new URLSearchParams();
    if (folderId) params.set('folderId', folderId);
    // if (depth === 0) params.set('withSizes', '2');
    // else if (depth === 1) params.set('withSizes', '1');
    const url = `/api/storage?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error ?? "Gagal mengambil data storage");
    }
    return res.json() as Promise<StorageResponse>;
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchContents(currentFolderId, navStack.length)
      .then(({ folders: f, files: v }) => {
        setFolders(f);
        setFiles(v);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navStack]);

  // ── Auth guards (after all hooks) ────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-strong)]" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    redirect("/api/auth/login");
  }

  if (session?.user?.role === "WORKER") {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Access Denied – Anda tidak memiliki akses ke halaman ini.</p>
      </div>
    );
  }

  // ── Filtering & sorting (hanya untuk video) ──────────────────────────────
  const filteredFiles = files
    .filter((f) => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      switch (sortOrder) {
        case "newest":
          return new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime();
        case "oldest":
          return new Date(a.createdTime).getTime() - new Date(b.createdTime).getTime();
        case "largest":
          return parseInt(b.size ?? "0") - parseInt(a.size ?? "0");
        case "smallest":
          return parseInt(a.size ?? "0") - parseInt(b.size ?? "0");
        default:
          return 0;
      }
    });

  const totalSize = files.reduce((sum, f) => sum + parseInt(f.size ?? "0", 10), 0);
  const isRoot = navStack.length === 0;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card border-[var(--color-border)] bg-white p-8 shadow-lg">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-primary-strong)]">
          STORAGE
        </p>

        {/* Breadcrumb */}
        <div className="mt-3 flex items-center flex-wrap gap-1 text-sm">
          <button
            onClick={() => navigateTo(0)}
            className={`font-semibold transition-colors ${
              isRoot
                ? "text-[var(--color-text)] cursor-default"
                : "text-[var(--color-primary-strong)] hover:underline"
            }`}
            disabled={isRoot}
          >
            Storage
          </button>
          {navStack.map((item, index) => {
            const isLast = index === navStack.length - 1;
            return (
              <span key={item.id} className="flex items-center gap-1">
                <ChevronRight className="h-4 w-4 text-[var(--color-muted)]" />
                <button
                  onClick={() => navigateTo(index + 1)}
                  className={`font-semibold transition-colors ${
                    isLast
                      ? "text-[var(--color-text)] cursor-default"
                      : "text-[var(--color-primary-strong)] hover:underline"
                  }`}
                  disabled={isLast}
                >
                  {item.name}
                </button>
              </span>
            );
          })}
        </div>

        {/* Stats */}
        {!loading && (
          <div className="mt-6 flex flex-wrap gap-6">
            {isRoot ? (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
                  <Folder className="h-5 w-5 text-[var(--color-primary-strong)]" />
                </div>
                <div>
                  <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide">Total Kamera</p>
                  <p className="text-lg font-semibold text-[var(--color-text)]">{folders.length}</p>
                </div>
              </div>
            ) : (
              <>
                {folders.length > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
                      <Folder className="h-5 w-5 text-[var(--color-primary-strong)]" />
                    </div>
                    <div>
                      <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide">Folder</p>
                      <p className="text-lg font-semibold text-[var(--color-text)]">{folders.length}</p>
                    </div>
                  </div>
                )}
                {files.length > 0 && (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
                        <Film className="h-5 w-5 text-[var(--color-primary-strong)]" />
                      </div>
                      <div>
                        <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide">Total Video</p>
                        <p className="text-lg font-semibold text-[var(--color-text)]">{files.length}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
                        <HardDrive className="h-5 w-5 text-[var(--color-primary-strong)]" />
                      </div>
                      <div>
                        <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide">Total Ukuran</p>
                        <p className="text-lg font-semibold text-[var(--color-text)]">{formatBytes(totalSize)}</p>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Toolbar: Back + Search + Sort */}
      <div className="card p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          {/* Back button */}
          {!isRoot && (
            <button
              onClick={navigateBack}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-[var(--color-border)] rounded-[var(--radius-md)] hover:bg-gray-50 transition-colors text-[var(--color-text)] flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </button>
          )}

          {/* Search & Sort — only when there are video files */}
          {files.length > 0 && (
            <>
              <div className="flex-1 relative min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] h-5 w-5" />
                <input
                  type="text"
                  placeholder="Cari rekaman..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-field w-full pl-10 pr-4 py-2.5 border border-[var(--color-border)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-strong)] focus:border-transparent"
                />
              </div>
              <div className="relative flex-shrink-0">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
                  className="appearance-none pl-4 pr-10 py-2.5 border border-[var(--color-border)] rounded-[var(--radius-md)] text-sm text-[var(--color-text)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-strong)] cursor-pointer"
                >
                  <option value="newest">Terbaru</option>
                  <option value="oldest">Terlama</option>
                  <option value="largest">Terbesar</option>
                  <option value="smallest">Terkecil</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)] pointer-events-none" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="card p-4 bg-red-50 border border-red-200">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card overflow-hidden animate-pulse">
              <div className="aspect-video bg-gray-200" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Folder cards */}
      {!loading && folders.length > 0 && (
        <div>
          {files.length > 0 && (
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">
              Folder
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => navigateInto({ id: folder.id, name: folder.name })}
                className="card p-5 text-left hover:shadow-lg transition-shadow group flex items-center gap-4"
              >
                <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                  <Folder className="h-7 w-7 text-amber-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm font-semibold text-[var(--color-text)] truncate"
                    title={folder.name}
                  >
                    {folder.name}
                  </p>
                  <p className="text-xs text-[var(--color-muted)] mt-0.5 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(folder.modifiedTime)}
                  </p>
                  {/* {folder.totalSize !== undefined && folder.totalSize > 0 && (
                    <p className="text-xs text-[var(--color-muted)] mt-0.5 flex items-center gap-1">
                      <HardDrive className="h-3 w-3" />
                      {formatBytes(folder.totalSize)}
                    </p>
                  )} */}
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--color-muted)] flex-shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Video cards */}
      {!loading && files.length > 0 && (
        <div>
          {folders.length > 0 && (
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">
              Video
            </p>
          )}
          {filteredFiles.length === 0 ? (
            <div className="card p-16 flex flex-col items-center gap-4">
              <div className="rounded-full bg-gray-100 p-6">
                <Film className="h-10 w-10 text-gray-400" />
              </div>
              <p className="text-[var(--color-muted)] font-medium">Tidak ada rekaman yang cocok</p>
              <button
                onClick={() => setSearchTerm("")}
                className="text-sm text-[var(--color-primary-strong)] hover:underline"
              >
                Hapus pencarian
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredFiles.map((file) => (
                <button
                  key={file.id}
                  onClick={() => setSelectedFile(file)}
                  className="card overflow-hidden text-left hover:shadow-lg transition-shadow group"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-gray-900 overflow-hidden">
                    {file.thumbnailLink ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={file.thumbnailLink}
                        alt={file.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="h-12 w-12 text-gray-600" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="h-12 w-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                        <Play className="h-5 w-5 text-gray-900 ml-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4 space-y-1.5">
                    <p
                      className="text-sm font-medium text-[var(--color-text)] line-clamp-2 leading-snug"
                      title={file.name}
                    >
                      {file.name}
                    </p>
                    <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        {formatBytes(file.size)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(file.createdTime)}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && folders.length === 0 && files.length === 0 && !error && (
        <div className="card p-16 flex flex-col items-center gap-4">
          <div className="rounded-full bg-gray-100 p-6">
            <Folder className="h-10 w-10 text-gray-400" />
          </div>
          <p className="text-[var(--color-muted)] font-medium">
            {isRoot ? "Belum ada folder kamera" : "Folder ini kosong"}
          </p>
          {!isRoot && (
            <button
              onClick={navigateBack}
              className="text-sm text-[var(--color-primary-strong)] hover:underline"
            >
              Kembali
            </button>
          )}
        </div>
      )}

      {/* Video Preview Modal */}
      {selectedFile && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedFile(null)}
        >
          <div
            className="card w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-white border-b border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-[var(--color-primary)]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Film className="h-4 w-4 text-[var(--color-primary-strong)]" />
                </div>
                <p
                  className="text-sm font-semibold text-[var(--color-text)] truncate"
                  title={selectedFile.name}
                >
                  {selectedFile.name}
                </p>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="ml-4 p-1.5 text-[var(--color-muted)] hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Video Player */}
            <div className="bg-black aspect-video">
              <video
                key={selectedFile.id}
                controls
                autoPlay
                className="w-full h-full"
                src={`/api/storage/stream/${selectedFile.id}`}
              >
                Browser Anda tidak mendukung pemutaran video.
              </video>
            </div>

            {/* File Info & Actions */}
            <div className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1 text-sm text-[var(--color-muted)]">
                <p>
                  <span className="font-medium text-[var(--color-text)]">Ukuran:</span>{" "}
                  {formatBytes(selectedFile.size)}
                </p>
                <p>
                  <span className="font-medium text-[var(--color-text)]">Diunggah:</span>{" "}
                  {formatDate(selectedFile.createdTime)}
                </p>
                <p>
                  <span className="font-medium text-[var(--color-text)]">Diperbarui:</span>{" "}
                  {formatDate(selectedFile.modifiedTime)}
                </p>
              </div>
              <a
                href={`/api/storage/stream/${selectedFile.id}`}
                download={selectedFile.name}
                className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 flex-shrink-0"
              >
                <Download className="h-4 w-4" />
                Unduh Video
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
