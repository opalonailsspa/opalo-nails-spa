import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { Complejo, getMontoAnticipoFijo } from './bookingService.js';

export interface ComplejoKnowledge {
  nombre?: string;
  parqueadero?: string;
  calzado?: string;
  servicios?: string;
  eventos?: string;
  telefono_admin?: string;
  informacion_libre?: string;
}

export interface ReceptionistResponse {
  esPreguntaOAtencion: boolean;
  esSolicitudHumano?: boolean;
  respuestaTexto?: string;
}

export class AIReceptionistService {
  /**
   * Determina si el texto del usuario es una solicitud de hablar con un humano
   */
  static esSolicitudHumano(texto: string): boolean {
    const t = texto.toLowerCase().trim();
    const patrones = [
      'humano',
      'persona',
      'asesor',
      'asesora',
      'encargado',
      'encargada',
      'administrador',
      'administradora',
      'admin',
      'dueno',
      'dueño',
      'recepcionista',
      'alguien real',
      'hablar con alguien',
      'hablar con un asesor',
      'hablar con un encargado',
      'hablar con el encargado',
      'hablar con la encargada',
      'hablar con encargado',
      'hablar con asesor',
      'contacto_asesor',
      'atencion al cliente',
      'atencion personalizada',
      'queja',
      'reclamo',
      'contacto humano',
      'soporte',
      'ayuda',
      'contacto',
      'comunicarme con un asesor',
      'comunicarme con un encargado',
      'comunicarme con alguien',
      'comunicar con asesor',
      'comunicar con encargado',
      'numero de contacto',
      'linea de atencion',
      'llamar',
      'telefono',
      'whatsapp del encargado',
    ];
    return patrones.some((p) => t.includes(p));
  }

  /**
   * Determina si el texto es una pregunta o consulta libre en lenguaje natural sobre el establecimiento
   */
  static esPreguntaFrecuente(texto: string): boolean {
    const t = texto.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (t.includes('?') || t.includes('¿')) return true;

    const palabrasClave = [
      // Interrogativos y verbos de consulta natural
      'que',
      'cual',
      'cuales',
      'cuanto',
      'cuantos',
      'como',
      'donde',
      'cuando',
      'quien',
      'quienes',
      'tienen',
      'tienes',
      'hacen',
      'haces',
      'manejan',
      'ofrecen',
      'atienden',
      'abren',
      'cierran',
      'trabajan',
      'aceptan',
      'reciben',
      'cobran',
      'cuesta',
      'cuestan',
      'vale',
      'valen',
      'valor',
      'precio',
      'precios',
      'tarifa',
      'tarifas',
      'costo',
      'costos',
      'demora',
      'dura',
      'duracion',
      'tiempo',
      'horario',
      'horarios',
      'hora',
      'horas',
      'info',
      'informacion',
      'duda',
      'pregunta',
      'consulta',
      // Ubicación y parqueadero
      'parqueadero',
      'estacionamiento',
      'carro',
      'moto',
      'ubicacion',
      'direccion',
      'como llegar',
      'llegar',
      'ubicados',
      'ubicadas',
      'quedan',
      'queda',
      'barrio',
      'sector',
      'pereira',
      'mapa',
      'maps',
      'instagram',
      // Servicios: Uñas, Cejas y Pestañas
      'unas',
      'uñas',
      'manicura',
      'manicure',
      'pedicura',
      'pedicure',
      'limpieza',
      'semipermanente',
      'semi',
      'acrilico',
      'acrilicas',
      'esculpido',
      'esculpidas',
      'recubrimiento',
      'rubber',
      'ruber',
      'base rubber',
      'dipping',
      'press on',
      'press',
      'retoque',
      'retiro',
      'tradicional',
      'manos',
      'pies',
      'ceja',
      'cejas',
      'pestana',
      'pestanas',
      'pestaña',
      'pestañas',
      'lifting',
      'laminado',
      'pelo a pelo',
      'clasicas',
      'pestanina',
      'pestañina',
      'hibridas',
      '3d',
      'volumen ruso',
      'volumen brasileno',
      'henna',
      'cera',
      'hilo',
      'bigote',
      'bozo',
      'depilacion',
      'servicio',
      'servicios',
      'catalogo',
      'manicurista',
      'manicuristas',
      'especialista',
      'especialistas',
      'profesional',
      // Pagos y políticas
      'tarjeta',
      'transferencia',
      'efectivo',
      'nequi',
      'daviplata',
      'bancolombia',
      'abono',
      'anticipo',
      'seña',
      'garantia',
      'reembolso',
      'devolucion',
      'domicilio',
      'domicilios',
    ];
    return palabrasClave.some((p) => t.includes(p));
  }

