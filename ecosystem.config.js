const path = require('path');

module.exports = {
    apps: [{
        name: "peblar",
        script: "./node_modules/next/dist/bin/next",
        args: "start -H 0.0.0.0",
        cwd: __dirname,
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        // Delay between restarts to prevent "hammering" the system if it crashes
        exp_backoff_restart_delay: 100,
        // Save logs to specific files so they don't disappear
        error_file: "logs/err.log",
        out_file: "logs/out.log",
        log_date_format: "YYYY-MM-DD HH:mm:ss",
        env: {
            NODE_ENV: "production",
        }
    }]
}
