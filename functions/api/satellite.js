import satellitesData from '../../satellites.json'

const ALL_SATS = (satellitesData.satellites ?? []).filter(s => s.ORBIT_TYPE === 'LEO')

const FALLBACK_SATS = [
  { OBJECT_NAME: 'FENGYUN 3D',  NORAD_CAT_ID: 43010, APOGEE: 851,  PERIGEE: 820, INCLINATION: 98.7, PERIOD: 101.4, LAUNCH: '2017-11-15', ORBIT_TYPE: 'LEO' },
  { OBJECT_NAME: 'TERRA',       NORAD_CAT_ID: 25994, APOGEE: 705,  PERIGEE: 694, INCLINATION: 98.2, PERIOD:  98.9, LAUNCH: '1999-12-18', ORBIT_TYPE: 'LEO' },
  { OBJECT_NAME: 'AQUA',        NORAD_CAT_ID: 27424, APOGEE: 710,  PERIGEE: 697, INCLINATION: 98.2, PERIOD:  98.9, LAUNCH: '2002-05-04', ORBIT_TYPE: 'LEO' },
  { OBJECT_NAME: 'SENTINEL-2A', NORAD_CAT_ID: 40697, APOGEE: 790,  PERIGEE: 783, INCLINATION: 98.6, PERIOD: 100.6, LAUNCH: '2015-06-23', ORBIT_TYPE: 'LEO' },
  { OBJECT_NAME: 'LANDSAT 8',   NORAD_CAT_ID: 39084, APOGEE: 708,  PERIGEE: 703, INCLINATION: 98.2, PERIOD:  99.0, LAUNCH: '2013-02-11', ORBIT_TYPE: 'LEO' },
  { OBJECT_NAME: 'SUOMI NPP',   NORAD_CAT_ID: 37849, APOGEE: 833,  PERIGEE: 826, INCLINATION: 98.7, PERIOD: 101.4, LAUNCH: '2011-10-28', ORBIT_TYPE: 'LEO' },
]

const POOL = ALL_SATS.length >= 10 ? ALL_SATS : FALLBACK_SATS

const CITY_LAT = {
  '北京': 39.9, '上海': 31.2, '广州': 23.1, '深圳': 22.5, '成都': 30.6,
  '杭州': 30.3, '武汉': 30.6, '西安': 34.3, '南京': 32.1, '重庆': 29.6,
  '天津': 39.1, '沈阳': 41.8, '哈尔滨': 45.8, '长春': 43.9, '济南': 36.7,
  '郑州': 34.7, '长沙': 28.2, '昆明': 25.0, '贵阳': 26.6, '南宁': 22.8,
  '海口': 20.0, '乌鲁木齐': 43.8, '拉萨': 29.7, '呼和浩特': 40.8,
  '合肥': 31.9, '福州': 26.1, '南昌': 28.7, '石家庄': 38.0, '太原': 37.9,
  '兰州': 36.1, '西宁': 36.6, '银川': 38.5, '香港': 22.3, '澳门': 22.2,
  'beijing': 39.9, 'shanghai': 31.2, 'guangzhou': 23.1, 'shenzhen': 22.5,
  'chengdu': 30.6, 'hangzhou': 30.3, 'wuhan': 30.6, 'xian': 34.3,
  'nanjing': 32.1, 'chongqing': 29.6, 'tianjin': 39.1, 'harbin': 45.8,
  'new york': 40.7, 'los angeles': 34.1, 'london': 51.5, 'paris': 48.9,
  'tokyo': 35.7, 'sydney': -33.9, 'moscow': 55.8, 'berlin': 52.5,
  'seoul': 37.6, 'singapore': 1.4, 'dubai': 25.2, 'mumbai': 19.1,
  'new delhi': 28.6, 'bangkok': 13.8, 'jakarta': -6.2, 'toronto': 43.7,
}

function getCityLat(city) {
  const key = city.trim()
  return CITY_LAT[key] ?? CITY_LAT[key.toLowerCase()] ?? 35.0
}

function strHash(s) {
  return s.split('').reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 0)
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url)
  const city  = url.searchParams.get('city')  ?? ''
  const name  = url.searchParams.get('name')  ?? ''
  const story = url.searchParams.get('story') ?? ''

  const lat    = getCityLat(city)
  const absLat = Math.abs(lat)

  const candidates = POOL.filter(s => {
    if (s.INCLINATION == null || Number(s.INCLINATION) < absLat) return false
    if (s.OBJECT_NAME?.toUpperCase().includes('STARLINK')) {
      return Number(s.NORAD_CAT_ID) % 10 === 0
    }
    return true
  })
  const pool = candidates.length >= 10 ? candidates : POOL

  const seed = strHash(city + name + story)
  const sat  = pool[seed % pool.length]

  return Response.json({
    ok: true,
    satellite: { ...sat, LAUNCH_DATE: sat.LAUNCH },
    source: 'local',
    matched_lat: lat,
    pool_size: pool.length,
  })
}
