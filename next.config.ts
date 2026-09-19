import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Orígenes permitidos para el servidor de desarrollo, de modo que la vista
  // previa remota pueda cargar la aplicación sin bloqueos de origen cruzado.
  allowedDevOrigins: ["*.e2b.app", "*.vercel.app", "localhost"],
};

export default nextConfig;
