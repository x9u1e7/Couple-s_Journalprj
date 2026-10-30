import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { PlaceItem } from '../types';

interface Props {
  initialData?: Partial<PlaceItem> | null;
  onClose: () => void;
  onSave: (data: {
    id?: number;
    name: string;
    note: string;
    category: 'visited' | 'wish';
    visitDate: string;
    imageUrl: string;
    lat?: number;
    lng?: number;
  }) => void;
}

interface Suggestion {
  display_name: string;
  lat: string;
  lon: string;
}

export const AddPlaceModal: React.FC<Props> = ({ initialData, onClose, onSave }) => {
  const { width } = useWindowDimensions();
  const isPhone = width < 480;
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  // 直接拿 initialData 作為預設值
  const [name, setName] = useState(initialData?.name || '');
  const [note, setNote] = useState(initialData?.note || '');
  const [category, setCategory] = useState<'visited' | 'wish'>(initialData?.category || 'visited');
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || '');
  const [year, setYear] = useState<number>(currentYear);
  const [month, setMonth] = useState<number>(currentMonth);
  const [day, setDay] = useState<number>(currentDay);

  const [coords, setCoords] = useState<{ lat?: number; lng?: number }>({
    lat: initialData?.lat,
    lng: initialData?.lng,
  });

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimer = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 當每次跳出新資料或點擊點變更時，強行同步 State
  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setNote(initialData.note || '');
      setCategory(initialData.category || 'visited');
      setImageUrl(initialData.imageUrl || '');
      setCoords({ lat: initialData.lat, lng: initialData.lng });

      if (initialData.visitDate) {
        const d = new Date(initialData.visitDate);
        if (!isNaN(d.getTime())) {
          setYear(d.getFullYear());
          setMonth(d.getMonth() + 1);
          setDay(d.getDate());
        }
      }
    }
  }, [initialData?.name, initialData?.lat, initialData?.lng]);

  const yearOptions = Array.from({ length: 75 }, (_, i) => 2026 + i);

  const handleNameChange = (text: string) => {
    setName(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!text.trim()) {
      setSuggestions([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&limit=5&countrycodes=tw`
        );
        const data = await res.json();
        setSuggestions(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  };

  const handleSelectSuggestion = (item: Suggestion) => {
    setName(item.display_name.split(',')[0]);
    setCoords({ lat: parseFloat(item.lat), lng: parseFloat(item.lon) });
    setSuggestions([]);
  };

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) setImageUrl(event.target.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      const msg = '請輸入地點名稱！';
      if (typeof window !== 'undefined') window.alert(msg);
      else Alert.alert('提示', msg);
      return;
    }

    const selectedDate = new Date(year, month - 1, day);

    if (selectedDate > today) {
      const msg = `打卡日期不能是未來時間！已自動重置為今天 (${currentYear}/${currentMonth}/${currentDay})`;
      if (typeof window !== 'undefined') window.alert(msg);
      else Alert.alert('提示', msg);

      setYear(currentYear);
      setMonth(currentMonth);
      setDay(currentDay);
      return;
    }

    const formattedDate = `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;

    onSave({
      id: initialData?.id,
      name: name.trim(),
      note: note.trim(),
      category,
      visitDate: formattedDate,
      imageUrl,
      lat: coords.lat,
      lng: coords.lng,
    });
    onClose();
  };

  return (
    <View style={styles.overlay}>
      <View style={[styles.modalCard, isPhone && styles.modalCardPhone]}>
        <Text style={styles.title}>{initialData?.id ? '✏️ 編輯足跡地點' : '📍 新增足跡地點'}</Text>

        <Text style={styles.label}>選擇標籤：</Text>
        <View style={styles.categoryRow}>
          <TouchableOpacity
            style={[styles.catBtn, category === 'visited' && styles.catBtnVisited]}
            onPress={() => setCategory('visited')}
          >
            <Text style={[styles.catBtnText, category === 'visited' && styles.catBtnTextActive]}>
              ✅ 已完成
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.catBtn, category === 'wish' && styles.catBtnWish]}
            onPress={() => setCategory('wish')}
          >
            <Text style={[styles.catBtnText, category === 'wish' && styles.catBtnTextActive]}>
              ✨ 想去！
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="地點名稱 (手動輸入或直接點擊地圖標記)"
            placeholderTextColor="#B5A89E"
            value={name}
            onChangeText={handleNameChange}
          />
          {isSearching && <Text style={styles.searchingText}>🔍 搜尋地點中...</Text>}

          {suggestions.length > 0 && (
            <View style={styles.suggestionList}>
              {suggestions.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.suggestionItem}
                  onPress={() => handleSelectSuggestion(item)}
                >
                  <Text style={styles.suggestionTitle}>{item.display_name.split(',')[0]}</Text>
                  <Text style={styles.suggestionSub} numberOfLines={1}>
                    {item.display_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>🗓️ 打卡日期：</Text>
          <View style={styles.datePickerRow}>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              style={selectStyle}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y} 年
                </option>
              ))}
            </select>

            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              style={selectStyle}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m} 月
                </option>
              ))}
            </select>

            <select
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
              style={selectStyle}
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d} 日
                </option>
              ))}
            </select>
          </View>
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>🖼️ 地點相片：</Text>
          {typeof window !== 'undefined' && (
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImagePick}
              style={{ display: 'none' }}
            />
          )}

          <TouchableOpacity style={styles.pickImageBtn} onPress={() => fileInputRef.current?.click()}>
            <Text style={styles.pickImageBtnText}>
              {imageUrl ? '📷 更換相片' : '📁 從相簿選擇相片'}
            </Text>
          </TouchableOpacity>

          {imageUrl !== '' && (
            <View style={styles.previewContainer}>
              <Image source={{ uri: imageUrl }} style={styles.previewImage} resizeMode="cover" />
              <TouchableOpacity style={styles.removeImgBtn} onPress={() => setImageUrl('')}>
                <Text style={styles.removeImgText}>✕ 移除相片</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="為什麼想存這裡...？"
          placeholderTextColor="#B5A89E"
          multiline
          value={note}
          onChangeText={setNote}
        />

        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>取消</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveText}>儲存</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const selectStyle: React.CSSProperties = {
  flexGrow: 1,
  flexBasis: 72,
  minWidth: 72,
  backgroundColor: '#FAF4ED',
  border: '1px solid #EFE3D8',
  borderRadius: '12px',
  padding: '10px 8px',
  fontSize: '13px',
  color: '#4A3E3D',
  outline: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: '600',
};

const styles = StyleSheet.create({
  overlay: {
    position: 'fixed' as any,
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(30, 25, 22, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  modalCard: {
    width: '92%',
    maxWidth: 420,
    backgroundColor: '#FFF',
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    maxHeight: '85vh' as any,
    overflow: 'auto' as any,
  },
  modalCardPhone: {
    padding: 16,
  },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 14, color: '#5C4D44' },
  label: { fontSize: 12, fontWeight: '700', color: '#8C7A6B', marginBottom: 8 },
  categoryRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  catBtn: { flex: 1, paddingVertical: 8, borderRadius: 12, backgroundColor: '#FAF4ED', alignItems: 'center', borderWidth: 1, borderColor: '#EFE3D8' },
  catBtnVisited: { backgroundColor: '#52B788', borderColor: '#52B788' },
  catBtnWish: { backgroundColor: '#E07A5F', borderColor: '#E07A5F' },
  catBtnText: { fontSize: 13, fontWeight: '700', color: '#8C7A6B' },
  catBtnTextActive: { color: '#FFF' },
  inputWrapper: { position: 'relative', zIndex: 10, marginBottom: 10 },
  input: { backgroundColor: '#FAF4ED', borderRadius: 14, padding: 12, fontSize: 13, borderWidth: 1, borderColor: '#EFE3D8', color: '#4A3E3D' },
  searchingText: { fontSize: 11, color: '#8C7A6B', marginTop: 4, marginLeft: 4 },
  suggestionList: {
    position: 'absolute' as any,
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFE3D8',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    zIndex: 100,
    maxHeight: 180,
    overflow: 'auto' as any,
  },
  suggestionItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#FAF4ED' },
  suggestionTitle: { fontSize: 13, fontWeight: '700', color: '#4A3E3D' },
  suggestionSub: { fontSize: 11, color: '#9C8E85', marginTop: 2 },
  fieldContainer: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#8C7A6B', marginBottom: 6 },
  datePickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickImageBtn: { backgroundColor: '#FAF4ED', borderWidth: 1, borderColor: '#EFE3D8', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  pickImageBtnText: { fontSize: 13, fontWeight: '600', color: '#6B5B52' },
  previewContainer: { marginTop: 8, alignItems: 'center' },
  previewImage: { width: '100%', height: 130, borderRadius: 12 },
  removeImgBtn: { marginTop: 6, paddingVertical: 4, paddingHorizontal: 8 },
  removeImgText: { fontSize: 12, color: '#E07A5F', fontWeight: '600' },
  textArea: { height: 75, textAlignVertical: 'top', marginTop: 10 },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12, backgroundColor: '#FAF4ED' },
  saveBtn: { paddingVertical: 10, paddingHorizontal: 22, borderRadius: 12, backgroundColor: '#E07A5F' },
  cancelText: { color: '#8C7A6B', fontSize: 13, fontWeight: '600' },
  saveText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
});