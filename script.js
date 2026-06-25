/* =========================================================
   LIVE DATA — powered by Open-Meteo (forecast + air quality +
   geocoding) and BigDataCloud (reverse geocoding for "my location").
   No API key required for either service.
========================================================= */

let hourlyData = [];   // populated live: {time, pop, temp, icon}
let dailyData = [];    // populated live: {date, day, pop, desc, hi, lo, icon}
const mainStats = {
  temp:null, realfeel:null, low:null, high:null,
  windSpeedKmh:null, windDir:"-", windDirDeg:0, humidity:null,
  pressureMbar:null, uv:null, visKm:null, precipCm:null, precipNextCm:null,
  dewPointC:null, aqi:null
};
let currentLocation = null; // {name, region, lat, lon}

/* =========================================================
   SAVED LOCATIONS — persisted list the user has searched/picked.
   Each entry is shown as a live card on the "Manage Location" page.
========================================================= */
function getSavedLocations(){
  try { return JSON.parse(localStorage.getItem('savedLocations')) || []; }
  catch(e) { return []; }
}
function saveLocation(loc){
  const list = getSavedLocations();
  const exists = list.some(l => Math.abs(l.lat - loc.lat) < 0.001 && Math.abs(l.lon - loc.lon) < 0.001);
  if (!exists) {
    list.push({ name: loc.name, region: loc.region || '', lat: loc.lat, lon: loc.lon });
    try { localStorage.setItem('savedLocations', JSON.stringify(list)); } catch(e) {}
  }
}
function removeSavedLocation(lat, lon){
  const list = getSavedLocations().filter(l => !(Math.abs(l.lat - lat) < 0.001 && Math.abs(l.lon - lon) < 0.001));
  try { localStorage.setItem('savedLocations', JSON.stringify(list)); } catch(e) {}
  if (currentSubpage === 'location') openSubpage('location');
}

// A small rotating set of background photos for the location cards,
// matched loosely to current weather condition.
const LOCATION_CARD_BG = {
  sun:        'linear-gradient(160deg, #2f8fd6 0%, #7fc4f0 55%, #d9ecfa 100%)',
  partly:     'linear-gradient(160deg, #3a6ea8 0%, #8fb8d8 55%, #e3eef6 100%)',
  cloud:      'linear-gradient(160deg, #56657a 0%, #8a96a6 55%, #cfd6dd 100%)',
  partlyrain: 'linear-gradient(160deg, #2e3c52 0%, #5a6e87 55%, #9aacbd 100%)',
  rain:       'linear-gradient(160deg, #1f2a3d 0%, #44546b 55%, #7c8da3 100%)',
  moonCloud:  'linear-gradient(160deg, #10131f 0%, #2c3650 55%, #586a86 100%)'
};

const POPULAR_CITIES = [
  {name:"Namkhana",  region:"West Bengal, India",   lat:21.7667,  lon:88.2167},
  {name:"Kolkata",   region:"West Bengal, India",   lat:22.5726,  lon:88.3639},
  {name:"Mumbai",    region:"Maharashtra, India",   lat:19.0760,  lon:72.8777},
  {name:"Delhi",     region:"Delhi, India",         lat:28.7041,  lon:77.1025},
  {name:"Bengaluru", region:"Karnataka, India",     lat:12.9716,  lon:77.5946},
  {name:"Dhaka",     region:"Dhaka, Bangladesh",    lat:23.8103,  lon:90.4125},
  {name:"London",    region:"England, UK",          lat:51.5072,  lon:-0.1276},
  {name:"New York",  region:"New York, USA",        lat:40.7128,  lon:-74.0060},
  {name:"Tokyo",     region:"Tokyo, Japan",         lat:35.6895,  lon:139.6917},
  {name:"Dubai",     region:"Dubai, UAE",           lat:25.2048,  lon:55.2708}
];

/* ---------------- ICONS ---------------- */
const ICONS = {
  cloud: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 17 18H7z"/></svg>`,
  partly: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="3" fill="#f5d76e" stroke="none"/><path d="M9 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 19 18H9z"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="#f5d76e" stroke-width="1.6"><circle cx="12" cy="12" r="4" fill="#f5d76e"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>`,
  partlyrain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="7" r="2.6" fill="#f5d76e" stroke="none"/><path d="M8 16a3.6 3.6 0 0 1 0-7.2 4.4 4.4 0 0 1 8.5-1.3A3.1 3.1 0 0 1 16 16H8z"/><path d="M9 19l-1 2M13 19l-1 2"/></svg>`,
  rain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 15a3.6 3.6 0 0 1 0-7.2 4.4 4.4 0 0 1 8.5-1.3A3.1 3.1 0 0 1 16 15H7z"/><path d="M8 18l-1 2M12 18l-1 2M16 18l-1 2"/></svg>`,
  moonCloud: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 17 18H7z"/><path d="M5 8a3 3 0 1 0 3-3 2.4 2.4 0 0 0 -3 3z" fill="#bcd0e0" stroke="none"/></svg>`
};

