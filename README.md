# Peblar Charging Station Monitor

A simple web application to monitor your Peblar EV charging station locally. This application connects to your charging station via its local REST API and displays real-time charging status and historical charging sessions.

## Features

- Real-time monitoring of charging status
- Display of current power and energy consumption
- View of recent charging sessions
- Clean and modern user interface
- Local network operation

## Prerequisites

- Node.js 18 or later
- A Peblar charging station with local REST API
- Network connection to the charging station

## Finding Your Charging Station

1. Make sure your charging station is connected to your local network
2. Find the IP address of your charging station:
   - Check your router's admin interface for connected devices
   - Look for a device named "Peblar" or similar
   - Note down the IP address (e.g., 192.168.1.100)
3. Verify the REST API port (usually 8080)

## Installation

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd peblar-monitor
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory with your charging station settings:
   ```
   CHARGING_STATION_IP=http://192.168.1.100
   CHARGING_STATION_PORT=8080
   ```

   Replace `192.168.1.100` with your charging station's actual IP address.

## Usage

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open your browser and navigate to `http://localhost:3000`

3. The application will automatically connect to your charging station and start displaying real-time data.

## Configuration

You can modify the following settings in the `.env.local` file:

- `CHARGING_STATION_IP`: The IP address of your charging station (e.g., http://192.168.1.100)
- `CHARGING_STATION_PORT`: The port your charging station's REST API is running on (default: 8080)

## Troubleshooting

1. If you can't connect to the charging station:
   - Verify the IP address is correct by pinging it: `ping 192.168.1.100`
   - Check if the charging station is accessible on the network
   - Ensure the charging station is powered on
   - Check if any firewall is blocking the connection
   - Try accessing the REST API directly in your browser: `http://192.168.1.100:8080/api/v1/charging-station/status`

2. If the data seems incorrect:
   - Verify the API endpoints match your charging station's documentation
   - Check if the charging station's REST API is responding correctly

## License

MIT
