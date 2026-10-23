import type { Listing } from '@wr/shared';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { formatEur } from '@/lib/format';

export interface ListingsMapProps {
  listings: Listing[];
  center: { lat: number; lng: number };
  /** Polygon being drawn or applied, as [lat, lng] pairs. */
  polygon: [number, number][];
  drawing: boolean;
  onAddPoint: (p: [number, number]) => void;
  onRegionChange: (bbox: [number, number, number, number]) => void;
}

export function ListingsMap({ listings, center, polygon, drawing, onAddPoint, onRegionChange }: ListingsMapProps) {
  return (
    <MapView
      style={StyleSheet.absoluteFill}
      initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.25, longitudeDelta: 0.35 }}
      onPress={(e) => drawing && onAddPoint([e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude])}
      onRegionChangeComplete={(r) =>
        onRegionChange([r.longitude - r.longitudeDelta / 2, r.latitude - r.latitudeDelta / 2, r.longitude + r.longitudeDelta / 2, r.latitude + r.latitudeDelta / 2])
      }
    >
      {listings.map((l) =>
        l.lat != null && l.lng != null ? (
          <Marker
            key={l.id}
            coordinate={{ latitude: l.lat, longitude: l.lng }}
            title={formatEur(l.warmRent ?? l.coldRent)}
            description={l.title}
            onCalloutPress={() => router.push({ pathname: '/listing/[id]', params: { id: l.id } })}
            pinColor={l.wbsRequired ? 'orange' : 'red'}
          />
        ) : null,
      )}
      {polygon.length >= 2 && (
        <Polygon coordinates={polygon.map(([latitude, longitude]) => ({ latitude, longitude }))} strokeColor="#1F6FEB" fillColor="rgba(31,111,235,0.15)" strokeWidth={2} />
      )}
    </MapView>
  );
}
