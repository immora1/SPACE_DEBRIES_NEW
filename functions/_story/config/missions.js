export const MISSION_OPTIONS = [
  {
    action_id: 'weather',
    mission_id: 'WEATHER_MONITORING',
    label: '气象监测',
    label_en: 'WEATHER MONITORING',
    orbit: '太阳同步近地轨道（SSO / LEO）· 800–1000 km',
    example: '风云三号、NOAA-20',
    anomaly_type: 'WEATHER_DATA_DELAY',
  },
  {
    action_id: 'comms',
    mission_id: 'COMMUNICATION_RELAY',
    label: '通信中继',
    label_en: 'COMMUNICATION RELAY',
    orbit: '低地球轨道星座（LEO）或地球静止轨道（GEO）· 550–35,786 km',
    example: '铱星系列、Starlink',
    anomaly_type: 'MESSAGE_DELAY',
  },
  {
    action_id: 'imaging',
    mission_id: 'EARTH_IMAGING',
    label: '地球成像',
    label_en: 'EARTH OBSERVATION',
    orbit: '太阳同步近地轨道（SSO / LEO）· 400–800 km',
    example: '哨兵-2A、LANDSAT 8',
    anomaly_type: 'POSITIONING_OFFSET',
  },
  {
    action_id: 'science',
    mission_id: 'SCIENTIFIC_EXPLORATION',
    label: '科学探测',
    label_en: 'SCIENTIFIC RESEARCH',
    orbit: '近极地低地球轨道（Polar LEO）· 450–530 km',
    example: 'Swarm、GRACE-FO',
    anomaly_type: 'TIME_SYNC_ERROR',
  },
]

export const MISSION_BY_ACTION = Object.freeze(
  Object.fromEntries(MISSION_OPTIONS.map((item) => [item.action_id, item])),
)

export function getMission(actionId) {
  return MISSION_BY_ACTION[actionId] || null
}