/* ---------------- small helpers ---------------- */
function escapeHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function degToCompass(deg){
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(((deg%360)+360)%360 / 22.5) % 16];
}
function weatherCodeInfo(code, isDay){
  const map = {
    0:{desc:'Clear sky', icon: isDay?'sun':'moonCloud'},
    1:{desc:'Mainly clear', icon: isDay?'sun':'moonCloud'},
    2:{desc:'Partly cloudy', icon:'partly'},
    3:{desc:'Overcast', icon:'cloud'},
    45:{desc:'Fog', icon:'cloud'}, 48:{desc:'Freezing fog', icon:'cloud'},
    51:{desc:'Light drizzle', icon:'rain'}, 53:{desc:'Drizzle', icon:'rain'}, 55:{desc:'Dense drizzle', icon:'rain'},
    56:{desc:'Freezing drizzle', icon:'rain'}, 57:{desc:'Freezing drizzle', icon:'rain'},
    61:{desc:'Light rain', icon:'rain'}, 63:{desc:'Rain', icon:'rain'}, 65:{desc:'Heavy rain', icon:'rain'},
    66:{desc:'Freezing rain', icon:'rain'}, 67:{desc:'Freezing rain', icon:'rain'},
    71:{desc:'Light snow', icon:'rain'}, 73:{desc:'Snow', icon:'rain'}, 75:{desc:'Heavy snow', icon:'rain'},
    77:{desc:'Snow grains', icon:'rain'},
    80:{desc:'Rain showers', icon:'partlyrain'}, 81:{desc:'Rain showers', icon:'partlyrain'}, 82:{desc:'Violent showers', icon:'rain'},
    85:{desc:'Snow showers', icon:'rain'}, 86:{desc:'Snow showers', icon:'rain'},
    95:{desc:'Thunderstorm', icon:'rain'}, 96:{desc:'Thunderstorm w/ hail', icon:'rain'}, 99:{desc:'Thunderstorm w/ hail', icon:'rain'}
  };
  return map[code] || {desc:'Unknown', icon:'cloud'};
}
function hourIsDay(iso){ const h = new Date(iso).getHours(); return h >= 6 && h < 18; }
function formatHourLabel(iso){
  const d = new Date(iso);
  let h = d.getHours();
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12; if (h === 0) h = 12;
  return `${h} ${ampm}`;
}
function formatClock(iso){
  const d = new Date(iso);
  let h = d.getHours(); const m = d.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2,'0')} ${ampm}`;
}
function dayLengthStr(sunriseIso, sunsetIso){
  const ms = new Date(sunsetIso) - new Date(sunriseIso);
  const totalMin = Math.max(0, Math.round(ms/60000));
  return `${Math.floor(totalMin/60)}h ${totalMin%60}min`;
}
function sumRange(arr, from, to){
  let s = 0;
  for (let i = Math.max(0,from); i <= Math.min(arr.length-1, to); i++) s += (arr[i] || 0);
  return s;
}
function moonPhaseInfo(date){
  const synodic = 29.530588853;
  const newMoonRef = Date.UTC(2000,0,6,18,14,0) / 1000;
  const secs = (((date.getTime()/1000) - newMoonRef) % (synodic*86400) + (synodic*86400)) % (synodic*86400);
  const p = secs / (synodic*86400); // 0..1
  const illumination = Math.round((1 - Math.cos(2*Math.PI*p)) / 2 * 100);
  let name;
  if (p < 0.03 || p > 0.97) name = 'New Moon';
  else if (p < 0.22) name = 'Waxing Crescent';
  else if (p < 0.28) name = 'First Quarter';
  else if (p < 0.47) name = 'Waxing Gibbous';
  else if (p < 0.53) name = 'Full Moon';
  else if (p < 0.72) name = 'Waning Gibbous';
  else if (p < 0.78) name = 'Last Quarter';
  else name = 'Waning Crescent';
  return { name, illumination };
}
function aqiInfo(aqi){
  if (aqi <= 50)  return {label:'Good', emoji:'🙂'};
  if (aqi <= 100) return {label:'Moderate', emoji:'😐'};
  if (aqi <= 150) return {label:'Unhealthy (Sensitive)', emoji:'😣'};
  if (aqi <= 200) return {label:'Unhealthy', emoji:'☹️'};
  if (aqi <= 300) return {label:'Very Unhealthy', emoji:'😫'};
  return {label:'Hazardous', emoji:'☠️'};
}
const POLLUTANT_THRESH = { pm2_5:35, pm10:154, no2:100, o3:70, so2:75, co:9000 };
function pollutantPct(val, key){
  if (val == null) return 0;
  return Math.max(2, Math.min(100, Math.round((val/POLLUTANT_THRESH[key]) * 100)));
}
function pollutantClass(pct){ return pct > 66 ? 'high' : (pct > 33 ? 'med' : ''); }

/* =========================================================
   THEME (Dark / Light) — persists across reloads
========================================================= */
function getTheme(){
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}
function setTheme(mode){
  if (mode === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  try { localStorage.setItem('themeMode', mode); } catch(e) {}
  if (currentSubpage === 'settings') openSubpage('settings');
}

/* =========================================================
   UNITS — persisted, drive every formatted value on screen
========================================================= */
const UNIT_DEFAULTS = { temp:"C", wind:"kmh", pressure:"mbar", precip:"cm", vis:"km" };
function getUnits(){
  try { return Object.assign({}, UNIT_DEFAULTS, JSON.parse(localStorage.getItem('units')) || {}); }
  catch(e) { return Object.assign({}, UNIT_DEFAULTS); }
}
let units = getUnits();
function setUnit(key, value){
  units[key] = value;
  try { localStorage.setItem('units', JSON.stringify(units)); } catch(e) {}
  renderMain(); renderHourly(); renderDaily();
  if (currentSubpage === 'units') openSubpage('units');
}
function fmtTemp(c){
  if (c == null) return '--°';
  const v = units.temp === 'F' ? Math.round(c*9/5+32) : Math.round(c);
  return v + '°';
}
function fmtWindFull(kmh){
  if (kmh == null) return '--';
  return units.wind === 'mph' ? (kmh*0.621371).toFixed(1)+'mph' : kmh.toFixed(1)+'km/h';
}
function fmtWindNum(kmh){ return kmh == null ? '--' : (units.wind === 'mph' ? (kmh*0.621371).toFixed(1) : kmh.toFixed(1)); }
function fmtWindLabel(){ return units.wind === 'mph' ? 'mph' : 'km/h'; }
function fmtPressureNum(mbar){ return mbar == null ? '--' : (units.pressure === 'inhg' ? (mbar*0.0295301).toFixed(2) : Math.round(mbar)); }
function fmtPressureLabel(){ return units.pressure === 'inhg' ? 'inHg' : 'mbar'; }
function fmtVis(km){ if (km == null) return '-- km'; return units.vis === 'mi' ? (km*0.621371).toFixed(1)+' mi' : km.toFixed(1)+' km'; }
function fmtPrecip(cm){ if (cm == null) return '-- cm'; return units.precip === 'in' ? (cm*0.393701).toFixed(2)+' in' : cm.toFixed(2)+' cm'; }

/* ---------------- RENDER MAIN ORB + STATS ---------------- */
function renderMain(){
  document.getElementById('tempMain').textContent =
    mainStats.temp == null ? '--' : (units.temp === 'F' ? Math.round(mainStats.temp*9/5+32) : Math.round(mainStats.temp));
  document.getElementById('tempUnitLabel').textContent = units.temp === 'F' ? '°F' : '°C';
  document.getElementById('realfeel').textContent = fmtTemp(mainStats.realfeel);
  document.getElementById('lowTemp').textContent = fmtTemp(mainStats.low);
  document.getElementById('highTemp').textContent = fmtTemp(mainStats.high);
  document.getElementById('dewPoint').textContent = fmtTemp(mainStats.dewPointC);

  document.getElementById('windDir').textContent = mainStats.windDir;
  document.getElementById('windSpeed').textContent = fmtWindFull(mainStats.windSpeedKmh);
  document.getElementById('humidityTop').textContent = mainStats.humidity == null ? '--%' : mainStats.humidity + '%';
  document.getElementById('humidityVal').textContent = mainStats.humidity == null ? '--%' : mainStats.humidity + '%';

  document.getElementById('pressureVal').textContent = fmtPressureNum(mainStats.pressureMbar);
  document.getElementById('pressureUnitLabel').textContent = fmtPressureLabel();

  document.getElementById('windSpeedVal').textContent = fmtWindNum(mainStats.windSpeedKmh);
  document.getElementById('windUnitLabel').textContent = fmtWindLabel();
  const arrow = document.getElementById('windArrowGroup');
  if (arrow) arrow.setAttribute('transform', `rotate(${Math.round(mainStats.windDirDeg)} 60 60)`);

  document.getElementById('uvVal').textContent = mainStats.uv == null ? '--' : mainStats.uv;
  const uv = mainStats.uv || 0;
  const uvLabel = uv <= 2 ? 'Low' : uv <= 5 ? 'Moderate' : uv <= 7 ? 'High' : uv <= 10 ? 'Very High' : 'Extreme';
  document.getElementById('uvLabel').textContent = uvLabel;
  document.getElementById('uvKnob').style.left = Math.min(100, (uv/11)*100) + '%';
  document.getElementById('uvDesc').textContent = uv <= 2
    ? 'Minimal sun protection needed.'
    : uv <= 5 ? 'Wear sunglasses on bright days.'
    : uv <= 7 ? 'Seek shade during midday hours.'
    : 'Take precautions — avoid sun during midday hours.';

  document.getElementById('visVal').textContent = fmtVis(mainStats.visKm);
  const vk = mainStats.visKm;
  document.getElementById('visDesc').textContent = vk == null ? '--'
    : vk > 10 ? 'Excellent visibility.'
    : vk > 5 ? 'Good visibility.'
    : vk > 2 ? 'Moderate visibility, take care outdoors.'
    : 'Poor visibility, vision is not clear.';

  document.getElementById('precipVal').textContent = fmtPrecip(mainStats.precipCm);
  const nextEl = document.getElementById('precipNext24');
  if (nextEl) nextEl.innerHTML = `<strong>${fmtPrecip(mainStats.precipNextCm || 0)}</strong> precipitation is expected in the next 24 hours.`;
}

/* ---------------- RENDER HOURLY ---------------- */
function renderHourly(){
  const hourlyRow = document.getElementById('hourlyRow');
  hourlyRow.innerHTML = '';
  hourlyData.forEach(h => {
    const el = document.createElement('div');
    el.className = 'hour-item';
    el.innerHTML = `<span>${h.time}</span>${ICONS[h.icon] || ICONS.cloud}<span class="hour-pop">${h.pop}%</span><span>${fmtTemp(h.temp)}</span>`;
    hourlyRow.appendChild(el);
  });
}

/* ---------------- RENDER DAILY ---------------- */
function renderDaily(){
  const dailyRows = document.getElementById('dailyRows');
  dailyRows.innerHTML = '';
  dailyData.forEach(d => {
    const el = document.createElement('div');
    el.className = 'daily-row';
    el.innerHTML = `
      <div class="daily-date">${d.date}<br>${d.day}</div>
      <div class="daily-icon-wrap">${ICONS[d.icon] || ICONS.cloud}<span class="daily-pop">${d.pop}%</span></div>
      <div class="daily-desc">${escapeHtml(d.desc)}</div>
      <div class="daily-temp">${fmtTemp(d.hi)}/${fmtTemp(d.lo)}</div>`;
    dailyRows.appendChild(el);
  });

  const banner = document.getElementById('dailyBanner');
  let worst = null;
  dailyData.slice(0,5).forEach(d => { if (!worst || d.pop > worst.pop) worst = d; });
  if (worst && worst.pop >= 50) {
    banner.textContent = `${worst.desc} likely ${worst.day === 'Today' ? 'today' : worst.day}`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

/* ---------------- RENDER AIR QUALITY ---------------- */
function renderAirQuality(aq){
  const usAqi = Math.round(aq.us_aqi ?? 0);
  mainStats.aqi = usAqi;
  const info = aqiInfo(usAqi);
  document.getElementById('aqNum').textContent = usAqi;
  document.getElementById('aqLabel').textContent = info.label;
  document.getElementById('aqEmoji').textContent = info.emoji;
  document.getElementById('aqMarker').style.left = Math.min(100, (usAqi/500)*100) + '%';

  const pollutants = [
    {key:'pm2_5', val: aq.pm2_5,             valId:'pm25Val', barId:'pm25Bar', label:'Particulate Matter 2.5'},
    {key:'pm10',  val: aq.pm10,              valId:'pm10Val', barId:'pm10Bar', label:'Particulate Matter 10'},
    {key:'no2',   val: aq.nitrogen_dioxide,  valId:'no2Val',  barId:'no2Bar',  label:'Nitrogen Dioxide'},
    {key:'o3',    val: aq.ozone,             valId:'o3Val',   barId:'o3Bar',   label:'Ozone'},
    {key:'so2',   val: aq.sulphur_dioxide,   valId:'so2Val',  barId:'so2Bar',  label:'Sulphur Dioxide'},
    {key:'co',    val: aq.carbon_monoxide,   valId:'coVal',   barId:'coBar',   label:'Carbon Monoxide'}
  ];

  let mainP = pollutants[0];
  let bestRatio = -1;
  pollutants.forEach(p => {
    const pct = pollutantPct(p.val, p.key);
    document.getElementById(p.valId).textContent = p.val == null ? '--' : Math.round(p.val);
    const barEl = document.getElementById(p.barId);
    barEl.style.width = pct + '%';
    barEl.className = 'pollutant-bar ' + pollutantClass(pct);
    const ratio = (p.val || 0) / POLLUTANT_THRESH[p.key];
    if (ratio > bestRatio) { bestRatio = ratio; mainP = p; }
  });
  document.getElementById('mainPollutant').textContent = mainP.label;
}

/* ---------------- RENDER SUN & MOON ---------------- */
function renderSunMoon(sunriseIso, sunsetIso){
  document.getElementById('sunrise').textContent = formatClock(sunriseIso);
  document.getElementById('sunset').textContent = formatClock(sunsetIso);
  document.getElementById('dayLengthText').textContent = dayLengthStr(sunriseIso, sunsetIso);
  const moon = moonPhaseInfo(new Date());
  document.getElementById('moonPhase').textContent = moon.name;
  document.getElementById('moonLength').textContent = `Illumination: ${moon.illumination}%`;
}

/* ---------------- RENDER ORB ICON / CONDITION ---------------- */
function renderOrbIcon(icon){
  const el = document.getElementById('orbIcon');
  if (el) el.innerHTML = ICONS[icon] || ICONS.cloud;
}

/* =========================================================
   LIVE WEATHER FETCH (Open-Meteo) + AIR QUALITY
========================================================= */
async function fetchAndRenderWeather(lat, lon, name, region){
  document.getElementById('cityName').textContent = name || 'Locating...';
  document.getElementById('conditionText').textContent = 'Loading…';
  currentLocation = { name, region: region || '', lat, lon };

  const wxUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,is_day` +
    `&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,visibility,dew_point_2m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset` +
    `&past_days=1&forecast_days=10&timezone=auto`;
  const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
    `&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi&timezone=auto`;

  try {
    const [wxRes, aqRes] = await Promise.all([fetch(wxUrl), fetch(aqUrl)]);
    const wx = await wxRes.json();
    const aq = await aqRes.json();
    if (wx.error) throw new Error(wx.reason || 'forecast error');
    processWeather(wx, aq);
  } catch (e) {
    document.getElementById('conditionText').textContent = 'Unavailable';
    alert('Could not load live weather. Please check your internet connection and try again.');
  }
}

