import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IconX,
  IconSparkles,
  IconLoader2,
  IconPlus,
} from '@tabler/icons-react';

interface ModalAgregarAdicionalProps {
  abierto: boolean;
  onClose: () => void;
  cita: any | null;
  onGuardar: (reservaId: string, monto: number) => Promise<void>;
  guardando: boolean;
  obtenerNombreClienta: (cita: any) => string;
  obtenerServicioCita: (cita: any) => string;
}

export const ModalAgregarAdicional: React.FC<ModalAgregarAdicionalProps> = ({
  abierto,
  onClose,
  cita,
  onGuardar,
  guardando,
  obtenerNombreClienta,
  obtenerServicioCita,
}) => {
  const [monto, setMonto] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (abierto) {
      setMonto('');
      setError(null);
    }
  }, [abierto, cita]);

  if (!abierto || !cita) return null;

  const nombreClienta = obtenerNombreClienta(cita);
  const servicioNombre = obtenerServicioCita(cita);
  const valorActual = Number(cita.valor_total || 0);

  const montoNum = parseInt(monto.replace(/\D/g, ''), 10) || 0;
  const nuevoTotal = valorActual + montoNum;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (montoNum <= 0) {
      setError('Por favor ingresa un monto válido mayor a $0.');
      return;
    }
    setError(null);
    try {
      await onGuardar(cita.id, montoNum);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al guardar el adicional');
    }
  };

  const sugerencias = [5000, 10000, 15000, 20000, 30000];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-[#C5D6BE] space-y-4"
        >
          {/* Encabezado */}
          <div className="flex items-center justify-between border-b border-[#C5D6BE]/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center shadow-2xs">
                <IconSparkles className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[#1C2922] font-serif">
                  Añadir Adicional
                </h3>
                <p className="text-xs text-[#5A6B60]">
                  Decorados, efectos o servicios complementarios
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={guardando}
              className="text-[#5A6B60] hover:text-[#1C2922] p-1.5 rounded-xl hover:bg-[#F5F8F4] transition cursor-pointer"
            >
              <IconX className="w-5 h-5" />
            </button>
          </div>

          {/* Resumen de la Cita */}
          <div className="bg-[#F5F8F4] rounded-2xl p-3 border border-[#C5D6BE] text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[#5A6B60]">Clienta:</span>
              <span className="font-bold text-[#1C2922]">{nombreClienta}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#5A6B60]">Servicio Base:</span>
              <span className="font-semibold text-[#2E5A44]">{servicioNombre}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-[#C5D6BE]/60">
              <span className="text-[#5A6B60]">Valor Actual Cita:</span>
              <span className="font-mono font-bold text-[#1C2922]">
                ${valorActual.toLocaleString('es-CO')}
              </span>
            </div>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Concepto Fijo */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A6B60] uppercase">
                Concepto
              </label>
              <div className="w-full px-3 py-2 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold text-[#1C2922] flex items-center justify-between">
                <span>Adicional</span>
                <span className="text-[10px] text-[#5A6B60] font-normal">Fijo</span>
              </div>
            </div>

            {/* Monto Libre */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#5A6B60] uppercase">
                Monto del Adicional ($ COP) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5A6B60] font-mono font-bold text-sm">
                  $
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={monto}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    if (!raw) {
                      setMonto('');
                    } else {
                      setMonto(Number(raw).toLocaleString('es-CO'));
                    }
                  }}
                  placeholder="Ej. 15.000"
                  className="w-full pl-8 pr-3 py-2.5 bg-white border-2 border-[#C5D6BE] focus:border-[#2E5A44] rounded-xl text-sm font-mono font-bold text-[#1C2922] outline-none transition"
                  autoFocus
                />
              </div>

              {/* Botones de sugerencias rápidas */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-[#5A6B60] font-semibold">Atajos:</span>
                {sugerencias.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setMonto(sug.toLocaleString('es-CO'))}
                    className="px-2 py-0.5 rounded-lg bg-[#F5F8F4] hover:bg-[#E8F0E5] text-[#2E5A44] border border-[#C5D6BE] text-[11px] font-mono font-bold transition cursor-pointer active:scale-95"
                  >
                    +${sug.toLocaleString('es-CO')}
                  </button>
                ))}
              </div>
            </div>

            {/* Proyección del Nuevo Total */}
            {montoNum > 0 && (
              <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-200 text-xs flex items-center justify-between animate-in fade-in duration-150">
                <div>
                  <span className="text-emerald-800 font-semibold block">Nuevo Total a Cobrar:</span>
                  <span className="text-[10px] text-emerald-600">
                    ${valorActual.toLocaleString('es-CO')} + ${montoNum.toLocaleString('es-CO')}
                  </span>
                </div>
                <span className="font-mono font-black text-emerald-700 text-base">
                  ${nuevoTotal.toLocaleString('es-CO')}
                </span>
              </div>
            )}

            {error && (
              <p className="text-xs text-rose-600 font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                {error}
              </p>
            )}

            {/* Botones de acción */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#C5D6BE]/60">
              <button
                type="button"
                onClick={onClose}
                disabled={guardando}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition cursor-pointer active:scale-95"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando || montoNum <= 0}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#2E5A44] to-[#C5A059] hover:from-[#224433] hover:to-[#A68443] text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {guardando ? (
                  <>
                    <IconLoader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <IconPlus className="w-4 h-4 stroke-[2.5]" />
                    <span>Sumar Adicional</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
