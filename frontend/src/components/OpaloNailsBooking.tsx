import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IconBrandWhatsapp,
  IconBrandInstagram,
  IconClock,
  IconMapPin,
  IconSparkles,
  IconCheck,
  IconX,
  IconArrowLeft,
  IconLoader2,
  IconHeart,
  IconChevronDown,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
} from '@tabler/icons-react';
import { supabase } from '../config/supabase';

interface Servicio {
  id: number;
  nombre: string;
  categoria: string;
  duracion: number;
  precio: number;
  descripcion: string;
}

interface Empleada {
  id: string;
  nombre: string;
  foto?: string | null;
}

const FOTOS_EQUIPO_OPALO: Record<string, string> = {};

function normalizarNombreYFotoEmpleada(emp: { id: string; nombre: string; foto?: string | null }): Empleada {
  let nombre = emp.nombre;
  const nLower = nombre.trim().toLowerCase();
  if (nLower === '1' || nLower === 'manicurista 1') nombre = 'Especialista 1';
  else if (nLower === '2' || nLower === 'manicurista 2') nombre = 'Especialista 2';
  else if (nLower === '3' || nLower === 'manicurista 3') nombre = 'Especialista 3';
  else if (nLower === '4' || nLower === 'manicurista 4') nombre = 'Especialista 4';

  const foto = emp.foto || FOTOS_EQUIPO_OPALO[nombre.toLowerCase()] || FOTOS_EQUIPO_OPALO[emp.nombre.toLowerCase()] || null;
  return { id: emp.id, nombre, foto };
}

const SERVICIOS_DEFAULT: Servicio[] = [
  // --- CEJAS Y PESTAÑAS ---
  {
    id: 1,
    nombre: 'Depilación con cera',
    categoria: 'Cejas y Pestañas',
    duracion: 30,
    precio: 15000,
    descripcion: 'Diseño y depilación de cejas con cera tibia hipoalergénica para un acabado limpio y definido.',
  },
  {
    id: 2,
    nombre: 'Depilación con hilo',
    categoria: 'Cejas y Pestañas',
    duracion: 30,
    precio: 20000,
    descripcion: 'Diseño y depilación de cejas con técnica hindú en hilo, ideal para pieles sensibles y máxima precisión.',
  },
  {
    id: 3,
    nombre: 'Henna',
    categoria: 'Cejas y Pestañas',
    duracion: 30,
    precio: 8000,
    descripcion: 'Sombreado semipermanente con pigmento de henna para rellenar y definir el marco de tus cejas.',
  },
  {
    id: 4,
    nombre: 'Cera y henna',
    categoria: 'Cejas y Pestañas',
    duracion: 45,
    precio: 22000,
    descripcion: 'Combo de diseño de cejas con cera más pigmentación en henna para una mirada expresiva.',
  },
  {
    id: 5,
    nombre: 'Hilo y henna',
    categoria: 'Cejas y Pestañas',
    duracion: 45,
    precio: 16000,
    descripcion: 'Combo de depilación de cejas con hilo más sombreado en henna con definición natural.',
  },
  {
    id: 6,
    nombre: 'Bigote con cera',
    categoria: 'Cejas y Pestañas',
    duracion: 20,
    precio: 8000,
    descripcion: 'Depilación delicada de bozo con cera suave para piel sensible.',
  },
  {
    id: 7,
    nombre: 'Bigote con hilo',
    categoria: 'Cejas y Pestañas',
    duracion: 20,
    precio: 10000,
    descripcion: 'Depilación de bozo con técnica de hilo sin irritación.',
  },
  {
    id: 8,
    nombre: 'Laminado de cejas',
    categoria: 'Cejas y Pestañas',
    duracion: 60,
    precio: 55000,
    descripcion: 'Alisado, diseño y fijación direccional de cejas con hidratación profunda para un efecto orgánico y poblado.',
  },
  {
    id: 9,
    nombre: 'Lifting de pestañas',
    categoria: 'Cejas y Pestañas',
    duracion: 60,
    precio: 55000,
    descripcion: 'Realce y curvatura natural para tus pestañas con nutrición e hidratación profunda.',
  },
  {
    id: 10,
    nombre: 'Pestañas pelo a pelo clásicas',
    categoria: 'Cejas y Pestañas',
    duracion: 120,
    precio: 80000,
    descripcion: 'Extensión de pestañas técnica clásica pelo a pelo con efecto natural y elegante. (Retoque $40.000; pasados los 20 días tiene adicional de $5.000 a $10.000).',
  },
  {
    id: 11,
    nombre: 'Pestañas pelo a pelo efecto pestañina',
    categoria: 'Cejas y Pestañas',
    duracion: 120,
    precio: 80000,
    descripcion: 'Extensión de pestañas con textura y definición tipo rímel para una mirada más intensa. (Retoque $45.000; pasados los 20 días tiene adicional de $5.000 a $10.000).',
  },
  {
    id: 12,
    nombre: 'Pestañas híbridas',
    categoria: 'Cejas y Pestañas',
    duracion: 120,
    precio: 100000,
    descripcion: 'Combinación perfecta entre técnica clásica y abanicos de volumen para mayor densidad. (Retoque $50.000; pasados los 20 días tiene adicional de $5.000 a $10.000).',
  },
  {
    id: 13,
    nombre: 'Pestañas 3D',
    categoria: 'Cejas y Pestañas',
    duracion: 120,
    precio: 100000,
    descripcion: 'Abanicos ligeros 3D que aportan volumen, suavidad y plenitud a tu mirada. (Retoque $50.000; pasados los 20 días tiene adicional de $5.000 a $10.000).',
  },
  {
    id: 14,
    nombre: 'Pestañas pelo a pelo volumen ruso',
    categoria: 'Cejas y Pestañas',
    duracion: 150,
    precio: 110000,
    descripcion: 'Máxima densidad y dramatismo con abanicos artesanales ultra ligeros de volumen ruso. (Retoque $60.000; pasados los 20 días tiene adicional de $5.000 a $10.000).',
  },
  {
    id: 15,
    nombre: 'Pestañas pelo a pelo volumen brasileño',
    categoria: 'Cejas y Pestañas',
    duracion: 120,
    precio: 90000,
    descripcion: 'Extensión con fibras en forma de Y que brindan excelente retención, ligereza y acabado tupido.',
  },

  // --- UÑAS TRADICIONAL Y SEMI ---
  {
    id: 16,
    nombre: 'Limpieza',
    categoria: 'Uñas Tradicional y Semi',
    duracion: 40,
    precio: 13000,
    descripcion: 'Cuidado esencial de uñas: corte, limado, limpieza de cutícula e hidratación.',
  },
  {
    id: 17,
    nombre: 'Manicura tradicional',
    categoria: 'Uñas Tradicional y Semi',
    duracion: 60,
    precio: 18000,
    descripcion: 'Limpieza profunda de manos, arreglo de cutícula, exfoliación, hidratación y esmaltado tradicional.',
  },
  {
    id: 18,
    nombre: 'Pedicura tradicional',
    categoria: 'Uñas Tradicional y Semi',
    duracion: 60,
    precio: 18000,
    descripcion: 'Pedicure spa completo con limpieza profunda, exfoliación, masaje relajante y esmaltado tradicional.',
  },
  {
    id: 19,
    nombre: 'Manicura semipermanente full',
    categoria: 'Uñas Tradicional y Semi',
    duracion: 90,
    precio: 46000,
    descripcion: 'Manicura rusa/combinada con esmaltado semipermanente de larga duración y diseño incluido.',
  },
  {
    id: 20,
    nombre: 'Manicura solo tono',
    categoria: 'Uñas Tradicional y Semi',
    duracion: 75,
    precio: 39000,
    descripcion: 'Manicura con esmaltado semipermanente en tono liso uniforme y brillo espejo.',
  },
  {
    id: 21,
    nombre: 'Pedicura Semi',
    categoria: 'Uñas Tradicional y Semi',
    duracion: 80,
    precio: 39000,
    descripcion: 'Pedicure completo con esmaltado semipermanente de alta duración y secado inmediato en lámpara LED.',
  },
  {
    id: 22,
    nombre: 'Dipping + Semi',
    categoria: 'Uñas Tradicional y Semi',
    duracion: 90,
    precio: 53000,
    descripcion: 'Refuerzo en polvo de inmersión (Dipping) sobre uña natural finalizado con esmaltado semipermanente.',
  },
  {
    id: 23,
    nombre: 'Base Ruber',
    categoria: 'Uñas Tradicional y Semi',
    duracion: 90,
    precio: 53000,
    descripcion: 'Nivelación y refuerzo estructural con base rubber elástica para proteger y fortalecer la uña natural.',
  },

  // --- ACRÍLICO Y PRESS ON ---
  {
    id: 24,
    nombre: 'Recubrimiento en acrílico',
    categoria: 'Acrílico y Press On',
    duracion: 120,
    precio: 75000,
    descripcion: 'Capa protectora de acrílico sobre el largo de tu uña natural con esmaltado semipermanente.',
  },
  {
    id: 25,
    nombre: 'Sistema Press On',
    categoria: 'Acrílico y Press On',
    duracion: 120,
    precio: 75000,
    descripcion: 'Extensión con tips soft gel de última generación, ligeros, resistentes y de acabado natural.',
  },
  {
    id: 26,
    nombre: 'Acrílicas con tip',
    categoria: 'Acrílico y Press On',
    duracion: 120,
    precio: 90000,
    descripcion: 'Extensión de uñas acrílicas con tip, estructura estilizada y esmaltado semipermanente.',
  },
  {
    id: 27,
    nombre: 'Acrílicas esculpidas',
    categoria: 'Acrílico y Press On',
    duracion: 150,
    precio: 100000,
    descripcion: 'Extensión artesanal en acrílico esculpido sobre molde, adaptada a la anatomía de tu uña.',
  },
  {
    id: 28,
    nombre: 'Retoque de acrílico o Press On',
    categoria: 'Acrílico y Press On',
    duracion: 120,
    precio: 65000,
    descripcion: 'Mantenimiento y nivelación de crecimiento. Incluye reparación de 1 uña perdida (adicional: con tip $6.000, esculpida $8.000).',
  },

  // --- RETIROS Y ADICIONALES ---
  {
    id: 29,
    nombre: 'Retiro de acrílico definitivo',
    categoria: 'Retiros y Adicionales',
    duracion: 60,
    precio: 15000,
    descripcion: 'Retiro seguro y profesional de sistema acrílico cuidando las capas de tu uña natural.',
  },
  {
    id: 30,
    nombre: 'Retiro definitivo semipermanente',
    categoria: 'Retiros y Adicionales',
    duracion: 30,
    precio: 8000,
    descripcion: 'Retiro cuidadoso de esmaltado semipermanente con hidratación de cutícula.',
  },
  {
    id: 31,
    nombre: 'Uña en semipermanente',
    categoria: 'Retiros y Adicionales',
    duracion: 20,
    precio: 4000,
    descripcion: 'Arreglo o esmaltado individual de una uña en semipermanente.',
  },
  {
    id: 32,
    nombre: 'Uña Press On o recubrimiento',
    categoria: 'Retiros y Adicionales',
    duracion: 20,
    precio: 7000,
    descripcion: 'Reposición o recubrimiento individual de una uña en sistema Press On o acrílico sobre uña natural.',
  },
  {
    id: 33,
    nombre: 'Uña acrílica con tip',
    categoria: 'Retiros y Adicionales',
    duracion: 25,
    precio: 8000,
    descripcion: 'Reposición individual de una uña acrílica con tip.',
  },
  {
    id: 34,
    nombre: 'Uña esculpida',
    categoria: 'Retiros y Adicionales',
    duracion: 30,
    precio: 10000,
    descripcion: 'Reconstrucción o extensión individual de una uña en acrílico esculpido.',
  },
];

const EMPLEADAS_DEFAULT: Empleada[] = [
  { id: 'f6010000-0000-0000-0000-000000000001', nombre: 'Especialista 1' },
  { id: 'f6020000-0000-0000-0000-000000000002', nombre: 'Especialista 2' },
  { id: 'f6030000-0000-0000-0000-000000000003', nombre: 'Especialista 3' },
  { id: 'f6040000-0000-0000-0000-000000000004', nombre: 'Especialista 4' },
];

const CATEGORIAS = [
  'Todos',
  'Cejas y Pestañas',
  'Uñas Tradicional y Semi',
  'Acrílico y Press On',
  'Retiros y Adicionales',
];

export function formatearDuracion(minutos: number): string {
  if (!minutos || minutos <= 0) return '30 min';
  return `${minutos} min`;
}

const INSTAGRAM_OFICIAL_URL = 'https://www.instagram.com/opalo_nailspereira?cplk=MW9ncWJwMG50anlsMQ==';
const GOOGLE_MAPS_SPA_URL = 'https://www.google.com/maps/search/?api=1&query=Opalo+Nails+Spa+Pereira+Risaralda';
const APPLE_MAPS_SPA_URL = 'https://maps.apple.com/?q=Opalo+Nails+Spa+Pereira+Colombia';

function obtenerUrlMapaSpa(): string {
  if (typeof navigator !== 'undefined') {
    const esApple =
      /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) &&
      !/Windows|Android/.test(navigator.userAgent);
    if (esApple) {
      return APPLE_MAPS_SPA_URL;
    }
  }
  return GOOGLE_MAPS_SPA_URL;
}

interface Props {
  onIrAlAdmin?: () => void;
}

