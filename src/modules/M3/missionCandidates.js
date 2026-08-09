export const MISSION_CANDIDATES = Object.freeze([
  Object.freeze({ id: 'weather', label: '气象监测', labelEn: 'WEATHER MONITORING', desc: '实时追踪大气层云系、温度场与风速，为地面预报提供原始数据。', descEn: 'Track cloud systems, temperature fields, and wind speed to support ground forecasting.', orbit: '太阳同步近地轨道（SSO / LEO）· 800–1000 km', orbitEn: 'Sun-synchronous LEO · 800–1000 km', example: '风云三号、NOAA-20', exampleEn: 'Fengyun-3, NOAA-20' }),
  Object.freeze({ id: 'comms', label: '通信中继', labelEn: 'COMMUNICATION RELAY', desc: '在轨道充当无线电中继，为偏远区域、船只或飞机提供网络覆盖。', descEn: 'Relay radio signals to provide coverage for remote regions, ships, and aircraft.', orbit: '低地球轨道星座（LEO）或地球静止轨道（GEO）· 550–35,786 km', orbitEn: 'LEO constellation or GEO · 550–35,786 km', example: '铱星系列、Starlink', exampleEn: 'Iridium, Starlink' }),
  Object.freeze({ id: 'imaging', label: '地球成像', labelEn: 'EARTH OBSERVATION', desc: '拍摄可见光或合成孔径雷达图像，用于灾害监测与资源普查。', descEn: 'Capture optical or synthetic-aperture radar imagery for disaster monitoring and resource surveys.', orbit: '太阳同步近地轨道（SSO / LEO）· 400–800 km', orbitEn: 'Sun-synchronous LEO · 400–800 km', example: '哨兵-2A、LANDSAT 8', exampleEn: 'Sentinel-2A, LANDSAT 8' }),
  Object.freeze({ id: 'science', label: '科学探测', labelEn: 'SCIENTIFIC RESEARCH', desc: '搭载精密仪器观测宇宙射线、地磁场或太阳粒子。', descEn: 'Use precision instruments to observe cosmic rays, Earth’s magnetic field, and solar particles.', orbit: '近极地低地球轨道（Polar LEO）· 450–530 km', orbitEn: 'Near-polar LEO · 450–530 km', example: 'Swarm、GRACE-FO', exampleEn: 'Swarm, GRACE-FO' }),
])

export const DEFAULT_MISSION_ID = MISSION_CANDIDATES[0].id
