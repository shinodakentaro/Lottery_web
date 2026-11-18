const bt_save = document.getElementById('bt-save');
const bt_load = document.getElementById('bt-load');
const bt_add_kuji = document.getElementById('bt-add-kuji');
const setting_font = document.getElementById('setting-font');
const kuji_area = document.getElementById('kuji-area');
let kuji_unit = document.getElementsByClassName('kuji-unit');
let kuji_name = document.getElementsByClassName('kuji-name');
let kuji_num = document.getElementsByClassName('kuji-num');
let kuji_keep = document.getElementsByClassName('kuji-keep');
let kuji_bt_del = document.getElementsByClassName('kuji-bt-del');
let kuji_image_input = document.getElementsByClassName('kuji-image-input');
let kuji_image_preview = document.getElementsByClassName('kuji-image-preview');
let kuji_image_clear = document.getElementsByClassName('kuji-image-clear-bt');
const msg = document.getElementById('message');
const el_area_save = document.getElementById('area-save');
let is_save_valid = false;
let msg_timer = null;

const DEFAULT_FONT_SIZE = 18;
const MIN_FONT_SIZE = 4;
const MAX_FONT_SIZE = 100;
// 保存する画像の最大辺(px)。localStorageの容量(約5MB)を節約するため縮小して保存する
const IMAGE_MAX_SIZE = 800;
const IMAGE_QUALITY = 0.85;

//リスナ
setting_font.addEventListener('change',fontChange);
[...kuji_bt_del].forEach(el=>{
  el.addEventListener('click',()=>{delKuji(el)});
});
[...kuji_unit].forEach(bindImageEvents);
bt_add_kuji.addEventListener('click',addKuji);
bt_save.addEventListener('click',saveData);
bt_load.addEventListener('click',loadData);
//
checkStorage();
loadDataOnInit();

function bindImageEvents(unitEl){
  const input = unitEl.getElementsByClassName('kuji-image-input')[0];
  const preview = unitEl.getElementsByClassName('kuji-image-preview')[0];
  const clearBt = unitEl.getElementsByClassName('kuji-image-clear-bt')[0];
  input.addEventListener('change',()=>{
    const file = input.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      shrinkImage(reader.result, file.type).then((src)=>{
        preview.src = src;
        preview.classList.remove('s-hide');
        clearBt.classList.remove('s-hide');
      });
    };
    reader.onerror = ()=>{
      msgBox('画像を読み込めませんでした。');
    };
    reader.readAsDataURL(file);
  });
  clearBt.addEventListener('click',()=>{
    preview.src = '';
    preview.classList.add('s-hide');
    clearBt.classList.add('s-hide');
    input.value = '';
  });
}

