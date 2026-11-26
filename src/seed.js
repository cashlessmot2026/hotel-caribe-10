// Datos iniciales. El admin puede modificarlos desde el dashboard oculto (#/admin).
const B = import.meta.env.BASE_URL
export const REVIEWS_URL =
  'https://www.google.com/travel/search?q=Apartahotel%20Caribe%20Diez&hl=es-419&gl=co&ssta=1&ts=CAEaRwopEicyJTB4OGYwNWE1NDJmMjI4OGEyNToweDUxMmFjYTJmZTQyMDg2YTUSGhIUCgcI6g8QDBgFEgcI6g8QDBgGGAEyAhAA&qs=CAEyE0Nnb0lwWTJDb2Y3RnNwVlJFQUU4AkIJCaWGIOQvyipRQgkJpYYg5C_KKlE&ap=ugEHcmV2aWV3cw&ictx=111'

export const SEED = {
  version: 2,
  hotel: {
    name: 'Apartahotel Caribe Diez',
    location: 'San Andrés Isla, Colombia',
    whatsapp: '573157981773',
    reviewsUrl: REVIEWS_URL,
    // CID de Google Maps del hotel (sacado del enlace de reseñas)
    mapsCid: '5848709373133620901',
    // Opcional: Place ID (ChIJ...) para abrir directo "Escribir reseña"
    placeId: '',
    checkInTime: '3:00 p. m.',
    checkOutTime: '1:00 p. m.',
    gallery: [B + 'img/foto-0.jpg', B + 'img/foto-3.jpg', B + 'img/foto-2.jpg', B + 'img/foto-1.jpg', B + 'img/foto-8.jpg', B + 'img/foto-5.jpg'],
    // Adicionales que el cliente puede pedir al reservar y el admin puede cambiar en cada reserva.
    // unit: 'noche' (se cobra por cada noche) | 'estadia' (una vez). price 0 = sin costo.
    extras: [
      { id: 'toallas', name: 'Toallas adicionales', price: 0, unit: 'estadia', active: true },
      { id: 'aire', name: 'Aire acondicionado', price: 0, unit: 'noche', active: true },
      { id: 'ventana', name: 'Habitación con ventana', price: 0, unit: 'estadia', active: true },
      { id: 'cama-extra', name: 'Cama adicional', price: 0, unit: 'noche', active: true },
      { id: 'late-checkout', name: 'Salida tarde (late check-out)', price: 0, unit: 'estadia', active: true }
    ]
  },
  rooms: [
    {
      id: 'doble-superior',
      name: 'Habitación Doble Superior',
      price: 220000,
      capacity: 4,
      beds: '1 cama doble + 1 sencilla',
      size: '22 m²',
      rating: 4.8,
      available: true,
      details: ['Aire acondicionado', 'Wi-Fi gratis', 'Baño privado', 'Agua caliente', 'Toallas y lencería'],
      description:
        'Habitación luminosa con ventana a la calle, pared en verde caribe y camas de madera. Ideal para parejas o familias pequeñas que quieren estar cerca de todo en la isla.',
      images: [B + 'img/foto-4.jpg', B + 'img/foto-7.jpg', B + 'img/foto-6.jpg']
    },
    {
      id: 'familiar',
      name: 'Habitación Familiar',
      price: 280000,
      capacity: 5,
      beds: '2 camas dobles',
      size: '28 m²',
      rating: 4.9,
      available: true,
      details: ['Aire acondicionado', 'Smart TV', 'Minibar', 'Clóset con espejo', 'Wi-Fi gratis', 'Baño privado'],
      description:
        'Amplia habitación con dos camas dobles, televisor, minibar y clóset con espejo de cuerpo entero. Perfecta para viajar en familia o con amigos.',
      images: [B + 'img/foto-9.jpg', B + 'img/foto-11.jpg', B + 'img/foto-10.jpg', B + 'img/foto-6.jpg']
    },
    {
      id: 'estandar',
      name: 'Habitación Estándar',
      price: 180000,
      capacity: 3,
      beds: '1 cama doble + 1 sencilla',
      size: '18 m²',
      rating: 4.7,
      available: true,
      details: ['Aire acondicionado', 'Wi-Fi gratis', 'Baño privado', 'Minibar'],
      description:
        'Cómoda y práctica, con todo lo necesario para descansar después de un día de playa. Excelente relación precio–calidad.',
      images: [B + 'img/foto-10.jpg', B + 'img/foto-7.jpg', B + 'img/foto-6.jpg']
    }
  ],
  payments: [
    { id: 'efectivo', name: 'Efectivo', details: 'Pago al llegar al hotel', enabled: true },
    { id: 'transferencia', name: 'Transferencia bancaria', details: 'Te enviamos los datos por WhatsApp', enabled: true },
    { id: 'nequi', name: 'Nequi', details: 'Te enviamos el número por WhatsApp', enabled: true },
    { id: 'tarjeta', name: 'Tarjeta débito / crédito', details: 'Datáfono en recepción', enabled: true }
  ],
  restaurant: {
    enabled: false,
    title: 'Restaurante',
    // El restaurante queda fuera del hotel: datos para que el huésped lo encuentre
    description: '',
    address: '',
    mapsUrl: '',
    hours: '',
    whatsapp: '',
    phones: [],
    images: [],
    items: [
      { id: 'r1', name: 'Desayuno típico', price: 18000, category: 'Desayunos' },
      { id: 'r2', name: 'Pescado frito con patacón', price: 45000, category: 'Platos fuertes' },
      { id: 'r3', name: 'Limonada de coco', price: 12000, category: 'Bebidas' }
    ]
  }
}
