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
  energy: {
    // Fixed markup/tax per kWh (e.g., 0.15 for €0.15 energy tax)
    markup: parseFloat(process.env.ENERGY_PRICE_MARKUP || '0.13'),
    // VAT percentage (e.g., 0.21 for 21%)
    vat: parseFloat(process.env.ENERGY_VAT_PERCENTAGE || '0.21')
  },
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },
  pollingInterval: 5000, // 5 seconds
  demoMode: process.env.DEMO_MODE === 'true'
}; 