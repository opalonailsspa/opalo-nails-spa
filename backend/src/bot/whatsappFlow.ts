import { BookingService, Complejo, Cancha, HorarioDisponible, getMontoAnticipoFijo, requiereAnticipoParaFecha } from '../services/bookingService.js';
import { ReceiptVerificationService } from '../services/receiptVerificationService.js';
import { AIReceptionistService } from '../services/aiReceptionistService.js';
import { NLUIntentService } from '../services/nluIntentService.js';
import { supabase } from '../config/supabase.js';

export interface InteractiveRow {
  id: string;
  title: string;
  description?: string;
}

export interface InteractiveSection {
  title?: string;
  rows: InteractiveRow[];
}

export interface BotInteractiveMessage {
  type: 'list';
  header?: string;
  body: string;
  footer?: string;
  action: {
    button: string; // Max 20 chars
    sections: InteractiveSection[];
  };
}

export interface BotCtaUrlAction {
  name: 'cta_url';
  parameters: {
    display_text: string;
    url: string;
  };
}

export interface BotCtaUrlMessage {
  type: 'cta_url';
  header?: string;
  body: string;
  footer?: string;
  action: BotCtaUrlAction;
}

export interface BotResponse {
  texto: string;
  interactive?: BotInteractiveMessage | BotCtaUrlMessage;
  urlRedirect?: string;
}

interface UserSession {
  paso: 'INICIO' | 'SELECCION_CANCHA' | 'SELECCION_FECHA' | 'SELECCION_HORA' | 'CONFIRMACION' | 'ESPERA_PAGO' | 'PEDIDO_ESPERA_DIRECCION';
  complejoId?: string;
  canchasDisponibles?: Cancha[];
  canchaSeleccionada?: Cancha;
  fechaSeleccionada?: string; // YYYY-MM-DD
  horariosDisponibles?: HorarioDisponible[];
  horarioSeleccionado?: HorarioDisponible;
  reservaId?: string;
  nombreCliente?: string;
  ultimoMensaje: number;
  linkEnviado?: boolean;
  pedidoInfo?: {
    detalle: string;
    total: number;
    direccion?: string;
    items?: string[];
  };
}

const sesiones: Map<string, UserSession> = new Map();