function processWeather(wx, aq){
  const cur = wx.current;
  const hourlyTimes = wx.hourly.time;
  let idx = hourlyTimes.indexOf(cur.time);
  if (idx < 0) idx = 0;

  const todayStr = cur.time.slice(0,10);
  let todayIdx = wx.daily.time.indexOf(todayStr);
  if (todayIdx < 0) todayIdx = 0;

  mainStats.temp = cur.temperature_2m;
  mainStats.realfeel = cur.apparent_temperature;
  mainStats.humidity = Math.round(cur.relative_humidity_2m);
  mainStats.windSpeedKmh = cur.wind_speed_10m;
  mainStats.windDirDeg = cur.wind_direction_10m;
  mainStats.windDir = degToCompass(cur.wind_direction_10m);
  mainStats.pressureMbar = cur.pressure_msl;
  mainStats.dewPointC = wx.hourly.dew_point_2m[idx];
  mainStats.visKm = (wx.hourly.visibility[idx] || 0) / 1000;
  mainStats.precipCm = sumRange(wx.hourly.precipitation, idx-23, idx) / 10;
  mainStats.precipNextCm = sumRange(wx.hourly.precipitation, idx+1, idx+24) / 10;
  mainStats.low = wx.daily.temperature_2m_min[todayIdx];
  mainStats.high = wx.daily.temperature_2m_max[todayIdx];
  mainStats.uv = Math.round(wx.daily.uv_index_max[todayIdx] || 0);

  const cond = weatherCodeInfo(cur.weather_code, cur.is_day === 1);
  document.getElementById('conditionText').textContent = cond.desc;
  renderOrbIcon(cond.icon);

  // precipitation note — next ~12 hours
  let note = 'No precipitation expected in the next 12 hours';
  for (let i = idx; i < Math.min(idx+12, wx.hourly.time.length); i++) {
    if ((wx.hourly.precipitation_probability[i] || 0) >= 40) {
      const mins = (i - idx) * 60;
      note = mins <= 0 ? 'Precipitation expected now' : `Precipitation possible in about ${mins} min`;
      break;
    }
  }
  document.getElementById('precipNote').textContent = note;

  // hourly forecast — next 8 hours
  hourlyData = [];
  for (let i = idx+1; i < Math.min(idx+9, wx.hourly.time.length); i++) {
    hourlyData.push({
      time: formatHourLabel(wx.hourly.time[i]),
      pop: Math.round(wx.hourly.precipitation_probability[i] || 0),
      temp: wx.hourly.temperature_2m[i],
      icon: weatherCodeInfo(wx.hourly.weather_code[i], hourIsDay(wx.hourly.time[i])).icon
    });
  }

  // daily forecast — today onward
  dailyData = [];
  for (let i = todayIdx; i < wx.daily.time.length; i++) {
    const d = new Date(wx.daily.time[i] + 'T00:00:00');
    const info = weatherCodeInfo(wx.daily.weather_code[i], true);
    dailyData.push({
      date: `${d.getDate()}/${d.getMonth()+1}`,
      day: i === todayIdx ? 'Today' : d.toLocaleDateString('en-US', {weekday:'short'}),
      pop: Math.round(wx.daily.precipitation_probability_max[i] || 0),
      desc: info.desc,
      hi: wx.daily.temperature_2m_max[i],
      lo: wx.daily.temperature_2m_min[i],
      icon: info.icon
    });
  }

  renderSunMoon(wx.daily.sunrise[todayIdx], wx.daily.sunset[todayIdx]);
  if (aq && aq.current) renderAirQuality(aq.current);

  renderMain();
  renderHourly();
  renderDaily();
}

