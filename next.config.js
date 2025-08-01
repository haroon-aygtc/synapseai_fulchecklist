/** @type {import('next').NextConfig} */

const nextConfig = {
    images: {
        domains: ['images.unsplash.com'],
    },
    // Add server-only configuration to handle Node.js modules
    experimental: {
        serverComponentsExternalPackages: ['pg', 'ioredis', 'puppeteer', 'vm2'],
    },
    // Configure webpack to handle Node.js modules
    webpack: (config, { isServer }) => {
        if (!isServer) {
            // Don't attempt to import these modules on the client side
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                net: false,
                tls: false,
                dns: false,
                child_process: false,
                pg: false,
                'pg-native': false,
                ioredis: false,
                puppeteer: false,
                vm: false
            };
        }
        return config;
    }
};

if (process.env.NEXT_PUBLIC_TEMPO) {
    // Preserve Tempo configuration
    if (!nextConfig.experimental) {
        nextConfig.experimental = {};
    }
    
    // Add Tempo SWC plugins
    nextConfig.experimental.swcPlugins = [
        [require.resolve("tempo-devtools/swc/0.90"), {}]
    ];
}

module.exports = nextConfig;