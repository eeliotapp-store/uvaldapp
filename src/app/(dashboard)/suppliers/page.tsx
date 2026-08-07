'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/utils';

interface SupplierWithDetails {
  id: string;
  name: string;
  phone: string | null;
  contact_person: string | null;
  email: string | null;
  address: string | null;
  active: boolean;
  product_suppliers: {
    id: string;
    purchase_price: number;
    is_preferred: boolean;
    products: { id: string; name: string; sale_price: number };
  }[];
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierWithDetails | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      const response = await fetch('/api/suppliers');
      const data = await response.json();
      setSuppliers(data.suppliers || []);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (supplier: SupplierWithDetails) => {
    setEditingSupplier(supplier);
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingSupplier(null);
    setShowModal(true);
  };

  const handleSuccess = () => {
    setShowModal(false);
    setEditingSupplier(null);
    loadSuppliers();
  };

  const handleToggleActive = async (supplier: SupplierWithDetails) => {
    try {
      await fetch(`/api/suppliers/${supplier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !supplier.active }),
      });
      loadSuppliers();
    } catch (error) {
      console.error('Error toggling supplier:', error);
    }
  };

  const filteredSuppliers = suppliers.filter((s) => showInactive || s.active);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Proveedores</h1>
        <Button onClick={handleCreate}>+ Nuevo Proveedor</Button>
      </div>

      <div className="mb-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          <span className="text-sm text-gray-600 dark:text-neutral-300">Mostrar inactivos</span>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSuppliers.map((supplier) => (
          <div
            key={supplier.id}
            className={`bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5 ${!supplier.active ? 'opacity-50' : ''}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-neutral-100">{supplier.name}</h3>
                {supplier.contact_person && (
                  <p className="text-sm text-gray-600 dark:text-neutral-300">{supplier.contact_person}</p>
                )}
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${supplier.active ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-neutral-700 text-gray-500 dark:text-neutral-400'}`}>
                {supplier.active ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            <div className="space-y-1 text-sm text-gray-600 dark:text-neutral-300 mb-4">
              {supplier.phone && (
                <p className="flex items-center gap-2">
                  <span>📞</span> {supplier.phone}
                </p>
              )}
              {supplier.email && (
                <p className="flex items-center gap-2">
                  <span>✉️</span> {supplier.email}
                </p>
              )}
              {supplier.address && (
                <p className="flex items-center gap-2">
                  <span>📍</span> {supplier.address}
                </p>
              )}
            </div>

            {/* Productos que provee */}
            <div className="border-t border-gray-100 dark:border-neutral-700 pt-3 mb-4">
              <p className="text-xs text-gray-500 dark:text-neutral-400 mb-2">
                Productos ({supplier.product_suppliers?.length || 0})
              </p>
              <div className="flex flex-wrap gap-1">
                {supplier.product_suppliers?.slice(0, 5).map((ps) => (
                  <span
                    key={ps.id}
                    className="px-2 py-0.5 bg-gray-100 dark:bg-neutral-700 rounded text-xs text-gray-600 dark:text-neutral-300"
                    title={`Compra: ${formatCurrency(ps.purchase_price)} | Venta: ${formatCurrency(ps.products.sale_price)}`}
                  >
                    {ps.products.name}
                  </span>
                ))}
                {(supplier.product_suppliers?.length || 0) > 5 && (
                  <span className="text-xs text-gray-500 dark:text-neutral-400">
                    +{supplier.product_suppliers.length - 5} más
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(supplier)}
                className="flex-1 px-3 py-2 bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-400 rounded-lg text-sm font-medium hover:bg-violet-100 dark:hover:bg-violet-900"
              >
                Editar
              </button>
              <button
                onClick={() => handleToggleActive(supplier)}
                className="px-3 py-2 bg-gray-50 dark:bg-neutral-950 text-gray-600 dark:text-neutral-300 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-neutral-700"
              >
                {supplier.active ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredSuppliers.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-neutral-400 bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700">
          No hay proveedores
        </div>
      )}

      {showModal && (
        <SupplierModal
          supplier={editingSupplier}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}

interface SupplierModalProps {
  supplier: SupplierWithDetails | null;
  onClose: () => void;
  onSuccess: () => void;
}

function SupplierModal({ supplier, onClose, onSuccess }: SupplierModalProps) {
  const [formData, setFormData] = useState({
    name: supplier?.name || '',
    phone: supplier?.phone || '',
    contact_person: supplier?.contact_person || '',
    email: supplier?.email || '',
    address: supplier?.address || '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!supplier;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('El nombre es requerido');
      return;
    }

    setIsLoading(true);

    try {
      const url = isEditing ? `/api/suppliers/${supplier.id}` : '/api/suppliers';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Error al guardar');
        return;
      }

      onSuccess();
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-6">
          {isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
              Nombre de la Empresa *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-violet-500 focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
              Persona de Contacto
            </label>
            <input
              type="text"
              value={formData.contact_person}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-violet-500 focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
              Teléfono
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-violet-500 focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-violet-500 focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
              Dirección
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-violet-500 focus:border-violet-500"
            />
          </div>

          {error && (
            <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950 p-3 rounded-lg">{error}</div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