/* ---------------- CITY SELECTION (search / popular / current) ---------------- */
function selectLocation(lat, lon, name, region){
  saveLocation({ name, region, lat, lon });
  closeSearch();
  closeSubpage();
  fetchAndRenderWeather(lat, lon, name, region);
}
document.addEventListener('click', (e) => {
  const el = e.target.closest('.geo-result');
  if (el) selectLocation(parseFloat(el.dataset.lat), parseFloat(el.dataset.lon), el.dataset.name, el.dataset.region);
});
function geoResultHTML(item){
  return `<div class="search-result geo-result" data-lat="${item.lat}" data-lon="${item.lon}" data-name="${escapeHtml(item.name)}" data-region="${escapeHtml(item.region||'')}">
    <div class="city">${escapeHtml(item.name)}</div><div class="region">${escapeHtml(item.region||'')}</div>
  </div>`;
}

/* ---------------- MENU DRAWER ---------------- */
const drawer = document.getElementById('drawer');
const overlay = document.getElementById('overlay');
const menuBtn = document.getElementById('menuBtn');
function openDrawer(){ drawer.classList.add('show'); overlay.classList.add('show'); }
function closeDrawer(){ drawer.classList.remove('show'); overlay.classList.remove('show'); }
menuBtn.addEventListener('click', openDrawer);
overlay.addEventListener('click', () => { closeDrawer(); closeSearch(); closeSubpage(); });