export const OpaloNailsBooking: React.FC<Props> = ({ onIrAlAdmin }) => {
  const [categoriaActiva, setCategoriaActiva] = useState('Todos');
  const [servicios, setServicios] = useState<Servicio[]>(SERVICIOS_DEFAULT);
  const [empleadas, setEmpleadas] = useState<Empleada[]>(EMPLEADAS_DEFAULT);

  // Modal de reserva
  const [modalAbierto, setModalAbierto] = useState(false);
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [servicioSeleccionado, setServicioSeleccionado] = useState<Servicio | null>(null);
  const [serviciosExtras, setServiciosExtras] = useState<Servicio[]>([]);
  const [selectorExtrasAbierto, setSelectorExtrasAbierto] = useState(false);

  // Lista combinada de todos los servicios incluidos en la cita
  const todosLosServicios = useMemo(() => {
    if (!servicioSeleccionado) return [];
    return [servicioSeleccionado, ...serviciosExtras];
  }, [servicioSeleccionado, serviciosExtras]);

  // Duración total combinada (minutos)
  const duracionTotal = useMemo(() => {
    return todosLosServicios.reduce((acc, s) => acc + (s.duracion || 60), 0);
  }, [todosLosServicios]);

  // Precio total combinado (COP)
  const precioTotal = useMemo(() => {
    return todosLosServicios.reduce((acc, s) => acc + (s.precio || 0), 0);
  }, [todosLosServicios]);

  // Nombre de servicios combinados (ej. "Manos + Pies")
  const nombreServiciosCombinados = useMemo(() => {
    return todosLosServicios.map((s) => s.nombre).join(' + ');
  }, [todosLosServicios]);

  const toggleServicioExtra = (s: Servicio) => {
    setServiciosExtras((prev) => {
      const yaEsta = prev.some((x) => x.id === s.id);
      if (yaEsta) {
        return prev.filter((x) => x.id !== s.id);
      } else {
        return [...prev, s];
      }
    });
    setHoraSeleccionada(null);
  };
  const [faqAbierto, setFaqAbierto] = useState<number | null>(null);

  // Formulario de reserva
  const hoyStr = useMemo(() => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  }, []);
  const [fecha, setFecha] = useState(hoyStr);
  const [calendarioAbierto, setCalendarioAbierto] = useState(false);
  const contenedorCalendarioRef = useRef<HTMLDivElement>(null);

  const [añoVisualizado, setAñoVisualizado] = useState(() => {
    const [y] = hoyStr.split('-').map(Number);
    return y;
  });
  const [mesVisualizado, setMesVisualizado] = useState(() => {
    const [, m] = hoyStr.split('-').map(Number);
    return m - 1;
  });

  // Cuando se abre el calendario, sincronizar vista con la fecha seleccionada
  useEffect(() => {
    if (calendarioAbierto && fecha) {
      const [y, m] = fecha.split('-').map(Number);
      if (!isNaN(y) && !isNaN(m)) {
        setAñoVisualizado(y);
        setMesVisualizado(m - 1);
      }
    }
  }, [calendarioAbierto, fecha]);

  // Cerrar al hacer clic fuera o presionar Escape
  useEffect(() => {
    if (!calendarioAbierto) return;
    const handleClickAfuera = (event: MouseEvent | TouchEvent) => {
      if (
        contenedorCalendarioRef.current &&
        !contenedorCalendarioRef.current.contains(event.target as Node)
      ) {
        setCalendarioAbierto(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCalendarioAbierto(false);
    };
    document.addEventListener('mousedown', handleClickAfuera);
    document.addEventListener('touchstart', handleClickAfuera);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickAfuera);
      document.removeEventListener('touchstart', handleClickAfuera);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [calendarioAbierto]);

  const [hoyYear, hoyMonth] = useMemo(() => {
    const [y, m] = hoyStr.split('-').map(Number);
    return [y, m - 1];
  }, [hoyStr]);

  const puedeIrMesAnterior = useMemo(() => {
    if (añoVisualizado > hoyYear) return true;
    if (añoVisualizado === hoyYear) return mesVisualizado > hoyMonth;
    return false;
  }, [añoVisualizado, mesVisualizado, hoyYear, hoyMonth]);

  const cambiarMes = (delta: number) => {
    let nuevoMes = mesVisualizado + delta;
    let nuevoAño = añoVisualizado;
    if (nuevoMes < 0) {
      nuevoMes = 11;
      nuevoAño -= 1;
    } else if (nuevoMes > 11) {
      nuevoMes = 0;
      nuevoAño += 1;
    }
    setAñoVisualizado(nuevoAño);
    setMesVisualizado(nuevoMes);
  };

  const irAHoy = () => {
    setAñoVisualizado(hoyYear);
    setMesVisualizado(hoyMonth);
    setFecha(hoyStr);
    setCalendarioAbierto(false);
  };

  const nombreMesAño = useMemo(() => {
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return `${meses[mesVisualizado]} ${añoVisualizado}`;
  }, [mesVisualizado, añoVisualizado]);

  const diasCalendario = useMemo(() => {
    const res: Array<{
      tipo: 'prev' | 'current' | 'next';
      diaNum: number;
      iso: string;
      dayOfWeek: number;
    }> = [];

    const primerDia = new Date(añoVisualizado, mesVisualizado, 1);
    const primerDiaSemana = (primerDia.getDay() + 6) % 7; // Lunes = 0, Domingo = 6
    const diasEnMes = new Date(añoVisualizado, mesVisualizado + 1, 0).getDate();
    const diasEnMesPrev = new Date(añoVisualizado, mesVisualizado, 0).getDate();

    // Días del mes previo
    for (let i = primerDiaSemana - 1; i >= 0; i--) {
      const diaNum = diasEnMesPrev - i;
      res.push({
        tipo: 'prev',
        diaNum,
        iso: '',
        dayOfWeek: (primerDiaSemana - 1 - i + 1) % 7,
      });
    }

    // Días del mes actual
    for (let d = 1; d <= diasEnMes; d++) {
      const fechaObj = new Date(añoVisualizado, mesVisualizado, d);
      const yStr = añoVisualizado;
      const mStr = String(mesVisualizado + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const iso = `${yStr}-${mStr}-${dStr}`;
      res.push({
        tipo: 'current',
        diaNum: d,
        iso,
        dayOfWeek: fechaObj.getDay(),
      });
    }

    // Días del mes siguiente para completar la cuadrícula (múltiplo de 7)
    const sobrantes = (7 - (res.length % 7)) % 7;
    for (let d = 1; d <= sobrantes; d++) {
      res.push({
        tipo: 'next',
        diaNum: d,
        iso: '',
        dayOfWeek: (res.length) % 7,
      });
    }

    return res;
  }, [añoVisualizado, mesVisualizado]);

  const formatearFechaElegante = (fechaIso: string) => {
    if (!fechaIso) return '';
    const [y, m, d] = fechaIso.split('-').map(Number);
    const fechaObj = new Date(y, m - 1, d);
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    const diaSemana = dias[fechaObj.getDay()];
    const diaNum = fechaObj.getDate();
    const mesNombre = meses[fechaObj.getMonth()];

    if (fechaIso === hoyStr) {
      return `Hoy · ${diaSemana}, ${diaNum} de ${mesNombre}`;
    }
    return `${diaSemana}, ${diaNum} de ${mesNombre}`;
  };

  const diasRapidos = useMemo(() => {
    const lista = [];
    const diasCortos = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const [y, m, d] = hoyStr.split('-').map(Number);
    const base = new Date(y, m - 1, d);

    for (let i = 0; i < 7; i++) {
      const cur = new Date(base);
      cur.setDate(base.getDate() + i);
      const dayOfWeek = cur.getDay();
      const esDomingo = dayOfWeek === 0;

      const yStr = cur.getFullYear();
      const mStr = String(cur.getMonth() + 1).padStart(2, '0');
      const dStr = String(cur.getDate()).padStart(2, '0');
      const isoStr = `${yStr}-${mStr}-${dStr}`;

      let label = '';
      if (i === 0) label = 'Hoy';
      else if (i === 1) label = 'Mañana';
      else label = `${diasCortos[dayOfWeek]} ${cur.getDate()}`;

      lista.push({
        iso: isoStr,
        label,
        diaNum: cur.getDate(),
        diaSemana: diasCortos[dayOfWeek],
        esDomingo,
      });
    }
    return lista;
  }, [hoyStr]);

  const [horaSeleccionada, setHoraSeleccionada] = useState<string | null>(null);
  const [empleadaId, setEmpleadaId] = useState<string>(''); // Vacío = "Cualquiera disponible"
  const [menuEspecialistaAbierto, setMenuEspecialistaAbierto] = useState(false);
  const [slots, setSlots] = useState<string[]>([]);
  const [cargandoSlots, setCargandoSlots] = useState(false);
  const [avisoSlots, setAvisoSlots] = useState<string | null>(null);

  // Datos del cliente
  const [telefono, setTelefono] = useState('');
  const [nombre, setNombre] = useState('');
  const [enviandoReserva, setEnviandoReserva] = useState(false);
  // Configuración de anticipos, cuentas bancarias y horario de atención
  const [spaConfig, setSpaConfig] = useState<{
    exigeAnticipo: boolean;
    montoAnticipoFijo: number;
    porcentajeAnticipo?: number;
    nequiNumero?: string;
    bancolombiaNumero?: string;
    titularCuenta?: string;
    horaApertura?: string;
    horaCierre?: string;
  }>({
    exigeAnticipo: false,
    montoAnticipoFijo: 20000,
    porcentajeAnticipo: 20000,
    nequiNumero: 'Pendiente por configurar',
    bancolombiaNumero: 'Pendiente por configurar',
    titularCuenta: 'Ópalo Nails Spa',
    horaApertura: '09:00',
    horaCierre: '18:00',
  });

  const formatearHora12h = (hhmm?: string, fallback = '9:00 am') => {
    if (!hhmm) return fallback;
    const [hStr, mStr] = hhmm.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h)) return fallback;
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const mm = isNaN(m) ? '00' : String(m).padStart(2, '0');
    return `${h12}:${mm} ${ampm}`;
  };

  const horarioTexto = useMemo(() => {
    const aper = formatearHora12h(spaConfig.horaApertura, '9:00 am');
    const cier = formatearHora12h(spaConfig.horaCierre, '6:00 pm');
    return `Lun–Sáb ${aper} – ${cier}`;
  }, [spaConfig.horaApertura, spaConfig.horaCierre]);

  const [reservaConfirmada, setReservaConfirmada] = useState<{
    codigo?: string;
    empleada: string;
    servicio: string;
    fecha: string;
    hora: string;
    precio: number;
    telefono: string;
    esPreReserva?: boolean;
    esReagendamiento?: boolean;
    abonoPrevioReconocido?: number;
    montoAnticipoFijo?: number;
    porcentajeAnticipo?: number;
    anticipoRequerido?: number;
    saldoRestante?: number;
    nequi?: string;
    bancolombia?: string;
    titular?: string;
  } | null>(null);

  // Parámetro de reagendamiento desde recordatorio WhatsApp (?reagendar=<id>)
  const [reagendarId, setReagendarId] = useState<string | null>(null);
  const [citaPreviaInfo, setCitaPreviaInfo] = useState<{
    id?: string;
    fecha?: string;
    hora?: string;
    servicio?: string;
    manicurista?: string;
    abonoPrevio?: number;
    precioTotal?: number;
  } | null>(null);

  // Cargar info del spa y detectar parámetro de reagendamiento
  useEffect(() => {
    // 0. Cache instantáneo en sessionStorage para evitar layout shift o parpadeo
    try {
      const cached = sessionStorage.getItem('opalo_bootstrap');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Date.now() - (parsed._ts || 0) < 5 * 60 * 1000) {
          if (parsed.servicios && parsed.servicios.length > 0) {
            setServicios(parsed.servicios);
          }
          if (parsed.equipo && parsed.equipo.length > 0) {
            setEmpleadas(parsed.equipo.map(normalizarNombreYFotoEmpleada));
          }
          if (parsed.config) {
            setSpaConfig((prev) => ({ ...prev, ...parsed.config }));
          }
        }
      }
    } catch {}

    // 1. Carga unificada de bootstrap (equipo, servicios y configuración de anticipos en 1 solo viaje de red)
    fetch(`/api/spa/info?_t=${Date.now()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.servicios && d.servicios.length > 0) {
          setServicios(d.servicios);
        }
        if (d.equipo && d.equipo.length > 0) {
          setEmpleadas(d.equipo.map(normalizarNombreYFotoEmpleada));
        }
        if (d.config) {
          setSpaConfig((prev) => ({ ...prev, ...d.config }));
        }
        try {
          sessionStorage.setItem('opalo_bootstrap', JSON.stringify({ ...d, _ts: Date.now() }));
        } catch {}
      })
      .catch(() => {});

    try {
      const params = new URLSearchParams(window.location.search);
      const urlTel = params.get('tel') || params.get('telefono');
      if (urlTel) {
        const cleanUrlTel = urlTel.replace(/\D/g, '').replace(/^57/, '');
        setTelefono(cleanUrlTel);
      }
      const urlNombre = params.get('nombre');
      if (urlNombre) {
        setNombre(decodeURIComponent(urlNombre));
      }

      const rId = params.get('reagendar');
      if (rId) {
        setReagendarId(rId);
        fetch(`/api/reservas/${rId}`)
          .then((r) => r.json())
          .then((data) => {
            if (data && !data.error) {
              const cliente = data.clientes;
              if (cliente?.nombre) setNombre(cliente.nombre);
              if (cliente?.telefono_wa) {
                const telRaw = cliente.telefono_wa.replace(/^57/, '');
                setTelefono(telRaw);
              }
              const cancha = data.canchas;
              const fInicio = new Date(data.fecha_inicio);
              const fStr = fInicio.toLocaleDateString('es-CO', {
                timeZone: 'America/Bogota',
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              });
              const hStr = fInicio.toLocaleTimeString('es-CO', {
                timeZone: 'America/Bogota',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              });

              let svcNom = data.servicio_nombre;
              if (!svcNom && data.notas) {
                const m = data.notas.match(/Servicio:\s*([^|[\n]+)/i);
                if (m && m[1]) svcNom = m[1].trim();
              }

              // Solo tomar el abono real pagado (abono_previo viene validado desde el backend)
              const abono = Number(data.abono_previo ?? 0);

              setCitaPreviaInfo({
                id: rId,
                fecha: fStr,
                hora: hStr,
                servicio: svcNom,
                manicurista: cancha?.nombre,
                abonoPrevio: abono,
                precioTotal: Number(data.valor_total) || 0,
              });
            }
          })
          .catch(() => {});
      }
    } catch {}
  }, []);

  const slotsCacheRef = useRef<Map<string, { slots: string[]; aviso: string | null; ts: number }>>(new Map());

  const cargarSlots = async (f = fecha, emp = empleadaId, dur = duracionTotal || servicioSeleccionado?.duracion || 45) => {
    if (!f) return;

    const duracion = Math.max(15, dur);
    const cacheKey = `${f}_${emp || 'all'}_${duracion}`;
    const cached = slotsCacheRef.current.get(cacheKey);
    const ahora = Date.now();

    // Cache de 60 segundos: respuesta inmediata sin parpadeo si la clienta vuelve a tocar la misma fecha
    if (cached && ahora - cached.ts < 60000) {
      setSlots(cached.slots);
      setAvisoSlots(cached.aviso);
      setCargandoSlots(false);
      return;
    }

    setCargandoSlots(true);
    setAvisoSlots(null);

    const dObj = new Date(`${f}T12:00:00-05:00`);
    if (dObj.getDay() === 0) {
      const aviso = `Los domingos estamos cerrados. Atendemos con cariño de ${horarioTexto} ✨🌿`;
      setSlots([]);
      setAvisoSlots(aviso);
      setCargandoSlots(false);
      slotsCacheRef.current.set(cacheKey, { slots: [], aviso, ts: ahora });
      return;
    }

    try {
      // 1. Intentar endpoint en backend
      const query = new URLSearchParams({
        date: f,
        duracion_minutos: String(duracion),
      });
      if (emp) query.set('cancha_id', emp);

      const res = await fetch(`/api/spa/slots?${query.toString()}`);
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d.slots)) {
          setSlots(d.slots);
          if (d.aviso) setAvisoSlots(d.aviso);
          slotsCacheRef.current.set(cacheKey, { slots: d.slots, aviso: d.aviso || null, ts: Date.now() });
          setCargandoSlots(false);
          return;
        }
      }
    } catch {
      // Si la API falla o está en reposo, consultar directamente a Supabase
    }

    // 2. Consulta en tiempo real en Supabase (Garantiza que citas o bloqueos dejen de aparecer inmediatamente)
    try {
      const aperturaStr = spaConfig.horaApertura || '09:00';
      const cierreStr = spaConfig.horaCierre || '18:00';
      const [aperH, aperM] = aperturaStr.split(':').map(Number);
      const [cierH, cierM] = cierreStr.split(':').map(Number);
      const startMin = (isNaN(aperH) ? 9 : aperH) * 60 + (isNaN(aperM) ? 0 : aperM);
      const endMin = (isNaN(cierH) ? 18 : cierH) * 60 + (isNaN(cierM) ? 0 : cierM);

      const horasBase: string[] = [];
      for (let m = startMin; m < endMin; m += 30) {
        const hh = String(Math.floor(m / 60)).padStart(2, '0');
        const mm = String(m % 60).padStart(2, '0');
        horasBase.push(`${hh}:${mm}`);
      }

      const ahoraMs = Date.now();
      const horaCierreMs = new Date(`${f}T${cierreStr}:00-05:00`).getTime();
      const horaAperturaMs = new Date(`${f}T${aperturaStr}:00-05:00`).getTime();

      let listaEmp = empleadas;
      if (listaEmp.length === 0) {
        const { data: canchasDb } = await supabase.from('canchas').select('id, nombre').eq('activa', true);
        if (canchasDb && canchasDb.length > 0) {
          listaEmp = canchasDb;
          setEmpleadas(canchasDb);
        }
      }

      const inicioBuffer = new Date(new Date(`${f}T00:00:00-05:00`).getTime() - 6 * 60 * 60 * 1000).toISOString();
      const finBuffer = new Date(new Date(`${f}T23:59:59-05:00`).getTime() + 6 * 60 * 60 * 1000).toISOString();

      const { data: reservasOcupadas } = await supabase
        .from('reservas')
        .select('id, cancha_id, fecha_inicio, fecha_fin, estado')
        .neq('estado', 'cancelada')
        .gte('fecha_inicio', inicioBuffer)
        .lte('fecha_inicio', finBuffer);

      // Excluir la reserva previa a reprogramar para no autobloquearse
      const ocupadas = (reservasOcupadas || []).filter(
        (r) => !reagendarId || r.id !== reagendarId
      );

      // Candidatos dinámicos: horas base + puntos exactos de fin de citas previas
      const candidatosSet = new Set<string>(horasBase);
      for (const r of ocupadas) {
        if (r.fecha_fin) {
          try {
            const dFin = new Date(r.fecha_fin);
            const hhmmFin = dFin.toLocaleTimeString('es-CO', {
              timeZone: 'America/Bogota',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            });
            const finMs = new Date(`${f}T${hhmmFin}:00-05:00`).getTime();
            if (finMs >= horaAperturaMs && finMs < horaCierreMs) {
              candidatosSet.add(hhmmFin);
            }
          } catch {
            // Ignorar fecha inválida
          }
        }
      }

      const candidatosOrdenados = Array.from(candidatosSet).sort();
      const slotsLibres: string[] = [];

      for (const h of candidatosOrdenados) {
        const slotStartMs = new Date(`${f}T${h}:00-05:00`).getTime();
        const slotEndMs = slotStartMs + duracion * 60 * 1000;

        // Si es hoy y la hora ya pasó, no se puede agendar
        if (slotStartMs <= ahoraMs) {
          continue;
        }

        // Si la cita se sale del horario de cierre del spa, descartar
        if (slotEndMs > horaCierreMs) {
          continue;
        }

        // Buscar qué especialistas están ocupadas (cita agendada o bloqueo de horario)
        const ocupadasEnHora = ocupadas
          .filter((r) => {
            const rStart = new Date(r.fecha_inicio).getTime();
            const rEnd = new Date(r.fecha_fin).getTime();
            return rStart < slotEndMs && rEnd > slotStartMs;
          })
          .map((r) => r.cancha_id);

        if (emp) {
          // Si eligió especialista específica: si esa especialista está ocupada o bloqueada, NO aparece
          if (!ocupadasEnHora.includes(emp)) {
            slotsLibres.push(h);
          }
        } else {
          // Si eligió cualquiera disponible: debe haber al menos una libre
          const hayLibre = listaEmp.some((e) => !ocupadasEnHora.includes(e.id));
          if (hayLibre) {
            slotsLibres.push(h);
          }
        }
      }

      setSlots(slotsLibres);
      const avisoCalculado = slotsLibres.length === 0
        ? 'No hay horarios disponibles para esta fecha con la duración de este servicio. Prueba con otro día ✨🌿'
        : null;
      setAvisoSlots(avisoCalculado);
      slotsCacheRef.current.set(cacheKey, { slots: slotsLibres, aviso: avisoCalculado, ts: Date.now() });
    } catch (errSupabase) {
      console.error('Error calculando slots en Supabase:', errSupabase);
      setSlots([]);
      setAvisoSlots('No fue posible consultar la disponibilidad. Por favor intenta nuevamente.');
    } finally {
      setCargandoSlots(false);
    }
  };

  // Cargar slots cuando cambia la fecha, la empleada o la duración combinada total en el modal
  useEffect(() => {
    if (!modalAbierto || !fecha) return;
    setHoraSeleccionada(null);
    cargarSlots(fecha, empleadaId, duracionTotal);
  }, [modalAbierto, fecha, empleadaId, duracionTotal]);

  const abrirModal = (s: Servicio) => {
    setServicioSeleccionado(s);
    setServiciosExtras([]);
    setSelectorExtrasAbierto(false);
    setPaso(1);
    setHoraSeleccionada(null);
    setAvisoSlots(null);
    setMenuEspecialistaAbierto(false);
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setServiciosExtras([]);
    setSelectorExtrasAbierto(false);
    setPaso(1);
    setHoraSeleccionada(null);
    setReservaConfirmada(null);
    setMenuEspecialistaAbierto(false);
  };

  const esCitaDiciembre = useMemo(() => {
    if (!fecha) return false;
    const match = fecha.trim().match(/^\d{4}-(\d{2})-\d{2}/);
    return match ? match[1] === '12' : false;
  }, [fecha]);

  const exigeAnticipoEfectivo = useMemo(() => {
    return Boolean(spaConfig.exigeAnticipo || esCitaDiciembre);
  }, [spaConfig.exigeAnticipo, esCitaDiciembre]);

  const handleConfirmarReserva = async () => {
    if (!servicioSeleccionado || !fecha || !horaSeleccionada || !telefono.trim() || !nombre.trim()) return;

    setEnviandoReserva(true);

    try {
      const res = await fetch('/api/spa/reservar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          servicio_nombre: nombreServiciosCombinados,
          precio: precioTotal,
          duracion_minutos: duracionTotal,
          fecha,
          hora: horaSeleccionada,
          cancha_id: empleadaId || undefined,
          cliente_nombre: nombre.trim(),
          cliente_telefono: telefono.trim(),
          reagendar_reserva_id: reagendarId || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        try {
          supabase.channel('opalo-reservas-realtime').send({
            type: 'broadcast',
            event: 'cambio-reservas',
            payload: { eventType: 'INSERT', timestamp: Date.now() },
          }).catch(() => {});
        } catch (e) {}
        const esReag = Boolean(data.esReagendamiento || reagendarId);
        const abonoPrev = Number(data.abonoPrevio ?? citaPreviaInfo?.abonoPrevio ?? 0);
        const montoFijo = Number(data.montoAnticipoFijo ?? spaConfig.montoAnticipoFijo ?? data.porcentajeAnticipo ?? spaConfig.porcentajeAnticipo ?? 20000);
        const antTotalParaTurno = exigeAnticipoEfectivo ? Math.min(precioTotal, montoFijo) : 0;
        const antFaltanteCalc = esReag ? Math.max(0, antTotalParaTurno - abonoPrev) : antTotalParaTurno;

        const antReq = typeof data.anticipoRequerido === 'number' ? data.anticipoRequerido : antFaltanteCalc;
        const esPre = Boolean(data.esPreReserva ?? (antReq > 0));
        const salRest = typeof data.saldoRestante === 'number'
          ? data.saldoRestante
          : Math.max(0, precioTotal - abonoPrev - antReq);

        setReservaConfirmada({
          codigo: data.codigoReserva || data.reserva?.id,
          empleada: data.empleada || 'Especialista asignada',
          servicio: nombreServiciosCombinados,
          fecha,
          hora: horaSeleccionada,
          precio: precioTotal,
          telefono: telefono.trim(),
          esPreReserva: esPre,
          esReagendamiento: esReag,
          abonoPrevioReconocido: abonoPrev,
          montoAnticipoFijo: montoFijo,
          porcentajeAnticipo: montoFijo,
          anticipoRequerido: antReq,
          saldoRestante: salRest,
          nequi: data.nequiNumero || spaConfig.nequiNumero,
          bancolombia: data.bancolombiaNumero || spaConfig.bancolombiaNumero,
          titular: data.titularCuenta || spaConfig.titularCuenta,
        });
        setPaso(3);
        cargarSlots(fecha, empleadaId, duracionTotal);
      } else {
        alert(data.error || 'Ocurrió un error al agendar tu cita.');
        cargarSlots(fecha, empleadaId, duracionTotal);
      }
    } catch {
      // Fallback directo en Supabase si la API backend está temporalmente inactiva
      try {
        let cleanPhone = String(telefono.trim()).replace(/\D/g, '');
        if (cleanPhone.length === 10 && cleanPhone.startsWith('3')) {
          cleanPhone = `57${cleanPhone}`;
        }

        let clienteId: string | null = null;
        const { data: clienteExistente } = await supabase
          .from('clientes')
          .select('id')
          .eq('telefono_wa', cleanPhone)
          .maybeSingle();

        if (clienteExistente) {
          clienteId = clienteExistente.id;
        } else {
          const { data: clienteCreado } = await supabase
            .from('clientes')
            .insert({ telefono_wa: cleanPhone, nombre: nombre.trim() })
            .select('id')
            .single();
          if (clienteCreado) clienteId = clienteCreado.id;
        }

        const empAsignada = empleadas.find((e) => e.id === empleadaId) || empleadas[0];
        const dInicio = new Date(`${fecha}T${horaSeleccionada}:00-05:00`);
        const dFin = new Date(dInicio.getTime() + (Number(duracionTotal) || 60) * 60 * 1000);

        const esReag = Boolean(reagendarId);
        const abonoPrev = Number(citaPreviaInfo?.abonoPrevio || 0);
        const montoFijoFallback = Number(spaConfig.montoAnticipoFijo || spaConfig.porcentajeAnticipo || 20000);
        const antTotalFallback = exigeAnticipoEfectivo ? Math.min(precioTotal, montoFijoFallback) : 0;
        const antReqFallback = esReag ? Math.max(0, antTotalFallback - abonoPrev) : antTotalFallback;
        const esPreFallback = antReqFallback > 0;
        const salRest = Math.max(0, precioTotal - abonoPrev - antReqFallback);

        if (empAsignada && clienteId) {
          await supabase.from('reservas').insert({
            cancha_id: empAsignada.id,
            cliente_id: clienteId,
            fecha_inicio: dInicio.toISOString(),
            fecha_fin: dFin.toISOString(),
            valor_total: precioTotal,
            valor_anticipo_requerido: antReqFallback,
            estado: esPreFallback ? 'pendiente_pago' : 'confirmada',
            expiracion_reserva: esPreFallback ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null,
            notas: `💅 Servicio: ${nombreServiciosCombinados} | Duración: ${duracionTotal} min | Clienta: ${nombre.trim()} | ${esReag ? (esPreFallback ? '[CITA_REAGENDADA_PENDIENTE_ANTICIPO]' : '[CITA_REAGENDADA_CONFIRMADA]') : 'Reserva Web Ópalo Nails Spa'}`,
          });

          if (reagendarId) {
            await supabase.from('reservas').delete().eq('id', reagendarId);
          }
        }

        setReservaConfirmada({
          codigo: 'WEB-' + Math.floor(1000 + Math.random() * 9000),
          empleada: empAsignada?.nombre || 'Especialista asignada',
          servicio: nombreServiciosCombinados,
          fecha,
          hora: horaSeleccionada,
          precio: precioTotal,
          telefono: telefono.trim(),
          esPreReserva: esPreFallback,
          esReagendamiento: esReag,
          abonoPrevioReconocido: abonoPrev,
          montoAnticipoFijo: montoFijoFallback,
          porcentajeAnticipo: montoFijoFallback,
          anticipoRequerido: antReqFallback,
          saldoRestante: salRest,
          nequi: spaConfig.nequiNumero,
          bancolombia: spaConfig.bancolombiaNumero,
          titular: spaConfig.titularCuenta,
        });
        setPaso(3);
        cargarSlots(fecha, empleadaId);
      } catch (errDb) {
        console.error('Error insertando en Supabase:', errDb);
        alert('Ocurrió un error al agendar tu cita. Por favor intenta de nuevo.');
      }
    } finally {
      setEnviandoReserva(false);
    }
  };

  const serviciosFiltrados = useMemo(
    () => servicios.filter((s) => categoriaActiva === 'Todos' || s.categoria === categoriaActiva),
    [servicios, categoriaActiva]
  );

  return (
    <div className="min-h-screen bg-[#F5F8F4] text-[#1C2922] font-sans antialiased selection:bg-[#C5D6BE] selection:text-[#2E5A44] relative">
      {/* Botón superior para acceder a la administración y turnos */}
      {onIrAlAdmin && (
        <button
          onClick={onIrAlAdmin}
          className="absolute top-3 right-3 z-20 text-[10px] font-medium tracking-wide text-[#5A6B60] hover:text-[#2E5A44] bg-white/75 hover:bg-white border border-[#C5D6BE]/80 hover:border-[#C5A059] px-3 py-1.5 rounded-full shadow-2xs backdrop-blur-md transition cursor-pointer flex items-center gap-1 opacity-70 hover:opacity-100"
          title="Acceso exclusivo al panel de turnos del equipo"
        >
          <span>Portal del Equipo & Admin</span>
        </button>
      )}

      {/* HERO SECTION CON IDENTIDAD VISUAL DE ÓPALO NAILS SPA (VERDE INSTITUCIONAL + DORADO) */}
      <section className="relative text-center pt-14 pb-16 px-4 bg-gradient-to-b from-[#E8F0E5] via-[#EEF4EC] to-[#F5F8F4] overflow-hidden border-b border-[#C5D6BE]/60">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(197,160,89,0.16),transparent_70%)] pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto space-y-4">
          {/* LOGOTIPO OFICIAL DE ÓPALO NAILS SPA */}
          <div className="relative w-44 h-44 sm:w-52 sm:h-52 mx-auto rounded-full overflow-hidden shadow-lg border-2 border-[#C5A059] bg-white transition-transform hover:scale-105 duration-300">
            <img
              src="/opalo-nails-logo.png"
              alt="Ópalo Nails Spa - Uñas, Cejas y Pestañas en Pereira"
              className="w-full h-full object-cover scale-105"
            />
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-[#1C2922] tracking-tight">
            Ópalo Nails Spa
            <span className="block text-base sm:text-xl font-bold text-[#2E5A44] mt-1 font-serif">
              Uñas, Cejas y Pestañas en Pereira
            </span>
          </h1>
          <p className="text-sm sm:text-base text-[#5A6B60] max-w-md mx-auto italic font-medium leading-relaxed">
            "Realza tu belleza en manos expertas. ¡Uñas acrílicas, semipermanente, cejas y pestañas siempre impecables!"
          </p>

          <div className="flex items-center justify-center gap-2.5 pt-1 text-xs sm:text-sm font-semibold text-[#2E5A44] tracking-wide">
            <span className="w-8 sm:w-12 h-px bg-[#C5A059]" />
            <span className="flex items-center gap-1.5">
              <IconSparkles className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Reserva tu cita en segundos</span>
            </span>
            <span className="w-8 sm:w-12 h-px bg-[#C5A059]" />
          </div>
        </div>
      </section>

      {/* CONTENEDOR PRINCIPAL */}
      <main className="max-w-3xl mx-auto px-4 pb-20 -mt-6 relative z-20 space-y-8">
        {/* BANNER INFORMATIVO SI VIENE DESDE WHATSAPP PARA REAGENDAR */}
        {reagendarId && (
          <div className="bg-gradient-to-r from-[#2E5A44] via-[#224433] to-[#C5A059] text-white p-4 sm:p-5 rounded-2xl shadow-md border border-[#C5A059] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 text-xl backdrop-blur-xs">
                🔄
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <p className="font-extrabold text-sm sm:text-base">Modo Reagendamiento</p>
                  <span className="bg-emerald-500/90 text-white text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold">
                    Abono Reconocido ✓
                  </span>
                </div>
                <p className="text-xs text-emerald-50 leading-relaxed">
                  {citaPreviaInfo ? (
                    <>
                      Cita previa: <strong>{citaPreviaInfo.fecha} a las {citaPreviaInfo.hora}</strong> con {citaPreviaInfo.manicurista || 'especialista'}
                      {citaPreviaInfo.servicio ? ` (${citaPreviaInfo.servicio})` : ''}.{' '}
                      {citaPreviaInfo.abonoPrevio ? (
                        <span>Abono transferible: <strong>${citaPreviaInfo.abonoPrevio.toLocaleString('es-CO')} COP</strong>.{' '}</span>
                      ) : ''}
                    </>
                  ) : ''}
                  Elige tu nuevo horario o servicio abajo. ¡Tu abono se transfiere 100% y tu nueva cita se confirmará de inmediato sin pagar de nuevo!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* FILA DE 3 TARJETAS FLOTANTES DE INFORMACIÓN */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <a
            href={obtenerUrlMapaSpa()}
            target="_blank"
            rel="noreferrer"
            className="bg-white border border-[#C5D6BE] hover:border-[#C5A059] rounded-2xl p-4 text-center shadow-xs space-y-1 block transition group cursor-pointer hover:shadow-sm"
            title="Ubicación en Pereira, Colombia"
          >
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#C5A059] block">
              Dónde
            </span>
            <p className="text-xs font-bold text-[#1C2922] group-hover:text-[#2E5A44] flex items-center justify-center gap-1 transition">
              <IconMapPin className="w-3.5 h-3.5 text-[#C5A059] group-hover:scale-110 transition shrink-0" />
              Pereira, Risaralda
            </p>
            <p className="text-[11px] text-[#2E5A44] font-semibold flex items-center justify-center gap-1 group-hover:underline">
              <span>Ver ubicación</span>
              <span className="text-[10px]">📍</span>
            </p>
          </a>

          <div className="bg-white border border-[#C5D6BE] rounded-2xl p-4 text-center shadow-xs space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#C5A059] block">
              Horarios
            </span>
            <p className="text-xs font-bold text-[#1C2922] flex items-center justify-center gap-1">
              <IconClock className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
              {horarioTexto}
            </p>
            <p className="text-[11px] text-[#5A6B60]">Domingos cerrado</p>
          </div>

          <div className="bg-white border border-[#C5D6BE] rounded-2xl p-4 text-center shadow-xs space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#C5A059] block">
              Instagram Oficial
            </span>
            <a
              href={INSTAGRAM_OFICIAL_URL}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold text-[#2E5A44] hover:text-[#C5A059] flex items-center justify-center gap-1 transition"
            >
              <IconBrandInstagram className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
              @opalo_nailspereira ✨
            </a>
            <p className="text-[11px] text-[#5A6B60]">Síguenos y escríbenos</p>
          </div>
        </div>

        {/* SECCIÓN NUESTRO EQUIPO DE ESPECIALISTAS */}
        <section className="space-y-4">
          <div className="text-center space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-[#1C2922] flex items-center justify-center gap-2 font-serif">
              <span>Nuestro</span>
              <span className="italic text-[#C5A059] font-serif font-bold">equipo de especialistas</span>
            </h2>
            <p className="text-xs text-[#5A6B60]">
              Profesionales expertas listas para consentirte en uñas, cejas y pestañas ✨🌿
            </p>
          </div>

          <div className="flex items-center justify-center gap-3.5 sm:gap-7 overflow-x-auto pb-2 pt-1">
            {empleadas.map((emp) => {
              const foto = emp.foto || FOTOS_EQUIPO_OPALO[emp.nombre.toLowerCase()];
              const estaSeleccionada = empleadaId === emp.id;
              return (
                <div
                  key={emp.id}
                  onClick={() => {
                    setEmpleadaId(emp.id);
                  }}
                  className="text-center w-20 sm:w-24 shrink-0 space-y-1.5 group cursor-pointer transition-transform hover:-translate-y-1"
                >
                  <div
                    className={`relative w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full p-0.5 shadow-md group-hover:shadow-lg transition aspect-square shrink-0 ${
                      estaSeleccionada
                        ? 'bg-[#2E5A44] ring-2 ring-[#C5A059] ring-offset-2'
                        : 'bg-gradient-to-tr from-[#2E5A44] via-[#C5A059] to-[#90B083]'
                    }`}
                  >
                    <div className="w-full h-full bg-white rounded-full overflow-hidden flex items-center justify-center border-2 border-white aspect-square">
                      {foto ? (
                        <img
                          src={foto}
                          alt={emp.nombre}
                          className="w-full h-full object-cover object-center aspect-square group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#F5F8F4] flex flex-col items-center justify-center text-[#2E5A44] font-bold aspect-square">
                          <span className="text-xl">💅</span>
                          <span className="text-[10px] text-[#5A6B60] font-semibold">{emp.nombre}</span>
                        </div>
                      )}
                    </div>
                    <span className="absolute bottom-0 right-0 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white border border-[#C5A059] shadow-2xs flex items-center justify-center text-[9px] sm:text-[10px]">
                      ✨
                    </span>
                  </div>
                  <div>
                    <span
                      className={`text-xs sm:text-sm font-bold block leading-tight transition ${
                        estaSeleccionada ? 'text-[#2E5A44]' : 'text-[#1C2922] group-hover:text-[#2E5A44]'
                      }`}
                    >
                      {emp.nombre}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECCIÓN ELIGE TU SERVICIO + CATEGORÍAS */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-[#1C2922] flex items-center justify-center gap-1.5">
            <span>Elige tu</span>
            <span className="italic text-[#C5A059] font-serif font-bold">servicio</span>
          </h2>

          {/* Chips de Categorías con Scroll Horizontal */}
          <div className="sticky top-0 z-20 bg-[#F5F8F4]/95 backdrop-blur-md py-2 -mx-4 px-4 flex gap-2 overflow-x-auto border-b border-[#C5D6BE]/70 scrollbar-none">
            {CATEGORIAS.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoriaActiva(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  categoriaActiva === cat
                    ? 'bg-[#2E5A44] text-white shadow-xs border border-[#C5A059]'
                    : 'bg-white border border-[#C5D6BE] text-[#5A6B60] hover:border-[#C5A059]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Lista de Servicios */}
          <div className="space-y-3">
            {serviciosFiltrados.map((s) => (
              <div
                key={s.id}
                className="bg-white border border-[#C5D6BE] hover:border-[#C5A059] rounded-2xl p-4 shadow-xs transition hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm sm:text-base text-[#1C2922]">
                      {s.nombre}
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8F0E5] text-[#2E5A44] border border-[#C5D6BE]">
                      {formatearDuracion(s.duracion)}
                    </span>
                  </div>
                  <p className="text-xs text-[#5A6B60] max-w-md leading-relaxed">
                    {s.descripcion}
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E8F0E5]">
                  <span className="text-base font-extrabold text-[#2E5A44] font-mono">
                    ${s.precio.toLocaleString('es-CO')}
                  </span>
                  <button
                    onClick={() => abrirModal(s)}
                    className="px-4 py-2 bg-[#2E5A44] hover:bg-[#224433] text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer border border-[#C5A059]/40"
                  >
                    <span>Agendar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECCIÓN SEO LOCAL: POR QUÉ ELEGIRNOS EN PEREIRA */}
        <section className="mt-14 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#1C2922]">
              Ópalo Nails Spa · Uñas, Cejas y Pestañas en Pereira
            </h2>
            <p className="text-xs sm:text-sm text-[#5A6B60] max-w-xl mx-auto">
              En <strong className="text-[#2E5A44]">Ópalo Nails Spa</strong> cuidamos cada detalle de tus manos, pies y mirada con insumos de alta gama y técnicas profesionales en Pereira, Colombia.
            </p>
          </div>

          {/* TARJETAS DE VALOR SEO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-4 rounded-2xl bg-white/80 border border-[#C5D6BE] shadow-xs space-y-1.5">
              <div className="flex items-center gap-2 text-[#2E5A44] font-bold text-sm">
                <IconSparkles className="w-4 h-4 text-[#C5A059]" />
                <h3>Expertas en Uñas, Cejas y Pestañas</h3>
              </div>
              <p className="text-xs text-[#5A6B60] leading-relaxed">
                Uñas acrílicas esculpidas y con tip, sistema Press On, Base Rubber, Dipping, laminado de cejas, lifting y extensiones de pestañas pelo a pelo y volumen ruso.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/80 border border-[#C5D6BE] shadow-xs space-y-1.5">
              <div className="flex items-center gap-2 text-[#2E5A44] font-bold text-sm">
                <IconCheck className="w-4 h-4 text-emerald-600" />
                <h3>Bioseguridad y Esterilización 100%</h3>
              </div>
              <p className="text-xs text-[#5A6B60] leading-relaxed">
                Herramientas desinfectadas y esterilizadas rigurosamente bajo protocolos de grado hospitalario para garantizar tu seguridad y bienestar.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/80 border border-[#C5D6BE] shadow-xs space-y-1.5">
              <div className="flex items-center gap-2 text-[#2E5A44] font-bold text-sm">
                <IconCalendar className="w-4 h-4 text-[#2E5A44]" />
                <h3>Citas Online Inmediatas</h3>
              </div>
              <p className="text-xs text-[#5A6B60] leading-relaxed">
                Agenda tu cita 24/7 en segundos sin esperas. Elige tu especialista, combina servicios de uñas, cejas y pestañas y selecciona tu horario ideal.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/80 border border-[#C5D6BE] shadow-xs space-y-1.5">
              <div className="flex items-center gap-2 text-[#2E5A44] font-bold text-sm">
                <IconMapPin className="w-4 h-4 text-[#C5A059]" />
                <h3>Experiencia Exclusiva en Pereira</h3>
              </div>
              <p className="text-xs text-[#5A6B60] leading-relaxed">
                Ambiente acogedor, atención puntual y resultados duraderos en Pereira, Risaralda. Síguenos en Instagram como @opalo_nailspereira.
              </p>
            </div>
          </div>

          {/* PREGUNTAS FRECUENTES (FAQ ACORDION - SEO RICH SNIPPETS) */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white/90 border border-[#C5D6BE] shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <IconSparkles className="w-5 h-5 text-[#C5A059]" />
              <h3 className="text-base sm:text-lg font-extrabold text-[#1C2922]">
                Preguntas Frecuentes · Ópalo Nails Spa Pereira
              </h3>
            </div>

            <div className="divide-y divide-[#E8F0E5]">
              {[
                {
                  id: 1,
                  q: "¿Qué servicios ofrecen en Ópalo Nails Spa en Pereira?",
                  a: "Ofrecemos servicios integrales de Uñas (manicura y pedicura tradicional y semipermanente, recubrimiento en acrílico, sistema Press On, acrílicas con tip o esculpidas, Base Ruber, Dipping + Semi) y Cejas y Pestañas (depilación con cera o hilo, henna, laminado de cejas, lifting de pestañas y extensiones de pestañas pelo a pelo clásicas, efecto pestañina, híbridas, 3D, volumen ruso y volumen brasileño)."
                },
                {
                  id: 2,
                  q: "¿Cómo puedo agendar varios servicios en una misma cita?",
                  a: "Al tocar el botón 'Agendar' en tu servicio principal, verás la opción '+ Agregar otro servicio'. El sistema sumará automáticamente el tiempo y el valor total para apartar tu espacio completo."
                },
                {
                  id: 3,
                  q: "¿Cuál es la política de retoque de pestañas y uñas acrílicas?",
                  a: "Para extensiones de pestañas, realizamos retoques desde $40.000 hasta $60.000 según el diseño (pasados los 20 días tiene un adicional de $5.000 a $10.000). El retoque de acrílico o Press On ($65.000) incluye la reposición de 1 uña perdida."
                },
                {
                  id: 4,
                  q: "¿Cómo confirmo o reprogramo mi cita?",
                  a: "Recibirás un comprobante inmediato en tu WhatsApp al reservar y un recordatorio automático 1 día antes de tu cita con enlace directo para confirmar o reagendar."
                }
              ].map(faq => (
                <div key={faq.id} className="py-3">
                  <button
                    onClick={() => setFaqAbierto(faqAbierto === faq.id ? null : faq.id)}
                    className="w-full flex items-center justify-between text-left gap-3 text-xs sm:text-sm font-bold text-[#1C2922] hover:text-[#2E5A44] transition cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <span className="text-[#C5A059] shrink-0 font-bold text-base">
                      {faqAbierto === faq.id ? '−' : '+'}
                    </span>
                  </button>
                  <p
                    className={
                      faqAbierto === faq.id
                        ? 'mt-2 text-xs text-[#5A6B60] leading-relaxed pl-1 border-l-2 border-[#C5A059]'
                        : 'hidden'
                    }
                  >
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>

            {/* CAJA MAPS & CONTACTO */}
            <div className="pt-3 border-t border-[#E8F0E5] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#5A6B60]">
              <div className="flex items-center gap-1.5">
                <IconMapPin className="w-4 h-4 text-[#2E5A44] shrink-0" />
                <span>Pereira, Risaralda, Colombia</span>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={INSTAGRAM_OFICIAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-[#2E5A44] hover:text-[#C5A059] hover:underline flex items-center gap-1"
                  title="Instagram @opalo_nailspereira"
                >
                  <IconBrandInstagram className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>@opalo_nailspereira</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="text-center py-8 text-xs text-[#5A6B60] border-t border-[#C5D6BE]/60 space-y-2.5">
        <p className="font-semibold text-[#2E5A44] text-sm tracking-wide">
          Ópalo Nails Spa ✦
        </p>
        <div className="flex items-center justify-center">
          <a
            href={INSTAGRAM_OFICIAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#C5D6BE] hover:border-[#C5A059] text-[#2E5A44] hover:text-[#C5A059] font-semibold text-xs transition-all shadow-xs hover:shadow-sm group cursor-pointer"
            title="Síguenos en Instagram @opalo_nailspereira"
          >
            <IconBrandInstagram className="w-4 h-4 text-[#C5A059] group-hover:scale-110 transition-transform" />
            <span>@opalo_nailspereira</span>
            <span className="text-[10px] text-[#5A6B60] group-hover:text-[#C5A059] transition-colors">↗</span>
          </a>
        </div>
        <p className="text-[11px] opacity-80">
          {horarioTexto} · Pereira, Colombia
        </p>
      </footer>

      {/* MODAL BOTTOM SHEET DE RESERVA */}
      <AnimatePresence>
        {modalAbierto && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="bg-[#F5F8F4] border border-[#C5D6BE] w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
            >
              {/* Header Modal */}
              <div className="p-4 sm:p-5 border-b border-[#C5D6BE] bg-white flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold tracking-widest uppercase text-[#C5A059] block">
                    {paso === 3 ? '¡Listo!' : `Paso ${paso} de 2`}
                  </span>
                  <h3 className="font-bold text-sm sm:text-base text-[#1C2922]">
                    {servicioSeleccionado?.nombre}
                  </h3>
                </div>
                <button
                  onClick={cerrarModal}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                >
                  <IconX className="w-5 h-5" />
                </button>
              </div>

              {/* Contenido según el paso */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-5">
                {/* PASO 1: SELECCIÓN DE FECHA Y HORARIO */}
                {paso === 1 && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-lg font-bold text-[#1C2922] flex items-center gap-1.5">
                        <span>¿Cuándo te</span>
                        <span className="italic text-[#C5A059] font-serif font-bold">esperamos?</span>
                      </h2>
                      <p className="text-xs text-[#5A6B60]">
                        Elige tu especialista, servicios adicionales y fecha deseada ✨
                      </p>
                    </div>

                    {/* SECCIÓN SERVICIOS EXTRA / ADICIONALES */}
                    <div className="bg-[#F5F8F4] border-2 border-[#C5D6BE] rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xs">
                      {/* Cabecera y Servicios seleccionados (intercambiado arriba) */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm sm:text-base font-extrabold text-[#2E5A44] flex items-center gap-2">
                            <span className="text-lg">✨</span>
                            <span>Servicios en tu cita</span>
                            <span className="bg-[#E8F0E5] text-[#2E5A44] text-xs font-black px-2.5 py-0.5 rounded-full border border-[#C5D6BE]">
                              {todosLosServicios.length}
                            </span>
                          </span>
                        </div>

                        {/* Chips de servicios ya seleccionados (arriba donde antes estaba el botón) */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {/* Principal */}
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-[#C5D6BE] text-[#1C2922] rounded-xl text-xs sm:text-sm font-semibold shadow-xs">
                            <span className="text-[#C5A059]">✨</span>
                            <span className="font-bold">{servicioSeleccionado?.nombre}</span>
                            <span className="text-xs text-[#5A6B60] font-medium bg-[#F5F8F4] px-2 py-0.5 rounded-md border border-[#C5D6BE]/60">
                              {formatearDuracion(servicioSeleccionado?.duracion || 60)} · ${servicioSeleccionado?.precio.toLocaleString('es-CO')}
                            </span>
                          </div>

                          {/* Extras */}
                          {serviciosExtras.map((extra) => (
                            <div
                              key={extra.id}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#E8F0E5] border border-[#C5A059]/40 text-[#2E5A44] rounded-xl text-xs sm:text-sm font-semibold shadow-xs animate-in fade-in duration-200"
                            >
                              <span className="font-bold">+</span>
                              <span className="font-bold">{extra.nombre}</span>
                              <span className="text-xs text-[#2E5A44]/80 font-medium bg-white/80 px-2 py-0.5 rounded-md border border-[#C5D6BE]">
                                +{extra.duracion} min · +${extra.precio.toLocaleString('es-CO')}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleServicioExtra(extra)}
                                className="w-5 h-5 rounded-full bg-white/80 hover:bg-red-50 text-[#2E5A44] hover:text-red-700 font-bold flex items-center justify-center text-xs transition cursor-pointer ml-1"
                                title="Eliminar este servicio"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Botón para agregar otro servicio (intercambiado en la posición principal de servicios) */}
                      <button
                        type="button"
                        onClick={() => setSelectorExtrasAbierto(!selectorExtrasAbierto)}
                        className={`w-full py-3 px-4 rounded-xl font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer border-2 ${
                          selectorExtrasAbierto
                            ? 'bg-[#2E5A44] text-white border-[#2E5A44] shadow-sm'
                            : 'bg-white hover:bg-[#E8F0E5] text-[#2E5A44] border-[#C5D6BE] hover:border-[#2E5A44]'
                        }`}
                      >
                        <span className="text-lg leading-none font-extrabold">+</span>
                        <span className="tracking-wide">Agregar otro servicio</span>
                        <IconChevronDown
                          className={`w-4 h-4 transition-transform duration-200 ${
                            selectorExtrasAbierto ? 'rotate-180 text-white' : 'text-[#2E5A44]'
                          }`}
                        />
                      </button>

                      {/* Selector desplegable de extras */}
                      <AnimatePresence>
                        {selectorExtrasAbierto && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-white border-2 border-[#C5D6BE] rounded-2xl p-2.5 max-h-60 overflow-y-auto space-y-2 shadow-md"
                          >
                            <p className="text-xs font-bold text-[#5A6B60] px-2 py-1">
                              Toca para agregar o quitar servicios adicionales a tu cita:
                            </p>
                            {servicios
                              .filter((s) => s.id !== servicioSeleccionado?.id)
                              .map((s) => {
                                const yaAgregado = serviciosExtras.some((x) => x.id === s.id);
                                return (
                                  <div
                                    key={s.id}
                                    onClick={() => toggleServicioExtra(s)}
                                    className={`p-3 rounded-xl flex items-center justify-between text-sm cursor-pointer transition border ${
                                      yaAgregado
                                        ? 'bg-[#E8F0E5] border-[#2E5A44] text-[#2E5A44] font-bold shadow-2xs'
                                        : 'hover:bg-[#F5F8F4] border-transparent hover:border-[#C5D6BE] text-[#1C2922]'
                                    }`}
                                  >
                                    <div>
                                      <p className="font-bold text-sm sm:text-base text-[#1C2922]">{s.nombre}</p>
                                      <p className="text-xs text-[#5A6B60]">
                                        {s.categoria} · {s.duracion} min
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="font-mono font-bold text-sm sm:text-base text-[#2E5A44]">
                                        +${s.precio.toLocaleString('es-CO')}
                                      </span>
                                      <span
                                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm transition ${
                                          yaAgregado
                                            ? 'bg-[#2E5A44] text-white shadow-xs'
                                            : 'bg-white border-2 border-[#C5D6BE] text-[#5A6B60]'
                                        }`}
                                      >
                                        {yaAgregado ? '✓' : '+'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Barra de Total en Vivo */}
                      <div className="pt-3 border-t border-[#C5D6BE] flex items-center justify-between text-xs sm:text-sm">
                        <span className="text-[#5A6B60] font-bold text-xs sm:text-sm">
                          Total estimado de tu cita:
                        </span>
                        <div className="flex items-center gap-3 sm:gap-4 font-bold">
                          <span className="text-[#1C2922] flex items-center gap-1.5 font-mono text-xs sm:text-sm bg-white px-2.5 py-1 rounded-lg border border-[#C5D6BE]">
                            <IconClock className="w-4 h-4 text-[#C5A059]" />
                            {formatearDuracion(duracionTotal)}
                          </span>
                          <span className="text-[#2E5A44] font-mono text-base sm:text-lg font-black">
                            ${precioTotal.toLocaleString('es-CO')} COP
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 relative">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A6B60] block">
                        Especialista
                      </label>
                      <button
                        type="button"
                        onClick={() => setMenuEspecialistaAbierto(!menuEspecialistaAbierto)}
                        className="w-full bg-white border border-[#C5D6BE] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#1C2922] flex items-center justify-between hover:border-[#C5A059] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 transition shadow-xs cursor-pointer text-left"
                      >
                        <span className="truncate flex items-center gap-2">
                          {(() => {
                            const empSel = empleadas.find((e) => e.id === empleadaId);
                            if (!empSel) return <span>Cualquiera disponible (Recomendado)</span>;
                            const foto = empSel.foto || FOTOS_EQUIPO_OPALO[empSel.nombre.toLowerCase()];
                            return (
                              <>
                                {foto ? (
                                  <img src={foto} alt={empSel.nombre} className="w-5 h-5 rounded-full object-cover border border-[#C5D6BE] shrink-0" />
                                ) : (
                                  <span>✨</span>
                                )}
                                <span>{empSel.nombre}</span>
                              </>
                            );
                          })()}
                        </span>
                        <IconChevronDown
                          className={`w-4 h-4 text-[#C5A059] shrink-0 transition-transform duration-200 ${
                            menuEspecialistaAbierto ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      <AnimatePresence>
                        {menuEspecialistaAbierto && (
                          <motion.div
                            initial={{ opacity: 0, y: -4, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.98 }}
                            transition={{ duration: 0.15 }}
                            className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#C5D6BE] rounded-xl shadow-lg z-30 py-1.5 max-h-48 overflow-y-auto"
                          >
                            <div
                              onClick={() => {
                                setEmpleadaId('');
                                setMenuEspecialistaAbierto(false);
                              }}
                              className={`px-3 py-2 text-xs flex items-center justify-between cursor-pointer transition ${
                                !empleadaId
                                  ? 'bg-[#E8F0E5] text-[#2E5A44] font-bold'
                                  : 'hover:bg-[#F5F8F4] text-[#1C2922]'
                              }`}
                            >
                              <span>Cualquiera disponible (Recomendado)</span>
                              {!empleadaId && <IconCheck className="w-4 h-4 text-[#2E5A44]" />}
                            </div>
                            {empleadas.map((emp) => {
                              const sel = empleadaId === emp.id;
                              const foto = emp.foto || FOTOS_EQUIPO_OPALO[emp.nombre.toLowerCase()];
                              return (
                                <div
                                  key={emp.id}
                                  onClick={() => {
                                    setEmpleadaId(emp.id);
                                    setMenuEspecialistaAbierto(false);
                                  }}
                                  className={`px-3 py-2 text-xs flex items-center justify-between cursor-pointer transition ${
                                    sel
                                      ? 'bg-[#E8F0E5] text-[#2E5A44] font-bold'
                                      : 'hover:bg-[#F5F8F4] text-[#1C2922]'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    {foto ? (
                                      <img src={foto} alt={emp.nombre} className="w-6 h-6 rounded-full object-cover border border-[#C5D6BE] shrink-0" />
                                    ) : (
                                      <span className="w-6 h-6 rounded-full bg-[#F5F8F4] text-[#2E5A44] text-xs flex items-center justify-center shrink-0">✨</span>
                                    )}
                                    <span>{emp.nombre}</span>
                                  </div>
                                  {sel && <IconCheck className="w-4 h-4 text-[#2E5A44]" />}
                                </div>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Selector de fecha responsive con atajos y calendario nativo */}
                    <div className="space-y-2 relative" ref={contenedorCalendarioRef}>
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A6B60] block">
                          Fecha
                        </label>
                        <span className="text-[10px] text-[#C5A059] font-medium hidden sm:inline">
                          Toca para cambiar de día
                        </span>
                      </div>

                      {/* Botón interactivo táctil para abrir/cerrar calendario */}
                      <button
                        type="button"
                        onClick={() => setCalendarioAbierto((prev) => !prev)}
                        className={`w-full bg-white border rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#1C2922] flex items-center justify-between shadow-xs transition cursor-pointer active:scale-[0.99] ${
                          calendarioAbierto
                            ? 'border-[#2E5A44] ring-2 ring-[#C5A059]/20'
                            : 'border-[#C5D6BE] hover:border-[#C5A059]'
                        }`}
                        aria-label="Seleccionar fecha"
                        aria-expanded={calendarioAbierto}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <IconCalendar className="w-4 h-4 text-[#C5A059] shrink-0" />
                          <span className="font-bold text-[#1C2922] truncate capitalize">
                            {formatearFechaElegante(fecha)}
                          </span>
                        </div>
                        <IconChevronDown
                          className={`w-4 h-4 text-[#5A6B60] shrink-0 transition-transform duration-200 ${
                            calendarioAbierto ? 'rotate-180 text-[#2E5A44]' : ''
                          }`}
                        />
                      </button>

                      {/* Dropdown de Calendario con los tonos oficiales de Ópalo Nails Spa */}
                      <AnimatePresence>
                        {calendarioAbierto && (
                          <motion.div
                            initial={{ opacity: 0, y: -6, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.98 }}
                            transition={{ duration: 0.15 }}
                            className="absolute top-full left-0 right-0 sm:left-auto sm:right-auto sm:w-[350px] mt-2 bg-white/98 backdrop-blur-md border border-[#C5D6BE] rounded-2xl shadow-2xl z-50 p-4 space-y-3"
                          >
                            {/* Cabecera del mes y controles */}
                            <div className="flex items-center justify-between pb-2 border-b border-[#E8F0E5]">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-[#E8F0E5] text-[#2E5A44] flex items-center justify-center">
                                  <IconCalendar className="w-4 h-4 text-[#C5A059]" />
                                </div>
                                <span className="font-serif font-bold text-sm text-[#1C2922] capitalize">
                                  {nombreMesAño}
                                </span>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => cambiarMes(-1)}
                                  disabled={!puedeIrMesAnterior}
                                  className={`p-1.5 rounded-lg transition ${
                                    puedeIrMesAnterior
                                      ? 'hover:bg-[#E8F0E5] text-[#2E5A44] cursor-pointer active:scale-95'
                                      : 'text-gray-300 cursor-not-allowed'
                                  }`}
                                  title="Mes anterior"
                                >
                                  <IconChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={irAHoy}
                                  className="px-2 py-1 text-[10px] font-bold text-[#2E5A44] bg-[#E8F0E5] hover:bg-[#2E5A44] hover:text-white rounded-md transition cursor-pointer"
                                  title="Ir al día de hoy"
                                >
                                  Hoy
                                </button>
                                <button
                                  type="button"
                                  onClick={() => cambiarMes(1)}
                                  className="p-1.5 rounded-lg hover:bg-[#E8F0E5] text-[#2E5A44] transition cursor-pointer active:scale-95"
                                  title="Siguiente mes"
                                >
                                  <IconChevronRight className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Días de la semana */}
                            <div className="grid grid-cols-7 text-center text-[10px] font-extrabold uppercase tracking-wider text-[#5A6B60]">
                              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d, idx) => (
                                <div
                                  key={d}
                                  className={`py-1 ${idx === 6 ? 'text-[#C5A059]' : ''}`}
                                >
                                  {d}
                                </div>
                              ))}
                            </div>

                            {/* Cuadrícula de fechas */}
                            <div className="grid grid-cols-7 gap-1">
                              {diasCalendario.map((d, idx) => {
                                if (d.tipo === 'prev' || d.tipo === 'next') {
                                  return (
                                    <div
                                      key={`filler-${idx}`}
                                      className="h-9 flex items-center justify-center text-xs text-slate-300 font-medium select-none"
                                    >
                                      {d.diaNum}
                                    </div>
                                  );
                                }

                                const esPasado = d.iso < hoyStr;
                                const esSeleccionado = d.iso === fecha;
                                const esHoy = d.iso === hoyStr;
                                const esDomingo = d.dayOfWeek === 0;

                                return (
                                  <button
                                    key={d.iso}
                                    type="button"
                                    disabled={esPasado}
                                    onClick={() => {
                                      setFecha(d.iso);
                                      setCalendarioAbierto(false);
                                    }}
                                    className={`relative h-9 w-full rounded-xl flex flex-col items-center justify-center text-xs transition cursor-pointer ${
                                      esSeleccionado
                                        ? 'bg-gradient-to-tr from-[#2E5A44] to-[#C5A059] text-white font-extrabold shadow-sm scale-105 z-10'
                                        : esPasado
                                        ? 'text-gray-300 cursor-not-allowed opacity-35'
                                        : esDomingo
                                        ? 'text-slate-400 hover:bg-slate-50 border border-dashed border-slate-200'
                                        : 'text-[#1C2922] hover:bg-[#E8F0E5] hover:text-[#2E5A44] font-semibold'
                                    } ${
                                      esHoy && !esSeleccionado
                                        ? 'border border-[#C5A059] text-[#2E5A44] bg-[#F5F8F4] font-bold'
                                        : ''
                                    }`}
                                    title={esDomingo ? 'Domingo (Cerrado)' : d.iso}
                                  >
                                    <span className="leading-none">{d.diaNum}</span>
                                    {esDomingo && !esSeleccionado && (
                                      <span className="text-[7px] leading-none text-slate-400 mt-0.5">cerrado</span>
                                    )}
                                    {esHoy && !esSeleccionado && !esDomingo && (
                                      <span className="w-1 h-1 rounded-full bg-[#C5A059] mt-0.5" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Pie de leyenda */}
                            <div className="pt-2 border-t border-[#E8F0E5] flex items-center justify-between text-[11px] text-[#5A6B60]">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-[#C5A059]" />
                                <span>Lun–Sáb disponible</span>
                              </div>
                              <span className="text-[10px] text-slate-400 italic">Domingos cerrado ✨</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Píldoras rápidas de fechas (scroll horizontal) */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-0.5 px-0.5">
                        {diasRapidos.map((d) => {
                          const activa = fecha === d.iso;
                          return (
                            <button
                              key={d.iso}
                              type="button"
                              onClick={() => setFecha(d.iso)}
                              className={`shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center min-w-[54px] cursor-pointer border ${
                                activa
                                  ? 'bg-[#2E5A44] text-white border-[#2E5A44] shadow-xs'
                                  : d.esDomingo
                                  ? 'bg-slate-50 text-slate-400 border-slate-200 opacity-60'
                                  : 'bg-white text-[#1C2922] border-[#C5D6BE] hover:border-[#C5A059]'
                              }`}
                              title={d.esDomingo ? 'Domingo cerrado' : d.label}
                            >
                              <span className="text-[10px] uppercase font-extrabold tracking-wider leading-none">
                                {d.diaSemana}
                              </span>
                              <span className="text-sm font-bold leading-tight mt-0.5">
                                {d.diaNum}
                              </span>
                              {d.esDomingo && (
                                <span className="text-[8px] font-normal leading-none mt-0.5">
                                  Cerrado
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Grid de Horarios */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A6B60] block">
                        Horarios Disponibles ({horarioTexto})
                      </label>

                      {cargandoSlots ? (
                        <div className="py-8 text-center text-xs text-[#5A6B60] flex items-center justify-center gap-2">
                          <IconLoader2 className="w-4 h-4 animate-spin text-[#C5A059]" />
                          <span>Consultando horarios libres...</span>
                        </div>
                      ) : avisoSlots ? (
                        <div className="p-4 bg-white border border-[#C5D6BE] rounded-xl text-center text-xs text-[#2E5A44] font-medium">
                          {avisoSlots}
                        </div>
                      ) : slots.length === 0 ? (
                        <div className="p-4 bg-white border border-[#C5D6BE] rounded-xl text-center text-xs text-[#5A6B60]">
                          No hay turnos disponibles para esta fecha.
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {slots.map((s) => (
                            <button
                              key={s}
                              onClick={() => setHoraSeleccionada(s)}
                              className={`py-2.5 sm:py-2 text-xs font-bold rounded-xl border transition cursor-pointer text-center ${
                                horaSeleccionada === s
                                  ? 'bg-[#2E5A44] text-white border-[#2E5A44] shadow-xs'
                                  : 'bg-white border-[#C5D6BE] text-[#1C2922] hover:border-[#C5A059]'
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Botón continuar */}
                    <div className="pt-2">
                      <button
                        disabled={!horaSeleccionada}
                        onClick={() => setPaso(2)}
                        className="w-full py-3 bg-[#2E5A44] hover:bg-[#224433] disabled:opacity-40 text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer"
                      >
                        Continuar
                      </button>
                    </div>
                  </div>
                )}

                {/* PASO 2: TUS DATOS */}
                {paso === 2 && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-lg font-bold text-[#1C2922] flex items-center gap-1.5">
                        <span>Tus</span>
                        <span className="italic text-[#C5A059] font-serif font-bold">datos</span>
                      </h2>
                      <p className="text-xs text-[#5A6B60]">
                        {nombreServiciosCombinados} · {formatearDuracion(duracionTotal)} · {fecha} · {horaSeleccionada}
                      </p>
                    </div>

                    {/* Resumen de servicios en Step 2 */}
                    <div className="bg-[#F5F8F4] border border-[#C5D6BE] rounded-2xl p-3 text-xs space-y-1.5">
                      <span className="text-[11px] font-bold text-[#2E5A44] block">Resumen de tu cita:</span>
                      <div className="space-y-1">
                        {todosLosServicios.map((s) => (
                          <div key={s.id} className="flex justify-between items-center text-[11px] text-[#1C2922]">
                            <span>✨ {s.nombre} ({formatearDuracion(s.duracion)})</span>
                            <span className="font-mono font-semibold">${s.precio.toLocaleString('es-CO')}</span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-[#C5D6BE] pt-1.5 flex justify-between items-center font-bold text-xs">
                        <span className="text-[#1C2922]">Total ({formatearDuracion(duracionTotal)}):</span>
                        <span className="text-[#2E5A44] font-mono">${precioTotal.toLocaleString('es-CO')} COP</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A6B60] block">
                          WhatsApp de contacto
                        </label>
                        <input
                          type="tel"
                          maxLength={15}
                          autoComplete="tel"
                          placeholder="300 123 4567"
                          value={telefono}
                          onChange={(e) => setTelefono(e.target.value)}
                          className="w-full bg-white border border-[#C5D6BE] rounded-xl px-3 py-2 text-base sm:text-xs font-semibold text-[#1C2922] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A6B60] block">
                          Nombre completo
                        </label>
                        <input
                          type="text"
                          maxLength={70}
                          autoComplete="name"
                          placeholder="Tu nombre y apellido"
                          value={nombre}
                          onChange={(e) => setNombre(e.target.value)}
                          className="w-full bg-white border border-[#C5D6BE] rounded-xl px-3 py-2 text-base sm:text-xs font-semibold text-[#1C2922] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20"
                        />
                      </div>
                    </div>

                    {/* Aviso de cobro o anticipo */}
                    {reagendarId ? (
                      <div className="bg-[#E8F0E5] border border-[#C5D6BE] rounded-2xl p-4 space-y-3 text-xs">
                        <div className="flex items-center gap-1.5 text-[#2E5A44] font-bold">
                          <span className="text-base">🔄</span>
                          <span>
                            {Number(citaPreviaInfo?.abonoPrevio || 0) > 0
                              ? 'Reagendamiento: Tu abono previo queda reconocido'
                              : 'Reagendamiento de Cita'}
                          </span>
                        </div>

                        {(() => {
                          const prec = precioTotal;
                          const abono = Number(citaPreviaInfo?.abonoPrevio || 0);
                          const montoFijo = Number(spaConfig.montoAnticipoFijo || spaConfig.porcentajeAnticipo || 20000);
                          const anticipoTotalRequerido = exigeAnticipoEfectivo ? Math.min(prec, montoFijo) : 0;
                          const anticipoFaltante = Math.max(0, anticipoTotalRequerido - abono);
                          const saldo = Math.max(0, prec - abono - anticipoFaltante);
                          const mismoServicio = citaPreviaInfo?.servicio &&
                            citaPreviaInfo.servicio.toLowerCase().trim() === (servicioSeleccionado?.nombre || '').toLowerCase().trim();

                          if (anticipoFaltante > 0) {
                            return (
                              <div className="space-y-3">
                                {esCitaDiciembre && (
                                  <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold flex items-center gap-1.5">
                                    <span>🎄</span>
                                    <span>
                                      {abono === 0
                                        ? 'Temporada de Diciembre: Como tu cita previa no tenía abono, se requiere transferir el anticipo para apartar tu turno en diciembre (30 min).'
                                        : `Temporada de Diciembre: Se reconoce tu abono previo de $${abono.toLocaleString('es-CO')}. Para tu cita de diciembre debes transferir la diferencia de $${anticipoFaltante.toLocaleString('es-CO')}.`}
                                    </span>
                                  </div>
                                )}

                                <div className="grid grid-cols-3 gap-2 text-center font-medium">
                                  <div className="bg-white p-2 rounded-xl border border-[#C5D6BE]">
                                    <span className="text-[10px] text-[#5A6B60] uppercase font-bold tracking-wider block">
                                      Servicio
                                    </span>
                                    <span className="font-extrabold text-[#1C2922] text-xs font-mono">
                                      ${prec.toLocaleString('es-CO')}
                                    </span>
                                  </div>
                                  <div className="bg-white p-2 rounded-xl border border-amber-300 bg-amber-50/50">
                                    <span className="text-[10px] text-amber-900 uppercase font-bold tracking-wider block">
                                      Anticipo Req.
                                    </span>
                                    <span className="font-extrabold text-[#2E5A44] text-xs font-mono">
                                      ${anticipoFaltante.toLocaleString('es-CO')}
                                    </span>
                                  </div>
                                  <div className="bg-white p-2 rounded-xl border border-[#C5D6BE]">
                                    <span className="text-[10px] text-[#5A6B60] uppercase font-bold tracking-wider block">
                                      En el Spa
                                    </span>
                                    <span className="font-extrabold text-[#5A6B60] text-xs font-mono">
                                      ${saldo.toLocaleString('es-CO')}
                                    </span>
                                  </div>
                                </div>

                                {/* Cuentas de recaudo para el anticipo faltante */}
                                <div className="p-3 bg-white rounded-xl border border-[#C5D6BE] space-y-2">
                                  <div className="flex items-center justify-between text-[#2E5A44] font-bold text-[11px]">
                                    <span>Cuentas oficiales para el abono:</span>
                                    <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                                      Ventana de 30 min
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                                    <div className="p-2 bg-[#F5F8F4] rounded-lg border border-[#C5D6BE] flex justify-between items-center">
                                      <span className="text-[#5A6B60]">📲 Nequi:</span>
                                      <strong className="text-[#1C2922] select-all">{spaConfig.nequiNumero || 'Pendiente por configurar'}</strong>
                                    </div>
                                    <div className="p-2 bg-[#F5F8F4] rounded-lg border border-[#C5D6BE] flex justify-between items-center">
                                      <span className="text-[#5A6B60]">🏦 Bancolombia:</span>
                                      <strong className="text-[#1C2922] select-all">{spaConfig.bancolombiaNumero || 'Pendiente por configurar'}</strong>
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-[#5A6B60] italic">
                                    Titular: <strong>{spaConfig.titularCuenta || 'Ópalo Nails Spa'}</strong> · Tu nuevo turno se apartará por 30 min mientras envías el comprobante por WhatsApp.
                                  </p>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-2">
                              <div className="grid grid-cols-3 gap-2 text-center font-medium">
                                <div className="bg-white p-2 rounded-xl border border-[#C5D6BE]">
                                  <span className="text-[10px] text-[#5A6B60] uppercase font-bold tracking-wider block">
                                    Nuevo Servicio
                                  </span>
                                  <span className="font-extrabold text-[#1C2922] text-xs font-mono">
                                    ${prec.toLocaleString('es-CO')}
                                  </span>
                                </div>
                                <div className="bg-white p-2 rounded-xl border border-emerald-200">
                                  <span className="text-[10px] text-emerald-700 uppercase font-bold tracking-wider block">
                                    {abono > 0 ? 'Abono Previo ✓' : 'Abono Previo'}
                                  </span>
                                  <span className="font-extrabold text-emerald-600 text-xs font-mono">
                                    {abono > 0 ? `-$${abono.toLocaleString('es-CO')}` : '$0'}
                                  </span>
                                </div>
                                <div className="bg-white p-2 rounded-xl border border-[#C5D6BE]">
                                  <span className="text-[10px] text-[#5A6B60] uppercase font-bold tracking-wider block">
                                    Excedente en Spa
                                  </span>
                                  <span className="font-extrabold text-[#2E5A44] text-xs font-mono">
                                    ${saldo.toLocaleString('es-CO')}
                                  </span>
                                </div>
                              </div>

                              <div className="p-2.5 bg-white rounded-xl border border-[#C5D6BE] text-[11px] text-[#5A6B60] leading-snug">
                                {abono > 0 ? (
                                  mismoServicio ? (
                                    <p>✨ Mantienes el mismo servicio (<strong>{servicioSeleccionado?.nombre}</strong>). Se transfiere tu abono de ${abono.toLocaleString('es-CO')} y el excedente a pagar en el spa se mantiene igual.</p>
                                  ) : (
                                    <p>✨ Elegiste un servicio diferente (<strong>{servicioSeleccionado?.nombre}</strong>). Se restó tu abono previo (${abono.toLocaleString('es-CO')}). Tu nuevo excedente a pagar en el spa es de <strong>${saldo.toLocaleString('es-CO')}</strong>.</p>
                                  )
                                ) : (
                                  <p>✨ Reagendamiento directo sin abono previo. Tu cita previa queda cancelada y pagarás los <strong>${prec.toLocaleString('es-CO')}</strong> directamente en el spa.</p>
                                )}
                                <p className="mt-1 text-emerald-700 font-semibold">
                                  ✨ No debes transferir ningún anticipo ahora. Tu cita se confirmará de inmediato.
                                </p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : exigeAnticipoEfectivo ? (
                      <div className="bg-[#E8F0E5] border border-[#C5D6BE] rounded-2xl p-4 space-y-2.5 text-xs">
                        {(() => {
                          const prec = precioTotal;
                          const montoFijo = Number(spaConfig.montoAnticipoFijo || spaConfig.porcentajeAnticipo || 20000);
                          const ant = Math.min(prec, montoFijo);
                          const res = Math.max(0, prec - ant);
                          const cubreTotal = prec <= montoFijo;
                          return (
                            <div className="space-y-2.5">
                              {esCitaDiciembre && !spaConfig.exigeAnticipo && (
                                <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold flex items-center gap-1.5">
                                  <span>🎄</span>
                                  <span>Temporada de Diciembre: Para todas las citas de diciembre se requiere abono previo para asegurar tu cupo.</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 text-[#2E5A44] font-bold">
                                <IconSparkles className="w-4 h-4 text-[#C5A059] shrink-0" />
                                <span>
                                  {cubreTotal
                                    ? 'Valor a transferir para confirmar cupo:'
                                    : 'Abono requerido para pre-confirmar:'}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-center font-medium">
                                <div className="bg-white p-2.5 rounded-xl border border-[#C5D6BE]">
                                  <span className="text-[10px] text-[#5A6B60] uppercase font-bold tracking-wider block">
                                    {cubreTotal ? 'Total a transferir (100%)' : 'Abono fijo requerido'}
                                  </span>
                                  <span className="font-extrabold text-[#2E5A44] text-sm font-mono">
                                    ${ant.toLocaleString('es-CO')}
                                  </span>
                                </div>
                                <div className="bg-white p-2.5 rounded-xl border border-[#C5D6BE]">
                                  <span className="text-[10px] text-[#5A6B60] uppercase font-bold tracking-wider block">
                                    Saldo en el spa
                                  </span>
                                  <span className="font-extrabold text-[#1C2922] text-sm font-mono">
                                    {res === 0 ? '$0 (Total cubierto)' : `$${res.toLocaleString('es-CO')}`}
                                  </span>
                                </div>
                              </div>

                              {cubreTotal && (
                                <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2 leading-tight">
                                  ✨ Como este servicio vale menos que la tarifa fija de abono, únicamente transfieres su valor total (<strong>${prec.toLocaleString('es-CO')}</strong>) y tu cita queda completamente paga.
                                </p>
                              )}
                            </div>
                          );
                        })()}

                        <p className="text-[11px] text-[#5A6B60] leading-snug">
                          🔒 Tu turno quedará <strong>pre-apartado por 30 minutos</strong> mientras realizas la transferencia y envías el comprobante a nuestro WhatsApp.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-white border border-[#C5D6BE] rounded-xl p-3 flex items-start gap-2 text-xs text-[#5A6B60]">
                        <IconHeart className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
                        <p className="leading-snug">
                          <strong>Sin cobro anticipado:</strong> Cancelas el valor de tu servicio (${servicioSeleccionado?.precio.toLocaleString('es-CO')} COP) el día de tu cita directamente en el spa.
                        </p>
                      </div>
                    )}

                    {/* Botones volver y confirmar */}
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => setPaso(1)}
                        className="p-3 bg-white border border-[#C5D6BE] text-[#5A6B60] hover:text-[#1C2922] rounded-xl transition cursor-pointer"
                        title="Volver"
                      >
                        <IconArrowLeft className="w-4 h-4" />
                      </button>
                      <button
                        disabled={enviandoReserva || !telefono.trim() || !nombre.trim()}
                        onClick={handleConfirmarReserva}
                        className="flex-1 py-3 bg-[#2E5A44] hover:bg-[#224433] disabled:opacity-40 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {enviandoReserva ? (
                          <>
                            <IconLoader2 className="w-4 h-4 animate-spin" />
                            <span>
                              {(() => {
                                const prec = precioTotal;
                                const abono = Number(citaPreviaInfo?.abonoPrevio || 0);
                                const montoFijo = Number(spaConfig.montoAnticipoFijo || spaConfig.porcentajeAnticipo || 20000);
                                const antTotal = exigeAnticipoEfectivo ? Math.min(prec, montoFijo) : 0;
                                const faltante = reagendarId ? Math.max(0, antTotal - abono) : antTotal;
                                if (faltante > 0) return 'Apartando pre-reserva (30 min)...';
                                return reagendarId ? 'Confirmando reagendamiento...' : 'Confirmando cita...';
                              })()}
                            </span>
                          </>
                        ) : (
                          <span>
                            {(() => {
                              const prec = precioTotal;
                              const abono = Number(citaPreviaInfo?.abonoPrevio || 0);
                              const montoFijo = Number(spaConfig.montoAnticipoFijo || spaConfig.porcentajeAnticipo || 20000);
                              const antTotal = exigeAnticipoEfectivo ? Math.min(prec, montoFijo) : 0;
                              const faltante = reagendarId ? Math.max(0, antTotal - abono) : antTotal;

                              if (faltante > 0) {
                                return reagendarId
                                  ? `Reagendar y Enviar Comprobante ($${faltante.toLocaleString('es-CO')})`
                                  : `Agendar y Enviar Comprobante ($${faltante.toLocaleString('es-CO')})`;
                              }
                              return reagendarId ? 'Confirmar cambio de cita' : 'Confirmar reserva';
                            })()}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* PASO 3: CONFIRMACIÓN EXITOSA / PRE-CONFIRMADA */}
                {paso === 3 && reservaConfirmada && (
                  <div className="text-center space-y-4 py-2">
                    <div
                      className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-white shadow-md ${
                        reservaConfirmada.esPreReserva
                          ? 'bg-gradient-to-tr from-amber-500 to-[#C5A059]'
                          : 'bg-gradient-to-tr from-[#2E5A44] to-[#C5A059]'
                      }`}
                    >
                      {reservaConfirmada.esPreReserva ? (
                        <IconClock className="w-8 h-8 stroke-[2.5]" />
                      ) : (
                        <IconCheck className="w-8 h-8 stroke-[3]" />
                      )}
                    </div>

                    <div className="space-y-1">
                      {reservaConfirmada.esPreReserva && (
                        <div className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 mb-1">
                          <span>⏳ {reservaConfirmada.esReagendamiento ? 'Reagendamiento pre-apartado por 30 min' : 'Pre-apartada por 30 minutos'}</span>
                        </div>
                      )}
                      {!reservaConfirmada.esPreReserva && reservaConfirmada.esReagendamiento && (
                        <div className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 mb-1">
                          <span>✓ Cita Reagendada y Confirmada</span>
                        </div>
                      )}
                      <h2 className="text-xl font-bold text-[#1C2922]">
                        ¡Cita{' '}
                        <span className="italic text-[#2E5A44] font-serif">
                          {reservaConfirmada.esPreReserva
                            ? (reservaConfirmada.esReagendamiento ? 'reagendada y pre-confirmada!' : 'pre-confirmada!')
                            : reservaConfirmada.esReagendamiento
                            ? 'reagendada con éxito!'
                            : 'confirmada!'}
                        </span>
                      </h2>
                      <p className="text-xs text-[#5A6B60] max-w-sm mx-auto leading-relaxed pt-1">
                        {reservaConfirmada.esPreReserva ? (
                          <>
                            ¡Listo, reina! Enviamos los datos y cuentas de transferencia a tu WhatsApp{' '}
                            <strong className="text-[#2E5A44]">{reservaConfirmada.telefono}</strong>.
                          </>
                        ) : (
                          <>
                            ¡Listo, reina! Enviamos tu comprobante oficial actualizado al WhatsApp{' '}
                            <strong className="text-[#2E5A44]">{reservaConfirmada.telefono}</strong>.
                          </>
                        )}
                      </p>
                    </div>

                    {reservaConfirmada.esPreReserva && (
                      <div className="bg-[#F5F8F4] border border-[#C5D6BE] rounded-2xl p-4 text-xs text-left space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#2E5A44] flex items-center gap-1.5">
                            <IconBrandWhatsapp className="w-4 h-4 text-emerald-600" />
                            <span>Cuentas oficiales para el abono:</span>
                          </span>
                          <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                            Límite: 30 minutos
                          </span>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-[#C5D6BE] space-y-1.5 font-mono text-[11px]">
                          <div className="flex justify-between items-center">
                            <span className="text-[#5A6B60]">📲 Nequi:</span>
                            <span className="font-bold text-[#1C2922] select-all">
                              {reservaConfirmada.nequi || 'Pendiente por configurar'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[#5A6B60]">🏦 Bancolombia:</span>
                            <span className="font-bold text-[#1C2922] select-all">
                              {reservaConfirmada.bancolombia || 'Pendiente por configurar'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center border-t border-[#E8F0E5] pt-1.5">
                            <span className="text-[#5A6B60]">Titular:</span>
                            <span className="font-bold text-[#2E5A44]">
                              {reservaConfirmada.titular || 'Ópalo Nails Spa'}
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-[#5A6B60] leading-snug">
                          📸 <strong>Paso final:</strong> Envía la foto o captura del comprobante al chat de WhatsApp. Nuestro sistema lo verificará para proteger tu turno. Si no se envía en 30 minutos, el espacio se liberará.
                        </p>
                      </div>
                    )}

                    {reservaConfirmada.esReagendamiento && (
                      reservaConfirmada.esPreReserva ? (
                        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-xs flex items-center justify-center gap-2 font-medium">
                          <span>⏳</span>
                          <span>
                            {(reservaConfirmada.abonoPrevioReconocido || 0) > 0
                              ? `Se reconoce tu abono previo de $${(reservaConfirmada.abonoPrevioReconocido || 0).toLocaleString('es-CO')}. Para asegurar tu cupo en diciembre, por favor transfiere el anticipo de $${(reservaConfirmada.anticipoRequerido || 0).toLocaleString('es-CO')} en los próximos 30 minutos.`
                              : `Para asegurar tu cupo en diciembre, por favor transfiere el anticipo de $${(reservaConfirmada.anticipoRequerido || 0).toLocaleString('es-CO')} en los próximos 30 minutos.`}
                          </span>
                        </div>
                      ) : (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs flex items-center justify-center gap-2 font-medium">
                          <span>✓</span>
                          <span>
                            {(reservaConfirmada.abonoPrevioReconocido || 0) > 0
                              ? `Tu cita previa fue cancelada y tu abono de $${(reservaConfirmada.abonoPrevioReconocido || 0).toLocaleString('es-CO')} quedó transferido a este nuevo turno.`
                              : 'Tu cita previa fue cancelada y tu nuevo turno fue reagendado con éxito.'}
                          </span>
                        </div>
                      )
                    )}

                    {/* Tarjeta de recordatorio automático 1 día antes */}
                    <div className="bg-[#F5F8F4] border border-[#C5D6BE] rounded-xl p-3 text-left flex items-start gap-2.5 text-xs">
                      <IconBrandWhatsapp className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="font-bold text-[#2E5A44]">Recordatorio automático</p>
                        <p className="text-[11px] text-[#5A6B60] leading-relaxed">
                          Te enviaremos un mensaje de recordatorio a tu WhatsApp <strong>1 día antes</strong> de tu cita.
                        </p>
                      </div>
                    </div>

                    {/* Resumen */}
                    <div className="bg-white border border-[#C5D6BE] rounded-2xl p-4 text-xs text-left space-y-2 shadow-xs">
                      <div className="flex justify-between border-b border-[#E8F0E5] pb-1.5">
                        <span className="text-[#5A6B60]">Servicio:</span>
                        <span className="font-bold text-[#1C2922]">{reservaConfirmada.servicio}</span>
                      </div>
                      <div className="flex justify-between border-b border-[#E8F0E5] pb-1.5">
                        <span className="text-[#5A6B60]">Especialista:</span>
                        <span className="font-bold text-[#1C2922]">{reservaConfirmada.empleada}</span>
                      </div>
                      <div className="flex justify-between border-b border-[#E8F0E5] pb-1.5">
                        <span className="text-[#5A6B60]">Fecha:</span>
                        <span className="font-bold text-[#1C2922]">{reservaConfirmada.fecha}</span>
                      </div>
                      <div className="flex justify-between border-b border-[#E8F0E5] pb-1.5">
                        <span className="text-[#5A6B60]">Hora:</span>
                        <span className="font-bold text-[#1C2922]">{reservaConfirmada.hora}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-[#E8F0E5] pb-1.5 gap-2">
                        <span className="text-[#5A6B60] shrink-0">Lugar:</span>
                        <a
                          href={obtenerUrlMapaSpa()}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-[#2E5A44] hover:underline flex items-center gap-1 text-right text-xs"
                          title="Abrir ubicación en el mapa"
                        >
                          <span>Pereira, Risaralda</span>
                          <span className="text-[9px] bg-[#E8F0E5] text-[#2E5A44] px-1.5 py-0.5 rounded border border-[#C5D6BE] shrink-0 font-bold">
                            Ver mapa 📍
                          </span>
                        </a>
                      </div>

                      {reservaConfirmada.esPreReserva ? (
                        <>
                          <div className="flex justify-between border-b border-[#E8F0E5] pb-1.5 pt-0.5">
                            <span className="text-[#5A6B60]">Precio del servicio:</span>
                            <span className="font-semibold text-[#1C2922] font-mono text-xs">
                              ${reservaConfirmada.precio.toLocaleString('es-CO')}
                            </span>
                          </div>
                          {(reservaConfirmada.abonoPrevioReconocido || 0) > 0 && (
                            <div className="flex justify-between border-b border-[#E8F0E5] pb-1.5 pt-0.5">
                              <span className="text-emerald-700 font-bold">Abono anterior reconocido:</span>
                              <span className="font-extrabold text-emerald-600 font-mono text-xs">
                                -${(reservaConfirmada.abonoPrevioReconocido || 0).toLocaleString('es-CO')}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between border-b border-[#E8F0E5] pb-1.5 pt-0.5">
                            <span className="text-[#2E5A44] font-bold">
                              Anticipo a transferir (30 min):
                            </span>
                            <span className="font-extrabold text-[#2E5A44] font-mono text-xs">
                              ${(reservaConfirmada.anticipoRequerido || 0).toLocaleString('es-CO')}
                            </span>
                          </div>
                          <div className="flex justify-between pt-1">
                            <span className="text-[#5A6B60] font-bold">Restante a pagar en el spa:</span>
                            <span className="font-extrabold text-[#1C2922] font-mono text-sm">
                              {(reservaConfirmada.saldoRestante || 0) === 0 ? '$0 (Servicio cubierto)' : `$${(reservaConfirmada.saldoRestante || 0).toLocaleString('es-CO')}`}
                            </span>
                          </div>
                        </>
                      ) : reservaConfirmada.esReagendamiento ? (
                        <>
                          <div className="flex justify-between border-b border-[#E8F0E5] pb-1.5 pt-0.5">
                            <span className="text-[#5A6B60]">Precio del servicio:</span>
                            <span className="font-semibold text-[#1C2922] font-mono text-xs">
                              ${reservaConfirmada.precio.toLocaleString('es-CO')}
                            </span>
                          </div>
                          {(reservaConfirmada.abonoPrevioReconocido || 0) > 0 ? (
                            <>
                              <div className="flex justify-between border-b border-[#E8F0E5] pb-1.5 pt-0.5">
                                <span className="text-emerald-700 font-bold">Abono anterior transferido:</span>
                                <span className="font-extrabold text-emerald-600 font-mono text-xs">
                                  -${(reservaConfirmada.abonoPrevioReconocido || 0).toLocaleString('es-CO')}
                                </span>
                              </div>
                              <div className="flex justify-between pt-1">
                                <span className="text-[#5A6B60] font-bold">Excedente a pagar en el spa:</span>
                                <span className="font-extrabold text-[#2E5A44] font-mono text-sm">
                                  ${(reservaConfirmada.saldoRestante ?? Math.max(0, reservaConfirmada.precio - (reservaConfirmada.abonoPrevioReconocido || 0))).toLocaleString('es-CO')}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="flex justify-between pt-1">
                              <span className="text-[#5A6B60] font-bold">Total a pagar en el spa:</span>
                              <span className="font-extrabold text-[#2E5A44] font-mono text-sm">
                                ${(reservaConfirmada.saldoRestante ?? reservaConfirmada.precio).toLocaleString('es-CO')}
                              </span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex justify-between pt-1">
                          <span className="text-[#5A6B60] font-bold">Total a pagar en el spa:</span>
                          <span className="font-extrabold text-[#2E5A44] font-mono text-sm">
                            ${reservaConfirmada.precio.toLocaleString('es-CO')}
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={cerrarModal}
                      className="w-full py-3 bg-[#2E5A44] hover:bg-[#224433] text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer"
                    >
                      Entendido, muchas gracias
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
