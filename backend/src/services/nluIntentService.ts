import axios from 'axios';
import { Complejo, Cancha } from './bookingService.js';

export interface ContextoExtraido {
  esContextual: boolean;
  intencion: 'RESERVA' | 'CONSULTA' | 'ASESOR' | 'OTRO';
  cancha?: Cancha;
  fecha?: string; // YYYY-MM-DD
  hora?: string; // HH:MM (ej. "16:00", "09:00")
  duracionHoras: number;
  confianza: number;
}

export class NLUIntentService {
  /**
   * Obtiene la fecha actual en la zona horaria de Colombia (America/Bogota, UTC-5)
   */
  public static getFechaHoraColombia(): Date {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    }).formatToParts(new Date());

    const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || '0', 10);
    return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  }

  /**
   * Formatea Date a YYYY-MM-DD
   */
  public static formatearIso(d: Date): string {
    const anio = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  /**
   * Interpreta fechas en lenguaje natural colombiano:
   * "hoy", "mañana", "pasado mañana", "el viernes", "el próximo sábado", "18 de octubre", "15/10", "2026-10-07"
   */
  public static interpretarFecha(input: string): string | null {
    if (!input) return null;
    const limpio = input.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const hoy = this.getFechaHoraColombia();

    const isoMatch = limpio.match(/(20\d{2}-\d{2}-\d{2})/);
    if (isoMatch) return isoMatch[1];

    if (limpio.includes('pasado manana')) {
      const p = new Date(hoy);
      p.setDate(hoy.getDate() + 2);
      return this.formatearIso(p);
    }
    if (/\bhoy\b/.test(limpio)) {
      return this.formatearIso(hoy);
    }
    if (/\bmanana\b/.test(limpio)) {
      const m = new Date(hoy);
      m.setDate(hoy.getDate() + 1);
      return this.formatearIso(m);
    }

    const meses: Record<string, number> = {
      enero: 0, ene: 0,
      febrero: 1, feb: 1,
      marzo: 2, mar: 2,
      abril: 3, abr: 3,
      mayo: 4, may: 4,
      junio: 5, jun: 5,
      julio: 6, jul: 6,
      agosto: 7, ago: 7,
      septiembre: 8, sep: 8, sept: 8,
      octubre: 9, oct: 9,
      noviembre: 10, nov: 10,
      diciembre: 11, dic: 11,
    };

    const regexTextoMes = /(?:(?:dom|lun|mar|mie|jue|vie|sab|domingo|lunes|martes|miercoles|jueves|viernes|sabado)\s+)?(\d{1,2})\s+(?:de\s+)?([a-z]+)(?:\s+(?:de\s+)?(\d{4}))?/;
    const matchTextoMes = limpio.match(regexTextoMes);
    if (matchTextoMes) {
      const dia = parseInt(matchTextoMes[1], 10);
      const nombreMes = matchTextoMes[2];
      if (meses[nombreMes] !== undefined) {
        const mes = meses[nombreMes];
        const anio = matchTextoMes[3] ? parseInt(matchTextoMes[3], 10) : hoy.getFullYear();
        const d = new Date(anio, mes, dia);
        if (!matchTextoMes[3] && d < hoy && (hoy.getTime() - d.getTime()) > 86400000) {
          d.setFullYear(anio + 1);
        }
        return this.formatearIso(d);
      }
    }

    const regexBarra = /(?:^|\s|[^\d\-])(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?(?:\s|[^\d\-]|$)/;
    const matchBarra = limpio.match(regexBarra);
    if (matchBarra) {
      const dia = parseInt(matchBarra[1], 10);
      const mes = parseInt(matchBarra[2], 10) - 1;
      const anio = matchBarra[3] ? parseInt(matchBarra[3], 10) : hoy.getFullYear();
      if (dia >= 1 && dia <= 31 && mes >= 0 && mes <= 11) {
        const d = new Date(anio, mes, dia);
        if (!matchBarra[3] && d < hoy && (hoy.getTime() - d.getTime()) > 86400000) {
          d.setFullYear(anio + 1);
        }
        return this.formatearIso(d);
      }
    }

    const diasSemana: Record<string, number> = {
      domingo: 0, dom: 0,
      lunes: 1, lun: 1,
      martes: 2, mar: 2,
      miercoles: 3, mie: 3,
      jueves: 4, jue: 4,
      viernes: 5, vie: 5,
      sabado: 6, sab: 6,
    };

    for (const [nombreDia, targetDay] of Object.entries(diasSemana)) {
      const regWord = new RegExp(`\\b${nombreDia}\\b`, 'i');
      if (regWord.test(limpio)) {
        const esProximaSemana = limpio.includes('proxim') || limpio.includes('otra') || limpio.includes('siguiente');
        const diaActual = hoy.getDay();
        let diff = targetDay - diaActual;

        if (diff <= 0) {
          diff += 7;
        }
        if (esProximaSemana && diff < 7) {
          diff += 7;
        }

        const d = new Date(hoy);
        d.setDate(hoy.getDate() + diff);
        return this.formatearIso(d);
      }
    }

    return null;
  }

  /**
   * Extrae la hora exacta (HH:MM) a partir de lenguaje natural
   */
  public static interpretarHora(texto: string): string | null {
    const t = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    let minutos = '00';
    if (t.includes('y media') || t.includes('y 30')) minutos = '30';
    else if (t.includes('y cuarto') || t.includes('y 15')) minutos = '15';
    else if (t.includes('y 45')) minutos = '45';

    const matchAmPm = t.match(/(?:a\s+las?|para\s+las?|alas?)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (matchAmPm) {
      let h = parseInt(matchAmPm[1], 10);
      const min = matchAmPm[2] || minutos;
      const ampm = matchAmPm[3].toLowerCase();
      if (ampm === 'pm' && h < 12) h += 12;
      if (ampm === 'am' && h === 12) h = 0;
      if (h >= 0 && h <= 23) {
        return `${String(h).padStart(2, '0')}:${min}`;
      }
    }

    const matchVerbal = t.match(/(?:a\s+las?|para\s+las?|alas?)?\s*(\d{1,2})(?::(\d{2}))?\s*(?:y\s+media|y\s+cuarto)?\s*de\s+la\s+(tarde|noche|manana)\b/i);
    if (matchVerbal) {
      let h = parseInt(matchVerbal[1], 10);
      const min = matchVerbal[2] || minutos;
      const periodo = matchVerbal[3].toLowerCase();
      if ((periodo === 'tarde' || periodo === 'noche') && h < 12) h += 12;
      if (periodo === 'manana' && h === 12) h = 0;
      if (h >= 0 && h <= 23) {
        return `${String(h).padStart(2, '0')}:${min}`;
      }
    }

    const match24h = t.match(/(?:a\s+las?|para\s+las?|alas?)?\s*([01]?\d|2[0-3])(?::([0-5]\d)|\s*hs?|\s*hrs?)\b/i);
    if (match24h) {
      const h = parseInt(match24h[1], 10);
      const min = match24h[2] || minutos;
      if (h >= 6 && h <= 23) {
        return `${String(h).padStart(2, '0')}:${min}`;
      }
    }

    const matchPreposicion = t.match(/(?:a\s+las?|para\s+las?|alas?)\s*(\d{1,2})(?::(\d{2}))?\b/i);
    if (matchPreposicion) {
      let h = parseInt(matchPreposicion[1], 10);
      const min = matchPreposicion[2] || minutos;
      if (h >= 1 && h <= 6) {
        h += 12;
      }
      if (h >= 6 && h <= 23) {
        return `${String(h).padStart(2, '0')}:${min}`;
      }
    }

    return null;
  }

  /**
   * Empareja el servicio (Uñas, Cejas o Pestañas) o especialista a partir del texto
   */
  public static emparejarCancha(texto: string, canchas: Cancha[], _complejo: Complejo): Cancha | undefined {
    if (!canchas || canchas.length === 0) return undefined;
    if (canchas.length === 1) return canchas[0];

    const t = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // 1. Búsqueda por servicios de Uñas, Cejas y Pestañas
    const spaKeywords: Record<string, string[]> = {
      belleza_unas: [
        'uñas', 'unas', 'acrilicas', 'semipermanente', 'pedicure', 'pedicura', 'manicure', 'manicura',
        'spa', 'ruber', 'rubber', 'polygel', 'dipping', 'esculpido', 'esculpidas', 'recubrimiento',
        'press on', 'press', 'retoque', 'limpieza',
        'cejas', 'pestanas', 'pestañas', 'lifting', 'laminado', 'pelo a pelo', 'volumen ruso',
        'volumen brasileno', 'hibridas', '3d', 'henna', 'hilo', 'cera', 'bigote', 'depilacion',
      ],
    };

    // 2. Coincidencia directa por nombres de especialistas
    for (const c of canchas) {
      const nombreCancha = c.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const palabras = nombreCancha.split(/[\s\-(),/]+/).filter((p) => p.length >= 3);
      for (const p of palabras) {
        if (t.includes(p)) {
          return c;
        }
      }
    }

    // 3. Coincidencia por servicio genérico
    for (const [, palabras] of Object.entries(spaKeywords)) {
      if (palabras.some((p) => t.includes(p))) {
        return canchas[0];
      }
    }

    // 4. Si el usuario dijo "cita", "turno", "agendar", "reservar"
    if (
      t.includes('cita') ||
      t.includes('turno') ||
      t.includes('agendar') ||
      t.includes('reservar') ||
      t.includes('uñas') ||
      t.includes('unas') ||
      t.includes('cejas') ||
      t.includes('pestanas')
    ) {
      return canchas[0];
    }

    return undefined;
  }

  /**
   * Extrae contexto completo de manera inteligente (Híbrido: Reglas NLP + Gemini AI opcional)
   */
  public static async extraerContexto(
    texto: string,
    complejo: Complejo,
    canchas: Cancha[]
  ): Promise<ContextoExtraido> {
    const t = texto.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const esSoloSaludo = ['hola', 'buenas', 'buen dia', 'buenos dias', 'buenas tardes', 'menu', 'reiniciar', 'inicio'].includes(t);
    if (esSoloSaludo) {
      return {
        esContextual: false,
        intencion: 'OTRO',
        duracionHoras: 1,
        confianza: 0,
      };
    }

    // Negocio de Reservas / Citas (Ópalo Nails Spa)
    const fecha = this.interpretarFecha(texto) || undefined;
    const hora = this.interpretarHora(texto) || undefined;
    const cancha = this.emparejarCancha(texto, canchas, complejo);

    let duracionHoras = 1;
    if (t.includes('2 horas') || t.includes('dos horas') || t.includes('2h') || t.includes('turno doble')) {
      duracionHoras = 2;
    }

    const palabrasIntencion = [
      'reservar', 'reserva', 'apartar', 'aparta', 'separar', 'separa',
      'cita', 'turno', 'uñas', 'unas', 'manicure', 'manicura', 'pedicure', 'pedicura',
      'semipermanente', 'acrilico', 'acrilicas', 'cejas', 'pestanas', 'lifting', 'laminado',
      'pelo a pelo', 'henna', 'depilacion', 'press on',
      'horario', 'espacio', 'cupo', 'quiero', 'necesito', 'tienes', 'disponible',
    ];
    const tieneIntencionReserva = palabrasIntencion.some((p) => t.includes(p)) || !!fecha || !!hora || !!cancha;

    if (tieneIntencionReserva && (fecha || hora || cancha)) {
      return {
        esContextual: true,
        intencion: 'RESERVA',
        cancha,
        fecha,
        hora,
        duracionHoras,
        confianza: 0.9,
      };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && texto.length > 8) {
      try {
        const iaContexto = await this.extraerConGemini(texto, complejo, canchas, apiKey);
        if (iaContexto && iaContexto.esContextual) {
          return iaContexto;
        }
      } catch (e: any) {
        // Fallback silente
      }
    }

    return {
      esContextual: false,
      intencion: 'OTRO',
      duracionHoras: 1,
      confianza: 0,
    };
  }

  /**
   * Consulta a Gemini para parsing de intención y entidades complejas
   */
  private static async extraerConGemini(
    texto: string,
    complejo: Complejo,
    canchas: Cancha[],
    apiKey: string
  ): Promise<ContextoExtraido | null> {
    const hoyStr = this.formatearIso(this.getFechaHoraColombia());
    const listaCanchasStr = canchas.map((c) => `- ID: "${c.id}", Especialista: "${c.nombre}"`).join('\n');

    const prompt = `Actúa como un extractor NLU de citas para Ópalo Nails Spa (especialistas en Uñas, Cejas y Pestañas) en Pereira, Colombia.
Fecha de hoy en Colombia (UTC-5): ${hoyStr}.
Establecimiento: "${complejo.nombre}".
Especialistas disponibles:
${listaCanchasStr}

Mensaje del cliente:
"${texto}"

Devuelve ÚNICAMENTE un objeto JSON válido con este formato:
{
  "esContextual": true | false,
  "intencion": "RESERVA" | "CONSULTA" | "OTRO",
  "canchaId": "ID de la especialista que mejor coincide o null",
  "fecha": "YYYY-MM-DD o null si no se menciona",
  "hora": "HH:00 o null si no se menciona",
  "duracionHoras": 1 o 2
}`;

    const modelos = [
      process.env.GEMINI_MODEL,
      'gemini-3-flash-preview',
      'gemini-3.8-flash',
      'gemini-2.5-flash',
      'gemini-1.5-flash',
    ].filter(Boolean) as string[];
    for (const m of modelos) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
        const res = await axios.post(
          endpoint,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
          },
          { timeout: 5000 }
        );
        const rawText = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = JSON.parse(rawText);
          const canchaMatch = canchas.find((c) => c.id === parsed.canchaId);
          return {
            esContextual: !!parsed.esContextual,
            intencion: parsed.intencion || 'RESERVA',
            cancha: canchaMatch,
            fecha: parsed.fecha || undefined,
            hora: parsed.hora || undefined,
            duracionHoras: parsed.duracionHoras || 1,
            confianza: 0.95,
          };
        }
      } catch (e) {
        // Fallback al siguiente modelo
      }
    }

    return null;
  }
}
