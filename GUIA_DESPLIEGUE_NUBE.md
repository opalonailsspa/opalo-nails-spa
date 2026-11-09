# ☁️ Guía de Despliegue en la Nube (Supabase + Render + Vercel) — Ópalo Nails Spa

Esta guía explica paso a paso cómo desplegar la plataforma de **Ópalo Nails Spa** (Pereira, Colombia) en tus propias cuentas de **Supabase**, **Render** y **Vercel**.

---

## 🗄️ PASO 1: Base de Datos en Supabase

1. Crea un nuevo proyecto en [Supabase](https://supabase.com/).
2. En el menú lateral izquierdo, abre **SQL Editor** -> **New query**.
3. Abre el archivo `schema.sql` (ubicado en la raíz del repositorio o en `/database/schema.sql`), copia todo su contenido, pégalo en el editor y haz clic en **Run**.
4. Ve a **Project Settings -> API** y guarda:
   - `Project URL` (`SUPABASE_URL` / `VITE_SUPABASE_URL`)
   - `anon public` (`VITE_SUPABASE_ANON_KEY`)
   - `service_role secret` (`SUPABASE_SERVICE_ROLE_KEY`)

---

## ⚙️ PASO 2: Backend y Bot de WhatsApp en Render.com

1. Entra a [Render.com](https://render.com/) y crea un nuevo **Web Service** conectado al repositorio `opalonailsspa/opalo-nails-spa`.
2. Configura los siguientes parámetros:
   - **Name**: `opalo-nails-api`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
3. En la sección **Environment Variables**, agrega:
   ```ini
   PORT=3000
   SUPABASE_URL=tu_url_de_supabase
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_de_supabase
   GEMINI_API_KEY=tu_api_key_de_google_gemini
   FRONTEND_URL=https://tu-dominio-en-vercel.vercel.app
   WHATSAPP_PROVIDER=baileys
   BAILEYS_ALLOW_ALL=true
   BAILEYS_WHITELIST_NUMBERS=*
   ```
4. Una vez desplegado, ingresa a `https://tu-servicio.onrender.com/qr` y escanea el código QR con el WhatsApp oficial de **Ópalo Nails Spa**.

---

## 🌐 PASO 3: Frontend Web en Vercel.com

1. Entra a [Vercel.com](https://vercel.com/) e importa el repositorio `opalonailsspa/opalo-nails-spa`.
2. Configura:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. En **Environment Variables**, añade:
   - `VITE_SUPABASE_URL` = URL de tu proyecto de Supabase
   - `VITE_SUPABASE_ANON_KEY` = Clave `anon public` de tu proyecto de Supabase
4. Actualiza en `frontend/vercel.json` el destino del rewrite `/api/:path*` con la URL de tu servicio en Render si cambia el subdominio, y despliega (**Deploy**).
