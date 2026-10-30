import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3/+esm';

const SUPABASE_URL = 'https://bkuongftszhyxijjsnfz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdW9uZ2Z0c3poeXhpampzbmZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MjE1OTYsImV4cCI6MjEwMjk5NzU5Nn0.fN_h_mAcAo27LUIS0QF-V03kfPxiG-Oa3_O_hTrgEE4';
const DEFAULT_COUPLE_ID = '61de5bed-df25-456a-8308-527fdc271221';
const START_DATE = '2026-06-17';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  userId: null,
  currentUser: '男方',
  maleName: 'mengxueho0917',
  partnerName: 'oliviahung1224',
  maleAvatar: 'https://picsum.photos/100/100?random=100',
  partnerAvatar: 'https://picsum.photos/100/100?random=101',
  coupleId: null,
  posts: [],
  album: [
    { id: '1', title: '淡水看夕陽', url: 'https://picsum.photos/300/400?random=1' },
    { id: '2', title: '第一次約會', url: 'https://picsum.photos/300/400?random=2' },
  ],
  places: [],
  filter: '全部',
  postFiles: [],
  albumFiles: [],
  editingPlace: null,
  placeCategory: 'visited',
  placeImageUrl: '',
  placeCoords: {},
  markers: [],
};

const $ = (id) => document.getElementById(id);
let map;
let photoTimer;
let searchTimer;

function notify(title, message) {
  window.alert(`${title}\n${message}`);
}

function coupleId() {
  return state.coupleId || DEFAULT_COUPLE_ID;
}

function daysTogether() {
  const start = new Date(START_DATE);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((today - start) / 86400000);
  return Number.isNaN(days) ? 0 : days;
}

function daysUntilAnniversary() {
  const start = new Date(START_DATE);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = new Date(today.getFullYear(), start.getMonth(), start.getDate());
  next.setHours(0, 0, 0, 0);
  if (next < today) next.setFullYear(next.getFullYear() + 1);
  return Math.round((next - today) / 86400000);
}

function toDbCategory(category) {
  return category === 'wish' ? 'wishlist' : 'visited';
}

function toAppCategory(category) {
  return category === 'wishlist' || category === 'wish' ? 'wish' : 'visited';
}

function todayInputValue() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${month}-${day}`;
}

async function uploadImage(file) {
  const type = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
  const filePath = `posts/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('photos').upload(filePath, file, { contentType: type });
  if (error) throw error;
  return supabase.storage.from('photos').getPublicUrl(filePath).data.publicUrl;
}

function showApp(isLoggedIn) {
  $('login-view').hidden = isLoggedIn;
  $('app-view').hidden = !isLoggedIn;
  if (isLoggedIn) {
    renderIdentity();
    renderDays();
    ensureMap();
  }
  syncLayout();
}

function renderDays() {
  const days = String(daysTogether());
  $('days-together').textContent = days;
  $('phone-days').textContent = days;
  const left = daysUntilAnniversary();
  $('anniversary-note').textContent = left === 0 ? '今天是我們的紀念日' : `下一個紀念日還有 ${left} 天`;
}

function renderIdentity() {
  $('male-avatar').src = state.maleAvatar;
  $('female-avatar').src = state.partnerAvatar;
  $('male-setting-avatar').src = state.maleAvatar;
  $('female-setting-avatar').src = state.partnerAvatar;
  const maleLabel = `${state.maleName}${state.currentUser === '男方' ? ' (我)' : ''}`;
  const femaleLabel = `${state.partnerName}${state.currentUser === '女方' ? ' (我)' : ''}`;
  $('male-label').textContent = maleLabel;
  $('female-label').textContent = femaleLabel;
  $('drawer-male-name').textContent = maleLabel;
  $('drawer-female-name').textContent = femaleLabel;
  $('drawer-male-avatar').src = state.maleAvatar;
  $('drawer-female-avatar').src = state.partnerAvatar;
  $('male-chip').classList.toggle('on', state.currentUser === '男方');
  $('female-chip').classList.toggle('on', state.currentUser === '女方');
  $('male-name-input').value = state.maleName;
  $('female-name-input').value = state.partnerName;
  $('male-avatar-hint').textContent = state.currentUser === '男方' ? '更換' : '不可改';
  $('female-avatar-hint').textContent = state.currentUser === '女方' ? '更換' : '不可改';
  $('filter-male').innerHTML = `<img alt="" src="${state.maleAvatar}" /> ${state.maleName} 發的`;
  $('filter-female').innerHTML = `<img alt="" src="${state.partnerAvatar}" /> ${state.partnerName} 發的`;
  document.querySelectorAll('#filters .chip').forEach((button) => {
    button.classList.toggle('active', button.dataset.filter === state.filter);
    button.classList.toggle('male', button.dataset.filter === '男生');
    button.classList.toggle('female', button.dataset.filter === '女生');
  });
}

