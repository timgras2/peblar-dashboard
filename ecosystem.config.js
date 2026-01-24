module.exports = {
    apps: [{
        name: "peblar",
        script: "./node_modules/next/dist/bin/next",
        args: "start -H 0.0.0.0",
        env: {
            NODE_ENV: "production",
        }
    }]
}