/* ---------------- SEARCH PAGE (live geocoding, any area worldwide) ---------------- */
const searchPage = document.getElementById('searchPage');
const searchBtn = document.getElementById('searchBtn');
const searchBackBtn = document.getElementById('searchBackBtn');
const searchResults = document.getElementById('searchResults');
const citySearchInput = document.getElementById('citySearchInput');
const searchSectionTitle = document.getElementById('searchSectionTitle');

function renderSearchResults(list){
  searchResults.innerHTML = list.length
    ? list.map(geoResultHTML).join('')
    : `<div class="stat-desc" style="padding:16px 4px;">No matches found.</div>`;
}
function geocodeSearch(query){
  return fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=en&format=json`)
    .then(r => r.json())
    .then(d => (d.results || []).map(r => ({
      name: r.name,
      region: [r.admin1, r.country].filter(Boolean).join(', '),
      lat: r.latitude, lon: r.longitude
    })));
}

let searchDebounce;
citySearchInput.addEventListener('input', (e) => {
  const q = e.target.value.trim();
  clearTimeout(searchDebounce);
  if (q.length < 2) {
    searchSectionTitle.textContent = 'Popular Locations';
    renderSearchResults(POPULAR_CITIES);
    return;
  }
  searchSectionTitle.textContent = 'Searching…';
  searchDebounce = setTimeout(() => {
    geocodeSearch(q)
      .then(results => { searchSectionTitle.textContent = 'Search Results'; renderSearchResults(results); })
      .catch(() => { searchSectionTitle.textContent = 'Search Results'; renderSearchResults([]); });
  }, 400);
});

function openSearch(){ renderSearchResults(POPULAR_CITIES); searchSectionTitle.textContent = 'Popular Locations'; citySearchInput.value=''; searchPage.classList.add('show'); }
function closeSearch(){ searchPage.classList.remove('show'); }
searchBtn.addEventListener('click', openSearch);
searchBackBtn.addEventListener('click', closeSearch);

/* =========================================================
   CUSTOMIZE — show/hide sections, persisted
========================================================= */
const CUSTOMIZE_ITEMS = [
  {id:'hourlyCard',       label:'Hourly Forecast'},
  {id:'dailyCard',        label:'Daily Forecast'},
  {id:'aqCard',           label:'Air Quality'},
  {id:'pressureWindGrid', label:'Pressure & Wind'},
  {id:'uvVisGrid',        label:'UV & Visibility'},
  {id:'precipHumGrid',    label:'Precipitation & Humidity'},
  {id:'radarCard',        label:'Live Weather Radar'},
  {id:'sunMoonCard',      label:'Sun & Moon'},
  {id:'allergyCard',      label:'Allergy Outlook'},
  {id:'premiumPromo',     label:'Premium Offers'}
];
function getVisibility(){ try { return JSON.parse(localStorage.getItem('cardVisibility')) || {}; } catch(e) { return {}; } }
function isVisible(id){ return getVisibility()[id] !== false; }
function setVisible(id, val){
  const v = getVisibility(); v[id] = val;
  try { localStorage.setItem('cardVisibility', JSON.stringify(v)); } catch(e) {}
  applyVisibility();
}
function applyVisibility(){
  CUSTOMIZE_ITEMS.forEach(item => {
    const el = document.getElementById(item.id);
    if (el) el.classList.toggle('hidden', !isVisible(item.id));
  });
}

/* =========================================================
   LOCATION PERMISSION + "Use My Location"
========================================================= */
function showLocationPermModal(){
  const ov = document.getElementById('permOverlay');
  if (ov) ov.classList.add('show');
}
function hideLocationPermModal(e){
  if (e) e.preventDefault();
  const ov = document.getElementById('permOverlay');
  if (ov) ov.classList.remove('show');
}
function markLocationGranted(){
  const item = document.getElementById('locPermItem');
  if (!item) return;
  item.classList.remove('disabled');
  const label = item.querySelector('.label-text');
  if (label) label.textContent = 'Location detected';
}
function reverseGeocode(lat, lon){
  return fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`)
    .then(r => r.json())
    .then(d => {
      // Prefer the smallest/most specific name available (village, neighbourhood,
      // ward) before falling back to the city. BigDataCloud sometimes returns
      // this detail inside localityInfo.administrative / informative arrays.
      let finest = null;
      const info = d.localityInfo;
      if (info) {
        const pools = [].concat(info.informative || [], info.administrative || []);
        // Look for the most specific admin levels first (higher adminLevel = smaller area).
        const candidates = pools
          .filter(p => p && p.name && p.order != null)
          .sort((a, b) => (b.order || 0) - (a.order || 0));
        if (candidates.length) finest = candidates[0].name;
      }
      const name = finest || d.locality || d.city || d.principalSubdivision || 'My Location';
      return {
        name,
        region: [d.principalSubdivision, d.countryName].filter(Boolean).join(', ')
      };
    })
    .catch(() => ({ name: 'My Location', region: '' }));
}
function useMyLocation(){
  if (!navigator.geolocation) { alert('Geolocation is not supported on this device.'); return; }
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords;
    const place = await reverseGeocode(latitude, longitude);
    try { localStorage.setItem('locGranted', 'true'); } catch(e) {}
    markLocationGranted();
    closeSubpage();
    fetchAndRenderWeather(latitude, longitude, place.name, place.region);
  }, () => {
    alert('Location permission was denied.');
  });
}

