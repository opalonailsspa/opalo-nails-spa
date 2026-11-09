# Base de Datos (Supabase PostgreSQL) — Ópalo Nails Spa

## Configuración de Esquema Inicial

Para inicializar la base de datos en un proyecto limpio de Supabase para **Ópalo Nails Spa**:

1. Entra al panel de tu proyecto en [Supabase](https://supabase.com/dashboard).
2. Dirígete a la sección **SQL Editor** en el menú izquierdo.
3. Abre una nueva consulta (**New query**).
4. Copia y pega todo el contenido del archivo [`schema.sql`](./schema.sql) (también disponible en la raíz del proyecto como `/schema.sql`) y haz clic en **Run**.

### ¿Qué incluye `schema.sql`?
- **Extensiones**: `uuid-ossp` y `btree_gist` (para evitar citas solapadas a nivel físico de motor SQL).
- **Tablas Principales**:
  - `complejos`: Configuración de la sede **Ópalo Nails Spa** (Pereira, Colombia), horarios, reglas de anticipo y catálogo JSONB.
  - `canchas`: Especialistas / Profesionales del spa.
  - `servicios`: Catálogo completo de **34 servicios** oficiales (**Cejas y Pestañas**, **Uñas Tradicional y Semipermanente**, **Acrílico y Press On**, **Retiros y Adicionales**).
  - `clientes`: Registro automático de clientas por su número de WhatsApp.
  - `reservas`: Agenda de citas con bloqueo transaccional anti-solapamiento (`EXCLUDE USING gist`).
  - `pagos_anticipos`: Registro de comprobantes de transferencia analizados por IA.
  - `faqs`: Base de conocimiento para el Recepcionista IA de WhatsApp.
- **Seguridad (RLS)**: Políticas listas para lectura/escritura desde la app web y el backend.
