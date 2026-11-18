const screen = document.getElementById('screen');
const screen_inner = document.getElementById('screen-inner');
let illust_svg = document.getElementById('illust-svg');
const illust_svg_template = illust_svg.cloneNode(true);
const ILLUST_DUR_MS = 1500; // SVGアニメーションの長さ(1.48s)に合わせた再生時間
const result_popup = document.getElementById('result-popup');
const result_text = document.getElementById('result-text');
const result_image = document.getElementById('result-image');
const bt_get = document.getElementById('bt-get');
const bt_pre = document.getElementById('bt-pre');
const bt_popup_close = document.getElementById('bt-popup-close');
const bt_fullscreen = document.getElementById('bt-fullscreen');
const msg = document.getElementById('message');
let playing = false;

//リスナ
// 全画面表示（iPhoneのSafariなど非対応ブラウザではボタンを隠す）
const requestFs = screen.requestFullscreen || screen.webkitRequestFullscreen;
if(requestFs && (document.fullscreenEnabled || document.webkitFullscreenEnabled)){
  bt_fullscreen.addEventListener('click',()=>{
    try{
      const p = requestFs.call(screen);
      if(p && p.catch) p.catch(()=>msgBox('全画面表示にできませんでした。'));
    }catch(e){
      msgBox('全画面表示にできませんでした。');
    }
  });
}else{
  bt_fullscreen.classList.add('s-hide');
}
bt_get.addEventListener('click',getKuji);
bt_pre.addEventListener('click',prepareKuji);
bt_popup_close.addEventListener('click',prepareKuji);
//
loadFontSize();
// 設定ページ（別タブ）で文字サイズが変わったら反映する
// ※くじデータは抽選のたびにlocalStorageから読み直すので監視不要
window.addEventListener('storage', (e) => {
  if(e.key === 'nandemo-kuji-fs'){
    loadFontSize();
  }
});

function loadFontSize(){
  const savedFontSize = localStorage.getItem('nandemo-kuji-fs');
  const fs = savedFontSize ? Number(savedFontSize) : 18;
  // 実際の表示サイズはCSS側で --popup-scale 倍される
  result_popup.style.setProperty('--popup-fs', (isNaN(fs) || fs <= 0 ? 18 : fs) + 'px');
}

// localStorageのくじデータを読み込む。未設定ならnull、壊れていたら例外
function readKujiData(){
  const json = localStorage.getItem('nandemo-kuji-kuji');
  if(json==null) return null;
  const data = JSON.parse(json);
  if(!Array.isArray(data)) throw new Error('invalid kuji data');
  return data;
}

function showPopup(html, imageSrc){
  result_text.innerHTML = html;
  if(imageSrc){
    result_image.src = imageSrc;
    result_image.classList.remove('s-hide');
  }else{
    result_image.src = '';
    result_image.classList.add('s-hide');
  }
  result_popup.classList.add('popup-show');
}

function hidePopup(){
  result_popup.classList.remove('popup-show');
  result_text.innerHTML = '';
  result_image.src = '';
  result_image.classList.add('s-hide');
}

function playIllustOnce(){
  return new Promise((resolve)=>{
    const animEls = illust_svg.querySelectorAll('animate, animateTransform');
    animEls.forEach((el)=>el.beginElement());
    setTimeout(resolve, ILLUST_DUR_MS);
  });
}

function resetIllust(){
  const fresh = illust_svg_template.cloneNode(true);
  illust_svg.replaceWith(fresh);
  illust_svg = fresh;
}

function getKuji(){
  //初期処理
  if(playing) return;
  playing = true;
  bt_get.classList.add('invisible');
  hidePopup();

  //localStorageからくじデータを読み込む
  let data;
  try{
    data = readKujiData();
  }catch(e){
    playing = false;
    showPopup('くじデータが壊れています。設定ページでくじを保存し直してください。');
    bt_get.classList.remove('invisible');
    return;
  }
  if(data==null){
    playing = false;
    showPopup('くじが設定されていません。設定ページでくじを設定してください。');
    bt_get.classList.remove('invisible');
    return;
  }
  //変数定義
  const kuji_set = [];
  let num = 0;
  //くじセット作成
  data.forEach((d,i)=>{
    if(!Array.isArray(d)) return;
    let val = Number(d[1]);
    if(isNaN(val)){
      val = 0;
    }else if(val<0){
      val = 0;
    }
    if(val>0){
      num+=val;
      kuji_set.push([i,num]);
    }
  });

  if(num==0){
    //空っぽ
    playing = false;
    showPopup('くじが無くなりました');
    bt_get.classList.remove('invisible');
    return;
  }
  //抽選
  const hit_num = randomMN(1,num);
  const hit_id = (()=>{
    for(let i=0;i<kuji_set.length;i++){
      if(hit_num<=kuji_set[i][1]){
        return kuji_set[i][0];
      }
    }
  })();
  //演出（イラストを1回再生してから結果をポップアップ表示）
  playIllustOnce().then(()=>{
    showPopup(newline(String(data[hit_id][0] ?? '')), data[hit_id][3]);
    // 残数を減らす処理
    if(!data[hit_id][2]){ // kuji_keepがfalseの場合
      data[hit_id][1] = Number(data[hit_id][1]) - 1;
      if(data[hit_id][1] < 0) data[hit_id][1] = 0;
      try{
        localStorage.setItem('nandemo-kuji-kuji', JSON.stringify(data));
      }catch(e){
        msgBox('残数を保存できませんでした。');
      }
    }
    bt_pre.classList.remove('invisible');
  });
}

function prepareKuji(){
  playing = false;
  hidePopup();
  resetIllust();
  bt_get.classList.remove('invisible');
  bt_pre.classList.add('invisible');
}

function msgBox(str){
  if(msg){
    msg.textContent = str;
    msg.classList.remove('off');
    setTimeout(()=>{
      msg.classList.add('off');
    },1000);
  }
}

function newline(str){
  str = str.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/(\r\n|\r|\n)/g,'<br>');
  return str;
}

function randomMN(m,n){
  const d = Math.max(m,n)-Math.min(m,n);
  return Math.floor(Math.random()*(d+1)+Math.min(m,n));
}
