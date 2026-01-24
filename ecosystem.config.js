module.exports = {
    apps: [{
        name: "peblar",
        script: "npm",
        args: "run start -- -H 0.0.0.0",
        shell: true,
        env: {
            NODE_ENV: "production",
        }
    }]
}