function renderPosts() {
  const list = $('post-list');
  const posts = state.posts.filter((post) => {
    if (state.filter === '男生') return post.author === state.maleName;
    if (state.filter === '女生') return post.author === state.partnerName;
    return true;
  });
  if (!posts.length) {
    list.innerHTML = '<p class="empty">目前還沒有動態，先寫下今天的事吧。</p>';
    return;
  }
  list.innerHTML = posts.map((post) => `
    <article class="card post">
      <div class="post-head">
        <img alt="" src="${escapeAttr(post.avatar)}" />
        <div>
          <strong>${escapeHtml(post.author)}</strong>
          <span>${escapeHtml(post.createdAt)}</span>
        </div>
      </div>
      ${post.imageUrls.length ? `<div class="post-photos">${post.imageUrls.map((url) => `<img alt="" src="${escapeAttr(url)}" data-preview="${escapeAttr(url)}" />`).join('')}</div>` : ''}
      <p>${escapeHtml(post.content)}</p>
    </article>
  `).join('');
}

function photoCard(photo) {
  return `<article class="card photo-card"><img alt="" src="${escapeAttr(photo.url)}" data-preview="${escapeAttr(photo.url)}" /><p>${escapeHtml(photo.title || '照片')}</p></article>`;
}

function renderPhotos() {
  const count = Math.min(4, Math.max(2, Math.floor(window.innerHeight / 280) || 2));
  const picked = shuffle(state.album, count * 2);
  $('rail-left').innerHTML = picked.slice(0, count).map(photoCard).join('');
  $('rail-right').innerHTML = picked.slice(count).map(photoCard).join('');
  $('photo-wall').innerHTML = picked.map(photoCard).join('');
}

function renderAlbumHistory() {
  $('tab-history').textContent = `歷史相簿 (${state.album.length})`;
  $('album-grid').innerHTML = state.album.map((photo) => `
    <article class="history-item">
      <img alt="" src="${escapeAttr(photo.url)}" data-preview="${escapeAttr(photo.url)}" />
      <p>${escapeHtml(photo.title || '')}</p>
      ${photo.remote ? `<button type="button" data-delete-photo="${escapeAttr(photo.id)}">刪除</button>` : ''}
    </article>
  `).join('');
}

function renderPlaces() {
  $('place-list').innerHTML = state.places.map((place) => `
    <article class="place-item">
      <div>
        <strong>${escapeHtml(place.name)}</strong>
        <p>${escapeHtml(place.note || '')}${place.visitDate ? ` · ${escapeHtml(place.visitDate)}` : ''}</p>
      </div>
      <div class="place-actions">
        <button class="edit" type="button" data-edit-place="${place.id}">編輯</button>
        <button class="delete" type="button" data-delete-place="${place.id}">刪除</button>
      </div>
    </article>
  `).join('');
  drawMarkers();
}

function drawMarkers() {
  if (!map) return;
  state.markers.forEach((marker) => marker.remove());
  state.markers = state.places.filter((place) => place.lat && place.lng).map((place) => (
    L.marker([place.lat, place.lng]).addTo(map).bindPopup(`<b>${escapeHtml(place.name)}</b><br>${escapeHtml(place.note || '')}`)
  ));
}

