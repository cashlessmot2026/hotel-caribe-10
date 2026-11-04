import Icon from './Icon.jsx'
import { useData } from '../store.jsx'
import { reviewLinks } from '../utils.js'

export default function Reviews({ compact = false }) {
  const { data } = useData()
  const links = reviewLinks(data.hotel)
  return (
    <section className={`reviews ${compact ? 'compact' : ''}`}>
      <div className="reviews__head">
        <div className="g-logo" aria-hidden="true">
          <span style={{ color: '#4285F4' }}>G</span>
        </div>
        <div>
          <h3>Reseñas en Google</h3>
          <p className="muted small">Mira lo que dicen nuestros huéspedes y cuéntanos tu experiencia</p>
        </div>
      </div>

      <div className="frame">
        <iframe
          title="Apartahotel Caribe Diez en Google"
          src={links.embed}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>

      <div className="reviews__actions">
        <a className="btn btn--ghost" href={links.view} target="_blank" rel="noreferrer">
          <Icon name="star" size={18} /> Ver reseñas
        </a>
        <a className="btn btn--primary" href={links.write} target="_blank" rel="noreferrer">
          <Icon name="edit" size={18} /> Dejar mi reseña
        </a>
      </div>
      {!data.hotel.placeId && (
        <p className="muted tiny center">Al abrir Google, toca <b>“Escribir una reseña”</b> ⭐</p>
      )}
    </section>
  )
}