export class WhatsAppFlow {
  /**
   * Procesa el mensaje entrante de WhatsApp para Ópalo Nails Spa
   */
  static async procesarMensaje(
    telefono: string,
    texto: string,
    nombrePush?: string,
    complejoDirecto?: Complejo,
    mediaId?: string,
    mediaType?: string,
    directImageBuffer?: Buffer
  ): Promise<BotResponse> {
    try {
      const ahora = Date.now();
      let session = sesiones.get(telefono);

      // Obtener complejo asignado
      const complejo = complejoDirecto || (await BookingService.getComplejos())[0];

      if (!session || ahora - session.ultimoMensaje > 30 * 60 * 1000 || session.complejoId !== complejo.id) {
        session = { paso: 'INICIO', complejoId: complejo.id, ultimoMensaje: ahora };
        sesiones.set(telefono, session);
      }
      session.ultimoMensaje = ahora;

      const input = texto.trim().toLowerCase();

      // Manejo de reinicio explícito para pruebas o limpiar conversaciones previas
      if (input === 'reiniciar' || input === 'reset' || input === 'limpiar' || input === 'borrar') {
        sesiones.delete(telefono);
        session = { paso: 'INICIO', complejoId: complejo.id, ultimoMensaje: ahora, linkEnviado: true };
        sesiones.set(telefono, session);
        const esSpa = complejo.slug === 'opalo-nails' || complejo.tipo_negocio === 'belleza_unas' || true;
        if (esSpa) {
          const baseUrl = process.env.FRONTEND_URL || 'https://opalo-nails-spa.vercel.app';
          const cleanTel = telefono.replace(/\D/g, '');
          const queryParams = new URLSearchParams();
          if (cleanTel) queryParams.set('tel', cleanTel);
          if (nombrePush) queryParams.set('nombre', nombrePush);
          const urlAgenda = `${baseUrl}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

          const textoReinicio =
            `🔄 *Conversación reiniciada con éxito* ✨\n\n` +
            `¡Hola reina! Tu sesión anterior ha sido limpiada por completo.\n` +
            `Para agendar tu cita en *Ópalo Nails Spa* (Uñas, Cejas y Pestañas) y elegir tu especialista preferida, toca el botón a continuación:\n\n` +
            `¡Te esperamos con mucho cariño para consentirte! 🌿🤍`;

          return {
            texto: `${textoReinicio}\n\n📅 *Agenda tu cita aquí:*\n${urlAgenda}`,
            urlRedirect: urlAgenda,
            interactive: {
              type: 'cta_url',
              header: '✨ Ópalo Nails Spa',
              body: textoReinicio,
              footer: 'Ópalo Nails Spa — Pereira',
              action: {
                name: 'cta_url',
                parameters: {
                  display_text: '📅 Abrir Agenda',
                  url: urlAgenda,
                },
              },
            },
          };
        }
      }

      // Detección de respuesta al menú de recordatorio (Confirmar, Cancelar o Reagendar)
      const resRecordatorio = await this.manejarRespuestaRecordatorio(telefono, texto, input, complejo, session);
      if (resRecordatorio) {
        return resRecordatorio;
      }

      const esSpa = complejo.slug === 'opalo-nails' || complejo.tipo_negocio === 'belleza_unas' || true;

      // 1. Detección de comprobante de pago o seguimiento de pre-reserva pendiente
      const esConsultaPago = ['comprobante', 'abono', 'pago', 'transferencia', 'transferi', 'nequi', 'daviplata', 'cuenta', 'cuentas', 'soporte', 'pagar'].some(k => input.includes(k));
      if (mediaId || directImageBuffer || session.paso === 'ESPERA_PAGO' || esConsultaPago) {
        const resComprobante = await this.manejarRecepcionComprobante(telefono, complejo, session, mediaId, mediaType, texto, directImageBuffer);
        if (resComprobante) {
          return resComprobante;
        }
      }

      // 2. Detección de saludos puros o solicitud explícita del link de agenda
      const esSaludoOLinkDirecto = [
        'hola',
        'hola!',
        'buenas',
        'buen dia',
        'buenos dias',
        'buenas tardes',
        'buenas noches',
        'menu',
        'inicio',
        'empezar',
        'comenzar',
        'agendar',
        'agenda',
        'link',
        'enlace',
        'cita',
        'citas',
      ].includes(input);

      // Si es una pregunta en lenguaje natural
      const tienePreguntaNatural =
        AIReceptionistService.esSolicitudHumano(input) ||
        AIReceptionistService.esPreguntaFrecuente(input);

      if (esSpa && !mediaId && !directImageBuffer && !esSaludoOLinkDirecto && (session.linkEnviado || tienePreguntaNatural)) {
        const consulta = await AIReceptionistService.responderConsulta(texto, complejo, true);
        if (consulta.esPreguntaOAtencion && consulta.respuestaTexto) {
          session.linkEnviado = true;
          return { texto: consulta.respuestaTexto };
        }
      }

      if (!mediaId && !directImageBuffer && !esSaludoOLinkDirecto && tienePreguntaNatural) {
        const consulta = await AIReceptionistService.responderConsulta(texto, complejo, true);
        if (consulta.esPreguntaOAtencion && consulta.respuestaTexto) {
          session.linkEnviado = true;
          return { texto: consulta.respuestaTexto };
        }
      }

      const esSoloSaludo =
        esSaludoOLinkDirecto ||
        input.startsWith('hola') ||
        input.startsWith('buenas') ||
        input.includes('cita') ||
        input.includes('agend');

      if (esSoloSaludo || input === 'cancelar' || input === 'menu' || input === 'inicio') {
        session.paso = 'INICIO';
        session.canchaSeleccionada = undefined;
        session.fechaSeleccionada = undefined;
        session.horariosDisponibles = undefined;
        session.reservaId = undefined;

        if (esSpa && !mediaId && !directImageBuffer) {
          return await this.manejarInicio(telefono, session, complejo, nombrePush, texto);
        }
      }

      if (esSpa && session.paso === 'INICIO' && !mediaId && !directImageBuffer) {
        return await this.manejarInicio(telefono, session, complejo, nombrePush, texto);
      }

      if (!mediaId && (AIReceptionistService.esSolicitudHumano(input) || AIReceptionistService.esPreguntaFrecuente(input))) {
        const consulta = await AIReceptionistService.responderConsulta(texto, complejo);
        if (consulta.esPreguntaOAtencion && consulta.respuestaTexto) {
          return { texto: consulta.respuestaTexto };
        }
      }

      // 3. COMPRENSIÓN NATURAL DE CONTEXTO GLOBAL
      const esComandoSistema = input.startsWith('cancha_') ||
        input.startsWith('fecha_') ||
        input.startsWith('hora_') ||
        input.startsWith('hora2_') ||
        input === 'contacto_asesor' ||
        input === 'menu' ||
        input === 'reiniciar' ||
        input === 'cancelar';

      if (!mediaId && !esComandoSistema && !esSoloSaludo) {
        if (!session.canchasDisponibles || session.canchasDisponibles.length === 0) {
          session.canchasDisponibles = await BookingService.getCanchas(complejo.id);
        }

        const respuestaContexto = await this.manejarContextoNatural(
          telefono,
          texto,
          input,
          session,
          complejo,
          nombrePush
        );

        if (respuestaContexto) {
          return respuestaContexto;
        }
      }

      // 4. FLUJO GUIADO DE RESERVAS Y CITAS
      switch (session.paso) {
        case 'INICIO':
          return await this.manejarInicio(telefono, session, complejo, nombrePush, texto);

        case 'SELECCION_CANCHA':
          return await this.manejarSeleccionCancha(input, session);

        case 'SELECCION_FECHA':
          return await this.manejarSeleccionFecha(input, session);

        case 'SELECCION_HORA':
          return await this.manejarSeleccionHora(input, session, telefono, complejo);

        case 'ESPERA_PAGO':
          return await this.manejarEsperaPago(input, session, complejo, mediaId, mediaType, directImageBuffer);

        default:
          session.paso = 'INICIO';
          return {
            texto: `✨ ¡Hola reina! Escribe *HOLA* o *MENU* para consultar nuestros servicios de Uñas, Cejas y Pestañas y agendar tu cita en *${complejo.nombre || 'Ópalo Nails Spa'}* 🌿🤍.`,
          };
      }
    } catch (globalErr: any) {
      console.error('Error general procesando flujo de WhatsApp:', globalErr);
      return {
        texto: '👋 ¡Hola! Ocurrió una pequeña interrupción en nuestro sistema. Por favor escribe *HOLA* o *MENU* para continuar.',
      };
    }
  }

  /**
   * Procesa comprensión de lenguaje natural para reservas y citas en cualquier momento
   */
  private static async manejarContextoNatural(
    telefono: string,
    texto: string,
    _input: string,
    session: UserSession,
    complejo: Complejo,
    nombrePush?: string
  ): Promise<BotResponse | null> {
    const canchas = session.canchasDisponibles || (await BookingService.getCanchas(complejo.id));
    session.canchasDisponibles = canchas;

    const ctx = await NLUIntentService.extraerContexto(texto, complejo, canchas);
    if (!ctx.esContextual) {
      return null;
    }

    if (ctx.intencion === 'RESERVA') {
      await BookingService.getOrCreateCliente(telefono, nombrePush);

      let cancha = ctx.cancha || session.canchaSeleccionada;
      if (!cancha && canchas.length === 1) {
        cancha = canchas[0];
      }

      let fecha = ctx.fecha || session.fechaSeleccionada;
      if (!fecha && ctx.hora) {
        fecha = NLUIntentService.formatearIso(NLUIntentService.getFechaHoraColombia());
      }

      const hora = ctx.hora;
      const duracionHoras = ctx.duracionHoras || 1;

      if (cancha && fecha && hora) {
        session.canchaSeleccionada = cancha;
        session.fechaSeleccionada = fecha;

        const horarios = await BookingService.getHorariosDisponibles(cancha.id, fecha);
        session.horariosDisponibles = horarios;

        const horaPrefix = hora.slice(0, 5);
        const slotMatch = horarios.find((h) => h.hora_inicio.startsWith(horaPrefix));

        if (slotMatch && slotMatch.disponible) {
          const idHora = duracionHoras === 2 ? `hora2_${horaPrefix}` : `hora_${horaPrefix}`;
          return await this.manejarSeleccionHora(idHora, session, telefono, complejo);
        } else {
          const disponibles = horarios.filter((h) => h.disponible);
          if (disponibles.length === 0) {
            session.paso = 'SELECCION_FECHA';
            return {
              texto: `⚠️ *Horario no disponible*\n\n` +
                `El turno de las *${horaPrefix}* para *${cancha.nombre}* el *${fecha}* ya se encuentra reservado.\n\n` +
                `❌ Lamentablemente no quedan más turnos libres para esta fecha.\n` +
                `👉 Por favor escribe otra fecha (ej. *"mañana"*, *"el sábado"*) o escribe *MENU*.`,
            };
          }

          session.paso = 'SELECCION_HORA';
          const filasAlt: InteractiveRow[] = disponibles.slice(0, 6).map((h) => {
            const precioFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(h.precio);
            return {
              id: `hora_${h.hora_inicio.slice(0, 5)}`,
              title: `${h.hora_inicio.slice(0, 5)} a ${h.hora_fin.slice(0, 5)}`.slice(0, 24),
              description: `${precioFmt} • Disponible hoy`.slice(0, 72),
            };
          });

          const textoRespuesta = `⚠️ *Horario ocupado*\n\n` +
            `El turno de las *${horaPrefix}* para *${cancha.nombre}* el *${fecha}* ya fue reservado.\n\n` +
            `✨ *¡Pero tenemos estos turnos disponibles para ti con ${cancha.nombre}!*:\n` +
            `Por favor selecciona tu horario alternativo del menú desplegable a continuación:`;

          return {
            texto: textoRespuesta,
            interactive: {
              type: 'list',
              header: 'Horarios Disponibles',
              body: textoRespuesta,
              footer: 'Elige del menú o escribe ASESOR',
              action: {
                button: 'Ver Horarios',
                sections: [{ title: 'Turnos Disponibles', rows: filasAlt }],
              },
            },
          };
        }
      }

      if (cancha && fecha && !hora) {
        session.canchaSeleccionada = cancha;
        return await this.manejarSeleccionFecha(fecha, session);
      }

      if (!cancha && fecha && hora && canchas.length > 1) {
        session.fechaSeleccionada = fecha;
        const canchasLibres: Cancha[] = [];
        for (const c of canchas) {
          try {
            const hDisponibles = await BookingService.getHorariosDisponibles(c.id, fecha);
            const tieneTurno = hDisponibles.some((h) => h.hora_inicio.startsWith(hora.slice(0, 5)) && h.disponible);
            if (tieneTurno) canchasLibres.push(c);
          } catch (e) {}
        }

        if (canchasLibres.length === 1) {
          session.canchaSeleccionada = canchasLibres[0];
          session.horariosDisponibles = await BookingService.getHorariosDisponibles(canchasLibres[0].id, fecha);
          const idHora = duracionHoras === 2 ? `hora2_${hora.slice(0, 5)}` : `hora_${hora.slice(0, 5)}`;
          return await this.manejarSeleccionHora(idHora, session, telefono, complejo);
        }

        if (canchasLibres.length > 1) {
          session.paso = 'SELECCION_CANCHA';
          const rows: InteractiveRow[] = canchasLibres.map((c) => ({
            id: `cancha_${c.id}`,
            title: c.nombre.slice(0, 24),
            description: `Libre a las ${hora.slice(0, 5)} • $${c.precio_estandar.toLocaleString('es-CO')}`.slice(0, 72),
          }));

          const textoResp = `📅 Para el *${fecha}* a las *${hora.slice(0, 5)}* tenemos disponibles las siguientes especialistas en *${complejo.nombre}*:\n\n` +
            `👉 Selecciona con cuál de ellas deseas tu cita:`;

          return {
            texto: textoResp,
            interactive: {
              type: 'list',
              header: 'Especialistas Disponibles',
              body: textoResp,
              footer: 'Elige del menú o escribe ASESOR',
              action: {
                button: 'Elegir Especialista',
                sections: [{ title: `Libres a las ${hora.slice(0, 5)}`, rows }],
              },
            },
          };
        }
      }

      if (cancha && !fecha && !hora) {
        return await this.manejarSeleccionCancha(`cancha_${cancha.id}`, session);
      }
    }

    return null;
  }

  private static async manejarInicio(
    telefono: string,
    session: UserSession,
    complejo: Complejo,
    nombrePush?: string,
    textoMensaje?: string
  ): Promise<BotResponse> {
    await BookingService.getOrCreateCliente(telefono, nombrePush);

    const canchas = await BookingService.getCanchas(complejo.id);
    session.canchasDisponibles = canchas;
    session.paso = 'SELECCION_CANCHA';

    if (textoMensaje && textoMensaje.trim().length > 3 && canchas.length > 0) {
      const inputLimpio = textoMensaje.trim().toLowerCase();
      const esSoloSaludo = ['hola', 'buenas', 'buen dia', 'buenos dias', 'buenas tardes', 'menu', 'reiniciar'].includes(inputLimpio);

      if (!esSoloSaludo) {
        const contexto = this.extraerContextoReserva(textoMensaje, canchas);
        if (contexto.cancha) {
          session.canchaSeleccionada = contexto.cancha;
          if (contexto.fecha) {
            session.fechaSeleccionada = contexto.fecha;
            session.paso = 'SELECCION_HORA';
            if (contexto.hora) {
              const horarios = await BookingService.getHorariosDisponibles(contexto.cancha.id, contexto.fecha);
              session.horariosDisponibles = horarios;
              const turnoMatch = horarios.find((h) => h.hora_inicio.startsWith(contexto.hora!) && h.disponible);
              if (turnoMatch) {
                return await this.manejarSeleccionHora(`hora_${turnoMatch.hora_inicio.slice(0, 5)}`, session, telefono, complejo);
              }
            }
            return await this.manejarSeleccionFecha(contexto.fecha, session);
          }
          return await this.manejarSeleccionCancha(`cancha_${contexto.cancha.id}`, session);
        }
      }
    }

    session.paso = 'INICIO';
    session.linkEnviado = true;
    const baseUrl = process.env.FRONTEND_URL || 'https://opalo-nails-spa.vercel.app';
    const cleanTel = telefono.replace(/\D/g, '');
    const queryParams = new URLSearchParams();
    if (cleanTel) queryParams.set('tel', cleanTel);
    if (nombrePush) queryParams.set('nombre', nombrePush);
    const urlAgenda = `${baseUrl}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

    const exigeAnticipo = (Number(complejo.porcentaje_anticipo_minimo) || 0) > 0;
    const montoFijo = getMontoAnticipoFijo(complejo);
    const montoFijoFmt = '$' + montoFijo.toLocaleString('es-CO');
    const textoAnticipo = exigeAnticipo
      ? `✨ Pre-reserva fácil con abono fijo de ${montoFijoFmt} para asegurar tu cupo.`
      : `✨ Sin cobros anticipados (pagas directamente en el spa).`;

    const saludoNombre = nombrePush ? ` ${nombrePush}` : '';
    const textoSpa =
      `🌿✨ *¡HOLA${saludoNombre ? saludoNombre.toUpperCase() : ' REINA'}! BIENVENIDA A ÓPALO NAILS SPA* ✨🌿\n\n` +
      `Nos alegra mucho saludarte. Para agendar tu cita de *Uñas, Cejas o Pestañas*, ver nuestro catálogo de precios y elegir tu especialista preferida, abre nuestra agenda en el siguiente enlace:\n\n` +
      `📅 *ABRIR AGENDA:*\n👉 ${urlAgenda}\n\n` +
      `📍 ${complejo.direccion || 'Pereira, Risaralda, Colombia'}\n` +
      `📸 Instagram: @opalo_nailspereira\n` +
      `${textoAnticipo}\n\n` +
      `¡Te esperamos con mucho cariño para consentirte! 🤍✨`;

    return {
      texto: textoSpa,
      urlRedirect: urlAgenda,
      interactive: {
        type: 'cta_url',
        header: '✨ Ópalo Nails Spa',
        body: textoSpa,
        footer: 'Ópalo Nails Spa — Pereira',
        action: {
          name: 'cta_url',
          parameters: {
            display_text: 'Abrir Agenda',
            url: urlAgenda,
          },
        },
      },
    };
  }

  private static async manejarSeleccionCancha(input: string, session: UserSession): Promise<BotResponse> {
    if (!session.canchasDisponibles || session.canchasDisponibles.length === 0) {
      session.paso = 'INICIO';
      return { texto: '⚠️ Sesión expirada. Por favor escribe *HOLA* para iniciar tu reserva.' };
    }

    let canchaEncontrada: Cancha | undefined;

    if (input.startsWith('cancha_')) {
      const id = input.replace('cancha_', '');
      canchaEncontrada = session.canchasDisponibles.find((c) => c.id === id);
    } else {
      const idx = parseInt(input, 10) - 1;
      if (!isNaN(idx) && session.canchasDisponibles[idx]) {
        canchaEncontrada = session.canchasDisponibles[idx];
      } else {
        canchaEncontrada = session.canchasDisponibles.find(
          (c) => c.nombre.toLowerCase().includes(input) || input.includes(c.nombre.toLowerCase())
        );
      }
    }

    if (!canchaEncontrada) {
      return {
        texto: '⚠️ Por favor selecciona una opción válida del menú desplegable de especialistas.',
      };
    }

    session.canchaSeleccionada = canchaEncontrada;
    session.paso = 'SELECCION_FECHA';

    const hoy = this.getFechaHoraColombia();
    const nombresDias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const filasProximosDias: InteractiveRow[] = [];

    for (let i = 0; i < 6; i++) {
      const d = new Date(hoy);
      d.setDate(hoy.getDate() + i);
      const fechaIso = this.formatearIso(d);

      const nombreDia = nombresDias[d.getDay()];
      const nombreMes = nombresMeses[d.getMonth()];
      const diaStr = String(d.getDate()).padStart(2, '0');

      let etiqueta = `${nombreDia} ${diaStr} ${nombreMes}`;
      if (i === 0) etiqueta = `Hoy (${nombreDia})`;
      else if (i === 1) etiqueta = `Mañana (${nombreDia})`;

      filasProximosDias.push({
        id: `fecha_${fechaIso}`,
        title: etiqueta.slice(0, 24),
        description: `Reservar para el ${fechaIso}`,
      });
    }

    const filasPersonalizadas: InteractiveRow[] = [
      {
        id: 'fecha_personalizada',
        title: '✏️ Otra fecha',
        description: 'Escribe cualquier fecha del año',
      },
      {
        id: 'contacto_asesor',
        title: '💬 Hablar con Asesor',
        description: 'Atención con una encargada del spa',
      },
    ];

    const sections: InteractiveSection[] = [
      { title: 'Fechas Próximas'.slice(0, 24), rows: filasProximosDias },
      { title: 'Otras Opciones'.slice(0, 24), rows: filasPersonalizadas },
    ];

    const texto = `✨ Especialista: *${session.canchaSeleccionada.nombre}*\n\n` +
      `¿Para qué fecha deseas tu cita?\n` +
      `• Despliega el menú tocando *[Elegir Fecha]*.\n` +
      `• O puedes **escribir directamente la fecha que quieras** (ej: *"18 de octubre"*, *"el viernes"*).\n` +
      `• O escribe *ASESOR* en cualquier momento para hablar con una encargada.`;

    return {
      texto,
      interactive: {
        type: 'list',
        header: 'Selección de Fecha',
        body: texto,
        footer: 'Elige del menú o escribe ASESOR',
        action: {
          button: 'Elegir Fecha',
          sections,
        },
      },
    };
  }

  /**
   * Obtiene la fecha y hora actual en la zona horaria de Colombia (America/Bogota, UTC-5)
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
   * Obtiene la fecha de hoy en Colombia en formato YYYY-MM-DD
   */
  public static getHoyColombiaStr(): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    return `${y}-${m}-${d}`;
  }

  /**
   * Formatea un Date a YYYY-MM-DD
   */
  public static formatearIso(d: Date): string {
    const anio = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  private static interpretarFecha(input: string): string | null {
    if (!input) return null;
    const limpio = input.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const hoy = this.getFechaHoraColombia();

    const isoMatch = limpio.match(/(20\d{2}-\d{2}-\d{2})/);
    if (isoMatch) return isoMatch[1];

    if (limpio.includes('pasado manana') || limpio === '3') {
      const p = new Date(hoy);
      p.setDate(hoy.getDate() + 2);
      return this.formatearIso(p);
    }
    if (limpio.includes('hoy') || limpio === '1') {
      return this.formatearIso(hoy);
    }
    if (limpio.includes('manana') || limpio === '2') {
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
      const d = new Date(anio, mes, dia);
      if (!matchBarra[3] && d < hoy && (hoy.getTime() - d.getTime()) > 86400000) {
        d.setFullYear(anio + 1);
      }
      return this.formatearIso(d);
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

        const fechaCalculada = new Date(hoy);
        fechaCalculada.setDate(hoy.getDate() + diff);
        return this.formatearIso(fechaCalculada);
      }
    }

    return null;
  }

  private static async manejarSeleccionFecha(input: string, session: UserSession): Promise<BotResponse> {
    const inputLimpio = input.toLowerCase().trim();

    if (inputLimpio === 'fecha_personalizada' || inputLimpio.includes('otra fecha') || inputLimpio === 'otra') {
      return {
        texto: `📅 *Escribe la fecha que deseas para tu cita:*\n\nPuedes escribirla con total libertad como prefieras:\n` +
          `• Por nombre del mes: *"18 de octubre"*, *"5 de noviembre"*\n` +
          `• Por números: *"18/10"*, *"25/11/2026"*\n` +
          `• Por día relativo: *"el próximo viernes"*, *"el otro sábado"*\n\n` +
          `✍️ Escribe tu fecha aquí abajo:`,
      };
    }

    const fecha = this.interpretarFecha(input);

    if (!fecha) {
      return {
        texto: '⚠️ No entendí la fecha. Puedes seleccionar una fecha sugerida en el menú tocando *Elegir Fecha*, o escribir libremente la fecha que quieras (ej. *"18 de octubre"*, *"el próximo viernes"* o *"15/10"*).',
      };
    }

    const hoyStr = this.getHoyColombiaStr();
    if (fecha < hoyStr) {
      return {
        texto: `⚠️ La fecha que ingresaste (*${fecha}*) ya pasó. Por favor escribe una fecha futura (ejemplo: *"18 de octubre"* o *"el próximo sábado"*).`,
      };
    }

    session.fechaSeleccionada = fecha;
    session.paso = 'SELECCION_HORA';

    const horarios: HorarioDisponible[] = await BookingService.getHorariosDisponibles(session.canchaSeleccionada!.id, fecha);
    const disponibles = horarios.filter((h: HorarioDisponible) => h.disponible);
    session.horariosDisponibles = disponibles;

    if (disponibles.length === 0) {
      session.paso = 'SELECCION_FECHA';
      return {
        texto: `❌ No hay horarios disponibles para el *${fecha}* con *${session.canchaSeleccionada!.nombre}*.\nPor favor selecciona otra fecha desde el menú desplegable.`,
      };
    }

    const filas1Hora: InteractiveRow[] = [];
    const filas2Horas: InteractiveRow[] = [];

    for (const h of disponibles.slice(0, 5)) {
      const precioFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(h.precio);
      filas1Hora.push({
        id: `hora_${h.hora_inicio.slice(0, 5)}`,
        title: `${h.hora_inicio.slice(0, 5)} a ${h.hora_fin.slice(0, 5)} (1h)`.slice(0, 24),
        description: `${precioFmt} • 60 min`.slice(0, 72),
      });
    }

    for (let i = 0; i < disponibles.length - 1; i++) {
      const h1 = disponibles[i];
      const h2 = disponibles[i + 1];
      if (h1 && h2 && h1.hora_fin === h2.hora_inicio && filas2Horas.length < 4) {
        const precioTotal2h = h1.precio + h2.precio;
        const precioTotalFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(precioTotal2h);
        filas2Horas.push({
          id: `hora2_${h1.hora_inicio.slice(0, 5)}`,
          title: `${h1.hora_inicio.slice(0, 5)} a ${h2.hora_fin.slice(0, 5)} (2h)`.slice(0, 24),
          description: `${precioTotalFmt} • 120 min seguidos`.slice(0, 72),
        });
      }
    }

    const sections: InteractiveSection[] = [];
    if (filas1Hora.length > 0) {
      sections.push({ title: 'Turnos de 1 Hora', rows: filas1Hora });
    }
    if (filas2Horas.length > 0) {
      sections.push({ title: 'Turnos de 2 Horas', rows: filas2Horas });
    }

    const texto = `📅 *${session.canchaSeleccionada!.nombre}* el *${fecha}*\n\n` +
      `¡Hay turnos disponibles! Despliega el menú a continuación para seleccionar el horario:\n` +
      `• _(Si necesitas un horario especial o ayuda, escribe *ASESOR* para hablar con una encargada)_`;

    return {
      texto,
      interactive: {
        type: 'list',
        header: 'Horarios Disponibles',
        body: texto,
        footer: 'Elige del menú o escribe ASESOR',
        action: {
          button: 'Elegir Horario',
          sections,
        },
      },
    };
  }

  private static async manejarSeleccionHora(
    input: string,
    session: UserSession,
    telefono: string,
    complejo: Complejo
  ): Promise<BotResponse> {
    if (!session.horariosDisponibles || session.horariosDisponibles.length === 0) {
      session.paso = 'SELECCION_FECHA';
      return { texto: '⚠️ Horarios no cargados. Por favor selecciona nuevamente la fecha.' };
    }

    const esBloque2h = input.startsWith('hora2_') || input.includes('2 horas') || input.includes('2h');
    let horario: HorarioDisponible | undefined;
    let horaIniNorm = '';
    let horaFinNorm = '';
    let precioTotal = 0;

    if (esBloque2h) {
      const horaLimpia = input.replace('hora2_', '').replace('hora_', '').slice(0, 5);
      const h1Idx = session.horariosDisponibles.findIndex((h) => h.hora_inicio.startsWith(horaLimpia));
      const h1 = session.horariosDisponibles[h1Idx];
      const h2 = session.horariosDisponibles[h1Idx + 1];

      if (h1 && h2 && h1.hora_fin === h2.hora_inicio) {
        horario = h1;
        horaIniNorm = h1.hora_inicio.slice(0, 5);
        horaFinNorm = h2.hora_fin.slice(0, 5);
        precioTotal = h1.precio + h2.precio;
      } else if (h1) {
        horario = h1;
        horaIniNorm = h1.hora_inicio.slice(0, 5);
        horaFinNorm = h1.hora_fin.slice(0, 5);
        precioTotal = h1.precio;
      }
    } else {
      if (input.startsWith('hora_')) {
        const horaLimpia = input.replace('hora_', '').slice(0, 5);
        horario = session.horariosDisponibles.find((h) => h.hora_inicio.startsWith(horaLimpia));
      } else {
        const idx = parseInt(input, 10) - 1;
        if (!isNaN(idx) && session.horariosDisponibles[idx]) {
          horario = session.horariosDisponibles[idx];
        } else {
          horario = session.horariosDisponibles.find((h) => input.includes(h.hora_inicio.slice(0, 5)));
        }
      }
      if (horario) {
        horaIniNorm = horario.hora_inicio.slice(0, 5);
        horaFinNorm = horario.hora_fin.slice(0, 5);
        precioTotal = horario.precio;
      }
    }

    if (!horario || !horaIniNorm || !horaFinNorm) {
      return {
        texto: '⚠️ Opción de horario inválida. Despliega el menú y selecciona uno de los turnos disponibles.',
      };
    }

    session.horarioSeleccionado = horario;

    const cliente = await BookingService.getOrCreateCliente(telefono);

    const formatearTimestampIso = (fecha: string, hora: string): string => {
      const match = hora.match(/^(\d{1,2}):(\d{2})/);
      const hh = match ? match[1].padStart(2, '0') : '00';
      const mm = match ? match[2].padStart(2, '0') : '00';
      return `${fecha}T${hh}:${mm}:00Z`;
    };

    const fechaInicioIso = formatearTimestampIso(session.fechaSeleccionada!, horaIniNorm);
    const fechaFinIso = formatearTimestampIso(session.fechaSeleccionada!, horaFinNorm);

    try {
      const horariosActuales = await BookingService.getHorariosDisponibles(session.canchaSeleccionada!.id, session.fechaSeleccionada!);
      const turnoLibre = horariosActuales.find((h) => h.hora_inicio.startsWith(horaIniNorm) && h.disponible);
      if (!turnoLibre) {
        return {
          texto: '⚠️ *Horario no disponible*\n\nEste turno acaba de ser apartado por otra persona o se encuentra bloqueado. Por favor despliega el menú para seleccionar un horario libre.',
        };
      }

      const exigeAnticipo = requiereAnticipoParaFecha(complejo, session.fechaSeleccionada);
      const montoFijo = getMontoAnticipoFijo(complejo);
      const anticipoCalculado = exigeAnticipo ? Math.min(precioTotal, montoFijo) : 0;

      const reserva = await BookingService.crearPreReserva({
        canchaId: session.canchaSeleccionada!.id,
        clienteId: cliente.id,
        fechaInicio: fechaInicioIso,
        fechaFin: fechaFinIso,
        valorTotal: precioTotal,
        montoAnticipo: anticipoCalculado,
        exigeAnticipo: exigeAnticipo,
      });

      const totalFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(precioTotal);

      // CASO A: EL ESCENARIO NO EXIGE ABONO / ANTICIPO (CONFIRMACIÓN INMEDIATA)
      if (!exigeAnticipo) {
        session.reservaId = reserva.id;
        session.paso = 'INICIO';

        return {
          texto: `🌿✨ *¡CITA 100% CONFIRMADA EN ÓPALO NAILS SPA!* ✨🌿\n\n` +
            `🏢 Spa: *${complejo.nombre || 'Ópalo Nails Spa'}*\n` +
            `👩‍🎨 Especialista: *${session.canchaSeleccionada!.nombre}*\n` +
            `📅 Fecha: *${session.fechaSeleccionada}*\n` +
            `⏰ Horario: *${horaIniNorm} - ${horaFinNorm}*\n` +
            `💰 Valor: *${totalFmt}*\n\n` +
            `📍 Te esperamos en *${complejo.direccion || 'Pereira, Risaralda, Colombia'}*.\n` +
            `📸 Instagram: https://www.instagram.com/opalo_nailspereira?cplk=MW9ncWJwMG50anlsMQ==\n` +
            `✨ El pago lo realizas directamente en el spa al recibir tu atención (sin cobro anticipado).\n\n` +
            `🔔 Te enviaremos un recordatorio 1 día antes con opciones para gestionar tu cita. ¡Nos vemos para consentirte reina! 🤍✨`,
        };
      }

      // CASO B: EL ESCENARIO EXIGE ABONO (BLOQUEO TEMPORAL Y ESPERA DE COMPROBANTE)
      session.reservaId = reserva.id;
      session.paso = 'ESPERA_PAGO';

      const anticipoFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(reserva.valor_anticipo_requerido);
      const titular = complejo.titular_cuenta || complejo.nombre || 'Ópalo Nails Spa';
      const nequi = complejo.nequi_numero || 'Consultar con administración';

      return {
        texto: `🔒 *¡Cita apartada temporalmente por 30 minutos!*\n\n` +
          `🏢 Spa: *${complejo.nombre || 'Ópalo Nails Spa'}*\n` +
          `👩‍🎨 Especialista: *${session.canchaSeleccionada!.nombre}*\n` +
          `📅 Fecha: *${session.fechaSeleccionada}*\n` +
          `⏰ Horario: *${horaIniNorm} - ${horaFinNorm}*\n` +
          `💰 Total: *${totalFmt}*\n` +
          (Number(reserva.valor_anticipo_requerido) >= precioTotal
            ? `💵 Valor a transferir (100% del servicio): *${anticipoFmt}*\n` +
              `🏠 Saldo restante en el spa: *$0* (¡Servicio cubierto!)\n\n`
            : `💵 Anticipo requerido: *${anticipoFmt}*\n\n`) +
          `📲 *Cuentas Oficiales de Recaudo:*\n` +
          `• Nequi / Bancolombia: *${nequi}*\n` +
          `• Titular: *${titular}*\n\n` +
          `📸 *¿Cómo confirmar?*\n` +
          `Realiza la transferencia y *envía aquí la foto o captura del comprobante*.\n` +
          `🤖 Nuestro sistema con Inteligencia Artificial lo auditará al instante para confirmar tu cita.\n\n` +
          `💬 _¿Tienes alguna duda con el pago o tu cita? Escribe *ASESOR* en cualquier momento._`,
      };
    } catch (err: any) {
      console.error('Error al apartar turno en reserva:', err);
      return {
        texto: this.formatearErrorAmigable(err),
      };
    }
  }

  private static formatearErrorAmigable(err: any): string {
    const raw = (err?.message || '').toLowerCase();

    if (
      raw.includes('apartado por otra') ||
      raw.includes('conflict') ||
      raw.includes('23p01') ||
      raw.includes('solapad') ||
      raw.includes('no_doble_reserva')
    ) {
      return (
        '⚠️ *¡Horario no disponible!*\n\n' +
        'Este turno acaba de ser apartado por otra persona hace un momento.\n' +
        'Por favor selecciona otro horario disponible o escribe *MENU* para volver a empezar.'
      );
    }

    if (raw.includes('bloquead') || raw.includes('mantenimiento') || raw.includes('inactiva')) {
      return (
        '⚠️ *Horario no disponible*\n\n' +
        'Esta especialista se encuentra temporalmente fuera de servicio en ese rango horario.\n' +
        'Por favor selecciona otro horario o escribe *MENU*.'
      );
    }

    return (
      '⚠️ *No pudimos apartar el turno en este momento*\n\n' +
      'Por favor intenta seleccionar otro horario o escribe *MENU* para volver al inicio.'
    );
  }

  private static async manejarEsperaPago(
    input: string,
    session: UserSession,
    complejo: Complejo,
    mediaId?: string,
    mediaType?: string,
    directImageBuffer?: Buffer
  ): Promise<BotResponse> {
    if (!session.reservaId) {
      session.paso = 'INICIO';
      return { texto: 'No hay ninguna reserva en proceso. Escribe *HOLA* para iniciar una nueva.' };
    }

    const montoFijo = getMontoAnticipoFijo(complejo);
    const anticipoRequerido = session.horarioSeleccionado?.precio
      ? Math.min(session.horarioSeleccionado.precio, montoFijo)
      : montoFijo;

    if (directImageBuffer) {
      const mediaDescargado = { buffer: directImageBuffer, mimeType: mediaType || 'image/jpeg' };

      if (mediaDescargado) {
        const cuentasOficiales = [complejo.nequi_numero, complejo.daviplata_numero].filter(Boolean) as string[];
        const analisis = await ReceiptVerificationService.analizarComprobante(
          mediaDescargado.buffer,
          mediaDescargado.mimeType,
          anticipoRequerido,
          cuentasOficiales,
          complejo.titular_cuenta
        );

        if (analisis.es_comprobante_bancario === false) {
          return {
            texto: `⚠️ *Comprobante no válido* 📄❌\n\nNo detectamos que la imagen enviada corresponda a un comprobante de transferencia bancaria válido.`,
          };
        }

        if (analisis.cuenta_coincide === false) {
          return {
            texto: `⚠️ *Cuenta no válida* 🏦❌\n\nEste comprobante fue enviado a una cuenta diferente a las autorizadas por *${complejo.nombre || 'Ópalo Nails Spa'}*.`,
          };
        }

        if (analisis.fecha_coincide === false) {
          return {
            texto: `⚠️ *Fecha no válida* 📅❌\n\nEste comprobante es de otra fecha. La transferencia debe corresponder al día de hoy.`,
          };
        }

        if (analisis.monto_coincide === false) {
          return {
            texto: `⚠️ *Monto no válido* 💰❌\n\nEl monto de este comprobante no cubre el abono solicitado para confirmar la cita.`,
          };
        }

        if (analisis.es_sospechoso_fraude || analisis.confianza === 'BAJA') {
          const motivos = analisis.indicios_fraude.join(', ') || 'Inconsistencia tipográfica o formato dudoso';
          await supabase
            .from('reservas')
            .update({ notas: `⚠️ [COMPROBANTE_DUDOSO_REVISION_MANUAL] ${motivos} - ${analisis.explicacion}` })
            .eq('id', session.reservaId);

          await supabase
            .from('pagos_anticipos')
            .insert({
              reserva_id: session.reservaId,
              metodo: 'nequi',
              monto: analisis.monto_detectado || anticipoRequerido,
              referencia_transaccion: analisis.referencia_detectada || `WA_DUDOSO_${Date.now()}`,
              estado: 'pendiente',
              comprobante_url: mediaId,
              revisado_por: 'PENDIENTE_ADMIN',
              notas_admin: `Comprobante dudoso en forma: ${motivos} - ${analisis.explicacion}`,
            });

          return {
            texto: `📸 *¡Comprobante recibido en revisión especial!* ⏳\n\n` +
              `Detectamos que el comprobante enviado presenta un aspecto visual o formato que requiere validación por parte del equipo del spa (${motivos}).\n\n` +
              `🔒 Tu turno sigue apartado temporalmente mientras *la administración de ${complejo.nombre || 'Ópalo Nails Spa'} revisa el abono en la cuenta bancaria.* Te notificaremos en breves minutos ✨🤍.`,
          };
        }

        const refFinal = analisis.referencia_detectada || `IA_WA_${Date.now()}`;
        if (analisis.referencia_detectada) {
          const yaUsada = await ReceiptVerificationService.esReferenciaDuplicada(analisis.referencia_detectada);
          if (yaUsada) {
            return {
              texto: `⚠️ *Comprobante ya utilizado* 📄❌\n\nEste comprobante ya fue registrado en otra reserva previa. Por favor envía un comprobante válido.`,
            };
          }
        }

        await BookingService.registrarPagoAnticipo({
          reservaId: session.reservaId,
          metodo: 'nequi',
          monto: analisis.monto_detectado || anticipoRequerido,
          referencia: refFinal,
          estado: 'aprobado',
          revisadoPor: 'IA_GEMINI',
          notasAdmin: `Auditado y aprobado automáticamente por IA (3 filtros superados): ${analisis.explicacion}`,
        });

        session.reservaId = undefined;
        session.paso = 'INICIO';

        const montoFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(analisis.monto_detectado || anticipoRequerido);

        return {
          texto: `🤖⚡ *¡PAGO AUDITADO Y APROBADO POR IA!*\n\n` +
            `✅ Comprobante verificado con éxito:\n` +
            `• Referencia: *#${refFinal}*\n` +
            `• Monto: *${montoFmt}*\n` +
            `• Destino: *${analisis.destinatario_detectado || complejo.nombre || 'Ópalo Nails Spa'}*\n\n` +
            `🌿✨ *¡CITA 100% CONFIRMADA EN ÓPALO NAILS SPA!* ✨🌿\n` +
            `🏢 Spa: *${complejo.nombre || 'Ópalo Nails Spa'}*\n` +
            `👩‍🎨 Especialista: *${session.canchaSeleccionada?.nombre}*\n` +
            `📅 Fecha: *${session.fechaSeleccionada}*\n` +
            `⏰ Horario: *${session.horarioSeleccionado?.hora_inicio.slice(0, 5)} - ${session.horarioSeleccionado?.hora_fin.slice(0, 5)}*\n\n` +
            `🔔 Te enviaremos un recordatorio previo a tu cita. ¡Nos vemos para consentirte reina! 🤍✨`,
        };
      }
    }

    await supabase
      .from('reservas')
      .update({ notas: `Cliente reportó pago manual vía texto: "${input}". Pendiente de verificación por administrador.` })
      .eq('id', session.reservaId);

    return {
      texto: `📄 *Datos de pago registrados: "${input}"*\n\n` +
        `Tu comprobante/referencia ha sido enviado al visor de control de *${complejo.nombre || 'Ópalo Nails Spa'}*.\n\n` +
        `⏳ Una administradora lo validará en la cuenta bancaria y recibirás un mensaje de confirmación por este chat en cuanto sea aprobado.`,
    };
  }

  /**
   * Procesa la recepción de comprobantes de anticipo enviados por WhatsApp
   */
  private static async manejarRecepcionComprobante(
    telefono: string,
    complejo: Complejo,
    session: UserSession,
    mediaId?: string,
    mediaType?: string,
    texto?: string,
    directImageBuffer?: Buffer
  ): Promise<BotResponse | null> {
    let reservaTarget: any = null;
    const cleanTel = telefono.replace(/\D/g, '');
    const ultimos10 = cleanTel.slice(-10);

    const { data: clientes } = await supabase
      .from('clientes')
      .select('id, telefono_wa');

    const clienteIds = (clientes || [])
      .filter((c) => {
        if (!c.telefono_wa) return false;
        const cClean = String(c.telefono_wa).replace(/\D/g, '');
        return cClean.includes(ultimos10) || ultimos10.includes(cClean);
      })
      .map((c) => c.id);

    if (clienteIds.length > 0) {
      let { data: reservas, error: errRes } = await supabase
        .from('reservas')
        .select('*, canchas!inner(*), clientes(*)')
        .in('cliente_id', clienteIds)
        .eq('canchas.complejo_id', complejo.id)
        .eq('estado', 'pendiente_pago')
        .order('created_at', { ascending: false });

      if (errRes) {
        const { data: resFallback } = await supabase
          .from('reservas')
          .select('*, canchas(*), clientes(*)')
          .in('cliente_id', clienteIds)
          .eq('estado', 'pendiente_pago');
        reservas = resFallback;
      }

      if (reservas && reservas.length > 0) {
        reservaTarget = reservas[0];
        session.reservaId = reservaTarget.id;
      }
    }

    if (!reservaTarget && session.reservaId) {
      const { data } = await supabase
        .from('reservas')
        .select('*, canchas(*), clientes(*)')
        .eq('id', session.reservaId)
        .eq('estado', 'pendiente_pago')
        .maybeSingle();
      if (data) reservaTarget = data;
    }

    if (!reservaTarget) {
      if (mediaId || directImageBuffer) {
        return {
          texto: `✨ ¡Hola! Recibimos tu imagen, pero en este momento no encontramos una cita pendiente de anticipo a tu nombre.\n\n` +
            `Si deseas consultar servicios o apartar tu cita en *${complejo.nombre || 'Ópalo Nails Spa'}*, escribe *HOLA* o *MENU* 🌿🤍.`,
        };
      }
      return null;
    }

    if (directImageBuffer) {
      const anticipoRequerido = reservaTarget.valor_anticipo_requerido || getMontoAnticipoFijo(complejo);
      const mediaDescargado = { buffer: directImageBuffer, mimeType: mediaType || 'image/jpeg' };

      const cuentasOficiales = [complejo.nequi_numero, complejo.daviplata_numero].filter(Boolean) as string[];

      const analisis = await ReceiptVerificationService.analizarComprobante(
        mediaDescargado.buffer,
        mediaDescargado.mimeType,
        anticipoRequerido,
        cuentasOficiales,
        complejo.titular_cuenta
      );

      if (analisis.es_comprobante_bancario === false) {
        return {
          texto: `⚠️ *Comprobante no válido* 📄❌\n\nNo detectamos que la imagen enviada corresponda a un comprobante de transferencia bancaria válido.`,
        };
      }

      if (analisis.cuenta_coincide === false) {
        return {
          texto: `⚠️ *Cuenta no válida* 🏦❌\n\nEste comprobante fue enviado a una cuenta diferente a las autorizadas por *${complejo.nombre || 'Ópalo Nails Spa'}*.`,
        };
      }

      if (analisis.fecha_coincide === false) {
        return {
          texto: `⚠️ *Fecha no válida* 📅❌\n\nEste comprobante es de otra fecha. La transferencia debe corresponder al día de hoy.`,
        };
      }

      if (analisis.monto_coincide === false) {
        return {
          texto: `⚠️ *Monto no válido* 💰❌\n\nEl monto de este comprobante no cubre el abono solicitado para confirmar la cita.`,
        };
      }

      if (analisis.es_sospechoso_fraude || analisis.confianza === 'BAJA') {
        const indicios = analisis.indicios_fraude.join(', ') || 'Inconsistencia visual o formato dudoso';
        await supabase
          .from('reservas')
          .update({
            expiracion_reserva: null,
            notas: `⚠️ [COMPROBANTE_DUDOSO_REVISION_MANUAL] ${indicios} - ${analisis.explicacion}`,
          })
          .eq('id', reservaTarget.id);

        await supabase
          .from('pagos_anticipos')
          .insert({
            reserva_id: reservaTarget.id,
            metodo: 'transferencia_bancaria',
            monto: analisis.monto_detectado || anticipoRequerido,
            referencia_transaccion: analisis.referencia_detectada || `WA_DUDOSO_${Date.now()}`,
            estado: 'pendiente',
            comprobante_url: mediaId,
            notas_admin: `Comprobante dudoso en forma: ${indicios} - ${analisis.explicacion}`,
            revisado_por: 'PENDIENTE_ADMIN',
          });

        return {
          texto: `📸 *¡Comprobante recibido en revisión especial!* ⏳\n\n` +
            `Detectamos que el soporte de pago enviado presenta un formato o aspecto visual que requiere validación manual por parte del equipo del spa (${indicios}).\n\n` +
            `🔒 *¡Tu turno está asegurado y protegido!* El límite de 30 minutos ha sido pausado. Una administradora revisará directamente la cuenta bancaria antes de confirmar. Te notificaremos en breves minutos ✨🤍.`,
        };
      }

      const refFinal = analisis.referencia_detectada || `IA_${Date.now()}`;
      if (analisis.referencia_detectada) {
        const yaUsada = await ReceiptVerificationService.esReferenciaDuplicada(analisis.referencia_detectada);
        if (yaUsada) {
          return {
            texto: `⚠️ *Comprobante ya utilizado* 📄❌\n\nEste comprobante ya fue registrado en otra reserva previa. Por favor envía un comprobante válido.`,
          };
        }
      }

      const abonoMonto = analisis.monto_detectado || anticipoRequerido;

      await supabase
        .from('pagos_anticipos')
        .insert({
          reserva_id: reservaTarget.id,
          metodo: 'transferencia_bancaria',
          monto: abonoMonto,
          referencia_transaccion: refFinal,
          estado: 'aprobado',
          comprobante_url: mediaId,
          revisado_por: 'IA_GEMINI',
          notas_admin: `Auditado y aprobado automáticamente por IA (3 filtros superados): ${analisis.explicacion}`,
        });

      await supabase
        .from('reservas')
        .update({
          estado: 'confirmada',
          expiracion_reserva: null,
          notas: `[CONFIRMADA_AUTOMATICA_IA] Ref: ${refFinal} - Abono: ${abonoMonto} COP. ${reservaTarget.notas || ''}`.trim(),
        })
        .eq('id', reservaTarget.id);

      session.reservaId = undefined;
      session.paso = 'INICIO';

      const clienteNombre = reservaTarget.clientes?.nombre || 'reina';
      const nombreManicurista = reservaTarget.canchas?.nombre || 'tu especialista';
      const fechaCita = new Date(reservaTarget.fecha_inicio).toLocaleDateString('es-CO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'America/Bogota',
      });
      const horaInicio = new Date(reservaTarget.fecha_inicio).toLocaleTimeString('es-CO', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Bogota',
      });
      const horaFin = reservaTarget.fecha_fin
        ? new Date(reservaTarget.fecha_fin).toLocaleTimeString('es-CO', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'America/Bogota',
          })
        : '';

      const abonoFmt = '$' + Number(abonoMonto).toLocaleString('es-CO');
      const saldoPendiente = Math.max(0, (reservaTarget.valor_total || 0) - abonoMonto);
      const saldoFmt = '$' + Number(saldoPendiente).toLocaleString('es-CO');

      return {
        texto:
          `🌿✨ *¡CITA 100% CONFIRMADA EN ÓPALO NAILS SPA!* ✨🌿\n\n` +
          `¡Hola *${clienteNombre}*! Tu abono de *${abonoFmt}* fue verificado y aprobado con éxito por nuestro sistema inteligente 🤍.\n\n` +
          `📋 *Detalles de tu cita:*\n` +
          `👩‍🎨 Especialista: *${nombreManicurista}*\n` +
          `📅 Fecha: *${fechaCita}*\n` +
          `⏰ Horario: *${horaInicio}${horaFin ? ` a ${horaFin}` : ''}*\n` +
          `💰 Abono recibido: *${abonoFmt}*\n` +
          `💵 Saldo restante a pagar en el spa: *${saldoFmt}*\n` +
          `${refFinal ? `🔖 Nro. de comprobante: *#${refFinal}*\n` : ''}\n` +
          `📍 Lugar: *${complejo.direccion || 'Pereira, Risaralda, Colombia'}*\n` +
          `📸 Instagram: https://www.instagram.com/opalo_nailspereira?cplk=MW9ncWJwMG50anlsMQ==\n\n` +
          `🔔 Te recordaremos tu cita con anticipación. ¡Estamos listas para consentirte y dejarte soñada! 💅🌿✨`,
      };
    }

