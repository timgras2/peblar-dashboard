export const config = {
  api: {
    // The IP address of your charging station on your local network
    baseUrl: process.env.CHARGING_STATION_IP || 'http://192.168.1.35',
    // The port your charging station's REST API is running on
    port: process.env.CHARGING_STATION_PORT || '80',
    endpoints: {
      status: '/api/wlac/v1/evinterface',
      system: '/api/wlac/v1/system',
      meter: '/api/wlac/v1/meter'
    },
    token: process.env.PEBLAR_API_TOKEN || ''
  },
  pollingInterval: 5000, // 5 seconds
}; 