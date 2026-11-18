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
const confetti_canvas = document.getElementById('confetti');
let confetti_raf = null;
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
    launchConfetti();
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
  stopConfetti();
  hidePopup();
  resetIllust();
  bt_get.classList.remove('invisible');
  bt_pre.classList.add('invisible');
}

// 紙吹雪：半分は画面の左右下から打ち上げ、半分は画面上から降らせる
const CONFETTI_COLORS = ['#ff4d6d','#ffd23f','#33cccc','#5e60ce','#ff8c42','#3bceac','#f72585'];
const CONFETTI_MAX_MS = 6000;
function launchConfetti(){
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  stopConfetti();
  const ctx = confetti_canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth;
  const H = window.innerHeight;
  confetti_canvas.width = Math.round(W * dpr);
  confetti_canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const s = Math.max(0.6, H / 800); // 画面の高さに合わせて勢いを調整
  const rand = (a,b)=>a + Math.random()*(b-a);
  const count = Math.round(Math.min(260, 100 + W / 6));
  const parts = [];
  for(let i=0;i<count;i++){
    const p = i % 2 === 0
      ? (()=>{ // 左右下から打ち上げ
          const fromLeft = i % 4 === 0;
          return {
            x: fromLeft ? rand(-10, W*0.05) : rand(W*0.95, W+10),
            y: H + rand(0, 20),
            vx: (fromLeft ? 1 : -1) * rand(2, 10) * s,
            vy: -rand(16, 28) * s,
          };
        })()
      : { // 画面上から降らせる（時間差が出るよう高さをばらす）
          x: rand(0, W),
          y: -rand(10, H * 0.6),
          vx: rand(-1, 1),
          vy: rand(1, 3) * s,
        };
    parts.push({
      ...p,
      w: rand(7, 13),
      h: rand(4, 8),
      rot: rand(0, Math.PI*2),
      vrot: rand(-0.25, 0.25),
      flip: rand(0, Math.PI*2),
      vflip: rand(0.08, 0.2),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    });
  }
  const start = performance.now();
  let last = start;
  const frame = (now)=>{
    // 端末の描画速度に依存しないよう補正（初回フレームは時刻が前後することがあるので0未満にしない）
    const k = Math.max(0, Math.min(3, (now - last) / 16.67));
    last = now;
    const elapsed = now - start;
    ctx.clearRect(0, 0, W, H);
    // 最後の1秒でフェードアウト
    ctx.globalAlpha = Math.max(0, Math.min(1, (CONFETTI_MAX_MS - elapsed) / 1000));
    let alive = 0;
    parts.forEach((p)=>{
      p.vy += 0.4 * s * k;
      p.vx *= Math.pow(0.985, k);
      p.vy = Math.min(p.vy * Math.pow(0.985, k), 4 * s); // 落下は空気抵抗でゆっくり
      p.x += (p.vx + Math.sin(p.flip) * 0.8) * k;
      p.y += p.vy * k;
      p.rot += p.vrot * k;
      p.flip += p.vflip * k;
      if(p.y > H + 20 && p.vy > 0) return; // 落ちきったものは描かない
      alive++;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.flip)); // 裏返るようなひらひら感
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
    });
    if(alive > 0 && elapsed < CONFETTI_MAX_MS){
      confetti_raf = requestAnimationFrame(frame);
    }else{
      stopConfetti();
    }
  };
  confetti_raf = requestAnimationFrame(frame);
}

function stopConfetti(){
  if(confetti_raf !== null){
    cancelAnimationFrame(confetti_raf);
    confetti_raf = null;
  }
  const ctx = confetti_canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, confetti_canvas.width, confetti_canvas.height);
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