    if (texto) {
      const tLower = texto.toLowerCase().trim();

      if (tLower === 'cancelar' || tLower === 'cancelo' || tLower === 'cancelar cita' || tLower === '2') {
        const notasActuales = reservaTarget.notas || '';
        await supabase
          .from('reservas')
          .update({
            estado: 'cancelada',
            notas: `${notasActuales} [CANCELADA_POR_CLIENTA]`.trim(),
          })
          .eq('id', reservaTarget.id);

        session.reservaId = undefined;
        session.paso = 'INICIO';

        return {
          texto:
            `🌿 *PRE-RESERVA CANCELADA* 🤍\n\n` +
            `Hemos liberado el turno pre-apartado con éxito.\n\n` +
            `Cuando desees agendar un nuevo horario o servicio, escribe *HOLA* o *MENU*. ¡Te esperamos en *Ópalo Nails Spa*! ✨`,
        };
      }

      const inputTexto = (texto || '').trim().toLowerCase();
      const esConsultaPago = ['comprobante', 'abono', 'pago', 'transferencia', 'transferi', 'nequi', 'daviplata', 'cuenta', 'cuentas', 'soporte', 'pagar'].some(k => inputTexto.includes(k));
      if (!esConsultaPago && session.paso !== 'ESPERA_PAGO') {
        return null;
      }

      const anticipoRequerido = reservaTarget.valor_anticipo_requerido || getMontoAnticipoFijo(complejo);
      const anticipoFmt = '$' + Number(anticipoRequerido).toLocaleString('es-CO');
      const nequiNum = complejo.nequi_numero || 'Consultar con administración';
      const daviNum = complejo.daviplata_numero || nequiNum;
      const titular = complejo.titular_cuenta || 'Ópalo Nails Spa';
      const clienteNombre = reservaTarget.clientes?.nombre || 'reina';
      const nombreManicurista = reservaTarget.canchas?.nombre || 'tu especialista';

      const horaInicio = new Date(reservaTarget.fecha_inicio).toLocaleTimeString('es-CO', {
        timeZone: 'America/Bogota',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const fechaCita = new Date(reservaTarget.fecha_inicio).toLocaleDateString('es-CO', {
        timeZone: 'America/Bogota',
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
      });

      let tiempoRestanteMsg = 'tienes 30 minutos desde tu pre-reserva para enviar el comprobante';
      if (reservaTarget.expiracion_reserva) {
        const expMs = new Date(reservaTarget.expiracion_reserva).getTime();
        const diffMin = Math.round((expMs - Date.now()) / (1000 * 60));
        if (diffMin > 0) {
          tiempoRestanteMsg = `te quedan aproximadamente *${diffMin} minutos* antes de que el turno se libere`;
        }
      }

      return {
        texto:
          `🌿 *¡Hola ${clienteNombre}! Seguimos con tu turno pre-apartado en Ópalo Nails Spa* 🤍\n\n` +
          `👩‍🎨 Especialista: *${nombreManicurista}*\n` +
          `📅 Fecha: *${fechaCita}* a las *${horaInicio}*\n` +
          `💳 Abono requerido: *${anticipoFmt}*\n\n` +
          `───────────────\n` +
          `📲 *CUENTAS PARA TRANSFERIR:*\n` +
          `• Nequi: *${nequiNum}*\n` +
          `• Bancolombia: *${daviNum}*\n` +
          `• Titular: *${titular}*\n\n` +
          `📸 *Para confirmar definitivamente tu cita:*\n` +
          `Por favor envía la foto o captura del comprobante por este mismo chat 📄✨ (${tiempoRestanteMsg}).\n\n` +
          `*(Si deseas cancelar esta pre-reserva para iniciar otra, escribe CANCELAR)*`,
      };
    }

    return null;
  }

  /**
   * Extrae cancha, fecha y hora cuando el cliente escribe con contexto natural
   */
  private static extraerContextoReserva(texto: string, canchas: Cancha[]): {
    cancha?: Cancha;
    fecha?: string;
    hora?: string;
  } {
    const t = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    let canchaMatch: Cancha | undefined;
    for (const c of canchas) {
      const nom = c.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const deporte = c.deporte.toLowerCase();
      const palabras = nom.split(/[\s\-()]+/);
      const coincide = palabras.some((p) => p.length >= 4 && t.includes(p)) || t.includes(deporte);
      if (coincide) {
        canchaMatch = c;
        break;
      }
    }

    let fechaMatch: string | undefined;
    const palabrasTexto = texto.split(/\s+/);
    for (let i = 0; i < palabrasTexto.length; i++) {
      const fragmento = palabrasTexto.slice(i, i + 3).join(' ');
      const f = this.interpretarFecha(fragmento);
      if (f) {
        fechaMatch = f;
        break;
      }
    }
    if (!fechaMatch && (t.includes('hoy') || t.includes('manana') || t.includes('viernes') || t.includes('sabado') || t.includes('domingo'))) {
      fechaMatch = this.interpretarFecha(t) || undefined;
    }

    let horaMatch: string | undefined;
    const horaRegex = /(?:a\s+las\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|de la manana|de la tarde|de la noche)?/i;
    const hMatch = texto.match(horaRegex);
    if (hMatch) {
      let num = parseInt(hMatch[1], 10);
      const sufijo = (hMatch[3] || '').toLowerCase();
      if ((sufijo.includes('pm') || sufijo.includes('tarde') || sufijo.includes('noche')) && num < 12) {
        num += 12;
      }
      if (num >= 6 && num <= 23) {
        horaMatch = `${String(num).padStart(2, '0')}:00`;
      }
    }

    return {
      cancha: canchaMatch,
      fecha: fechaMatch,
      hora: horaMatch,
    };
  }

  /**
   * Procesa respuestas al recordatorio:
   * 1. Confirmar cita
   * 2. Cancelar cita
   * 3. Cambiar fecha (Reagendar con enlace web)
   */
  private static async manejarRespuestaRecordatorio(
    telefono: string,
    texto: string,
    input: string,
    complejo: Complejo,
    session: UserSession
  ): Promise<BotResponse | null> {
    const matchId = texto.match(/(?:confirmar|cancelar|reagendar|cambiar_fecha)_cita_([a-zA-Z0-9-]+)/i);
    const idDirecto = matchId ? matchId[1] : null;

    const lineas = texto.split('\n').map((l) => l.trim().toLowerCase()).filter(Boolean);
    const ultimaLinea = lineas.length > 0 ? lineas[lineas.length - 1] : input;
    const opcionFinal = ultimaLinea.replace(/^[📅✅❌1️⃣2️⃣3️⃣\s\.\-]+/, '').trim();

    let esConfirmar = false;
    let esCancelar = false;
    let esReagendar = false;

    if (idDirecto !== null) {
      if (texto.includes('confirmar_cita_')) esConfirmar = true;
      else if (texto.includes('cancelar_cita_')) esCancelar = true;
      else if (texto.includes('reagendar_cita_') || texto.includes('cambiar_fecha_')) esReagendar = true;
    } else if (lineas.length > 3) {
      if (
        opcionFinal.includes('cambiar fecha') ||
        opcionFinal.includes('reagendar') ||
        opcionFinal.includes('cambio de fecha') ||
        opcionFinal === '3'
      ) {
        esReagendar = true;
      } else if (
        opcionFinal.includes('cancelar') ||
        opcionFinal === '2'
      ) {
        esCancelar = true;
      } else if (
        opcionFinal.includes('confirmar') ||
        opcionFinal.includes('confirmo') ||
        opcionFinal === '1'
      ) {
        esConfirmar = true;
      }
    } else {
      if (
        input === '3' ||
        input === 'cambiar fecha' ||
        input === 'reagendar' ||
        input === 'reprogramar' ||
        input === 'cambio de fecha' ||
        input.includes('cambiar fecha') ||
        input.includes('reagendar')
      ) {
        esReagendar = true;
      } else if (
        input === '2' ||
        input === 'cancelar cita' ||
        input === 'cancelar' ||
        input === 'cancelo' ||
        input.includes('cancelar cita')
      ) {
        esCancelar = true;
      } else if (
        input === '1' ||
        input === 'confirmar' ||
        input === 'confirmar cita' ||
        input === 'confirmo' ||
        input.includes('confirmar cita')
      ) {
        esConfirmar = true;
      }
    }

    if (!esConfirmar && !esCancelar && !esReagendar) {
      return null;
    }

    session.paso = 'INICIO';
    session.canchaSeleccionada = undefined;
    session.fechaSeleccionada = undefined;
    session.horariosDisponibles = undefined;

    let reserva: any = null;

    if (idDirecto) {
      const { data } = await supabase
        .from('reservas')
        .select('*, canchas!inner(*, complejos!inner(*)), clientes(*)')
        .eq('id', idDirecto)
        .maybeSingle();
      reserva = data;
    }

    if (!reserva) {
      const cleanTel = telefono.replace(/\D/g, '');
      const ultimos10 = cleanTel.slice(-10);
      const telVariaciones = Array.from(new Set([
        telefono,
        cleanTel,
        cleanTel.startsWith('57') ? cleanTel.slice(2) : `57${cleanTel}`,
        `+${cleanTel}`,
        `+57${ultimos10}`,
        ultimos10,
      ]));

      const { data: clientes } = await supabase
        .from('clientes')
        .select('id, telefono_wa');

      const clienteIds = (clientes || [])
        .filter((c) => {
          if (!c.telefono_wa) return false;
          const cClean = String(c.telefono_wa).replace(/\D/g, '');
          return (
            telVariaciones.includes(c.telefono_wa) ||
            telVariaciones.includes(cClean) ||
            cClean.slice(-10) === ultimos10
          );
        })
        .map((c) => c.id);

      if (clienteIds.length > 0) {
        const { data: proxReservas } = await supabase
          .from('reservas')
          .select('*, canchas!inner(*, complejos!inner(*)), clientes(*)')
          .in('cliente_id', clienteIds)
          .eq('canchas.complejo_id', complejo.id)
          .neq('estado', 'cancelada')
          .gte('fecha_inicio', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
          .order('fecha_inicio', { ascending: true })
          .limit(1);

        if (proxReservas && proxReservas.length > 0) {
          reserva = proxReservas[0];
        } else {
          const { data: altReservas } = await supabase
            .from('reservas')
            .select('*, canchas!inner(*, complejos!inner(*)), clientes(*)')
            .in('cliente_id', clienteIds)
            .neq('estado', 'cancelada')
            .gte('fecha_inicio', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
            .order('fecha_inicio', { ascending: true })
            .limit(1);

          if (altReservas && altReservas.length > 0) {
            reserva = altReservas[0];
          }
        }
      }
    }

    if (!reserva) {
      const baseUrl = process.env.FRONTEND_URL || 'https://opalo-nails-spa.vercel.app';
      const cleanTel = telefono.replace(/\D/g, '');
      const queryParams = new URLSearchParams();
      if (cleanTel) queryParams.set('tel', cleanTel);
      const urlAgenda = `${baseUrl}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

      if (esReagendar) {
        const textoSinCita =
          `🌿 *REAGENDAR CITA - ÓPALO NAILS SPA* 🌿\n\n` +
          `¡Hola reina! No encontramos una cita activa previa registrada con tu número (*${telefono}*) para reagendar en este momento.\n\n` +
          `👉 Pero no te preocupes, puedes elegir tu servicio, horario y especialista favorita directamente en nuestra agenda tocando el botón a continuación:\n\n` +
          `¡Te esperamos para consentirte! 🤍✨`;

        return {
          texto: textoSinCita,
          urlRedirect: urlAgenda,
          interactive: {
            type: 'cta_url',
            header: '✨ Abrir Agenda Spa',
            body: textoSinCita,
            footer: 'Ópalo Nails Spa',
            action: {
              name: 'cta_url',
              parameters: {
                display_text: '📅 Abrir Agenda',
                url: urlAgenda,
              },
            },
          },
        };
      }

      if (esConfirmar || esCancelar || idDirecto || input.includes('cita')) {
        return {
          texto: `✨ ¡Hola reina! No encontramos una cita activa registrada para confirmar o cancelar con este número en este momento.\n\nSi deseas agendar tu cita en *Ópalo Nails Spa*, escribe *MENU* o visita nuestra web:\n${baseUrl} 🤍`,
        };
      }

      return null;
    }

    const cancha = reserva.canchas as any;
    const complejoRes = cancha?.complejos as any || complejo;

    const fechaCita = new Date(reserva.fecha_inicio).toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
    });
    const horaInicio = new Date(reserva.fecha_inicio).toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    // CASO 1: CONFIRMAR CITA
    if (esConfirmar) {
      const notasActuales = reserva.notas || '';

      const tieneComprobanteAprobado = notasActuales.includes('[COMPROBANTE_VALIDO_IA]') || notasActuales.includes('[PAGO_APROBADO]');
      if (reserva.estado === 'pendiente_pago' && !tieneComprobanteAprobado) {
        const totalNum = Number(reserva.valor_total || 46000);
        const montoConfig = getMontoAnticipoFijo(complejoRes);
        const anticipoRequerido = reserva.valor_anticipo_requerido || Math.min(totalNum, montoConfig);
        const anticipoFmt = '$' + Number(anticipoRequerido).toLocaleString('es-CO');
        const totalFmt = '$' + totalNum.toLocaleString('es-CO');
        const saldoNum = Math.max(0, totalNum - anticipoRequerido);
        const saldoFmt = '$' + saldoNum.toLocaleString('es-CO');
        const esTotalidad = saldoNum === 0;

        const nequiNum = complejoRes.nequi_numero || 'Consultar con administración';
        const daviNum = complejoRes.daviplata_numero || nequiNum;
        const titular = complejoRes.titular_cuenta || 'Ópalo Nails Spa';

        return {
          texto:
            `🌿 *Hola ${reserva.clientes?.nombre || 'reina'}, tu turno está pre-apartado en Ópalo Nails Spa* 🤍\n\n` +
            `📅 Fecha: *${fechaCita}*\n` +
            `⏰ Hora: *${horaInicio}*\n` +
            `👩‍🎨 Especialista: *${cancha.nombre}*\n\n` +
            `💰 Total del servicio: *${totalFmt}*\n` +
            (esTotalidad
              ? `💳 *Valor a transferir (100% del servicio):* *${anticipoFmt}*\n` +
                `🏠 Saldo restante en el spa: *$0* (¡Servicio cubierto!)\n\n`
              : `💳 *Abono requerido:* *${anticipoFmt}*\n` +
                `🏠 Saldo restante en el spa: *${saldoFmt}*\n\n`) +
            `───────────────\n` +
            `📲 *CUENTAS OFICIALES PARA TRANSFERIR:*\n` +
            `• Nequi: *${nequiNum}*\n` +
            `• Bancolombia: *${daviNum}*\n` +
            `• Titular: *${titular}*\n\n` +
            `📸 *Para confirmar y asegurar tu cupo definitivamente:*\n` +
            `Por favor realiza la transferencia de ${esTotalidad ? `*${anticipoFmt}* (total del servicio)` : `*${anticipoFmt}*`} y envía la *foto o captura de pantalla del comprobante* por este mismo chat ✨.\n\n` +
            `¡Una vez recibamos tu comprobante, tu turno quedará 100% confirmado! 💅🌿`,
        };
      }

      if (!notasActuales.includes('[CONFIRMADA_POR_CLIENTA]')) {
        await supabase
          .from('reservas')
          .update({ notas: `${notasActuales} [CONFIRMADA_POR_CLIENTA]`.trim() })
          .eq('id', reserva.id);
      }

      const exigeAnticipo = requiereAnticipoParaFecha(complejoRes, reserva.fecha_inicio) || Number(reserva.valor_anticipo_requerido) > 0;
      let detallePagoConfirmado = '';
      if (exigeAnticipo) {
        detallePagoConfirmado = `\n💳 Tu abono de anticipo se encuentra registrado y validado. El saldo restante lo pagas al finalizar tu servicio en el spa.\n`;
      }

      return {
        texto:
          `🌿✨ *¡CITA CONFIRMADA EXITOSAMENTE!* ✨🌿\n\n` +
          `¡Muchísimas gracias reina! Tu asistencia para el *${fechaCita}* a las *${horaInicio}* con *${cancha.nombre}* en *Ópalo Nails Spa* está 100% reconfirmada.${detallePagoConfirmado}\n` +
          `📍 Te esperamos en *${complejoRes.direccion || 'Pereira, Risaralda, Colombia'}*.\n` +
          `📸 Instagram: https://www.instagram.com/opalo_nailspereira?cplk=MW9ncWJwMG50anlsMQ==\n` +
          `¡Nos vemos para consentirte y dejarte hermosa! 🤍✨`,
      };
    }

    // CASO 2: CANCELAR CITA
    if (esCancelar) {
      const notasActuales = reserva.notas || '';
      await supabase
        .from('reservas')
        .update({
          estado: 'cancelada',
          notas: `${notasActuales} [CANCELADA_POR_CLIENTA]`.trim(),
        })
        .eq('id', reserva.id);

      session.reservaId = undefined;
      session.paso = 'INICIO';

      return {
        texto:
          `🌿 *CITA CANCELADA — ÓPALO NAILS SPA*\n\n` +
          `Hemos cancelado tu cita del *${fechaCita}* a las *${horaInicio}* con *${cancha.nombre}* y liberado el cupo en la agenda.\n\n` +
          `Lamentamos que no puedas acompañarnos esta vez. Cuando desees volver a consentirte, puedes agendar en cualquier momento escribiendo *MENU* o desde nuestra web. ¡Que tengas un lindo día! 🤍`,
      };
    }

    // CASO 3: REAGENDAR (CAMBIAR FECHA)
    if (esReagendar) {
      const baseUrl = process.env.FRONTEND_URL || 'https://opalo-nails-spa.vercel.app';
      const cleanTel = telefono.replace(/\D/g, '');
      const linkReagendar = `${baseUrl}/?reagendar=${reserva.id}&tel=${cleanTel}`;

      const textoSinLink =
        `🌿 *REAGENDAR CITA - ÓPALO NAILS SPA* 🌿\n\n` +
        `¡Claro que sí reina! Abre nuestra agenda en el siguiente enlace para elegir tu nuevo horario:\n\n` +
        `📅 *ABRIR AGENDA:*\n👉 ${linkReagendar}\n\n` +
        `💡 *Ten presente:*\n` +
        `• *Tu abono ya pagado se transfiere automáticamente* a tu nueva cita (no debes pagar ningún anticipo de nuevo).\n` +
        `• Si eliges el mismo servicio, tu excedente a pagar en el spa seguirá siendo el mismo. Si eliges otro servicio, tu abono se descontará del nuevo valor.\n` +
        `• Tu cita actual (*${fechaCita}* a las *${horaInicio}*) *permanece guardada* hasta que confirmes la nueva fecha en el enlace.\n` +
        `• Al confirmar el nuevo horario, la cita anterior se liberará automáticamente y tu nueva cita quedará confirmada de inmediato.\n\n` +
        `¡Te esperamos con amor para consentirte reina! 🤍✨`;

      return {
        texto: textoSinLink,
        urlRedirect: linkReagendar,
        interactive: {
          type: 'cta_url',
          header: '✨ Reagendar Cita',
          body: textoSinLink,
          footer: 'Ópalo Nails Spa — Pereira',
          action: {
            name: 'cta_url',
            parameters: {
              display_text: '📅 Abrir Agenda',
              url: linkReagendar,
            },
          },
        },
      };
    }

    return null;
  }
}