/* =========================================================
   RATE ME
========================================================= */
function rateApp(n){
  try { localStorage.setItem('userRating', n); } catch(e) {}
  document.querySelectorAll('#starsRow .star').forEach(s => {
    s.classList.toggle('filled', parseInt(s.dataset.n, 10) <= n);
  });
  const msg = document.getElementById('rateMsg');
  if (msg) msg.textContent = `Thanks for rating us ${n} star${n>1?'s':''}!`;
}

/* =========================================================
   FEEDBACK
========================================================= */
function sendFeedback(){
  const t = document.getElementById('feedbackText');
  const msg = document.getElementById('feedbackMsg');
  if (!t.value.trim()) { msg.textContent = 'Please write something before sending.'; return; }
  msg.textContent = 'Thanks! Your feedback has been noted.';
  t.value = '';
}

/* =========================================================
   SUBPAGES
========================================================= */
const subpage = document.getElementById('subpage');
const subpageTitle = document.getElementById('subpageTitle');
const subpageBody = document.getElementById('subpageBody');
let currentSubpage = null;

const SUBPAGE_TITLES = {
  location: 'Manage Location', settings: 'Settings', units: 'Units', customize: 'Customize',
  premium: 'Weather Premium', rate: 'Rate Me', feedback: 'Feedback And Suggestion', privacy: 'Privacy Policy'
};

