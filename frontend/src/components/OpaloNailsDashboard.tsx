import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IconBrandWhatsapp,
  IconCalendar,
  IconClock,
  IconCheck,
  IconX,
  IconPlus,
  IconLogout,
  IconChartBar,
  IconArrowLeft,
  IconLoader2,
  IconExternalLink,
  IconLock,
  IconLockOpen,
  IconRefresh,
  IconAlertCircle,
  IconChevronLeft,
  IconChevronRight,
  IconCalendarEvent,
  IconCalendarWeek,
  IconCalendarMonth,
  IconSettings,
} from '@tabler/icons-react';
import { supabase } from '../config/supabase';
import { BloquearHorarioModal } from './dashboard/BloquearHorarioModal';
import { ConfigAnticipoModal } from './dashboard/ConfigAnticipoModal';
import { AgendarCitaModal } from './dashboard/AgendarCitaModal';
import { ExclusionesBotModal } from './dashboard/ExclusionesBotModal';
import { DetalleCitaPopover, sumarAdicionalesCita } from './dashboard/DetalleCitaPopover';
import { ModalAgregarAdicional } from './dashboard/ModalAgregarAdicional';

interface Cancha {
  id: string;
  nombre: string;
  deporte?: string;
  activa: boolean;
  foto?: string | null;
}

interface Reserva {
  id: string;
  cancha_id: string;
  cliente_id?: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: 'pendiente_pago' | 'pendiente_anticipo' | 'confirmada' | 'cancelada' | 'completada' | 'bloqueada';
  valor_total: number;
  valor_anticipo_requerido: number;
  expiracion_reserva?: string | null;
  notas?: string;
  canchas?: {
    id?: string;
    nombre: string;
  };
  clientes?: {
    nombre: string;
    telefono_wa: string;
  };
}

interface Servicio {
  id: number;
  nombre: string;
  categoria: string;
  duracion: number;
  precio: number;
  descripcion: string;
}

export interface StaffProfile {
  id: string;
  canchaNombreMatch: string;
  nombre: string;
  alias: string;
  rol: 'admin' | 'manicurista';
  pin: string;
  descripcion: string;
  avatar: string;
  foto?: string;
  colorBadge: string;
  canchaId?: string;
}

const FOTOS_EQUIPO_ADMIN: Record<string, string> = {};

const PERFILES_SPA_CONFIG: Omit<StaffProfile, 'canchaId'>[] = [
  {
    id: 'admin',
    canchaNombreMatch: '',
    nombre: 'Administradora',
    alias: 'Administradora (Supervisión & General)',
    rol: 'admin',
    pin: '1234',
    descripcion: 'Acceso Total: Supervisión de todas las tablas, métricas de reservas y agendamiento exclusivo.',
    avatar: '👑',
    colorBadge: 'bg-[#E8F0E5] text-[#2E5A44] border-[#C5D6BE]',
  },
  {
    id: 'staff-m1',
    canchaNombreMatch: 'Especialista 1',
    nombre: 'Especialista 1',
    alias: 'Especialista 1',
    rol: 'manicurista',
    pin: '1234',
    descripcion: 'Vista personal de turnos del día y gestión de atención de clientas asignadas.',
    avatar: '✨',
    colorBadge: 'bg-[#F5F8F4] text-[#C5A059] border-[#C5D6BE]',
  },
  {
    id: 'staff-m2',
    canchaNombreMatch: 'Especialista 2',
    nombre: 'Especialista 2',
    alias: 'Especialista 2',
    rol: 'manicurista',
    pin: '1234',
    descripcion: 'Vista personal de turnos del día y gestión de atención de clientas asignadas.',
    avatar: '🌸',
    colorBadge: 'bg-[#F5F8F4] text-[#C5A059] border-[#C5D6BE]',
  },
  {
    id: 'staff-m3',
    canchaNombreMatch: 'Especialista 3',
    nombre: 'Especialista 3',
    alias: 'Especialista 3',
    rol: 'manicurista',
    pin: '1234',
    descripcion: 'Vista personal de turnos del día y gestión de atención de clientas asignadas.',
    avatar: '💅',
    colorBadge: 'bg-[#F5F8F4] text-[#C5A059] border-[#C5D6BE]',
  },
  {
    id: 'staff-m4',
    canchaNombreMatch: 'Especialista 4',
    nombre: 'Especialista 4',
    alias: 'Especialista 4',
    rol: 'manicurista',
    pin: '1234',
    descripcion: 'Vista personal de turnos del día y gestión de atención de clientas asignadas.',
    avatar: '🌿',
    colorBadge: 'bg-[#F5F8F4] text-[#C5A059] border-[#C5D6BE]',
  },
];

const CANCHAS_POR_DEFECTO: Cancha[] = [
  { id: 'esp-1', nombre: 'Especialista 1', activa: true },
  { id: 'esp-2', nombre: 'Especialista 2', activa: true },
  { id: 'esp-3', nombre: 'Especialista 3', activa: true },
  { id: 'esp-4', nombre: 'Especialista 4', activa: true },
];

interface Props {
  onIrAWebReservas?: () => void;
  complejoId?: string;
}