  /**
   * Procesa la consulta usando IA (Gemini) o motor inteligente de lenguaje natural
   */
  static async responderConsulta(
    texto: string,
    complejo: Complejo,
    forzarRespuestaNatural: boolean = false
  ): Promise<ReceptionistResponse> {
    const t = texto.toLowerCase().trim();

    // 1. DERIVACIÓN A ASESOR / ENCARGADO HUMANO
    if (this.esSolicitudHumano(t)) {
      const telAdmin = complejo.telefono_whatsapp || '';
      const telNumeros = telAdmin.replace(/\D/g, '');
      const enlaceWa = telNumeros.length >= 10 ? `https://wa.me/${telNumeros}` : null;

      const respuestaTexto =
        `👩‍💼 *Atención Personalizada - ${complejo.nombre || 'Ópalo Nails Spa'}*\n\n` +
        `¡Claro que sí reina! He notificado a nuestra encargada de *${complejo.nombre || 'Ópalo Nails Spa'}* para que te atienda personalmente 📱.\n\n` +
        (telAdmin ? `📞 *Contacto directo:* *${telAdmin}*\n` : '') +
        (enlaceWa ? `• Chat directo: ${enlaceWa}\n\n` : '\n') +
        `📸 *Instagram oficial:* https://www.instagram.com/opalo_nailspereira?cplk=MW9ncWJwMG50anlsMQ==\n\n` +
        `✍️ Puedes dejar tu inquietud detallada aquí mismo y te responderemos enseguida.\n\n` +
        `📅 _Si deseas volver a ver la agenda automática, escribe *HOLA* o *AGENDA* en cualquier momento._`;

      return {
        esPreguntaOAtencion: true,
        esSolicitudHumano: true,
        respuestaTexto,
      };
    }

    // 2. PREGUNTAS FRECUENTES O LENGUAJE NATURAL DEL COMPLEJO
    if (!forzarRespuestaNatural && !this.esPreguntaFrecuente(t)) {
      return { esPreguntaOAtencion: false };
    }

    // Si hay Gemini API Key configurada, usar IA conversacional
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const respuestaIA = await this.consultarGemini(texto, complejo, apiKey);
        if (respuestaIA) {
          return {
            esPreguntaOAtencion: true,
            respuestaTexto: respuestaIA,
          };
        }
      } catch (err: any) {
        console.error('Error consultando Gemini FAQ:', err.message);
      }
    }

    // Motor NLU local enriquecido para responder con precisión cualquier pregunta en español
    const respuestaReglas = this.generarRespuestaPorReglas(texto, complejo);
    return {
      esPreguntaOAtencion: true,
      respuestaTexto: respuestaReglas,
    };
  }

  /**
   * Obtiene la base de conocimiento específica y personalizada de este complejo
   */
  static getConocimientoComplejo(complejo: Complejo): ComplejoKnowledge {
    try {
      const filePath = path.resolve(process.cwd(), 'data', 'complejos_faq.json');
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        if (data[complejo.id]) return data[complejo.id];
        if (complejo.slug && data[complejo.slug]) return data[complejo.slug];
      }
    } catch (e) {
      // Ignorar fallback
    }

    return {
      nombre: complejo.nombre || 'Ópalo Nails Spa',
      parqueadero: 'Contamos con zona de fácil acceso y bahía cercana para mayor comodidad de nuestras clientas.',
      calzado: 'Instalaciones cómodas y exclusivas para tu mayor relajación.',
      servicios:
        'Cejas y Pestañas: Depilación con cera ($15.000), Depilación con hilo ($20.000), Henna ($8.000), Cera y henna ($22.000), Hilo y henna ($16.000), Bigote con cera ($8.000), Bigote con hilo ($10.000), Laminado de cejas ($55.000), Lifting de pestañas ($55.000), Pestañas pelo a pelo clásicas ($80.000), Efecto pestañina ($80.000), Híbridas ($100.000), 3D ($100.000), Volumen ruso ($110.000), Volumen brasileño ($90.000). Uñas: Limpieza ($13.000), Manicura tradicional ($18.000), Pedicura tradicional ($18.000), Manicura semipermanente full ($46.000), Manicura solo tono ($39.000), Pedicura Semi ($39.000), Dipping + Semi ($53.000), Base Ruber ($53.000), Recubrimiento en acrílico ($75.000), Sistema Press On ($75.000), Acrílicas con tip ($90.000), Acrílicas esculpidas ($100.000), Retoque de acrílico o Press On ($65.000), Retiro de acrílico definitivo ($15.000), Retiro definitivo semipermanente ($8.000), Uña en semipermanente ($4.000), Uña Press On o recubrimiento ($7.000), Uña acrílica con tip ($8.000), Uña esculpida ($10.000).',
      eventos: 'Atención personalizada para citas individuales o múltiples servicios previa reserva.',
      telefono_admin: complejo.telefono_whatsapp,
    };
  }

  /**
   * Guarda o actualiza la base de conocimiento de un complejo específico
   */
  static guardarConocimientoComplejo(complejoId: string, knowledge: ComplejoKnowledge): void {
    try {
      const dataDir = path.resolve(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      const filePath = path.join(dataDir, 'complejos_faq.json');
      let data: Record<string, ComplejoKnowledge> = {};
      if (fs.existsSync(filePath)) {
        data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
      data[complejoId] = { ...data[complejoId], ...knowledge };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error guardando conocimiento del complejo:', e);
    }
  }

  /**
   * Consulta a Google Gemini Flash con el contexto específico de Ópalo Nails Spa
   */
  private static async consultarGemini(pregunta: string, complejo: Complejo, apiKey: string): Promise<string | null> {
    const apertura = complejo.hora_apertura ? complejo.hora_apertura.slice(0, 5) : '08:00';
    const cierre = complejo.hora_cierre ? complejo.hora_cierre.slice(0, 5) : '19:00';
    const direccion = complejo.direccion || 'Pereira, Risaralda, Colombia';
    const ciudad = complejo.ciudad || 'Pereira, Risaralda, Colombia';
    const info = this.getConocimientoComplejo(complejo);
    const baseUrl = process.env.FRONTEND_URL || 'https://opalo-nails-spa.vercel.app';
    const exigeAnticipo = Number(complejo.porcentaje_anticipo_minimo) > 0;
    const montoAbono = getMontoAnticipoFijo(complejo);

    const prompt = `Eres la recepcionista virtual oficial de "${complejo.nombre || 'Ópalo Nails Spa'}", un exclusivo spa especializado en Uñas, Cejas y Pestañas ubicado en ${direccion} (${ciudad}).
Tu objetivo es responder cualquier duda o comentario de la clienta en WhatsApp con inteligencia, calidez, precisión y concisión (máximo 3 a 4 oraciones cortas, usando emojis elegantes como ✨💅🌿🤍).

DATOS OFICIALES Y CONTEXTO DE ÓPALO NAILS SPA:
- Nombre oficial: ${complejo.nombre || 'Ópalo Nails Spa'}
- Ciudad y Ubicación: ${direccion} (${ciudad})
- Instagram Oficial: https://www.instagram.com/opalo_nailspereira?cplk=MW9ncWJwMG50anlsMQ== (@opalo_nailspereira)
- Horario de atención: Lunes a Sábado de ${apertura} a ${cierre}.
- Parqueadero: ${info.parqueadero}
- Instalaciones: Sofisticadas, cómodas, esterilización rigurosa de herramientas y protocolos de bioseguridad.
- Catálogo oficial completo de servicios y precios exactos en COP:
  * CEJAS Y PESTAÑAS:
    - Depilación con cera: $15.000 COP (30 min)
    - Depilación con hilo: $20.000 COP (30 min)
    - Henna: $8.000 COP (30 min)
    - Cera y henna: $22.000 COP (45 min)
    - Hilo y henna: $16.000 COP (45 min)
    - Bigote con cera: $8.000 COP (20 min)
    - Bigote con hilo: $10.000 COP (20 min)
    - Laminado de cejas: $55.000 COP (60 min)
    - Lifting de pestañas: $55.000 COP (60 min)
    - Pestañas pelo a pelo clásicas: $80.000 COP (120 min) — Retoque $40.000 (pasados los 20 días tiene un adicional de $5.000 a $10.000)
    - Pestañas pelo a pelo efecto pestañina: $80.000 COP (120 min) — Retoque $45.000 (pasados los 20 días tiene un adicional de $5.000 a $10.000)
    - Pestañas híbridas: $100.000 COP (120 min) — Retoque $50.000 (pasados los 20 días tiene un adicional de $5.000 a $10.000)
    - Pestañas 3D: $100.000 COP (120 min) — Retoque $50.000 (pasados los 20 días tiene un adicional de $5.000 a $10.000)
    - Pestañas pelo a pelo volumen ruso: $110.000 COP (150 min) — Retoque $60.000 (pasados los 20 días tiene un adicional de $5.000 a $10.000)
    - Pestañas pelo a pelo volumen brasileño: $90.000 COP (120 min)
  * UÑAS:
    - Limpieza: $13.000 COP (40 min)
    - Manicura tradicional: $18.000 COP (60 min)
    - Pedicura tradicional: $18.000 COP (60 min)
    - Manicura semipermanente full: $46.000 COP (90 min)
    - Manicura solo tono: $39.000 COP (75 min)
    - Pedicura Semi: $39.000 COP (80 min)
    - Dipping + Semi: $53.000 COP (90 min)
    - Base Ruber: $53.000 COP (90 min)
    - Recubrimiento en acrílico: $75.000 COP (120 min)
    - Sistema Press On: $75.000 COP (120 min)
    - Acrílicas con tip: $90.000 COP (120 min)
    - Acrílicas esculpidas: $100.000 COP (150 min)
    - Retoque de acrílico o Press On: $65.000 COP (120 min) — Incluye una uña perdida (adicional: con tip $6.000, esculpida $8.000)
    - Retiro de acrílico definitivo: $15.000 COP (60 min)
    - Retiro definitivo semipermanente: $8.000 COP (30 min)
    - Uña en semipermanente: $4.000 COP (20 min)
    - Uña Press On o recubrimiento: $7.000 COP (20 min)
    - Uña acrílica con tip: $8.000 COP (25 min)
    - Uña esculpida: $10.000 COP (30 min)
    * Nota importante: Los diseños elaborados tienen tiempo y costo adicional.
- Políticas de anticipo / abono:
  * Valor general configurado de anticipo: $${montoAbono.toLocaleString('es-CO')} COP.
  * ${exigeAnticipo ? 'Actualmente el anticipo está activado para apartar cita.' : 'En temporada regular el pago se realiza directamente en el spa.'}
  * REGLA ESTRICTA DE DICIEMBRE (TEMPORADA ALTA): Si la cita es para cualquier fecha del mes de Diciembre, el anticipo es SIEMPRE OBLIGATORIO para apartar y congelar el cupo.
- Medios de pago: Efectivo en el spa, Nequi y Bancolombia (titular: ${complejo.titular_cuenta || 'Ópalo Nails Spa'}).
- Domicilios: NO realizamos servicio a domicilio. Todo es en nuestras instalaciones en Pereira por bioseguridad.

MENSAJE DEL CLIENTE:
"${pregunta}"

REGLAS ESTRICTAS DE SEGURIDAD Y CERO ALUCINACIÓN:
1. SERVICIOS: Somos especialistas en Uñas, Cejas y Pestañas. No realizamos peluquería, tintes ni cortes de cabello.
2. LO QUE NO SEPAS O NO ESTÉ AQUÍ, NO LO INVENTES: Sugiérele amablemente escribir la palabra *ASESOR* para atención personalizada.
3. NO CONFIRMAR CITAS EN EL CHAT: Guía siempre a la clienta a revisar disponibilidad real y reservar en: ${baseUrl}
4. FORMATO: Responde en máximo 3 a 4 oraciones cortas con tono cálido ("¡Hola reina!", "¡Claro que sí hermosa!") y emojis elegantes (✨💅🌿🤍).`;

    const modelosDisponibles = [
      process.env.GEMINI_MODEL,
      'gemini-3-flash-preview',
      'gemini-3.8-flash',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
    ].filter(Boolean) as string[];

    for (const modelo of modelosDisponibles) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
        const res = await axios.post(
          endpoint,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 1000,
              ...(modelo.includes('gemini-3') || modelo.includes('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {})
            },
          },
          { timeout: 8000 }
        );

        const respuesta = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (respuesta) return respuesta.trim();
      } catch (e: any) {
        // Fallback al siguiente modelo
      }
    }

    return null;
  }

  /**
   * Motor local de respuestas naturales (Fallback cuando no hay conexión a Gemini o respuesta inmediata)
   */
  private static generarRespuestaPorReglas(preguntaOriginal: string, complejo: Complejo): string {
    const t = preguntaOriginal.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const baseUrl = process.env.FRONTEND_URL || 'https://opalo-nails-spa.vercel.app';
    const pie = `\n\n📅 *Puedes elegir tu horario y agendar directamente aquí:*\n👉 ${baseUrl}`;
    const info = this.getConocimientoComplejo(complejo);
    const nombreSpa = complejo.nombre || 'Ópalo Nails Spa';
    const apertura = complejo.hora_apertura ? complejo.hora_apertura.slice(0, 5) : '08:00';
    const cierre = complejo.hora_cierre ? complejo.hora_cierre.slice(0, 5) : '19:00';
    const direccion = complejo.direccion || 'Pereira, Risaralda, Colombia';
    const exigeAnticipo = Number(complejo.porcentaje_anticipo_minimo) > 0;
    const montoAbono = getMontoAnticipoFijo(complejo);

    // 1. Consultas por UBICACIÓN / DIRECCIÓN / INSTAGRAM
    if (
      t.includes('donde') ||
      t.includes('ubicacion') ||
      t.includes('ubicados') ||
      t.includes('ubicadas') ||
      t.includes('direccion') ||
      t.includes('llegar') ||
      t.includes('queda') ||
      t.includes('quedan') ||
      t.includes('barrio') ||
      t.includes('sector') ||
      t.includes('mapa') ||
      t.includes('maps') ||
      t.includes('instagram')
    ) {
      return (
        `📍 *Ubicación de ${nombreSpa}:*\n\n` +
        `Nos encontramos en *${direccion}* ✨.\n\n` +
        `📸 *Instagram Oficial:*\nhttps://www.instagram.com/opalo_nailspereira?cplk=MW9ncWJwMG50anlsMQ==\n\n` +
        `⏰ Atendemos de Lunes a Sábado de *${apertura}* a *${cierre}*.` +
        pie
      );
    }

    // 2. Consultas por DOMICILIOS
    if (t.includes('domicilio') || t.includes('casa') || t.includes('van a')) {
      return (
        `✨ ¡Hola hermosa! Te contamos que todos nuestros servicios de Uñas, Cejas y Pestañas se realizan únicamente en nuestras instalaciones de *${nombreSpa}* en *${direccion}*, garantizándote equipos profesionales, camillas cómodas y protocolos 100% bioseguros 💅🌿.` +
        pie
      );
    }

    // 3. Consultas por PARQUEADERO
    if (t.includes('parqueadero') || t.includes('estacionamiento') || t.includes('parquear') || t.includes('carro') || t.includes('moto')) {
      return `🚗 *Parqueadero en ${nombreSpa}:*\n${info.parqueadero}` + pie;
    }

    // 4. Consultas por HORARIOS DE ATENCIÓN
    if (
      (t.includes('horario') || t.includes('hora') || t.includes('abren') || t.includes('cierran') || t.includes('atienden') || t.includes('trabajan') || t.includes('domingo') || t.includes('festivo')) &&
      !t.includes('cuanto dura') &&
      !t.includes('cuanto demora')
    ) {
      return (
        `⏰ *Horario de Atención - ${nombreSpa}:*\n\n` +
        `Atendemos de *Lunes a Sábado de ${apertura} a ${cierre}* en *${direccion}* ✨.\n\n` +
        `En nuestro enlace de agenda puedes ver en tiempo real qué turnos están libres hoy o en los próximos días.` +
        pie
      );
    }

    // 5. Consultas por ABONO / ANTICIPO / MEDIOS DE PAGO
    if (
      t.includes('abono') ||
      t.includes('anticipo') ||
      t.includes('nequi') ||
      t.includes('bancolombia') ||
      t.includes('daviplata') ||
      t.includes('efectivo') ||
      t.includes('tarjeta') ||
      t.includes('medio de pago') ||
      t.includes('medios de pago') ||
      t.includes('como pago') ||
      t.includes('como se paga') ||
      t.includes('pagar')
    ) {
      const titular = complejo.titular_cuenta || 'Ópalo Nails Spa';
      return (
        `💳 *Medios de Pago y Política de Abono - ${nombreSpa}:*\n\n` +
        (exigeAnticipo
          ? `• Para asegurar tu cita se solicita un *abono fijo de $${montoAbono.toLocaleString('es-CO')} COP*.\n` +
            `• El saldo restante lo pagas directamente en el spa al finalizar tu atención.\n` +
            `• *Titular:* *${titular}*${complejo.nequi_numero ? ` (Nequi: ${complejo.nequi_numero})` : ''}.\n` +
            `• También recibimos efectivo y transferencia en el spa ✨.`
          : `• Puedes pagar en efectivo, Nequi o Bancolombia directamente en el spa ✨.\n` +
            `• *Nota de temporada:* Para todas las citas del mes de *diciembre* se solicita un abono fijo de *$${montoAbono.toLocaleString('es-CO')} COP* para asegurar el cupo.`) +
        pie
      );
    }

    // 6. Consultas por CEJAS Y PESTAÑAS
    const preguntaCejasPestanas =
      t.includes('ceja') ||
      t.includes('pestana') ||
      t.includes('lifting') ||
      t.includes('laminado') ||
      t.includes('pelo a pelo') ||
      t.includes('volumen ruso') ||
      t.includes('volumen brasileno') ||
      t.includes('hibridas') ||
      t.includes('3d') ||
      t.includes('henna') ||
      t.includes('cera') ||
      t.includes('hilo') ||
      t.includes('bigote') ||
      t.includes('depilacion');

    if (preguntaCejasPestanas) {
      return (
        `✨ *Cejas y Pestañas en ${nombreSpa}:*\n\n` +
        `🌿 *Cejas y Depilación:*\n` +
        `• Depilación con cera: *$15.000* | Con hilo: *$20.000*\n` +
        `• Henna: *$8.000* | Cera y henna: *$22.000* | Hilo y henna: *$16.000*\n` +
        `• Bigote con cera: *$8.000* | Bigote con hilo: *$10.000*\n` +
        `• Laminado de cejas: *$55.000*\n\n` +
        `👁️ *Pestañas:*\n` +
        `• Lifting de pestañas: *$55.000*\n` +
        `• Pelo a pelo clásicas: *$80.000* (Retoque $40.000)\n` +
        `• Pelo a pelo efecto pestañina: *$80.000* (Retoque $45.000)\n` +
        `• Volumen brasileño: *$90.000*\n` +
        `• Pestañas híbridas: *$100.000* (Retoque $50.000)\n` +
        `• Pestañas 3D: *$100.000* (Retoque $50.000)\n` +
        `• Pelo a pelo volumen ruso: *$110.000* (Retoque $60.000)\n` +
        `_(Nota: En retoques de pestañas, pasados los 20 días tiene un adicional de $5.000 a $10.000)_` +
        pie
      );
    }

    // 7. Consultas por SERVICIOS ESPECÍFICOS DE UÑAS
    const preguntaAcrilico = t.includes('acrilic') || t.includes('esculpid') || t.includes('recubrimiento') || t.includes('press');
    const preguntaSemi = t.includes('semi') || t.includes('rubber') || t.includes('ruber') || t.includes('dipping') || t.includes('tradicional') || t.includes('limpieza');
    const preguntaRetiro = t.includes('retiro') || t.includes('retirar') || t.includes('quitar');

    if (preguntaAcrilico && !preguntaSemi) {
      return (
        `💅 *Acrílico y Sistema Press On en ${nombreSpa}:*\n\n` +
        `• *Recubrimiento en acrílico:* $75.000 (120 min)\n` +
        `• *Sistema Press On:* $75.000 (120 min)\n` +
        `• *Acrílicas con tip:* $90.000 (120 min)\n` +
        `• *Acrílicas esculpidas:* $100.000 (150 min)\n` +
        `• *Retoque de acrílico o Press On:* $65.000 (incluye 1 uña perdida; adicional con tip $6.000, esculpida $8.000)\n` +
        `• *Uña individual:* Press On/recubrimiento $7.000 | Con tip $8.000 | Esculpida $10.000\n` +
        `_(Los diseños elaborados tienen tiempo y costo adicional)_` +
        pie
      );
    }

    if (preguntaSemi && !preguntaAcrilico) {
      return (
        `✨ *Manicura, Pedicura, Semipermanente y Base Ruber en ${nombreSpa}:*\n\n` +
        `• *Limpieza:* $13.000 (40 min)\n` +
        `• *Manicura tradicional:* $18.000 | *Pedicura tradicional:* $18.000\n` +
        `• *Manicura semipermanente full:* $46.000 (90 min)\n` +
        `• *Manicura solo tono:* $39.000 (75 min)\n` +
        `• *Pedicura Semi:* $39.000 (80 min)\n` +
        `• *Dipping + Semi:* $53.000 (90 min)\n` +
        `• *Base Ruber:* $53.000 (90 min)\n` +
        `• *Uña en semipermanente:* $4.000\n` +
        `_(Los diseños elaborados tienen tiempo y costo adicional)_` +
        pie
      );
    }

    if (preguntaRetiro) {
      return (
        `💅 *Servicios de Retiro en ${nombreSpa}:*\n\n` +
        `• *Retiro definitivo semipermanente:* $8.000 (30 min)\n` +
        `• *Retiro de acrílico definitivo:* $15.000 (60 min)` +
        pie
      );
    }

    // 8. Consultas generales de PRECIOS / CATÁLOGO COMPLETO
    if (
      t.includes('precio') ||
      t.includes('cuanto') ||
      t.includes('valor') ||
      t.includes('vale') ||
      t.includes('cuesta') ||
      t.includes('servicio') ||
      t.includes('catalogo') ||
      t.includes('unas') ||
      t.includes('uñas') ||
      t.includes('manicur') ||
      t.includes('pedicur') ||
      t.includes('manos') ||
      t.includes('pies') ||
      t.includes('dura') ||
      t.includes('demora')
    ) {
      return (
        `✨ *Catálogo Oficial de Servicios - ${nombreSpa} (Pereira):*\n\n` +
        `🌿 *Cejas y Pestañas:*\n` +
        `• Depilación cera: *$15.000* | Hilo: *$20.000* | Henna: *$8.000*\n` +
        `• Cera + henna: *$22.000* | Hilo + henna: *$16.000*\n` +
        `• Bigote cera: *$8.000* | Bigote hilo: *$10.000*\n` +
        `• Laminado de cejas: *$55.000* | Lifting de pestañas: *$55.000*\n` +
        `• Pestañas clásicas / efecto pestañina: *$80.000*\n` +
        `• Volumen brasileño: *$90.000* | Híbridas / 3D: *$100.000*\n` +
        `• Volumen ruso: *$110.000*\n\n` +
        `💅 *Uñas:*\n` +
        `• Limpieza: *$13.000* | Manicura o Pedicura tradicional: *$18.000*\n` +
        `• Manicura semi full: *$46.000* | Manicura solo tono: *$39.000*\n` +
        `• Pedicura Semi: *$39.000* | Dipping + Semi / Base Ruber: *$53.000*\n` +
        `• Recubrimiento acrílico / Sistema Press On: *$75.000*\n` +
        `• Acrílicas con tip: *$90.000* | Acrílicas esculpidas: *$100.000*\n` +
        `• Retoque acrílico o Press On: *$65.000*\n` +
        `• Retiro acrílico: *$15.000* | Retiro semi: *$8.000*\n` +
        `_(Los diseños elaborados tienen tiempo y costo adicional)_` +
        pie
      );
    }

    // 9. Agradecimientos o mensajes cortos
    if (t.includes('gracias') || t.includes('listo') || t.includes('ok') || t.includes('vale') || t.includes('perfecto') || t.includes('bueno')) {
      return (
        `✨ ¡Con muchísimo gusto reina! Estamos para consentirte en *${nombreSpa}* 🤍.\n\n` +
        `Si tienes cualquier otra pregunta sobre nuestros servicios de Uñas, Cejas y Pestañas, escríbeme con confianza. ¡Te esperamos! 💅🌿` +
        pie
      );
    }

    return (
      `✨ *¡Hola reina! Bienvenida a ${nombreSpa}* 🌿\n\n` +
      `• 📍 *Ciudad:* ${direccion} (Lunes a Sábado de ${apertura} a ${cierre})\n` +
      `• 💅 *Uñas:* Semipermanente, Base Ruber, Dipping, Press On, Acrílicas con tip y esculpidas.\n` +
      `• 👁️ *Cejas y Pestañas:* Laminado de cejas, Diseño en hilo/cera + henna, Lifting y Extensiones pelo a pelo (Clásicas, Híbridas, 3D, Volumen Ruso y Brasileño).\n` +
      `• 📸 *Instagram:* https://www.instagram.com/opalo_nailspereira?cplk=MW9ncWJwMG50anlsMQ==\n` +
      `• 💬 Si necesitas hablar con una encargada, escribe *ASESOR*.` +
      pie
    );
  }
}
