/* =========================================================
   WEATHER PRO — GLOBAL DATA & APP LOGIC
========================================================= */
const POPULAR_CITIES = [
  {name:"Kolkata",   region:"West Bengal, India",   lat:22.5726,  lon:88.3639},
  {name:"Mumbai",    region:"Maharashtra, India",   lat:19.0760,  lon:72.8777},
  {name:"Delhi",     region:"Delhi, India",         lat:28.7041,  lon:77.1025},
  {name:"Bengaluru", region:"Karnataka, India",     lat:12.9716,  lon:77.5946},
  {name:"Dhaka",     region:"Dhaka, Bangladesh",    lat:23.8103,  lon:90.4125},
  {name:"London",    region:"England, UK",          lat:51.5072,  lon:-0.1276},
  {name:"New York",  region:"New York, USA",        lat:40.7128,  lon:-74.0060},
  {name:"Tokyo",     region:"Tokyo, Japan",         lat:35.6895,  lon:139.6917}
];

let currentLocation = null;
let hourlyData = [];
let dailyData = [];
let mainStats = {};

const ICONS = {
  cloud: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 17 18H7z"/></svg>`,
  partly: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="3" fill="#f5d76e" stroke="none"/><path d="M9 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 19 18H9z"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="#f5d76e" stroke-width="1.6"><circle cx="12" cy="12" r="4" fill="#f5d76e"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>`,
  partlyrain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="7" r="2.6" fill="#f5d76e" stroke="none"/><path d="M8 16a3.6 3.6 0 0 1 0-7.2 4.4 4.4 0 0 1 8.5-1.3A3.1 3.1 0 0 1 16 16H8z"/><path d="M9 19l-1 2M13 19l-1 2"/></svg>`,
  rain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 15a3.6 3.6 0 0 1 0-7.2 4.4 4.4 0 0 1 8.5-1.3A3.1 3.1 0 0 1 16 15H7z"/><path d="M8 18l-1 2M12 18l-1 2M16 18l-1 2"/></svg>`,
  moonCloud: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 17 18H7z"/><path d="M5 8a3 3 0 1 0 3-3 2.4 2.4 0 0 0 -3 3z" fill="#bcd0e0" stroke="none"/></svg>`
};

const LOCATION_CARD_BG = { cloud: 'linear-gradient(135deg, #5b6e85, #37485e)', sun: 'linear-gradient(135deg, #f5af19, #e15f17)', rain: 'linear-gradient(135deg, #4b6cb7, #182848)' };