function segRow(title, key, options){
  return `<div class="unit-group">
    <div class="unit-title">${title}</div>
    <div class="seg">${options.map(o => `<button class="${units[key]===o.value?'active':''}" onclick="setUnit('${key}','${o.value}')">${o.label}</button>`).join('')}</div>
  </div>`;
}
function buildSettingsPage(){
  return `
    <div class="settings-row">
      <div>
        <div class="settings-row-title">Dark Mode</div>
        <div class="settings-row-sub">Stays on every time you reopen the app</div>
      </div>
      <label class="switch">
        <input type="checkbox" ${getTheme()==='dark' ? 'checked' : ''} onchange="setTheme(this.checked ? 'dark' : 'light')">
        <span class="track"><span class="knob"></span></span>
      </label>
    </div>
    <div class="settings-row clickable" onclick="openSubpage('units')">
      <div>
        <div class="settings-row-title">Units</div>
        <div class="settings-row-sub">Temperature, wind, pressure &amp; more</div>
      </div>
      <span class="settings-chevron">›</span>
    </div>
    <div class="settings-row clickable" onclick="useMyLocation()">
      <div>
        <div class="settings-row-title">Use My Location</div>
        <div class="settings-row-sub">Detect your city automatically — live</div>
      </div>
      <span class="settings-chevron">›</span>
    </div>
    <div class="settings-row">
      <div>
        <div class="settings-row-title">App Version</div>
        <div class="settings-row-sub">Weather Pro · 1.0 (Student Build)</div>
      </div>
    </div>`;
}
function buildUnitsPage(){
  return segRow('Temperature', 'temp', [{value:'C',label:'°C'},{value:'F',label:'°F'}])
       + segRow('Wind Speed', 'wind', [{value:'kmh',label:'km/h'},{value:'mph',label:'mph'}])
       + segRow('Pressure', 'pressure', [{value:'mbar',label:'mbar'},{value:'inhg',label:'inHg'}])
       + segRow('Precipitation', 'precip', [{value:'cm',label:'cm'},{value:'in',label:'in'}])
       + segRow('Visibility', 'vis', [{value:'km',label:'km'},{value:'mi',label:'mi'}]);
}
function buildCustomizePage(){
  return CUSTOMIZE_ITEMS.map(item => `
    <div class="settings-row">
      <div class="settings-row-title">${item.label}</div>
      <label class="switch">
        <input type="checkbox" ${isVisible(item.id) ? 'checked' : ''} onchange="setVisible('${item.id}', this.checked)">
        <span class="track"><span class="knob"></span></span>
      </label>
    </div>`).join('');
}
function locationCardSkeleton(loc, cardId, isMyLocation){
  return `
    <div class="loc-card" id="${cardId}" data-lat="${loc.lat}" data-lon="${loc.lon}"
         data-name="${escapeHtml(loc.name)}" data-region="${escapeHtml(loc.region||'')}"
         style="background:linear-gradient(160deg,#37485e,#5b6e85);">
      ${isMyLocation ? '' : `<button class="loc-card-remove" onclick="event.stopPropagation(); removeSavedLocation(${loc.lat}, ${loc.lon});">✕</button>`}
      <div class="loc-card-top">
        <div>
          <div class="loc-card-name">${isMyLocation ? 'My Location' : escapeHtml(loc.name)}</div>
          <div class="loc-card-sub">${isMyLocation ? escapeHtml(loc.name) : escapeHtml(loc.region||'')}</div>
        </div>
        <div class="loc-card-temp">…</div>
      </div>
      <div class="loc-card-bottom">
        <span class="loc-card-time">--:--</span>
        <span class="loc-card-desc">Loading…</span>
      </div>
    </div>`;
}

