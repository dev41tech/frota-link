import { useState, useRef } from 'react';
import { Camera, X, RotateCcw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onCancel?: () => void;
  maxSizeKB?: number;
}

export function CameraCapture({ onCapture, onCancel, maxSizeKB = 1024 }: CameraCaptureProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validar tipo
    if (!selectedFile.type.startsWith('image/')) {
      toast.error('Arquivo inválido. Selecione uma imagem.');
      return;
    }

    // Comprimir imagem se necessário
    const compressedFile = await compressImage(selectedFile, maxSizeKB);
    
    // Criar preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
      setFile(compressedFile);
    };
    reader.readAsDataURL(compressedFile);
  };

  const compressImage = async (file: File, maxSizeKB: number): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Redimensionar se muito grande
          const maxDimension = 1920;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Comprimir
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                
                // Verificar tamanho
                const sizeKB = compressedFile.size / 1024;
                if (sizeKB > maxSizeKB * 1.2) {
                  toast.warning(`Imagem comprimida para ${Math.round(sizeKB)}KB`);
                }
                
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.85 // Qualidade
          );
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleCapture = () => {
    if (file) {
      onCapture(file);
    }
  };

  const handleRetake = () => {
    setPreview(null);
    setFile(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <Card className="p-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        id="camera-input"
      />
      
      {!preview ? (
        <div className="space-y-4">
          <label
            htmlFor="camera-input"
            className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary transition-colors bg-muted/5"
          >
            <Camera className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground">Tirar Foto</p>
            <p className="text-sm text-muted-foreground mt-2">
              Toque para abrir a câmera
            </p>
          </label>
          
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="w-full"
            >
              <X className="w-5 h-5 mr-2" />
              Cancelar
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative rounded-lg overflow-hidden">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-auto"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleRetake}
              className="h-14"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Tirar Novamente
            </Button>
            
            <Button
              type="button"
              onClick={handleCapture}
              className="h-14"
            >
              <Check className="w-5 h-5 mr-2" />
              Confirmar
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