function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function degToCompass(deg){ const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']; return dirs[Math.round(((deg%360)+360)%360 / 22.5) % 16]; }

function weatherCodeInfo(code, isDay){
  const map = {
    0:{desc:'Clear sky', icon: isDay?'sun':'moonCloud'}, 1:{desc:'Mainly clear', icon: isDay?'sun':'moonCloud'}, 2:{desc:'Partly cloudy', icon:'partly'}, 3:{desc:'Overcast', icon:'cloud'},
    61:{desc:'Light rain', icon:'rain'}, 63:{desc:'Rain', icon:'rain'}, 65:{desc:'Heavy rain', icon:'rain'},
    80:{desc:'Rain showers', icon:'partlyrain'}, 81:{desc:'Rain showers', icon:'partlyrain'}, 95:{desc:'Thunderstorm', icon:'rain'}
  };
  return map[code] || {desc:'Cloudy', icon:'cloud'};
}
function hourIsDay(iso){ const h = new Date(iso).getHours(); return h >= 6 && h < 18; }
function formatHourLabel(iso){ const d = new Date(iso); let h = d.getHours(); const ampm = h >= 12 ? 'pm' : 'am'; h = h % 12; if (h === 0) h = 12; return `${h} ${ampm}`; }
function formatClock(iso){ const d = new Date(iso); let h = d.getHours(); const m = d.getMinutes(); const ampm = h >= 12 ? 'pm' : 'am'; h = h % 12; if (h === 0) h = 12; return `${h}:${String(m).padStart(2,'0')} ${ampm}`; }
function dayLengthStr(sunriseIso, sunsetIso){ const totalMin = Math.max(0, Math.round((new Date(sunsetIso) - new Date(sunriseIso))/60000)); return `${Math.floor(totalMin/60)}h ${totalMin%60}min`; }
function sumRange(arr, from, to){ let s = 0; for (let i = Math.max(0,from); i <= Math.min(arr.length-1, to); i++) s += (arr[i] || 0); return s; }
function aqiInfo(aqi){ if (aqi <= 50) return {label:'Good', emoji:'🙂'}; if (aqi <= 100) return {label:'Moderate', emoji:'😐'}; return {label:'Unhealthy', emoji:'😣'}; }

/* UNITS & THEME */
let units = { temp:"C", wind:"kmh", pressure:"mbar", precip:"cm", vis:"km" };
function getTheme(){ return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
function setTheme(mode){ if (mode === 'light') document.documentElement.setAttribute('data-theme', 'light'); else document.documentElement.removeAttribute('data-theme'); }
function setUnit(key, value){ units[key] = value; renderMain(); renderHourly(); renderDaily(); }
function fmtTemp(c){ return c == null ? '--°' : (units.temp === 'F' ? Math.round(c*9/5+32) : Math.round(c)) + '°'; }

/* RENDER FUNCTIONS */
function renderMain(){
  document.getElementById('tempMain').textContent = mainStats.temp == null ? '--' : Math.round(mainStats.temp);
  document.getElementById('realfeel').textContent = fmtTemp(mainStats.realfeel);
  document.getElementById('lowTemp').textContent = fmtTemp(mainStats.low);
  document.getElementById('highTemp').textContent = fmtTemp(mainStats.high);
  document.getElementById('windDir').textContent = mainStats.windDir;
  document.getElementById('windSpeed').textContent = mainStats.windSpeedKmh ? mainStats.windSpeedKmh + ' km/h' : '--';
  document.getElementById('humidityTop').textContent = mainStats.humidity ? mainStats.humidity + '%' : '--%';
  document.getElementById('humidityVal').textContent = mainStats.humidity ? mainStats.humidity + '%' : '--%';
  document.getElementById('pressureVal').textContent = mainStats.pressureMbar || '--';
  document.getElementById('windSpeedVal').textContent = mainStats.windSpeedKmh || '--';
  document.getElementById('uvVal').textContent = mainStats.uv || '--';
  document.getElementById('visVal').textContent = mainStats.visKm ? mainStats.visKm + ' km' : '--';
  document.getElementById('precipVal').textContent = mainStats.precipCm ? mainStats.precipCm + ' cm' : '--';
}

function renderHourly(){
  const row = document.getElementById('hourlyRow'); row.innerHTML = '';
  hourlyData.forEach(h => {
    const el = document.createElement('div'); el.className = 'hour-item';
    el.innerHTML = `<span>${h.time}</span>${ICONS[h.icon] || ICONS.cloud}<span class="hour-pop">${h.pop}%</span><span>${fmtTemp(h.temp)}</span>`;
    row.appendChild(el);
  });
}

function renderDaily(){
  const container = document.getElementById('dailyRows'); container.innerHTML = '';
  dailyData.forEach(d => {
    const el = document.createElement('div'); el.className = 'daily-row';
    el.innerHTML = `<div class="daily-date">${d.date}<br>${d.day}</div><div class="daily-icon-wrap">${ICONS[d.icon]}<span class="daily-pop">${d.pop}%</span></div><div class="daily-desc">${d.desc}</div><div class="daily-temp">${fmtTemp(d.hi)}/${fmtTemp(d.lo)}</div>`;
    container.appendChild(el);
  });
}

function renderAirQuality(aq){
  const usAqi = Math.round(aq.us_aqi || 0); const info = aqiInfo(usAqi);
  document.getElementById('aqNum').textContent = usAqi;
  document.getElementById('aqLabel').textContent = info.label;
  document.getElementById('aqEmoji').textContent = info.emoji;
  document.getElementById('aqMarker').style.left = Math.min(100, (usAqi/300)*100) + '%';
}

/* FETCH LIVE WEATHER DATA */
async function fetchAndRenderWeather(lat, lon, name, region){
  document.getElementById('cityName').textContent = name || 'Locating...';
  currentLocation = { name, lat, lon };
  const wxUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,is_day&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset&timezone=auto`;
  const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi&timezone=auto`;

  try {
    const [wxRes, aqRes] = await Promise.all([fetch(wxUrl), fetch(aqUrl)]);
    const wx = await wxRes.json(); const aq = await aqRes.json();
    processWeather(wx, aq);
  } catch (e) { console.error(e); }
}

function processWeather(wx, aq){
  const cur = wx.current;
  mainStats = {
    temp: cur.temperature_2m, realfeel: cur.apparent_temperature, humidity: Math.round(cur.relative_humidity_2m),
    windSpeedKmh: cur.wind_speed_10m, windDir: degToCompass(cur.wind_direction_10m), pressureMbar: cur.pressure_msl,
    low: wx.daily.temperature_2m_min[0], high: wx.daily.temperature_2m_max[0], uv: Math.round(wx.daily.uv_index_max[0]),
    visKm: (wx.hourly.visibility[0] || 0) / 1000, precipCm: wx.hourly.precipitation[0]
  };

  const cond = weatherCodeInfo(cur.weather_code, cur.is_day === 1);
  document.getElementById('conditionText').textContent = cond.desc;
  document.getElementById('orbIcon').innerHTML = ICONS[cond.icon];

  hourlyData = [];
  for(let i=1; i<=8; i++){
    hourlyData.push({ time: formatHourLabel(wx.hourly.time[i]), pop: Math.round(wx.hourly.precipitation_probability[i]), temp: wx.hourly.temperature_2m[i], icon: weatherCodeInfo(wx.hourly.weather_code[i], hourIsDay(wx.hourly.time[i])).icon });
  }

  dailyData = [];
  for(let i=0; i<5; i++){
    const d = new Date(wx.daily.time[i]);
    dailyData.push({ date: `${d.getDate()}/${d.getMonth()+1}`, day: i===0?'Today':d.toLocaleDateString('en-US',{weekday:'short'}), pop: Math.round(wx.daily.precipitation_probability_max[i]), desc: weatherCodeInfo(wx.daily.weather_code[i], true).desc, hi: wx.daily.temperature_2m_max[i], lo: wx.daily.temperature_2m_min[i], icon: weatherCodeInfo(wx.daily.weather_code[i], true).icon });
  }

  document.getElementById('sunrise').textContent = formatClock(wx.daily.sunrise[0]);
  document.getElementById('sunset').textContent = formatClock(wx.daily.sunset[0]);
  document.getElementById('dayLengthText').textContent = dayLengthStr(wx.daily.sunrise[0], wx.daily.sunset[0]);

  if (aq && aq.current) renderAirQuality(aq.current);
  renderMain(); renderHourly(); renderDaily();
}

/* UI INTERACTIONS & SUBPAGES */
const drawer = document.getElementById('drawer'); const overlay = document.getElementById('overlay');
function openDrawer(){ drawer.classList.add('show'); overlay.classList.add('show'); }
function closeDrawer(){ drawer.classList.remove('show'); overlay.classList.remove('show'); }
document.getElementById('menuBtn').addEventListener('click', openDrawer);
overlay.addEventListener('click', () => { closeDrawer(); closeSearch(); closeSubpage(); });

const subpage = document.getElementById('subpage'); const subpageTitle = document.getElementById('subpageTitle'); const subpageBody = document.getElementById('subpageBody');
function openSubpage(page){
  subpageTitle.textContent = page.toUpperCase();
  if(page==='settings') subpageBody.innerHTML = `<div class="settings-row"><div class="settings-row-title">Dark Mode</div><label class="switch"><input type="checkbox" checked onchange="setTheme(this.checked?'dark':'light')"><span class="track"><span class="knob"></span></span></label></div>`;
  else if(page==='units') subpageBody.innerHTML = `<div class="unit-group"><div class="unit-title">Temperature</div><div class="seg"><button class="active" onclick="setUnit('temp','C')">°C</button><button onclick="setUnit('temp','F')">°F</button></div></div>`;
  else subpageBody.innerHTML = `<p>This section is placeholder for ${page}.</p>`;
  subpage.classList.add('show');
}
function closeSubpage(){ subpage.classList.remove('show'); }

const searchPage = document.getElementById('searchPage');
document.getElementById('searchBtn').addEventListener('click', () => { searchPage.classList.add('show'); renderSearchResults(POPULAR_CITIES); });
document.getElementById('searchBackBtn').addEventListener('click', () => searchPage.classList.remove('show'));
function closeSearch() { searchPage.classList.remove('show'); }

function renderSearchResults(list){
  const container = document.getElementById('searchResults'); container.innerHTML = '';
  list.forEach(c => {
    const div = document.createElement('div'); div.className = 'search-result'; div.innerHTML = `<div class="city">${c.name}</div><div class="region">${c.region}</div>`;
    div.onclick = () => { fetchAndRenderWeather(c.lat, c.lon, c.name, c.region); closeSearch(); };
    container.appendChild(div);
  });
}

function init(){ const defaultCity = POPULAR_CITIES[0]; fetchAndRenderWeather(defaultCity.lat, defaultCity.lon, defaultCity.name, defaultCity.region); }
init();

/* =========================================================
   🌟 PWA INSTALL LOGIC (বাটন ট্রিগার এবং ইনস্টলেশন রান)
========================================================= */
let deferredPrompt;
const installAppItem = document.getElementById('installAppItem');

// ১. সার্ভিস ওয়ার্কার রেজিস্ট্রেশন
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .then(() => console.log('Service Worker successfully bound.'))
      .catch((err) => console.log('SW setup error:', err));
  });
}

// ২. ব্রাউজার থেকে ইনস্টলেশন সিগন্যাল রিসিভ করা
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // ডিফল্ট ব্রাউজার পপআপ অফ করা
  deferredPrompt = e;  // ইভেন্ট হোল্ড করা
  
  if (installAppItem) {
    installAppItem.style.display = 'flex'; // মেনুতে বাটনটি শো করানো
  }
});

// ৩. ইনস্টল বাটনে ক্লিক ইভেন্ট হ্যান্ডল করা
if (installAppItem) {
  installAppItem.addEventListener('click', async () => {
    if (deferredPrompt) {
      closeDrawer(); // সাইড ড্রয়ার অফ করা
      deferredPrompt.prompt(); // আসল ক্রোম/সাফারি ইনস্টল বক্স খোলা
      
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User interaction result: ${outcome}`);
      
      deferredPrompt = null; // প্রম্পট ডিসমিস
      installAppItem.style.display = 'none'; // বাটন হাইড করা
    }
  });
}

// ৪. অ্যাপ সফলভাবে ইনস্টল সম্পন্ন হলে
window.addEventListener('appinstalled', () => {
  console.log('Weather Pro app installed successfully on device.');
  if (installAppItem) {
    installAppItem.style.display = 'none';
  }
});