import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { AddPlaceModal } from '../components/AddPlaceModal';
import { MapSection } from '../components/MapSection';
import { supabase } from '../lib/supabase';
import { PlaceItem, UserType } from '../types';

export interface PostItem {
  id: number | string;
  author: string;
  avatar: string;
  content: string;
  imageUrls: string[];
  createdAt: string;
}

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const showSides = width >= 1080;
  const isCompact = width < 720;
  const isNarrow = width < 400;
  const pagePad = isNarrow ? 10 : isCompact ? 12 : 20;
  const [feedWidth, setFeedWidth] = useState(0);
  const estimatedFeed = showSides ? Math.min(width * 0.56, 760) : width - pagePad * 2;
  const postImageWidth = Math.max(140, Math.min(520, (feedWidth || estimatedFeed) - (isCompact ? 36 : 44)));
  const postImageHeight = Math.round(postImageWidth * 0.68);
  const modalWidth = Math.max(260, Math.min(420, width - 16));
  const batchWidth = Math.max(260, Math.min(460, width - 16));
  const cardPad = isNarrow ? 14 : 20;

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserType>('男方');
  const [loginAccount, setLoginAccount] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [maleName, setMaleName] = useState('mengxueho0917');
  const [partnerName, setPartnerName] = useState('oliviahung1224');
  const [maleAvatar, setMaleAvatar] = useState('https://picsum.photos/100/100?random=100');
  const [partnerAvatar, setPartnerAvatar] = useState('https://picsum.photos/100/100?random=101');

  const startDate = '2026-06-17';
  const defaultCoupleId = '61de5bed-df25-456a-8308-527fdc271221';
  const [coupleId, setCoupleId] = useState<string | null>(null);

  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [reopenBatchModal, setReopenBatchModal] = useState(false);

  const notify = (title: string, msg: string) => {
    if (typeof window !== 'undefined' && window.alert) {
      window.alert(`${title}\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    const body = document.body;
    const previousHtml = html.style.overflowX;
    const previousBody = body.style.overflowX;
    html.style.overflowX = 'hidden';
    body.style.overflowX = 'hidden';
    html.style.maxWidth = '100%';
    body.style.maxWidth = '100%';
    return () => {
      html.style.overflowX = previousHtml;
      body.style.overflowX = previousBody;
    };
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setIsLoggedIn(true);
        fetchUserProfile(session.user.id);
        fetchAlbumPhotos();
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setIsLoggedIn(true);
        fetchUserProfile(session.user.id);
        fetchAlbumPhotos();
      } else {
        setIsLoggedIn(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      fetchPosts();
      fetchPlaces();
    }
  }, [maleName, partnerName, maleAvatar, partnerAvatar, isLoggedIn, coupleId]);

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (data && !error) {
        const formattedPosts: PostItem[] = data.map((item) => {
          let currentAuthor = item.author || '匿名';
          let currentAvatar = item.avatar || 'https://picsum.photos/100/100?random=999';

          if (item.author && (item.author.includes('mengxueho') || item.author.includes('justin') || item.author === maleName)) {
            currentAuthor = maleName;
            currentAvatar = maleAvatar;
          } else if (item.author && (item.author.includes('olivia') || item.author === partnerName)) {
            currentAuthor = partnerName;
            currentAvatar = partnerAvatar;
          }

          return {
            id: item.id,
            author: currentAuthor,
            avatar: currentAvatar,
            content: item.content || '',
            imageUrls: item.image_urls || [],
            createdAt: new Date(item.created_at).toLocaleString(),
          };
        });
        setPosts(formattedPosts);
      }
    } catch (e) {
      console.error('讀取貼文失敗：', e);
    }
  };

  const toDbCategory = (category: 'visited' | 'wish') => (category === 'wish' ? 'wishlist' : 'visited');

  const toAppCategory = (category?: string): 'visited' | 'wish' =>
    category === 'wishlist' || category === 'wish' ? 'wish' : 'visited';

  const toDbDate = (visitDate?: string) => {
    if (!visitDate) return null;
    const parts = visitDate.split(/[/-]/).map((part) => part.trim());
    if (parts.length !== 3) return visitDate;
    const [year, month, day] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  const fetchPlaces = async (cId?: string | null) => {
    const targetCoupleId = cId || coupleId || defaultCoupleId;
    try {
      const { data, error } = await supabase
        .from('places')
        .select('id, name, category, note, created_by, created_at, visit_date, image_url, lat, lng')
        .eq('couple_id', targetCoupleId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('讀取地點失敗：', error.message);
        return;
      }

      setPlaces(
        (data || []).map((item) => ({
          id: item.id,
          name: item.name || '',
          category: toAppCategory(item.category),
          note: item.note || '',
          createdBy: item.created_by || '',
          createdAt: item.created_at ? new Date(item.created_at).toLocaleDateString() : '',
          visitDate: item.visit_date || undefined,
          imageUrl: item.image_url || undefined,
          lat: Number(item.lat) || 0,
          lng: Number(item.lng) || 0,
        }))
      );
    } catch (e) {
      console.error('讀取地點失敗：', e);
    }
  };

  const fetchAlbumPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from('album_photos')
        .select('id, title, url')
        .order('created_at', { ascending: false });

      if (data && data.length > 0 && !error) {
        setAlbumPhotos(data);
      }
    } catch (e) {
      console.error('讀取相簿失敗：', e);
    }
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('gender, nickname, avatar_url, couple_id')
        .eq('id', userId)
        .maybeSingle();

      if (data && !error) {
        if (data.gender === '男方') {
          setCurrentUser('男方');
          if (data.nickname) setMaleName(data.nickname);
          if (data.avatar_url) setMaleAvatar(data.avatar_url);
        } else {
          setCurrentUser('女方');
          if (data.nickname) setPartnerName(data.nickname);
          if (data.avatar_url) setPartnerAvatar(data.avatar_url);
        }

        if (data.couple_id) {
          setCoupleId(data.couple_id);
          fetchPartnerProfile(data.couple_id, userId);
        }
      }
    } catch (e) {
      console.error('讀取個人資料失敗：', e);
    }
  };

  const fetchPartnerProfile = async (cId: string, myUserId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('gender, nickname, avatar_url')
        .eq('couple_id', cId)
        .neq('id', myUserId)
        .maybeSingle();

      if (data) {
        if (data.gender === '男方') {
          if (data.nickname) setMaleName(data.nickname);
          if (data.avatar_url) setMaleAvatar(data.avatar_url);
        } else {
          if (data.nickname) setPartnerName(data.nickname);
          if (data.avatar_url) setPartnerAvatar(data.avatar_url);
        }
      }
    } catch (e) {
      console.error('讀取伴侶資料失敗：', e);
    }
  };

  const [showModal, setShowModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchTab, setBatchTab] = useState<'upload' | 'history'>('upload');
  const [editingPlace, setEditingPlace] = useState<Partial<PlaceItem> | null>(null);

  const [postAuthorFilter, setPostAuthorFilter] = useState<'全部' | '男生' | '女生'>('全部');
  const [selectedBatchImages, setSelectedBatchImages] = useState<string[]>([]);
  const [batchCaption, setBatchCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImages, setNewPostImages] = useState<string[]>([]);

  const [albumPhotos, setAlbumPhotos] = useState<Array<{ id?: string | number; title: string; url: string }>>([
    { id: '1', title: '🌸 淡水看夕陽', url: 'https://picsum.photos/300/400?random=1' },
    { id: '2', title: '🎀 第一次約會', url: 'https://picsum.photos/300/400?random=2' },
  ]);

  const [places, setPlaces] = useState<PlaceItem[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);

  const calculateDaysTogether = () => {
    const start = new Date(startDate);
    const today = new Date();
    start.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return isNaN(diffDays) ? 0 : diffDays;
  };

  const daysTogether = calculateDaysTogether();

  const daysUntilAnniversary = (() => {
    const start = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(start.getTime())) return 0;
    const next = new Date(today.getFullYear(), start.getMonth(), start.getDate());
    next.setHours(0, 0, 0, 0);
    if (next.getTime() < today.getTime()) next.setFullYear(next.getFullYear() + 1);
    return Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  })();

  const PHOTO_ITEM_HEIGHT = 280;
  const countPerSide = Math.min(4, Math.max(2, Math.floor(height / PHOTO_ITEM_HEIGHT) || 2));
  const totalSlots = countPerSide * 2;

  const getRandomPhotos = useCallback((pool: typeof albumPhotos, totalNeeded: number) => {
    if (!pool || pool.length === 0) return [];
    let expandedPool: typeof albumPhotos = [];
    while (expandedPool.length < totalNeeded) {
      expandedPool = [...expandedPool, ...pool];
    }
    const shuffled = [...expandedPool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, totalNeeded);
  }, []);

  const [displayPhotos, setDisplayPhotos] = useState<Array<{ title: string; url: string }>>([]);

  useEffect(() => {
    if (!isLoggedIn || albumPhotos.length === 0) return;

    setDisplayPhotos(getRandomPhotos(albumPhotos, totalSlots));

    const timer = setInterval(() => {
      setDisplayPhotos(getRandomPhotos(albumPhotos, totalSlots));
    }, 5000);

    return () => clearInterval(timer);
  }, [isLoggedIn, albumPhotos, totalSlots, getRandomPhotos]);

  const dynamicLeftPhotos = displayPhotos.slice(0, countPerSide).map((photo, index) => ({
    id: `left-${index}`,
    url: photo.url,
    title: photo.title,
  }));

  const dynamicRightPhotos = displayPhotos.slice(countPerSide, totalSlots).map((photo, index) => ({
    id: `right-${index}`,
    url: photo.url,
    title: photo.title,
  }));

  const handleLogin = async () => {
    const acc = loginAccount.trim().toLowerCase();
    const pwd = loginPassword.trim();

    if (!acc && !pwd) return notify('提示', '請輸入帳號與密碼唷！');
    if (!acc) return notify('提示', '請輸入帳號唷！');
    if (!pwd) return notify('提示', '請輸入密碼唷！');

    const email = acc.includes('@') ? acc : `${acc}@gmail.com`;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pwd,
      });

      if (error) {
        if (error.message.includes('rate limit')) {
          return notify('請稍後再試 ⏳', '請求太頻繁，請等待約 10~15 分鐘冷卻後再試！');
        }
        return notify('登入失敗 ❌', '帳號或密碼錯誤，請確認後重試！');
      }

      if (data?.user) {
        const isGirl = acc.includes('olivia');
        const role: UserType = isGirl ? '女方' : '男方';

        await supabase.from('profiles').upsert({
          id: data.user.id,
          couple_id: defaultCoupleId,
          gender: role,
          nickname: acc,
        });

        setCurrentUser(role);
        setIsLoggedIn(true);
        await fetchUserProfile(data.user.id);
        await fetchAlbumPhotos();
      }
    } catch (err) {
      console.error(err);
      notify('連線錯誤 ⚠️', '無法連線到伺服器！');
    }
  };

  const handlePickAvatar = async (targetGender: '男方' | '女方') => {
    if (currentUser !== targetGender) {
      notify('權限限制 🔒', `您目前是${currentUser}身份，無法直接修改${targetGender}的頭像唷！`);
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      notify('權限不足', '需要開放相簿權限才能更換頭像！');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });

    if (!result.canceled && result.assets[0].uri) {
      const uri = result.assets[0].uri;
      const uploadedUrl = await uploadImageToSupabase(uri);
      if (uploadedUrl) {
        if (targetGender === '男方') {
          setMaleAvatar(uploadedUrl);
        } else {
          setPartnerAvatar(uploadedUrl);
        }
      }
    }
  };

  const handleSaveSettings = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const myNickname = currentUser === '男方' ? maleName : partnerName;
      const myAvatar = currentUser === '男方' ? maleAvatar : partnerAvatar;

      const { error } = await supabase
        .from('profiles')
        .update({ 
          nickname: myNickname,
          avatar_url: myAvatar
        })
        .eq('id', session.user.id);

      if (error) {
        notify('儲存失敗 ❌', error.message);
        return;
      }

      notify('成功 💕', '設定已同步儲存！');
      setShowSettingsModal(false);
      await fetchUserProfile(session.user.id);
    } catch (err) {
      console.error('更新暱稱/頭像失敗：', err);
    }
  };

  const handleLogout = async () => {
    setShowSettingsModal(false);
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setPlaces([]);
    setLoginAccount('');
    setLoginPassword('');
  };

  const pickBatchImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      notify('權限不足', '需要開放相簿權限才能選擇照片唷！');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.6,
    });

    if (!result.canceled) {
      const uris = result.assets.map((asset) => asset.uri);
      setSelectedBatchImages([...selectedBatchImages, ...uris]);
    }
  };

  const uploadImageToSupabase = async (uri: string): Promise<string | null> => {
    try {
      const response = await fetch(uri);
      const fileData = await response.blob();
      const contentType = fileData.type && fileData.type.startsWith('image/') ? fileData.type : 'image/jpeg';
      const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const filePath = `posts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, fileData, { contentType });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('photos').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err) {
      console.error('照片上傳 Storage 失敗：', err);
      return null;
    }
  };

  const handleConfirmBatchUpload = async () => {
    if (selectedBatchImages.length === 0) {
      notify('提示', '請至少選擇一張照片唷！');
      return;
    }

    setIsUploading(true);
    const captionText = batchCaption.trim() || '甜蜜照片 💕';
    const targetCoupleId = coupleId || defaultCoupleId;

    try {
      const uploadPromises = selectedBatchImages.map(async (uri) => {
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000));
        const uploadTask = uploadImageToSupabase(uri);
        const uploadedUrl = await Promise.race([uploadTask, timeoutPromise]);
        
        if (uploadedUrl) {
          return { couple_id: targetCoupleId, title: captionText, url: uploadedUrl };
        }
        return null;
      });

      const results = await Promise.all(uploadPromises);
      const newPhotoRecords = results.filter(
        (item): item is { couple_id: string; title: string; url: string } => item !== null
      );

      if (newPhotoRecords.length > 0) {
        const { error } = await supabase.from('album_photos').insert(newPhotoRecords);

        if (error) {
          notify('儲存失敗 ❌', error.message);
        } else {
          notify('成功 💕', `已成功上傳 ${newPhotoRecords.length} 張照片！`);
          await fetchAlbumPhotos();
          setSelectedBatchImages([]);
          setBatchCaption('');
          setShowBatchModal(false);
        }
      } else {
        notify('上傳失敗 ❌', '網路連線逾時，請再試一次！');
      }
    } catch (err) {
      console.error('批量上傳失敗：', err);
      notify('錯誤 ⚠️', '上傳過程中發生錯誤');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAlbumPhoto = async (photoId?: string | number) => {
    if (!photoId) return;

    try {
      const { error } = await supabase.from('album_photos').delete().eq('id', photoId);

      if (error) {
        notify('刪除失敗 ❌', error.message);
      } else {
        notify('成功', '照片已刪除！');
        setAlbumPhotos(albumPhotos.filter((p) => p.id !== photoId));
      }
    } catch (err) {
      console.error('刪除照片失敗：', err);
    }
  };

  const pickPostImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      notify('權限不足', '需要開放相簿權限才能選擇貼文照片！');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.6,
    });

    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri);
      setNewPostImages([...newPostImages, ...uris]);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim() && newPostImages.length === 0) {
      notify('提示', '請輸入貼文內容或選擇照片！');
      return;
    }

    setIsUploading(true);
    const authorName = currentUser === '男方' ? maleName : partnerName;
    const authorAvatar = currentUser === '男方' ? maleAvatar : partnerAvatar;
    const targetCoupleId = coupleId || defaultCoupleId;

    try {
      const uploadedUrls: string[] = [];
      for (const uri of newPostImages) {
        const url = await uploadImageToSupabase(uri);
        if (url) uploadedUrls.push(url);
      }

      const { error } = await supabase
        .from('posts')
        .insert([
          {
            couple_id: targetCoupleId,
            author: authorName,
            avatar: authorAvatar,
            content: newPostContent,
            image_urls: uploadedUrls,
          },
        ]);

      if (error) {
        notify('貼文發布失敗 ❌', error.message);
      } else {
        const currentContent = newPostContent;
        setNewPostContent('');
        setNewPostImages([]);
        await fetchPosts();

        if (uploadedUrls.length > 0) {
          const askMsg = '貼文發布成功！要順便將這些照片同步加到「照片牆/相簿」嗎？';
          
          if (typeof window !== 'undefined' && window.confirm) {
            if (window.confirm(askMsg)) {
              await addPostPhotosToAlbum(targetCoupleId, currentContent, uploadedUrls);
            }
          } else {
            Alert.alert('發布成功 ✨', askMsg, [
              { text: '不用了', style: 'cancel' },
              {
                text: '加到相簿 💕',
                onPress: () => addPostPhotosToAlbum(targetCoupleId, currentContent, uploadedUrls),
              },
            ]);
          }
        } else {
          notify('成功 ✨', '貼文發布成功！');
        }
      }
    } catch (err) {
      console.error('發布貼文異常：', err);
      notify('錯誤 ⚠️', '發布過程中發生異常');
    } finally {
      setIsUploading(false);
    }
  };

  const addPostPhotosToAlbum = async (cId: string, content: string, urls: string[]) => {
    try {
      const titleText = content.trim() || '動態照片 💕';
      const records = urls.map((url) => ({
        couple_id: cId,
        title: titleText,
        url: url,
      }));

      const { error } = await supabase.from('album_photos').insert(records);
      if (error) {
        notify('同步相簿失敗 ❌', error.message);
      } else {
        notify('成功 📸', '照片已同步加到照片牆囉！');
        await fetchAlbumPhotos();
      }
    } catch (e) {
      console.error('同步相簿異常：', e);
    }
  };

  const filteredPosts = posts.filter((p) => {
    if (postAuthorFilter === '男生') return p.author === maleName;
    if (postAuthorFilter === '女生') return p.author === partnerName;
    return true;
  });

  const handleSavePlace = async (data: {
    id?: number;
    name: string;
    note: string;
    category: 'visited' | 'wish';
    visitDate: string;
    imageUrl: string;
    lat?: number;
    lng?: number;
  }) => {
    const targetCoupleId = coupleId || defaultCoupleId;
    let imageUrl = data.imageUrl || '';

    if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:') || imageUrl.startsWith('file:')) {
      const uploadedUrl = await uploadImageToSupabase(imageUrl);
      if (!uploadedUrl) {
        notify('上傳失敗 ❌', '地點照片沒有上傳成功，請再試一次');
        return;
      }
      imageUrl = uploadedUrl;
    }

    const payload = {
      name: data.name,
      category: toDbCategory(data.category),
      note: data.note || '記錄美好足跡',
      visit_date: toDbDate(data.visitDate),
      image_url: imageUrl || null,
      lat: data.lat ?? 25.033 + (Math.random() - 0.5) * 0.05,
      lng: data.lng ?? 121.5654 + (Math.random() - 0.5) * 0.05,
    };

    try {
      if (data.id) {
        const { error } = await supabase.from('places').update(payload).eq('id', data.id);
        if (error) {
          notify('儲存失敗 ❌', error.message);
          return;
        }
      } else {
        const { error } = await supabase.from('places').insert({
          ...payload,
          couple_id: targetCoupleId,
          created_by: currentUser === '男方' ? maleName : partnerName,
        });
        if (error) {
          notify('儲存失敗 ❌', error.message);
          return;
        }
      }

      await fetchPlaces(targetCoupleId);
    } catch (err) {
      console.error('儲存地點失敗：', err);
      notify('錯誤 ⚠️', '儲存地點時發生錯誤');
    }
  };

  const handleDeletePlace = async (id: number) => {
    const previous = places;
    setPlaces(places.filter((place) => place.id !== id));

    const { error } = await supabase.from('places').delete().eq('id', id);
    if (error) {
      setPlaces(previous);
      notify('刪除失敗 ❌', error.message);
    }
  };

  const handleOpenPreview = (url: string, fromBatchModal = false) => {
    if (fromBatchModal) {
      setReopenBatchModal(true);
      setShowBatchModal(false);
    }
    setPreviewImageUrl(url);
  };

  const handleClosePreview = () => {
    setPreviewImageUrl(null);
    if (reopenBatchModal) {
      setShowBatchModal(true);
      setReopenBatchModal(false);
    }
  };

  const renderMaleSettingSection = () => (
    <View style={styles.avatarRow}>
      <TouchableOpacity onPress={() => handlePickAvatar('男方')}>
        <Image source={{ uri: maleAvatar }} style={styles.settingAvatar} />
        <Text style={styles.avatarChangeHint}>
          {currentUser === '男方' ? '更換' : '不可改'}
        </Text>
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.subLabel}>🐻 男生暱稱：</Text>
        <TextInput style={styles.modalInput} value={maleName} onChangeText={setMaleName} />
      </View>
    </View>
  );

  const renderFemaleSettingSection = () => (
    <View style={styles.avatarRow}>
      <TouchableOpacity onPress={() => handlePickAvatar('女方')}>
        <Image source={{ uri: partnerAvatar }} style={styles.settingAvatar} />
        <Text style={styles.avatarChangeHint}>
          {currentUser === '女方' ? '更換' : '不可改'}
        </Text>
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.subLabel}>🐰 女生暱稱：</Text>
        <TextInput style={styles.modalInput} value={partnerName} onChangeText={setPartnerName} />
      </View>
    </View>
  );

  if (!isLoggedIn) {
    return (
      <View style={styles.loginContainer}>
        <View style={[styles.loginCard, { width: '100%', maxWidth: modalWidth, padding: cardPad }]}>
          <Text style={styles.loginTitle}>🏠 我們的浪漫小屋</Text>
          <Text style={styles.loginSubtitle}>請登入帳號以進入專屬空間 💕</Text>

          <View style={styles.loginInputGroup}>
            <Text style={styles.loginLabel}>👤 帳號：</Text>
            <TextInput
              style={styles.loginInput}
              placeholder="例如: mengxueho0917"
              value={loginAccount}
              onChangeText={setLoginAccount}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.loginInputGroup}>
            <Text style={styles.loginLabel}>🔒 密碼：</Text>
            <TextInput
              style={styles.loginInput}
              placeholder="請輸入密碼"
              secureTextEntry
              value={loginPassword}
              onChangeText={setLoginPassword}
            />
          </View>

          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
            <Text style={styles.loginBtnText}>登入小屋 ✨</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { padding: pagePad }]}>
      <View style={[styles.mainLayout, !showSides && styles.mainLayoutMobile]}>
        {showSides && (
          <View style={styles.sideColumn}>
            {dynamicLeftPhotos.map((photo) => (
              <TouchableOpacity key={photo.id} activeOpacity={0.9} onPress={() => handleOpenPreview(photo.url)} style={styles.photoCard}>
                <Image source={{ uri: photo.url }} style={styles.photoImage} />
                <Text style={styles.photoTitle}>{photo.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View
          style={[styles.centerColumn, !showSides && styles.centerColumnMobile]}
          onLayout={(event) => {
            const next = Math.floor(event.nativeEvent.layout.width);
            setFeedWidth((current) => (Math.abs(current - next) > 1 ? next : current));
          }}
        >
          <View style={[styles.topHeaderCard, isCompact && styles.topHeaderCardPhone]}>
            <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowSettingsModal(true)}>
              <Text style={styles.settingsBtnText}>⚙️ 設定</Text>
            </TouchableOpacity>

            <View style={[styles.roleGroup, isCompact && styles.roleGroupPhone]}>
              <View style={[styles.roleChip, isCompact && styles.roleChipFull, currentUser === '男方' ? styles.activeMale : styles.inactiveChip]}>
                <Image source={{ uri: maleAvatar }} style={styles.headerAvatar} />
                <Text numberOfLines={1} style={[styles.roleText, currentUser === '男方' && styles.whiteText]}>
                  {maleName} {currentUser === '男方' && '(我)'}
                </Text>
              </View>

              <View style={[styles.roleChip, isCompact && styles.roleChipFull, currentUser === '女方' ? styles.activeFemale : styles.inactiveChip]}>
                <Image source={{ uri: partnerAvatar }} style={styles.headerAvatar} />
                <Text numberOfLines={1} style={[styles.roleText, currentUser === '女方' && styles.whiteText]}>
                  {partnerName} {currentUser === '女方' && '(我)'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.anniversaryCard}>
            <Text style={styles.anniversaryText}>
              💖 我們已經在一起 <Text style={[styles.daysText, isCompact && styles.daysTextPhone, isNarrow && styles.daysTextNarrow]}>{daysTogether}</Text> 天囉！✨
            </Text>
            <Text style={styles.countdownText}>
              {daysUntilAnniversary === 0 ? '🎉 今天是我們的紀念日' : `🗓️ 下一個紀念日還有 ${daysUntilAnniversary} 天`}
            </Text>
          </View>

          <TouchableOpacity style={styles.batchBtn} onPress={() => setShowBatchModal(true)}>
            <Text style={[styles.batchBtnText, isNarrow && styles.batchBtnTextNarrow]}>📸 相簿管理 (新增 / 查看 / 刪除照片)</Text>
          </TouchableOpacity>

          <MapSection
            places={places}
            onOpenAddModal={(data) => {
              setEditingPlace(data ? data : null);
              setShowModal(true);
            }}
            onEditPlace={(place) => {
              setEditingPlace(place);
              setShowModal(true);
            }}
            onDeletePlace={handleDeletePlace}
          />

          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterChip, postAuthorFilter === '全部' && styles.filterChipActive]}
              onPress={() => setPostAuthorFilter('全部')}
            >
              <Text numberOfLines={1} style={[styles.filterText, postAuthorFilter === '全部' && styles.filterTextActive]}>
                ✨ 全部動態
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, postAuthorFilter === '男生' && styles.filterChipActiveMale]}
              onPress={() => setPostAuthorFilter('男生')}
            >
              <Image source={{ uri: maleAvatar }} style={styles.filterAvatar} />
              <Text numberOfLines={1} style={[styles.filterText, postAuthorFilter === '男生' && styles.filterTextActive]}>
                {maleName} 發的
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, postAuthorFilter === '女生' && styles.filterChipActiveFemale]}
              onPress={() => setPostAuthorFilter('女生')}
            >
              <Image source={{ uri: partnerAvatar }} style={styles.filterAvatar} />
              <Text numberOfLines={1} style={[styles.filterText, postAuthorFilter === '女生' && styles.filterTextActive]}>
                {partnerName} 發的
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.postComposerCard}>
            <TextInput
              style={styles.composerInput}
              placeholder="分享今天的甜蜜時刻..."
              value={newPostContent}
              onChangeText={setNewPostContent}
              multiline
              editable={!isUploading}
            />

            {newPostImages.length > 0 && (
              <ScrollView horizontal style={styles.previewImageRow} showsHorizontalScrollIndicator={false}>
                {newPostImages.map((uri, idx) => (
                  <View key={idx} style={styles.composerImgWrapper}>
                    <Image source={{ uri }} style={styles.composerPreviewImg} />
                    <TouchableOpacity
                      style={styles.removeImgBtn}
                      onPress={() => setNewPostImages(newPostImages.filter((_, i) => i !== idx))}
                    >
                      <Text style={styles.removeImgText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={[styles.composerActionRow, isNarrow && styles.composerActionStack]}>
              <TouchableOpacity style={[styles.addImgBtn, isNarrow && styles.fullWidthBtn]} onPress={pickPostImages} disabled={isUploading}>
                <Text style={styles.addImgBtnText}>📷 選擇照片 (多張)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.publishBtn, isNarrow && styles.fullWidthBtn, isUploading && styles.disabledBtn]} onPress={handleCreatePost} disabled={isUploading}>
                {isUploading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.publishBtnText}>發布動態 ✨</Text>}
              </TouchableOpacity>
            </View>
          </View>

          {filteredPosts.length === 0 ? (
            <View style={styles.emptyPostContainer}>
              <Text style={styles.emptyPostText}>📷 目前還沒有動態唷，快發布第一篇吧！</Text>
            </View>
          ) : (
            filteredPosts.map((post) => (
              <View key={post.id} style={styles.igPostCard}>
                <View style={styles.igHeader}>
                  <Image source={{ uri: post.avatar }} style={styles.igAvatar} />
                  <View style={styles.igAuthorBlock}>
                    <Text numberOfLines={1} style={styles.igAuthor}>{post.author}</Text>
                    <Text style={styles.igTime}>{post.createdAt}</Text>
                  </View>
                </View>

                {post.imageUrls && post.imageUrls.length > 0 && (
                  <View style={styles.swiperContainer}>
                    {post.imageUrls.length === 1 ? (
                      <TouchableOpacity activeOpacity={0.9} onPress={() => handleOpenPreview(post.imageUrls[0])}>
                        <Image
                          source={{ uri: post.imageUrls[0] }}
                          style={[styles.igPostImage, { width: '100%', height: postImageHeight }]}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    ) : (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.igImageSwiper}
                      contentContainerStyle={styles.igImageScrollContent}
                    >
                      {post.imageUrls.map((img, idx) => (
                        <TouchableOpacity
                          key={idx}
                          activeOpacity={0.9}
                          onPress={() => handleOpenPreview(img)}
                          style={styles.igPostImageWrapper}
                        >
                          <Image
                            source={{ uri: img }}
                            style={[styles.igPostImage, { width: postImageWidth, height: postImageHeight }]}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    )}
                    {post.imageUrls.length > 1 && (
                      <View style={styles.imageBadge}>
                        <Text style={styles.imageBadgeText}>多圖 ↔ 滑動 (點擊放大)</Text>
                      </View>
                    )}
                  </View>
                )}

                <Text style={styles.igContent}>{post.content}</Text>
              </View>
            ))
          )}
        </View>

        {showSides && (
          <View style={styles.sideColumn}>
            {dynamicRightPhotos.map((photo) => (
              <TouchableOpacity key={photo.id} activeOpacity={0.9} onPress={() => handleOpenPreview(photo.url)} style={styles.photoCard}>
                <Image source={{ uri: photo.url }} style={styles.photoImage} />
                <Text style={styles.photoTitle}>{photo.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!showSides && (
          <View style={styles.mobilePhotoGrid}>
            <Text style={styles.mobileSectionTitle}>📸 我們的甜蜜照片牆</Text>
            <View style={styles.mobilePhotoRow}>
              {[...dynamicLeftPhotos, ...dynamicRightPhotos].map((photo) => (
                <View key={photo.id} style={[styles.mobilePhotoSlot, { width: width < 560 ? '50%' : '33.33%' }]}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => handleOpenPreview(photo.url)} style={styles.mobilePhotoCard}>
                    <Image source={{ uri: photo.url }} style={styles.mobilePhotoImage} />
                    <Text style={styles.photoTitle} numberOfLines={1}>{photo.title}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      <Modal visible={!!previewImageUrl} transparent animationType="fade">
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity style={styles.lightboxCloseBtn} onPress={handleClosePreview}>
            <Text style={styles.lightboxCloseText}>✕ 關閉</Text>
          </TouchableOpacity>
          {previewImageUrl && (
            <Image
              source={{ uri: previewImageUrl }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {showModal && (
        <AddPlaceModal
          initialData={editingPlace}
          onClose={() => { setShowModal(false); setEditingPlace(null); }}
          onSave={handleSavePlace}
        />
      )}

      <Modal visible={showBatchModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.batchCard, { width: batchWidth, maxWidth: '100%', maxHeight: height * 0.88, padding: cardPad }]}>
            <Text style={styles.modalTitle}>🖼️ 我們的照片牆管理</Text>

            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tabBtn, batchTab === 'upload' && styles.tabBtnActive]}
                onPress={() => setBatchTab('upload')}
              >
                <Text numberOfLines={2} style={[styles.tabText, isNarrow && styles.tabTextNarrow, batchTab === 'upload' && styles.tabTextActive]}>➕ 上傳新照片</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, batchTab === 'history' && styles.tabBtnActive]}
                onPress={() => setBatchTab('history')}
              >
                <Text numberOfLines={2} style={[styles.tabText, isNarrow && styles.tabTextNarrow, batchTab === 'history' && styles.tabTextActive]}>
                  🖼️ 歷史相簿 ({albumPhotos.length})
                </Text>
              </TouchableOpacity>
            </View>

            {batchTab === 'upload' ? (
              <View>
                <TouchableOpacity style={styles.pickPhotoBtn} onPress={pickBatchImages} disabled={isUploading}>
                  <Text style={styles.pickPhotoBtnText}>➕ 從本機相簿多選照片</Text>
                </TouchableOpacity>

                {selectedBatchImages.length > 0 && (
                  <ScrollView horizontal style={styles.previewRow} showsHorizontalScrollIndicator={false}>
                    {selectedBatchImages.map((uri, index) => (
                      <View key={index} style={styles.imageWrapper}>
                        <Image source={{ uri }} style={styles.previewImage} />
                        {!isUploading && (
                          <TouchableOpacity
                            style={styles.deleteBadge}
                            onPress={() => setSelectedBatchImages(selectedBatchImages.filter((_, i) => i !== index))}
                          >
                            <Text style={styles.deleteText}>✕</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                )}

                <Text style={styles.inputLabel}>📝 統一文字說明：</Text>
                <TextInput
                  style={styles.batchInput}
                  placeholder="例如：陽明山約會特輯 ✨"
                  value={batchCaption}
                  onChangeText={setBatchCaption}
                  multiline
                  editable={!isUploading}
                />

                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    disabled={isUploading}
                    onPress={() => {
                      setShowBatchModal(false);
                      setSelectedBatchImages([]);
                      setBatchCaption('');
                    }}
                  >
                    <Text style={styles.cancelBtnText}>關閉</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.submitBtn, isUploading && styles.disabledBtn]}
                    onPress={handleConfirmBatchUpload}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={styles.submitBtnText}>加入相簿 ({selectedBatchImages.length} 張)</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ height: Math.min(380, height * 0.46), justifyContent: 'space-between' }}>
                <ScrollView 
                  style={{ flex: 1 }} 
                  contentContainerStyle={styles.historyGrid}
                  showsVerticalScrollIndicator={true}
                >
                  {albumPhotos.map((photo, idx) => (
                    <View key={photo.id || idx} style={[styles.historyItem, { width: width < 420 ? '50%' : '33.33%' }]}>
                      <TouchableOpacity 
                        style={styles.historyImageClickable} 
                        activeOpacity={0.8}
                        onPress={() => handleOpenPreview(photo.url, true)}
                      >
                        <Image source={{ uri: photo.url }} style={styles.historyImage} />
                      </TouchableOpacity>
                      
                      <Text style={styles.historyTitle} numberOfLines={1}>{photo.title}</Text>
                      
                      <TouchableOpacity
                        style={styles.historyDeleteBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDeleteAlbumPhoto(photo.id);
                        }}
                      >
                        <Text style={styles.deleteText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  style={[styles.cancelBtn, { marginTop: 12, flexShrink: 0 }]}
                  onPress={() => setShowBatchModal(false)}
                >
                  <Text style={styles.cancelBtnText}>關閉</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showSettingsModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { width: modalWidth, maxWidth: '100%', maxHeight: Math.min(height * 0.9, 640), padding: cardPad }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalBackBtn}
                onPress={() => setShowSettingsModal(false)}
              >
                <Text style={styles.modalBackBtnText}>‹ 返回</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>✨ 我們的秘密設定 ✨</Text>
            </View>

            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>🏷️ 個人資料設定：</Text>

              {currentUser === '男方' ? (
                <>
                  {renderMaleSettingSection()}
                  {renderFemaleSettingSection()}
                </>
              ) : (
                <>
                  {renderFemaleSettingSection()}
                  {renderMaleSettingSection()}
                </>
              )}
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.closeBtn} onPress={handleSaveSettings}>
                <Text style={styles.closeBtnText}>儲存設定 💕</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Text style={styles.logoutBtnText}>🚪 登出</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFDF9', width: '100%', maxWidth: '100%' },
  content: { padding: 16, alignItems: 'center', width: '100%', maxWidth: '100%' },
  
  mainLayout: { flexDirection: 'row', width: '100%', maxWidth: 1600, minWidth: 0, gap: 16, alignItems: 'flex-start', alignSelf: 'stretch' },
  mainLayoutMobile: { flexDirection: 'column', alignItems: 'stretch' },
  sideColumn: { flex: 1, gap: 16, minWidth: 0, maxWidth: 280 },
  centerColumn: { flex: 2.5, minWidth: 0, maxWidth: '100%' },
  centerColumnMobile: { width: '100%', maxWidth: '100%', flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },

  photoCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 10,
    borderWidth: 2,
    borderColor: '#FFF3E4',
    shadowColor: '#E2C2A4',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    alignItems: 'center',
  },
  photoImage: { width: '100%', height: 220, borderRadius: 16 },
  photoTitle: { marginTop: 8, fontSize: 13, fontWeight: '700', color: '#7C6A58' },

  mobilePhotoGrid: { width: '100%', marginTop: 20 },
  mobileSectionTitle: { fontSize: 16, fontWeight: '800', color: '#7C6A58', marginBottom: 12, textAlign: 'center' },
  mobilePhotoRow: { flexDirection: 'row', flexWrap: 'wrap', width: '100%' },
  mobilePhotoSlot: { padding: 6, boxSizing: 'border-box' as any },
  mobilePhotoCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 8,
    borderWidth: 1.5,
    borderColor: '#FFF3E4',
    alignItems: 'center',
  },
  mobilePhotoImage: { width: '100%', height: 140, borderRadius: 12 },

  topHeaderCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 30,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#FFE8D6',
    shadowColor: '#F2D3C1',
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  topHeaderCardPhone: { flexDirection: 'column', alignItems: 'stretch' },

  settingsBtn: {
    backgroundColor: '#FFF3E4',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  settingsBtnText: { fontSize: 13, fontWeight: '800', color: '#8A6D53' },
  roleGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', flex: 1, minWidth: 0, justifyContent: 'flex-end' },
  roleGroupPhone: { flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch', justifyContent: 'flex-start', width: '100%', flexGrow: 0 },
  roleChipFull: { width: '100%', maxWidth: '100%', alignSelf: 'stretch' },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
    flexShrink: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  headerAvatar: { width: 24, height: 24, borderRadius: 12, marginRight: 6 },
  activeMale: { backgroundColor: '#70A1FF' },
  activeFemale: { backgroundColor: '#FF788E' },
  inactiveChip: { backgroundColor: '#FFF5EB' },
  roleText: { fontSize: 13, fontWeight: '800', color: '#7C6A58', flexShrink: 1 },
  whiteText: { color: '#FFFFFF' },

  anniversaryCard: {
    backgroundColor: '#FFF0F3',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2.5,
    borderColor: '#FFCCD5',
    shadowColor: '#FFB3C1',
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  anniversaryText: { fontSize: 16, fontWeight: '800', color: '#803043', textAlign: 'center' },
  daysText: { fontSize: 32, fontWeight: '900', color: '#FF2A55', letterSpacing: 1 },
  daysTextPhone: { fontSize: 28 },
  daysTextNarrow: { fontSize: 22 },
  countdownText: { marginTop: 4, fontSize: 13, fontWeight: '700', color: '#A0566A', textAlign: 'center' },

  batchBtn: {
    backgroundColor: '#FFF0F3',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FFCCD5',
    shadowColor: '#FFB3C1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  batchBtnText: {
    color: '#FF4D6D',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  batchBtnTextNarrow: { fontSize: 13, letterSpacing: 0 },

  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    width: '100%',
    maxWidth: '100%',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
    flexShrink: 1,
    backgroundColor: '#FFF3E4',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FFE8D6',
  },
  filterChipActive: { backgroundColor: '#8A6D53', borderColor: '#8A6D53' },
  filterChipActiveMale: { backgroundColor: '#70A1FF', borderColor: '#70A1FF' },
  filterChipActiveFemale: { backgroundColor: '#FF788E', borderColor: '#FF788E' },
  filterAvatar: { width: 18, height: 18, borderRadius: 9, marginRight: 6 },
  filterText: { fontSize: 12, fontWeight: '800', color: '#8A6D53', flexShrink: 1 },
  filterTextActive: { color: '#FFFFFF' },

  postComposerCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FFE8D6',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  composerInput: {
    backgroundColor: '#FFFDF9',
    borderRadius: 12,
    padding: 12,
    minHeight: 60,
    fontSize: 14,
    color: '#7C6A58',
    borderColor: '#FFE8D6',
    borderWidth: 1,
    marginBottom: 12,
  },
  previewImageRow: { width: '100%', maxWidth: '100%', marginBottom: 12 },
  composerImgWrapper: { marginRight: 8, position: 'relative' },
  composerPreviewImg: { width: 70, height: 70, borderRadius: 10 },
  removeImgBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF788E',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImgText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  composerActionRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  composerActionStack: { flexDirection: 'column', alignItems: 'stretch' },
  fullWidthBtn: { width: '100%', alignItems: 'center' },
  addImgBtn: { backgroundColor: '#FFF3E4', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14 },
  addImgBtnText: { color: '#8A6D53', fontSize: 12, fontWeight: '800' },
  publishBtn: { backgroundColor: '#FF788E', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 14 },
  publishBtnText: { color: '#FFF', fontSize: 13, fontWeight: '900' },

  emptyPostContainer: { padding: 40, alignItems: 'center' },
  emptyPostText: { color: '#A0836B', fontSize: 14, fontWeight: '700' },

  igPostCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FFE8D6',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  igHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, minWidth: 0 },
  igAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  igAuthorBlock: { flex: 1, minWidth: 0 },
  igAuthor: { fontSize: 14, fontWeight: '800', color: '#7C6A58' },
  igTime: { fontSize: 11, color: '#A0836B' },

  swiperContainer: { position: 'relative', width: '100%', maxWidth: '100%', marginBottom: 12, overflow: 'hidden' },
  igImageSwiper: { width: '100%', maxWidth: '100%' },
  igImageScrollContent: { paddingVertical: 4, paddingHorizontal: 2 },
  igPostImageWrapper: {
    marginRight: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFE8D6',
    overflow: 'hidden',
    backgroundColor: '#FAF0E6',
  },
  igPostImage: { borderRadius: 0 },
  imageBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  imageBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  igContent: { fontSize: 14, color: '#5A463C', lineHeight: 20 },

  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  lightboxImage: { width: '90%', height: '80%' },
  lightboxCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    zIndex: 10000,
  },
  lightboxCloseText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(90, 70, 60, 0.4)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: '92%', maxWidth: 420, backgroundColor: '#FFFDF9', borderRadius: 28, padding: 24, borderWidth: 3, borderColor: '#FFE8D6', overflow: 'auto' as any },

  modalHeader: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalBackBtn: {
    position: 'absolute',
    left: 0,
    backgroundColor: '#FFF3E4',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  modalBackBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#8A6D53',
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#7C6A58', textAlign: 'center', paddingHorizontal: 56 },

  settingItem: { marginBottom: 14 },
  settingLabel: { fontSize: 13, fontWeight: '800', color: '#8A6D53', marginBottom: 10 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  settingAvatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: '#FFE8D6' },
  avatarChangeHint: { fontSize: 10, color: '#FF788E', fontWeight: '800', textAlign: 'center', marginTop: 2 },
  subLabel: { fontSize: 11, color: '#A0836B', marginBottom: 2 },
  modalInput: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 8,
    fontSize: 13,
    borderWidth: 2,
    borderColor: '#FFE8D6',
    color: '#7C6A58',
    fontWeight: '700',
  },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  closeBtn: { flex: 1, backgroundColor: '#FF788E', paddingVertical: 12, borderRadius: 18, alignItems: 'center' },
  closeBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  logoutBtn: { flex: 1, backgroundColor: '#FFF3E4', paddingVertical: 10, borderRadius: 18, alignItems: 'center', borderWidth: 1, borderColor: '#FFD8BE' },
  logoutBtnText: { color: '#A0836B', fontSize: 13, fontWeight: '800' },

  batchCard: { width: '92%', maxWidth: 450, backgroundColor: '#FFFDF9', borderRadius: 28, padding: 24, borderWidth: 3, borderColor: '#FFE8D6', overflow: 'auto' as any },
  tabContainer: { flexDirection: 'row', backgroundColor: '#FFF3E4', borderRadius: 16, padding: 4, marginBottom: 16 },
  tabBtn: { flex: 1, minWidth: 0, paddingVertical: 8, paddingHorizontal: 4, alignItems: 'center', borderRadius: 12 },
  tabBtnActive: { backgroundColor: '#FF788E' },
  tabText: { fontSize: 13, fontWeight: '800', color: '#8A6D53', textAlign: 'center' },
  tabTextNarrow: { fontSize: 11 },
  tabTextActive: { color: '#FFF' },

  pickPhotoBtn: { backgroundColor: '#FFF3E4', paddingVertical: 12, borderRadius: 16, alignItems: 'center', marginBottom: 14, borderWidth: 1.5, borderColor: '#FFD8BE' },
  pickPhotoBtnText: { color: '#8A6D53', fontWeight: '800', fontSize: 14 },
  previewRow: { maxHeight: 90, marginBottom: 14 },
  imageWrapper: { marginRight: 10, position: 'relative' },
  previewImage: { width: 75, height: 75, borderRadius: 12 },
  deleteBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#FF788E', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  deleteText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  inputLabel: { fontSize: 12, fontWeight: '800', color: '#8A6D53', marginBottom: 6 },
  batchInput: { backgroundColor: '#FFF', borderWidth: 2, borderColor: '#FFE8D6', borderRadius: 14, padding: 10, height: 70, textAlignVertical: 'top', color: '#7C6A58', fontWeight: '600' },
  cancelBtn: { paddingVertical: 12, borderRadius: 18, backgroundColor: '#EFEFEF', alignItems: 'center' },
  cancelBtnText: { color: '#666', fontWeight: '800' },
  submitBtn: { flex: 2, paddingVertical: 12, borderRadius: 18, backgroundColor: '#FF788E', alignItems: 'center' },
  disabledBtn: { backgroundColor: '#FFAAA6', opacity: 0.7 },
  submitBtnText: { color: '#FFF', fontWeight: '900' },

  historyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    paddingVertical: 4,
  },
  historyItem: {
    padding: 4,
    boxSizing: 'border-box' as any,
    position: 'relative',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE8D6',
  },
  historyImageClickable: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  historyImage: { width: '100%', height: 80 },
  historyTitle: { fontSize: 10, color: '#7C6A58', fontWeight: '700', marginTop: 4, textAlign: 'center' },
  historyDeleteBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(255, 42, 85, 0.9)',
    borderRadius: 12,
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  loginContainer: { flex: 1, backgroundColor: '#FFFDF9', justifyContent: 'center', alignItems: 'center', padding: 20 },
  loginCard: { width: '100%', maxWidth: 360, backgroundColor: '#FFFFFF', borderRadius: 28, padding: 28, borderWidth: 3, borderColor: '#FFE8D6', shadowColor: '#F2D3C1', shadowOpacity: 0.3, shadowRadius: 16 },
  loginCardPhone: { padding: 18 },
  loginTitle: { fontSize: 22, fontWeight: '900', color: '#7C6A58', textAlign: 'center', marginBottom: 6 },
  loginSubtitle: { fontSize: 13, fontWeight: '600', color: '#A0836B', textAlign: 'center', marginBottom: 24 },
  loginInputGroup: { marginBottom: 16 },
  loginLabel: { fontSize: 13, fontWeight: '800', color: '#8A6D53', marginBottom: 6 },
  loginInput: {
    backgroundColor: '#FFFDF9',
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    borderWidth: 2,
    borderColor: '#FFE8D6',
    color: '#7C6A58',
    fontWeight: '700',
  },
  loginBtn: { backgroundColor: '#FF788E', paddingVertical: 14, borderRadius: 18, alignItems: 'center', marginTop: 10 },
  loginBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' },
});