function ensureMap() {
  if (map) {
    setTimeout(() => map.invalidateSize(), 50);
    drawMarkers();
    return;
  }
  map = L.map('map').setView([25.0432, 121.5081], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
  }).addTo(map);
  map.on('click', async (event) => {
    const { lat, lng } = event.latlng;
    let name = `緯度 ${lat.toFixed(4)}, 經度 ${lng.toFixed(4)}`;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=zh-TW`);
      const data = await response.json();
      const address = data.address || {};
      name = address.tourism || address.attraction || address.amenity || address.shop || address.building || address.road || address.suburb || (data.display_name || name).split(',')[0];
    } catch (error) {
      console.error(error);
    }
    openPlaceModal({ name, lat, lng, category: 'visited' });
  });
  drawMarkers();
}

function openModal(id) {
  $(id).hidden = false;
}

function closeModal(id) {
  $(id).hidden = true;
}

function openPlaceModal(place = null) {
  state.editingPlace = place;
  state.placeCategory = place?.category || 'visited';
  state.placeImageUrl = place?.imageUrl || '';
  state.placeCoords = { lat: place?.lat, lng: place?.lng };
  $('place-title').textContent = place?.id ? '編輯地點' : '新增地點';
  $('place-name').value = place?.name || '';
  $('place-note').value = place?.note || '';
  $('place-date').value = toDateInput(place?.visitDate) || todayInputValue();
  $('place-date').max = todayInputValue();
  $('place-image').hidden = !state.placeImageUrl;
  $('place-image').src = state.placeImageUrl || '';
  $('place-suggestions').innerHTML = '';
  document.querySelectorAll('.cat').forEach((button) => {
    button.classList.toggle('active', button.dataset.category === state.placeCategory);
  });
  openModal('place-modal');
}

async function loadProfile(userId) {
  const { data } = await supabase.from('profiles').select('gender, nickname, avatar_url, couple_id').eq('id', userId).maybeSingle();
  if (!data) return;
  state.currentUser = data.gender === '女方' ? '女方' : '男方';
  if (data.gender === '男方') {
    if (data.nickname) state.maleName = data.nickname;
    if (data.avatar_url) state.maleAvatar = data.avatar_url;
  } else {
    if (data.nickname) state.partnerName = data.nickname;
    if (data.avatar_url) state.partnerAvatar = data.avatar_url;
  }
  if (data.couple_id) {
    state.coupleId = data.couple_id;
    const { data: partner } = await supabase.from('profiles').select('gender, nickname, avatar_url').eq('couple_id', data.couple_id).neq('id', userId).maybeSingle();
    if (partner?.gender === '男方') {
      if (partner.nickname) state.maleName = partner.nickname;
      if (partner.avatar_url) state.maleAvatar = partner.avatar_url;
    } else if (partner) {
      if (partner.nickname) state.partnerName = partner.nickname;
      if (partner.avatar_url) state.partnerAvatar = partner.avatar_url;
    }
  }
}

async function loadPosts() {
  const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
  if (error || !data) return;
  state.posts = data.map((item) => {
    let author = item.author || '匿名';
    let avatar = item.avatar || 'https://picsum.photos/100/100?random=999';
    if (item.author && (item.author.includes('mengxueho') || item.author.includes('justin') || item.author === state.maleName)) {
      author = state.maleName;
      avatar = state.maleAvatar;
    } else if (item.author && (item.author.includes('olivia') || item.author === state.partnerName)) {
      author = state.partnerName;
      avatar = state.partnerAvatar;
    }
    return {
      id: item.id,
      author,
      avatar,
      content: item.content || '',
      imageUrls: item.image_urls?.length ? item.image_urls : (item.image_url ? [item.image_url] : []),
      createdAt: new Date(item.created_at).toLocaleString(),
    };
  });
  renderPosts();
}

async function loadAlbum() {
  const { data, error } = await supabase.from('album_photos').select('id, title, url').order('created_at', { ascending: false });
  if (!error && data?.length) {
    state.album = data.map((item) => ({ id: item.id, title: item.title, url: item.url, remote: true }));
  }
  renderPhotos();
  renderAlbumHistory();
}

async function loadPlaces() {
  const { data, error } = await supabase.from('places').select('id, name, category, note, created_by, created_at, visit_date, image_url, lat, lng').eq('couple_id', coupleId()).order('created_at', { ascending: false });
  if (error) return;
  state.places = (data || []).map((item) => ({
    id: item.id,
    name: item.name || '',
    category: toAppCategory(item.category),
    note: item.note || '',
    visitDate: item.visit_date || '',
    imageUrl: item.image_url || '',
    lat: Number(item.lat) || 0,
    lng: Number(item.lng) || 0,
  }));
  renderPlaces();
}

async function enter(user) {
  state.userId = user.id;
  await loadProfile(user.id);
  showApp(true);
  await Promise.all([loadPosts(), loadAlbum(), loadPlaces()]);
  clearInterval(photoTimer);
  photoTimer = setInterval(renderPhotos, 5000);
}

async function handleLogin(event) {
  event.preventDefault();
  const account = $('login-account').value.trim().toLowerCase();
  const password = $('login-password').value.trim();
  if (!account) return notify('提示', '請輸入帳號唷！');
  if (!password) return notify('提示', '請輸入密碼唷！');
  const email = account.includes('@') ? account : `${account}@gmail.com`;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.message.includes('rate limit')) return notify('請稍後再試', '請求太頻繁，請等待約 10 到 15 分鐘後再試。');
    return notify('登入失敗', '帳號或密碼錯誤，請確認後重試。');
  }
  const role = account.includes('olivia') ? '女方' : '男方';
  const { data: existing } = await supabase.from('profiles').select('id').eq('id', data.user.id).maybeSingle();
  if (!existing) {
    const { error: insertError } = await supabase.from('profiles').insert({
      id: data.user.id,
      couple_id: DEFAULT_COUPLE_ID,
      gender: role,
      nickname: account,
    });
    if (insertError) notify('資料建立失敗', insertError.message);
  } else {
    const { error: profileError } = await supabase.from('profiles').update({
      couple_id: DEFAULT_COUPLE_ID,
      gender: role,
    }).eq('id', data.user.id);
    if (profileError) notify('資料更新失敗', profileError.message);
  }
  state.currentUser = role;
  await enter(data.user);
}

async function handleCreatePost(event) {
  event.preventDefault();
  const content = $('post-content').value.trim();
  if (!content && !state.postFiles.length) return notify('提示', '請輸入貼文內容或選擇照片！');
  const button = $('post-submit');
  button.disabled = true;
  try {
    const imageUrls = [];
    for (const file of state.postFiles) imageUrls.push(await uploadImage(file));
    const author = state.currentUser === '男方' ? state.maleName : state.partnerName;
    const avatar = state.currentUser === '男方' ? state.maleAvatar : state.partnerAvatar;
    const { error } = await supabase.from('posts').insert([{
      couple_id: coupleId(),
      author,
      avatar,
      content,
      image_urls: imageUrls,
    }]);
    if (error) return notify('貼文發布失敗', error.message);
    $('post-content').value = '';
    state.postFiles = [];
    $('post-files').value = '';
    $('post-preview').innerHTML = '';
    await loadPosts();
    if (imageUrls.length && window.confirm('貼文已發布。要把這些照片也放進相簿嗎？')) {
      await addAlbumRecords(content || '動態照片', imageUrls);
    } else if (!imageUrls.length) {
      notify('已發布', '貼文已寫進資料庫。');
    }
  } catch (error) {
    notify('發布失敗', '發布過程中發生異常');
    console.error(error);
  } finally {
    button.disabled = false;
  }
}

async function addAlbumRecords(title, urls) {
  const records = urls.map((url) => ({ couple_id: coupleId(), title, url }));
  const { error } = await supabase.from('album_photos').insert(records);
  if (error) return notify('同步相簿失敗', error.message);
  notify('已加入相簿', '照片已寫進相簿。');
  await loadAlbum();
}

async function saveAlbum() {
  if (!state.albumFiles.length) return notify('提示', '請至少選擇一張照片唷！');
  const button = $('album-save');
  button.disabled = true;
  try {
    const urls = [];
    for (const file of state.albumFiles) urls.push(await uploadImage(file));
    await addAlbumRecords($('album-caption').value.trim() || '照片', urls);
    state.albumFiles = [];
    $('album-files').value = '';
    $('album-caption').value = '';
    $('album-preview').innerHTML = '';
    closeModal('album-modal');
  } catch (error) {
    notify('上傳失敗', '照片沒有上傳成功，請再試一次');
    console.error(error);
  } finally {
    button.disabled = false;
  }
}

async function saveSettings() {
  const button = $('save-settings');
  button.disabled = true;
  try {
    const nickname = state.currentUser === '男方' ? $('male-name-input').value.trim() : $('female-name-input').value.trim();
    let avatar = state.currentUser === '男方' ? state.maleAvatar : state.partnerAvatar;
    if (pendingAvatar?.file && pendingAvatar.gender === state.currentUser) {
      avatar = await uploadImage(pendingAvatar.file);
    }
    const { data, error } = await supabase.from('profiles').update({ nickname, avatar_url: avatar }).eq('id', state.userId).select('nickname, avatar_url');
    if (error || !data?.length) return notify('儲存失敗', error?.message || '設定沒有寫進資料庫，請重新登入後再試。');
    pendingAvatar = null;
    if (state.currentUser === '男方') {
      state.maleName = data[0].nickname || state.maleName;
      if (data[0].avatar_url) state.maleAvatar = data[0].avatar_url;
    } else {
      state.partnerName = data[0].nickname || state.partnerName;
      if (data[0].avatar_url) state.partnerAvatar = data[0].avatar_url;
    }
    notify('已儲存', '設定已寫進資料庫。');
    closeModal('settings-modal');
    renderIdentity();
    renderPosts();
  } catch (error) {
    notify('儲存失敗', '頭像沒有上傳成功，設定尚未寫入。');
    console.error(error);
  } finally {
    button.disabled = false;
  }
}

async function savePlace(event) {
  event.preventDefault();
  const name = $('place-name').value.trim();
  if (!name) return notify('提示', '請輸入地點名稱！');
  const visitDate = $('place-date').value;
  if (visitDate && visitDate > todayInputValue()) return notify('提示', '打卡日期不能是未來時間！');
  const button = event.submitter;
  if (button) button.disabled = true;
  try {
    let imageUrl = state.placeImageUrl;
    const file = $('place-file').files[0];
    if (file) imageUrl = await uploadImage(file);
    const payload = {
      name,
      category: toDbCategory(state.placeCategory),
      note: $('place-note').value.trim() || '記錄美好足跡',
      visit_date: visitDate || null,
      image_url: imageUrl || null,
      lat: state.placeCoords.lat ?? 25.033,
      lng: state.placeCoords.lng ?? 121.5654,
    };
    const query = state.editingPlace?.id
      ? supabase.from('places').update(payload).eq('id', state.editingPlace.id)
      : supabase.from('places').insert({ ...payload, couple_id: coupleId(), created_by: state.currentUser === '男方' ? state.maleName : state.partnerName });
    const { data: saved, error } = await query.select('id');
    if (error || !saved?.length) return notify('儲存失敗', error?.message || '地點沒有寫進資料庫。');
    closeModal('place-modal');
    $('place-file').value = '';
    await loadPlaces();
  } catch (error) {
    notify('上傳失敗', '地點照片沒有上傳成功，請再試一次');
    console.error(error);
  } finally {
    if (button) button.disabled = false;
  }
}

let pendingAvatar = null;

function revertPendingAvatar() {
  if (!pendingAvatar) return;
  if (pendingAvatar.gender === '男方') state.maleAvatar = pendingAvatar.backup;
  else state.partnerAvatar = pendingAvatar.backup;
  if (pendingAvatar.preview) URL.revokeObjectURL(pendingAvatar.preview);
  pendingAvatar = null;
  renderIdentity();
}

async function changeOwnAvatar(file, gender) {
  if (state.currentUser !== gender) return notify('無法修改', `目前是${state.currentUser}，不能改${gender}的頭像。請用對方的帳號登入後再換。`);
  if (!state.userId) return notify('尚未登入', '請先登入再更換頭像。');
  if (pendingAvatar?.preview) URL.revokeObjectURL(pendingAvatar.preview);
  const backup = pendingAvatar?.gender === gender
    ? pendingAvatar.backup
    : (gender === '男方' ? state.maleAvatar : state.partnerAvatar);
  const preview = URL.createObjectURL(file);
  pendingAvatar = { gender, file, backup, preview };
  if (gender === '男方') state.maleAvatar = preview;
  else state.partnerAvatar = preview;
  renderIdentity();
  $(gender === '男方' ? 'male-avatar-hint' : 'female-avatar-hint').textContent = '尚未儲存';
}

function previewFiles(files, target) {
  target.innerHTML = [...files].map((file) => `<img alt="" src="${URL.createObjectURL(file)}" />`).join('');
}

function shuffle(list, total) {
  if (!list.length) return [];
  const pool = [];
  while (pool.length < total) pool.push(...list);
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  return pool.slice(0, total);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function toDateInput(value) {
  if (!value) return '';
  const match = String(value).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!match) return '';
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

function bindEvents() {
  $('login-form').addEventListener('submit', handleLogin);
  $('post-form').addEventListener('submit', handleCreatePost);
  $('place-form').addEventListener('submit', savePlace);
  $('open-settings').addEventListener('click', () => openModal('settings-modal'));
  $('open-album').addEventListener('click', () => {
    renderAlbumHistory();
    openModal('album-modal');
  });
  $('open-place').addEventListener('click', () => openPlaceModal());
  $('save-settings').addEventListener('click', saveSettings);
  $('logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    clearInterval(photoTimer);
    state.userId = null;
    state.places = [];
    showApp(false);
    closeModal('settings-modal');
  });
  $('album-save').addEventListener('click', saveAlbum);
  $('tab-upload').addEventListener('click', () => switchAlbumTab('upload'));
  $('tab-history').addEventListener('click', () => switchAlbumTab('history'));
  $('post-files').addEventListener('change', (event) => {
    state.postFiles = [...event.target.files];
    previewFiles(state.postFiles, $('post-preview'));
  });
  $('album-files').addEventListener('change', (event) => {
    state.albumFiles = [...event.target.files];
    previewFiles(state.albumFiles, $('album-preview'));
  });
  $('male-avatar-btn').addEventListener('click', () => {
    if (state.currentUser !== '男方') return notify('無法修改', '請用男生帳號登入後再換男生頭像。');
    $('male-avatar-file').click();
  });
  $('female-avatar-btn').addEventListener('click', () => {
    if (state.currentUser !== '女方') return notify('無法修改', '請用女生帳號登入後再換女生頭像。');
    $('female-avatar-file').click();
  });
  $('male-avatar-file').addEventListener('change', (event) => event.target.files[0] && changeOwnAvatar(event.target.files[0], '男方'));
  $('female-avatar-file').addEventListener('change', (event) => event.target.files[0] && changeOwnAvatar(event.target.files[0], '女方'));
  $('place-file').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    state.placeImageUrl = URL.createObjectURL(file);
    $('place-image').hidden = false;
    $('place-image').src = state.placeImageUrl;
  });
  $('place-name').addEventListener('input', (event) => {
    clearTimeout(searchTimer);
    const text = event.target.value.trim();
    if (!text) {
      $('place-suggestions').innerHTML = '';
      return;
    }
    searchTimer = setTimeout(async () => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&limit=5&countrycodes=tw`);
        const data = await response.json();
        $('place-suggestions').innerHTML = data.map((item) => `<button type="button" data-lat="${item.lat}" data-lng="${item.lon}" data-name="${escapeAttr(item.display_name.split(',')[0])}">${escapeHtml(item.display_name)}</button>`).join('');
      } catch (error) {
        console.error(error);
      }
    }, 400);
  });
  $('place-suggestions').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    $('place-name').value = button.dataset.name;
    state.placeCoords = { lat: Number(button.dataset.lat), lng: Number(button.dataset.lng) };
    $('place-suggestions').innerHTML = '';
  });
  document.querySelectorAll('.cat').forEach((button) => {
    button.addEventListener('click', () => {
      state.placeCategory = button.dataset.category;
      document.querySelectorAll('.cat').forEach((item) => item.classList.toggle('active', item === button));
    });
  });
  $('filters').addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    state.filter = button.dataset.filter;
    renderIdentity();
    renderPosts();
  });
  document.body.addEventListener('click', async (event) => {
    const preview = event.target.closest('[data-preview]');
    const close = event.target.closest('[data-close]');
    const deletePhoto = event.target.closest('[data-delete-photo]');
    const deletePlace = event.target.closest('[data-delete-place]');
    const editPlace = event.target.closest('[data-edit-place]');
    if (preview) {
      $('lightbox-image').src = preview.dataset.preview;
      $('lightbox').hidden = false;
    }
    if (close) {
      if (close.dataset.close === 'settings-modal') revertPendingAvatar();
      closeModal(close.dataset.close);
    }
    if (deletePhoto) {
      const { error } = await supabase.from('album_photos').delete().eq('id', deletePhoto.dataset.deletePhoto);
      if (error) notify('刪除失敗', error.message);
      else await loadAlbum();
    }
    if (deletePlace) {
      const { error } = await supabase.from('places').delete().eq('id', deletePlace.dataset.deletePlace);
      if (error) notify('刪除失敗', error.message);
      else await loadPlaces();
    }
    if (editPlace) openPlaceModal(state.places.find((place) => String(place.id) === editPlace.dataset.editPlace));
  });
  $('lightbox-close').addEventListener('click', () => { $('lightbox').hidden = true; });
  $('menu-toggle').addEventListener('click', () => {
    const open = document.body.classList.toggle('menu-open');
    $('menu-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  $('phone-backdrop').addEventListener('click', closePhoneMenu);
  $('phone-drawer').addEventListener('click', (event) => {
    const button = event.target.closest('[data-screen]');
    if (!button) return;
    const screen = button.dataset.screen;
    if (screen === 'album') {
      closePhoneMenu();
      renderAlbumHistory();
      openModal('album-modal');
      return;
    }
    if (screen === 'settings') {
      closePhoneMenu();
      openModal('settings-modal');
      return;
    }
    setPhoneScreen(screen);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePhoneMenu();
  });
  window.matchMedia('(max-width: 719px)').addEventListener('change', syncLayout);
  window.addEventListener('resize', () => map && map.invalidateSize());
  syncLayout();
}

let phoneScreen = 'feed';

function closePhoneMenu() {
  document.body.classList.remove('menu-open');
  $('menu-toggle').setAttribute('aria-expanded', 'false');
}

function setPhoneScreen(screen) {
  phoneScreen = screen;
  document.body.dataset.screen = screen;
  document.querySelectorAll('#phone-drawer [data-screen]').forEach((button) => {
    button.classList.toggle('active', button.dataset.screen === screen);
  });
  const titles = { feed: '動態', map: '足跡地圖', photos: '照片牆' };
  if (titles[screen]) $('phone-screen-label').textContent = titles[screen];
  closePhoneMenu();
  window.scrollTo(0, 0);
  if (screen === 'map' && map) setTimeout(() => map.invalidateSize(), 80);
}

function syncLayout() {
  const phone = window.matchMedia('(max-width: 719px)').matches;
  document.body.classList.toggle('is-phone', phone);
  if (!phone) {
    closePhoneMenu();
    return;
  }
  document.body.dataset.screen = phoneScreen;
  if (map) setTimeout(() => map.invalidateSize(), 80);
}

function switchAlbumTab(tab) {
  $('album-upload').hidden = tab !== 'upload';
  $('album-history').hidden = tab !== 'history';
  $('tab-upload').classList.toggle('active', tab === 'upload');
  $('tab-history').classList.toggle('active', tab === 'history');
}

bindEvents();
renderDays();

supabase.auth.getSession().then(({ data }) => {
  if (data.session?.user) enter(data.session.user);
});
supabase.auth.onAuthStateChange((_event, session) => {
  if (!session?.user) showApp(false);
});
