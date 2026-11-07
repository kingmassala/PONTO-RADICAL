import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    // Imagens optimizadas: bucket «media» do Supabase e fotografias iniciais do Unsplash.
    remotePatterns: [
      ...(supabaseUrl ? [new URL(`${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/media/**`)] : []),
      // Fotografias iniciais (licença Unsplash). Podem ser substituídas na Biblioteca Multimédia.
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    serverActions: {
      // Imagens até 10 MB + margem do multipart.
      bodySizeLimit: "11mb",
    },
  },
  /**
   * Subdomínio da Gestão de Obras: gestao.<domínio>/x serve /gestao/x (mesma aplicação, mesma base de dados).
   * Excepções: recursos do Next (_next), APIs (/api), callback de autenticação (/auth) e o próprio /gestao.
   */
  async rewrites() {
    const host = [{ type: "host" as const, value: "gestao\\..*" }];
    return {
      beforeFiles: [
        { source: "/", has: host, destination: "/gestao" },
        { source: "/:path((?!gestao(?:/|$)|_next/|api/|auth/|icon\\.svg|favicon\\.ico).*)", has: host, destination: "/gestao/:path" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
