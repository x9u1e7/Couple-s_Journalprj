import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { PlaceItem } from '../types';

interface MapSectionProps {
  places: PlaceItem[];
  onOpenAddModal: (data?: Partial<PlaceItem>) => void;
  onEditPlace: (place: PlaceItem) => void;
  onDeletePlace: (id: number) => void;
}

export const MapSection: React.FC<MapSectionProps> = ({
  places,
  onOpenAddModal,
  onEditPlace,
  onDeletePlace,
}) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const onOpenAddModalRef = useRef(onOpenAddModal);

  // 確保 callback 永遠拿到最新引用，避免閉包陷阱
  useEffect(() => {
    onOpenAddModalRef.current = onOpenAddModal;
  }, [onOpenAddModal]);

  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      // 接收來自 iframe 內部的點擊事件資料
      if (event.data && event.data.type === 'MAP_DIRECT_CLICK') {
        const { lat, lng, placeName } = event.data;
        if (onOpenAddModalRef.current) {
          onOpenAddModalRef.current({
            name: placeName,
            lat,
            lng,
          });
        }
      }
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, []);

  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html, #map { height: 100%; margin: 0; padding: 0; cursor: pointer; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = L.map('map').setView([25.0432, 121.5081], 16);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        const places = ${JSON.stringify(places)};
        places.forEach(p => {
          if (p.lat && p.lng) {
            L.marker([p.lat, p.lng]).addTo(map).bindPopup('<b>' + p.name + '</b><br>' + (p.note || ''));
          }
        });

        // 監聽地圖點擊
        map.on('click', function(e) {
          const lat = e.latlng.lat;
          const lng = e.latlng.lng;
          
          // 1. 先用座標快速預先推導名稱（避免網絡延遲導致空白）
          let defaultName = "緯度 " + lat.toFixed(4) + ", 經度 " + lng.toFixed(4);

          // 2. 打 API 反查地名
          fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&zoom=18&addressdetails=1&accept-language=zh-TW')
            .then(res => res.json())
            .then(data => {
              let fetchedName = defaultName;
              if (data && data.address) {
                const a = data.address;
                fetchedName = a.tourism || a.attraction || a.amenity || a.shop || a.building || a.historic || a.road || a.suburb || a.town || a.city || "點選位置";
              } else if (data && data.display_name) {
                fetchedName = data.display_name.split(',')[0].trim();
              }

              // 發送訊息給父視窗
              window.parent.postMessage({
                type: 'MAP_DIRECT_CLICK',
                lat: lat,
                lng: lng,
                placeName: fetchedName
              }, '*');
            })
            .catch(err => {
              console.error('API Error:', err);
              // 失敗時依然傳回座標保底
              window.parent.postMessage({
                type: 'MAP_DIRECT_CLICK',
                lat: lat,
                lng: lng,
                placeName: defaultName
              }, '*');
            });
        });
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🗺️ 我們的足跡地圖</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => onOpenAddModal()}>
          <Text style={styles.addBtnText}>+ 手動打卡</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.mapContainer, { height: isMobile ? 220 : 350 }]}>
        <iframe
          title="Interactive Map"
          width="100%"
          height="100%"
          style={{ border: 0 }}
          srcDoc={mapHtml}
        />
        <View style={styles.overlayHint}>
          <Text style={styles.hintText} numberOfLines={2}>💡 關閉新增視窗後，點擊地圖任意處即可自動帶入地名！</Text>
        </View>
      </View>

      {places.length > 0 && (
        <View style={styles.placesList}>
          {places.map((place) => (
            <View key={place.id} style={styles.placeCard}>
              <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 140, minWidth: 0 }}>
                <Text style={styles.placeName} numberOfLines={2}>📍 {place.name}</Text>
                <Text style={styles.placeNote} numberOfLines={2}>{place.note}</Text>
              </View>
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.editBtn} onPress={() => onEditPlace(place)}>
                  <Text style={styles.btnText}>編輯</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => onDeletePlace(place.id)}>
                  <Text style={styles.btnText}>刪除</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, marginBottom: 16, borderWidth: 2, borderColor: '#FFE8D6' },
  header: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '800', color: '#7C6A58', flexShrink: 1 },
  addBtn: { backgroundColor: '#FF788E', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16 },
  addBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  mapContainer: { width: '100%', borderRadius: 20, overflow: 'hidden', position: 'relative', borderWidth: 1, borderColor: '#FFE8D6' },
  overlayHint: { position: 'absolute', bottom: 10, left: 10, right: 10, backgroundColor: 'rgba(255, 255, 255, 0.92)', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, alignItems: 'center', pointerEvents: 'none' },
  hintText: { fontSize: 11, fontWeight: '700', color: '#7C6A58' },
  placesList: { marginTop: 12, gap: 8 },
  placeCard: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, backgroundColor: '#FFFDF9', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: '#FFE8D6' },
  placeName: { fontSize: 13, fontWeight: '800', color: '#7C6A58' },
  placeNote: { fontSize: 12, color: '#A0836B' },
  btnRow: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },
  editBtn: { backgroundColor: '#70A1FF', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10 },
  deleteBtn: { backgroundColor: '#FF788E', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10 },
  btnText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
});