"use client";

import { useState } from "react";
import { usePorts } from "@/hooks/use-ports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Plus, Search, MapPin, Edit, Trash2 } from "lucide-react";

export default function PortsPage() {
  const { data: session, status } = useSession();
  const { ports, loading, error, createPort, updatePort, deletePort } = usePorts();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentPort, setCurrentPort] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    latitude: "",
    longitude: "",
  });

  // Check authentication and authorization
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-strong)]"></div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    redirect("/api/auth/login");
  }

  if (session?.user?.role !== "ADMINISTRATOR") {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Access Denied - Administrator privileges required</p>
      </div>
    );
  }

  const handleOpenModal = (port?: any) => {
    if (port) {
      setIsEditMode(true);
      setCurrentPort(port);
      setFormData({
        name: port.name || "",
        latitude: port.latitude?.toString() || "",
        longitude: port.longitude?.toString() || "",
      });
    } else {
      setIsEditMode(false);
      setCurrentPort(null);
      setFormData({
        name: "",
        latitude: "",
        longitude: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsEditMode(false);
    setCurrentPort(null);
    setFormData({
      name: "",
      latitude: "",
      longitude: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const data = {
        name: formData.name,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
      };

      if (isEditMode && currentPort) {
        await updatePort(currentPort.id, data);
      } else {
        await createPort(data);
      }
      
      handleCloseModal();
    } catch (err) {
      console.error("Error saving port:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this port?")) {
      try {
        await deletePort(id);
      } catch (err) {
        console.error("Error deleting port:", err);
      }
    }
  };

  // Filter ports based on search
  const filteredPorts = ports.filter((port) => {
    const matchesSearch =
      port.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      port.latitude?.toString().includes(searchTerm) ||
      port.longitude?.toString().includes(searchTerm);
    return matchesSearch;
  });

  if (loading && ports.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-strong)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card border-[var(--color-border)] bg-white p-8 shadow-lg">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-primary-strong)]">
          PORT MANAGEMENT
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-[var(--color-text)]">
          Kelola Port
        </h1>
        <p className="mt-2 text-[var(--color-muted)]">
          Kelola dan pantau semua port dalam sistem.
        </p>
      </div>

      {/* Filters and Actions */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex-1 max-w-md w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--color-muted)] h-5 w-5" />
              <input
                type="text"
                placeholder="Cari port..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field w-full pl-10 pr-4 py-2.5 border border-[var(--color-border)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-strong)] focus:border-transparent"
              />
            </div>
          </div>
          
          <Button
            onClick={() => handleOpenModal()}
            className="btn-primary flex items-center gap-2 px-6 py-2.5 rounded-[var(--radius-md)] shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="h-5 w-5" />
            Tambah Port
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="card p-4 bg-red-50 border border-red-200">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Ports Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-[var(--color-border)]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-text)]">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Nama Port
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-text)]">
                  Latitude
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-text)]">
                  Longitude
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-text)]">
                  Dibuat Pada
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-[var(--color-text)]">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-[var(--color-border)]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-strong)]"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredPorts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="rounded-full bg-gray-100 p-4">
                        <MapPin className="h-8 w-8 text-gray-400" />
                      </div>
                      <p className="text-[var(--color-muted)] font-medium">
                        {searchTerm ? "Tidak ada port yang ditemukan" : "Belum ada port"}
                      </p>
                      {!searchTerm && (
                        <Button
                          onClick={() => handleOpenModal()}
                          className="btn-primary mt-2"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Tambah Port Pertama
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPorts.map((port) => (
                  <tr key={port.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[var(--color-primary-light)] to-[var(--color-primary-strong)] flex items-center justify-center">
                            <MapPin className="h-5 w-5 text-white" />
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-[var(--color-text)]">
                          {port.name || "-"}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-[var(--color-text)]">
                        {port.latitude !== null ? Number(port.latitude).toFixed(6) : "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-[var(--color-text)]">
                        {port.longitude !== null ? Number(port.longitude).toFixed(6) : "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-[var(--color-muted)]">
                        {new Date(port.createdAt).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(port)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(port.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Create/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="bg-white border-b border-[var(--color-border)] px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[var(--color-primary)]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-5 w-5 text-[var(--color-primary-strong)]" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-[var(--color-text)]">
                    {isEditMode ? "Edit Port" : "Tambah Port Baru"}
                  </h2>
                  <p className="text-sm text-[var(--color-muted)] mt-0.5">
                    {isEditMode ? "Perbarui informasi port" : "Masukkan informasi untuk port baru"}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Port Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="block text-sm font-medium text-[var(--color-text)]">
                  Nama Port <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Masukkan nama port"
                  required
                  disabled={loading}
                  className="w-full px-3 py-2.5 border border-gray-200 bg-white text-[var(--color-text)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-strong)] focus:border-transparent shadow-sm"
                />
              </div>

              {/* Latitude */}
              <div className="space-y-2">
                <Label htmlFor="latitude" className="block text-sm font-medium text-[var(--color-text)]">
                  Latitude
                </Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  placeholder="Contoh: -6.123456"
                  disabled={loading}
                  className="w-full px-3 py-2.5 border border-gray-200 bg-white text-[var(--color-text)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-strong)] focus:border-transparent shadow-sm"
                />
                <p className="text-sm text-[var(--color-muted)]">
                  Rentang: -90 hingga 90
                </p>
              </div>

              {/* Longitude */}
              <div className="space-y-2">
                <Label htmlFor="longitude" className="block text-sm font-medium text-[var(--color-text)]">
                  Longitude
                </Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  placeholder="Contoh: 106.123456"
                  disabled={loading}
                  className="w-full px-3 py-2.5 border border-gray-200 bg-white text-[var(--color-text)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-strong)] focus:border-transparent shadow-sm"
                />
                <p className="text-sm text-[var(--color-muted)]">
                  Rentang: -180 hingga 180
                </p>
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 pt-6 border-t border-[var(--color-border)]">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-[var(--color-text)] border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex-1 inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>{isEditMode ? "Perbarui Port" : "Tambah Port"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
