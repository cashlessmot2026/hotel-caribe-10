# Apartahotel Caribe Diez — PWA de reservas (React + Vite + Supabase)

## Instalación
```bash
npm install
npm run dev        # desarrollo (http://localhost:5173)
npm run build      # genera /dist listo para publicar (Vercel, Netlify, Hostinger…)
```

## Base de datos (Supabase)
1. Abre tu proyecto en Supabase → **SQL Editor** → New query.
2. Pega el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**.
3. Entra a la web → `#/admin` → clave **1234** → **Publicar ahora** para cargar los datos de ejemplo.

Qué crea el schema:
| Tabla | Contenido |
|---|---|
| `settings` | datos del hotel (nombre, WhatsApp, ubicación, galería, reseñas, adicionales) y del restaurante (activo, fotos, teléfonos, dirección, horario) |
| `rooms` | habitaciones: nombre, valor, descripción, detalles, imágenes (sin límite) |
| `payments` | medios de pago |
| `menu_items` | carta del restaurante (producto, precio, categoría) |
| `bookings` | reservas: huésped, habitación, fechas, adicionales, pagos, estado, historial (solo las lee el admin) |
| `admin_secret` | clave del admin cifrada (no se puede leer desde la web) |
| bucket `hotel` | fotos subidas desde el panel |

Seguridad: cualquiera puede **leer** (es una web pública), pero solo se puede **guardar** a través de la función
`admin_save`, que verifica la clave del admin en el servidor. Las reservas son la excepción: la web solo puede
**crearlas** (`create_booking`, que toma el precio de la base de datos); leerlas y editarlas requiere la clave.

> Si ya tenías la base creada, vuelve a ejecutar `schema.sql` completo: es seguro y no borra nada.

## Funciones
- Tarjetas de habitación con botón **Reservar**: llegada/salida, huéspedes, medio de pago y **petición especial**
  → registra la reserva en el panel (código CD-xxxx) y abre WhatsApp (+57 315 7981773) con el mensaje listo.
- **Reservas (admin):** llegadas/salidas del día, confirmar, check-in, check-out, "no llegó", cancelar
  (avisando por WhatsApp), ocultar/mostrar, eliminar; editar huésped, habitación, fechas, adicionales,
  precio, descuento y abonos; aviso de cruce de fechas; mensajes de WhatsApp listos; historial; exportar a Excel.
- Reseñas de Google (mapa embebido + "Ver reseñas" / "Dejar mi reseña").
- PWA instalable y funcional sin conexión (usa la última copia descargada).
- Restaurante opcional (oculto por defecto; queda fuera del hotel: fotos, dirección, teléfonos, horario), carta desde Excel (.xlsx / .csv) — ver `carta-ejemplo.xlsx`.

## Panel admin oculto
- `tusitio.com/#/admin` o tocar 5 veces el logo del inicio.
- Clave inicial **1234** (se cambia en Ajustes; queda cifrada en Supabase).
- Todos los cambios se guardan automáticamente en Supabase y los ve todo el mundo al recargar.
