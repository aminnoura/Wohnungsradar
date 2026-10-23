import 'leaflet/dist/leaflet.css';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { CircleMarker, MapContainer, Polygon, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import { formatEur } from '@/lib/format';
import type { ListingsMapProps } from './ListingsMap';

function Events({ drawing, onAddPoint, onRegionChange }: Pick<ListingsMapProps, 'drawing' | 'onAddPoint' | 'onRegionChange'>) {
  const map = useMapEvents({
    click: (e) => drawing && onAddPoint([e.latlng.lat, e.latlng.lng]),
    moveend: () => {
      const b = map.getBounds();
      onRegionChange([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    },
  });
  useEffect(() => {
    const b = map.getBounds();
    onRegionChange([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** Web map: Leaflet + OpenStreetMap tiles (react-native-maps has no web support). */
export function ListingsMap({ listings, center, polygon, drawing, onAddPoint, onRegionChange }: ListingsMapProps) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={11} style={{ position: 'absolute', inset: 0, cursor: drawing ? 'crosshair' : undefined }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
      <Events drawing={drawing} onAddPoint={onAddPoint} onRegionChange={onRegionChange} />
      {listings.map((l) =>
        l.lat != null && l.lng != null ? (
          <CircleMarker key={l.id} center={[l.lat, l.lng]} radius={7} pathOptions={{ color: l.wbsRequired ? '#B54708' : '#1F6FEB', fillOpacity: 0.7 }}>
            <Popup>
              <div style={{ fontFamily: 'system-ui', maxWidth: 220 }}>
                <b>{formatEur(l.warmRent ?? l.coldRent)}</b> · {l.rooms ?? '?'} Zi. · {l.sizeM2 ? Math.round(l.sizeM2) : '?'} m²
                <br />
                {l.title}
                <br />
                <a href="#" onClick={(e) => { e.preventDefault(); router.push({ pathname: '/listing/[id]', params: { id: l.id } }); }}>Details</a>
              </div>
            </Popup>
          </CircleMarker>
        ) : null,
      )}
      {polygon.length >= 2 && <Polygon positions={polygon} pathOptions={{ color: '#1F6FEB' }} />}
    </MapContainer>
  );
}
