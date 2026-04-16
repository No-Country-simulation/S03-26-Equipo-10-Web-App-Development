'use client';

import { useState } from 'react';
import { TestimonialRecord } from '@/lib/api';
import { useSession } from '@/hooks/use-session';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Youtube, Image as ImageIcon, Loader2 } from 'lucide-react';
import Image from 'next/image';

interface TestimonialSheetProps {
  testimonial: TestimonialRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function TestimonialSheet({
  testimonial,
  open,
  onOpenChange,
  onUpdated,
}: TestimonialSheetProps) {
  const { fetchApi } = useSession();
  
  const [videoUrl, setVideoUrl] = useState('');
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  
  if (!testimonial) return null;

  async function handleVideoSubmit() {
    if (!videoUrl.trim() || !testimonial) return;
    setLoadingVideo(true);
    try {
      await fetchApi(`/testimonials/${testimonial.id}/video`, {
        method: 'POST',
        body: JSON.stringify({ videoUrl }),
      });
      setVideoUrl('');
      onUpdated();
    } catch (e: any) {
      alert(e.message || 'Error attaching video');
    } finally {
      setLoadingVideo(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !testimonial) return;
    
    setLoadingImage(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
          await fetchApi(`/testimonials/${testimonial.id}/image`, {
            method: 'POST',
            body: JSON.stringify({ imageBase64: base64 }),
          });
          onUpdated();
        } catch (err: any) {
          alert('Error uploading image: ' + err.message);
        } finally {
          setLoadingImage(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (e) {
      setLoadingImage(false);
    }
  }

  // Disable media editing if testimonial is already published
  const isPublished = testimonial.status === 'published';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-6 overflow-y-auto w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="font-caption text-2xl italic text-primary">
            Testimonio de {testimonial.authorName}
          </SheetTitle>
          <SheetDescription className="font-body text-xs uppercase tracking-widest">
            ID: {testimonial.id.split('-')[0]} • Status: {testimonial.status.toUpperCase()}
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-2 border-b pb-4">
          <Label className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contenido Original</Label>
          <p className="font-body text-sm italic">{testimonial.content}</p>
        </div>

        <div className="grid gap-6">
          <div className="flex flex-col gap-4 border p-4 bg-muted/10">
            <h3 className="font-body text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-foreground">
              <Youtube className="w-4 h-4 text-primary" />
              Adjuntar Video (YouTube)
            </h3>
            
            {testimonial.videoUrl ? (
              <div className="flex flex-col gap-2">
                <a href={testimonial.videoUrl} target="_blank" className="text-xs text-primary hover:underline truncate">
                  {testimonial.videoUrl}
                </a>
                {testimonial.videoThumbnailUrl && (
                  <div className="relative aspect-video w-full rounded overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={testimonial.videoThumbnailUrl} 
                      alt="Thumbnail" 
                      className="object-cover w-full h-full"
                    />
                  </div>
                )}
                {testimonial.videoTitle && (
                  <span className="text-xs text-muted-foreground">{testimonial.videoTitle}</span>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Input
                  placeholder="https://youtu.be/..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  disabled={isPublished || loadingVideo}
                  className="font-body text-sm bg-background"
                />
                <Button 
                  onClick={() => void handleVideoSubmit()}
                  disabled={!videoUrl || isPublished || loadingVideo}
                  className="w-full font-body text-xs uppercase tracking-wider"
                >
                  {loadingVideo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Vincular Video
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 border p-4 bg-muted/10">
            <h3 className="font-body text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-foreground">
              <ImageIcon className="w-4 h-4 text-primary" />
              Subir Imagen (Cloudinary)
            </h3>

            {testimonial.imageUrl ? (
              <div className="flex flex-col gap-2">
                <div className="relative w-full aspect-square max-h-[250px] rounded overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={testimonial.imageUrl} 
                    alt="Testimonial Image" 
                    className="object-contain w-full h-full bg-black/5"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={(e) => void handleImageUpload(e)}
                  disabled={isPublished || loadingImage}
                  className="font-body text-sm cursor-pointer bg-background"
                />
                {loadingImage && (
                  <div className="flex items-center text-xs text-muted-foreground gap-2 pt-2">
                    <Loader2 className="w-3 h-3 animate-spin"/> Subiendo a Cloudinary...
                  </div>
                )}
              </div>
            )}
          </div>
          
          {isPublished && (
            <p className="text-[10px] text-destructive uppercase tracking-widest text-center font-bold">
              Archivos bloqueados por estar publicado.
            </p>
          )}

        </div>
      </SheetContent>
    </Sheet>
  );
}