// Función auxiliar para obtener el nombre exacto de la clienta por cita
function obtenerNombreClienta(cita: Reserva): string {
  if (cita.estado === 'bloqueada') {
    return '🔒 Horario Bloqueado';
  }
  const matchNom = (cita.notas || '').match(/Clienta:\s*([^|[\n]+)/i);
  if (matchNom && matchNom[1]) {
    return matchNom[1].trim();
  }
  return cita.clientes?.nombre || 'Clienta';
}

// Función auxiliar para extraer el nombre del servicio de la cita
function obtenerServicioCita(cita: Reserva): string {
  if (cita.estado === 'bloqueada') {
    const matchMotivo = (cita.notas || '').match(/Motivo:\s*([^|[\n]+)/i);
    return matchMotivo ? matchMotivo[1].trim() : 'Turno Bloqueado';
  }
  const matchSvc = (cita.notas || '').match(/Servicio:\s*([^|[\n]+)/i);
  if (matchSvc && matchSvc[1]) {
    return matchSvc[1].trim();
  }

  // Deducción inteligente si las notas no contienen el tag Servicio:
  const notasLower = (cita.notas || '').toLowerCase();
  const serviciosConocidos = [
    'pestañas pelo a pelo volumen ruso', 'pestañas pelo a pelo volumen brasileño',
    'pestañas pelo a pelo efecto pestañina', 'pestañas pelo a pelo clásicas',
    'pestañas híbridas', 'pestañas 3d', 'lifting de pestañas', 'laminado de cejas',
    'cera y henna', 'hilo y henna', 'depilación con hilo', 'depilación con cera',
    'bigote con hilo', 'bigote con cera', 'henna',
    'acrílicas esculpidas', 'acrílicas con tip', 'recubrimiento en acrílico',
    'sistema press on', 'retoque de acrílico o press on', 'retiro de acrílico definitivo',
    'retiro definitivo semipermanente', 'manicura semipermanente full', 'manicura solo tono',
    'pedicura semi', 'dipping + semi', 'base ruber', 'manicura tradicional',
    'pedicura tradicional', 'limpieza', 'pestañas', 'cejas', 'uñas'
  ];
  const encontrados = serviciosConocidos.filter((nombre) => notasLower.includes(nombre));
  if (encontrados.length > 0) {
    return encontrados.map((e) => e.charAt(0).toUpperCase() + e.slice(1)).join(' + ');
  }

  // Deducción por valor monetario oficial de Ópalo Nails Spa
  const v = Number(cita.valor_total || 0);
  if (v === 110000) return 'Pestañas pelo a pelo volumen ruso';
  if (v === 100000) return 'Acrílicas esculpidas / Pestañas Híbridas o 3D';
  if (v === 90000) return 'Acrílicas con tip / Volumen brasileño';
  if (v === 80000) return 'Pestañas pelo a pelo clásicas';
  if (v === 75000) return 'Sistema Press On / Recubrimiento en acrílico';
  if (v === 65000) return 'Retoque de acrílico o Press On';
  if (v === 55000) return 'Laminado de cejas / Lifting de pestañas';
  if (v === 53000) return 'Base Ruber / Dipping + Semi';
  if (v === 46000) return 'Manicura semipermanente full';
  if (v === 39000) return 'Manicura solo tono / Pedicura Semi';
  if (v === 22000) return 'Cera y henna';
  if (v === 20000) return 'Depilación con hilo';
  if (v === 18000) return 'Manicura o Pedicura tradicional';
  if (v === 16000) return 'Hilo y henna';
  if (v === 15000) return 'Depilación con cera / Retiro de acrílico';
  if (v === 13000) return 'Limpieza';
  if (v === 10000) return 'Bigote con hilo / Uña esculpida';
  if (v === 8000) return 'Henna / Bigote con cera / Retiro semi';

  return 'Servicio de Uñas, Cejas o Pestañas';
}

// Extrae el motivo y responsable del bloqueo
function obtenerDetalleBloqueo(cita: Reserva): { motivo: string; por: string } {
  const matchMotivo = (cita.notas || '').match(/Motivo:\s*([^|[\n]+)/i);
  const matchPor = (cita.notas || '').match(/Por:\s*([^|[\n]+)/i);
  return {
    motivo: matchMotivo ? matchMotivo[1].trim() : 'Horario no disponible',
    por: matchPor ? matchPor[1].trim() : 'Personal del Spa',
  };
}

/**
 * Calcula dinámicamente las opciones de horas para bloqueo de horarios
 * basándose en el horario de atención estipulado en ese momento (apertura y cierre).
 */
export function calcularHorasOpcionesBloqueo(
  horaApertura: string = '08:00',
  horaCierre: string = '19:00',
  intervaloMinutos: number = 30
): string[] {
  const [aperH, aperM] = (horaApertura || '08:00').split(':').map(Number);
  const [cierH, cierM] = (horaCierre || '19:00').split(':').map(Number);
  const startMin = (isNaN(aperH) ? 8 : aperH) * 60 + (isNaN(aperM) ? 0 : aperM);
  const endMin = (isNaN(cierH) ? 19 : cierH) * 60 + (isNaN(cierM) ? 0 : cierM);

  const lista: string[] = [];
  for (let m = startMin; m < endMin; m += intervaloMinutos) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    lista.push(`${hh}:${mm}`);
  }
  return lista;
}

// Función calculada para compatibilidad cuando se referencie HORAS_OPCIONES_BLOQUEO
export const HORAS_OPCIONES_BLOQUEO = (
  horaApertura: string = '08:00',
  horaCierre: string = '19:00',
  intervaloMinutos: number = 30
): string[] => calcularHorasOpcionesBloqueo(horaApertura, horaCierre, intervaloMinutos);

export function calcularHorasTimeline(horaApertura: string = '08:00', horaCierre: string = '19:00'): number[] {
  const aperH = parseInt((horaApertura || '08:00').split(':')[0], 10) || 8;
  const cierH = parseInt((horaCierre || '19:00').split(':')[0], 10) || 19;
  const horas: number[] = [];
  for (let h = aperH; h <= cierH; h++) {
    horas.push(h);
  }
  return horas.length > 0 ? horas : [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
}

const ALTURA_HORA_PX = 88;

function formatearHora12(hora24: number): string {
  if (hora24 === 12) return 'Mediodía';
  const periodo = hora24 < 12 ? 'a.m.' : 'p.m.';
  const h12 = hora24 % 12 === 0 ? 12 : hora24 % 12;
  return `${h12} ${periodo}`;
}

// Función normalizadora para garantizar fechas válidas en Safari/móviles y zona horaria Colombia
function normalizarIsoBogota(isoStr: string): string {
  if (!isoStr) return '';
  const trimmed = isoStr.trim();
  let s = trimmed.includes(' ') && !trimmed.includes('T') ? trimmed.replace(' ', 'T') : trimmed;
  if (!s.endsWith('Z') && !/[+-]\d{2}(:\d{2})?$/.test(s)) {
    s += '-05:00';
  }
  return s;
}

// Función para parsear fechas de forma segura en todos los navegadores (evita desfases de UTC)
function parsearFechaBogotaIso(isoStr: string): string {
  if (!isoStr) return '';
  try {
    const trimmed = isoStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const s = normalizarIsoBogota(trimmed);
    const d = new Date(s);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  } catch {
    return '';
  }
}

// Funciones para calcular la hora en Colombia (America/Bogota, UTC-5)
function obtenerHoraMinutosBogota(isoStr: string): string {
  try {
    if (!isoStr) return '08:00';
    const s = normalizarIsoBogota(isoStr);
    const d = new Date(s);
    if (isNaN(d.getTime())) return '08:00';
    return d.toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '08:00';
  }
}

// Minutos desde la apertura en Colombia (por defecto horaBaseApertura = 8:00 AM)
function obtenerMinutosDesdeAperturaBogota(isoStr: string, horaBaseApertura: number = 8): number {
  try {
    const horaStr = obtenerHoraMinutosBogota(isoStr);
    const [h, m] = horaStr.split(':').map((n) => parseInt(n, 10));
    return (h - horaBaseApertura) * 60 + (m || 0);
  } catch {
    return 0;
  }
}

// Duración en minutos calculada a partir de fecha_inicio y fecha_fin (por defecto 45)
function obtenerDuracionMinutosCita(inicioIso: string, finIso?: string): number {
  if (!finIso) return 45;
  try {
    const tIni = new Date(normalizarIsoBogota(inicioIso)).getTime();
    const tFin = new Date(normalizarIsoBogota(finIso)).getTime();
    if (isNaN(tIni) || isNaN(tFin) || tFin <= tIni) return 45;
    return Math.max(15, Math.round((tFin - tIni) / 60000));
  } catch {
    return 45;
  }
}

// Función robusta para vincular una cita/bloqueo con la especialista correspondiente
function reservaCorrespondeACancha(
  r: Reserva,
  cancha: Cancha,
  indiceCancha?: number
): boolean {
  if (!r) return false;
  // 1. Coincidencia directa por ID
  if (r.cancha_id && (r.cancha_id === cancha.id || r.canchas?.id === cancha.id)) {
    return true;
  }

  // 2. Coincidencia por nombre normalizado (soporta 'Manicurista X' y 'Especialista X')
  const nombreCancha = (cancha.nombre || '').toLowerCase();
  const nombreReservaCancha = (r.canchas?.nombre || '').toLowerCase();

  if (nombreReservaCancha && nombreCancha) {
    if (
      nombreReservaCancha === nombreCancha ||
      nombreReservaCancha.includes(nombreCancha) ||
      nombreCancha.includes(nombreReservaCancha)
    ) {
      return true;
    }
  }

  // 3. Coincidencia por número de especialista / manicurista (1, 2, 3, 4)
  const numCancha =
    (nombreCancha.match(/\b([1-4])\b/) || [])[1] ||
    (cancha.id.match(/([1-4])/) || [])[1] ||
    (indiceCancha !== undefined && indiceCancha >= 0 && indiceCancha < 4 ? String(indiceCancha + 1) : null);

  const numReserva = (nombreReservaCancha.match(/\b([1-4])\b/) || [])[1];

  if (numCancha && numReserva && numCancha === numReserva) {
    return true;
  }

  return false;
}

interface CitaPosicionada {
  cita: Reserva;
  top: number;
  height: number;
  colIndex: number;
  totalCols: number;
}

function calcularPosicionesCitas(citas: Reserva[], horaBaseApertura: number = 8): CitaPosicionada[] {
  if (!citas || citas.length === 0) return [];

  const items = citas.map((c) => {
    const minInicio = Math.max(0, obtenerMinutosDesdeAperturaBogota(c.fecha_inicio, horaBaseApertura));
    const durMin = obtenerDuracionMinutosCita(c.fecha_inicio, c.fecha_fin);
    const minFin = minInicio + durMin;
    const top = (minInicio / 60) * ALTURA_HORA_PX;
    const height = Math.max(42, (durMin / 60) * ALTURA_HORA_PX - 4);
    return {
      cita: c,
      minInicio,
      minFin,
      top,
      height,
      colIndex: 0,
      totalCols: 1,
    };
  });

  items.sort((a, b) => a.minInicio - b.minInicio || b.minFin - a.minFin);

  const grupos: typeof items[] = [];
  let grupoActual: typeof items = [];
  let maxFinGrupo = -1;

  for (const item of items) {
    if (grupoActual.length === 0 || item.minInicio < maxFinGrupo) {
      grupoActual.push(item);
      maxFinGrupo = Math.max(maxFinGrupo, item.minFin);
    } else {
      grupos.push(grupoActual);
      grupoActual = [item];
      maxFinGrupo = item.minFin;
    }
  }
  if (grupoActual.length > 0) grupos.push(grupoActual);

  for (const grupo of grupos) {
    const colsFin: number[] = [];
    for (const it of grupo) {
      let colAsignada = -1;
      for (let c = 0; c < colsFin.length; c++) {
        if (colsFin[c] <= it.minInicio) {
          colAsignada = c;
          colsFin[c] = it.minFin;
          break;
        }
      }
      if (colAsignada === -1) {
        colAsignada = colsFin.length;
        colsFin.push(it.minFin);
      }
      it.colIndex = colAsignada;
    }
    const numCols = colsFin.length;
    for (const it of grupo) {
      it.totalCols = numCols;
    }
  }

  return items;
}

export const OpaloNailsDashboard: React.FC<Props> = ({ onIrAWebReservas, complejoId }) => {
  const hoyStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }); // YYYY-MM-DD
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>(hoyStr);
  const [idComplejoDetectado, setIdComplejoDetectado] = useState<string>(
    complejoId || ''
  );
  const [perfilActual, setPerfilActual] = useState<StaffProfile | null>(() => {
    try {
      const g = localStorage.getItem('opalo_staff_profile');
      return g ? JSON.parse(g) : null;
    } catch {
      return null;
    }
  });
  const esAdmin = perfilActual?.rol === 'admin';

  // Estado para el View Emergente (Popover) grande al pasar el mouse por encima de una cita
  const [popoverCita, setPopoverCita] = useState<{
    cita: Reserva;
    rect: { top: number; left: number; right: number; bottom: number; width: number; height: number };
  } | null>(null);
  const popoverTimeoutRef = useRef<any>(null);

  const abrirPopoverCita = (cita: Reserva, e: React.MouseEvent) => {
    if (popoverTimeoutRef.current) clearTimeout(popoverTimeoutRef.current);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopoverCita({
      cita,
      rect: {
        top: r.top,
        left: r.left,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      },
    });
  };

  const cerrarPopoverCita = () => {
    popoverTimeoutRef.current = setTimeout(() => {
      setPopoverCita(null);
    }, 200);
  };

  const mantenerPopoverCita = () => {
    if (popoverTimeoutRef.current) clearTimeout(popoverTimeoutRef.current);
  };



  // Reloj en tiempo real para la franja de hora actual en el calendario
  const [ahora, setAhora] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);

  const [canchas, setCanchas] = useState<Cancha[]>(CANCHAS_POR_DEFECTO);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [cargando, setCargando] = useState(false);
  const [realtimeConectado, setRealtimeConectado] = useState(false);
  const [notificacionRealtime, setNotificacionRealtime] = useState<string | null>(null);
  const notifTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mostrarNotificacionRealtime = (mensaje: string) => {
    if (notifTimeoutRef.current) clearTimeout(notifTimeoutRef.current);
    setNotificacionRealtime(mensaje);
    notifTimeoutRef.current = setTimeout(() => {
      setNotificacionRealtime(null);
    }, 4000);
  };

  const [tabAdmin, setTabAdmin] = useState<'agenda' | 'metricas'>('agenda');
  const [especialistaSeleccionadaId, setEspecialistaSeleccionadaId] = useState<string>('todas');
  // Selector de vista de agenda: Día (diario por horas / 4 columnas) vs Semana (planificador de 7 días)
  const [vistaAgenda, setVistaAgenda] = useState<'dia' | 'semana'>('dia');

  // Estado para la pestaña de Métricas (Por Día vs Por Mes)
  const [modoMetricas, setModoMetricas] = useState<'dia' | 'semana' | 'mes'>('dia');
  const [mesSeleccionado, setMesSeleccionado] = useState<string>(() => {
    const hoy = new Date();
    const y = hoy.getFullYear();
    const m = String(hoy.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });

  // Modal Login PIN
  const [modalPinPerfil, setModalPinPerfil] = useState<StaffProfile | null>(null);
  const [pinIngresado, setPinIngresado] = useState('1234');
  const [errorPin, setErrorPin] = useState<string | null>(null);

  // Modal Agendar Cita (Solo Admin)
  const [modalAgendarAbierto, setModalAgendarAbierto] = useState(false);
  const [agendarManicuristaId, setAgendarManicuristaId] = useState('');
  const [agendarServicioId, setAgendarServicioId] = useState<number>(1);
  const [agendarServiciosExtrasIds, setAgendarServiciosExtrasIds] = useState<number[]>([]);
  const [agendarFecha, setAgendarFecha] = useState(hoyStr);
  const [agendarHora, setAgendarHora] = useState('09:30');
  const [agendarNombre, setAgendarNombre] = useState('');
  const [agendarTelefono, setAgendarTelefono] = useState('');
  const [guardandoCita, setGuardandoCita] = useState(false);
  const [errorAgendar, setErrorAgendar] = useState<string | null>(null);

  // Estados para dropdowns bonitos en el modal agendar
  const [menuManiAbierto, setMenuManiAbierto] = useState(false);
  const [menuServicioAbierto, setMenuServicioAbierto] = useState(false);
  const [menuHoraAbierto, setMenuHoraAbierto] = useState(false);

  // Modal Bloquear Horarios (Disponible para Administradora y Manicuristas)
  const [modalBloquearAbierto, setModalBloquearAbierto] = useState(false);
  const [bloquearManicuristaId, setBloquearManicuristaId] = useState<string>('');
  const [bloquearFecha, setBloquearFecha] = useState(hoyStr);
  const [bloquearHorasSeleccionadas, setBloquearHorasSeleccionadas] = useState<string[]>([]);
  const [bloquearMotivo, setBloquearMotivo] = useState('🍱 Almuerzo');
  const [bloquearMotivoPersonalizado, setBloquearMotivoPersonalizado] = useState('');
  const [guardandoBloqueo, setGuardandoBloqueo] = useState(false);
  const [errorBloquear, setErrorBloquear] = useState<string | null>(null);
  const [menuBloquearManiAbierto, setMenuBloquearManiAbierto] = useState(false);

  // Estados para el Modal de Restricción del Bot (Sin Acceso Automático a Enlaces de Reserva)
  const [modalExclusionesAbierto, setModalExclusionesAbierto] = useState(false);
  const [exclusionesBot, setExclusionesBot] = useState<Array<{ id?: string; telefono: string; nombre?: string; motivo?: string; creado_en?: string }>>([]);
  const [cargandoExclusiones, setCargandoExclusiones] = useState(false);
  const [nuevoTelExclusion, setNuevoTelExclusion] = useState('');
  const [nuevoNombreExclusion, setNuevoNombreExclusion] = useState('');
  const [busquedaExclusion, setBusquedaExclusion] = useState('');
  const [guardandoExclusion, setGuardandoExclusion] = useState(false);
  const [errorExclusion, setErrorExclusion] = useState<string | null>(null);

  // Modal Elegante de Confirmación para Reactivar Bot (Quitar Restricción)
  const [exclusionAReactivar, setExclusionAReactivar] = useState<{ telefono: string; nombre?: string } | null>(null);
  const [reactivandoBot, setReactivandoBot] = useState(false);

  // Cargar lista de exclusiones desde el backend
  const cargarExclusionesBot = async () => {
    try {
      setCargandoExclusiones(true);
      const res = await fetch('/api/bot/exclusiones');
      if (res.ok) {
        const data = await res.json();
        setExclusionesBot(data.exclusiones || []);
      }
    } catch (e) {
      console.error('Error cargando exclusiones:', e);
    } finally {
      setCargandoExclusiones(false);
    }
  };

  // Configuración de Anticipos, Cuentas y Horario de Trabajo (Modal de Configuración)
  const [configAnticipo, setConfigAnticipo] = useState<{
    exigeAnticipo: boolean;
    montoAnticipoFijo?: number;
    porcentajeAnticipo?: number;
    nequiNumero: string;
    bancolombiaNumero: string;
    titularCuenta: string;
    horaApertura: string;
    horaCierre: string;
  }>({
    exigeAnticipo: false,
    montoAnticipoFijo: 20000,
    porcentajeAnticipo: 20000,
    nequiNumero: '',
    bancolombiaNumero: '',
    titularCuenta: 'Ópalo Nails Spa',
    horaApertura: '08:00',
    horaCierre: '19:00',
  });
  const [modalConfigAnticipoAbierto, setModalConfigAnticipoAbierto] = useState(false);
  const [guardandoConfigAnticipo, setGuardandoConfigAnticipo] = useState(false);
  const [procesandoAccionAnticipo, setProcesandoAccionAnticipo] = useState<string | null>(null);

  // Estado para el modal de añadir servicio adicional (decorados, cristales, diseño extra)
  const [citaParaAdicional, setCitaParaAdicional] = useState<Reserva | null>(null);
  const [guardandoAdicional, setGuardandoAdicional] = useState(false);

  const abrirModalAdicional = (cita: Reserva) => {
    setCitaParaAdicional(cita);
  };

  const handleGuardarAdicional = async (reservaId: string, monto: number) => {
    setGuardandoAdicional(true);
    try {
      const citaActual = reservas.find((r) => r.id === reservaId);
      if (!citaActual) throw new Error('Cita no encontrada');

      const nuevoValorTotal = Number(citaActual.valor_total || 0) + monto;
      const notaExtra = ` | ✨ Adicional: +$${monto.toLocaleString('es-CO')} [ADICIONAL:${monto}]`;
      const nuevasNotas = (citaActual.notas || '') + notaExtra;

      let apiOk = false;
      try {
        const res = await fetch(`/api/reservas/${reservaId}/adicional`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ valor_total: nuevoValorTotal, notas: nuevasNotas }),
        });
        if (res.ok) apiOk = true;
      } catch {}

      if (!apiOk) {
        const { error } = await supabase
          .from('reservas')
          .update({
            valor_total: nuevoValorTotal,
            notas: nuevasNotas,
          })
          .eq('id', reservaId);

        if (error) throw error;
      }

      // Actualizar estado local de reservas
      setReservas((prev) =>
        prev.map((r) =>
          r.id === reservaId
            ? { ...r, valor_total: nuevoValorTotal, notas: nuevasNotas }
            : r
        )
      );

      // Si el popover está abierto con esta misma cita, refrescarlo
      if (popoverCita && popoverCita.cita.id === reservaId) {
        setPopoverCita({
          ...popoverCita,
          cita: {
            ...popoverCita.cita,
            valor_total: nuevoValorTotal,
            notas: nuevasNotas,
          },
        });
      }
    } finally {
      setGuardandoAdicional(false);
    }
  };

  const handleEliminarAdicional = async (cita: Reserva) => {
    if (!window.confirm('¿Deseas remover los adicionales registrados en esta cita y volver al valor base?')) {
      return;
    }
    try {
      const totalAds = sumarAdicionalesCita(cita.notas);
      const nuevoValorTotal = Math.max(0, Number(cita.valor_total || 0) - totalAds);
      const nuevasNotas = (cita.notas || '')
        .replace(/\s*\|\s*✨\s*Adicional:[^|[]*\[ADICIONAL:\d+\]/gi, '')
        .replace(/\[ADICIONAL:\d+\]/gi, '')
        .trim();

      let apiOk = false;
      try {
        const res = await fetch(`/api/reservas/${cita.id}/adicional`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ valor_total: nuevoValorTotal, notas: nuevasNotas }),
        });
        if (res.ok) apiOk = true;
      } catch {}

      if (!apiOk) {
        const { error } = await supabase
          .from('reservas')
          .update({
            valor_total: nuevoValorTotal,
            notas: nuevasNotas,
          })
          .eq('id', cita.id);

        if (error) throw error;
      }

      setReservas((prev) =>
        prev.map((r) =>
          r.id === cita.id
            ? { ...r, valor_total: nuevoValorTotal, notas: nuevasNotas }
            : r
        )
      );

      if (popoverCita && popoverCita.cita.id === cita.id) {
        setPopoverCita({
          ...popoverCita,
          cita: {
            ...popoverCita.cita,
            valor_total: nuevoValorTotal,
            notas: nuevasNotas,
          },
        });
      }
    } catch (err: any) {
      console.error('Error al remover adicional:', err);
      alert('No se pudo quitar el adicional: ' + err.message);
    }
  };

  const cargarConfigAnticipo = async () => {
    try {
      const res = await fetch('/api/spa/config');
      if (res.ok) {
        const d = await res.json();
        const montoFijo = Number(d.montoAnticipoFijo ?? d.porcentajeAnticipo) || 20000;
        setConfigAnticipo({
          exigeAnticipo: Boolean(d.exigeAnticipo),
          montoAnticipoFijo: montoFijo,
          porcentajeAnticipo: montoFijo,
          nequiNumero: d.nequiNumero || '',
          bancolombiaNumero: d.bancolombiaNumero || '',
          titularCuenta: d.titularCuenta || 'Ópalo Nails Spa',
          horaApertura: d.horaApertura || '08:00',
          horaCierre: d.horaCierre || '19:00',
        });
      }
    } catch (e) {
      console.error('Error al cargar config de anticipo y horario:', e);
    }
  };

  const handleGuardarConfigAnticipo = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardandoConfigAnticipo(true);
    try {
      const res = await fetch('/api/spa/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configAnticipo),
      });
      if (res.ok) {
        try { sessionStorage.removeItem('opalo_bootstrap'); } catch {}
        setModalConfigAnticipoAbierto(false);
        cargarReservas();
      } else {
        console.error('No se pudo guardar la configuración.');
      }
    } catch (err: any) {
      console.error('Error guardando configuración:', err.message);
    } finally {
      setGuardandoConfigAnticipo(false);
    }
  };

  const handleAprobarAnticipo = async (reservaId: string, nombreClienta: string) => {
    if (!window.confirm(`¿Aprobar el anticipo de "${nombreClienta}"? Se confirmará la cita y se enviará la notificación oficial por WhatsApp.`)) return;
    setProcesandoAccionAnticipo(reservaId);
    try {
      const res = await fetch(`/api/reservas/${reservaId}/aprobar-anticipo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notas_admin: 'Aprobado manualmente desde el Visor de Control' }),
      });
      if (res.ok) {
        await cargarReservas();
      } else {
        alert('No se pudo aprobar el anticipo.');
      }
    } catch (err: any) {
      alert('Error aprobando anticipo: ' + err.message);
    } finally {
      setProcesandoAccionAnticipo(null);
    }
  };

  const handleRechazarAnticipo = async (reservaId: string, nombreClienta: string) => {
    const motivo = window.prompt(
      `¿Rechazar el turno de "${nombreClienta}" y liberar el horario? Escribe un motivo breve para la clienta:`,
      'Comprobante no válido o tiempo límite expirado'
    );
    if (motivo === null) return;
    setProcesandoAccionAnticipo(reservaId);
    try {
      const res = await fetch(`/api/reservas/${reservaId}/rechazar-anticipo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivo.trim() || 'Comprobante no válido o tiempo límite expirado' }),
      });
      if (res.ok) {
        await cargarReservas();
      } else {
        alert('No se pudo rechazar la reserva.');
      }
    } catch (err: any) {
      alert('Error rechazando reserva: ' + err.message);
    } finally {
      setProcesandoAccionAnticipo(null);
    }
  };

  useEffect(() => {
    if (esAdmin) {
      cargarExclusionesBot();
      cargarConfigAnticipo();
    }
  }, [esAdmin]);

  const abrirModalExclusiones = () => {
    setNuevoTelExclusion('');
    setNuevoNombreExclusion('');
    setErrorExclusion(null);
    setBusquedaExclusion('');
    setModalExclusionesAbierto(true);
    cargarExclusionesBot();
  };

  const handleAgregarExclusion = async (e: React.FormEvent) => {
    e.preventDefault();
    const telLimpio = nuevoTelExclusion.replace(/\D/g, '');
    if (!telLimpio || telLimpio.length < 7) {
      setErrorExclusion('Por favor ingresa un número de teléfono válido.');
      return;
    }

    setGuardandoExclusion(true);
    setErrorExclusion(null);
    try {
      const res = await fetch('/api/bot/exclusiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefono: telLimpio,
          nombre: nuevoNombreExclusion.trim() || undefined,
        }),
      });

      if (res.ok) {
        setNuevoTelExclusion('');
        setNuevoNombreExclusion('');
        await cargarExclusionesBot();
      } else {
        const data = await res.json();
        setErrorExclusion(data.error || 'No se pudo guardar la restricción.');
      }
    } catch (err: any) {
      setErrorExclusion('Error de conexión al agregar número.');
    } finally {
      setGuardandoExclusion(false);
    }
  };

  // Abrir modal de confirmación con los colores de la app para Reactivar Bot
  const solicitarReactivarBot = (telefono: string, nombre?: string) => {
    setExclusionAReactivar({ telefono, nombre });
  };

  // Procesar reactivación confirmada
  const handleConfirmarReactivarBot = async () => {
    if (!exclusionAReactivar) return;
    setReactivandoBot(true);
    try {
      const res = await fetch(`/api/bot/exclusiones/${exclusionAReactivar.telefono}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setExclusionesBot((prev) => prev.filter((item) => item.telefono !== exclusionAReactivar.telefono));
        setExclusionAReactivar(null);
      } else {
        alert('No se pudo reactivar el bot en el servidor.');
      }
    } catch (e) {
      console.error('Error eliminando restricción:', e);
      alert('Error de conexión al reactivar el bot.');
    } finally {
      setReactivandoBot(false);
    }
  };

  // Objeto de la manicurista actualmente seleccionada en el formulario
  const manicuristaSeleccionadaForm = useMemo(() => {
    return canchas.find((c) => c.id === agendarManicuristaId) || canchas[0];
  }, [canchas, agendarManicuristaId]);

  // Objeto del servicio actualmente seleccionado en el formulario
  const servicioSeleccionadoForm = useMemo(() => {
    return servicios.find((s) => s.id === Number(agendarServicioId)) || servicios[0];
  }, [servicios, agendarServicioId]);

  // Servicios extras seleccionados en el modal de agendar admin
  const serviciosExtrasForm = useMemo(() => {
    return servicios.filter((s) => agendarServiciosExtrasIds.includes(s.id));
  }, [servicios, agendarServiciosExtrasIds]);

  // Duración total combinada (principal + extras)
  const duracionTotalAdmin = useMemo(() => {
    const durPrincipal = servicioSeleccionadoForm?.duracion || 45;
    const durExtras = serviciosExtrasForm.reduce((acc, s) => acc + (s.duracion || 0), 0);
    return durPrincipal + durExtras;
  }, [servicioSeleccionadoForm, serviciosExtrasForm]);

  // Precio total combinado (principal + extras)
  const precioTotalAdmin = useMemo(() => {
    const prePrincipal = servicioSeleccionadoForm?.precio || 16000;
    const preExtras = serviciosExtrasForm.reduce((acc, s) => acc + (s.precio || 0), 0);
    return prePrincipal + preExtras;
  }, [servicioSeleccionadoForm, serviciosExtrasForm]);

  // Nombre de servicios combinados (ej. "Manos + Pies")
  const nombreServiciosAdmin = useMemo(() => {
    if (!servicioSeleccionadoForm) return 'Manos';
    if (serviciosExtrasForm.length === 0) return servicioSeleccionadoForm.nombre;
    return [servicioSeleccionadoForm.nombre, ...serviciosExtrasForm.map((s) => s.nombre)].join(' + ');
  }, [servicioSeleccionadoForm, serviciosExtrasForm]);

  // Horas base de opciones de bloqueo calculadas dinámicamente según horario configurado en el spa
  const horasOpcionesBloqueoDinamicas = useMemo(() => {
    return calcularHorasOpcionesBloqueo(configAnticipo.horaApertura, configAnticipo.horaCierre, 30);
  }, [configAnticipo.horaApertura, configAnticipo.horaCierre]);

  // Horas para el timeline visual calculadas dinámicamente según horario de apertura y cierre
  const horasTimeline = useMemo(() => {
    return calcularHorasTimeline(configAnticipo.horaApertura, configAnticipo.horaCierre);
  }, [configAnticipo.horaApertura, configAnticipo.horaCierre]);

  // Horas libres para el modal de Agendar Cita con cálculo dinámico por duración y fin de citas previas
  const horasDisponiblesAgendarAdmin = useMemo(() => {
    if (!agendarFecha || !agendarManicuristaId) return [];

    const aperturaStr = configAnticipo.horaApertura || '08:00';
    const cierreStr = configAnticipo.horaCierre || '19:00';
    const duracionMinutos = duracionTotalAdmin;
    const horaCierreMs = new Date(`${agendarFecha}T${cierreStr}:00-05:00`).getTime();
    const horaAperturaMs = new Date(`${agendarFecha}T${aperturaStr}:00-05:00`).getTime();
    const ahoraMs = Date.now();
    const esHoy = agendarFecha === hoyStr;

    // Generar franjas base cada 30 minutos desde la hora de apertura hasta la de cierre
    const [aperH, aperM] = aperturaStr.split(':').map(Number);
    const [cierH, cierM] = cierreStr.split(':').map(Number);
    const startMin = (isNaN(aperH) ? 8 : aperH) * 60 + (isNaN(aperM) ? 0 : aperM);
    const endMin = (isNaN(cierH) ? 19 : cierH) * 60 + (isNaN(cierM) ? 0 : cierM);

    const horasBaseAdmin: string[] = [];
    for (let m = startMin; m < endMin; m += 30) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      horasBaseAdmin.push(`${hh}:${mm}`);
    }

    const candidatosSet = new Set<string>(horasBaseAdmin);

    // Reservas activas de la manicurista seleccionada en esta fecha
    const reservasMani = reservas.filter((r) => {
      if (r.estado === 'cancelada') return false;
      if (r.cancha_id !== agendarManicuristaId) return false;
      if (!r.fecha_inicio) return false;
      const fCita = new Date(r.fecha_inicio).toLocaleDateString('en-CA', {
        timeZone: 'America/Bogota',
      });
      return fCita === agendarFecha;
    });

    // Añadir puntos de inicio candidatos donde terminan citas previas de esa manicurista
    for (const r of reservasMani) {
      if (r.fecha_fin) {
        try {
          const hhmmFin = obtenerHoraMinutosBogota(r.fecha_fin);
          const finMs = new Date(`${agendarFecha}T${hhmmFin}:00-05:00`).getTime();
          if (finMs >= horaAperturaMs && finMs < horaCierreMs) {
            candidatosSet.add(hhmmFin);
          }
        } catch {
          // Ignorar
        }
      }
    }

    const candidatosOrdenados = Array.from(candidatosSet).sort();
    const libres: string[] = [];

    for (const h of candidatosOrdenados) {
      const slotStartMs = new Date(`${agendarFecha}T${h}:00-05:00`).getTime();
      const slotEndMs = slotStartMs + duracionMinutos * 60 * 1000;

      // 1. Si es hoy y el horario ya pasó, no se puede agendar
      if (esHoy && slotStartMs <= ahoraMs) {
        continue;
      }

      // Si es una fecha anterior a hoy en Colombia, descartar todo
      if (agendarFecha < hoyStr) {
        continue;
      }

      // 2. Si sobrepasa la hora de cierre del spa, no se puede agendar
      if (slotEndMs > horaCierreMs) {
        continue;
      }

      // 3. Validar si solapa con alguna reserva activa o bloqueada existente de esta manicurista
      const colisiona = reservasMani.some((r) => {
        const rStart = new Date(r.fecha_inicio).getTime();
        const rEnd = new Date(r.fecha_fin).getTime();
        return rStart < slotEndMs && rEnd > slotStartMs;
      });

      if (!colisiona) {
        libres.push(h);
      }
    }

    return libres;
  }, [reservas, agendarFecha, agendarManicuristaId, duracionTotalAdmin, hoyStr, configAnticipo.horaApertura, configAnticipo.horaCierre]);

  // Si cambia la manicurista, el servicio o la fecha en el modal de agendar, ajustar a una hora disponible
  useEffect(() => {
    if (modalAgendarAbierto) {
      if (horasDisponiblesAgendarAdmin.length > 0) {
        if (!horasDisponiblesAgendarAdmin.includes(agendarHora)) {
          setAgendarHora(horasDisponiblesAgendarAdmin[0]);
        }
      } else {
        setAgendarHora('');
      }
    }
  }, [modalAgendarAbierto, agendarFecha, agendarManicuristaId, duracionTotalAdmin, horasDisponiblesAgendarAdmin]);

  // Horas ya ocupadas o bloqueadas para el modal de Bloquear Horario
  const horasYaOcupadasBloqueo = useMemo(() => {
    if (!bloquearFecha) return new Set<string>();

    const ocupadas = new Set<string>();

    for (const h of horasOpcionesBloqueoDinamicas) {
      const slotStartMs = new Date(`${bloquearFecha}T${h}:00-05:00`).getTime();
      const slotEndMs = slotStartMs + 60 * 60 * 1000;

      const estaOcupada = reservas.some((r) => {
        if (r.estado === 'cancelada') return false;
        if (bloquearManicuristaId !== 'todas' && r.cancha_id !== bloquearManicuristaId) return false;
        const rStart = new Date(r.fecha_inicio).getTime();
        const rEnd = new Date(r.fecha_fin).getTime();
        return rStart < slotEndMs && rEnd > slotStartMs;
      });

      if (estaOcupada) {
        ocupadas.add(h);
      }
    }

    return ocupadas;
  }, [reservas, bloquearFecha, bloquearManicuristaId, horasOpcionesBloqueoDinamicas]);

  // Horas que ya han pasado para el modal de Bloquear Horario (no se pueden bloquear)
  const horasYaPasadasBloqueo = useMemo(() => {
    if (!bloquearFecha) return new Set<string>();
    const pasadas = new Set<string>();
    const ahoraMs = ahora.getTime();
    const esFechaPasada = bloquearFecha < hoyStr;
    const esHoy = bloquearFecha === hoyStr;

    if (esFechaPasada) {
      for (const h of horasOpcionesBloqueoDinamicas) {
        pasadas.add(h);
      }
      return pasadas;
    }

    if (esHoy) {
      for (const h of horasOpcionesBloqueoDinamicas) {
        const slotStartMs = new Date(`${bloquearFecha}T${h}:00-05:00`).getTime();
        if (slotStartMs <= ahoraMs) {
          pasadas.add(h);
        }
      }
    }

    return pasadas;
  }, [bloquearFecha, hoyStr, horasOpcionesBloqueoDinamicas, ahora]);

  // 1. Cargar datos del Spa (Equipo, Servicios, Configuración unificada)
  const cargarInfoSpa = async () => {
    try {
      const res = await fetch('/api/spa/info');
      if (res.ok) {
        const d = await res.json();
        const idReal = d.complejo?.id || complejoId || '';
        setIdComplejoDetectado(idReal);
        const listaEquipo = d.equipo || d.canchas;
        if (listaEquipo && listaEquipo.length > 0) {
          const normalizadas = listaEquipo.map((c: any) => {
            let nombre = c.nombre;
            const nLower = nombre.trim().toLowerCase();
            if (nLower === '1' || nLower === 'manicurista 1') nombre = 'Especialista 1';
            else if (nLower === '2' || nLower === 'manicurista 2') nombre = 'Especialista 2';
            else if (nLower === '3' || nLower === 'manicurista 3') nombre = 'Especialista 3';
            else if (nLower === '4' || nLower === 'manicurista 4') nombre = 'Especialista 4';
            const foto = c.foto || FOTOS_EQUIPO_ADMIN[nombre.toLowerCase()] || FOTOS_EQUIPO_ADMIN[c.nombre.toLowerCase()] || null;
            return { ...c, nombre, foto };
          });
          setCanchas(normalizadas);
        }
        if (d.servicios && d.servicios.length > 0) setServicios(d.servicios);
        if (d.config) {
          const montoFijo = Number(d.config.montoAnticipoFijo ?? d.config.porcentajeAnticipo) || 20000;
          setConfigAnticipo({
            exigeAnticipo: Boolean(d.config.exigeAnticipo),
            montoAnticipoFijo: montoFijo,
            porcentajeAnticipo: montoFijo,
            nequiNumero: d.config.nequiNumero || '',
            bancolombiaNumero: d.config.bancolombiaNumero || '',
            titularCuenta: d.config.titularCuenta || 'Ópalo Nails Spa',
            horaApertura: d.config.horaApertura || '08:00',
            horaCierre: d.config.horaCierre || '19:00',
          });
        }
        cargarReservas(idReal);
        return;
      }
    } catch (e) {
      console.warn('API /api/spa/info no disponible, usando Supabase directo:', e);
    }

    // Fallback directo a Supabase
    try {
      const { data: comp } = await supabase.from('complejos').select('*').limit(1).maybeSingle();
      if (comp) {
        setIdComplejoDetectado(comp.id);
        const montoFijo = Number(comp.monto_anticipo_fijo ?? comp.porcentaje_anticipo_minimo) || 20000;
        setConfigAnticipo({
          exigeAnticipo: Boolean(Number(comp.porcentaje_anticipo_minimo || 0) > 0),
          montoAnticipoFijo: montoFijo,
          porcentajeAnticipo: montoFijo,
          nequiNumero: comp.nequi_numero || '',
          bancolombiaNumero: comp.daviplata_numero || '',
          titularCuenta: comp.titular_cuenta || 'Ópalo Nails Spa',
          horaApertura: comp.hora_apertura ? comp.hora_apertura.slice(0, 5) : '08:00',
          horaCierre: comp.hora_cierre ? comp.hora_cierre.slice(0, 5) : '19:00',
        });
      }

      const { data: canchasDb } = await supabase
        .from('canchas')
        .select('*')
        .order('nombre');

      if (canchasDb && canchasDb.length > 0) {
        const normalizadas = canchasDb.map((c: any) => {
          let nombre = c.nombre;
          const nLower = nombre.trim().toLowerCase();
          if (nLower === '1' || nLower === 'manicurista 1') nombre = 'Especialista 1';
          else if (nLower === '2' || nLower === 'manicurista 2') nombre = 'Especialista 2';
          else if (nLower === '3' || nLower === 'manicurista 3') nombre = 'Especialista 3';
          else if (nLower === '4' || nLower === 'manicurista 4') nombre = 'Especialista 4';
          const foto = c.foto || FOTOS_EQUIPO_ADMIN[nombre.toLowerCase()] || null;
          return { ...c, nombre, foto };
        });
        setCanchas(normalizadas);
      }

      const { data: serviciosDb } = await supabase
        .from('servicios')
        .select('*')
        .order('orden');
      if (serviciosDb && serviciosDb.length > 0) {
        setServicios(serviciosDb);
      }

      cargarReservas(comp?.id);
    } catch (sbErr) {
      console.error('Error en fallback Supabase para info del spa:', sbErr);
    }
  };

  // 2. Cargar Reservas del Spa
  const cargarReservas = async (overrideId?: string | unknown, silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      const spaId =
        typeof overrideId === 'string' && overrideId
          ? overrideId
          : idComplejoDetectado || complejoId || '';
      const url = spaId ? `/api/reservas?complejo_id=${spaId}` : '/api/reservas';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setReservas(data || []);
        return;
      }
    } catch (e) {
      console.warn('API /api/reservas no disponible o cargando, usando Supabase directo:', e);
    }

    // Fallback Supabase directo
    try {
      const { data, error } = await supabase
        .from('reservas')
        .select('*, canchas(id, nombre, deporte), clientes(nombre, telefono_wa), pagos_anticipos(*)')
        .order('fecha_inicio', { ascending: true });

      if (!error && data) {
        setReservas(data as Reserva[]);
      }
    } catch (sbErr) {
      console.error('Error cargando reservas desde Supabase:', sbErr);
    } finally {
      if (!silencioso) setCargando(false);
    }
  };

  useEffect(() => {
    cargarInfoSpa();
    cargarReservas();
    cargarConfigAnticipo();
  }, [complejoId]);

  // Suscripción Realtime a cambios en reservas (Broadcast + Postgres + Polling inteligente)
  useEffect(() => {
    const canal = supabase
      .channel('opalo-reservas-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservas',
        },
        (payload) => {
          console.log('⚡ [Realtime Postgres] Cambio detectado en reservas:', payload.eventType);
          if (payload.eventType === 'INSERT') {
            mostrarNotificacionRealtime('¡Nueva cita agendada en vivo!');
          } else if (payload.eventType === 'UPDATE') {
            mostrarNotificacionRealtime('¡Cita o turno actualizado en vivo!');
          } else if (payload.eventType === 'DELETE') {
            mostrarNotificacionRealtime('Turno liberado en vivo');
          }
          // Refresco silencioso en segundo plano sin bloquear la pantalla
          cargarReservas(undefined, true);
        }
      )
      .on('broadcast', { event: 'cambio-reservas' }, (payload: any) => {
        console.log('⚡ [Realtime Broadcast] Cambio en reservas recibido:', payload);
        const evType = payload.payload?.eventType || payload.payload?.accion || 'UPDATE';
        if (evType === 'INSERT') {
          mostrarNotificacionRealtime('¡Nueva cita agendada en vivo!');
        } else if (evType === 'UPDATE') {
          mostrarNotificacionRealtime('¡Cita o turno actualizado en vivo!');
        } else if (evType === 'DELETE') {
          mostrarNotificacionRealtime('Turno liberado en vivo');
        }
        cargarReservas(undefined, true);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('⚡ [Realtime] Conectado a eventos de reservas');
          setRealtimeConectado(true);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setRealtimeConectado(false);
        }
      });

    // Polling inteligente de respaldo cada 5 segundos (silencioso, sin parpadeos ni spinners)
    const pollTimer = setInterval(() => {
      cargarReservas(undefined, true);
    }, 5000);

    // Actualización automática instantánea al cambiar o enfocar la pestaña
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        cargarReservas(undefined, true);
      }
    };
    window.addEventListener('focus', onVisibilityChange);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(pollTimer);
      window.removeEventListener('focus', onVisibilityChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      supabase.removeChannel(canal);
      if (notifTimeoutRef.current) clearTimeout(notifTimeoutRef.current);
    };
  }, [idComplejoDetectado, complejoId]);

  // Sincronizar perfiles con IDs de las canchas en la BD
  const perfilesConIds: StaffProfile[] = useMemo(() => {
    return PERFILES_SPA_CONFIG.map((p) => {
      // Para Administradora general, no necesita canchaId única (supervisa todas)
      if (p.rol === 'admin') {
        return { ...p, canchaId: undefined };
      }
      const canchaEncontrada = canchas.find((c) => {
        const cLower = c.nombre.toLowerCase();
        const pMatch = p.canchaNombreMatch ? p.canchaNombreMatch.toLowerCase() : '';
        return (
          (pMatch && cLower.includes(pMatch)) ||
          (p.id.includes('m1') && (cLower.includes('1') || cLower.includes('uno'))) ||
          (p.id.includes('m2') && (cLower.includes('2') || cLower.includes('dos'))) ||
          (p.id.includes('m3') && (cLower.includes('3') || cLower.includes('tres'))) ||
          (p.id.includes('m4') && (cLower.includes('4') || cLower.includes('cuatro')))
        );
      });
      return {
        ...p,
        canchaId: canchaEncontrada?.id,
      };
    });
  }, [canchas]);

  // Si el perfil guardado en localStorage no tiene canchaId o cambió de rol, sincronizarlo
  useEffect(() => {
    if (perfilActual) {
      const match = perfilesConIds.find(
        (p) =>
          p.id === perfilActual.id ||
          (perfilActual.rol === 'admin' && p.rol === 'admin') ||
          (perfilActual.id === 'admin-m1' && p.id === 'admin') ||
          (perfilActual.id === 'admin-m2' && p.id === 'staff-m2') ||
          (p.canchaNombreMatch && perfilActual.canchaNombreMatch && p.canchaNombreMatch.toLowerCase() === perfilActual.canchaNombreMatch.toLowerCase()) ||
          p.nombre.toLowerCase().includes(perfilActual.nombre.toLowerCase().split(' ')[0])
      );
      if (match) {
        if (
          match.rol !== perfilActual.rol ||
          match.nombre !== perfilActual.nombre ||
          match.foto !== perfilActual.foto ||
          (match.canchaId && match.canchaId !== perfilActual.canchaId)
        ) {
          const actualizado = { ...perfilActual, ...match };
          setPerfilActual(actualizado);
          localStorage.setItem('opalo_staff_profile', JSON.stringify(actualizado));
        }
      } else {
        // Si el perfil guardado no corresponde a ninguno de los perfiles válidos, volver al selector
        setPerfilActual(null);
        localStorage.removeItem('opalo_staff_profile');
      }
    }
  }, [perfilesConIds]);

  // Navegar días hacia atrás o adelante
  const cambiarDia = (offset: number) => {
    const [y, m, d] = fechaSeleccionada.split('-').map(Number);
    const fechaObj = new Date(y, m - 1, d);
    fechaObj.setDate(fechaObj.getDate() + offset);
    const nuevoY = fechaObj.getFullYear();
    const nuevoM = String(fechaObj.getMonth() + 1).padStart(2, '0');
    const nuevoD = String(fechaObj.getDate()).padStart(2, '0');
    setFechaSeleccionada(`${nuevoY}-${nuevoM}-${nuevoD}`);
  };

  // Navegar semanas hacia atrás o adelante (desplaza 7 días)
  const cambiarSemana = (offsetSemanas: number) => {
    const [y, m, d] = fechaSeleccionada.split('-').map(Number);
    const fechaObj = new Date(y, m - 1, d);
    fechaObj.setDate(fechaObj.getDate() + offsetSemanas * 7);
    const nuevoY = fechaObj.getFullYear();
    const nuevoM = String(fechaObj.getMonth() + 1).padStart(2, '0');
    const nuevoD = String(fechaObj.getDate()).padStart(2, '0');
    setFechaSeleccionada(`${nuevoY}-${nuevoM}-${nuevoD}`);
  };

  // Cálculo de los 7 días de la semana activa (Lunes a Domingo)
  const diasDeLaSemana = useMemo(() => {
    if (!fechaSeleccionada) return [];
    const [y, m, d] = fechaSeleccionada.split('-').map(Number);
    const refDate = new Date(y, m - 1, d);
    const dayOfWeek = refDate.getDay(); // 0 es Domingo, 1 es Lunes...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(refDate);
    monday.setDate(monday.getDate() + diffToMonday);

    const dias = [];
    for (let i = 0; i < 7; i++) {
      const curDate = new Date(monday);
      curDate.setDate(monday.getDate() + i);
      const curY = curDate.getFullYear();
      const curM = String(curDate.getMonth() + 1).padStart(2, '0');
      const curD = String(curDate.getDate()).padStart(2, '0');
      const fechaIso = `${curY}-${curM}-${curD}`;

      const nombreDia = curDate.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '');
      const nombreDiaLargo = curDate.toLocaleDateString('es-CO', { weekday: 'long' });
      const diaNum = curDate.getDate();
      const mesCorto = curDate.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '');

      dias.push({
        fechaIso,
        fechaObj: curDate,
        nombreCorto: nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1),
        nombreLargo: nombreDiaLargo.charAt(0).toUpperCase() + nombreDiaLargo.slice(1),
        diaNum,
        mesCorto,
        esHoy: fechaIso === hoyStr,
        esSeleccionada: fechaIso === fechaSeleccionada,
      });
    }
    return dias;
  }, [fechaSeleccionada, hoyStr]);

  // Etiqueta legible del rango de la semana (ej: "5 al 11 de octubre de 2026")
  const etiquetaSemana = useMemo(() => {
    if (diasDeLaSemana.length < 7) return '';
    const primerDia = diasDeLaSemana[0];
    const ultimoDia = diasDeLaSemana[6];
    const mes1 = primerDia.fechaObj.toLocaleDateString('es-CO', { month: 'long' });
    const mes2 = ultimoDia.fechaObj.toLocaleDateString('es-CO', { month: 'long' });
    const anio = primerDia.fechaObj.getFullYear();
    if (primerDia.fechaObj.getMonth() === ultimoDia.fechaObj.getMonth()) {
      return `${primerDia.diaNum} al ${ultimoDia.diaNum} de ${mes1} de ${anio}`;
    } else {
      return `${primerDia.diaNum} de ${mes1} al ${ultimoDia.diaNum} de ${mes2} de ${anio}`;
    }
  }, [diasDeLaSemana]);

  // Fecha legible en español
  const fechaLegible = useMemo(() => {
    if (!fechaSeleccionada) return '';
    const [y, m, d] = fechaSeleccionada.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const texto = dateObj.toLocaleDateString('es-CO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }, [fechaSeleccionada]);

  // Etiqueta contextual y no ambigua: Hoy, Mañana, Ayer o día específico (ej: Sáb, 10 oct)
  const etiquetaFechaRelativa = useMemo(() => {
    if (!fechaSeleccionada || !hoyStr) return 'Hoy';
    const [y1, m1, d1] = hoyStr.split('-').map(Number);
    const [y2, m2, d2] = fechaSeleccionada.split('-').map(Number);
    const dHoy = new Date(y1, m1 - 1, d1);
    const dSel = new Date(y2, m2 - 1, d2);

    const diffMs = dSel.getTime() - dHoy.getTime();
    const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDias === 0) return 'Hoy';
    if (diffDias === 1) return 'Mañana';
    if (diffDias === -1) return 'Ayer';

    // Para cualquier otra fecha: día abreviado + número de día + mes (ej: "Sáb, 10 oct", "Lun, 12 oct")
    const diaSemana = dSel.toLocaleDateString('es-CO', { weekday: 'short' });
    const diaMes = dSel.getDate();
    const mes = dSel.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '');
    const diaCapitalizado = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1).replace('.', '');
    return `${diaCapitalizado}, ${diaMes} ${mes}`;
  }, [fechaSeleccionada, hoyStr]);

  // Cambiar mes hacia atrás o adelante para métricas mensuales
  const cambiarMes = (offset: number) => {
    const [y, m] = mesSeleccionado.split('-').map(Number);
    const fechaObj = new Date(y, m - 1 + offset, 1);
    const nuevoY = fechaObj.getFullYear();
    const nuevoM = String(fechaObj.getMonth() + 1).padStart(2, '0');
    setMesSeleccionado(`${nuevoY}-${nuevoM}`);
  };

  // Nombre legible del mes en español (ej: "Octubre de 2026")
  const nombreMesLegible = useMemo(() => {
    if (!mesSeleccionado) return '';
    const [y, m] = mesSeleccionado.split('-').map(Number);
    const fechaObj = new Date(y, m - 1, 1);
    const nombre = fechaObj.toLocaleDateString('es-CO', {
      month: 'long',
      year: 'numeric',
    });
    return nombre.charAt(0).toUpperCase() + nombre.slice(1);
  }, [mesSeleccionado]);

  // Manejo de Login con PIN
  const handleIniciarSesion = (perfil: StaffProfile) => {
    setModalPinPerfil(perfil);
    setPinIngresado(perfil.pin || '1234');
    setErrorPin(null);
  };

  const handleConfirmarPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalPinPerfil) return;

    if (pinIngresado === modalPinPerfil.pin || pinIngresado === '1234' || pinIngresado === 'admin123') {
      setPerfilActual(modalPinPerfil);
      localStorage.setItem('opalo_staff_profile', JSON.stringify(modalPinPerfil));
      setModalPinPerfil(null);
    } else {
      setErrorPin('PIN incorrecto. El PIN predeterminado es 1234.');
    }
  };

  const handleCerrarSesion = () => {
    setPerfilActual(null);
    localStorage.removeItem('opalo_staff_profile');
  };

  // Cambiar estado de una cita (Completada o Cancelada)
  const handleCambiarEstado = async (reservaId: string, nuevoEstado: string) => {
    try {
      const res = await fetch(`/api/reservas/${reservaId}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      if (res.ok) {
        setReservas((prev) =>
          prev.map((r) => (r.id === reservaId ? { ...r, estado: nuevoEstado as any } : r))
        );
      }
    } catch (e) {
      console.error('Error actualizando estado:', e);
    }
  };

  // Auto-completar citas automáticamente cuando la barra roja llega al final del recuadro de la cita (ahora >= fecha_fin)
  const citasAutoCompletadasRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!reservas || reservas.length === 0) return;
    const ahoraMs = ahora.getTime();

    const citasParaCompletar = reservas.filter((r) => {
      if (r.estado === 'completada' || r.estado === 'cancelada' || r.estado === 'bloqueada') {
        return false;
      }
      if (!r.fecha_fin) return false;
      const finMs = new Date(r.fecha_fin).getTime();
      if (isNaN(finMs)) return false;

      // La barra roja ya llegó al final del recuadro de la cita (o lo sobrepasó)
      return ahoraMs >= finMs;
    });

    for (const cita of citasParaCompletar) {
      if (!citasAutoCompletadasRef.current.has(cita.id)) {
        citasAutoCompletadasRef.current.add(cita.id);
        handleCambiarEstado(cita.id, 'completada');
      }
    }
  }, [ahora, reservas]);

  // Abrir modal de Agendar Cita con una manicurista preseleccionada
  const abrirModalAgendar = (manicuristaId?: string, horaInicial?: string, fechaInicial?: string) => {
    const maniId = manicuristaId || canchas[0]?.id || '';
    const fecha = fechaInicial || fechaSeleccionada;
    setAgendarManicuristaId(maniId);
    setAgendarFecha(fecha);
    setAgendarHora(horaInicial || '');
    setAgendarServiciosExtrasIds([]);
    setAgendarNombre('');
    setAgendarTelefono('');
    setErrorAgendar(null);
    setMenuManiAbierto(false);
    setMenuServicioAbierto(false);
    setMenuHoraAbierto(false);
    setModalAgendarAbierto(true);
  };

  // Enviar formulario de Agendar Cita (Solo Admin)
  const handleCrearCitaAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agendarNombre.trim() || !agendarTelefono.trim()) {
      setErrorAgendar('Por favor ingresa nombre y teléfono de la clienta.');
      return;
    }

    if (!agendarHora) {
      setErrorAgendar('No hay un turno válido seleccionado para esta fecha y especialista.');
      return;
    }

    setGuardandoCita(true);
    setErrorAgendar(null);

    
    try {
      const res = await fetch('/api/spa/reservar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          servicio_nombre: nombreServiciosAdmin,
          precio: precioTotalAdmin,
          duracion_minutos: duracionTotalAdmin,
          fecha: agendarFecha,
          hora: agendarHora,
          cancha_id: agendarManicuristaId || undefined,
          cliente_nombre: agendarNombre.trim(),
          cliente_telefono: agendarTelefono.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setModalAgendarAbierto(false);
        cargarReservas();
      } else {
        setErrorAgendar(data.error || 'No se pudo agendar la cita. Verifica el horario.');
      }
    } catch (err: any) {
      setErrorAgendar('Error de conexión al agendar cita: ' + err.message);
    } finally {
      setGuardandoCita(false);
    }
  };

  // Abrir modal de Bloquear Horario
  const abrirModalBloquear = (manicuristaId?: string, horaInicial?: string, fechaInicial?: string) => {
    if (!esAdmin && perfilActual?.canchaId) {
      setBloquearManicuristaId(perfilActual.canchaId);
    } else {
      setBloquearManicuristaId(
        manicuristaId ||
        (especialistaSeleccionadaId !== 'todas' ? especialistaSeleccionadaId : canchas[0]?.id || '')
      );
    }
    const fechaElegida = fechaInicial || fechaSeleccionada;
    const fechaValida = fechaElegida < hoyStr ? hoyStr : fechaElegida;
    setBloquearFecha(fechaValida);

    if (horaInicial) {
      const ahoraMs = Date.now();
      const slotMs = new Date(`${fechaValida}T${horaInicial}:00-05:00`).getTime();
      const horaYaPaso = fechaValida < hoyStr || (fechaValida === hoyStr && slotMs <= ahoraMs);
      if (!horaYaPaso) {
        setBloquearHorasSeleccionadas([horaInicial]);
      } else {
        setBloquearHorasSeleccionadas([]);
      }
    } else {
      setBloquearHorasSeleccionadas([]);
    }
    setBloquearMotivo('🍱 Almuerzo');
    setBloquearMotivoPersonalizado('');
    setErrorBloquear(null);
    setMenuBloquearManiAbierto(false);
    setModalBloquearAbierto(true);
  };

  // Toggle de selección de horas para bloqueo múltiple
  const toggleHoraBloqueo = (hora: string) => {
    if (horasYaPasadasBloqueo.has(hora) || horasYaOcupadasBloqueo.has(hora)) {
      return;
    }
    setBloquearHorasSeleccionadas((prev) =>
      prev.includes(hora) ? prev.filter((h) => h !== hora) : [...prev, hora].sort()
    );
  };

  // Enviar formulario de Bloquear Horario (Admin o Manicurista)
  const handleCrearBloqueo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bloquearHorasSeleccionadas.length === 0) {
      setErrorBloquear('Por favor selecciona al menos una hora para bloquear.');
      return;
    }

    if (bloquearFecha < hoyStr) {
      setErrorBloquear('No es posible bloquear fechas pasadas.');
      return;
    }

    const ahoraMs = Date.now();
    const horasPasadas = bloquearHorasSeleccionadas.filter((h) => {
      if (bloquearFecha === hoyStr) {
        const slotStartMs = new Date(`${bloquearFecha}T${h}:00-05:00`).getTime();
        return slotStartMs <= ahoraMs;
      }
      return false;
    });

    if (horasPasadas.length > 0) {
      setErrorBloquear('No es posible bloquear horarios que ya han pasado.');
      return;
    }

    setGuardandoBloqueo(true);
    setErrorBloquear(null);

    const motivoFinal = (bloquearMotivoPersonalizado.trim() || bloquearMotivo || 'Horario bloqueado').trim();
    const autor = perfilActual ? (perfilActual.alias || perfilActual.nombre) : 'Personal del Spa';

    const targetCanchasIds: string[] =
      bloquearManicuristaId === 'todas'
        ? canchas.map((c) => c.id)
        : [bloquearManicuristaId || (canchas[0]?.id || '')];

    try {
      // 1. Intentar endpoint en backend
      let apiSuccess = false;
      try {
        const res = await fetch('/api/bloqueos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cancha_ids: targetCanchasIds,
            fecha: bloquearFecha,
            horas: bloquearHorasSeleccionadas,
            motivo: motivoFinal,
            bloqueado_por: autor,
          }),
        });

        if (res.ok) {
          apiSuccess = true;
        } else {
          const errData = await res.json().catch(() => ({}));
          if (res.status === 409) {
            setErrorBloquear(errData.error || 'Uno o más de los horarios seleccionados ya tiene una cita o bloqueo.');
            setGuardandoBloqueo(false);
            return;
          }
        }
      } catch (errApi) {
        console.warn('API /api/bloqueos offline o error de red, usando Supabase directo:', errApi);
      }

      // 2. Si la API no respondió exitosamente, fallback directo a Supabase
      if (!apiSuccess) {
        const registros: any[] = [];
        for (const h of bloquearHorasSeleccionadas) {
          const dInicio = new Date(`${bloquearFecha}T${h}:00-05:00`);
          const dFin = new Date(dInicio.getTime() + 60 * 60 * 1000);
          for (const cid of targetCanchasIds) {
            registros.push({
              cancha_id: cid,
              cliente_id: null,
              fecha_inicio: dInicio.toISOString(),
              fecha_fin: dFin.toISOString(),
              estado: 'bloqueada',
              valor_total: 0,
              valor_anticipo_requerido: 0,
              notas: `🔒 BLOQUEO: ${motivoFinal} | Hora: ${h} | Por: ${autor}`,
            });
          }
        }

        const { error: sbErr } = await supabase.from('reservas').insert(registros);
        if (sbErr) {
          if (sbErr.code === '23P01') {
            setErrorBloquear('Uno o más de los horarios seleccionados ya tiene una cita o bloqueo.');
            setGuardandoBloqueo(false);
            return;
          }
          throw sbErr;
        }
      }

      setModalBloquearAbierto(false);
      await cargarReservas();
    } catch (err: any) {
      setErrorBloquear('Error al bloquear horarios: ' + (err.message || 'Error desconocido'));
    } finally {
      setGuardandoBloqueo(false);
    }
  };

  // Desbloquear un horario de inmediato sin popups ni confirmaciones
  const handleDesbloquearHorario = async (reservaId: string, _horaDetalle?: string) => {
    try {
      let borrado = false;
      try {
        const res = await fetch(`/api/bloqueos/${reservaId}`, { method: 'DELETE' });
        if (res.ok) borrado = true;
        else {
          const res2 = await fetch(`/api/reservas/${reservaId}`, { method: 'DELETE' });
          if (res2.ok) borrado = true;
        }
      } catch (errApi) {
        console.warn('API delete offline, usando Supabase directo:', errApi);
      }

      if (!borrado) {
        const { error } = await supabase.from('reservas').delete().eq('id', reservaId);
        if (error) throw error;
      }

      setReservas((prev) => prev.filter((r) => r.id !== reservaId));
    } catch (e: any) {
      console.error('No se pudo desbloquear el horario:', e.message || 'Error de conexión');
    }
  };

  // Filtrado de reservas por fecha seleccionada
  const reservasDelDia = useMemo(() => {
    return reservas.filter((r) => {
      if (!r.fecha_inicio) return false;
      const fechaCita = parsearFechaBogotaIso(r.fecha_inicio);
      return fechaCita === fechaSeleccionada;
    });
  }, [reservas, fechaSeleccionada]);

  // Citas reales vs Bloqueos del día
  const citasClientesDelDia = useMemo(() => {
    return reservasDelDia.filter((r) => r.estado !== 'bloqueada' && r.estado !== 'cancelada');
  }, [reservasDelDia]);

  const bloqueosDelDia = useMemo(() => {
    return reservasDelDia.filter((r) => r.estado === 'bloqueada');
  }, [reservasDelDia]);

  // Reservas de toda la semana activa
  const reservasDeLaSemana = useMemo(() => {
    if (diasDeLaSemana.length === 0) return [];
    const fechasSet = new Set(diasDeLaSemana.map((d) => d.fechaIso));
    return reservas.filter((r) => {
      if (!r.fecha_inicio) return false;
      const fechaCita = parsearFechaBogotaIso(r.fecha_inicio);
      return fechasSet.has(fechaCita);
    });
  }, [reservas, diasDeLaSemana]);

  const citasClientesDeLaSemana = useMemo(() => {
    return reservasDeLaSemana.filter((r) => r.estado !== 'bloqueada' && r.estado !== 'cancelada');
  }, [reservasDeLaSemana]);

  const bloqueosDeLaSemana = useMemo(() => {
    return reservasDeLaSemana.filter((r) => r.estado === 'bloqueada');
  }, [reservasDeLaSemana]);

  // Reservas filtradas según el modo de métricas (Día seleccionado vs Mes seleccionado, excluyendo bloqueos)
  const reservasFiltradasMetricas = useMemo(() => {
    return reservas.filter((r) => {
      if (!r.fecha_inicio) return false;
      if (r.estado === 'bloqueada') return false;
      const fechaCita = parsearFechaBogotaIso(r.fecha_inicio);
      if (modoMetricas === 'dia') {
        return fechaCita === fechaSeleccionada;
      } else if (modoMetricas === 'semana') {
        return diasDeLaSemana.some((d) => d.fechaIso === fechaCita);
      } else {
        return fechaCita.startsWith(mesSeleccionado);
      }
    });
  }, [reservas, modoMetricas, fechaSeleccionada, diasDeLaSemana, mesSeleccionado]);

  // Métricas financieras calculadas para la Admin según el período seleccionado
  const metricasSpa = useMemo(() => {
    const normalizarTexto = (txt: string) =>
      txt
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    // Servicios ordenados por longitud descendente para evitar falsos positivos por subcadenas (ej. "Manos y pies" antes que "Manos")
    const serviciosPorLongitud = [...servicios].sort((a, b) => b.nombre.length - a.nombre.length);

    // Extrae la lista exacta de servicios asociados a una cita (soporta servicio único o múltiples separados por '+')
    const extraerServiciosDeCita = (r: Reserva): Servicio[] => {
      if (servicios.length === 0) return [];
      const notas = r.notas || '';
      const matchSvc = notas.match(/Servicio:\s*([^|[\n]+)/i);

      if (matchSvc && matchSvc[1]) {
        const partes = matchSvc[1]
          .split('+')
          .map((p) => normalizarTexto(p))
          .filter(Boolean);
        const encontrados: Servicio[] = [];
        for (const parte of partes) {
          let svc = servicios.find((s) => normalizarTexto(s.nombre) === parte);
          if (!svc) {
            svc = serviciosPorLongitud.find((s) => parte.includes(normalizarTexto(s.nombre)));
          }
          if (svc && !encontrados.some((e) => e.id === svc!.id)) {
            encontrados.push(svc);
          }
        }
        if (encontrados.length > 0) return encontrados;
      }

      const notasNorm = normalizarTexto(notas);
      if (notasNorm) {
        const svcPorNota = serviciosPorLongitud.find((s) =>
          notasNorm.includes(normalizarTexto(s.nombre))
        );
        if (svcPorNota) return [svcPorNota];
      }

      const monto = Number(r.valor_total || 0);
      if (monto > 0) {
        const svcPorPrecio = servicios.find((s) => s.precio === monto);
        if (svcPorPrecio) return [svcPorPrecio];
        const svcMasCercano = [...servicios].sort((a, b) => Math.abs(a.precio - monto) - Math.abs(b.precio - monto))[0];
        if (svcMasCercano) return [svcMasCercano];
      }

      return servicios[0] ? [servicios[0]] : [];
    };

    const obtenerValorReserva = (r: Reserva): number => {
      const monto = Number(r.valor_total || 0);
      if (monto > 0) return monto;
      const svcs = extraerServiciosDeCita(r);
      return svcs.reduce((sum, s) => sum + Number(s.precio || 0), 0);
    };

    const lista = reservasFiltradasMetricas;
    const canceladas = lista.filter((r) => r.estado === 'cancelada');
    // Solo las citas activas (no canceladas) cuentan como agendadas y generan ingresos
    const citasActivas = lista.filter((r) => r.estado !== 'cancelada');
    const total = citasActivas.length;

    const confirmadas = citasActivas.filter(
      (r) => r.estado === 'confirmada' || r.estado === 'completada'
    );
    const completadas = citasActivas.filter((r) => r.estado === 'completada');
    const pendientes = citasActivas.filter((r) => r.estado !== 'completada');

    const ingresosTotales = citasActivas.reduce((sum, r) => sum + obtenerValorReserva(r), 0);
    const ingresosCompletados = completadas.reduce((sum, r) => sum + obtenerValorReserva(r), 0);

    // Desglose por manicurista en este período (basado en citas activas no canceladas)
    const porManicurista = canchas.map((c) => {
      const citasMani = citasActivas.filter((r) => r.cancha_id === c.id);
      const completadasMani = citasMani.filter((r) => r.estado === 'completada');
      const pendientesMani = citasMani.filter((r) => r.estado !== 'completada');
      const recaudadoEstimado = citasMani.reduce((sum, r) => sum + obtenerValorReserva(r), 0);
      const recaudadoRealizado = completadasMani.reduce(
        (sum, r) => sum + obtenerValorReserva(r),
        0
      );
      return {
        cancha: c,
        total: citasMani.length,
        completadas: completadasMani.length,
        pendientes: pendientesMani.length,
        ingresos: recaudadoEstimado,
        ingresosCompletados: recaudadoRealizado,
      };
    });


    // Desglose exacto por servicio en este período (sin duplicar por nombres parecidos)
    const mapaServicios = new Map<number, { cantidad: number; ingresos: number }>();
    for (const s of servicios) {
      mapaServicios.set(s.id, { cantidad: 0, ingresos: 0 });
    }

    for (const r of citasActivas) {
      const svcsCita = extraerServiciosDeCita(r);
      const adic = sumarAdicionalesCita(r.notas);
      const valorCita = Math.max(0, obtenerValorReserva(r) - adic);
      if (svcsCita.length === 1) {
        const item = mapaServicios.get(svcsCita[0].id);
        if (item) {
          item.cantidad += 1;
          item.ingresos += valorCita;
        }
      } else if (svcsCita.length > 1) {
        const sumaCatalogo = svcsCita.reduce((acc, s) => acc + Number(s.precio || 0), 0);
        let acumulado = 0;
        svcsCita.forEach((svc, idx) => {
          const item = mapaServicios.get(svc.id);
          if (item) {
            item.cantidad += 1;
            const aporte =
              idx === svcsCita.length - 1
                ? Math.max(0, valorCita - acumulado)
                : sumaCatalogo > 0
                ? Math.round((svc.precio / sumaCatalogo) * valorCita)
                : Math.round(valorCita / svcsCita.length);
            acumulado += aporte;
            item.ingresos += aporte;
          }
        });
      }
    }

    const porServicio = servicios
      .map((s) => {
        const stats = mapaServicios.get(s.id) || { cantidad: 0, ingresos: 0 };
        return {
          servicio: s,
          cantidad: stats.cantidad,
          ingresos: stats.ingresos,
        };
      })
      .sort((a, b) => b.cantidad - a.cantidad || b.ingresos - a.ingresos);

    // Métricas exclusivas para la fila única de "Adicionales"
    const citasConAdicional = citasActivas.filter((r) => sumarAdicionalesCita(r.notas) > 0);
    const ingresosAdicionales = citasActivas.reduce((sum, r) => sum + sumarAdicionalesCita(r.notas), 0);

    const adicionalesInfo = {
      cantidad: citasConAdicional.length,
      ingresos: ingresosAdicionales,
    };

    const totalCitasServicios = porServicio.reduce((sum, s) => sum + s.cantidad, 0);
    const totalDineroServicios = porServicio.reduce((sum, s) => sum + s.ingresos, 0) + adicionalesInfo.ingresos;

    return {
      total,
      confirmadasCount: confirmadas.length,
      completadasCount: completadas.length,
      canceladasCount: canceladas.length,
      pendientesCount: pendientes.length,
      ingresosTotales,
      ingresosCompletados,
      porManicurista,
      porServicio,
      adicionalesInfo,
      totalCitasServicios,
      totalDineroServicios,
    };
  }, [reservasFiltradasMetricas, canchas, servicios]);

  // ============================================================================
  // VISTA 1: PANTALLA DE LOGIN CON 1 ADMINISTRADORA Y 4 ESPECIALISTAS
  // ============================================================================
  if (!perfilActual) {
    return (
      <div className="min-h-screen bg-[#F5F8F4] text-[#1C2922] flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full space-y-6 text-center"
        >
          {/* Logo y Encabezado */}
          <div className="space-y-3">
            <div className="w-24 h-24 mx-auto rounded-full bg-white p-2 shadow-lg border-2 border-[#C5D6BE] flex items-center justify-center overflow-hidden">
              <img
                src="/opalo-nails-logo.png"
                alt="Ópalo Nails Spa Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div>
              <span className="text-[11px] font-bold tracking-widest text-[#C5A059] uppercase bg-white px-3 py-1 rounded-full border border-[#C5D6BE]">
                Portal del Equipo & Administración
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1C2922] font-serif mt-2">
                Ópalo <span className="italic text-[#2E5A44]">Nails Spa</span>
              </h1>
              <p className="text-xs sm:text-sm text-[#5A6B60] max-w-md mx-auto mt-1">
                Selecciona tu perfil de especialista o administración para ver tu agenda de turnos.
              </p>
            </div>
          </div>

          {/* Tarjetas de Selección: 1 Administradora + 4 Especialistas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-left">
            {perfilesConIds.map((p) => {
              const esPAdmin = p.rol === 'admin';
              return (
                <motion.div
                  key={p.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleIniciarSesion(p)}
                  className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between ${
                    esPAdmin
                      ? 'sm:col-span-2 border-[#2E5A44]/50 hover:border-[#2E5A44] bg-gradient-to-br from-white via-[#F5F8F4] to-[#E8F0E5]/60 ring-1 ring-[#2E5A44]/20'
                      : 'border-[#C5D6BE] hover:border-[#C5A059]'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="w-11 h-11 rounded-xl bg-[#E8F0E5] border border-[#C5D6BE] overflow-hidden flex items-center justify-center text-xl shrink-0 shadow-2xs">
                        {p.foto ? (
                          <img src={p.foto} alt={p.nombre} className="w-full h-full object-cover" />
                        ) : (
                          <span>{p.avatar}</span>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${p.colorBadge}`}>
                        {esPAdmin ? 'Administradora' : 'Especialista'}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-sm text-[#1C2922] font-serif">
                        {p.nombre}
                      </h3>
                      <p className="text-[11px] text-[#5A6B60] leading-relaxed mt-0.5">
                        {p.descripcion}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#E8F0E5] mt-3 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-semibold text-[#2E5A44]">Ingresar perfil →</span>
                    <span className="text-[10px] text-[#5A6B60] opacity-75">PIN: {p.pin}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Botón Volver a la web pública (solo si está disponible) */}
          {onIrAWebReservas && (
            <div className="pt-2">
              <button
                onClick={onIrAWebReservas}
                className="inline-flex items-center gap-1.5 text-xs text-[#5A6B60] hover:text-[#2E5A44] font-medium transition cursor-pointer"
              >
                <IconArrowLeft className="w-3.5 h-3.5" />
                <span>Volver a la página web de reservas públicas</span>
              </button>
            </div>
          )}
        </motion.div>

        {/* Modal PIN de Ingreso */}
        <AnimatePresence>
          {modalPinPerfil && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl max-w-sm w-full p-6 border border-[#C5D6BE] shadow-2xl space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full border-2 border-[#C5D6BE] overflow-hidden flex items-center justify-center text-xl shrink-0 shadow-2xs">
                      {modalPinPerfil.foto ? (
                        <img src={modalPinPerfil.foto} alt={modalPinPerfil.nombre} className="w-full h-full object-cover" />
                      ) : (
                        <span>{modalPinPerfil.avatar}</span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#1C2922] font-serif">
                        {modalPinPerfil.nombre}
                      </h3>
                      <p className="text-[11px] text-[#5A6B60]">Ingresa tu clave de acceso</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setModalPinPerfil(null)}
                    className="p-1 rounded-full text-[#5A6B60] hover:text-[#1C2922] cursor-pointer"
                  >
                    <IconX className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleConfirmarPin} className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#5A6B60] block mb-1">
                      PIN de Acceso (Predeterminado: 1234)
                    </label>
                    <div className="relative">
                      <IconLock className="w-4 h-4 text-[#C5A059] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={pinIngresado}
                        onChange={(e) => setPinIngresado(e.target.value)}
                        placeholder="1234"
                        className="w-full pl-9 pr-3 py-2.5 bg-[#F5F8F4] border border-[#C5D6BE] rounded-xl text-sm font-mono tracking-widest text-center text-[#1C2922] focus:outline-none focus:border-[#2E5A44]"
                        autoFocus
                      />
                    </div>
                    {errorPin && (
                      <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1 font-medium">
                        <IconAlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {errorPin}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setModalPinPerfil(null)}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-[#5A6B60] text-xs font-semibold rounded-xl transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-[#2E5A44] hover:bg-[#224433] text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
                    >
                      Entrar a mi Turno
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ============================================================================
  // RENDERIZADOR: TIMELINE DIARIO POR HORAS (ESTILO GOOGLE / APPLE CALENDAR)
  // ============================================================================
  const renderTimelineManicurista = (
    citasManicurista: Reserva[],
    nombreManicurista: string,
    canchaId?: string,
    puedeAgendar: boolean = false,
    fechaParam?: string,
    fechaLegibleParam?: string
  ) => {
    const fechaActualTimeline = fechaParam || fechaSeleccionada;
    const fechaTextoTimeline = fechaLegibleParam || fechaLegible;
    const esHoy = fechaActualTimeline === hoyStr;
    const horaActualNum = ahora.getHours();
    const minutosActuales = ahora.getMinutes();
    const horaAperturaNum = parseInt((configAnticipo.horaApertura || '08:00').split(':')[0], 10) || 8;
    const horaCierreNum = parseInt((configAnticipo.horaCierre || '19:00').split(':')[0], 10) || 19;
    const estaEnHorario = horaActualNum >= horaAperturaNum && horaActualNum <= horaCierreNum;
    const minutosDesdeApertura = (horaActualNum - horaAperturaNum) * 60 + minutosActuales;
    const posicionYLinea = (minutosDesdeApertura / 60) * ALTURA_HORA_PX;
    const horaMinutosActualStr = ahora.toLocaleTimeString('es-CO', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    });

    const ALTURA_TOTAL_TIMELINE = horasTimeline.length * ALTURA_HORA_PX;
    const citasVisibles = citasManicurista.filter((r) => r.estado !== 'cancelada');
    const citasPosicionadas = calcularPosicionesCitas(citasVisibles, horaAperturaNum);
    const ahoraMs = ahora.getTime();

    return (
      <div className="bg-white rounded-3xl border border-[#C5D6BE] shadow-xs overflow-hidden">
        {/* Cabecera del Timeline */}
        <div className="p-4 bg-gradient-to-r from-[#F5F8F4] to-[#E8F0E5] border-b border-[#C5D6BE] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white border border-[#C5D6BE] flex items-center justify-center font-bold text-base text-[#2E5A44] shadow-2xs">
              💅
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-[#1C2922] font-serif">
                {nombreManicurista}
              </h3>
              <p className="text-xs text-[#5A6B60]">
                {fechaTextoTimeline} · <strong className="text-[#2E5A44]">{citasVisibles.length} citas</strong> agendadas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#5A6B60] hidden sm:inline">
              Horario: {configAnticipo.horaApertura || '08:00'} a {configAnticipo.horaCierre || '19:00'}
            </span>
            {esHoy && estaEnHorario && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-200 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Ahora: {horaMinutosActualStr}
              </span>
            )}
          </div>
        </div>

        {/* Grilla de Tiempo Continua y Fiel a los Minutos */}
        <div className="relative p-2.5 sm:p-6 overflow-x-auto">
          <div className="min-w-full sm:min-w-[600px] relative">
            <div className="flex relative" style={{ height: `${ALTURA_TOTAL_TIMELINE}px` }}>
              {/* Columna de Horas a la izquierda */}
              <div className="w-14 sm:w-24 pr-2 sm:pr-3 flex-shrink-0 relative select-none">
                {horasTimeline.map((h, index) => (
                  <div
                    key={h}
                    className="absolute right-3 -mt-2.5 text-right"
                    style={{ top: `${index * ALTURA_HORA_PX}px` }}
                  >
                    <span className="text-[11px] sm:text-xs font-semibold text-[#5A6B60]">
                      {formatearHora12(h)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Lienzo del Timeline a la derecha */}
              <div className="flex-1 relative border-l border-[#C5D6BE]/60">
                {/* FRONTAL: Línea roja de la hora actual en tiempo real */}
                {esHoy && estaEnHorario && (
                  <div
                    className="absolute left-0 right-0 z-30 pointer-events-none flex items-center transition-all duration-700"
                    style={{ top: `${posicionYLinea}px` }}
                  >
                    <span className="absolute -left-14 sm:-left-16 -top-2.5 bg-red-500 text-white text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 select-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      {horaMinutosActualStr}
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1 ring-2 ring-white shadow-xs" />
                    <div className="flex-1 h-[2px] bg-red-500 shadow-xs" />
                  </div>
                )}

                {/* Filas de fondo con guías horarias completas y de media hora */}
                <div className="absolute inset-0 flex flex-col pointer-events-none">
                  {horasTimeline.map((h) => {
                    const hStr = `${String(h).padStart(2, '0')}:00`;
                    const horaSlotMs = new Date(`${fechaActualTimeline}T${hStr}:00-05:00`).getTime();
                    const esHoraPasadaTimeline = fechaActualTimeline < hoyStr || (esHoy && horaSlotMs <= ahoraMs);
                    return (
                      <div
                        key={h}
                        className="relative group transition border-b border-[#C5D6BE]/60 hover:bg-[#F5F8F4]/30"
                        style={{ height: `${ALTURA_HORA_PX}px` }}
                      >
                        <div className="absolute left-0 right-0 top-1/2 border-b border-dashed border-[#C5D6BE]/35 pointer-events-none" />

                        {/* Botones de acción rápida al pasar el cursor */}
                        <div className="absolute right-3 top-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition z-10 pointer-events-auto">
                          {canchaId && !esHoraPasadaTimeline && (
                            <button
                              onClick={() => abrirModalBloquear(canchaId, hStr, fechaActualTimeline)}
                              className="px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold hover:bg-amber-100 cursor-pointer shadow-2xs active:scale-95 flex items-center gap-1"
                              title="Bloquear este horario"
                            >
                              <IconLock className="w-3 h-3 text-amber-700" />
                              <span>Bloquear</span>
                            </button>
                          )}
                          {puedeAgendar && !esHoraPasadaTimeline && (
                            <button
                              onClick={() => abrirModalAgendar(canchaId || undefined, hStr, fechaActualTimeline)}
                              className="px-2 py-0.5 rounded-lg bg-white border border-[#C5D6BE] text-[#2E5A44] text-[10px] font-bold hover:bg-[#E8F0E5] cursor-pointer shadow-2xs active:scale-95 flex items-center gap-1"
                            >
                              <IconPlus className="w-3 h-3" />
                              <span>Agendar turno</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* CAPA DE CITAS POSICIONADAS EXACTAMENTE SEGÚN SUS MINUTOS Y DURACIÓN */}
                <div className="absolute inset-0 pointer-events-none">
                  {citasPosicionadas.map((pos) => {
                    const { cita, top, height, colIndex, totalCols } = pos;
                    const horaInicio = obtenerHoraMinutosBogota(cita.fecha_inicio);
                    const horaFin = cita.fecha_fin ? obtenerHoraMinutosBogota(cita.fecha_fin) : '';
                    const esBloqueada = cita.estado === 'bloqueada';
                    const { motivo: motivoBloqueo, por: bloqueadoPor } = obtenerDetalleBloqueo(cita);
                    const nombreClienta = obtenerNombreClienta(cita);
                    const servicioNombre = obtenerServicioCita(cita);
                    const telLimpio = String(cita.clientes?.telefono_wa || '').replace(/\D/g, '');
                    const puedeDesbloquear = esAdmin || (perfilActual?.canchaId === cita.cancha_id);

                    const inicioMs = new Date(normalizarIsoBogota(cita.fecha_inicio)).getTime();
                    const finMs = cita.fecha_fin ? new Date(normalizarIsoBogota(cita.fecha_fin)).getTime() : inicioMs + 45 * 60000;
                    const estaEnAtencion = esHoy && !esBloqueada && cita.estado !== 'completada' && cita.estado !== 'cancelada' && ahoraMs >= inicioMs && ahoraMs < finMs;

                    const leftPercent = (colIndex / totalCols) * 100;
                    const widthPercent = (1 / totalCols) * 100;

                    return (
                      <div
                        key={cita.id}
                        onMouseEnter={(e) => abrirPopoverCita(cita, e)}
                        onMouseLeave={cerrarPopoverCita}
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          left: `calc(${leftPercent}% + 4px)`,
                          width: `calc(${widthPercent}% - 8px)`,
                        }}
                        className={`absolute z-20 pointer-events-auto rounded-2xl border transition-all shadow-xs hover:shadow-md flex flex-col justify-between overflow-hidden p-2.5 sm:p-3 cursor-pointer ${
                          esBloqueada
                            ? 'bg-gradient-to-r from-amber-50 to-orange-50/80 border-amber-300 shadow-amber-100/50'
                            : estaEnAtencion
                            ? 'bg-rose-50/90 border-[#2E5A44] ring-2 ring-[#2E5A44]/20 shadow-[#2E5A44]/10'
                            : cita.estado === 'pendiente_anticipo' || cita.estado === 'pendiente_pago'
                            ? 'bg-amber-50/80 border-amber-300 shadow-amber-100/40 text-amber-950'
                            : cita.estado === 'completada'
                            ? 'bg-emerald-50/80 border-emerald-300'
                            : cita.estado === 'cancelada'
                            ? 'bg-slate-50 border-slate-200 opacity-60'
                            : 'bg-white border-[#C5D6BE] hover:border-[#2E5A44]'
                        }`}
                      >
                        {/* Cabecera de la Cita */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={`px-2 py-0.5 rounded-lg border font-mono font-bold text-xs flex items-center gap-1 shadow-2xs shrink-0 ${
                                esBloqueada
                                  ? 'bg-amber-100/80 border-amber-300 text-amber-900'
                                  : 'bg-[#F5F8F4] border-[#C5D6BE] text-[#2E5A44]'
                              }`}
                            >
                              {esBloqueada ? (
                                <IconLock className="w-3.5 h-3.5 text-amber-700" />
                              ) : (
                                <IconClock className="w-3.5 h-3.5 text-[#C5A059]" />
                              )}
                              <span>{horaInicio}{horaFin ? ` - ${horaFin}` : ''}</span>
                            </div>

                            <div className="min-w-0 flex items-center gap-1.5 truncate">
                              <p
                                className={`font-bold text-xs sm:text-sm truncate ${
                                  esBloqueada ? 'text-amber-950 font-serif' : 'text-[#1C2922]'
                                }`}
                                title={esBloqueada ? motivoBloqueo : nombreClienta}
                              >
                                {esBloqueada ? `🔒 ${motivoBloqueo}` : nombreClienta}
                              </p>
                              {esBloqueada ? (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 border border-amber-300 shrink-0">
                                  BLOQUEADO
                                </span>
                              ) : estaEnAtencion ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.2 rounded-full bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs animate-pulse shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                                  EN ATENCIÓN
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {/* Acciones principales */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {esBloqueada ? (
                              puedeDesbloquear && (
                                <button
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    handleDesbloquearHorario(cita.id, horaInicio);
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold transition shadow-2xs cursor-pointer active:scale-95"
                                  title="Desbloquear este horario para volver a habilitar reservas"
                                >
                                  <IconLockOpen className="w-3 h-3 text-amber-700" />
                                  <span>Desbloquear</span>
                                </button>
                              )
                            ) : cita.estado === 'pendiente_anticipo' || cita.estado === 'pendiente_pago' ? (
                                  <>
                                    {/* Badge de estado de anticipo */}
                                    {cita.notas?.includes('[COMPROBANTE_DUDOSO_REVISION_MANUAL]') || cita.notas?.includes('[COMPROBANTE_VALIDO_IA]') ? (
                                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500 text-white shadow-2xs animate-pulse" title="Comprobante dudoso por su forma en revisión manual">
                                        ⚠️ Comprobante dudoso en revisión
                                      </span>
                                    ) : (
                                      (() => {
                                        if (!cita.expiracion_reserva) {
                                          return (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                              ⏳ Esperando abono
                                            </span>
                                          );
                                        }
                                        const expMs = new Date(cita.expiracion_reserva).getTime();
                                        const diffMin = Math.round((expMs - ahora.getTime()) / (1000 * 60));
                                        return (
                                          <span
                                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                              diffMin <= 0
                                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                                : 'bg-amber-100 text-amber-900 border-amber-300'
                                            }`}
                                          >
                                            {diffMin <= 0 ? '⚠️ Expirado' : `⏳ Quedan ${diffMin} min`}
                                          </span>
                                        );
                                      })()
                                    )}

                                    {telLimpio && (
                                      <a
                                        href={`https://wa.me/${telLimpio}?text=Hola%20${encodeURIComponent(
                                          nombreClienta
                                        )},%20te%20saludamos%20de%20%C3%93palo%20Nails%20Spa%20respecto%20al%20abono%20de%20tu%20cita%20de%20las%20${horaInicio}.`}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(ev) => ev.stopPropagation()}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition shadow-2xs"
                                        title="Escribir por WhatsApp"
                                      >
                                        <IconBrandWhatsapp className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">WhatsApp</span>
                                      </a>
                                    )}

                                    {esAdmin && (
                                      <>
                                        <button
                                          disabled={procesandoAccionAnticipo === cita.id}
                                          onClick={(ev) => {
                                            ev.stopPropagation();
                                            handleAprobarAnticipo(cita.id, nombreClienta);
                                          }}
                                          className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
                                          title="Aprobar abono recibido y confirmar la cita"
                                        >
                                          <IconCheck className="w-3.5 h-3.5" />
                                          <span>Aprobar Abono</span>
                                        </button>

                                        <button
                                          disabled={procesandoAccionAnticipo === cita.id}
                                          onClick={(ev) => {
                                            ev.stopPropagation();
                                            handleRechazarAnticipo(cita.id, nombreClienta);
                                          }}
                                          className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
                                          title="Rechazar y liberar cupo"
                                        >
                                          <IconX className="w-3.5 h-3.5" />
                                          <span>Rechazar</span>
                                        </button>
                                      </>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <span
                                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                    cita.estado === 'completada'
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                      : cita.estado === 'cancelada'
                                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                                      : 'bg-[#E8F0E5] text-[#2E5A44] border-[#C5D6BE]'
                                  }`}
                                >
                                  {cita.estado.toUpperCase()}
                                </span>

                                {telLimpio && (
                                  <a
                                    href={`https://wa.me/${telLimpio}?text=Hola%20${encodeURIComponent(
                                      nombreClienta
                                    )},%20te%20saludamos%20de%20%C3%93palo%20Nails%20Spa%20respecto%20a%20tu%20cita%20de%20las%20${horaInicio}.`}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(ev) => ev.stopPropagation()}
                                    className="flex items-center gap-1 px-2 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold transition shadow-2xs"
                                    title="Escribir por WhatsApp"
                                  >
                                    <IconBrandWhatsapp className="w-3 h-3" />
                                    <span className="hidden sm:inline">WhatsApp</span>
                                  </a>
                                )}

                                {cita.estado !== 'completada' && cita.estado !== 'cancelada' && (
                                  <>
                                    <button
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        handleCambiarEstado(cita.id, 'completada');
                                      }}
                                      className="flex items-center gap-1 px-2 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition shadow-2xs cursor-pointer active:scale-95"
                                      title="Marcar como atendida"
                                    >
                                      <IconCheck className="w-3 h-3" />
                                      <span className="hidden sm:inline">Completada</span>
                                    </button>

                                    <button
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        handleCambiarEstado(cita.id, 'cancelada');
                                      }}
                                      className="flex items-center gap-1 px-2 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold transition shadow-2xs cursor-pointer active:scale-95"
                                      title="Cancelar cita y liberar el horario inmediatamente"
                                    >
                                      <IconX className="w-3 h-3" />
                                      <span className="hidden sm:inline">Cancelar</span>
                                    </button>
                                  </>
                                )}

                              </>
                            )}
                          </div>
                        </div>

                        {/* Detalle de servicio y precio */}
                        {height >= 52 && (
                          <div className="flex items-center justify-between text-xs text-[#5A6B60] pt-1 border-t border-[#E8F0E5]/70">
                            <div className="truncate">
                              {esBloqueada ? (
                                <span className="text-[11px]">Bloqueado por: {bloqueadoPor}</span>
                              ) : (
                                <>
                                  <span className="font-medium">💅 {servicioNombre}</span>
                                  <span className="ml-2 font-bold text-[#2E5A44]">
                                    ${Number(cita.valor_total || 25000).toLocaleString('es-CO')}
                                  </span>
                                </>
                              )}
                              {(!canchaId || canchaId === 'todas') && (() => {
                                const espCancha = canchas.find((c) => c.id === cita.cancha_id);
                                return espCancha ? (
                                  <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-[#2E5A44] bg-[#F5F8F4] px-2 py-0.5 rounded-full border border-[#C5D6BE]">
                                    💅 {espCancha.nombre}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                            <span className="text-[10px] text-[#2E5A44]/70 font-semibold italic hidden sm:inline">
                              Pasa el mouse para ver detalles
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };


  // ============================================================================
  // RENDERIZADO: PLANIFICADOR SEMANAL TIMELINE (LUNES A DOMINGO x HORAS)
  // Mantiene idéntica estética al Timeline Diario pero dividido en 7 columnas de días
  // ============================================================================
  const renderVistaSemanal = (
    citasFiltradas: Reserva[],
    esVistaAdmin: boolean,
    especialistaIdActual?: string
  ) => {
    const targetCancha = canchas.find((c) => c.id === especialistaIdActual);
    const nombreTarget =
      especialistaIdActual && especialistaIdActual !== 'todas'
        ? targetCancha?.nombre || 'Especialista'
        : esVistaAdmin
        ? 'Todas las Especialistas'
        : perfilActual?.nombre || 'Mi Agenda';

    const icono =
      especialistaIdActual && especialistaIdActual !== 'todas' ? '💅' : '👑';

    const horaActualNum = ahora.getHours();
    const minutosActuales = ahora.getMinutes();
    const horaAperturaNum = parseInt((configAnticipo.horaApertura || '08:00').split(':')[0], 10) || 8;
    const horaCierreNum = parseInt((configAnticipo.horaCierre || '19:00').split(':')[0], 10) || 19;
    const estaEnHorario = horaActualNum >= horaAperturaNum && horaActualNum <= horaCierreNum;
    const minutosDesdeApertura = (horaActualNum - horaAperturaNum) * 60 + minutosActuales;
    const posicionYLinea = (minutosDesdeApertura / 60) * ALTURA_HORA_PX;
    const horaMinutosActualStr = ahora.toLocaleTimeString('es-CO', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    });
    const esSemanaActual = diasDeLaSemana.some((d) => d.esHoy);
    const ALTURA_TOTAL_TIMELINE = horasTimeline.length * ALTURA_HORA_PX;
    const ahoraMs = ahora.getTime();

    return (
      <div className="bg-white rounded-3xl border border-[#C5D6BE] shadow-xs overflow-hidden">
        {/* Cabecera del Timeline Semanal */}
        <div className="p-4 bg-gradient-to-r from-[#F5F8F4] to-[#E8F0E5] border-b border-[#C5D6BE] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white border border-[#C5D6BE] flex items-center justify-center font-bold text-base text-[#2E5A44] shadow-2xs">
              {icono}
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-[#1C2922] font-serif">
                {nombreTarget}
              </h3>
              <p className="text-xs text-[#5A6B60]">
                {etiquetaSemana} · <strong className="text-[#2E5A44]">{citasFiltradas.filter((r) => r.estado !== 'cancelada').length} citas</strong> agendadas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#5A6B60] hidden sm:inline">
              Horario: {configAnticipo.horaApertura || '08:00'} a {configAnticipo.horaCierre || '19:00'}
            </span>
            {esSemanaActual && estaEnHorario && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-200 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Ahora: {horaMinutosActualStr}
              </span>
            )}
          </div>
        </div>

        {/* Grilla Semanal dividida en 7 días y con horas de apertura a cierre */}
        <div className="relative p-4 sm:p-6 overflow-x-auto">
          <div className="min-w-[1050px]">
            {/* ENCABEZADOS DE LOS 7 DÍAS */}
            <div className="flex border-b border-[#C5D6BE] pb-3 mb-1">
              <div className="w-16 sm:w-24 pr-3 flex-shrink-0 text-right select-none">
                <span className="text-[11px] font-extrabold text-[#2E5A44] uppercase tracking-wider">
                  HORA
                </span>
              </div>

              <div className="flex-1 grid grid-cols-7 divide-x divide-[#C5D6BE]/60">
                {diasDeLaSemana.map((d) => {
                  const citasDelDia = citasFiltradas.filter((r) => {
                    if (!r.fecha_inicio) return false;
                    const fCita = parsearFechaBogotaIso(r.fecha_inicio);
                    return fCita === d.fechaIso && r.estado !== 'cancelada' && r.estado !== 'bloqueada';
                  });

                  return (
                    <div
                      key={d.fechaIso}
                      className={`px-1.5 py-1 text-center transition-colors rounded-xl mx-0.5 ${
                        d.esHoy ? 'bg-[#F5F8F4] ring-1 ring-[#2E5A44]/25' : ''
                      }`}
                    >
                      <p
                        className={`text-[11px] font-bold uppercase tracking-wider ${
                          d.esHoy ? 'text-[#2E5A44]' : 'text-[#5A6B60]'
                        }`}
                      >
                        {d.nombreCorto}
                      </p>
                      <div className="flex items-center justify-center gap-1 my-0.5">
                        <span
                          className={`text-base font-extrabold font-serif ${
                            d.esHoy ? 'text-[#2E5A44]' : 'text-[#1C2922]'
                          }`}
                        >
                          {d.diaNum} {d.mesCorto}
                        </span>
                        {d.esHoy && (
                          <span className="text-[8px] font-extrabold px-1.5 py-0.2 rounded-full bg-[#2E5A44] text-white leading-none">
                            HOY
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border inline-block ${
                          d.esHoy
                            ? 'bg-[#2E5A44] text-white border-[#2E5A44]'
                            : 'bg-white text-[#2E5A44] border-[#C5D6BE]'
                        }`}
                      >
                        {citasDelDia.length} {citasDelDia.length === 1 ? 'cita' : 'citas'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CUERPO DEL TIMELINE CONTINUO POR COLUMNAS DE DÍAS (LUNES A DOMINGO) */}
            <div className="flex relative" style={{ height: `${ALTURA_TOTAL_TIMELINE}px` }}>
              {/* Columna de Horas a la izquierda */}
              <div className="w-16 sm:w-24 pr-3 flex-shrink-0 relative select-none">
                {horasTimeline.map((h, index) => (
                  <div
                    key={h}
                    className="absolute right-3 -mt-2.5 text-right"
                    style={{ top: `${index * ALTURA_HORA_PX}px` }}
                  >
                    <span className="text-[11px] sm:text-xs font-semibold text-[#5A6B60]">
                      {formatearHora12(h)}
                    </span>
                  </div>
                ))}
              </div>

              {/* 7 Columnas de los Días a la derecha */}
              <div className="flex-1 grid grid-cols-7 divide-x divide-[#C5D6BE]/60 relative border-l border-[#C5D6BE]/60">
                {/* FRONTAL: Línea roja de la hora actual en tiempo real si esta semana incluye hoy */}
                {esSemanaActual && estaEnHorario && (
                  <div
                    className="absolute left-0 right-0 z-30 pointer-events-none flex items-center transition-all duration-700"
                    style={{ top: `${posicionYLinea}px` }}
                  >
                    <span className="absolute -left-14 sm:-left-16 -top-2.5 bg-red-500 text-white text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 select-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      {horaMinutosActualStr}
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1 ring-2 ring-white shadow-xs" />
                    <div className="flex-1 h-[2px] bg-red-500 shadow-xs" />
                  </div>
                )}

                {/* Las 7 Columnas de días */}
                {diasDeLaSemana.map((d) => {
                  const citasDelDia = citasFiltradas.filter((r) => {
                    if (!r.fecha_inicio) return false;
                    const fCita = parsearFechaBogotaIso(r.fecha_inicio);
                    return fCita === d.fechaIso && r.estado !== 'cancelada';
                  });

                  const posicionesDia = calcularPosicionesCitas(citasDelDia, horaAperturaNum);

                  return (
                    <div
                      key={d.fechaIso}
                      className={`relative h-full ${d.esHoy ? 'bg-rose-50/10' : ''}`}
                    >
                      {/* Filas de fondo con guías horarias completas y de media hora */}
                      <div className="absolute inset-0 flex flex-col pointer-events-none">
                        {horasTimeline.map((h) => (
                          <div
                            key={h}
                            className="relative border-b border-[#C5D6BE]/60"
                            style={{ height: `${ALTURA_HORA_PX}px` }}
                          >
                            <div className="absolute left-0 right-0 top-1/2 border-b border-dashed border-[#C5D6BE]/35" />
                          </div>
                        ))}
                      </div>

                      {/* Tarjetas de citas limpias y sin recortes en la vista semanal */}
                      <div className="absolute inset-0 pointer-events-none">
                        {posicionesDia.map((pos) => {
                          const { cita, top, height, colIndex, totalCols } = pos;
                          const horaInicio = obtenerHoraMinutosBogota(cita.fecha_inicio);
                          const horaFin = cita.fecha_fin ? obtenerHoraMinutosBogota(cita.fecha_fin) : '';
                          const esBloqueada = cita.estado === 'bloqueada';
                          const { motivo: motivoBloqueo } = obtenerDetalleBloqueo(cita);
                          const nombreClienta = obtenerNombreClienta(cita);
                          const servicioNombre = obtenerServicioCita(cita);

                          const inicioMs = new Date(normalizarIsoBogota(cita.fecha_inicio)).getTime();
                          const finMs = cita.fecha_fin ? new Date(normalizarIsoBogota(cita.fecha_fin)).getTime() : inicioMs + 45 * 60000;
                          const estaEnAtencion = d.esHoy && !esBloqueada && cita.estado !== 'completada' && cita.estado !== 'cancelada' && ahoraMs >= inicioMs && ahoraMs < finMs;

                          const leftPercent = (colIndex / totalCols) * 100;
                          const widthPercent = (1 / totalCols) * 100;

                          // Asegurar una altura visual mínima de 44px para evitar recortes
                          const alturaReal = Math.max(44, height);

                          return (
                            <div
                              key={cita.id}
                              onMouseEnter={(e) => abrirPopoverCita(cita, e)}
                              onMouseLeave={cerrarPopoverCita}
                              style={{
                                top: `${top}px`,
                                height: `${alturaReal}px`,
                                left: `calc(${leftPercent}% + 2px)`,
                                width: `calc(${widthPercent}% - 4px)`,
                              }}
                              className={`absolute z-20 pointer-events-auto rounded-xl border text-xs p-1.5 transition-all shadow-2xs hover:shadow-lg hover:scale-[1.02] hover:z-30 flex flex-col justify-between overflow-hidden cursor-pointer ${
                                esBloqueada
                                  ? 'bg-gradient-to-r from-amber-50 to-orange-50/80 border-amber-300 text-amber-900 shadow-amber-100/50'
                                  : estaEnAtencion
                                  ? 'bg-rose-50/90 border-[#2E5A44] ring-2 ring-[#2E5A44]/20 text-[#2E5A44]'
                                  : cita.estado === 'pendiente_anticipo' || cita.estado === 'pendiente_pago'
                                  ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                                  : cita.estado === 'completada'
                                  ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                                  : cita.estado === 'cancelada'
                                  ? 'bg-slate-50 border-slate-200 opacity-60 text-slate-700'
                                  : 'bg-white border-[#C5D6BE] hover:border-[#2E5A44] text-[#1C2922]'
                              }`}
                              title="Pasa el mouse para ver todos los detalles de esta cita"
                            >
                              {/* Fila 1: Hora exacta y Estado */}
                              <div className="flex items-center justify-between gap-1 leading-none">
                                <div className="font-mono font-bold text-[9px] truncate flex items-center gap-0.5">
                                  {esBloqueada ? (
                                    <IconLock className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                                  ) : (
                                    <IconClock className="w-2.5 h-2.5 text-[#C5A059] shrink-0" />
                                  )}
                                  <span>{horaInicio}{horaFin ? `-${horaFin}` : ''}</span>
                                </div>

                                {estaEnAtencion ? (
                                  <span className="inline-flex items-center gap-0.5 text-[8px] font-black px-1 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-300 animate-pulse shrink-0">
                                    <span className="w-1 h-1 rounded-full bg-rose-600" />
                                    EN CURSO
                                  </span>
                                ) : (
                                  <span
                                    className={`text-[8px] font-extrabold px-1 py-0.2 rounded border shrink-0 ${
                                      esBloqueada
                                        ? 'bg-amber-200 text-amber-900 border-amber-300'
                                        : cita.estado === 'pendiente_anticipo' || cita.estado === 'pendiente_pago'
                                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                                        : cita.estado === 'completada'
                                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                        : cita.estado === 'cancelada'
                                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                                        : 'bg-[#E8F0E5] text-[#2E5A44] border-[#C5D6BE]'
                                    }`}
                                  >
                                    {esBloqueada ? 'BLOQ' : (cita.estado === 'pendiente_anticipo' || cita.estado === 'pendiente_pago') ? 'ABONO' : cita.estado === 'completada' ? 'LISTA' : 'CONF'}
                                  </span>
                                )}
                              </div>

                              {/* Fila 2: Nombre de la clienta o Motivo Bloqueo */}
                              <div className="leading-tight my-0.5 truncate">
                                <p
                                  className={`font-bold text-[10px] truncate ${
                                    esBloqueada ? 'text-amber-950 font-serif' : 'text-[#1C2922]'
                                  }`}
                                >
                                  {esBloqueada ? `🔒 ${motivoBloqueo}` : nombreClienta}
                                </p>
                              </div>

                              {/* Fila 3: Servicio (cuando la altura lo permite) */}
                              {alturaReal >= 54 && (
                                <div className="leading-none text-[9px] text-[#5A6B60] truncate pt-0.5 border-t border-[#E8F0E5]/70 flex items-center justify-between">
                                  <span className="truncate">{esBloqueada ? 'Turno no disponible' : `💅 ${servicioNombre}`}</span>
                                  {!esBloqueada && (
                                    <span className="font-mono font-bold text-[#2E5A44] shrink-0 ml-1">
                                      ${Number(cita.valor_total || 25000).toLocaleString('es-CO')}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };


  // ============================================================================
  // VISTA 2: DASHBOARD PRINCIPAL (ADMIN O MANICURISTA)
  // ============================================================================
  return (
    <div className="min-h-screen bg-[#F5F8F4] text-[#1C2922] flex flex-col font-sans">
      {/* Toast de actualización en vivo (Supabase Realtime) */}
      <AnimatePresence>
        {notificacionRealtime && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-5 right-5 z-50 flex items-center gap-2.5 bg-[#2E5A44] text-white px-4 py-2.5 rounded-2xl shadow-xl border border-white/20 text-xs font-semibold backdrop-blur-md"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>{notificacionRealtime}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BARRA SUPERIOR ELEGANTE */}
      <header className="bg-white/95 backdrop-blur-md sticky top-0 z-40 border-b border-[#C5D6BE] shadow-xs">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-4 py-2.5 sm:py-3">
          
          {/* FILA PRINCIPAL: Marca/Perfil a la izquierda, Controles a la derecha */}
          <div className="flex items-center justify-between gap-3">
            
            {/* Lado Izquierdo: Logo, Nombre y Botones Operativos en Desktop */}
            <div className="flex items-center gap-3 md:gap-4 min-w-0">
              {/* Logo y Nombre */}
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#F5F8F4] p-1 border border-[#C5D6BE] overflow-hidden shrink-0 flex items-center justify-center">
                  <img
                    src="/opalo-nails-logo.png"
                    alt="Logo Ópalo Nails Spa"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <h1 className="font-bold text-sm sm:text-base text-[#1C2922] font-serif leading-none truncate">
                      Ópalo Nails Spa
                    </h1>
                    <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full border shrink-0 flex items-center gap-1.5 ${perfilActual.colorBadge}`}>
                      {perfilActual.foto ? (
                        <img src={perfilActual.foto} alt="" className="w-3.5 h-3.5 rounded-full object-cover border border-[#C5D6BE]" />
                      ) : (
                        <span>{perfilActual.avatar}</span>
                      )}
                      <span>{esAdmin ? `${perfilActual.nombre.replace(/\s*\(Administradora\)/i, '')} (Admin)` : perfilActual.nombre}</span>
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-[#5A6B60] mt-0.5 hidden sm:block">
                    Pereira, Risaralda · Panel de Control de Turnos
                  </p>
                </div>
              </div>

              {/* Botones Operativos en DESKTOP (Ocultos en móvil para mantener la vista limpia) */}
              <div className="hidden md:flex items-center gap-2 pl-2">
                {/* Botón Bloquear Horario */}
                <button
                  onClick={() => abrirModalBloquear()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer active:scale-95"
                  title="Bloquear una o varias horas para que las clientas no puedan reservar"
                >
                  <IconLock className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{esAdmin ? 'Bloquear Horario' : 'Bloquear Mi Horario'}</span>
                </button>

                {/* Botón Exclusivo para la Admin: Configuración de Horario de Trabajo y Anticipos */}
                {esAdmin && (
                  <button
                    onClick={() => setModalConfigAnticipoAbierto(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer border bg-white border-[#C5D6BE] text-[#2E5A44] hover:bg-[#E8F0E5]"
                    title="Configuración general del spa: horarios de trabajo, anticipos y cuentas de recaudo"
                  >
                    <IconSettings className="w-3.5 h-3.5 text-[#C5A059]" />
                    <span>Configuración del Spa</span>
                  </button>
                )}

                {/* Botón Exclusivo para la Admin: Agendar Cita */}
                {esAdmin && (
                  <button
                    onClick={() => abrirModalAgendar()}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-[#2E5A44] to-[#C5A059] hover:from-[#224433] hover:to-[#A68443] text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer active:scale-95"
                  >
                    <IconPlus className="w-4 h-4 stroke-[3]" />
                    <span>Agendar Cita</span>
                  </button>
                )}

                {/* Botón Exclusivo para la Admin: Clientes con Bot Silenciado (Atención Humana) */}
                {esAdmin && (
                  <button
                    onClick={abrirModalExclusiones}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-[#E8F0E5] text-[#2E5A44] border border-[#C5D6BE] text-xs font-bold rounded-xl transition shadow-xs cursor-pointer active:scale-95"
                    title="Gestionar números restringidos del bot para atención personalizada"
                  >
                    <IconLock className="w-3.5 h-3.5 text-[#2E5A44]" />
                    <span>Números Restringidos</span>
                    {exclusionesBot.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-[#2E5A44] text-white text-[10px] font-mono font-bold">
                        {exclusionesBot.length}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Lado Derecho: Recargar, Volver Web y Salir ARRIBA; Agenda de Turnos y Métricas DEBAJO (con más separación) */}
            <div className="flex flex-col items-end gap-3 shrink-0">
              {/* Arriba a la derecha: Indicador Realtime y 3 botones */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Indicador de conexión Realtime */}
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl text-2xs font-semibold border transition select-none ${
                    realtimeConectado
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                  }`}
                  title={
                    realtimeConectado
                      ? 'Conexión en vivo activa: Las nuevas citas y cambios se actualizan al instante'
                      : 'Conectando con Supabase Realtime...'
                  }
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      realtimeConectado ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  <span className="hidden sm:inline">
                    {realtimeConectado ? 'En vivo' : 'Conectando'}
                  </span>
                </div>

                {/* Recargar datos */}
                <button
                  onClick={() => cargarReservas()}
                  disabled={cargando}
                  className="p-1.5 sm:p-2 rounded-xl border border-[#C5D6BE] hover:bg-[#E8F0E5] text-[#5A6B60] hover:text-[#2E5A44] transition cursor-pointer"
                  title="Actualizar datos manualmente"
                >
                  <IconRefresh className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${cargando ? 'animate-spin' : ''}`} />
                </button>

                {/* Volver a la página principal (solo si está configurada) */}
                {onIrAWebReservas && (
                  <button
                    onClick={onIrAWebReservas}
                    className="p-1.5 sm:p-2 rounded-xl border border-[#C5D6BE] hover:bg-[#E8F0E5] text-[#5A6B60] hover:text-[#2E5A44] transition cursor-pointer"
                    title="Volver a la página principal (Reservas de clientas)"
                  >
                    <IconExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                )}

                {/* Salir */}
                <button
                  onClick={handleCerrarSesion}
                  className="flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#5A6B60] text-xs font-semibold transition cursor-pointer"
                  title="Cambiar de perfil / Cerrar sesión"
                >
                  <IconLogout className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Salir</span>
                </button>
              </div>

              {/* Debajo de los 3 botones, a la derecha en DESKTOP: Agenda de Turnos y Métricas */}
              {esAdmin && (
                <div className="hidden md:flex items-center bg-[#E8F0E5] p-1 rounded-xl border border-[#C5D6BE]">
                  <button
                    onClick={() => setTabAdmin('agenda')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      tabAdmin === 'agenda'
                        ? 'bg-white text-[#2E5A44] shadow-xs'
                        : 'text-[#5A6B60] hover:text-[#1C2922]'
                    }`}
                  >
                    <IconCalendar className="w-3.5 h-3.5" />
                    <span>Agenda de Turnos</span>
                  </button>
                  <button
                    onClick={() => setTabAdmin('metricas')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      tabAdmin === 'metricas'
                        ? 'bg-white text-[#2E5A44] shadow-xs'
                        : 'text-[#5A6B60] hover:text-[#1C2922]'
                    }`}
                  >
                    <IconChartBar className="w-3.5 h-3.5" />
                    <span>Métricas</span>
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* FILA EXCLUSIVA PARA MÓVIL (< md): Segmented Tabs & Barra de Acciones Deslizable */}
          <div className="md:hidden mt-2 pt-2 border-t border-[#C5D6BE]/40 space-y-2">
            {/* Pestañas Agenda / Métricas a ancho completo en móvil */}
            {esAdmin && (
              <div className="grid grid-cols-2 bg-[#E8F0E5] p-1 rounded-xl border border-[#C5D6BE]">
                <button
                  onClick={() => setTabAdmin('agenda')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    tabAdmin === 'agenda'
                      ? 'bg-white text-[#2E5A44] shadow-xs'
                      : 'text-[#5A6B60]'
                  }`}
                >
                  <IconCalendar className="w-3.5 h-3.5" />
                  <span>Agenda de Turnos</span>
                </button>
                <button
                  onClick={() => setTabAdmin('metricas')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    tabAdmin === 'metricas'
                      ? 'bg-white text-[#2E5A44] shadow-xs'
                      : 'text-[#5A6B60]'
                  }`}
                >
                  <IconChartBar className="w-3.5 h-3.5" />
                  <span>Métricas</span>
                </button>
              </div>
            )}

            {/* Barra de Acciones Deslizable y Limpia para Móvil */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              {/* Agendar */}
              {esAdmin && (
                <button
                  onClick={() => abrirModalAgendar()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#2E5A44] to-[#C5A059] text-white text-xs font-bold rounded-xl transition shadow-xs shrink-0 cursor-pointer active:scale-95"
                >
                  <IconPlus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Agendar Cita</span>
                </button>
              )}

              {/* Bloquear */}
              <button
                onClick={() => abrirModalBloquear()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-xl transition shadow-xs shrink-0 cursor-pointer active:scale-95"
              >
                <IconLock className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{esAdmin ? 'Bloquear Horario' : 'Bloquear Mi Horario'}</span>
              </button>

              {/* Configuración Spa */}
              {esAdmin && (
                <button
                  onClick={() => setModalConfigAnticipoAbierto(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-[#2E5A44] border border-[#C5D6BE] text-xs font-bold rounded-xl transition shadow-xs shrink-0 cursor-pointer active:scale-95"
                >
                  <IconSettings className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>Config. Spa</span>
                </button>
              )}

              {/* Números Restringidos */}
              {esAdmin && (
                <button
                  onClick={abrirModalExclusiones}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-[#2E5A44] border border-[#C5D6BE] text-xs font-bold rounded-xl transition shadow-xs shrink-0 cursor-pointer active:scale-95"
                >
                  <IconLock className="w-3.5 h-3.5 text-[#2E5A44]" />
                  <span>Números Restringidos</span>
                  {exclusionesBot.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-[#2E5A44] text-white text-[9px] font-mono font-bold">
                      {exclusionesBot.length}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto w-full p-3 sm:p-6 space-y-4 sm:space-y-6 flex-1">
        
        {/* BARRA DE FECHA CON FLECHAS DÍA ANTERIOR / SIGUIENTE (Solo en vista de agenda) */}
        {(!esAdmin || tabAdmin === 'agenda') && (
          <div className="bg-white rounded-2xl p-3 sm:p-4 border border-[#C5D6BE] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#E8F0E5] text-[#2E5A44] flex items-center justify-center shrink-0">
                <IconClock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#1C2922]">
                  {esAdmin
                    ? 'Agenda General del Spa'
                    : `Mi Agenda Personal (${perfilActual.nombre})`}
                </p>
                <p className="text-[10px] sm:text-[11px] text-[#5A6B60]">
                  {vistaAgenda === 'dia' ? (
                    <>
                      {fechaLegible} · <strong className="text-[#2E5A44]">{citasClientesDelDia.length} citas</strong>
                      {bloqueosDelDia.length > 0 && (
                        <span className="ml-1 text-amber-700 font-semibold">
                          · {bloqueosDelDia.length} {bloqueosDelDia.length === 1 ? 'bloqueo' : 'bloqueos'}
                        </span>
                      )}{' '}
                      programadas
                    </>
                  ) : (
                    <>
                      Semana del {etiquetaSemana} ·{' '}
                      <strong className="text-[#2E5A44]">{citasClientesDeLaSemana.length} citas</strong>
                      {bloqueosDeLaSemana.length > 0 && (
                        <span className="ml-1 text-amber-700 font-semibold">
                          · {bloqueosDeLaSemana.length} {bloqueosDeLaSemana.length === 1 ? 'bloqueo' : 'bloqueos'}
                        </span>
                      )}{' '}
                      programadas
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* CONTROLES DE VISTA Y FECHA */}
            <div className="flex flex-wrap items-center justify-between md:justify-end gap-2">
              {/* SELECTOR DE VISTA: DÍA VS SEMANA */}
              <div className="flex items-center bg-[#E8F0E5] p-1 rounded-xl border border-[#C5D6BE]">
                <button
                  onClick={() => setVistaAgenda('dia')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs ${
                    vistaAgenda === 'dia'
                      ? 'bg-[#2E5A44] text-white shadow-xs'
                      : 'text-[#5A6B60] hover:text-[#1C2922]'
                  }`}
                  title="Ver agenda detallada por día"
                >
                  <IconCalendarEvent className="w-3.5 h-3.5" />
                  <span>Día</span>
                </button>
                <button
                  onClick={() => setVistaAgenda('semana')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs ${
                    vistaAgenda === 'semana'
                      ? 'bg-[#2E5A44] text-white shadow-xs'
                      : 'text-[#5A6B60] hover:text-[#1C2922]'
                  }`}
                  title="Ver planificación de toda la semana"
                >
                  <IconCalendarMonth className="w-3.5 h-3.5" />
                  <span>Semana</span>
                </button>
              </div>

              {/* CONTROLES DE FECHA SEGÚN MODO DÍA O SEMANA */}
              {vistaAgenda === 'dia' ? (
                <div className="flex items-center gap-1 sm:gap-1.5 bg-[#F5F8F4] p-1 sm:p-1.5 rounded-xl border border-[#C5D6BE]">
                  {/* ACCESO RÁPIDO: Volver a Hoy a la izquierda */}
                  {fechaSeleccionada !== hoyStr && (
                    <button
                      onClick={() => setFechaSeleccionada(hoyStr)}
                      className="px-2 py-1 rounded-lg text-xs font-semibold bg-white text-[#2E5A44] hover:bg-[#E8F0E5] border border-[#C5D6BE] transition cursor-pointer shadow-2xs animate-in fade-in"
                      title="Volver a la fecha actual"
                    >
                      Hoy
                    </button>
                  )}

                  <button
                    onClick={() => cambiarDia(-1)}
                    className="p-1.5 rounded-lg bg-white hover:bg-[#E8F0E5] text-[#2E5A44] border border-[#C5D6BE] transition cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                    title="Día anterior"
                  >
                    <IconChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>

                  {/* BOTÓN/ETIQUETA DINÁMICA: Hoy, Mañana, Ayer o Sáb, 10 oct */}
                  <button
                    onClick={() => setFechaSeleccionada(hoyStr)}
                    title={fechaSeleccionada === hoyStr ? 'Estás en el día de hoy' : 'Clic para volver al día de hoy'}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs bg-[#2E5A44] text-white min-w-[65px] text-center hover:opacity-95 active:scale-95"
                  >
                    {etiquetaFechaRelativa}
                  </button>

                  <button
                    onClick={() => cambiarDia(1)}
                    className="p-1.5 rounded-lg bg-white hover:bg-[#E8F0E5] text-[#2E5A44] border border-[#C5D6BE] transition cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                    title="Día siguiente"
                  >
                    <IconChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>

                  <div className="relative pl-0.5">
                    <input
                      type="date"
                      value={fechaSeleccionada}
                      onChange={(e) => setFechaSeleccionada(e.target.value)}
                      className="px-2 py-1 bg-white border border-[#C5D6BE] rounded-lg text-xs font-bold text-[#1C2922] outline-none cursor-pointer hover:border-[#2E5A44] transition shadow-2xs"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1 sm:gap-1.5 bg-[#F5F8F4] p-1 sm:p-1.5 rounded-xl border border-[#C5D6BE]">
                  {/* ACCESO RÁPIDO: Volver a la Semana Actual */}
                  {!diasDeLaSemana.some((d) => d.esHoy) && (
                    <button
                      onClick={() => setFechaSeleccionada(hoyStr)}
                      className="px-2 py-1 rounded-lg text-xs font-semibold bg-white text-[#2E5A44] hover:bg-[#E8F0E5] border border-[#C5D6BE] transition cursor-pointer shadow-2xs animate-in fade-in"
                      title="Volver a la semana actual"
                    >
                      Hoy
                    </button>
                  )}

                  <button
                    onClick={() => cambiarSemana(-1)}
                    className="p-1.5 rounded-lg bg-white hover:bg-[#E8F0E5] text-[#2E5A44] border border-[#C5D6BE] transition cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                    title="Semana anterior"
                  >
                    <IconChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>

                  <button
                    onClick={() => setFechaSeleccionada(hoyStr)}
                    title="Semana activa. Clic para volver a la actual"
                    className="px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs bg-[#2E5A44] text-white min-w-[90px] text-center hover:opacity-95 active:scale-95"
                  >
                    {diasDeLaSemana.some((d) => d.esHoy)
                      ? 'Esta Semana'
                      : `Semana ${diasDeLaSemana[0]?.diaNum} - ${diasDeLaSemana[6]?.diaNum}`}
                  </button>

                  <button
                    onClick={() => cambiarSemana(1)}
                    className="p-1.5 rounded-lg bg-white hover:bg-[#E8F0E5] text-[#2E5A44] border border-[#C5D6BE] transition cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                    title="Semana siguiente"
                  >
                    <IconChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>

                  <div className="relative pl-0.5">
                    <input
                      type="date"
                      value={fechaSeleccionada}
                      onChange={(e) => setFechaSeleccionada(e.target.value)}
                      className="px-2 py-1 bg-white border border-[#C5D6BE] rounded-lg text-xs font-bold text-[#1C2922] outline-none cursor-pointer hover:border-[#2E5A44] transition shadow-2xs"
                      title="Selecciona cualquier fecha para ver su semana"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* CASO A: VISTA DE LA ADMINISTRADORA (TABLA DE TODAS LAS MANICURISTAS)  */}
        {/* ==================================================================== */}
        {esAdmin && tabAdmin === 'agenda' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-[#1C2922] font-serif">
                {vistaAgenda === 'dia'
                  ? `Turnos por Especialista · ${fechaLegible}`
                  : `Planificación Semanal · ${etiquetaSemana}`}
              </h2>
              <span className="text-xs text-[#5A6B60]">
                Horario: {configAnticipo.horaApertura || '08:00'} a {configAnticipo.horaCierre || '19:00'}
              </span>
            </div>

            {/* SELECTOR DE VISTA EN ADMINISTRADORA: 4 Columnas vs Timeline por Especialista */}
            <div className="flex items-center gap-2 pb-1 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap">
              <button
                onClick={() => setEspecialistaSeleccionadaId('todas')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs flex items-center gap-1.5 shrink-0 ${
                  especialistaSeleccionadaId === 'todas'
                    ? 'bg-[#2E5A44] text-white shadow-xs'
                    : 'bg-white text-[#5A6B60] hover:text-[#1C2922] border border-[#C5D6BE]'
                }`}
              >
                <span>👑 {vistaAgenda === 'dia' ? 'Resumen 4 Especialistas' : 'Todas las Especialistas'}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 border border-current">
                  {vistaAgenda === 'dia' ? citasClientesDelDia.length : citasClientesDeLaSemana.length}
                </span>
              </button>

              {canchas.map((cancha, i) => {
                const totalCitas =
                  vistaAgenda === 'dia'
                    ? reservasDelDia.filter((r) => reservaCorrespondeACancha(r, cancha, i) && r.estado !== 'cancelada').length
                    : citasClientesDeLaSemana.filter((r) => reservaCorrespondeACancha(r, cancha, i)).length;

                return (
                  <button
                    key={cancha.id}
                    onClick={() => setEspecialistaSeleccionadaId(cancha.id)}
                    className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs flex items-center gap-1.5 shrink-0 ${
                      especialistaSeleccionadaId === cancha.id
                        ? 'bg-[#2E5A44] text-white shadow-xs'
                        : 'bg-white text-[#5A6B60] hover:text-[#1C2922] border border-[#C5D6BE]'
                    }`}
                  >
                    <span>{i === 0 ? '👑' : '💅'} {cancha.nombre}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 border border-current">
                      {totalCitas}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* VISTA SEMANAL (7 DÍAS) VS VISTAS DIARIAS */}
            {vistaAgenda === 'semana' ? (
              renderVistaSemanal(
                especialistaSeleccionadaId === 'todas'
                  ? reservasDeLaSemana.filter((r) => r.estado !== 'cancelada')
                  : reservasDeLaSemana.filter((r) => {
                      const targetCancha = canchas.find((c) => c.id === especialistaSeleccionadaId);
                      const targetIdx = canchas.findIndex((c) => c.id === especialistaSeleccionadaId);
                      return (targetCancha ? reservaCorrespondeACancha(r, targetCancha, targetIdx) : r.cancha_id === especialistaSeleccionadaId) && r.estado !== 'cancelada';
                    }),
                true,
                especialistaSeleccionadaId
              )
            ) : especialistaSeleccionadaId !== 'todas' ? (
              (() => {
                const targetCancha = canchas.find((c) => c.id === especialistaSeleccionadaId);
                const targetIdx = canchas.findIndex((c) => c.id === especialistaSeleccionadaId);
                const citasTarget = reservasDelDia.filter(
                  (r) => (targetCancha ? reservaCorrespondeACancha(r, targetCancha, targetIdx) : r.cancha_id === especialistaSeleccionadaId) && r.estado !== 'cancelada'
                );
                return renderTimelineManicurista(
                  citasTarget,
                  targetCancha?.nombre || 'Especialista',
                  targetCancha?.id,
                  true
                );
              })()
            ) : (
              /* TABLAS EN 4 COLUMNAS (1 POR CADA MANICURISTA) */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {canchas.map((cancha, idx) => {
                const citasCancha = reservasDelDia.filter(
                  (r) => reservaCorrespondeACancha(r, cancha, idx) && r.estado !== 'cancelada'
                );

                return (
                  <div
                    key={cancha.id}
                    className="bg-white rounded-2xl border border-[#C5D6BE] shadow-xs flex flex-col justify-between overflow-hidden"
                  >
                    {/* Encabezado de la Especialista */}
                    <div className="p-3.5 bg-gradient-to-r from-[#F5F8F4] to-[#E8F0E5] border-b border-[#C5D6BE] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full bg-white border-2 border-[#C5D6BE] overflow-hidden flex items-center justify-center font-bold text-xs text-[#2E5A44] shrink-0 shadow-2xs">
                          {cancha.foto || FOTOS_EQUIPO_ADMIN[cancha.nombre.toLowerCase()] ? (
                            <img src={cancha.foto || FOTOS_EQUIPO_ADMIN[cancha.nombre.toLowerCase()]} alt={cancha.nombre} className="w-full h-full object-cover" />
                          ) : (
                            <span>{idx === 0 ? '✨' : idx === 1 ? '🌸' : idx === 2 ? '💅' : '🌿'}</span>
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-xs text-[#1C2922] font-serif">
                            {cancha.nombre}
                          </h3>
                          <span className="text-[10px] text-[#5A6B60]">
                            Especialista
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#2E5A44] border border-[#C5D6BE]">
                        {citasCancha.length} citas
                      </span>
                    </div>

                    {/* Lista de Citas Asignadas a esta Manicurista */}
                    <div className="p-3 space-y-2.5 flex-1 min-h-[220px]">
                      {citasCancha.length === 0 ? (
                        <div className="text-center py-8 text-[#5A6B60] space-y-1">
                          <p className="text-xs font-semibold text-[#2E5A44]">Sin citas para este día</p>
                          <p className="text-[11px] opacity-70">Turnos libres disponibles</p>
                        </div>
                      ) : (
                        citasCancha.map((cita) => {
                          const horaInicio = obtenerHoraMinutosBogota(cita.fecha_inicio);
                          const horaFin = cita.fecha_fin ? obtenerHoraMinutosBogota(cita.fecha_fin) : '';
                          const esBloqueada = cita.estado === 'bloqueada';
                          const { motivo: motivoBloqueo, por: bloqueadoPor } = obtenerDetalleBloqueo(cita);
                          const nombreClienta = obtenerNombreClienta(cita);
                          const servicioNombre = obtenerServicioCita(cita);
                          const telLimpio = String(cita.clientes?.telefono_wa || '').replace(/\D/g, '');

                          const inicioMs = new Date(normalizarIsoBogota(cita.fecha_inicio)).getTime();
                          const finMs = cita.fecha_fin ? new Date(normalizarIsoBogota(cita.fecha_fin)).getTime() : inicioMs + 45 * 60000;
                          const ahoraMs = ahora.getTime();
                          const esHoy = fechaSeleccionada === hoyStr;
                          const estaEnAtencion = esHoy && !esBloqueada && cita.estado !== 'completada' && cita.estado !== 'cancelada' && ahoraMs >= inicioMs && ahoraMs < finMs;

                          return (
                            <div
                              key={cita.id}
                              onMouseEnter={(e) => abrirPopoverCita(cita, e)}
                              onMouseLeave={cerrarPopoverCita}
                              className={`p-2.5 rounded-xl border text-xs space-y-1.5 transition cursor-pointer hover:shadow-md hover:scale-[1.01] ${
                                esBloqueada
                                  ? 'bg-gradient-to-r from-amber-50 to-orange-50/70 border-amber-300 shadow-2xs'
                                  : estaEnAtencion
                                  ? 'bg-rose-50/90 border-[#2E5A44] ring-2 ring-[#2E5A44]/20 shadow-[#2E5A44]/10'
                                  : cita.estado === 'pendiente_anticipo' || cita.estado === 'pendiente_pago'
                                  ? 'bg-amber-50/80 border-amber-300 shadow-amber-100/40 text-amber-950'
                                  : cita.estado === 'completada'
                                  ? 'bg-emerald-50/60 border-emerald-200'
                                  : cita.estado === 'cancelada'
                                  ? 'bg-slate-50 border-slate-200 opacity-60'
                                  : 'bg-white border-[#C5D6BE] shadow-2xs hover:border-[#2E5A44]'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span
                                  className={`font-mono font-bold text-[11px] flex items-center gap-1 ${
                                    esBloqueada ? 'text-amber-900' : 'text-[#2E5A44]'
                                  }`}
                                >
                                  {esBloqueada ? (
                                    <IconLock className="w-3 h-3 text-amber-700" />
                                  ) : (
                                    <IconClock className="w-3 h-3 text-[#C5A059]" />
                                  )}
                                  {horaInicio}{horaFin ? ` - ${horaFin}` : ''}
                                </span>
                                {estaEnAtencion ? (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                                    EN ATENCIÓN
                                  </span>
                                ) : (
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${
                                      esBloqueada
                                        ? 'bg-amber-200/80 text-amber-900 border-amber-300'
                                        : cita.estado === 'pendiente_anticipo' || cita.estado === 'pendiente_pago'
                                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                                        : cita.estado === 'completada'
                                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                        : cita.estado === 'cancelada'
                                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                                        : 'bg-[#E8F0E5] text-[#2E5A44] border-[#C5D6BE]'
                                    }`}
                                  >
                                    {esBloqueada ? 'BLOQUEADO' : (cita.estado === 'pendiente_anticipo' || cita.estado === 'pendiente_pago') ? 'ABONO' : cita.estado.toUpperCase()}
                                  </span>
                                )}
                              </div>

                              <div>
                                <p className={`font-bold text-xs ${esBloqueada ? 'text-amber-950' : 'text-[#1C2922]'}`}>
                                  {esBloqueada ? `🔒 ${motivoBloqueo}` : nombreClienta}
                                </p>
                                <p className="text-[11px] text-[#5A6B60] truncate">
                                  {esBloqueada ? `Por: ${bloqueadoPor}` : `💅 ${servicioNombre}`}
                                </p>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-[#E8F0E5] text-[10px]">
                                <span className="font-mono font-bold text-[#1C2922]">
                                  {esBloqueada ? 'No disponible' : `$${Number(cita.valor_total || 25000).toLocaleString('es-CO')}`}
                                </span>

                                <div className="flex items-center gap-1">
                                  {esBloqueada ? (
                                    <button
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        handleDesbloquearHorario(cita.id, horaInicio);
                                      }}
                                      className="px-2 py-0.5 rounded-md bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold transition cursor-pointer active:scale-95"
                                      title="Desbloquear este horario"
                                    >
                                      Desbloquear
                                    </button>
                                  ) : (
                                    <>
                                      {/* Botón WhatsApp */}
                                      {telLimpio && (
                                        <a
                                          href={`https://wa.me/${telLimpio}?text=Hola%20${encodeURIComponent(
                                            nombreClienta
                                          )},%20te%20saludamos%20de%20%C3%93palo%20Nails%20Spa%20respecto%20a%20tu%20cita%20de%20hoy.`}
                                          target="_blank"
                                          rel="noreferrer"
                                          onClick={(ev) => ev.stopPropagation()}
                                          className="p-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                                          title="Escribir por WhatsApp"
                                        >
                                          <IconBrandWhatsapp className="w-3.5 h-3.5" />
                                        </a>
                                      )}

                                      {/* Botón Marcar Completada */}
                                      {cita.estado !== 'completada' && cita.estado !== 'cancelada' && (
                                        <button
                                          onClick={(ev) => {
                                            ev.stopPropagation();
                                            handleCambiarEstado(cita.id, 'completada');
                                          }}
                                          className="p-1 rounded-md bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition cursor-pointer active:scale-95"
                                          title="Marcar como atendida / completada"
                                        >
                                          <IconCheck className="w-3.5 h-3.5" />
                                        </button>
                                      )}

                                      {/* Botón Marcar Cancelada */}
                                      {cita.estado !== 'completada' && cita.estado !== 'cancelada' && (
                                        <button
                                          onClick={(ev) => {
                                            ev.stopPropagation();
                                            handleCambiarEstado(cita.id, 'cancelada');
                                          }}
                                          className="p-1 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition cursor-pointer active:scale-95"
                                          title="Cancelar cita y liberar el horario inmediatamente"
                                        >
                                          <IconX className="w-3.5 h-3.5" />
                                        </button>
                                      )}

                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Botones Agendar y Bloquear para esta Manicurista */}
                    <div className="p-2 bg-[#F5F8F4] border-t border-[#C5D6BE] flex gap-1.5">
                      <button
                        onClick={() => abrirModalAgendar(cancha.id)}
                        className="flex-1 py-1.5 bg-white hover:bg-[#E8F0E5] text-[#2E5A44] border border-[#C5D6BE] text-[11px] font-bold rounded-xl transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <IconPlus className="w-3.5 h-3.5" />
                        <span>Agendar con {cancha.nombre.split(' ')[0]}</span>
                      </button>
                      <button
                        onClick={() => abrirModalBloquear(cancha.id)}
                        className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-bold rounded-xl transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                        title={`Bloquear horario de ${cancha.nombre}`}
                      >
                        <IconLock className="w-3 h-3 text-amber-700" />
                        <span>Bloquear</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

        {/* ==================================================================== */}
        {/* CASO B: VISTA DE LA ADMINISTRADORA - PESTAÑA MÉTRICAS                 */}
        {/* ==================================================================== */}
        {esAdmin && tabAdmin === 'metricas' && (
          <div className="space-y-6">
            {/* PANEL DE CONTROL DE PERÍODO (POR DÍA VS POR MES) */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-[#C5D6BE] shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#E8F0E5] text-[#2E5A44] flex items-center justify-center font-bold">
                    <IconChartBar className="w-4 h-4" />
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-[#1C2922] font-serif">
                    Rendimiento & Métricas Financieras
                  </h2>
                </div>
                <p className="text-xs text-[#5A6B60]">
                  {modoMetricas === 'dia' ? (
                    <>
                      Visualizando balance del día:{' '}
                      <strong className="text-[#2E5A44] font-semibold">{fechaLegible}</strong>
                    </>
                  ) : modoMetricas === 'semana' ? (
                    <>
                      Visualizando balance de la semana:{' '}
                      <strong className="text-[#2E5A44] font-semibold">{etiquetaSemana}</strong>
                    </>
                  ) : (
                    <>
                      Visualizando balance mensual consolidado de:{' '}
                      <strong className="text-[#2E5A44] font-semibold">{nombreMesLegible}</strong>
                    </>
                  )}
                </p>
              </div>

              {/* CONTROLES DE CAMBIO DE MODO Y NAVEGACIÓN */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Switch de modo: Día vs Semana vs Mes */}
                <div className="flex items-center bg-[#E8F0E5] p-1 rounded-2xl border border-[#C5D6BE]">
                  <button
                    onClick={() => setModoMetricas('dia')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs ${
                      modoMetricas === 'dia'
                        ? 'bg-[#2E5A44] text-white shadow-xs'
                        : 'text-[#5A6B60] hover:text-[#1C2922]'
                    }`}
                  >
                    <IconCalendarEvent className="w-3.5 h-3.5" />
                    <span>Día</span>
                  </button>
                  <button
                    onClick={() => setModoMetricas('semana')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs ${
                      modoMetricas === 'semana'
                        ? 'bg-[#2E5A44] text-white shadow-xs'
                        : 'text-[#5A6B60] hover:text-[#1C2922]'
                    }`}
                  >
                    <IconCalendarWeek className="w-3.5 h-3.5" />
                    <span>Semana</span>
                  </button>
                  <button
                    onClick={() => setModoMetricas('mes')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs ${
                      modoMetricas === 'mes'
                        ? 'bg-[#2E5A44] text-white shadow-xs'
                        : 'text-[#5A6B60] hover:text-[#1C2922]'
                    }`}
                  >
                    <IconCalendarMonth className="w-3.5 h-3.5" />
                    <span>Mes</span>
                  </button>
                </div>

                {/* Si está en modo DÍA: Navegación de Días */}
                {modoMetricas === 'dia' && (
                  <div className="flex items-center gap-1 bg-[#F5F8F4] p-1 rounded-2xl border border-[#C5D6BE]">
                    {fechaSeleccionada !== hoyStr && (
                      <button
                        onClick={() => setFechaSeleccionada(hoyStr)}
                        className="px-2 py-1 rounded-xl text-xs font-semibold bg-white text-[#2E5A44] hover:bg-[#E8F0E5] border border-[#C5D6BE] transition cursor-pointer shadow-2xs"
                        title="Volver a la fecha actual"
                      >
                        Ir a Hoy
                      </button>
                    )}
                    <button
                      onClick={() => cambiarDia(-1)}
                      className="p-1.5 rounded-xl bg-white hover:bg-[#E8F0E5] text-[#2E5A44] border border-[#C5D6BE] transition cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                      title="Día anterior"
                    >
                      <IconChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                    <button
                      onClick={() => setFechaSeleccionada(hoyStr)}
                      className="px-2.5 py-1 rounded-xl text-xs font-bold bg-[#2E5A44] text-white shadow-2xs cursor-pointer min-w-[65px] text-center"
                    >
                      {etiquetaFechaRelativa}
                    </button>
                    <button
                      onClick={() => cambiarDia(1)}
                      className="p-1.5 rounded-xl bg-white hover:bg-[#E8F0E5] text-[#2E5A44] border border-[#C5D6BE] transition cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                      title="Día siguiente"
                    >
                      <IconChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                    <input
                      type="date"
                      value={fechaSeleccionada}
                      onChange={(e) => setFechaSeleccionada(e.target.value)}
                      className="px-2 py-1 bg-white border border-[#C5D6BE] rounded-xl text-xs font-bold text-[#1C2922] outline-none cursor-pointer hover:border-[#2E5A44] transition"
                    />
                  </div>
                )}

                {/* Si está en modo SEMANA: Navegación de Semanas */}
                {modoMetricas === 'semana' && (
                  <div className="flex items-center gap-1 bg-[#F5F8F4] p-1 rounded-2xl border border-[#C5D6BE]">
                    <button
                      onClick={() => cambiarSemana(-1)}
                      className="p-1.5 rounded-xl bg-white hover:bg-[#E8F0E5] text-[#2E5A44] border border-[#C5D6BE] transition cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                      title="Semana anterior"
                    >
                      <IconChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                    <button
                      onClick={() => setFechaSeleccionada(hoyStr)}
                      className="px-2.5 py-1 rounded-xl text-xs font-bold bg-[#2E5A44] text-white shadow-2xs cursor-pointer min-w-[75px] text-center"
                      title="Semana activa. Clic para volver a la actual"
                    >
                      {diasDeLaSemana.some((d) => d.esHoy)
                        ? 'Esta Semana'
                        : `Semana ${diasDeLaSemana[0]?.diaNum} - ${diasDeLaSemana[6]?.diaNum}`}
                    </button>
                    <button
                      onClick={() => cambiarSemana(1)}
                      className="p-1.5 rounded-xl bg-white hover:bg-[#E8F0E5] text-[#2E5A44] border border-[#C5D6BE] transition cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                      title="Semana siguiente"
                    >
                      <IconChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                    <input
                      type="date"
                      value={fechaSeleccionada}
                      onChange={(e) => setFechaSeleccionada(e.target.value)}
                      className="px-2 py-1 bg-white border border-[#C5D6BE] rounded-xl text-xs font-bold text-[#1C2922] outline-none cursor-pointer hover:border-[#2E5A44] transition"
                      title="Seleccionar fecha de la semana"
                    />
                  </div>
                )}

                {/* Si está en modo MES: Navegación de Meses */}
                {modoMetricas === 'mes' && (
                  <div className="flex items-center gap-1 bg-[#F5F8F4] p-1 rounded-2xl border border-[#C5D6BE]">
                    <button
                      onClick={() => cambiarMes(-1)}
                      className="p-1.5 rounded-xl bg-white hover:bg-[#E8F0E5] text-[#2E5A44] border border-[#C5D6BE] transition cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                      title="Mes anterior"
                    >
                      <IconChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                    <span className="px-3 py-1 rounded-xl text-xs font-bold bg-[#2E5A44] text-white shadow-2xs select-none">
                      {nombreMesLegible}
                    </span>
                    <button
                      onClick={() => cambiarMes(1)}
                      className="p-1.5 rounded-xl bg-white hover:bg-[#E8F0E5] text-[#2E5A44] border border-[#C5D6BE] transition cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                      title="Mes siguiente"
                    >
                      <IconChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                    <input
                      type="month"
                      value={mesSeleccionado}
                      onChange={(e) => setMesSeleccionado(e.target.value)}
                      className="px-2 py-1 bg-white border border-[#C5D6BE] rounded-xl text-xs font-bold text-[#1C2922] outline-none cursor-pointer hover:border-[#2E5A44] transition"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 4 TARJETAS PRINCIPALES DE RESUMEN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="bg-white rounded-2xl p-4 border border-[#C5D6BE] shadow-xs space-y-1">
                <span className="text-[11px] font-bold text-[#5A6B60] uppercase">
                  {modoMetricas === 'dia'
                    ? 'Ingresos del Día'
                    : modoMetricas === 'semana'
                    ? 'Ingresos de la Semana'
                    : 'Ingresos del Mes'}
                </span>
                <p className="text-xl sm:text-2xl font-black font-mono text-[#2E5A44]">
                  ${metricasSpa.ingresosTotales.toLocaleString('es-CO')}
                </p>
                <p className="text-[10px] text-[#5A6B60]">
                  Completado: ${metricasSpa.ingresosCompletados.toLocaleString('es-CO')} ({metricasSpa.completadasCount}/{metricasSpa.total} citas)
                </p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-[#C5D6BE] shadow-xs space-y-1">
                <span className="text-[11px] font-bold text-[#5A6B60] uppercase">
                  {modoMetricas === 'dia'
                    ? 'Citas Agendadas Hoy'
                    : modoMetricas === 'semana'
                    ? 'Citas de la Semana'
                    : 'Total Citas del Mes'}
                </span>
                <p className="text-xl sm:text-2xl font-black font-mono text-[#1C2922]">
                  {metricasSpa.total}
                </p>
                <p className="text-[10px] text-[#5A6B60]">
                  {modoMetricas === 'dia'
                    ? `Para el ${fechaLegible}`
                    : modoMetricas === 'semana'
                    ? `Semana: ${etiquetaSemana}`
                    : `En todo ${nombreMesLegible}`}
                </p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-[#C5D6BE] shadow-xs space-y-1">
                <span className="text-[11px] font-bold text-[#5A6B60] uppercase">
                  Citas Completadas
                </span>
                <p className="text-xl sm:text-2xl font-black font-mono text-emerald-600">
                  {metricasSpa.completadasCount}
                </p>
                <p className="text-[10px] text-emerald-700">
                  {metricasSpa.total > 0
                    ? `${Math.round((metricasSpa.completadasCount / metricasSpa.total) * 100)}% atendidas con éxito`
                    : 'Sin citas registradas aún'}
                </p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-[#C5D6BE] shadow-xs space-y-1">
                <span className="text-[11px] font-bold text-[#5A6B60] uppercase">
                  Citas por Atender
                </span>
                <p className="text-xl sm:text-2xl font-black font-mono text-[#C5A059]">
                  {metricasSpa.pendientesCount}
                </p>
                <p className="text-[10px] text-[#5A6B60]">
                  {metricasSpa.canceladasCount > 0
                    ? `${metricasSpa.canceladasCount} cancelada(s) en el período`
                    : '0 cancelaciones registradas'}
                </p>
              </div>
            </div>

            {/* TABLA 1: Rendimiento por Manicurista */}
            <div className="bg-white rounded-2xl border border-[#C5D6BE] shadow-xs overflow-hidden space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-sm text-[#1C2922] font-serif">
                  Rendimiento por Manicurista ({modoMetricas === 'dia' ? 'Día' : modoMetricas === 'semana' ? 'Semana' : 'Mes'})
                </h3>
                <span className="text-[11px] text-[#5A6B60]">
                  {modoMetricas === 'dia' ? fechaLegible : modoMetricas === 'semana' ? etiquetaSemana : nombreMesLegible}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F5F8F4] text-[#5A6B60] uppercase text-[10px] border-b border-[#C5D6BE]">
                    <tr>
                      <th className="py-2.5 px-3">Especialista</th>
                      <th className="py-2.5 px-3">Citas en el Período</th>
                      <th className="py-2.5 px-3">Completadas</th>
                      <th className="py-2.5 px-3">Recaudo Realizado</th>
                      <th className="py-2.5 px-3">Recaudo Estimado</th>
                      <th className="py-2.5 px-3" title="Porcentaje de citas completadas de esta especialista y su participación sobre el recaudo total del Spa">% Avance / Aporte</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8F0E5]">
                    {metricasSpa.porManicurista.map((m, i) => {
                      const pctParticipacion =
                        metricasSpa.ingresosTotales > 0
                          ? Math.round((m.ingresos / metricasSpa.ingresosTotales) * 100)
                          : 0;
                      const pctAvance =
                        m.total > 0 ? Math.round((m.completadas / m.total) * 100) : 0;
                      return (
                        <tr key={m.cancha.id} className="hover:bg-[#F5F8F4]/50 transition">
                          <td className="py-3 px-3 font-bold text-[#1C2922] flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-[#E8F0E5] text-[#2E5A44] flex items-center justify-center text-[10px]">
                              {i === 0 ? '👑' : `M${i + 1}`}
                            </span>
                            <span>{m.cancha.nombre}</span>
                          </td>
                          <td className="py-3 px-3 font-mono font-semibold">
                            <span>{m.total}</span>
                            {m.pendientes > 0 && (
                              <span className="ml-1.5 text-[10px] font-sans text-[#5A6B60]">
                                ({m.pendientes} por atender)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono text-emerald-600 font-bold">
                            {m.completadas} / {m.total}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-emerald-700">
                            ${m.ingresosCompletados.toLocaleString('es-CO')}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-[#2E5A44]">
                            ${m.ingresos.toLocaleString('es-CO')}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
                                title="Porcentaje de las citas de esta manicurista que ya fueron completadas"
                              >
                                {pctAvance}% completado
                              </span>
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#2E5A44] border border-[#C5D6BE]"
                                title="Participación de esta manicurista en el recaudo estimado total del Spa"
                              >
                                {pctParticipacion}% del total
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-[#F5F8F4] border-t-2 border-[#C5D6BE] font-bold">
                    <tr>
                      <td className="py-3 px-3 text-[#1C2922] font-bold uppercase text-[11px] tracking-wider">
                        Total Equipo ({modoMetricas === 'dia' ? 'Día' : modoMetricas === 'semana' ? 'Semana' : 'Mes'})
                      </td>
                      <td className="py-3 px-3 font-mono font-black text-sm text-[#1C2922]">
                        {metricasSpa.total}
                      </td>
                      <td className="py-3 px-3 font-mono font-black text-sm text-emerald-600">
                        {metricasSpa.completadasCount} / {metricasSpa.total}
                      </td>
                      <td className="py-3 px-3 font-mono font-black text-sm text-emerald-700">
                        ${metricasSpa.ingresosCompletados.toLocaleString('es-CO')}
                      </td>
                      <td className="py-3 px-3 font-mono font-black text-sm text-[#2E5A44]">
                        ${metricasSpa.ingresosTotales.toLocaleString('es-CO')}
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2E5A44] text-white">
                          {metricasSpa.ingresosTotales > 0 ? '100% del total' : '0%'}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* TABLA 2: Citas por Servicio */}
            <div className="bg-white rounded-2xl border border-[#C5D6BE] shadow-xs overflow-hidden space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-sm text-[#1C2922] font-serif">
                  Demanda por Servicio (Uñas, Cejas y Pestañas) ({modoMetricas === 'dia' ? 'Día' : modoMetricas === 'semana' ? 'Semana' : 'Mes'})
                </h3>
                <span className="text-[11px] text-[#5A6B60]">
                  {modoMetricas === 'dia' ? fechaLegible : modoMetricas === 'semana' ? etiquetaSemana : nombreMesLegible}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F5F8F4] text-[#5A6B60] uppercase text-[10px] border-b border-[#C5D6BE]">
                    <tr>
                      <th className="py-2.5 px-3">Servicio</th>
                      <th className="py-2.5 px-3">Categoría</th>
                      <th className="py-2.5 px-3">Duración</th>
                      <th className="py-2.5 px-3">Precio</th>
                      <th className="py-2.5 px-3">Citas Agendadas</th>
                      <th className="py-2.5 px-3">Total Generado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8F0E5]">
                    {metricasSpa.porServicio.map((s) => (
                      <tr key={s.servicio.id} className="hover:bg-[#F5F8F4]/50 transition">
                        <td className="py-2.5 px-3 font-bold text-[#1C2922]">{s.servicio.nombre}</td>
                        <td className="py-2.5 px-3 text-[#5A6B60] text-[11px]">{s.servicio.categoria}</td>
                        <td className="py-2.5 px-3 text-[#5A6B60] font-mono">{s.servicio.duracion} min</td>
                        <td className="py-2.5 px-3 font-mono text-[#5A6B60]">
                          ${s.servicio.precio.toLocaleString('es-CO')}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-[#2E5A44]">{s.cantidad}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-[#1C2922]">
                          ${s.ingresos.toLocaleString('es-CO')}
                        </td>
                      </tr>
                    ))}

                    {/* Fila única para Adicionales (Decorados, cristales, diseño extra) */}
                    <tr className="bg-amber-50/50 hover:bg-amber-100/50 transition font-medium border-t-2 border-dashed border-amber-200">
                      <td className="py-2.5 px-3 font-bold text-amber-950 flex items-center gap-1.5">
                        <span className="text-amber-600">✨</span>
                        <span>Adicionales</span>
                      </td>
                      <td className="py-2.5 px-3 text-amber-900 text-[11px]">
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                          Complementos
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[#5A6B60] font-mono">--</td>
                      <td className="py-2.5 px-3 font-mono text-[#5A6B60]">Variable</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#2E5A44]">
                        {metricasSpa.adicionalesInfo.cantidad}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#1C2922]">
                        ${metricasSpa.adicionalesInfo.ingresos.toLocaleString('es-CO')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Resumen consolidado al pie de la lista */}
              <div className="bg-[#F5F8F4] border border-[#C5D6BE] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2E5A44]" />
                  <span className="font-bold text-[#1C2922]">
                    Balance Total por Servicios ({modoMetricas === 'dia' ? 'Día' : modoMetricas === 'semana' ? 'Semana' : 'Mes'})
                  </span>
                  <span className="text-[#5A6B60] text-[11px]">
                    · {modoMetricas === 'dia' ? fechaLegible : modoMetricas === 'semana' ? etiquetaSemana : nombreMesLegible}
                  </span>
                </div>
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#5A6B60] font-medium">Total Citas Agendadas:</span>
                    <span className="font-mono font-black text-[#2E5A44] text-sm sm:text-base">
                      {metricasSpa.totalCitasServicios} {metricasSpa.totalCitasServicios === 1 ? 'cita' : 'citas'}
                    </span>
                  </div>
                  <span className="text-[#C5D6BE]">|</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#5A6B60] font-medium">Total Dinero Generado:</span>
                    <span className="font-mono font-black text-[#1C2922] text-sm sm:text-base">
                      ${metricasSpa.totalDineroServicios.toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* CASO C: VISTA EXCLUSIVA DE LAS MANICURISTAS (2, 3 O 4)                */}
        {/* ==================================================================== */}
        {!esAdmin && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-[#F5F8F4] to-[#E8F0E5] border border-[#C5D6BE] rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#1C2922] font-serif">
                  ¡Hola, {perfilActual.nombre}! 💅
                </h2>
                <p className="text-xs text-[#5A6B60]">
                  {vistaAgenda === 'dia'
                    ? `Turnos asignados a tu puesto para el ${fechaLegible}.`
                    : `Planificación semanal de tus turnos del ${etiquetaSemana}.`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => abrirModalBloquear(perfilActual.canchaId)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer active:scale-95"
                  title="Bloquear una o varias horas de mi puesto para descanso o diligencias"
                >
                  <IconLock className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Bloquear Mi Horario</span>
                </button>
                {(() => {
                  const targetIdx = perfilesConIds.findIndex((p) => p.id === perfilActual.id) - 1;
                  const canchaAsignada =
                    canchas.find((c) => c.id === perfilActual.canchaId) ||
                    (targetIdx >= 0 && targetIdx < canchas.length ? canchas[targetIdx] : undefined) ||
                    canchas.find((c) => {
                      const cNom = c.nombre.toLowerCase();
                      const pNom = (perfilActual.canchaNombreMatch || perfilActual.nombre).toLowerCase();
                      return cNom.includes(pNom) || pNom.includes(cNom);
                    });

                  const matchCanchaEspecialista = (r: Reserva) => {
                    if (canchaAsignada && reservaCorrespondeACancha(r, canchaAsignada, targetIdx)) {
                      return true;
                    }
                    if (perfilActual.canchaId && (r.cancha_id === perfilActual.canchaId || r.canchas?.id === perfilActual.canchaId)) {
                      return true;
                    }
                    return false;
                  };

                  const citasHoy = citasClientesDelDia.filter(matchCanchaEspecialista).length;
                  const bloqHoy = bloqueosDelDia.filter(matchCanchaEspecialista).length;
                  const citasSem = citasClientesDeLaSemana.filter(matchCanchaEspecialista).length;
                  const bloqSem = bloqueosDeLaSemana.filter(matchCanchaEspecialista).length;

                  return (
                    <span className="text-xs font-bold text-[#2E5A44] bg-white px-3 py-2 rounded-xl border border-[#C5D6BE] shadow-2xs">
                      {vistaAgenda === 'dia' ? (
                        <>
                          {citasHoy} citas hoy
                          {bloqHoy > 0 && (
                            <span className="ml-1 text-amber-700 font-semibold">
                              ({bloqHoy} bloq)
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          {citasSem} citas esta semana
                          {bloqSem > 0 && (
                            <span className="ml-1 text-amber-700 font-semibold">
                              ({bloqSem} bloq)
                            </span>
                          )}
                        </>
                      )}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* VISTA SEGÚN MODO DÍA O SEMANA */}
            {(() => {
              const targetIdx = perfilesConIds.findIndex((p) => p.id === perfilActual.id) - 1;
              const canchaAsignada =
                canchas.find((c) => c.id === perfilActual.canchaId) ||
                (targetIdx >= 0 && targetIdx < canchas.length ? canchas[targetIdx] : undefined) ||
                canchas.find((c) => {
                  const cNom = c.nombre.toLowerCase();
                  const pNom = (perfilActual.canchaNombreMatch || perfilActual.nombre).toLowerCase();
                  return cNom.includes(pNom) || pNom.includes(cNom);
                });

              const effectiveCanchaId = canchaAsignada?.id || perfilActual.canchaId;

              const matchCanchaEspecialista = (r: Reserva) => {
                if (canchaAsignada && reservaCorrespondeACancha(r, canchaAsignada, targetIdx)) {
                  return true;
                }
                if (perfilActual.canchaId && (r.cancha_id === perfilActual.canchaId || r.canchas?.id === perfilActual.canchaId)) {
                  return true;
                }
                return false;
              };

              return vistaAgenda === 'semana' ? (
                renderVistaSemanal(
                  reservasDeLaSemana.filter((r) => matchCanchaEspecialista(r) && r.estado !== 'cancelada'),
                  false,
                  effectiveCanchaId
                )
              ) : (
                renderTimelineManicurista(
                  reservasDelDia.filter((r) => matchCanchaEspecialista(r) && r.estado !== 'cancelada'),
                  perfilActual.nombre,
                  effectiveCanchaId,
                  false
                )
              );
            })()}

            {/* Aviso de permisos */}
            <div className="bg-[#F5F8F4] border border-[#C5D6BE] rounded-xl p-3 text-xs text-[#5A6B60] text-center">
              🔒 Tu perfil está configurado para consultar tus citas personales. La administración y agendamiento general es gestionado por la encargada.
            </div>
          </div>
        )}
      </main>

      {/* ==================================================================== */}
      {/* MODAL EXCLUSIVO DE LA ADMIN: AGENDAR CITA CON MENÚS DESPLEGABLES     */}
      {/* ==================================================================== */}
      <AgendarCitaModal
        abierto={esAdmin && modalAgendarAbierto}
        onClose={() => setModalAgendarAbierto(false)}
        onSubmit={handleCrearCitaAdmin}
        canchas={canchas}
        servicios={servicios}
        agendarManicuristaId={agendarManicuristaId}
        setAgendarManicuristaId={setAgendarManicuristaId}
        menuManiAbierto={menuManiAbierto}
        setMenuManiAbierto={setMenuManiAbierto}
        manicuristaSeleccionadaForm={manicuristaSeleccionadaForm}
        agendarServicioId={agendarServicioId}
        setAgendarServicioId={setAgendarServicioId}
        menuServicioAbierto={menuServicioAbierto}
        setMenuServicioAbierto={setMenuServicioAbierto}
        servicioSeleccionadoForm={servicioSeleccionadoForm}
        agendarServiciosExtrasIds={agendarServiciosExtrasIds}
        setAgendarServiciosExtrasIds={setAgendarServiciosExtrasIds}
        duracionTotalAdmin={duracionTotalAdmin}
        precioTotalAdmin={precioTotalAdmin}
        agendarFecha={agendarFecha}
        setAgendarFecha={setAgendarFecha}
        agendarHora={agendarHora}
        setAgendarHora={setAgendarHora}
        menuHoraAbierto={menuHoraAbierto}
        setMenuHoraAbierto={setMenuHoraAbierto}
        horasDisponiblesAgendarAdmin={horasDisponiblesAgendarAdmin}
        agendarNombre={agendarNombre}
        setAgendarNombre={setAgendarNombre}
        agendarTelefono={agendarTelefono}
        setAgendarTelefono={setAgendarTelefono}
        errorAgendar={errorAgendar}
        guardandoCita={guardandoCita}
      />

      {/* ==================================================================== */}
      {/* MODAL: BLOQUEAR HORARIO (ADMIN Y MANICURISTAS)                       */}
      {/* ==================================================================== */}
      <BloquearHorarioModal
        abierto={modalBloquearAbierto}
        onClose={() => setModalBloquearAbierto(false)}
        onSubmit={handleCrearBloqueo}
        esAdmin={esAdmin}
        perfilActual={perfilActual}
        canchas={canchas}
        bloquearManicuristaId={bloquearManicuristaId}
        setBloquearManicuristaId={setBloquearManicuristaId}
        menuBloquearManiAbierto={menuBloquearManiAbierto}
        setMenuBloquearManiAbierto={setMenuBloquearManiAbierto}
        bloquearFecha={bloquearFecha}
        setBloquearFecha={setBloquearFecha}
        hoyStr={hoyStr}
        bloquearHorasSeleccionadas={bloquearHorasSeleccionadas}
        setBloquearHorasSeleccionadas={setBloquearHorasSeleccionadas}
        horasOpcionesBloqueoDinamicas={horasOpcionesBloqueoDinamicas}
        horasYaPasadasBloqueo={horasYaPasadasBloqueo}
        horasYaOcupadasBloqueo={horasYaOcupadasBloqueo}
        toggleHoraBloqueo={toggleHoraBloqueo}
        bloquearMotivo={bloquearMotivo}
        setBloquearMotivo={setBloquearMotivo}
        bloquearMotivoPersonalizado={bloquearMotivoPersonalizado}
        setBloquearMotivoPersonalizado={setBloquearMotivoPersonalizado}
        errorBloquear={errorBloquear}
        guardandoBloqueo={guardandoBloqueo}
      />

      {/* ==================================================================== */}
      {/* MODAL CONFIGURACIÓN DE HORARIOS, ANTICIPOS & CUENTAS                  */}
      {/* ==================================================================== */}
      <ConfigAnticipoModal
        abierto={modalConfigAnticipoAbierto}
        onClose={() => setModalConfigAnticipoAbierto(false)}
        configAnticipo={configAnticipo}
        setConfigAnticipo={setConfigAnticipo}
        onSubmit={handleGuardarConfigAnticipo}
        guardando={guardandoConfigAnticipo}
      />

            {/* ==================================================================== */}
      {/* MODAL ELEGANTE: RESTRICCIÓN DE ACCESO AL BOT DE WHATSAPP             */}
      {/* ==================================================================== */}
      <ExclusionesBotModal
        abierto={esAdmin && modalExclusionesAbierto}
        onClose={() => setModalExclusionesAbierto(false)}
        nuevoTelExclusion={nuevoTelExclusion}
        setNuevoTelExclusion={setNuevoTelExclusion}
        nuevoNombreExclusion={nuevoNombreExclusion}
        setNuevoNombreExclusion={setNuevoNombreExclusion}
        errorExclusion={errorExclusion}
        guardandoExclusion={guardandoExclusion}
        handleAgregarExclusion={handleAgregarExclusion}
        busquedaExclusion={busquedaExclusion}
        setBusquedaExclusion={setBusquedaExclusion}
        exclusionesBot={exclusionesBot}
        cargandoExclusiones={cargandoExclusiones}
        solicitarReactivarBot={solicitarReactivarBot}
        exclusionAReactivar={exclusionAReactivar}
        setExclusionAReactivar={setExclusionAReactivar}
        reactivandoBot={reactivandoBot}
        handleConfirmarReactivarBot={handleConfirmarReactivarBot}
      />

      {/* ==================================================================== */}
      {/* MODAL ELEGANTE: CONFIRMAR REACTIVACIÓN DEL BOT (QUITAR RESTRICCIÓN)   */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {exclusionAReactivar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 border border-[#C5D6BE] shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
            >
              {/* Cabecera del Modal con Colores de la App */}
              <div className="flex items-center justify-between border-b border-[#E8F0E5] pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold text-lg shadow-2xs">
                    <IconRefresh className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-[#1C2922] font-serif">
                      ¿Reactivar el Bot para este Número?
                    </h3>
                    <p className="text-[11px] text-[#5A6B60]">
                      Se levantará la restricción de agendamiento automático
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setExclusionAReactivar(null)}
                  className="p-1.5 rounded-full text-[#5A6B60] hover:text-[#1C2922] hover:bg-[#F5F8F4] cursor-pointer transition"
                >
                  <IconX className="w-4 h-4" />
                </button>
              </div>

              {/* Tarjeta con los Datos del Número */}
              <div className="bg-[#F5F8F4] border border-[#C5D6BE] rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#5A6B60]">Identificador / Motivo:</span>
                  <span className="font-bold text-sm text-[#1C2922] font-serif">
                    {exclusionAReactivar.nombre || 'Número restringido'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#5A6B60]">Teléfono WhatsApp:</span>
                  <span className="font-mono font-bold text-[#2E5A44] bg-white px-2 py-0.5 rounded-lg border border-[#C5D6BE]">
                    📱 {exclusionAReactivar.telefono}
                  </span>
                </div>
              </div>

              {/* Alerta Informativa */}
              <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 text-xs flex items-center gap-2.5">
                <IconCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  Al reactivar el bot, este número volverá a recibir respuestas automáticas y podrá agendar citas por WhatsApp.
                </span>
              </div>

              {/* Botones Cancelar y Confirmar con Colores de la Marca */}
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setExclusionAReactivar(null)}
                  disabled={reactivandoBot}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-[#5A6B60] font-semibold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarReactivarBot}
                  disabled={reactivandoBot}
                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {reactivandoBot ? (
                    <>
                      <IconLoader2 className="w-4 h-4 animate-spin" />
                      <span>Reactivando...</span>
                    </>
                  ) : (
                    <>
                      <IconRefresh className="w-4 h-4" />
                      <span>Sí, Reactivar Bot</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* ============================================================================ */}
      {/* VIEW EMERGENTE (POPOVER FLOTANTE) AL PASAR EL MOUSE POR ENCIMA DE UNA CITA    */}
      {/* ============================================================================ */}
      <DetalleCitaPopover
        popoverCita={popoverCita}
        onMouseEnter={mantenerPopoverCita}
        onMouseLeave={cerrarPopoverCita}
        esAdmin={esAdmin}
        perfilActual={perfilActual}
        canchas={canchas}
        ahora={ahora}
        obtenerHoraMinutosBogota={obtenerHoraMinutosBogota}
        obtenerDuracionMinutosCita={obtenerDuracionMinutosCita}
        obtenerDetalleBloqueo={obtenerDetalleBloqueo}
        obtenerNombreClienta={obtenerNombreClienta}
        obtenerServicioCita={obtenerServicioCita}
        handleDesbloquearHorario={handleDesbloquearHorario}
        handleAprobarAnticipo={handleAprobarAnticipo}
        handleRechazarAnticipo={handleRechazarAnticipo}
        handleCambiarEstado={handleCambiarEstado}
        procesandoAccionAnticipo={procesandoAccionAnticipo}
        onClose={() => setPopoverCita(null)}
        onAbrirModalAdicional={abrirModalAdicional}
        onEliminarAdicional={handleEliminarAdicional}
      />

      {/* Modal para Añadir Servicio Adicional (Decorados, etc.) */}
      <ModalAgregarAdicional
        abierto={citaParaAdicional !== null}
        onClose={() => setCitaParaAdicional(null)}
        cita={citaParaAdicional}
        onGuardar={handleGuardarAdicional}
        guardando={guardandoAdicional}
        obtenerNombreClienta={obtenerNombreClienta}
        obtenerServicioCita={obtenerServicioCita}
      />

    </div>
  );
};