// 画像を最大IMAGE_MAX_SIZEpxに縮小・再圧縮したdataURLを返す
// GIF(アニメーション)とSVGは劣化・静止画化を避けるためそのまま返す
function shrinkImage(dataUrl, mimeType){
  if(mimeType === 'image/gif' || mimeType === 'image/svg+xml'){
    return Promise.resolve(dataUrl);
  }
  return new Promise((resolve)=>{
    const img = new Image();
    img.onload = ()=>{
      const scale = Math.min(1, IMAGE_MAX_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      // 透過を保てるWebPを優先。非対応ブラウザではPNG(透過あり)かJPEGにする
      let out = canvas.toDataURL('image/webp', IMAGE_QUALITY);
      if(!out.startsWith('data:image/webp')){
        out = mimeType === 'image/png'
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', IMAGE_QUALITY);
      }
      // 縮小しても元より大きくなる場合は元画像を使う
      resolve(out.length < dataUrl.length ? out : dataUrl);
    };
    img.onerror = ()=>resolve(dataUrl);
    img.src = dataUrl;
  });
}

function fontChange(){
  const val = Number(setting_font.value);
  if(setting_font.value === '' || isNaN(val) || val < MIN_FONT_SIZE || val > MAX_FONT_SIZE){
    setting_font.value = DEFAULT_FONT_SIZE;
    msgBox(`文字の大きさは${MIN_FONT_SIZE}〜${MAX_FONT_SIZE}の数値で入力してください。`);
  }
  saveSettings();
}

function delKuji(el){
  updateKujiElements();
  if(kuji_unit.length>1){
    const index = [...kuji_bt_del].indexOf(el);
    kuji_unit[index].remove();
    updateKujiElements();
  }else{
    msgBox('全てのくじを消去することはできません。');
  }
}

function addKuji(){
  updateKujiElements();
  const el = kuji_unit[kuji_unit.length-1].cloneNode(true);
  const bt = el.getElementsByClassName('kuji-bt-del')[0];
  bt.addEventListener('click',()=>{delKuji(bt)});
  // 画像プレビューは複製せずクリアする
  const preview = el.getElementsByClassName('kuji-image-preview')[0];
  preview.src = '';
  preview.classList.add('s-hide');
  el.getElementsByClassName('kuji-image-clear-bt')[0].classList.add('s-hide');
  el.getElementsByClassName('kuji-image-input')[0].value = '';
  bindImageEvents(el);
  kuji_area.appendChild(el);
  updateKujiElements();
}

function updateKujiElements(){
  kuji_unit = document.getElementsByClassName('kuji-unit');
  kuji_name = document.getElementsByClassName('kuji-name');
  kuji_num = document.getElementsByClassName('kuji-num');
  kuji_keep = document.getElementsByClassName('kuji-keep');
  kuji_bt_del = document.getElementsByClassName('kuji-bt-del');
  kuji_image_input = document.getElementsByClassName('kuji-image-input');
  kuji_image_preview = document.getElementsByClassName('kuji-image-preview');
  kuji_image_clear = document.getElementsByClassName('kuji-image-clear-bt');
}

function msgBox(str, ms = 1000){
  msg.textContent = str;
  msg.classList.remove('off');
  clearTimeout(msg_timer);
  msg_timer = setTimeout(()=>{
    msg.classList.add('off');
  },ms);
}

// localStorageが使えるか確認する（プライベートモード等で使えない場合がある）
function checkStorage(){
  try{
    const key = 'nandemo-kuji-test';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
  }catch(e){
    is_save_valid = false;
    return;
  }
  is_save_valid = true;
  el_area_save.classList.remove('s-hide');
}

function saveSettings(){
  if(!is_save_valid) return;
  try{
    localStorage.setItem('nandemo-kuji-fs', setting_font.value);
  }catch(e){
    msgBox('文字の大きさを保存できませんでした。');
  }
}

function saveData(){
  if(!is_save_valid) return;
  updateKujiElements();
  const data = [];
  [...kuji_unit].forEach((el,i)=>{
    const img = kuji_image_preview[i];
    const imgSrc = img.classList.contains('s-hide') ? '' : img.src;
    data.push([kuji_name[i].value, kuji_num[i].value, kuji_keep[i].checked, imgSrc]);
  });
  try{
    localStorage.setItem('nandemo-kuji-kuji', JSON.stringify(data));
  }catch(e){
    // 主に容量オーバー(QuotaExceededError)
    msgBox('保存できませんでした。画像の容量が大きすぎる可能性があります。画像を減らすか小さい画像にしてください。', 4000);
    return;
  }
  saveSettings();
  msgBox('データを保存しました。');
}

// 保存済みデータを読み込む。未保存ならnull、壊れていたらfalseを返す
function readSavedData(){
  const json = localStorage.getItem('nandemo-kuji-kuji');
  if(json==null) return null;
  try{
    const data = JSON.parse(json);
    if(!Array.isArray(data) || data.length === 0 || !data.every(Array.isArray)) return false;
    return data;
  }catch(e){
    return false;
  }
}

// データを画面のフォームに反映する
function applyData(data){
  updateKujiElements();
  const len = kuji_unit.length;
  if(data.length>len){
    //不足分追加
    for(let i=1;i<=data.length-len;i++){
      addKuji();
    }
  }else if(data.length<len){
    //余剰分削除
    for(let i=1;i<=len-data.length;i++){
      delKuji(kuji_bt_del[0]);
    }
  }
  updateKujiElements();
  data.forEach((d,i)=>{
    kuji_name[i].value = d[0] ?? '';
    kuji_num[i].value = d[1] ?? 0;
    kuji_keep[i].checked = !!d[2];
    const img = kuji_image_preview[i];
    const clearBt = kuji_image_clear[i];
    if(d[3]){
      img.src = d[3];
      img.classList.remove('s-hide');
      clearBt.classList.remove('s-hide');
    }else{
      img.src = '';
      img.classList.add('s-hide');
      clearBt.classList.add('s-hide');
    }
  });
}

function applySavedFontSize(){
  const savedFontSize = localStorage.getItem('nandemo-kuji-fs');
  if(savedFontSize){
    setting_font.value = savedFontSize;
  }
}

function loadData(){
  if(!is_save_valid) return;
  const data = readSavedData();
  if(data===null){
    msgBox('保存されたデータがありません。');
    return;
  }
  if(data===false){
    msgBox('保存されたデータが壊れているため呼び出せません。');
    return;
  }
  applyData(data);
  applySavedFontSize();
  msgBox('保存されたデータを呼び出しました。');
}

function loadDataOnInit(){
  if(!is_save_valid) return;
  const data = readSavedData();
  if(data===false){
    msgBox('保存されたデータが壊れているため、初期値を表示しています。', 3000);
  }else if(data!==null){
    applyData(data);
  }
  applySavedFontSize();
}