async function fillLocationCard(cardId, lat, lon){
  const el = document.getElementById(cardId);
  if (!el) return;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weather_code,is_day&timezone=auto`;
    const res = await fetch(url);
    const data = await res.json();
    const cur = data.current;
    const cond = weatherCodeInfo(cur.weather_code, cur.is_day === 1);
    el.style.background = LOCATION_CARD_BG[cond.icon] || LOCATION_CARD_BG.cloud;
    el.querySelector('.loc-card-temp').textContent = fmtTemp(cur.temperature_2m);
    el.querySelector('.loc-card-time').textContent = formatClock(cur.time);
    el.querySelector('.loc-card-desc').textContent = cond.desc;
  } catch (e) {
    const desc = el.querySelector('.loc-card-desc');
    if (desc) desc.textContent = 'Unavailable';
  }
}

document.addEventListener('click', (e) => {
  const card = e.target.closest('.loc-card');
  if (card) {
    const lat = parseFloat(card.dataset.lat), lon = parseFloat(card.dataset.lon);
    const name = card.dataset.name, region = card.dataset.region;
    closeSubpage();
    fetchAndRenderWeather(lat, lon, name, region);
  }
});

function buildLocationPage(){
  const saved = getSavedLocations();
  const cur = currentLocation;
  const myLocCard = cur ? locationCardSkeleton(cur, 'locCard_my', true) : '';
  const savedCards = saved.map((loc, i) => locationCardSkeleton(loc, `locCard_${i}`, false)).join('');

  setTimeout(() => {
    if (cur) fillLocationCard('locCard_my', cur.lat, cur.lon);
    saved.forEach((loc, i) => fillLocationCard(`locCard_${i}`, loc.lat, loc.lon));
  }, 0);

  return `
    <button class="loc-action-btn" onclick="useMyLocation()">📍 Use My Current Location</button>
    ${myLocCard}
    ${savedCards || '<div class="stat-desc" style="padding:6px 4px;">No saved locations yet — search for a city to add one.</div>'}
    <button class="loc-add-btn" onclick="closeSubpage(); openSearch();">+ Add New Location</button>`;
}
function buildPremiumPage(){
  return `
    <div class="unit-group">
      <div class="premium-feature">🔒 Ad-free experience</div>
      <div class="premium-feature">🔒 120-hour weather forecast</div>
      <div class="premium-feature">🔒 45-day weather forecast</div>
      <div class="premium-feature">🔒 Advanced radar layers</div>
    </div>
    <button class="premium-cta" onclick="alert('Premium purchases are not available in this demo build.')">Show all Premium Features</button>`;
}
function buildRatePage(){
  const saved = parseInt(localStorage.getItem('userRating') || '0', 10);
  return `
    <div class="stars-row" id="starsRow">
      ${[1,2,3,4,5].map(n => `<span class="star ${n<=saved?'filled':''}" data-n="${n}" onclick="rateApp(${n})">★</span>`).join('')}
    </div>
    <div class="rate-msg" id="rateMsg">${saved ? `Thanks for rating us ${saved} star${saved>1?'s':''}!` : 'Tap a star to rate Weather Pro'}</div>`;
}
function buildFeedbackPage(){
  return `
    <textarea class="feedback-textarea" id="feedbackText" placeholder="What should we improve?"></textarea>
    <button class="feedback-btn" onclick="sendFeedback()">Send Feedback</button>
    <div class="feedback-msg" id="feedbackMsg"></div>`;
}
function buildPrivacyPage(){
  return `
    <div class="policy-section"><h4>Overview</h4><p>Weather Pro shows live forecast information for the location you choose and keeps your preferences on this device only.</p></div>
    <div class="policy-section"><h4>Location Data</h4><p>If you choose "Use My Location," your device's coordinates are sent once to a location-lookup service to find your city name, and to a weather service to fetch live conditions. They are not stored on any server by this app.</p></div>
    <div class="policy-section"><h4>Data Storage</h4><p>Your theme, units, and layout choices are saved in your browser's local storage, on your device only.</p></div>
    <div class="policy-section"><h4>Third-Party Services</h4><p>Live weather, air quality, and place search are provided by Open-Meteo. Location lookups use a reverse-geocoding service. No account or sign-in is required.</p></div>
    <div class="policy-section"><h4>Contact</h4><p>This is a student project build of Weather Pro, made for learning purposes.</p></div>`;
}
const SUBPAGE_BUILDERS = {
  location: buildLocationPage, settings: buildSettingsPage, units: buildUnitsPage, customize: buildCustomizePage,
  premium: buildPremiumPage, rate: buildRatePage, feedback: buildFeedbackPage, privacy: buildPrivacyPage
};
function openSubpage(page){
  currentSubpage = page;
  subpageTitle.textContent = SUBPAGE_TITLES[page] || '';
  subpageBody.innerHTML = SUBPAGE_BUILDERS[page] ? SUBPAGE_BUILDERS[page]() : '';
  subpage.classList.add('show');
}
function closeSubpage(){ subpage.classList.remove('show'); currentSubpage = null; }

/* ---------------- live location quick-access icon (header) ---------------- */
const liveLocBtn = document.getElementById('liveLocBtn');
if (liveLocBtn) liveLocBtn.addEventListener('click', useMyLocation);

/* =========================================================
   INIT — try live GPS location first, fall back to a default city
========================================================= */
applyVisibility();

function init(){
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const place = await reverseGeocode(latitude, longitude);
        try { localStorage.setItem('locGranted', 'true'); } catch(e) {}
        markLocationGranted();
        fetchAndRenderWeather(latitude, longitude, place.name, place.region);
      },
      () => {
        const c = POPULAR_CITIES[0];
        fetchAndRenderWeather(c.lat, c.lon, c.name, c.region);
      }
    );
  } else {
    const c = POPULAR_CITIES[0];
    fetchAndRenderWeather(c.lat, c.lon, c.name, c.region);
  }
}
init();

/* ---------------- PWA: register service worker (enables "install as app") ---------------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {
      /* Not registered — e.g. opened via file:// or no HTTPS. The app still works normally. */
    });
  });
}
