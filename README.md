# ✨ Ópalo Nails Spa — Sistema Inteligente de Reservas & Bot WhatsApp IA

Plataforma integral de agendamiento web, gestión de citas en tiempo real y recepcionista automatizada por WhatsApp con Inteligencia Artificial para **Ópalo Nails Spa** (**Pereira, Colombia**).

- **Especialidades:** Uñas (Acrílicas, Press On, Base Rubber, Dipping, Semipermanente, Manicura y Pedicura) + **Cejas y Pestañas** (Lifting de pestañas, Extensiones pelo a pelo clásicas / efecto pestañina / híbridas / 3D / volumen ruso / volumen brasileño, Laminado de cejas, Diseño con hilo/cera y Henna).
- **Instagram Oficial:** [@opalo_nailspereira](https://www.instagram.com/opalo_nailspereira?cplk=MW9ncWJwMG50anlsMQ==)

---

## 🏗️ Arquitectura del Proyecto

```text
opalo-nails-spa/
├── schema.sql                # Script SQL completo para inicializar Supabase
├── .env.example              # Plantilla de variables de entorno
├── database/
│   ├── schema.sql            # Copia del esquema SQL completo (tablas, RLS y semillas)
│   └── README.md             # Instrucciones de ejecución en el SQL Editor de Supabase
├── backend/                  # API Node.js + Express + TypeScript + Baileys WhatsApp + Gemini AI
│   ├── .env.example          # Plantilla de variables de entorno del servidor
│   ├── baileys_auth_info/    # Carpeta limpia para generación de código QR de WhatsApp
│   └── src/
│       ├── index.ts          # Servidor Express, endpoints REST y visor QR (/qr)
│       ├── bot/              # Flujo conversacional de WhatsApp (Ópalo Nails Spa)
│       ├── config/           # Conexión a Supabase con Service Role Key
│       └── services/         # Recepcionista IA, NLU, Reservas, Recordatorios y Comprobantes
└── frontend/                 # Aplicación Web React 19 + Vite + TailwindCSS
    ├── .env.example          # Plantilla de variables de entorno de Vite/Vercel
    └── src/
        ├── components/       # Portal de Reservas de Clientas y Panel Administrativo
        └── config/           # Cliente Supabase para sincronización en tiempo real
```

---

## 🚀 Configuración Rápida

### 1. Base de Datos (Supabase)
1. Crea un nuevo proyecto en [Supabase](https://supabase.com).
2. Ve a **SQL Editor** y ejecuta el contenido completo de [`schema.sql`](./schema.sql).
3. Copia tu `Project URL`, `anon public key` y `service_role secret` desde **Project Settings -> API**.

### 2. Variables de Entorno
Completa las variables basándote en `.env.example` (tanto en `/backend/.env` como en tu panel de Render y Vercel):

```ini
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
FRONTEND_URL=
PORT=3000
WHATSAPP_PROVIDER=baileys
BAILEYS_ALLOW_ALL=true
BAILEYS_WHITELIST_NUMBERS=*
```

En el frontend (`/frontend/.env` o en Vercel):
```ini
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### 3. Instalación y Compilación
```bash
# Backend
cd backend
npm install
npm run build
npm start

# Frontend
cd ../frontend
npm install
npm run build
npm run dev
```

### 4. Vinculación de WhatsApp (Código QR)
Al iniciar el backend en Render o localmente, abre en tu navegador:
- `http://localhost:3000/qr` (o `https://tu-backend.onrender.com/qr`)
Escanea el código QR desde el WhatsApp de **Ópalo Nails Spa** (*Dispositivos vinculados -> Vincular un dispositivo*).
