'use client';

// Utilidad para comprimir y convertir imágenes a Base64 ultraligero
// Permite guardar fotos de cartas físicas y justificativos en Firestore (gratis, sin Storage)
export const comprimirImagenABase64 = (file: File, maxDimension: number = 800, quality: number = 0.6): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Exportar como JPEG comprimido a ~30-60 KB
        const base64Comprimido = canvas.toDataURL('image/jpeg', quality);
        resolve(base64Comprimido);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};
